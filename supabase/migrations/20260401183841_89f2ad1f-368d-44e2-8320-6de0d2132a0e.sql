
-- Create lead_interactions table
CREATE TABLE public.lead_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL DEFAULT 'nota',
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.lead_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.lead_interactions FOR ALL TO anon USING (true) WITH CHECK (true);
