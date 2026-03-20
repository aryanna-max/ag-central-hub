
-- 1. Add new columns to alerts table
ALTER TABLE public.alerts
  ADD COLUMN assigned_to UUID REFERENCES public.employees(id),
  ADD COLUMN action_url TEXT,
  ADD COLUMN action_label TEXT,
  ADD COLUMN action_type TEXT,
  ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN resolved_by UUID REFERENCES public.employees(id);

-- Validation trigger for action_type
CREATE OR REPLACE FUNCTION public.validate_alert_action_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action_type IS NOT NULL AND NEW.action_type NOT IN ('aprovar','visualizar','marcar_pago','emitir_nf','conferir_recibo','confirmar_presenca','outro') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_alert_action_type
  BEFORE INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.validate_alert_action_type();

-- 2. Update payment_method validation to include cartao_despesas
CREATE OR REPLACE FUNCTION public.validate_expense_item_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.item_type NOT IN ('funcionario','despesa_extra') THEN
    RAISE EXCEPTION 'Invalid item_type: %', NEW.item_type;
  END IF;
  IF NEW.payment_method NOT IN ('cartao','pix','dinheiro','transferencia','boleto','cartao_despesas') THEN
    RAISE EXCEPTION 'Invalid payment_method: %', NEW.payment_method;
  END IF;
  IF NEW.receiver_type IS NOT NULL AND NEW.receiver_type NOT IN ('pf','pj') THEN
    RAISE EXCEPTION 'Invalid receiver_type: %', NEW.receiver_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  related_id UUID,
  related_type TEXT,
  google_event_id TEXT,
  calendar_id TEXT,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_calendar" ON public.calendar_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_calendar" ON public.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Trigger: auto-insert calendar event when expense sheet approved
CREATE OR REPLACE FUNCTION public.on_expense_sheet_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status <> 'aprovado') THEN
    INSERT INTO public.calendar_events (module, title, description, event_date, related_id, related_type)
    VALUES (
      'despesas',
      'Pagamento pendente — Folha ' || COALESCE(NEW.week_label, ''),
      'Total: ' || COALESCE(NEW.total_value::text, '0'),
      (NEW.approved_at::date + INTERVAL '3 days')::date,
      NEW.id,
      'field_expense_sheet'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_expense_sheet_approved
  AFTER UPDATE ON public.field_expense_sheets
  FOR EACH ROW EXECUTE FUNCTION public.on_expense_sheet_approved();

-- 5. Trigger: auto-insert calendar event when measurement goes to aguardando_nf
CREATE OR REPLACE FUNCTION public.on_measurement_awaiting_nf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  obra_name TEXT;
BEGIN
  IF NEW.status = 'aguardando_nf' AND (OLD.status IS NULL OR OLD.status <> 'aguardando_nf') THEN
    SELECT o.name INTO obra_name FROM public.obras o WHERE o.id = NEW.obra_id;
    INSERT INTO public.calendar_events (module, title, description, event_date, related_id, related_type)
    VALUES (
      'medicoes',
      'Emitir NF — ' || COALESCE(obra_name, '') || ' ' || NEW.period_start || ' a ' || NEW.period_end,
      'Código BM: ' || NEW.codigo_bm,
      CURRENT_DATE,
      NEW.id,
      'measurement'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_measurement_awaiting_nf
  AFTER UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.on_measurement_awaiting_nf();
