
-- Enums
CREATE TYPE public.project_status AS ENUM ('planejamento','execucao','entrega','faturamento','concluido');
CREATE TYPE public.alert_priority AS ENUM ('urgente','importante','informacao');
CREATE TYPE public.alert_recipient AS ENUM ('alcione','marcelo','diretoria','todos');

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT,
  client_cnpj TEXT,
  service TEXT,
  contract_value NUMERIC,
  responsible TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status project_status NOT NULL DEFAULT 'planejamento',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.projects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  priority alert_priority NOT NULL DEFAULT 'importante',
  recipient alert_recipient NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_type TEXT,
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access" ON public.alerts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
