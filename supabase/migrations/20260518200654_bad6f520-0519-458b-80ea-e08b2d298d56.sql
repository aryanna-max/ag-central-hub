BEGIN;

-- ============================================================
-- 1) Enum de status (planejada → aprovada → em_curso → concluída → cancelada)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'absence_status') THEN
    CREATE TYPE public.absence_status AS ENUM (
      'planejada','aprovada','em_curso','concluida','cancelada'
    );
  END IF;
END $$;

-- ============================================================
-- 2) Garantir role 'rh' no app_role enum (idempotente)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'rh'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'rh';
  END IF;
END $$;

-- ============================================================
-- 3) Tabela unificada employee_absences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_absences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  absence_type    public.absence_type NOT NULL,
    -- valores: ferias, licenca_medica, licenca_maternidade,
    -- licenca_paternidade, afastamento, falta, outros
  start_date      date NOT NULL,
  end_date        date NOT NULL CHECK (end_date >= start_date),
  status          public.absence_status NOT NULL DEFAULT 'planejada',

  -- Campos específicos de férias (nullable para outros tipos)
  daily_rate      numeric(10,2),
  payment_method  text,

  notes           text,

  -- Auditoria
  approved_by     uuid REFERENCES public.profiles(id),
  approved_at     timestamptz,
  created_by_id   uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ea_employee_status
  ON public.employee_absences (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_ea_date_range
  ON public.employee_absences (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ea_ativas
  ON public.employee_absences (employee_id, start_date, end_date)
  WHERE status IN ('aprovada','em_curso');

DROP TRIGGER IF EXISTS set_updated_at_employee_absences ON public.employee_absences;
CREATE TRIGGER set_updated_at_employee_absences
  BEFORE UPDATE ON public.employee_absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

-- Política permissiva (mesmo padrão das outras tabelas do projeto)
DROP POLICY IF EXISTS "ea_all" ON public.employee_absences;
CREATE POLICY "ea_all" ON public.employee_absences
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4) Trigger: materializa em daily_schedule_entries quando aprovado
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_materialize_absence_to_dse()
RETURNS TRIGGER AS $$
DECLARE
  d date;
  v_should_materialize boolean := false;
  v_should_revert boolean := false;
BEGIN
  -- Decidir se materializa ou reverte
  IF TG_OP = 'INSERT' AND NEW.status IN ('aprovada','em_curso') THEN
    v_should_materialize := true;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('aprovada','em_curso')
       AND OLD.status NOT IN ('aprovada','em_curso') THEN
      v_should_materialize := true;
    ELSIF OLD.status IN ('aprovada','em_curso')
          AND NEW.status IN ('cancelada','planejada') THEN
      v_should_revert := true;
    END IF;
  END IF;

  IF v_should_materialize THEN
    FOR d IN
      SELECT generate_series(NEW.start_date, NEW.end_date, INTERVAL '1 day')::date
    LOOP
      INSERT INTO public.daily_schedules (schedule_date)
      VALUES (d)
      ON CONFLICT (schedule_date) DO NOTHING;

      INSERT INTO public.daily_schedule_entries (
        daily_schedule_id,
        employee_id,
        day_type,
        is_vacation_override
      )
      SELECT
        ds.id,
        NEW.employee_id,
        CASE
          WHEN NEW.absence_type = 'licenca_medica' THEN 'atestado'::day_type
          WHEN NEW.absence_type = 'falta' THEN 'falta'::day_type
          ELSE 'normal'::day_type
        END,
        CASE
          WHEN NEW.absence_type IN ('ferias','licenca_maternidade','licenca_paternidade','afastamento') THEN true
          ELSE false
        END
      FROM public.daily_schedules ds
      WHERE ds.schedule_date = d
      ON CONFLICT (daily_schedule_id, employee_id) DO UPDATE
        SET day_type = EXCLUDED.day_type,
            is_vacation_override = EXCLUDED.is_vacation_override;
    END LOOP;
  END IF;

  IF v_should_revert THEN
    UPDATE public.daily_schedule_entries dse
    SET is_vacation_override = false,
        day_type = 'normal'::day_type
    FROM public.daily_schedules ds
    WHERE ds.id = dse.daily_schedule_id
      AND dse.employee_id = OLD.employee_id
      AND ds.schedule_date BETWEEN OLD.start_date AND OLD.end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_materialize_absence ON public.employee_absences;
CREATE TRIGGER trg_materialize_absence
  AFTER INSERT OR UPDATE ON public.employee_absences
  FOR EACH ROW EXECUTE FUNCTION public.fn_materialize_absence_to_dse();

-- ============================================================
-- 5) Migrar dados existentes de employee_vacations
-- ============================================================
INSERT INTO public.employee_absences (
  employee_id, absence_type, start_date, end_date, status,
  daily_rate, payment_method, notes,
  created_by_id, created_at, updated_at
)
SELECT
  ev.employee_id,
  'ferias'::absence_type,
  ev.start_date,
  ev.end_date,
  'aprovada'::absence_status,
  ev.daily_rate,
  ev.payment_method,
  ev.notes,
  ev.created_by_id,
  ev.created_at,
  ev.updated_at
FROM public.employee_vacations ev
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_absences ea
  WHERE ea.employee_id = ev.employee_id
    AND ea.start_date = ev.start_date
    AND ea.end_date = ev.end_date
    AND ea.absence_type = 'ferias'
);

-- ============================================================
-- 6) Deprecar employee_vacations (sem dropar)
-- ============================================================
COMMENT ON TABLE public.employee_vacations IS
  'DEPRECATED 2026-05-17. Migrado para employee_absences (unificada). '
  'Não inserir novos registros aqui. Pode ser dropada após auditoria.';

COMMIT;
