-- =============================================================================
-- SQL_LIMPEZA_CAMPOS_LEGADO.sql
-- Limpeza de campos de texto legado que duplicam relacionamentos FK
-- AG Central Hub - Atualizado em 2026-04-03
-- =============================================================================
--
-- INSTRUCOES:
--   1. Execute TODAS as queries SELECT primeiro (Secao 1 e 2)
--   2. Analise os resultados para confirmar que os dados estao seguros
--   3. So entao descomente os DROP COLUMN na Secao 3 e execute
--
-- IMPORTANTE: Os DROPs estao comentados de proposito (-- ALTER TABLE ...).
-- Descomente manualmente somente apos verificar os resultados dos SELECTs.
-- =============================================================================


-- =============================================================================
-- SECAO 1: DIAGNOSTICO — PROJECTS
-- Verifica se os campos texto legado podem ser removidos com seguranca
-- =============================================================================

-- 1.1 Verificar quais colunas legado AINDA existem no banco
-- (Algumas podem ja ter sido removidas em migracoes anteriores)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN (
    'client',                  -- text redundante com client_id FK
    'client_cnpj',             -- text -> join client_id -> clients.cnpj
    'client_name',             -- text -> join client_id -> clients.name
    'obra_id',                 -- text -> eliminar (sem uso)
    'has_multiple_services',   -- bool -> calculado, nao precisa
    'responsible',             -- text -> redundante com responsible_id FK
    'cnpj',                    -- text -> redundante com cnpj_tomador
    'empresa_emissora',        -- text -> redundante com empresa_faturadora
    'modalidade_faturamento',  -- text -> vive em project_services.billing_mode
    'parent_project_id'        -- FK que NAO deveria existir (decisao: SEM subprojetos)
  )
ORDER BY column_name;


-- 1.2 Projetos com client (texto) preenchido mas SEM client_id
-- Se retornar linhas, esses projetos perderao a referencia ao cliente!
SELECT id, name, client, client_id
FROM projects
WHERE client IS NOT NULL
  AND client_id IS NULL;

-- 1.3 Projetos com client_name (texto) preenchido mas SEM client_id
SELECT id, name, client_name, client_id
FROM projects
WHERE client_name IS NOT NULL
  AND client_id IS NULL;

-- 1.4 Projetos com client_cnpj (texto) preenchido mas SEM cnpj_tomador
SELECT id, name, client_cnpj, cnpj_tomador
FROM projects
WHERE client_cnpj IS NOT NULL
  AND cnpj_tomador IS NULL;

-- 1.5 Projetos com responsible (texto) preenchido mas SEM responsible_id
SELECT id, name, responsible, responsible_id
FROM projects
WHERE responsible IS NOT NULL
  AND responsible_id IS NULL;

-- 1.6 Projetos com cnpj (texto) preenchido mas SEM cnpj_tomador
SELECT id, name, cnpj, cnpj_tomador
FROM projects
WHERE cnpj IS NOT NULL
  AND cnpj_tomador IS NULL;

-- 1.7 Projetos com empresa_emissora preenchido — verificar se empresa_faturadora ja tem o dado
SELECT id, name, empresa_emissora, empresa_faturadora
FROM projects
WHERE empresa_emissora IS NOT NULL
  AND (empresa_faturadora IS NULL OR empresa_faturadora = '');

-- 1.8 Projetos com modalidade_faturamento — verificar se project_services.billing_mode cobre
SELECT p.id, p.name, p.modalidade_faturamento,
       ps.id AS service_id, ps.billing_mode
FROM projects p
LEFT JOIN project_services ps ON ps.project_id = p.id
WHERE p.modalidade_faturamento IS NOT NULL;

-- 1.9 Projetos que usam obra_id — verificar se ha dados relevantes
SELECT id, name, obra_id
FROM projects
WHERE obra_id IS NOT NULL;

-- 1.10 Projetos que usam has_multiple_services — confirmar que e calculavel
SELECT p.id, p.name, p.has_multiple_services,
       (SELECT count(*) FROM project_services ps WHERE ps.project_id = p.id) AS actual_service_count
FROM projects p
WHERE p.has_multiple_services IS NOT NULL;

-- 1.11 Projetos com parent_project_id preenchido
-- Decisao arquitetural: SEM subprojetos. Usar project_services.
SELECT id, name, parent_project_id
FROM projects
WHERE parent_project_id IS NOT NULL;

-- 1.12 Resumo geral: contagem de campos legado preenchidos em projects
SELECT
  count(*) AS total_projects,
  count(*) FILTER (WHERE client IS NOT NULL) AS client_text_filled,
  count(*) FILTER (WHERE client_name IS NOT NULL) AS client_name_filled,
  count(*) FILTER (WHERE client_cnpj IS NOT NULL) AS client_cnpj_filled,
  count(*) FILTER (WHERE responsible IS NOT NULL) AS responsible_text_filled,
  count(*) FILTER (WHERE cnpj IS NOT NULL) AS cnpj_text_filled,
  count(*) FILTER (WHERE empresa_emissora IS NOT NULL) AS empresa_emissora_filled,
  count(*) FILTER (WHERE modalidade_faturamento IS NOT NULL) AS modalidade_faturamento_filled,
  count(*) FILTER (WHERE obra_id IS NOT NULL) AS obra_id_filled,
  count(*) FILTER (WHERE has_multiple_services IS NOT NULL) AS has_multiple_services_filled,
  count(*) FILTER (WHERE parent_project_id IS NOT NULL) AS parent_project_id_filled
FROM projects;


-- =============================================================================
-- SECAO 2: DIAGNOSTICO — PROPOSALS
-- Verifica campos legado na tabela proposals
-- =============================================================================

-- 2.1 Verificar quais colunas legado AINDA existem
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proposals'
  AND column_name IN (
    'client_name',     -- text redundante com client_id FK
    'responsible',     -- text redundante com responsible_id FK
    'opportunity_id'   -- FK de modulo eliminado
  )
ORDER BY column_name;

-- 2.2 Propostas com client_name (texto) mas SEM client_id
SELECT id, title, client_name, client_id
FROM proposals
WHERE client_name IS NOT NULL
  AND client_id IS NULL;

-- 2.3 Propostas com responsible (texto) mas SEM responsible_id
SELECT id, title, responsible, responsible_id
FROM proposals
WHERE responsible IS NOT NULL
  AND responsible_id IS NULL;

-- 2.4 Propostas com opportunity_id preenchido — modulo eliminado
SELECT id, title, opportunity_id
FROM proposals
WHERE opportunity_id IS NOT NULL;

-- 2.5 Resumo geral proposals
SELECT
  count(*) AS total_proposals,
  count(*) FILTER (WHERE client_name IS NOT NULL) AS client_name_filled,
  count(*) FILTER (WHERE responsible IS NOT NULL) AS responsible_text_filled,
  count(*) FILTER (WHERE opportunity_id IS NOT NULL) AS opportunity_id_filled
FROM proposals;


-- =============================================================================
-- SECAO 3: DROP DAS COLUNAS LEGADO
--
-- >>> DESCOMENTE OS COMANDOS ABAIXO SOMENTE APOS VERIFICAR SECOES 1 E 2 <<<
-- >>> Cada DROP usa IF EXISTS para seguranca (coluna pode ja ter sido removida)
-- =============================================================================

-- ---------- PROJECTS: campos texto legado ----------
-- ALTER TABLE projects DROP COLUMN IF EXISTS client;
-- ALTER TABLE projects DROP COLUMN IF EXISTS client_name;
-- ALTER TABLE projects DROP COLUMN IF EXISTS client_cnpj;
-- ALTER TABLE projects DROP COLUMN IF EXISTS responsible;
-- ALTER TABLE projects DROP COLUMN IF EXISTS cnpj;
-- ALTER TABLE projects DROP COLUMN IF EXISTS empresa_emissora;
-- ALTER TABLE projects DROP COLUMN IF EXISTS modalidade_faturamento;
-- ALTER TABLE projects DROP COLUMN IF EXISTS obra_id;
-- ALTER TABLE projects DROP COLUMN IF EXISTS has_multiple_services;

-- parent_project_id: Decisao arquitetural "SEM subprojetos" — usar project_services
-- Verificar query 1.11 antes de remover
-- ALTER TABLE projects DROP COLUMN IF EXISTS parent_project_id;

-- ---------- PROPOSALS: campos texto legado ----------
-- ALTER TABLE proposals DROP COLUMN IF EXISTS client_name;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS responsible;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS opportunity_id;


-- =============================================================================
-- SECAO 4: VERIFICACAO POS-DROP
-- Execute apos rodar a Secao 3 para confirmar que as colunas sumiram
-- =============================================================================

-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (
--     (table_name = 'projects' AND column_name IN (
--       'client', 'client_name', 'client_cnpj', 'responsible', 'cnpj',
--       'empresa_emissora', 'modalidade_faturamento', 'obra_id',
--       'has_multiple_services', 'parent_project_id'
--     ))
--     OR
--     (table_name = 'proposals' AND column_name IN (
--       'client_name', 'responsible', 'opportunity_id'
--     ))
--   )
-- ORDER BY table_name, column_name;
-- Resultado esperado: 0 linhas (todas as colunas foram removidas)
