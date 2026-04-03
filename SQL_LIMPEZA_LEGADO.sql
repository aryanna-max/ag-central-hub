-- ============================================================
-- SQL LIMPEZA LEGADO — AG Central Hub
-- Data: 03/04/2026
-- Objetivo: Deletar APENAS os 3 registros legado de daily_schedules
--           e seus filhos (entries + assignments)
-- ============================================================

-- PASSO 1: Ver o que sera deletado
SELECT id, schedule_date, is_legacy, is_closed
FROM daily_schedules
WHERE is_legacy = true;

-- PASSO 2: Deletar filhos (ordem importa por FK)
DELETE FROM daily_schedule_entries
WHERE daily_schedule_id IN (
  SELECT id FROM daily_schedules WHERE is_legacy = true
);

DELETE FROM daily_team_assignments
WHERE daily_schedule_id IN (
  SELECT id FROM daily_schedules WHERE is_legacy = true
);

-- PASSO 3: Deletar as escalas legado
DELETE FROM daily_schedules WHERE is_legacy = true;

-- PASSO 4: Verificar
SELECT 'daily_schedules restantes' as check, COUNT(*) as total FROM daily_schedules
UNION ALL
SELECT 'legado restante', COUNT(*) FROM daily_schedules WHERE is_legacy = true;
