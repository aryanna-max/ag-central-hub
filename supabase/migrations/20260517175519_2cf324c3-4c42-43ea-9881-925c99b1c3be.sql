BEGIN;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_responsible_id_fkey;
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_responsible_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_responsible_tecnico_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_responsible_comercial_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_responsible_campo_id_fkey;

-- Repoint leads
UPDATE public.leads SET responsible_id = '2aae30f3-6483-4cb2-b161-3f248d9766b5' WHERE responsible_id = '7059c089-aa4a-4ca4-b9d3-78021ec2f285';
UPDATE public.leads SET responsible_id = '326444ac-308c-48bc-b4d2-e82acfc559c4' WHERE responsible_id = '072e8d05-66d9-4a29-a658-4cb96a8cb08f';
UPDATE public.leads SET responsible_id = NULL WHERE responsible_id = '89075bc9-e090-4482-b835-5312f3706db0';

-- Repoint proposals
UPDATE public.proposals SET responsible_id = '2aae30f3-6483-4cb2-b161-3f248d9766b5' WHERE responsible_id = '7059c089-aa4a-4ca4-b9d3-78021ec2f285';
UPDATE public.proposals SET responsible_id = '326444ac-308c-48bc-b4d2-e82acfc559c4' WHERE responsible_id = '072e8d05-66d9-4a29-a658-4cb96a8cb08f';

-- Repoint project comercial (Ciro)
UPDATE public.projects SET responsible_comercial_id = '326444ac-308c-48bc-b4d2-e82acfc559c4' WHERE responsible_comercial_id = '072e8d05-66d9-4a29-a658-4cb96a8cb08f';

-- Add FKs pointing to profiles
ALTER TABLE public.leads ADD CONSTRAINT leads_responsible_id_fkey
  FOREIGN KEY (responsible_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_responsible_id_fkey
  FOREIGN KEY (responsible_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_tecnico_id_fkey
  FOREIGN KEY (responsible_tecnico_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_comercial_id_fkey
  FOREIGN KEY (responsible_comercial_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_campo_id_fkey
  FOREIGN KEY (responsible_campo_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.project_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('campo','sala_tecnica','apoio','coordenacao')),
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, employee_id, role, start_date)
);
CREATE INDEX IF NOT EXISTS idx_pp_project ON public.project_participations(project_id);
CREATE INDEX IF NOT EXISTS idx_pp_employee ON public.project_participations(employee_id);
CREATE INDEX IF NOT EXISTS idx_pp_active  ON public.project_participations(project_id, employee_id) WHERE end_date IS NULL;

UPDATE public.projects
   SET responsible_tecnico_id = (SELECT id FROM public.profiles WHERE email = 'aryanna@agtopografia.com.br' LIMIT 1)
 WHERE responsible_tecnico_id IS NULL;

DELETE FROM public.employees WHERE id = '58fda0a6-4224-426c-80f9-86353670fcfb';
DELETE FROM public.employees WHERE id = '7059c089-aa4a-4ca4-b9d3-78021ec2f285';
DELETE FROM public.employees WHERE id = '072e8d05-66d9-4a29-a658-4cb96a8cb08f';

DELETE FROM public.job_roles
 WHERE title IN ('Diretor', 'Diretora Administrativa')
   AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.job_role_id = job_roles.id);

COMMIT;