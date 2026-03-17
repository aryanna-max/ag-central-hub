
-- Add role to team_members (topografo or auxiliar)
ALTER TABLE public.team_members ADD COLUMN role text NOT NULL DEFAULT 'auxiliar';

-- Add coordinates to obras for map view
ALTER TABLE public.obras ADD COLUMN latitude numeric;
ALTER TABLE public.obras ADD COLUMN longitude numeric;

-- Create daily_team_assignments: the core of team-centric daily scheduling
CREATE TABLE public.daily_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_schedule_id uuid NOT NULL REFERENCES public.daily_schedules(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  obra_id uuid REFERENCES public.obras(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  location_override text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_team_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read access" ON public.daily_team_assignments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.daily_team_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link daily_schedule_entries to team assignments
ALTER TABLE public.daily_schedule_entries ADD COLUMN daily_team_assignment_id uuid REFERENCES public.daily_team_assignments(id) ON DELETE CASCADE;

-- Enable realtime for daily_team_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_team_assignments;
