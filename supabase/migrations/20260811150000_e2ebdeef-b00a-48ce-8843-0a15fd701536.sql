-- =====================================================================
-- ADR-045 §0 (pré-requisito do agente RH) — parte 1/2
-- Cria o papel 'rh' no enum app_role.
-- Aditivo, idempotente. Sem DROP/DELETE/RENAME.
--
-- ATENÇÃO: 'alter type ... add value' não pode ser usado na MESMA
-- transação em que o novo valor é executado. Por isso esta adição fica
-- em arquivo próprio, aplicado ANTES da migration que altera
-- fn_resolve_alert (20260811150100_...).
-- =====================================================================

alter type public.app_role add value if not exists 'rh';
