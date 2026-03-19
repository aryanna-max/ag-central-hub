
-- Drop old medicoes table
DROP TABLE IF EXISTS public.medicoes CASCADE;

-- Create measurements table
CREATE TABLE public.measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_bm TEXT NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  dias_semana INTEGER NOT NULL DEFAULT 0,
  valor_diaria_semana NUMERIC NOT NULL DEFAULT 0,
  dias_fds INTEGER NOT NULL DEFAULT 0,
  valor_diaria_fds NUMERIC NOT NULL DEFAULT 0,
  retencao_pct NUMERIC NOT NULL DEFAULT 5,
  valor_bruto NUMERIC GENERATED ALWAYS AS (
    (dias_semana * valor_diaria_semana) + (dias_fds * valor_diaria_fds)
  ) STORED,
  valor_retencao NUMERIC GENERATED ALWAYS AS (
    ((dias_semana * valor_diaria_semana) + (dias_fds * valor_diaria_fds)) * retencao_pct / 100
  ) STORED,
  valor_nf NUMERIC GENERATED ALWAYS AS (
    ((dias_semana * valor_diaria_semana) + (dias_fds * valor_diaria_fds))
    - (((dias_semana * valor_diaria_semana) + (dias_fds * valor_diaria_fds)) * retencao_pct / 100)
  ) STORED,
  status TEXT NOT NULL DEFAULT 'rascunho',
  nf_numero TEXT,
  nf_data DATE,
  pdf_signed_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurements_anon" ON public.measurements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "measurements_auth" ON public.measurements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Status validation trigger
CREATE OR REPLACE FUNCTION public.validate_measurement_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('rascunho','aguardando_nf','nf_emitida','pago','cancelado') THEN
    RAISE EXCEPTION 'Invalid measurement status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_measurement_status
  BEFORE INSERT OR UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.validate_measurement_status();

CREATE TRIGGER trg_measurements_updated_at
  BEFORE UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
