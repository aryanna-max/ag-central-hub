-- ============================================================
-- UPDATE STATUS PROJETOS — AUDITORIA WHATSAPP ABRIL 2026
-- Gerado em: 15/04/2026
-- Executar no Lovable SQL Editor (Supabase: bphgtvwgsgaqaxmkrtqj)
-- ============================================================
-- INSTRUÇÃO: Execute primeiro o bloco de SELECTs de verificação
-- abaixo para confirmar que os projetos existem e ver o status
-- atual antes de rodar os UPDATEs.
-- ============================================================


-- ============================================================
-- BLOCO 1: SELECTs DE VERIFICAÇÃO (rodar antes dos UPDATEs)
-- ============================================================

/*
SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Alphaville%' OR name ILIKE '%Leonardo%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Gran Alpes%' OR name ILIKE '%GranAlpes%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%UFV%' OR name ILIKE '%Paudalho%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%CTR%' OR name ILIKE '%Candeias%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Flamboyant%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Marcos%Aldeia%'
   OR name ILIKE '%Chã Grande%'
   OR name ILIKE '%Cha Grande%'
   OR name ILIKE '%BELART%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Santa B%rbara%' OR name ILIKE '%Lote 55%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Colarcoverde%' OR name ILIKE '%Colar%verde%';

SELECT id, codigo, name, execution_status, notes
FROM projects
WHERE name ILIKE '%Polimix%';
*/


-- ============================================================
-- BLOCO 2: UPDATEs
-- ============================================================
-- Cada UPDATE usa subquery por nome (ILIKE) como fallback.
-- Se o SELECT de verificação acima retornar o UUID exato,
-- substitua o WHERE pelo UUID para maior segurança:
--   WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- ============================================================


-- ------------------------------------------------------------
-- 1. ALPHAVILLE LEONARDO → pago
--    Pagamento confirmado via WhatsApp 08/04. Sérgio pediu "dar baixa".
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Pagamento confirmado via WhatsApp 08/04. Dado baixa conforme solicitação Sérgio.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Alphaville%Leonardo%'
     OR (name ILIKE '%Alphaville%' AND name ILIKE '%Leonardo%')
  ORDER BY created_at DESC
  LIMIT 1
);

-- Se não encontrar pelo nome acima, tente:
-- WHERE id = (SELECT id FROM projects WHERE name ILIKE '%Alphaville%' LIMIT 1)


-- ------------------------------------------------------------
-- 2. GRAN ALPES → entregue
--    Serviço entregue conforme WhatsApp, pagamento não registrado ainda.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue conforme WhatsApp. Pagamento ainda não registrado.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Gran Alpes%' OR name ILIKE '%GranAlpes%'
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 3. UFV PAUDALHO → entregue
--    Serviço entregue, sem pagamento visível.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue. Sem registro de pagamento até esta data.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%UFV%Paudalho%'
     OR (name ILIKE '%UFV%' AND name ILIKE '%Paudalho%')
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 4. CTR CANDEIAS → entregue
--    Serviço entregue, sem pagamento visível.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue. Sem registro de pagamento até esta data.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%CTR%Candeias%'
     OR (name ILIKE '%CTR%' AND name ILIKE '%Candeias%')
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 5. FLAMBOYANT — SÓ ATUALIZA NOTES (não muda execution_status)
--    "Última NF emitida. Próxima só em julho se Daniel voltar."
--    ATENÇÃO: Flamboyant pode ter múltiplos projetos (medicao_mensal).
--    Verifique o SELECT acima antes de rodar — pode precisar ajustar
--    para referenciar o projeto específico por UUID.
-- ------------------------------------------------------------
UPDATE projects
SET
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Última NF emitida. Próxima NF só em julho se Daniel Alves retornar. NF NUNCA foi emitida para o cliente Flamboyant até esta revisão.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Flamboyant%'
  ORDER BY created_at DESC
  LIMIT 1
);

-- ATENÇÃO: Se houver mais de 1 projeto Flamboyant, rode individualmente
-- por UUID. Use o SELECT de verificação acima para listar todos.


-- ------------------------------------------------------------
-- 6. MARCOS ALDEIA / CHÃ GRANDE (BELART) → pago (parcial, pendente regularização)
--    Pix 30% recebido SEM NOTA FISCAL. Precisa regularização.
--    RISCO FISCAL — ver decisão pendente #7 no CLAUDE.md
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] ⚠️ ATENÇÃO: Pix de 30% recebido SEM NOTA FISCAL. Necessita regularização urgente. Ver decisão pendente com Alcione (risco NF retroativa).',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Marcos%Aldeia%'
     OR name ILIKE '%Chã Grande%'
     OR name ILIKE '%Cha Grande%'
     OR name ILIKE '%BELART%'
  ORDER BY created_at DESC
  LIMIT 1
);

-- NOTA: Se "Marcos Aldeia" e "Chã Grande (BELART)" forem projetos separados,
-- execute cada UPDATE individualmente com o UUID específico.


-- ------------------------------------------------------------
-- 7. LOTE 55 SANTA BÁRBARA → pago
--    Pagamento registrado via WhatsApp.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Pagamento confirmado via WhatsApp.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Lote 55%'
     OR name ILIKE '%Santa B_rbara%'
     OR (name ILIKE '%Santa%' AND name ILIKE '%Barbara%')
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 8. COLARCOVERDE → faturamento
--    NF emitida 15/04/2026.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'faturamento',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] NF emitida em 15/04/2026.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Colarcoverde%'
     OR name ILIKE '%Colar%verde%'
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 9a. POLIMIX MACEIÓ → entregue
--     Serviço entregue. Billing medicao_mensal — pagamento separado.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue. Projeto medicao_mensal — pagamento tratado separadamente via medição.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Polimix%Maceió%'
     OR name ILIKE '%Polimix%Maceio%'
     OR (name ILIKE '%Polimix%' AND (name ILIKE '%Maceió%' OR name ILIKE '%Maceio%' OR city ILIKE '%Maceió%'))
  ORDER BY created_at DESC
  LIMIT 1
);


-- ------------------------------------------------------------
-- 9b. POLIMIX JABOATÃO → entregue
--     Serviço entregue. Billing medicao_mensal — pagamento separado.
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue. Projeto medicao_mensal — pagamento tratado separadamente via medição.',
  updated_at = NOW()
WHERE id = (
  SELECT id FROM projects
  WHERE name ILIKE '%Polimix%Jaboa%'
     OR (name ILIKE '%Polimix%' AND name ILIKE '%Jaboa%')
  ORDER BY created_at DESC
  LIMIT 1
);


-- ============================================================
-- BLOCO 3: VERIFICAÇÃO PÓS-UPDATE
-- ============================================================
/*
SELECT id, codigo, name, execution_status, notes, updated_at
FROM projects
WHERE name ILIKE '%Alphaville%Leonardo%'
   OR name ILIKE '%Gran Alpes%'
   OR name ILIKE '%UFV%Paudalho%'
   OR name ILIKE '%CTR%Candeias%'
   OR name ILIKE '%Flamboyant%'
   OR name ILIKE '%Marcos%Aldeia%'
   OR name ILIKE '%Chã Grande%' OR name ILIKE '%Cha Grande%' OR name ILIKE '%BELART%'
   OR name ILIKE '%Santa B%rbara%' OR name ILIKE '%Lote 55%'
   OR name ILIKE '%Colarcoverde%'
   OR name ILIKE '%Polimix%'
ORDER BY updated_at DESC;
*/
