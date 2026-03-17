
-- Enum for employee status
CREATE TYPE public.employee_status AS ENUM ('disponivel', 'ferias', 'licenca', 'afastado', 'desligado');

-- Enum for absence type
CREATE TYPE public.absence_type AS ENUM ('ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'afastamento', 'falta', 'outros');

-- Enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('presente', 'falta', 'justificado', 'atrasado');

-- Enum for vehicle status
CREATE TYPE public.vehicle_status AS ENUM ('disponivel', 'em_uso', 'manutencao', 'indisponivel');

-- Employees table (master data shared with RH)
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'Ajudante',
  phone TEXT,
  email TEXT,
  admission_date DATE,
  status employee_status NOT NULL DEFAULT 'disponivel',
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Team members (composition)
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, employee_id)
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  brand TEXT,
  year INTEGER,
  status vehicle_status NOT NULL DEFAULT 'disponivel',
  daily_rate NUMERIC(10,2) DEFAULT 0,
  km_current INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee absences (vacations, leaves, etc.)
CREATE TABLE public.employee_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type absence_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Projects/Obras reference for schedules
CREATE TABLE public.obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Monthly schedule
CREATE TABLE public.monthly_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, obra_id, month, year)
);

-- Daily schedules (one per day, created by the operations manager)
CREATE TABLE public.daily_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_date DATE NOT NULL UNIQUE,
  created_by TEXT,
  notes TEXT,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Daily schedule entries (each employee assignment for the day)
CREATE TABLE public.daily_schedule_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_schedule_id UUID NOT NULL REFERENCES public.daily_schedules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  team_id UUID REFERENCES public.teams(id),
  obra_id UUID REFERENCES public.obras(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  attendance attendance_status DEFAULT 'presente',
  absence_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(daily_schedule_id, employee_id)
);

-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedule_entries ENABLE ROW LEVEL SECURITY;

-- For now, allow authenticated users full access (will refine with roles later)
CREATE POLICY "Authenticated users full access" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.teams FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.employee_absences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.obras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.monthly_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.daily_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.daily_schedule_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon access for development (remove in production)
CREATE POLICY "Anon read access" ON public.employees FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.teams FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.team_members FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.vehicles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.employee_absences FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.obras FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.monthly_schedules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.daily_schedules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.daily_schedule_entries FOR ALL TO anon USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_employee_absences_dates ON public.employee_absences(employee_id, start_date, end_date);
CREATE INDEX idx_daily_schedule_date ON public.daily_schedules(schedule_date);
CREATE INDEX idx_daily_entries_schedule ON public.daily_schedule_entries(daily_schedule_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_monthly_schedule_period ON public.monthly_schedules(year, month);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to relevant tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
