-- Decisão #19 — Leads redesenho (28/04/2026)
-- Tabela de histórico de transições de status do lead.
-- Trigger registra automaticamente cada UPDATE OF status na tabela leads.
-- P14: nasce vazia, NUNCA semeada. Trigger popula nas próximas transições.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  changed_by_id uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead
  ON public.lead_status_history(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_created
  ON public.lead_status_history(created_at DESC);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_status_history_all" ON public.lead_status_history;
CREATE POLICY "lead_status_history_all"
  ON public.lead_status_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_log_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_status_change ON public.leads;
CREATE TRIGGER trg_log_lead_status_change
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_lead_status_change();

COMMIT;
