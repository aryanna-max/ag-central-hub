CREATE TABLE IF NOT EXISTS public.schedule_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  reason TEXT,
  previous_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.schedule_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_anon" ON public.schedule_audit FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "sa_auth" ON public.schedule_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);