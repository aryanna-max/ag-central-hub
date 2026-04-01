
-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'presente',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_by_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.attendance FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create schedule_confirmations table
CREATE TABLE public.schedule_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_date DATE NOT NULL UNIQUE,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON public.schedule_confirmations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.schedule_confirmations FOR ALL TO anon USING (true) WITH CHECK (true);
