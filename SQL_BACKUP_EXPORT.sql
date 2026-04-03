-- ============================================================
-- SQL BACKUP/EXPORT — AG Central Hub
-- Data: 03/04/2026
-- Objetivo: Exportar dados criticos antes da limpeza
-- Instrucao: Rodar cada SELECT separadamente no SQL Editor
--            e salvar o resultado (Copy/Download CSV)
-- ============================================================

-- 1. LEADS (15 registros)
SELECT * FROM leads ORDER BY created_at DESC;

-- 2. LEAD INTERACTIONS
SELECT li.* FROM lead_interactions li
JOIN leads l ON li.lead_id = l.id
ORDER BY li.created_at DESC;

-- 3. CLIENTS (51 registros)
SELECT * FROM clients ORDER BY name;

-- 4. PROJECTS (77 registros)
SELECT * FROM projects ORDER BY created_at DESC;

-- 5. PROJECT SERVICES (80 registros)
SELECT * FROM project_services ORDER BY project_id;

-- 6. PROPOSALS
SELECT * FROM proposals ORDER BY created_at DESC;

-- 7. PROPOSAL ITEMS
SELECT * FROM proposal_items ORDER BY proposal_id, sort_order;

-- 8. EMPLOYEES (64 registros)
SELECT * FROM employees ORDER BY name;

-- 9. ALERTS (38 registros)
SELECT * FROM alerts ORDER BY created_at DESC;

-- 10. DIAGNOSTICO: O que sera deletado
-- Escalas diarias (5 total, 3 legado)
SELECT id, schedule_date, is_legacy, is_closed, created_at FROM daily_schedules ORDER BY schedule_date;

-- Entradas de escala
SELECT dse.id, dse.daily_schedule_id, dse.employee_id, ds.schedule_date, ds.is_legacy
FROM daily_schedule_entries dse
JOIN daily_schedules ds ON dse.daily_schedule_id = ds.id
ORDER BY ds.schedule_date;

-- Assignments de escala
SELECT dta.id, dta.daily_schedule_id, dta.team_id, dta.project_id, ds.schedule_date, ds.is_legacy
FROM daily_team_assignments dta
JOIN daily_schedules ds ON dta.daily_schedule_id = ds.id
ORDER BY ds.schedule_date;

-- Monthly schedules
SELECT * FROM monthly_schedules;

-- Teams e membros
SELECT t.id, t.name, t.is_active, t.leader_id, t.default_project_id, t.default_vehicle_id,
       COUNT(tm.id) as member_count
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY t.id ORDER BY t.name;

-- Vehicles
SELECT id, plate, model, brand, status, is_rented, responsible_employee_id FROM vehicles ORDER BY plate;

-- Vehicle payment history
SELECT * FROM vehicle_payment_history;

-- Field expenses (deve estar vazio)
SELECT COUNT(*) as expense_sheets FROM field_expense_sheets;
SELECT COUNT(*) as expense_items FROM field_expense_items;

-- Measurements (deve estar vazio)
SELECT COUNT(*) as measurements FROM measurements;

-- Schedule confirmations
SELECT * FROM schedule_confirmations;
