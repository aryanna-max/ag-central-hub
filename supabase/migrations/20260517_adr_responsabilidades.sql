-- ============================================================
-- Migration: ADR Responsabilidades (Decisão #21 + #12)
-- Data: 17/05/2026
-- Contexto: 3 papéis em projetos + tabela N:N participações
-- Pré-req: nenhum — migration autossuficiente
-- Histórico: PR #41 foi superseded; estes DELETEs ficam aqui
-- Auditoria: Cowork verificou estado real em 17/05 via SQL Editor
--   (4 queries em DIAGNOSTICO_17MAIO2026.md, seção Camada 4)
-- ============================================================

BEGIN;

-- 1) Tabela N:N project_participations
-- Histórico de quem participou de cada projeto.
-- Derivada de daily_schedule_entries (fonte única).
-- Não editar manualmente — populada via trigger ou UI escala.

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

CREATE INDEX IF NOT EXISTS idx_pp_project  ON public.project_participations(project_id);
CREATE INDEX IF NOT EXISTS idx_pp_employee ON public.project_participations(employee_id);
CREATE INDEX IF NOT EXISTS idx_pp_active   ON public.project_participations(project_id, employee_id) WHERE end_date IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_project_participations ON public.project_participations;
CREATE TRIGGER set_updated_at_project_participations
  BEFORE UPDATE ON public.project_participations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_participations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_all" ON public.project_participations;
CREATE POLICY "pp_all" ON public.project_participations FOR ALL USING (true) WITH CHECK (true);

-- 2) Default técnico = Aryanna onde NULL
-- FIX 17/05: email real da Aryanna é aryanna@agtopografia.com.br
-- (verificado em auth.users via SQL Editor)
UPDATE public.projects
SET responsible_tecnico_id = (
  SELECT id FROM public.profiles WHERE email = 'aryanna@agtopografia.com.br' LIMIT 1
)
WHERE responsible_tecnico_id IS NULL;

-- 3) Backfill conservador responsible_comercial_id
-- Só faz match se nome do profile (role diretor) aparece no campo responsible (text).
-- Prefere ficar nulo a fazer match errado.
UPDATE public.projects p
SET responsible_comercial_id = pr.id
FROM public.profiles pr
JOIN public.user_roles ur ON ur.user_id = pr.id
WHERE p.responsible_comercial_id IS NULL
  AND ur.role IN ('diretor', 'master')
  AND p.responsible IS NOT NULL
  AND lower(p.responsible) LIKE '%' || lower(split_part(coalesce(pr.full_name, ''), ' ', 1)) || '%';

-- 4) Deprecar coluna legacy responsible
COMMENT ON COLUMN public.projects.responsible IS
  'DEPRECATED 2026-05-17. Use responsible_comercial_id / responsible_tecnico_id / responsible_campo_id. Drop após auditoria completa.';

-- 5) [REMOVIDO 17/05] user_role do Ciro
-- Auditoria SQL confirmou que Ciro já tem:
--   Auth user: barbosa.ciro1@gmail.com
--   Profile: "Ciro Gomes"
--   user_role: 'diretor'
-- O INSERT original mirava 'comercial@agtopografia.com.br' que é o login
-- compartilhado da equipe comercial (role 'comercial'), NÃO o Ciro real.
-- Bloco removido para não criar role 'diretor' duplicado no login compartilhado.

-- 6) Remover sócios de employees (decisão #12 — diretoria ≠ funcionário)
-- CUIDADO: Sérgio Gonzaga Jr CLT (matrícula 000038) NÃO deve ser deletado.
-- IDs verificados em 17/05 via SQL Editor (Q1).

-- 6a) Aryanna sócia — FIX 17/05: email em employees é NULL,
--     usar ID direto (não match por email).
DELETE FROM public.employees
WHERE id = '58fda0a6-4224-426c-80f9-86353670fcfb';

-- 6b) Sérgio sócio (sem Jr)
DELETE FROM public.employees
WHERE id = '7059c089-aa4a-4ca4-b9d3-78021ec2f285';

-- 6c) Ciro sócio
DELETE FROM public.employees
WHERE id = '072e8d05-66d9-4a29-a658-4cb96a8cb08f';

-- Sanity check: confirmar que Sérgio Jr (CLT, matrícula 000038) está intacto
-- Deve retornar 1 linha após a migration:
--   SELECT id, name, matricula FROM employees
--   WHERE id = '89075bc9-e090-4482-b835-5312f3706db0';

-- 7) Limpar job_roles órfãos dos sócios
DELETE FROM public.job_roles
WHERE name IN ('Diretor', 'Diretora Administrativa')
  AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.job_role_id = job_roles.id
  );

COMMIT;
