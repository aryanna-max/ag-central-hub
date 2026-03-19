
-- 1. Add status column to daily_schedules
ALTER TABLE public.daily_schedules
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planejada';

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_daily_schedule_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('planejada','em_andamento','fechada','reaberta') THEN
    RAISE EXCEPTION 'Invalid daily_schedule status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_daily_schedule_status
BEFORE INSERT OR UPDATE ON public.daily_schedules
FOR EACH ROW EXECUTE FUNCTION public.validate_daily_schedule_status();

-- 2. Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  status TEXT NOT NULL DEFAULT 'presente',
  substituted_by UUID REFERENCES public.employees(id),
  substituted_by_name TEXT,
  reasons TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for attendance status
CREATE OR REPLACE FUNCTION public.validate_attendance_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('presente','faltou','substituido','medio_periodo') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance_status
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_status();

-- RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access" ON public.attendance FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
