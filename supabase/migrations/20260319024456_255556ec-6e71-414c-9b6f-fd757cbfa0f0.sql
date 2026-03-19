
-- Rename enum value 'proposta' to 'proposta_enviada'
ALTER TYPE public.opportunity_stage RENAME VALUE 'proposta' TO 'proposta_enviada';

-- Add client_id column referencing clients table
ALTER TABLE public.opportunities ADD COLUMN client_id UUID REFERENCES public.clients(id);
