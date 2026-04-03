-- ============================================================
-- SQL LIMPEZA — AG Central Hub
-- Data: 03/04/2026
-- Objetivo: Deletar escalas legado + veículos + teams
-- PRE-REQUISITO: Rodar SQL_EXPORT_VEICULOS_TEAMS.sql e salvar
-- ============================================================

-- ==============================
-- BLOCO 1: Escalas legado (3 registros + filhos)
-- ==============================

DELETE FROM daily_schedule_entries
WHERE daily_schedule_id IN (
  SELECT id FROM daily_schedules WHERE is_legacy = true
);

DELETE FROM daily_team_assignments
WHERE daily_schedule_id IN (
  SELECT id FROM daily_schedules WHERE is_legacy = true
);

DELETE FROM daily_schedules WHERE is_legacy = true;

-- ==============================
-- BLOCO 2: Teams (18 registros)
-- Ordem: membros → limpar FKs → deletar teams
-- ==============================

DELETE FROM team_members;

UPDATE teams SET default_vehicle_id = NULL, default_project_id = NULL;

DELETE FROM teams;

-- ==============================
-- BLOCO 3: Veículos (18 registros)
-- Ordem: histórico → limpar FKs em entries → deletar veículos
-- ==============================

DELETE FROM vehicle_payment_history;

UPDATE daily_schedule_entries SET vehicle_id = NULL WHERE vehicle_id IS NOT NULL;

UPDATE daily_team_assignments SET vehicle_id = NULL WHERE vehicle_id IS NOT NULL;

UPDATE monthly_schedules SET vehicle_id = NULL WHERE vehicle_id IS NOT NULL;

DELETE FROM vehicles;

-- ==============================
-- VERIFICAÇÃO FINAL
-- ==============================

SELECT 'daily_schedules legado' as tabela, COUNT(*) as total FROM daily_schedules WHERE is_legacy = true
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'vehicle_payment_history', COUNT(*) FROM vehicle_payment_history;

-- Dados preservados:
SELECT 'leads' as tabela, COUNT(*) as total FROM leads
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'proposals', COUNT(*) FROM proposals;
