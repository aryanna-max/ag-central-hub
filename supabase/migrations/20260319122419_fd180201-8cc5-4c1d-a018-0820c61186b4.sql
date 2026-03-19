
-- 1. Regras de benefício (VR/VA/VT)
CREATE TABLE public.benefit_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL,
  daily_value NUMERIC(8,2) DEFAULT 0,
  effective_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_benefit_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.benefit_type NOT IN ('vr','va','vt') THEN
    RAISE EXCEPTION 'Invalid benefit_type: %', NEW.benefit_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_benefit_type
BEFORE INSERT OR UPDATE ON public.benefit_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_benefit_type();

ALTER TABLE public.benefit_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.benefit_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.benefit_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Enum de status de folha de campo
CREATE TYPE public.field_payment_status AS ENUM ('rascunho','em_revisao','aprovada','paga','cancelada');

-- 3. Folha de pagamento de campo (semanal)
CREATE TABLE public.field_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_value NUMERIC(12,2) DEFAULT 0,
  status public.field_payment_status DEFAULT 'rascunho',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.field_payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.field_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Itens da folha semanal (1 linha por funcionário por semana)
CREATE TABLE public.field_payment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_payment_id UUID NOT NULL REFERENCES public.field_payments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  project_name TEXT,
  days_worked INTEGER DEFAULT 0,
  daily_value NUMERIC(8,2) DEFAULT 0,
  transport_value NUMERIC(8,2) DEFAULT 0,
  others_value NUMERIC(8,2) DEFAULT 0,
  total_value NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_payment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.field_payment_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.field_payment_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
