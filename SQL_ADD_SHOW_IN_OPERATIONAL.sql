-- ============================================================
-- Adicionar campo show_in_operational na tabela projects
-- Default true = todo projeto aparece no Operacional
-- Desmarcar manualmente os que sao so do Financeiro (ex: SPEs BRK)
-- ============================================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS show_in_operational boolean NOT NULL DEFAULT true;

-- Verificar
SELECT id, codigo, name, show_in_operational
FROM projects
ORDER BY name;
