-- ============================================================================
-- Fix arquitetural: attendance fantasma → day_type + validated_at + Preencher
-- Princípios: P12 (enum attendance_status intacto), P14 (sem fixtures)
-- Plano ≠ Fato. Discriminador: validated_at.
-- ============================================================================

BEGIN;

-- 1) Enum novo (ortogonal a attendance_status)
CREATE TYPE public.day_type AS ENUM (
  'projeto', 'reserva_ag', 'folga', 'atestado', 'falta'
);

-- 2) Colunas em daily_schedule_entries
ALTER TABLE public.daily_schedule_entries
  ADD COLUMN day_type public.day_type,
  ADD COLUMN validated_at timestamptz,
  ADD COLUMN validated_by_id uuid REFERENCES public.profiles(id);

-- 3) Constraints
ALTER TABLE public.daily_schedule_entries
  ADD CONSTRAINT day_type_project_consistency CHECK (
    day_type IS NULL
    OR (day_type = 'projeto' AND project_id IS NOT NULL)
    OR (day_type <> 'projeto' AND project_id IS NULL)
  );

ALTER TABLE public.daily_schedule_entries
  ADD CONSTRAINT validated_requires_day_type CHECK (
    validated_at IS NULL OR day_type IS NOT NULL
  );

-- 4) Backfill mínimo: entries com project_id ganham day_type='projeto'
UPDATE public.daily_schedule_entries
SET day_type = 'projeto'
WHERE project_id IS NOT NULL AND day_type IS NULL;

-- 5) daily_schedules ganha last_synced_at (detecta "plano mudou")
ALTER TABLE public.daily_schedules ADD COLUMN last_synced_at timestamptz;

-- 6) Função: janela de validação (hoje + 2 dias úteis pra trás)
CREATE OR REPLACE FUNCTION public.fn_is_within_validation_window(p_schedule_date date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_schedule_date <= CURRENT_DATE
     AND p_schedule_date >= (
       CURRENT_DATE - CASE EXTRACT(DOW FROM CURRENT_DATE)::int
           WHEN 0 THEN 4  -- domingo → 4 dias (qui)
           WHEN 1 THEN 4  -- segunda → 4 dias (qui anterior)
           WHEN 2 THEN 4  -- terça → 4 dias (sex anterior)
           ELSE 2         -- qua-sáb → 2 dias
         END
     );
$$;

-- 7) Trigger: bloqueia validação fora da janela
CREATE OR REPLACE FUNCTION public.fn_validate_day_entry_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_schedule_date date;
  v_was_unvalidated boolean;
BEGIN
  v_was_unvalidated := (TG_OP = 'INSERT') OR (OLD.validated_at IS NULL);

  IF NEW.validated_at IS NOT NULL AND v_was_unvalidated THEN
    SELECT schedule_date INTO v_schedule_date
    FROM public.daily_schedules WHERE id = NEW.daily_schedule_id;

    IF v_schedule_date IS NULL THEN
      RAISE EXCEPTION 'daily_schedule não encontrado para entry %', NEW.id;
    END IF;

    IF NOT public.fn_is_within_validation_window(v_schedule_date) THEN
      RAISE EXCEPTION 'Validação fora da janela: dia % está fora do permitido. Solicite reabertura à diretoria.', v_schedule_date;
    END IF;

    IF NEW.validated_by_id IS NULL THEN
      NEW.validated_by_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_day_entry_window
  BEFORE INSERT OR UPDATE OF validated_at ON public.daily_schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_day_entry_window();

-- 8) Função reabertura (só master, motivo obrigatório, audita em event_log)
CREATE OR REPLACE FUNCTION public.fn_unvalidate_day_entry(
  p_entry_id uuid, p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role public.app_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'master'::public.app_role THEN
    RAISE EXCEPTION 'Apenas master pode reabrir dia validado. Role atual: %', v_caller_role;
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo de reabertura é obrigatório para auditoria';
  END IF;

  INSERT INTO public.event_log (event_type, entity_table, entity_id, actor_type, actor_id, payload)
  VALUES (
    'day_entry.unvalidated',
    'daily_schedule_entries',
    p_entry_id,
    'user',
    auth.uid(),
    jsonb_build_object('motivo', p_motivo, 'reaberto_em', now())
  );

  UPDATE public.daily_schedule_entries
  SET validated_at = NULL, validated_by_id = NULL
  WHERE id = p_entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_unvalidate_day_entry FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_unvalidate_day_entry TO authenticated;

-- 9) Engine: status do dia — SÓ registros validados
CREATE OR REPLACE FUNCTION public.fn_employee_day_status(
  p_employee_id uuid, p_date date
) RETURNS TABLE (
  day_type public.day_type,
  attendance public.attendance_status,
  project_id uuid,
  project_name text,
  project_codigo text,
  absence_reason text,
  validated_at timestamptz,
  validated_by_id uuid,
  conta_como_dia_util boolean,
  conta_como_vt boolean
) LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dse.day_type,
    dse.attendance,
    dse.project_id,
    p.name,
    p.codigo,
    dse.absence_reason,
    dse.validated_at,
    dse.validated_by_id,
    CASE
      WHEN dse.day_type IN ('projeto', 'reserva_ag') AND dse.attendance = 'presente' THEN TRUE
      WHEN dse.day_type = 'atestado' THEN TRUE
      ELSE FALSE
    END AS conta_como_dia_util,
    CASE
      WHEN dse.day_type = 'projeto' AND dse.attendance = 'presente' THEN TRUE
      WHEN dse.day_type = 'reserva_ag' THEN TRUE
      ELSE FALSE
    END AS conta_como_vt
  FROM public.daily_schedule_entries dse
  LEFT JOIN public.daily_schedules ds ON ds.id = dse.daily_schedule_id
  LEFT JOIN public.projects p ON p.id = dse.project_id
  WHERE dse.employee_id = p_employee_id
    AND ds.schedule_date = p_date
    AND dse.validated_at IS NOT NULL;
END;
$$;

-- 10) Função "Preencher Escala": gera entries do dia a partir de daily_team_assignments
CREATE OR REPLACE FUNCTION public.fn_preencher_escala_dia(p_schedule_date date)
RETURNS TABLE (
  daily_schedule_id uuid,
  created_count int,
  updated_count int,
  skipped_validated_count int,
  conflicts jsonb
) LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_ds_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_conflicts jsonb := '[]'::jsonb;
  v_assignment record;
  v_member record;
  v_existing record;
BEGIN
  SELECT id INTO v_ds_id FROM public.daily_schedules WHERE schedule_date = p_schedule_date;
  IF v_ds_id IS NULL THEN
    INSERT INTO public.daily_schedules (schedule_date) VALUES (p_schedule_date) RETURNING id INTO v_ds_id;
  END IF;

  FOR v_assignment IN
    SELECT dta.id, dta.team_id, dta.project_id, dta.vehicle_id
    FROM public.daily_team_assignments dta
    WHERE dta.daily_schedule_id = v_ds_id
  LOOP
    FOR v_member IN
      SELECT tm.employee_id FROM public.team_members tm WHERE tm.team_id = v_assignment.team_id
    LOOP
      SELECT id, project_id, validated_at INTO v_existing
      FROM public.daily_schedule_entries
      WHERE daily_schedule_id = v_ds_id AND employee_id = v_member.employee_id
      LIMIT 1;

      IF v_existing.id IS NULL THEN
        INSERT INTO public.daily_schedule_entries (
          daily_schedule_id, employee_id, project_id, team_id, vehicle_id,
          daily_team_assignment_id, day_type
        ) VALUES (
          v_ds_id, v_member.employee_id, v_assignment.project_id,
          v_assignment.team_id, v_assignment.vehicle_id, v_assignment.id, 'projeto'
        );
        v_created := v_created + 1;
      ELSIF v_existing.validated_at IS NOT NULL THEN
        v_skipped := v_skipped + 1;
      ELSIF v_existing.project_id IS DISTINCT FROM v_assignment.project_id THEN
        v_conflicts := v_conflicts || jsonb_build_object(
          'entry_id', v_existing.id,
          'employee_id', v_member.employee_id,
          'old_project_id', v_existing.project_id,
          'new_project_id', v_assignment.project_id
        );
      ELSE
        UPDATE public.daily_schedule_entries
        SET team_id = v_assignment.team_id,
            vehicle_id = v_assignment.vehicle_id,
            daily_team_assignment_id = v_assignment.id
        WHERE id = v_existing.id;
        v_updated := v_updated + 1;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.daily_schedules SET last_synced_at = now() WHERE id = v_ds_id;

  RETURN QUERY SELECT v_ds_id, v_created, v_updated, v_skipped, v_conflicts;
END;
$$;

-- 11) Função resolver conflito (manter/trocar)
CREATE OR REPLACE FUNCTION public.fn_resolver_conflito_preencher(
  p_entry_id uuid, p_acao text, p_new_project_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_acao = 'trocar' THEN
    IF p_new_project_id IS NULL THEN
      RAISE EXCEPTION 'Ação trocar requer p_new_project_id';
    END IF;
    UPDATE public.daily_schedule_entries
    SET project_id = p_new_project_id
    WHERE id = p_entry_id AND validated_at IS NULL;
  END IF;
END;
$$;

-- 12) Índices
CREATE INDEX IF NOT EXISTS idx_daily_schedule_entries_employee
  ON public.daily_schedule_entries (employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_entries_validated
  ON public.daily_schedule_entries (validated_at) WHERE validated_at IS NOT NULL;

COMMIT;
