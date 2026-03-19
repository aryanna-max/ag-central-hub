
ALTER TABLE public.field_payment_items
ADD COLUMN IF NOT EXISTS intermediary_reason TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_by TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add payment_status with validation trigger instead of CHECK
ALTER TABLE public.field_payment_items
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente';

CREATE OR REPLACE FUNCTION public.validate_payment_item_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payment_status NOT IN ('pendente','pago','ajuste') THEN
    RAISE EXCEPTION 'Invalid payment_status: %', NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_item_status
BEFORE INSERT OR UPDATE ON public.field_payment_items
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_item_status();
