
-- lead_status_history
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_full_lead_status_history" ON public.lead_status_history
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- project_participations
CREATE TABLE IF NOT EXISTS public.project_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  role text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_participations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_full_project_participations" ON public.project_participations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS trg_project_participations_updated_at ON public.project_participations;
CREATE TRIGGER trg_project_participations_updated_at
  BEFORE UPDATE ON public.project_participations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- monthly_discount_report_batches
CREATE TABLE IF NOT EXISTS public.monthly_discount_report_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month date NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho',
  sent_at timestamptz,
  sent_by uuid,
  applied_at timestamptz,
  applied_by uuid,
  total_alelo numeric NOT NULL DEFAULT 0,
  total_vt numeric NOT NULL DEFAULT 0,
  total_descontos numeric NOT NULL DEFAULT 0,
  total_liquido numeric NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_discount_report_batches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_full_mdr_batches" ON public.monthly_discount_report_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS trg_mdr_batches_updated_at ON public.monthly_discount_report_batches;
CREATE TRIGGER trg_mdr_batches_updated_at
  BEFORE UPDATE ON public.monthly_discount_report_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- monthly_discount_reports.batch_id
ALTER TABLE public.monthly_discount_reports
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- employees.recebe_alelo / alelo_valor_dia
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS recebe_alelo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alelo_valor_dia numeric NOT NULL DEFAULT 0;

-- daily_schedules.last_synced_at
ALTER TABLE public.daily_schedules
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- RPC stubs
CREATE OR REPLACE FUNCTION public.fn_generate_monthly_discount_batch(
  p_reference_month date,
  p_title text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.monthly_discount_report_batches
   WHERE reference_month = p_reference_month LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.monthly_discount_report_batches(reference_month, title)
  VALUES (p_reference_month, COALESCE(p_title, to_char(p_reference_month,'MM/YYYY')))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_preencher_escala_dia(
  p_schedule_date date
) RETURNS TABLE(
  daily_schedule_id uuid,
  created_count integer,
  updated_count integer,
  skipped_validated_count integer,
  conflicts jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ds_id uuid;
BEGIN
  SELECT id INTO v_ds_id FROM public.daily_schedules WHERE schedule_date = p_schedule_date LIMIT 1;
  RETURN QUERY SELECT v_ds_id, 0, 0, 0, '[]'::jsonb;
END $$;

CREATE OR REPLACE FUNCTION public.fn_resolver_conflito_preencher(
  p_entry_id uuid,
  p_acao text,
  p_new_project_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_acao = 'trocar' AND p_new_project_id IS NOT NULL THEN
    UPDATE public.daily_schedule_entries SET project_id = p_new_project_id WHERE id = p_entry_id;
  END IF;
END $$;
