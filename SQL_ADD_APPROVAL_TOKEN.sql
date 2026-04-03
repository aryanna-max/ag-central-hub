-- ============================================================
-- Adicionar campo approval_token na tabela field_expense_sheets
-- Token unico para aprovacao externa (link sem login)
-- ============================================================

ALTER TABLE field_expense_sheets
ADD COLUMN IF NOT EXISTS approval_token uuid DEFAULT gen_random_uuid();

-- Criar indice unico para busca rapida por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_sheets_approval_token
ON field_expense_sheets (approval_token);

-- Adicionar campo para historico de comentarios de aprovacao
ALTER TABLE field_expense_sheets
ADD COLUMN IF NOT EXISTS approval_comments jsonb DEFAULT '[]'::jsonb;

-- Verificar
SELECT id, codigo, status, approval_token, period_start, period_end
FROM field_expense_sheets
ORDER BY created_at DESC
LIMIT 10;
