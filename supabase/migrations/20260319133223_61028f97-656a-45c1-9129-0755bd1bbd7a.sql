
-- Tabela de Medições (controle de faturamento por medição)
CREATE TABLE IF NOT EXISTS public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_name TEXT,
  cnpj_faturamento TEXT,
  valor_nf NUMERIC DEFAULT 0,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'aguardando_nf',
  nf_numero TEXT,
  nf_data DATE,
  pdf_signed_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes_anon" ON public.medicoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "medicoes_auth" ON public.medicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_medicao_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('aguardando_nf','nf_emitida','pago','cancelado') THEN
    RAISE EXCEPTION 'Invalid medicao status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_medicao_status
  BEFORE INSERT OR UPDATE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.validate_medicao_status();

-- Auto-update updated_at
CREATE TRIGGER trg_medicoes_updated_at
  BEFORE UPDATE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
