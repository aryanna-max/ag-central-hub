
-- Enum for lead source
CREATE TYPE public.lead_source AS ENUM ('whatsapp', 'telefone', 'email', 'site', 'indicacao', 'outros');

-- Enum for lead status
CREATE TYPE public.lead_status AS ENUM ('novo', 'em_contato', 'qualificado', 'convertido', 'descartado');

-- Enum for interaction type
CREATE TYPE public.lead_interaction_type AS ENUM ('nota', 'ligacao', 'email', 'whatsapp', 'reuniao', 'visita');

-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source lead_source NOT NULL DEFAULT 'outros',
  status lead_status NOT NULL DEFAULT 'novo',
  responsible TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lead interactions table
CREATE TABLE public.lead_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  interaction_type lead_interaction_type NOT NULL DEFAULT 'nota',
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
CREATE POLICY "Anon read access" ON public.leads FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for lead_interactions
CREATE POLICY "Anon read access" ON public.lead_interactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.lead_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at on leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
