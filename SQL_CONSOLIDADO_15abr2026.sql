-- =============================================================================
-- SQL_CONSOLIDADO_15abr2026.sql
-- Scripts consolidados para execução no Lovable SQL Editor ou Supabase Dashboard
-- AG Central Hub — 15/04/2026
-- =============================================================================
--
-- COMO USAR:
--   Copie e cole BLOCO A BLOCO no SQL Editor do Lovable ou Supabase Dashboard.
--   NÃO execute tudo de uma vez. Execute um bloco, verifique, depois o próximo.
--
-- ORDEM:
--   BLOCO 0: Diagnóstico (só SELECTs — seguro)
--   BLOCO 1: Limpeza de campos legado em projects e proposals
--   BLOCO 2: DROP tabelas mortas (attendance, schedule_confirmations, email_unsubscribe_tokens)
--   BLOCO 3: Popular billing_type nos 77 projetos
--   BLOCO 4: Criar tabelas faltantes (project_status_history, employee_vacations)
--   BLOCO 5: Verificação final
-- =============================================================================


-- #############################################################################
-- BLOCO 0: DIAGNÓSTICO — Execute primeiro para ver o estado atual
-- (Apenas SELECTs — 100% seguro, não altera nada)
-- #############################################################################

-- 0.1 Verificar quais colunas legado AINDA existem em projects
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN (
    'client', 'client_cnpj', 'client_name', 'responsible',
    'cnpj', 'empresa_emissora', 'modalidade_faturamento',
    'obra_id', 'has_multiple_services', 'parent_project_id'
  )
ORDER BY column_name;

-- 0.2 Verificar colunas legado em proposals
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proposals'
  AND column_name IN ('client_name', 'responsible', 'opportunity_id')
ORDER BY column_name;

-- 0.3 Tabelas que devem ser eliminadas — verificar se existem e quantos registros
SELECT 'attendance' AS tabela, count(*) AS registros FROM attendance
UNION ALL
SELECT 'schedule_confirmations', count(*) FROM schedule_confirmations
UNION ALL
SELECT 'email_unsubscribe_tokens', count(*) FROM email_unsubscribe_tokens;

-- 0.4 Projetos sem client_id (perderiam referência se dropar campo 'client')
SELECT id, name, client, client_id
FROM projects
WHERE client IS NOT NULL AND client_id IS NULL;

-- 0.5 Projetos sem cnpj_tomador (perderiam dado se dropar campo 'cnpj')
SELECT id, name, cnpj, cnpj_tomador
FROM projects
WHERE cnpj IS NOT NULL AND cnpj_tomador IS NULL;

-- 0.6 Resumo de campos legado preenchidos em projects
SELECT
  count(*) AS total_projects,
  count(*) FILTER (WHERE client IS NOT NULL) AS client_text,
  count(*) FILTER (WHERE client_name IS NOT NULL) AS client_name_text,
  count(*) FILTER (WHERE client_cnpj IS NOT NULL) AS client_cnpj_text,
  count(*) FILTER (WHERE responsible IS NOT NULL) AS responsible_text,
  count(*) FILTER (WHERE cnpj IS NOT NULL) AS cnpj_text,
  count(*) FILTER (WHERE empresa_emissora IS NOT NULL) AS empresa_emissora,
  count(*) FILTER (WHERE modalidade_faturamento IS NOT NULL) AS modalidade_fat,
  count(*) FILTER (WHERE obra_id IS NOT NULL) AS obra_id,
  count(*) FILTER (WHERE has_multiple_services IS NOT NULL) AS has_multi_svc
FROM projects;

-- 0.7 Verificar billing_type atual dos projetos
SELECT billing_type, count(*) AS qtd
FROM projects
GROUP BY billing_type
ORDER BY qtd DESC;

-- 0.8 Contagem geral de registros
SELECT 'projects' AS tabela, count(*) FROM projects
UNION ALL SELECT 'project_services', count(*) FROM project_services
UNION ALL SELECT 'employees', count(*) FROM employees
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'proposals', count(*) FROM proposals
UNION ALL SELECT 'measurements', count(*) FROM measurements
UNION ALL SELECT 'daily_schedules', count(*) FROM daily_schedules
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'alerts', count(*) FROM alerts
ORDER BY 1;


-- #############################################################################
-- BLOCO 1: LIMPEZA DE CAMPOS LEGADO
-- Remove colunas de texto que duplicam FKs existentes
-- ATENÇÃO: Execute o BLOCO 0 primeiro. Se query 0.4 ou 0.5 retornar linhas,
-- PARE e corrija os dados antes de continuar.
-- #############################################################################

-- 1.1 Migrar dados antes de dropar (segurança extra)
-- Copiar 'cnpj' para 'cnpj_tomador' onde tomador está vazio
UPDATE projects
SET cnpj_tomador = cnpj
WHERE cnpj IS NOT NULL
  AND (cnpj_tomador IS NULL OR cnpj_tomador = '');

-- Copiar 'empresa_emissora' para 'empresa_faturadora' onde vazio
UPDATE projects
SET empresa_faturadora = empresa_emissora
WHERE empresa_emissora IS NOT NULL
  AND (empresa_faturadora IS NULL OR empresa_faturadora = '');

-- 1.2 DROP colunas legado de PROJECTS
ALTER TABLE projects DROP COLUMN IF EXISTS client;
ALTER TABLE projects DROP COLUMN IF EXISTS client_name;
ALTER TABLE projects DROP COLUMN IF EXISTS client_cnpj;
ALTER TABLE projects DROP COLUMN IF EXISTS responsible;
ALTER TABLE projects DROP COLUMN IF EXISTS cnpj;
ALTER TABLE projects DROP COLUMN IF EXISTS empresa_emissora;
ALTER TABLE projects DROP COLUMN IF EXISTS modalidade_faturamento;
ALTER TABLE projects DROP COLUMN IF EXISTS obra_id;
ALTER TABLE projects DROP COLUMN IF EXISTS has_multiple_services;
ALTER TABLE projects DROP COLUMN IF EXISTS parent_project_id;

-- 1.3 DROP colunas legado de PROPOSALS
ALTER TABLE proposals DROP COLUMN IF EXISTS client_name;
ALTER TABLE proposals DROP COLUMN IF EXISTS responsible;
ALTER TABLE proposals DROP COLUMN IF EXISTS opportunity_id;

-- 1.4 Verificação: estas colunas NÃO devem aparecer
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'projects' AND column_name IN (
      'client', 'client_name', 'client_cnpj', 'responsible', 'cnpj',
      'empresa_emissora', 'modalidade_faturamento', 'obra_id',
      'has_multiple_services', 'parent_project_id'
    ))
    OR
    (table_name = 'proposals' AND column_name IN (
      'client_name', 'responsible', 'opportunity_id'
    ))
  )
ORDER BY table_name, column_name;
-- Resultado esperado: 0 linhas


-- #############################################################################
-- BLOCO 2: DROP TABELAS MORTAS
-- Tabelas que foram substituídas por funcionalidades em outras tabelas
-- #############################################################################

-- 2.1 attendance → substituída por daily_schedule_entries
DROP TABLE IF EXISTS attendance CASCADE;

-- 2.2 schedule_confirmations → substituída por daily_schedules.is_closed
DROP TABLE IF EXISTS schedule_confirmations CASCADE;

-- 2.3 email_unsubscribe_tokens → absorvida por suppressed_emails
DROP TABLE IF EXISTS email_unsubscribe_tokens CASCADE;

-- 2.4 Verificação: tabelas NÃO devem existir
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('attendance', 'schedule_confirmations', 'email_unsubscribe_tokens');
-- Resultado esperado: 0 linhas


-- #############################################################################
-- BLOCO 3: POPULAR billing_type NOS PROJETOS
-- Baseado na tabela definitiva do CLAUDE.md (02/04/2026)
-- #############################################################################

-- 3.1 Primeiro verificar clientes e seus códigos
SELECT c.codigo, c.name, count(p.id) AS projetos
FROM clients c
LEFT JOIN projects p ON p.client_id = c.id
GROUP BY c.codigo, c.name
ORDER BY c.codigo;

-- 3.2 Setar billing_type = 'medicao' para clientes de medição mensal
-- BRK Obras, HBR Tabaiares, Engeko, Pernambuco Construtora, JME, Flamboyant, Encar, Colgravata, Colarcoverde
UPDATE projects p
SET billing_type = 'medicao'
FROM clients c
WHERE p.client_id = c.id
  AND (
    -- BRK Obras (projetos com "obra" no nome)
    (c.codigo = 'BRK' AND LOWER(p.name) LIKE '%obra%')
    -- Engeko
    OR c.codigo = 'EGK'
    -- JME
    OR c.codigo = 'JME'
    -- Flamboyant
    OR c.codigo = 'FLMB'
    -- Encar
    OR c.codigo = 'ENCAR'
    -- Pernambuco Construtora / Porto de Pedra
    OR c.codigo = 'PCPE'
  );

-- 3.3 HBR — Tabaiares é medição, demais são entrega_nf
UPDATE projects p
SET billing_type = 'medicao'
FROM clients c
WHERE p.client_id = c.id
  AND c.codigo = 'HBR'
  AND LOWER(p.name) LIKE '%tabaiares%';

-- 3.4 Colorado SPEs de medição mensal (Colgravata, Colarcoverde)
UPDATE projects p
SET billing_type = 'medicao'
FROM clients c
WHERE p.client_id = c.id
  AND c.codigo = 'COL'
  AND (LOWER(p.name) LIKE '%colgravata%' OR LOWER(p.name) LIKE '%colarcoverde%');

-- 3.5 Todos os demais já devem estar como 'entrega_nf' (default)
-- Verificação: distribuição de billing_type
SELECT
  p.billing_type,
  count(*) AS qtd,
  string_agg(DISTINCT c.codigo, ', ' ORDER BY c.codigo) AS clientes
FROM projects p
LEFT JOIN clients c ON c.id = p.client_id
GROUP BY p.billing_type
ORDER BY qtd DESC;


-- #############################################################################
-- BLOCO 4: CRIAR TABELAS FALTANTES
-- Tabelas previstas na arquitetura que ainda não existem
-- #############################################################################

-- 4.1 project_status_history — log de mudanças de status
CREATE TABLE IF NOT EXISTS project_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  old_execution_status text,
  new_execution_status text,
  changed_by uuid REFERENCES profiles(id),
  change_reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índice para queries por projeto
CREATE INDEX IF NOT EXISTS idx_project_status_history_project_id
  ON project_status_history(project_id);

-- RLS
ALTER TABLE project_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project_status_history"
  ON project_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project_status_history"
  ON project_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4.2 employee_vacations — se ainda não existe
-- (pode já ter sido criada por migration do Lovable)
CREATE TABLE IF NOT EXISTS employee_vacations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate numeric,
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_vacation_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_employee_id
  ON employee_vacations(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_dates
  ON employee_vacations(start_date, end_date);

ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage employee_vacations"
  ON employee_vacations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4.3 Adicionar removal_reason a daily_schedule_entries (se não existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'daily_schedule_entries'
      AND column_name = 'removal_reason'
  ) THEN
    ALTER TABLE daily_schedule_entries ADD COLUMN removal_reason text;
    ALTER TABLE daily_schedule_entries ADD COLUMN removed_at timestamptz;
  END IF;
END $$;

-- 4.4 Adicionar campos de prazo a projects (se não existem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'scope_description'
  ) THEN
    ALTER TABLE projects ADD COLUMN scope_description text;
  END IF;
END $$;


-- #############################################################################
-- BLOCO 5: VERIFICAÇÃO FINAL
-- Execute para confirmar que tudo está correto
-- #############################################################################

-- 5.1 Contagem de tabelas
SELECT count(*) AS total_tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- 5.2 Listar todas as tabelas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 5.3 Verificar que tabelas mortas sumiram
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('attendance', 'schedule_confirmations', 'email_unsubscribe_tokens');
-- Resultado esperado: 0 linhas

-- 5.4 Verificar que tabelas novas existem
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('project_status_history', 'employee_vacations');
-- Resultado esperado: 2 linhas

-- 5.5 Verificar billing_type populado
SELECT billing_type, count(*) AS qtd
FROM projects
GROUP BY billing_type;

-- 5.6 Resumo de registros (snapshot 15/04/2026)
SELECT 'projects' AS tabela, count(*) FROM projects
UNION ALL SELECT 'project_services', count(*) FROM project_services
UNION ALL SELECT 'project_status_history', count(*) FROM project_status_history
UNION ALL SELECT 'employees', count(*) FROM employees
UNION ALL SELECT 'employee_vacations', count(*) FROM employee_vacations
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'proposals', count(*) FROM proposals
UNION ALL SELECT 'measurements', count(*) FROM measurements
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'alerts', count(*) FROM alerts
UNION ALL SELECT 'daily_schedules', count(*) FROM daily_schedules
ORDER BY 1;
