
CREATE TABLE public.schedule_reopen_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_schedule_id UUID NOT NULL REFERENCES public.daily_schedules(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'reaberta',
  reason TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_reopen_history_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action NOT IN ('reaberta','fechada') THEN
    RAISE EXCEPTION 'Invalid action: %', NEW.action;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_reopen_history_action
BEFORE INSERT OR UPDATE ON public.schedule_reopen_history
FOR EACH ROW EXECUTE FUNCTION public.validate_reopen_history_action();

ALTER TABLE public.schedule_reopen_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access" ON public.schedule_reopen_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.schedule_reopen_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
