-- Add new status values to field_payment_status enum
ALTER TYPE public.field_payment_status ADD VALUE IF NOT EXISTS 'submetido';
ALTER TYPE public.field_payment_status ADD VALUE IF NOT EXISTS 'devolvido';

-- Add new columns to field_payment_items for expense tracking
ALTER TABLE public.field_payment_items
  ADD COLUMN IF NOT EXISTS expense_type text,
  ADD COLUMN IF NOT EXISTS nature text DEFAULT 'reembolso',
  ADD COLUMN IF NOT EXISTS description text;

-- Update validation trigger to allow 'estornado' status on items
CREATE OR REPLACE FUNCTION public.validate_payment_item_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_status NOT IN ('pendente','pago','ajuste','estornado') THEN
    RAISE EXCEPTION 'Invalid payment_status: %', NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$function$;