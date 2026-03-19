
-- Add missing columns to field_payment_items
ALTER TABLE public.field_payment_items
ADD COLUMN IF NOT EXISTS discount_value NUMERIC(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id),
ADD COLUMN IF NOT EXISTS actual_receiver_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS actual_receiver_name TEXT;

-- Replace total_value (regular) with generated column
ALTER TABLE public.field_payment_items DROP COLUMN IF EXISTS total_value;
ALTER TABLE public.field_payment_items
ADD COLUMN total_value NUMERIC(8,2) GENERATED ALWAYS AS (
  daily_value + transport_value + others_value - discount_value
) STORED;
