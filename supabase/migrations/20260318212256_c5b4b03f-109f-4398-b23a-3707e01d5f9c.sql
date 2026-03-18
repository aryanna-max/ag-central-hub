
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'rede_social' BEFORE 'outros';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS servico text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS valor numeric;
