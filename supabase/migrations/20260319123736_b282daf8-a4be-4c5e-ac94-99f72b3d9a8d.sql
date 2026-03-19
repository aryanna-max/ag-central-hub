CREATE TABLE IF NOT EXISTS public.employee_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key_value TEXT,
  bank TEXT,
  holder_name TEXT,
  preference TEXT DEFAULT 'padrao',
  is_intermediary BOOLEAN DEFAULT false,
  intermediary_note TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.employee_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "epm_anon" ON public.employee_payment_methods FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "epm_auth" ON public.employee_payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);