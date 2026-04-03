-- =============================================================================
-- SQL_LIMPEZA_CAMPOS_LEGADO.sql
-- AG Central Hub — Limpeza de campos legado (texto duplicando FKs)
-- Data: 2026-04-03
--
-- INSTRUÇÕES:
--   1. Execute APENAS a Seção 1 (diagnóstico) primeiro
--   2. Analise os resultados — se tudo estiver seguro, descomente os DROPs
--   3. Execute a Seção 2 somente após confirmar que os dados estão corretos
--
-- IMPORTANTE: Os DROPs estão comentados de propósito. Descomente manualmente
-- somente após verificar os resultados dos SELECTs.
-- =============================================================================


-- =============================================================================
-- SEÇÃO 1: DIAGNÓSTICO — Verificar estado atual antes de qualquer DROP
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 Verificar quais colunas legado AINDA existem no banco
-- (Algumas podem já ter sido removidas em migrações anteriores)
-- -----------------------------------------------------------------------------
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    -- projects: campos sujos listados no CLAUDE.md
    (table_name = 'projects' AND column_name IN (
        'client',              -- text → redundante com client_id FK
        'client_cnpj',         -- text → join client_id → clients.cnpj
        'client_name',         -- text → join client_id → clients.name
        'obra_id',             -- text → eliminar
        'has_multiple_services', -- bool → calculado, não precisa
        'cnpj',                -- text → redundante com cnpj_tomador
        'empresa_emissora',    -- text → redundante com empresa_faturadora
        'modalidade_faturamento', -- text → vive em project_services.billing_mode
        'responsible',         -- text → redundante com responsible_id FK
        'parent_project_id'    -- FK que NÃO deveria existir (decisão: SEM subprojetos)
    ))
    OR
    -- proposals: campos sujos
    (table_name = 'proposals' AND column_name IN (
        'client_name',         -- text → redundante com client_id FK
        'responsible',         -- text → redundante com responsible_id FK
        'opportunity_id'       -- FK módulo eliminado
    ))
    OR
    -- leads: campos sujos
    (table_name = 'leads' AND column_name IN (
        'responsible',         -- text → redundante com responsible_id FK
        'obra_id'              -- text → eliminar
    ))
    OR
    -- measurements: campos sujos
    (table_name = 'measurements' AND column_name IN (
        'obra_id',                 -- text → project_id já existe
        'responsavel_cobranca'     -- text → responsavel_cobranca_id já existe
    ))
    OR
    -- field_expense_items: campos sujos
    (table_name = 'field_expense_items' AND column_name IN (
        'project_name',        -- text → join project_id → projects
        'receiver_name',       -- text → join receiver_id → employees
        'receiver_document'    -- text → join receiver_id → employees.cpf
    ))
    OR
    -- field_expense_sheets: campos sujos
    (table_name = 'field_expense_sheets' AND column_name IN (
        'approved_by'          -- text → approved_by_id já existe
    ))
    OR
    -- daily_schedules: campos sujos
    (table_name = 'daily_schedules' AND column_name IN (
        'created_by'           -- text → created_by_id já existe
    ))
    OR
    -- daily_team_assignments: campos sujos
    (table_name = 'daily_team_assignments' AND column_name IN (
        'obra_id'              -- text → project_id já existe
    ))
  )
ORDER BY table_name, column_name;


-- -----------------------------------------------------------------------------
-- 1.2 PROJECTS — Verificar se client_id está populado onde client (texto) existe
-- Se houver linhas com client (texto) mas SEM client_id, NÃO é seguro dropar
-- -----------------------------------------------------------------------------
SELECT
    'projects' AS tabela,
    COUNT(*) AS total,
    COUNT(client_id) AS com_client_id,
    COUNT(*) FILTER (WHERE client_id IS NULL) AS sem_client_id
FROM projects;

-- Listar projetos que têm parent_project_id preenchido (antes de remover)
SELECT
    id,
    name,
    codigo,
    parent_project_id
FROM projects
WHERE parent_project_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 1.3 PROPOSALS — Verificar se client_id e responsible_id estão populados
-- -----------------------------------------------------------------------------
SELECT
    'proposals' AS tabela,
    COUNT(*) AS total,
    COUNT(client_id) AS com_client_id,
    COUNT(responsible_id) AS com_responsible_id
FROM proposals;


-- -----------------------------------------------------------------------------
-- 1.4 LEADS — Verificar se responsible_id está populado
-- -----------------------------------------------------------------------------
SELECT
    'leads' AS tabela,
    COUNT(*) AS total,
    COUNT(responsible_id) AS com_responsible_id
FROM leads;


-- -----------------------------------------------------------------------------
-- 1.5 MEASUREMENTS — Verificar se project_id e responsavel_cobranca_id populados
-- -----------------------------------------------------------------------------
SELECT
    'measurements' AS tabela,
    COUNT(*) AS total,
    COUNT(project_id) AS com_project_id,
    COUNT(project_service_id) AS com_service_id,
    COUNT(responsavel_cobranca_id) AS com_responsavel_id
FROM measurements;


-- -----------------------------------------------------------------------------
-- 1.6 FIELD_EXPENSE_ITEMS — Verificar se project_id e receiver_id populados
-- -----------------------------------------------------------------------------
SELECT
    'field_expense_items' AS tabela,
    COUNT(*) AS total,
    COUNT(project_id) AS com_project_id,
    COUNT(receiver_id) AS com_receiver_id
FROM field_expense_items;


-- -----------------------------------------------------------------------------
-- 1.7 FIELD_EXPENSE_SHEETS — Verificar se approved_by_id populado
-- -----------------------------------------------------------------------------
SELECT
    'field_expense_sheets' AS tabela,
    COUNT(*) AS total,
    COUNT(approved_by_id) AS com_approved_by_id
FROM field_expense_sheets;


-- -----------------------------------------------------------------------------
-- 1.8 DAILY_SCHEDULES — Verificar se created_by_id populado
-- -----------------------------------------------------------------------------
SELECT
    'daily_schedules' AS tabela,
    COUNT(*) AS total,
    COUNT(created_by_id) AS com_created_by_id
FROM daily_schedules;


-- -----------------------------------------------------------------------------
-- 1.9 DAILY_TEAM_ASSIGNMENTS — Verificar se project_id populado
-- -----------------------------------------------------------------------------
SELECT
    'daily_team_assignments' AS tabela,
    COUNT(*) AS total,
    COUNT(project_id) AS com_project_id
FROM daily_team_assignments;


-- =============================================================================
-- SEÇÃO 2: DROP DAS COLUNAS LEGADO
--
-- ⚠️  DESCOMENTE OS COMANDOS ABAIXO SOMENTE APÓS VERIFICAR A SEÇÃO 1
-- ⚠️  Cada DROP usa IF EXISTS para segurança (coluna pode já ter sido removida)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 PROJECTS — Remover campos texto redundantes com FKs
-- -----------------------------------------------------------------------------
-- ALTER TABLE projects DROP COLUMN IF EXISTS client;
-- ALTER TABLE projects DROP COLUMN IF EXISTS client_cnpj;
-- ALTER TABLE projects DROP COLUMN IF EXISTS client_name;
-- ALTER TABLE projects DROP COLUMN IF EXISTS obra_id;
-- ALTER TABLE projects DROP COLUMN IF EXISTS has_multiple_services;
-- ALTER TABLE projects DROP COLUMN IF EXISTS cnpj;
-- ALTER TABLE projects DROP COLUMN IF EXISTS empresa_emissora;
-- ALTER TABLE projects DROP COLUMN IF EXISTS modalidade_faturamento;
-- ALTER TABLE projects DROP COLUMN IF EXISTS responsible;

-- parent_project_id: Decisão arquitetural "SEM subprojetos" — usar project_services
-- Verificar na Seção 1.2 se algum projeto usa este campo antes de remover
-- ALTER TABLE projects DROP COLUMN IF EXISTS parent_project_id;

-- -----------------------------------------------------------------------------
-- 2.2 PROPOSALS — Remover campos texto redundantes
-- -----------------------------------------------------------------------------
-- ALTER TABLE proposals DROP COLUMN IF EXISTS client_name;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS responsible;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS opportunity_id;

-- -----------------------------------------------------------------------------
-- 2.3 LEADS — Remover campos texto redundantes
-- -----------------------------------------------------------------------------
-- ALTER TABLE leads DROP COLUMN IF EXISTS responsible;
-- ALTER TABLE leads DROP COLUMN IF EXISTS obra_id;

-- -----------------------------------------------------------------------------
-- 2.4 MEASUREMENTS — Remover campos texto redundantes
-- -----------------------------------------------------------------------------
-- ALTER TABLE measurements DROP COLUMN IF EXISTS obra_id;
-- ALTER TABLE measurements DROP COLUMN IF EXISTS responsavel_cobranca;

-- -----------------------------------------------------------------------------
-- 2.5 FIELD_EXPENSE_ITEMS — Remover campos texto redundantes
-- -----------------------------------------------------------------------------
-- ALTER TABLE field_expense_items DROP COLUMN IF EXISTS project_name;
-- ALTER TABLE field_expense_items DROP COLUMN IF EXISTS receiver_name;
-- ALTER TABLE field_expense_items DROP COLUMN IF EXISTS receiver_document;

-- -----------------------------------------------------------------------------
-- 2.6 FIELD_EXPENSE_SHEETS — Remover campo texto redundante
-- -----------------------------------------------------------------------------
-- ALTER TABLE field_expense_sheets DROP COLUMN IF EXISTS approved_by;

-- -----------------------------------------------------------------------------
-- 2.7 DAILY_SCHEDULES — Remover campo texto redundante
-- -----------------------------------------------------------------------------
-- ALTER TABLE daily_schedules DROP COLUMN IF EXISTS created_by;

-- -----------------------------------------------------------------------------
-- 2.8 DAILY_TEAM_ASSIGNMENTS — Remover campo texto redundante
-- -----------------------------------------------------------------------------
-- ALTER TABLE daily_team_assignments DROP COLUMN IF EXISTS obra_id;


-- =============================================================================
-- SEÇÃO 3: VERIFICAÇÃO PÓS-DROP
-- Execute após descomentar e rodar a Seção 2 para confirmar que as colunas
-- foram removidas com sucesso.
-- =============================================================================

-- SELECT
--     table_name,
--     column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name IN (
--       'client', 'client_cnpj', 'client_name', 'obra_id',
--       'has_multiple_services', 'cnpj', 'empresa_emissora',
--       'modalidade_faturamento', 'responsible', 'parent_project_id',
--       'opportunity_id', 'responsavel_cobranca', 'project_name',
--       'receiver_name', 'receiver_document', 'approved_by', 'created_by'
--   )
--   AND table_name IN (
--       'projects', 'proposals', 'leads', 'measurements',
--       'field_expense_items', 'field_expense_sheets',
--       'daily_schedules', 'daily_team_assignments'
--   )
-- ORDER BY table_name, column_name;
