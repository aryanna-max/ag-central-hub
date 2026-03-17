ALTER TABLE public.monthly_schedules 
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;

-- Backfill existing rows: set start_date to first day of month, end_date to last day
UPDATE public.monthly_schedules 
SET start_date = make_date(year, month, 1),
    end_date = (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date;

-- Make them NOT NULL after backfill
ALTER TABLE public.monthly_schedules 
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;