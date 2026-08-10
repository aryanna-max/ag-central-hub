-- 1) Dedupe de códigos de proposta antes da constraint UNIQUE
UPDATE public.proposals SET code = '2026-P-007' WHERE id = '0fa396e5-50b5-4f7a-be05-46f23fd6a250';
UPDATE public.proposals SET code = '2026-P-011' WHERE id = 'cb4e2471-487b-4bec-ad4f-2fd460bf3560';

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_code_unique UNIQUE (code);

-- 2) Empresa-mãe / grupo econômico
ALTER TABLE public.clients
  ADD COLUMN parent_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_parent_not_self CHECK (parent_client_id IS NULL OR parent_client_id <> id);

CREATE INDEX idx_clients_parent_client_id ON public.clients(parent_client_id);