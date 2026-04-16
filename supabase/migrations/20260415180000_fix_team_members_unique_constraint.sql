-- ============================================================
-- FIX: Remove UNIQUE constraint from team_members
-- Teams are "Grupos Rápidos" (Decision #3) — temporary presets.
-- An employee CAN be in multiple teams.
-- Date: 15/04/2026
-- ============================================================

-- Step 1: Remove the UNIQUE constraint
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_team_id_employee_id_key;

-- Fallback: find and drop any remaining unique constraint
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.team_members'::regclass
    AND contype = 'u';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.team_members DROP CONSTRAINT %I', c);
    RAISE NOTICE 'Dropped constraint: %', c;
  END IF;
END $$;

-- Step 2: Clean orphan references in teams
UPDATE public.teams SET leader_id = NULL
WHERE leader_id IS NOT NULL
  AND leader_id NOT IN (SELECT id FROM public.employees);

UPDATE public.teams SET default_vehicle_id = NULL
WHERE default_vehicle_id IS NOT NULL
  AND default_vehicle_id NOT IN (SELECT id FROM public.vehicles);

UPDATE public.teams SET default_project_id = NULL
WHERE default_project_id IS NOT NULL
  AND default_project_id NOT IN (SELECT id FROM public.projects);

-- Step 3: Clean orphan team_members
DELETE FROM public.team_members
WHERE team_id NOT IN (SELECT id FROM public.teams);

DELETE FROM public.team_members
WHERE employee_id NOT IN (SELECT id FROM public.employees);
