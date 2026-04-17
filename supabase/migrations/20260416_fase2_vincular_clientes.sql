-- ============================================================
-- FASE 2 — Vincular tarefas mensais de compliance aos clientes
-- Aplica APÓS 20260416_fase2_compliance.sql
-- Data: 16/04/2026
-- ============================================================

UPDATE public.monthly_compliance_tasks
  SET client_id = (SELECT id FROM public.clients WHERE name ILIKE '%CBC%' LIMIT 1)
  WHERE title ILIKE '%CBC%'
    AND client_id IS NULL;

UPDATE public.monthly_compliance_tasks
  SET client_id = (SELECT id FROM public.clients WHERE name ILIKE '%BRK%' LIMIT 1)
  WHERE title ILIKE '%BRK%'
    AND client_id IS NULL;

UPDATE public.monthly_compliance_tasks
  SET client_id = (SELECT id FROM public.clients WHERE name ILIKE '%Memorial%' LIMIT 1)
  WHERE title ILIKE '%Memorial%'
    AND client_id IS NULL;
