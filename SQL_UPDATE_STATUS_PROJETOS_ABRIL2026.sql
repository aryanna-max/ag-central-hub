-- ============================================================
-- SQL_UPDATE_STATUS_PROJETOS_ABRIL2026.sql
-- Colar no SQL Editor do Lovable (ou Supabase Dashboard)
-- Data: 16/04/2026
-- Origem: Auditoria WhatsApp + Verificacao Completa 15/04
-- ============================================================
-- IMPORTANTE: Rodar BLOCO POR BLOCO e verificar rowcount
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOCO 1 — VERIFICACAO PRE-UPDATE (rodar antes)         ║
-- ╚══════════════════════════════════════════════════════════╝

SELECT id, name, execution_status, notes
FROM projects
WHERE name ILIKE ANY(ARRAY[
  '%Leonardo%Alphaville%','%Alphaville%Leonardo%',
  '%Gran Alpes%',
  '%Kroma%','%Paudalho%',
  '%CTR%Candeias%','%Candeias%',
  '%Flamboyant%',
  '%Belart%Aldeia%','%Marcos%Aldeia%',
  '%Santa Barbara%','%Lote 55%',
  '%Colarcoverde%','%Colgravata%',
  '%Polimix%Mace%','%Polimix Maceio%',
  '%Polimix%Jaboa%','%Polimix%Jaboa%'
])
ORDER BY name;

-- ── UUID confirmado na sessao anterior:
-- Kroma Engenharia (UFV Paudalho): 97fb4989-9847-4316-9534-243fe5e55af8


-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOCO 2 — UPDATES DE STATUS                            ║
-- ╚══════════════════════════════════════════════════════════╝

-- 1. Alphaville Leonardo → PAGO
--    PIX recebido 08/04: Maria Luisa (R$1.800) + Maria Eduarda (R$2.600)
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] PAGO. PIX 08/04: Maria Luisa R$1.800 + Maria Eduarda R$2.600. Baixa auditoria WhatsApp.'
WHERE name ILIKE '%Leonardo%Alphaville%' OR name ILIKE '%Alphaville%Leonardo%'
  AND is_legacy = false;

-- 2. Gran Alpes → PAGO
--    Entregue 01/04. PIX BB: R$4.400 (01/04) + R$2.400 (10/04)
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] PAGO. PIX BB: R$4.400 em 01/04 + R$2.400 em 10/04. Entregue 01/04 por Emmanuel.'
WHERE name ILIKE '%Gran Alpes%'
  AND is_legacy = false;

-- 3. KROMA ENGENHARIA (UFV Paudalho) → ENTREGUE
--    Entregue 06/04. A receber: Kroma R$3.500 venc 30/04 (Meu Dinheiro NF 0005)
UPDATE projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-06',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] ENTREGUE 06/04 por Jonatha (confirmado WhatsApp). A receber R$3.500 venc 30/04 - NF 0005 BB Cartografia.'
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8';

-- 4. CTR Candeias → ENTREGUE
UPDATE projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-15',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] ENTREGUE. Confirmado auditoria abril 2026.'
WHERE name ILIKE '%CTR%Candeias%' OR (name ILIKE '%Candeias%' AND name ILIKE '%CTR%')
  AND is_legacy = false;

-- 5. Flamboyant → sem mudanca de status, apenas nota
--    R$24.199 recebido PIX 08/04 porem NF NUNCA EMITIDA (risco fiscal)
--    Status atual deve permanecer (faturamento ou entregue)
UPDATE projects
SET
  notes = COALESCE(notes, '') || E'\n[16/04/2026] ATENCAO: R$24.199 recebido PIX 08/04 (BB Cartografia). NF NUNCA EMITIDA - risco fiscal. Equipe: Daniel Alves + Tarcisio. Decisao pendente com Alcione (item 7 decisoes).'
WHERE name ILIKE '%Flamboyant%'
  AND is_legacy = false;

-- 6. Belart Aldeia (Marcos Aldeia) → PAGO
--    Pago sem NF - risco fiscal, aguarda decisao
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] PAGO. ATENCAO: pago sem NF. Risco fiscal - verificar com Alcione. Aldeia/PE.'
WHERE name ILIKE '%Belart%Aldeia%'
  AND is_legacy = false;

-- 7. Lote 55 Santa Barbara → PAGO
--    PIX recebido confirmado auditoria
UPDATE projects
SET
  execution_status = 'pago',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] PAGO. Confirmado auditoria abril 2026.'
WHERE name ILIKE '%Santa Barbara%' OR name ILIKE '%Lote 55%'
  AND is_legacy = false;

-- 8. Colarcoverde → FATURAMENTO
--    NF 0007 emitida 15/04/2026 (confirmado email operacional@agtopografia.com.br)
UPDATE projects
SET
  execution_status = 'faturamento',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] NF 0007 emitida em 15/04/2026. Aguardando pagamento. Medicao Colarcoverde abril em andamento.'
WHERE name ILIKE '%Colarcoverde%' OR name ILIKE '%Colgravata%'
  AND is_legacy = false;

-- 9. Polimix Maceio → ENTREGUE
--    Entregue 14/04 por Diego (Furos Abril - Bruce + Guilherme Laonth)
--    A receber: NF 0038 R$4.800 venc 19/05
UPDATE projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-14',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] ENTREGUE 14/04 por Diego (Polimix Maceio - Furos Abril). Destinatarios: Bruce + Guilherme Laonth. A receber NF 0038 R$4.800 venc 19/05.'
WHERE name ILIKE '%Polimix%Mace%' OR name ILIKE '%Polimix Maceio%'
  AND is_legacy = false;

-- 10. Polimix Jaboatao → ENTREGUE
--     Entregue 14/04 por Diego (Medicao Abril - Guarany)
--     A receber: NF 0035 R$4.000 + NF 0036 R$4.700 venc 10/05
UPDATE projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-14',
  notes = COALESCE(notes, '') || E'\n[16/04/2026] ENTREGUE 14/04 por Diego (Medicao Abril Guarany + Medicao Marco 01/04). A receber: NF 0035 R$4.000 + NF 0036 R$4.700 venc 10/05.'
WHERE name ILIKE '%Polimix%Jaboa%' OR name ILIKE '%Polimix%Jaboatao%' OR name ILIKE '%Polimix Jaboa%'
  AND is_legacy = false;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOCO 3 — NORMALIZACAO DE NOMES                        ║
-- ╚══════════════════════════════════════════════════════════╝

-- Padronizar Colarcoverde (pode aparecer como Colgravata)
-- Verificar antes:
-- SELECT id, name FROM projects WHERE name ILIKE '%Colgravata%';
-- Se existir como Colgravata E Colarcoverde separados, unificar manualmente.

-- Padronizar KROMA — garantir que o nome do projeto reflita o servico:
UPDATE projects
SET name = 'UFV Paudalho — Kroma Engenharia'
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8'
  AND name NOT ILIKE '%Paudalho%';

-- Leads: normalizar nomes duplicados ou com typos
-- (rodar SELECT primeiro para verificar antes de alterar)
-- SELECT id, name, company, status FROM leads WHERE company ILIKE '%Polimix%' OR company ILIKE '%BRK%' ORDER BY company;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOCO 4 — VERIFICACAO POS-UPDATE                       ║
-- ╚══════════════════════════════════════════════════════════╝

SELECT id, name, execution_status, delivered_at,
       LEFT(notes, 120) AS notes_preview
FROM projects
WHERE name ILIKE ANY(ARRAY[
  '%Leonardo%','%Alphaville%',
  '%Gran Alpes%',
  '%Kroma%','%Paudalho%',
  '%CTR%Candeias%',
  '%Flamboyant%',
  '%Belart%',
  '%Santa Barbara%','%Lote 55%',
  '%Colarcoverde%','%Colgravata%',
  '%Polimix%'
])
ORDER BY name;
