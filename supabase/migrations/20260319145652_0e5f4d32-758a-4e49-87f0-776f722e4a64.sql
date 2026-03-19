-- Table 1: Folhas de despesas de campo (cabeçalho semanal)
CREATE TABLE public.field_expense_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ref text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_value numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho',
  return_comment text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table 2: Itens de despesa de campo
CREATE TABLE public.field_expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.field_expense_sheets(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  project_id uuid REFERENCES public.projects(id),
  project_name text,
  expense_type text NOT NULL,
  nature text NOT NULL DEFAULT 'reembolso',
  description text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  receiver_id uuid REFERENCES public.employees(id),
  receiver_name text,
  intermediary_reason text,
  payment_status text NOT NULL DEFAULT 'pendente',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_expense_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_expense_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "anon_full_sheets" ON public.field_expense_sheets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_sheets" ON public.field_expense_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_items" ON public.field_expense_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_items" ON public.field_expense_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_expense_sheet_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN
  IF NEW.status NOT IN ('rascunho','submetido','devolvido','aprovado','pago') THEN
    RAISE EXCEPTION 'Invalid expense sheet status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_expense_sheet_status
  BEFORE INSERT OR UPDATE ON public.field_expense_sheets
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_sheet_status();

CREATE OR REPLACE FUNCTION public.validate_expense_item_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN
  IF NEW.payment_status NOT IN ('pendente','pago','estornado') THEN
    RAISE EXCEPTION 'Invalid expense item status: %', NEW.payment_status;
  END IF;
  IF NEW.nature NOT IN ('adiantamento','reembolso') THEN
    RAISE EXCEPTION 'Invalid expense item nature: %', NEW.nature;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_expense_item_status
  BEFORE INSERT OR UPDATE ON public.field_expense_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_item_status();

-- Auto-update updated_at
CREATE TRIGGER trg_expense_sheet_updated_at
  BEFORE UPDATE ON public.field_expense_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();