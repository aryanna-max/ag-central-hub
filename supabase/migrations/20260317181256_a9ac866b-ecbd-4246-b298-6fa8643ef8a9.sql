
ALTER TABLE public.monthly_schedules 
  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN schedule_type text NOT NULL DEFAULT 'mensal';
