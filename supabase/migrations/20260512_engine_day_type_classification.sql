-- Engine canônica de classificação de dia (decisão arquitetural Aryanna 29/04)
-- Substitui a tabela fantasma "attendance". Discriminador `day_type` em
-- daily_schedule_entries + função fn_employee_day_status como verdade única.

BEGIN;

CREATE TYPE public.day_type AS ENUM (
  'projeto', 'reserva_ag', 'folga', 'atestado', 'falta'
);

ALTER TABLE public.daily_schedule_entries
  ADD COLUMN day_type public.day_type NOT NULL DEFAULT 'projeto';

ALTER TABLE public.daily_schedule_entries
  ADD CONSTRAINT day_type_project_consistency CHECK (
    day_type <> 'projeto' OR project_id IS NOT NULL
  );

UPDATE public.daily_schedule_entries
SET day_type = 'projeto'
WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_employee_day_status(
  p_employee_id UUID,
  p_date DATE
)
RETURNS TABLE (
  day_type public.day_type,
  attendance public.attendance_status,
  project_id UUID,
  project_name TEXT,
  project_codigo TEXT,
  absence_reason TEXT,
  conta_como_dia_util BOOLEAN,
  conta_como_vt BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dse.day_type, dse.attendance, dse.project_id,
    p.name, p.codigo, dse.absence_reason,
    CASE
      WHEN dse.day_type IN ('projeto','reserva_ag') AND dse.attendance = 'presente' THEN TRUE
      WHEN dse.day_type = 'atestado' THEN TRUE
      ELSE FALSE
    END,
    CASE
      WHEN dse.day_type = 'projeto' AND dse.attendance = 'presente' THEN TRUE
      WHEN dse.day_type = 'reserva_ag' THEN TRUE
      ELSE FALSE
    END
  FROM public.daily_schedule_entries dse
  LEFT JOIN public.daily_schedules ds ON ds.id = dse.daily_schedule_id
  LEFT JOIN public.projects p ON p.id = dse.project_id
  WHERE dse.employee_id = p_employee_id
    AND ds.schedule_date = p_date;
END;
$$;

COMMENT ON FUNCTION public.fn_employee_day_status IS
  'Classifica o dia: day_type + attendance + conta como dia útil pra Alelo + conta como VT. Engine canônica — NÃO duplicar na UI.';

CREATE INDEX IF NOT EXISTS idx_daily_schedule_entries_employee
  ON public.daily_schedule_entries (employee_id);

COMMIT;
