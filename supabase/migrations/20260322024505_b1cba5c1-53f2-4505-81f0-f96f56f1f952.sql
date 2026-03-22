
-- 1. Migrate obra_id data to project_id in daily_team_assignments
UPDATE daily_team_assignments dta
SET project_id = pr.id
FROM projects pr
WHERE pr.obra_id = dta.obra_id
  AND dta.obra_id IS NOT NULL
  AND dta.project_id IS NULL;

-- 2. Migrate obra_id data to project_id in monthly_schedules
UPDATE monthly_schedules ms
SET project_id = pr.id
FROM projects pr
WHERE pr.obra_id = ms.obra_id
  AND ms.obra_id IS NOT NULL
  AND ms.project_id IS NULL;

-- 3. Migrate obra_id to project_id in daily_schedule_entries (add column first if needed)
ALTER TABLE daily_schedule_entries ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);
UPDATE daily_schedule_entries dse
SET project_id = pr.id
FROM projects pr
WHERE pr.obra_id = dse.obra_id
  AND dse.obra_id IS NOT NULL
  AND dse.project_id IS NULL;

-- 4. Migrate obra_id to project_id in measurements (add column)
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);
UPDATE measurements m
SET project_id = pr.id
FROM projects pr
WHERE pr.obra_id = m.obra_id
  AND m.obra_id IS NOT NULL
  AND m.project_id IS NULL;

-- 5. Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'sem_alocacao',
  project_id uuid REFERENCES projects(id),
  notes text,
  created_by_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_attendance" ON public.attendance FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. Add kanban_filled to daily_schedules
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS kanban_filled boolean NOT NULL DEFAULT false;

-- 7. Fix FK columns - add proper UUID FK columns alongside text ones
-- field_expense_sheets: add approved_by_id FK
ALTER TABLE field_expense_sheets ADD COLUMN IF NOT EXISTS approved_by_id uuid REFERENCES employees(id);

-- daily_schedules: add created_by_id FK
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES profiles(id);

-- 8. Validate attendance status
CREATE OR REPLACE FUNCTION public.validate_attendance_status_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('sem_alocacao','alocado','folga','falta','atestado','reserva_ag','ferias','afastamento','licenca') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_attendance_status_trigger
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_status_v2();

-- 9. Add is_rented and rental period to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_rented boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_start date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_end date;
