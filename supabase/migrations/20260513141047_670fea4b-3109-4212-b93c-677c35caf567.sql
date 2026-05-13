
-- 1. Enum day_type
DO $$ BEGIN
  CREATE TYPE public.day_type AS ENUM ('normal','folga','falta','atestado','reserva_ag');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. daily_schedule_entries: day_type, validated_at, validated_by_id
ALTER TABLE public.daily_schedule_entries
  ADD COLUMN IF NOT EXISTS day_type public.day_type,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by_id uuid;

-- 3. projects.nf_data
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS nf_data date;

-- 4. employee_dependents
CREATE TABLE IF NOT EXISTS public.employee_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  name text NOT NULL,
  cpf text,
  data_nascimento date,
  parentesco text NOT NULL DEFAULT 'outro',
  is_dependente_irrf boolean NOT NULL DEFAULT false,
  is_dependente_saude boolean NOT NULL DEFAULT false,
  is_dependente_salario_familia boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_full_employee_dependents" ON public.employee_dependents
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS trg_employee_dependents_updated_at ON public.employee_dependents;
CREATE TRIGGER trg_employee_dependents_updated_at
  BEFORE UPDATE ON public.employee_dependents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. event_log
CREATE TABLE IF NOT EXISTS public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'user',
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_log_entity ON public.event_log(entity_table, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON public.event_log(event_type, occurred_at DESC);
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_read_event_log" ON public.event_log
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_insert_event_log" ON public.event_log
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. log_event RPC
CREATE OR REPLACE FUNCTION public.log_event(
  p_event_type text,
  p_entity_table text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_context jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.event_log(event_type, entity_table, entity_id, actor_type, actor_id, payload, context)
  VALUES (p_event_type, p_entity_table, p_entity_id, 'user', auth.uid(), COALESCE(p_payload,'{}'::jsonb), p_context)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 7. fn_employee_day_status RPC
CREATE OR REPLACE FUNCTION public.fn_employee_day_status(
  p_employee_id uuid,
  p_date date
) RETURNS TABLE(
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
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    (dse.day_type IS NULL OR dse.day_type = 'normal') AS conta_como_dia_util,
    (dse.day_type IS NULL OR dse.day_type = 'normal') AS conta_como_vt
  FROM public.daily_schedule_entries dse
  JOIN public.daily_schedules ds ON ds.id = dse.daily_schedule_id
  LEFT JOIN public.projects p ON p.id = dse.project_id
  WHERE dse.employee_id = p_employee_id
    AND ds.schedule_date = p_date
  LIMIT 1;
END $$;
