
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS responsible_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS home_address text;
