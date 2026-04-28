-- ============================================================================
-- Migration ADR Responsabilidades (Decisão #21) + Diretoria fora de employees (#12)
-- Data: 2026-04-28
-- Documento canonical: Sistema AG/ARQUITETURA/modulos/projetos/responsabilidades.md
--
-- Mudanças:
--   1) Cria tabela N:N project_participations (quem foi a campo / sala técnica / apoio)
--   2) Realinha FKs de projects.responsible_*_id para profiles (era employees)
--   3) Default responsible_tecnico_id = Aryanna (profile) onde estiver NULL
--   4) Backfill conservador de responsible_comercial_id a partir de responsible (text)
--   5) Marca coluna legacy responsible como deprecated (não dropa)
--   6) DELETE de diretoria (Aryanna + Sérgio sócio) de employees — NÃO toca em CLT
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Tabela N:N project_participations
-- ----------------------------------------------------------------------------
-- Quem foi a campo / sala técnica / apoio. Derivada de daily_schedule_entries
-- via UI ou trigger (a definir). NÃO populada via migration (P14).

CREATE TABLE IF NOT EXISTS public.project_participations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  role          text NOT NULL CHECK (role IN ('campo','sala_tecnica','apoio','coordenacao')),
  start_date    date NOT NULL,
  end_date      date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, employee_id, role, start_date)
);

CREATE INDEX IF NOT EXISTS idx_project_participations_project
  ON public.project_participations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participations_employee
  ON public.project_participations(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_participations_active
  ON public.project_participations(project_id, employee_id) WHERE end_date IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_project_participations ON public.project_participations;
CREATE TRIGGER set_updated_at_project_participations
  BEFORE UPDATE ON public.project_participations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_participations_all" ON public.project_participations;
CREATE POLICY "project_participations_all"
  ON public.project_participations FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2) Realinhar FK de responsible_*_id para profiles
-- ----------------------------------------------------------------------------
-- Estado atual (verificado em types.ts): FK aponta para employees.
-- Decisão #12: diretoria não fica em employees; logo, esses campos devem
-- referenciar profiles (onde diretoria vive).

-- 2a) Drop FKs antigas (idempotente — funciona se apontavam para employees ou profiles)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_responsible_campo_id_fkey,
  DROP CONSTRAINT IF EXISTS projects_responsible_comercial_id_fkey,
  DROP CONSTRAINT IF EXISTS projects_responsible_tecnico_id_fkey;

-- 2b) NULL out valores que não existem em profiles (defensivo: dados antigos
--     podem apontar para employee_id que não tem profile correspondente).
UPDATE public.projects
SET responsible_campo_id = NULL
WHERE responsible_campo_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = projects.responsible_campo_id);

UPDATE public.projects
SET responsible_comercial_id = NULL
WHERE responsible_comercial_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = projects.responsible_comercial_id);

UPDATE public.projects
SET responsible_tecnico_id = NULL
WHERE responsible_tecnico_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = projects.responsible_tecnico_id);

-- 2c) Adiciona FKs novas apontando para profiles
ALTER TABLE public.projects
  ADD CONSTRAINT projects_responsible_campo_id_fkey
    FOREIGN KEY (responsible_campo_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT projects_responsible_comercial_id_fkey
    FOREIGN KEY (responsible_comercial_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT projects_responsible_tecnico_id_fkey
    FOREIGN KEY (responsible_tecnico_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3) Default responsible_tecnico_id = Aryanna onde está NULL
-- ----------------------------------------------------------------------------
-- IMPORTANTE: Aryanna em profiles, não em employees (Decisão #12).

UPDATE public.projects p
SET responsible_tecnico_id = (
  SELECT id FROM public.profiles WHERE email = 'aryannagonzaga@gmail.com' LIMIT 1
)
WHERE responsible_tecnico_id IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE email = 'aryannagonzaga@gmail.com');

-- ----------------------------------------------------------------------------
-- 4) Backfill responsible_comercial_id a partir de responsible (text)
-- ----------------------------------------------------------------------------
-- Heurística conservadora: se responsible (text) bate com primeiro nome de
-- profile com role 'diretor' OU 'master', copia o id do profile pro
-- responsible_comercial_id. Casos não confiáveis: deixar NULL.

UPDATE public.projects p
SET responsible_comercial_id = pr.id
FROM public.profiles pr
JOIN public.user_roles ur ON ur.user_id = pr.id
WHERE p.responsible_comercial_id IS NULL
  AND ur.role IN ('diretor','master')
  AND p.responsible IS NOT NULL
  AND pr.full_name IS NOT NULL
  AND lower(coalesce(p.responsible, '')) LIKE '%' || lower(split_part(pr.full_name, ' ', 1)) || '%';

-- ----------------------------------------------------------------------------
-- 5) Marca coluna legacy responsible como deprecated
-- ----------------------------------------------------------------------------
-- NÃO dropar agora — pode haver dado em produção que ainda é referência humana.
-- Drop fica para PR futuro após auditoria de uso em telas.

COMMENT ON COLUMN public.projects.responsible IS
  'DEPRECATED 2026-04-28. Use responsible_comercial_id, responsible_tecnico_id, responsible_campo_id (todos FK para profiles). Drop pendente após auditoria de uso.';

-- ----------------------------------------------------------------------------
-- 6) Diretoria fora de employees (Decisão #12)
-- ----------------------------------------------------------------------------
-- DELETE Aryanna + Sérgio sócio se estiverem em employees.
-- CUIDADO: Sérgio Gonzaga Jr (matrícula 000038) é CLT — NÃO deletar.

-- 6a) Aryanna por email
DELETE FROM public.employees
WHERE email = 'aryannagonzaga@gmail.com';

-- 6b) Sérgio sócio: ILIKE no nome + ausência de matrícula CLT padrão (000XXX).
--     Sérgio Jr CLT tem matrícula '000038'. Sócio não tem matrícula CLT.
DELETE FROM public.employees
WHERE name ILIKE 'sérgio%gonzaga%'
  AND (matricula IS NULL OR matricula = '' OR matricula NOT LIKE '000%');

-- 6c) Ciro: profile criado via UI Admin/Usuários, não via SQL.
--     Aviso para Aryanna executar pós-merge.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email ILIKE 'ciro%') THEN
    RAISE NOTICE 'TODO: Criar profile do Ciro via /admin/usuarios + atribuir role diretor em user_roles';
  END IF;
END $$;

COMMIT;
