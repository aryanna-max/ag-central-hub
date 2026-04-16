CREATE TABLE IF NOT EXISTS public.employee_daily_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  daily_schedule_id UUID REFERENCES public.daily_schedules(id) ON DELETE SET NULL,
  attendance TEXT DEFAULT 'presente',
  cafe_provided BOOLEAN DEFAULT FALSE,
  cafe_value NUMERIC(10,2) DEFAULT 0,
  almoco_dif_provided BOOLEAN DEFAULT FALSE,
  almoco_dif_value NUMERIC(10,2) DEFAULT 0,
  jantar_provided BOOLEAN DEFAULT FALSE,
  jantar_value NUMERIC(10,2) DEFAULT 0,
  vt_provided BOOLEAN DEFAULT FALSE,
  vt_value NUMERIC(10,2) DEFAULT 4.50,
  hospedagem_provided BOOLEAN DEFAULT FALSE,
  hospedagem_value NUMERIC(10,2) DEFAULT 0,
  vehicle_id UUID REFERENCES public.vehicles(id),
  expense_sheet_id UUID REFERENCES public.field_expense_sheets(id),
  status TEXT DEFAULT 'provisorio',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, schedule_date, project_id)
);

CREATE INDEX IF NOT EXISTS idx_edr_employee ON public.employee_daily_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_edr_date ON public.employee_daily_records(schedule_date);
CREATE INDEX IF NOT EXISTS idx_edr_project ON public.employee_daily_records(project_id);
CREATE INDEX IF NOT EXISTS idx_edr_status ON public.employee_daily_records(status);
CREATE INDEX IF NOT EXISTS idx_edr_employee_date ON public.employee_daily_records(employee_id, schedule_date);

ALTER TABLE public.employee_daily_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.employee_daily_records FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE TRIGGER set_updated_at_employee_daily_records
  BEFORE UPDATE ON public.employee_daily_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
