-- =============================================================================
-- Onda 3 — Consolidação: transporte_tipo canônico + system_settings + subtipo
-- =============================================================================
-- Contexto:
--   Onda 3 (ADR-040) tinha 5 itens. Durante auditoria 22/04 descobrimos que
--   schema de vários itens JÁ EXISTE:
--
--   ✅ 3.3 transporte_tipo em employees — EXISTE (só falta CHECK + docs)
--   ✅ 3.3 system_settings tabela — EXISTE (falta seed das 4 chaves)
--   ✅ 3.4 expense_type — é text livre (não enum), não precisa migration
--   ✅ 3.5 field_expense_items.subtipo — EXISTE (falta CHECK)
--
--   useDailySchedule.ts JÁ LÊ de system_settings (linha 304-308) com fallback
--   hardcoded 4.50 × 2. Agora vamos garantir que system_settings tem valores.
--
--   useMonthlyDiscountReports.ts JÁ USA transporte_tipo (linha 200).
--
-- Escopo desta migration:
--   1. Seed em system_settings das 4 chaves VT/Alelo (idempotente)
--   2. CHECK constraint em employees.transporte_tipo
--   3. CHECK constraint em field_expense_items.subtipo
--   4. COMMENT ON COLUMN marcando colunas legacy (vt_cash, has_vt, vt_value)
--      como DEPRECATED em favor de transporte_tipo
--
-- NÃO remove colunas legacy — ainda há UI (Funcionarios.tsx) usando. Remoção
-- vira próxima onda depois que UI for refatorada.
-- =============================================================================

-- 1. Seed system_settings com as 4 chaves canônicas
-- ON CONFLICT (key) DO NOTHING — não sobrescreve se já houver valor customizado
INSERT INTO public.system_settings (key, value) VALUES
  ('vt_valor_viagem', '4.50'),
  ('vt_viagens_por_dia', '2'),
  ('vt_desconto_percentual', '0.06'),
  ('alelo_valor_dia', '15.00')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.system_settings IS
  'Configurações globais do sistema como chave/valor texto. Parseadas pelo frontend (useDailySchedule, useMonthlyDiscountReports). Valores canônicos:
   - vt_valor_viagem (numeric, R$) — valor por viagem de VT. Padrão 4.50.
   - vt_viagens_por_dia (int) — viagens/dia cobertas. Padrão 2 (ida+volta).
   - vt_desconto_percentual (numeric, 0-1) — desconto lei 6% do salário. Padrão 0.06.
   - alelo_valor_dia (numeric, R$) — crédito Alelo por dia útil. Padrão 15.00.';

-- 2. CHECK em employees.transporte_tipo — valores canônicos
-- Remove constraint antigo se existir (idempotência)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS chk_transporte_tipo_valido;
ALTER TABLE public.employees ADD CONSTRAINT chk_transporte_tipo_valido
  CHECK (transporte_tipo IS NULL OR transporte_tipo IN ('vt_cartao', 'dinheiro', 'nenhum'));

COMMENT ON COLUMN public.employees.transporte_tipo IS
  'Tipo canônico de transporte do funcionário. Valores: vt_cartao (cartão VT/VEM — recebe dia 26 para mês seguinte, desconto 6% salário), dinheiro (pago em dinheiro no campo), nenhum (funcionário não tem direito ou recusa). NULL trata como vt_cartao (compatibilidade legacy).';

-- 3. CHECK em field_expense_items.subtipo — valores canônicos (VT dinheiro)
ALTER TABLE public.field_expense_items DROP CONSTRAINT IF EXISTS chk_subtipo_valido;
ALTER TABLE public.field_expense_items ADD CONSTRAINT chk_subtipo_valido
  CHECK (subtipo IS NULL OR subtipo IN ('integral', 'complemento'));

COMMENT ON COLUMN public.field_expense_items.subtipo IS
  'Subtipo do item, usado principalmente para transporte em dinheiro:
   - integral: substituiu VT (não conta nos dias VT do mês para cálculo de desconto)
   - complemento: VT usado + extra (conta normal no mês)
   NULL para outros expense_types.';

-- 4. Marcar colunas legacy como deprecated via comment
COMMENT ON COLUMN public.employees.vt_cash IS
  'DEPRECATED — usar transporte_tipo. vt_cash=true virou transporte_tipo=dinheiro; vt_cash=false virou transporte_tipo=vt_cartao. Coluna mantida para compatibilidade com UI (Funcionarios.tsx) até refactor. Remover em próxima onda.';

COMMENT ON COLUMN public.employees.has_vt IS
  'DEPRECATED — usar transporte_tipo. has_vt=false virou transporte_tipo=nenhum. Coluna mantida para compatibilidade até refactor. Remover em próxima onda.';

COMMENT ON COLUMN public.employees.vt_value IS
  'DEPRECATED — valor do VT agora vem de system_settings.vt_valor_viagem × vt_viagens_por_dia. Coluna mantida para legacy, pode conter valores antigos especiais. Não ler em código novo.';

-- =============================================================================
-- Validação pós-deploy:
--
--   -- Confirmar seed
--   SELECT key, value FROM public.system_settings
--   WHERE key IN ('vt_valor_viagem','vt_viagens_por_dia','vt_desconto_percentual','alelo_valor_dia');
--
--   -- Confirmar CHECK
--   SELECT conname FROM pg_constraint
--   WHERE conname IN ('chk_transporte_tipo_valido', 'chk_subtipo_valido');
--
--   -- Backfill de transporte_tipo a partir de vt_cash/has_vt (se necessário)
--   UPDATE public.employees
--   SET transporte_tipo = CASE
--     WHEN has_vt = false THEN 'nenhum'
--     WHEN vt_cash = true THEN 'dinheiro'
--     ELSE 'vt_cartao'
--   END
--   WHERE transporte_tipo IS NULL;
-- =============================================================================

-- Backfill defensivo: se algum funcionário ainda tem transporte_tipo NULL,
-- deriva do legacy (usa IS DISTINCT FROM pra lidar com nulls).
UPDATE public.employees
SET transporte_tipo = CASE
    WHEN has_vt IS NOT DISTINCT FROM false THEN 'nenhum'
    WHEN vt_cash IS NOT DISTINCT FROM true THEN 'dinheiro'
    ELSE 'vt_cartao'
  END
WHERE transporte_tipo IS NULL;
