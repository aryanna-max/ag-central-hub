
-- Table: proposals
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  client_id UUID REFERENCES public.clients(id),
  lead_id UUID REFERENCES public.leads(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  empresa_faturadora TEXT NOT NULL DEFAULT 'ag_topografia',
  service TEXT,
  scope TEXT,
  location TEXT,
  estimated_value NUMERIC DEFAULT 0,
  discount_pct NUMERIC DEFAULT 0,
  final_value NUMERIC DEFAULT 0,
  validity_days INTEGER DEFAULT 30,
  estimated_duration TEXT,
  payment_conditions TEXT,
  technical_notes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  responsible TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: proposal_items (line items)
CREATE TABLE public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'un',
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for proposal status
CREATE OR REPLACE FUNCTION public.validate_proposal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('rascunho','enviada','aprovada','rejeitada','convertida') THEN
    RAISE EXCEPTION 'Invalid proposal status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proposal_status
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.validate_proposal_status();

-- Validation trigger for empresa_faturadora
CREATE OR REPLACE FUNCTION public.validate_proposal_empresa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.empresa_faturadora NOT IN ('ag_topografia','ag_cartografia') THEN
    RAISE EXCEPTION 'Invalid empresa_faturadora: %', NEW.empresa_faturadora;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proposal_empresa
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.validate_proposal_empresa();

-- Updated_at trigger
CREATE TRIGGER trg_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_proposals" ON public.proposals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_proposals" ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_proposal_items" ON public.proposal_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_proposal_items" ON public.proposal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
