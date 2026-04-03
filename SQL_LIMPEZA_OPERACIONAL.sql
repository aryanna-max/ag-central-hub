-- ============================================================
-- SQL LIMPEZA OPERACIONAL — AG Central Hub
-- Data: 03/04/2026
-- Objetivo: Remover dados operacionais (escalas, veiculos, teams)
--           mantendo intactos: leads, projetos, clientes, propostas, employees
-- 
-- ORDEM IMPORTA: respeitar sequencia por causa das FKs (sem CASCADE)
-- Rodar bloco por bloco no SQL Editor do Lovable
-- ============================================================

-- ==============================
-- BLOCO 1: Filhos de escalas
-- ==============================

-- 1a. Entradas de escala diaria
DELETE FROM daily_schedule_entries;

-- 1b. Assignments de equipe em escala diaria
DELETE FROM daily_team_assignments;

-- 1c. Confirmacoes de escala
DELETE FROM schedule_confirmations;

-- ==============================
-- BLOCO 2: Escalas
-- ==============================

-- 2a. Escalas diarias (5 registros, 3 legado)
DELETE FROM daily_schedules;

-- 2b. Escalas mensais (0 registros esperado)
DELETE FROM monthly_schedules;

-- ==============================
-- BLOCO 3: Teams e membros
-- ==============================

-- 3a. Membros das equipes (filho)
DELETE FROM team_members;

-- 3b. Equipes — limpar FK de projetos/veiculos primeiro
UPDATE teams SET default_vehicle_id = NULL, default_project_id = NULL;
DELETE FROM teams;

-- ==============================
-- BLOCO 4: Veiculos
-- ==============================

-- 4a. Historico de pagamentos de veiculos
DELETE FROM vehicle_payment_history;

-- 4b. Veiculos (18 registros)
DELETE FROM vehicles;

-- ==============================
-- BLOCO 5: Dados financeiros vazios (por seguranca)
-- ==============================

-- 5a. Itens de despesa de campo
DELETE FROM field_expense_items;
DELETE FROM field_expense_discounts;

-- 5b. Folhas de despesa de campo
DELETE FROM field_expense_sheets;

-- 5c. Medicoes
DELETE FROM measurements;

-- 5d. Itens de NF e NFs
DELETE FROM invoice_items;
DELETE FROM invoices;

-- ==============================
-- BLOCO 6: Dados que NAO DEVEM ser deletados (verificacao)
-- ==============================

-- Rodar estes SELECTs para confirmar que os dados importantes sobreviveram:
SELECT 'leads' as tabela, COUNT(*) as registros FROM leads
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'project_services', COUNT(*) FROM project_services
UNION ALL SELECT 'proposals', COUNT(*) FROM proposals
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'lead_interactions', COUNT(*) FROM lead_interactions;

-- ==============================
-- VERIFICACAO: Tabelas limpas devem retornar 0
-- ==============================
SELECT 'daily_schedules' as tabela, COUNT(*) as registros FROM daily_schedules
UNION ALL SELECT 'daily_schedule_entries', COUNT(*) FROM daily_schedule_entries
UNION ALL SELECT 'daily_team_assignments', COUNT(*) FROM daily_team_assignments
UNION ALL SELECT 'monthly_schedules', COUNT(*) FROM monthly_schedules
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'vehicle_payment_history', COUNT(*) FROM vehicle_payment_history
UNION ALL SELECT 'field_expense_sheets', COUNT(*) FROM field_expense_sheets
UNION ALL SELECT 'measurements', COUNT(*) FROM measurements
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices;
