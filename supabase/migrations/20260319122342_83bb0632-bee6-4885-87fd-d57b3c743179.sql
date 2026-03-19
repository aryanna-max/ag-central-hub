
-- 1. Tabela de log de atividades da escala
CREATE TABLE public.schedule_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_schedule_id UUID NOT NULL REFERENCES public.daily_schedules(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details TEXT,
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.schedule_activity_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.schedule_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Benefícios por projeto
CREATE TABLE public.project_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  has_restaurant BOOLEAN DEFAULT false,
  almoco_type TEXT DEFAULT 'va_cobre',
  has_ticker BOOLEAN DEFAULT false,
  ticker_value NUMERIC(8,2) DEFAULT 0,
  has_transport BOOLEAN DEFAULT false,
  transport_value NUMERIC(8,2) DEFAULT 0,
  payment_day TEXT DEFAULT 'sexta',
  is_active BOOLEAN DEFAULT true,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers for project_benefits
CREATE OR REPLACE FUNCTION public.validate_project_benefits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.almoco_type NOT IN ('va_cobre','diferenca','integral') THEN
    RAISE EXCEPTION 'Invalid almoco_type: %', NEW.almoco_type;
  END IF;
  IF NEW.payment_day NOT IN ('segunda','terca','quarta','quinta','sexta','retroativo') THEN
    RAISE EXCEPTION 'Invalid payment_day: %', NEW.payment_day;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_project_benefits
BEFORE INSERT OR UPDATE ON public.project_benefits
FOR EACH ROW EXECUTE FUNCTION public.validate_project_benefits();

ALTER TABLE public.project_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.project_benefits FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.project_benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Transporte por funcionário
CREATE TABLE public.employee_transport (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL,
  daily_value NUMERIC(8,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_employee_transport()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.transport_type NOT IN ('vt','dinheiro','misto','nao_tem') THEN
    RAISE EXCEPTION 'Invalid transport_type: %', NEW.transport_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_employee_transport
BEFORE INSERT OR UPDATE ON public.employee_transport
FOR EACH ROW EXECUTE FUNCTION public.validate_employee_transport();

ALTER TABLE public.employee_transport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.employee_transport FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.employee_transport FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Métodos de pagamento por funcionário
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key_value TEXT,
  bank_name TEXT,
  agency TEXT,
  account TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_payment_method_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type NOT IN ('pix_cpf','pix_telefone','pix_email','pix_cnpj','cartao_despesa','transferencia') THEN
    RAISE EXCEPTION 'Invalid payment method type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_method_type
BEFORE INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method_type();

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.payment_methods FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);
