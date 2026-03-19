
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'pausado';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;
