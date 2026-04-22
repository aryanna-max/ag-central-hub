-- =============================================================================
-- DROP tabelas legadas pré-Marco Zero (31/03/2026)
-- =============================================================================
-- Motivação:
--   Estas 4 tabelas foram criadas em 19/03/2026 e substituídas durante a
--   reforma de Fase 1 (Escala→Benefícios→RDF, 15-16/04). Modelo canônico atual:
--
--     benefit_rules         → substituído por project_benefits (Fase 1)
--     field_payments        → substituído por field_expense_sheets (Fase 1)
--     field_payment_items   → substituído por field_expense_items (Fase 1)
--     payment_reviews       → substituído por field_expense_sheets.approval_*
--
-- Auditoria 21/04 (Code local):
--   - grep -rln "benefit_rules|field_payments|field_payment_items|payment_reviews" src/
--     → ZERO resultados. Nenhum hook, componente ou query depende.
--   - types.ts: essas tabelas ainda aparecem ou foram removidas pelo Lovable —
--     drop físico alinha schema com types esperados.
--
-- Princípio P1 (Mais recente ≠ melhor):
--   Confirmado pela auditoria que as versões novas (Fase 1) cobrem integralmente
--   o escopo das antigas. DROP é seguro — mas irreversível. Se em algum momento
--   precisarmos dos dados, restaurar de backup pré-21/04.
--
-- Ordem: filhas primeiro (ON DELETE CASCADE garantiria, mas explicitar é mais
-- legível e previne erro se CASCADE estiver desativado em algum ambiente).
-- =============================================================================

-- 1. payment_reviews — filha de field_payments
DROP TABLE IF EXISTS public.payment_reviews CASCADE;

-- 2. field_payment_items — filha de field_payments
DROP TABLE IF EXISTS public.field_payment_items CASCADE;

-- 3. field_payments
DROP TABLE IF EXISTS public.field_payments CASCADE;

-- 4. benefit_rules — independente (só refere employees)
DROP TABLE IF EXISTS public.benefit_rules CASCADE;

-- =============================================================================
-- Funções órfãs que operavam essas tabelas (se ainda existirem)
-- =============================================================================

DROP FUNCTION IF EXISTS public.validate_payment_review_action() CASCADE;

-- =============================================================================
-- Validação pós-deploy (rodar no SQL Editor):
--
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('benefit_rules','field_payments','field_payment_items','payment_reviews');
--   -- deve retornar ZERO linhas
--
--   SELECT routine_name FROM information_schema.routines
--     WHERE routine_schema='public' AND routine_name='validate_payment_review_action';
--   -- deve retornar ZERO linhas
-- =============================================================================
