
-- Revisões/questionamentos da folha (Sérgio)
CREATE TABLE public.payment_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_payment_id UUID NOT NULL REFERENCES public.field_payments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reviewer TEXT,
  comments TEXT,
  flagged_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_payment_review_action()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.action NOT IN ('aprovado','devolvido','aprovado_com_ressalva') THEN
    RAISE EXCEPTION 'Invalid review action: %', NEW.action;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_review_action
BEFORE INSERT OR UPDATE ON public.payment_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_review_action();

ALTER TABLE public.payment_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.payment_reviews FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.payment_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
