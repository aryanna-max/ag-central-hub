-- ============================================================
-- SQL EXPORT — Veículos e Teams antes da limpeza
-- Data: 03/04/2026
-- Instrução: Rodar cada SELECT e salvar resultado (CSV/copiar)
-- ============================================================

-- 1. VEICULOS (18 registros)
SELECT v.id, v.plate, v.model, v.brand, v.year, v.color,
       v.status, v.is_rented, v.owner_name, v.home_address,
       v.km_current, v.daily_rate,
       v.responsible_employee_id,
       e.name as responsible_employee_name,
       v.notes, v.created_at
FROM vehicles v
LEFT JOIN employees e ON v.responsible_employee_id = e.id
ORDER BY v.plate;

-- 2. TEAMS / GRUPOS RAPIDOS (18 registros)
SELECT t.id, t.name, t.is_active,
       t.leader_id,
       el.name as leader_name,
       t.default_project_id,
       p.name as default_project_name,
       p.codigo as default_project_codigo,
       t.default_vehicle_id,
       v.plate as default_vehicle_plate,
       v.model as default_vehicle_model,
       t.created_at
FROM teams t
LEFT JOIN employees el ON t.leader_id = el.id
LEFT JOIN projects p ON t.default_project_id = p.id
LEFT JOIN vehicles v ON t.default_vehicle_id = v.id
ORDER BY t.name;

-- 3. TEAM MEMBERS (quem está em cada grupo)
SELECT tm.id, tm.team_id,
       t.name as team_name,
       tm.employee_id,
       e.name as employee_name,
       e.role as employee_role,
       tm.role as member_role,
       tm.created_at
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN employees e ON tm.employee_id = e.id
ORDER BY t.name, e.name;

-- 4. VEHICLE PAYMENT HISTORY
SELECT vph.*,
       v.plate as vehicle_plate,
       e.name as employee_name
FROM vehicle_payment_history vph
LEFT JOIN vehicles v ON vph.vehicle_id = v.id
LEFT JOIN employees e ON vph.employee_id = e.id
ORDER BY vph.created_at;
