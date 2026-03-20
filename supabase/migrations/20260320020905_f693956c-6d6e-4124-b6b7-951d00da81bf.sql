
-- ═══ field_expense_sheets: add week_number, week_year, week_label; drop week_ref ═══

-- 1. Add new columns
ALTER TABLE public.field_expense_sheets
  ADD COLUMN week_number INTEGER,
  ADD COLUMN week_year INTEGER;

-- 2. Backfill from existing week_ref (format: '001/26' → week_number=1, week_year=2026)
UPDATE public.field_expense_sheets
SET
  week_number = NULLIF(TRIM(LEADING '0' FROM SPLIT_PART(week_ref, '/', 1)), '')::INTEGER,
  week_year = 2000 + SPLIT_PART(week_ref, '/', 2)::INTEGER
WHERE week_ref IS NOT NULL AND week_ref LIKE '%/%';

-- Fallback: fill from period_start for any remaining
UPDATE public.field_expense_sheets
SET
  week_number = COALESCE(week_number, EXTRACT(WEEK FROM period_start)::INTEGER),
  week_year = COALESCE(week_year, EXTRACT(YEAR FROM period_start)::INTEGER);

-- 3. Make NOT NULL
ALTER TABLE public.field_expense_sheets ALTER COLUMN week_number SET NOT NULL;
ALTER TABLE public.field_expense_sheets ALTER COLUMN week_year SET NOT NULL;

-- 4. Add generated week_label
ALTER TABLE public.field_expense_sheets
  ADD COLUMN week_label TEXT GENERATED ALWAYS AS (
    LPAD(week_number::text, 3, '0') || '/' || (week_year % 100)::text
  ) STORED;

-- 5. Drop old week_ref
ALTER TABLE public.field_expense_sheets DROP COLUMN week_ref;

-- ═══ field_expense_items: add new columns ═══

ALTER TABLE public.field_expense_items
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'funcionario',
  ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cartao',
  ADD COLUMN receiver_document TEXT,
  ADD COLUMN receiver_type TEXT,
  ADD COLUMN total_value NUMERIC GENERATED ALWAYS AS (value) STORED,
  ADD COLUMN fiscal_alert BOOLEAN NOT NULL DEFAULT false;

-- Validation trigger for item_type
CREATE OR REPLACE FUNCTION public.validate_expense_item_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.item_type NOT IN ('funcionario','despesa_extra') THEN
    RAISE EXCEPTION 'Invalid item_type: %', NEW.item_type;
  END IF;
  IF NEW.payment_method NOT IN ('cartao','pix','dinheiro','transferencia','boleto') THEN
    RAISE EXCEPTION 'Invalid payment_method: %', NEW.payment_method;
  END IF;
  IF NEW.receiver_type IS NOT NULL AND NEW.receiver_type NOT IN ('pf','pj') THEN
    RAISE EXCEPTION 'Invalid receiver_type: %', NEW.receiver_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_expense_item_type
  BEFORE INSERT OR UPDATE ON public.field_expense_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_item_type();
