-- ============================================================
-- SQL_UPDATE_STATUS_PROJETOS_ABRIL2026.sql
-- Atualização de status de projetos — auditoria abril/2026
-- Colar no SQL Editor do Lovable — NÃO é migration
-- Data: 15/04/2026
-- ============================================================
-- ATENÇÃO: Verificar nomes antes de executar.
-- UUIDs diretos onde confirmados; ILIKE onde não confirmado.
-- ============================================================


-- ============================================================
-- BLOCO 1 — VERIFICAÇÃO PRÉVIA (rodar antes dos UPDATEs)
-- ============================================================
/*
SELECT id, name, execution_status, notes
FROM public.projects
WHERE name ILIKE ANY(ARRAY['%alphaville%leonardo%','%gran alpes%','%paudalho%','%candeias%','%flamboyant%','%belart%aldeia%','%marcos aldeia%','%colarcoverde%','%polimix%maceio%','%polimix%jabotao%'])
ORDER BY name;
*/


-- ============================================================
-- BLOCO 2 — UPDATES DE STATUS
-- ============================================================

-- 1. Alphaville Leonardo → pago
--    Entregue 07/04 (Grupo SERVIÇOS ENTREGUE), pago 08/04 (Sérgio pediu baixa no grupo)
UPDATE public.projects
SET
  execution_status = 'pago',
  delivered_at = '2026-04-07',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Serviço entregue 07/04. Pago 08/04 via PIX (confirmado no WhatsApp). Baixa solicitada por Sérgio.'
WHERE name ILIKE '%alphaville%leonardo%'
  AND execution_status != 'pago';


-- 2. Gran Alpes → entregue (pagamento a confirmar)
--    Entregue 01/04 (grupo SERVIÇOS ENTREGUE — Emmanuel)
--    PIX recebidos: R$4.400 (01/04) + R$2.400 (10/04) no BB Cartografia
UPDATE public.projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-01',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Serviço entregue 01/04 (Emmanuel). PIX R$4.400 em 01/04 + R$2.400 em 10/04 recebidos BB Cartografia. Confirmar baixa completa no Meu Dinheiro.'
WHERE name ILIKE '%gran alpes%'
  AND execution_status NOT IN ('entregue', 'faturamento', 'pago');


-- 3. UFV Paudalho (Kroma Engenharia) → entregue
--    UUID confirmado: 97fb4989-9847-4316-9534-243fe5e55af8
--    Entregue 06/04 (Jonatha). R$3.500 a receber (Meu Dinheiro NF 0005).
UPDATE public.projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-06',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Serviço UFV Paudalho entregue 06/04 (Jonatha). R$3.500 a receber — Kroma Engenharia, NF 0005, venc 30/04. BB Cartografia.'
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8'
  AND execution_status NOT IN ('entregue', 'faturamento', 'pago');


-- 4. CTR Candeias → entregue (pagamento a confirmar)
--    Entregue 26/03. Pagamento não confirmado.
UPDATE public.projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-03-26',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Serviço entregue 26/03. Pagamento não confirmado — verificar com Sérgio/Alcione.'
WHERE name ILIKE '%ctr%candeias%'
  AND execution_status NOT IN ('entregue', 'faturamento', 'pago');


-- 5. Loteamento Flamboyant → entregue + nota fiscal
--    NF 0039 enviada 23/03 retornou bounce no email @parquedosmognos.com.br
--    Porém cliente PAGOU R$24.199 em 08/04 via PIX (BB Cartografia)
--    NF nunca foi emitida formalmente — situação fiscal pendente
UPDATE public.projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] ATENÇÃO: R$24.199 recebido via PIX em 08/04 (BB Cartografia). NF 0039 enviada 23/03 retornou bounce (email @parquedosmognos.com.br inválido). NF nunca emitida formalmente — risco fiscal. Verificar com Alcione/Sérgio urgente. Daniel Alves saiu da empresa.'
WHERE name ILIKE '%flamboyant%'
  AND execution_status NOT IN ('pago');


-- 6. Belart Aldeia (Marcos Aldeia 30%) → manter status + nota irregularidade
--    PIX recebido de BELART em 23/03 sem NF emitida — situação fiscal irregular
--    Decisão pendente com Alcione (item 7 em DECISOES_PENDENTES)
UPDATE public.projects
SET
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] IRREGULAR: PIX 30% recebido de BELART em 23/03 SEM NF emitida. Situação fiscal crítica. Decisão pendente: NF retroativa (risco fiscal) — verificar com Alcione.'
WHERE name ILIKE '%belart%aldeia%'
  AND notes NOT ILIKE '%IRREGULAR%';


-- 7. Colarcoverde → faturamento
--    NF 0007 emitida em 15/04 às 09:20 (confirmado email operacional@agtopografia.com.br)
UPDATE public.projects
SET
  execution_status = 'faturamento',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] NF 0007 emitida 15/04 às 09:20. AG Cartografia. Arcoverde/PE. Aguardando pagamento.'
WHERE name ILIKE '%colarcoverde%'
  AND execution_status NOT IN ('faturamento', 'pago');


-- 8. Polimix Maceió → entregue
--    Entregue 14/04 (Furos Abril — Diego)
UPDATE public.projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-14',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Furos Abril entregues 14/04 (Diego). Enviado para Bruce + Guilherme Laonth.'
WHERE name ILIKE '%polimix%maceio%'
  AND execution_status NOT IN ('entregue', 'faturamento', 'pago');


-- 9. Polimix Jaboatão → entregue
--    Medição Março entregue 01/04 (Diego). NF 0035/0036 a receber.
UPDATE public.projects
SET
  execution_status = 'entregue',
  delivered_at = '2026-04-01',
  notes = COALESCE(notes || ' | ', '') || '[15/04/2026] Medição Março entregue 01/04 (Diego). NF 0035 R$4.000 + NF 0036 R$4.700 — BB Cartografia, venc 10/05.'
WHERE name ILIKE '%polimix%jabotao%'
  AND execution_status NOT IN ('entregue', 'faturamento', 'pago');


-- ============================================================
-- BLOCO 3 — VERIFICAÇÃO PÓS-UPDATE
-- ============================================================
SELECT name, execution_status, delivered_at,
       LEFT(notes, 120) AS notes_preview
FROM public.projects
WHERE name ILIKE ANY(ARRAY['%alphaville%','%gran alpes%','%paudalho%','%candeias%','%flamboyant%','%belart%','%colarcoverde%','%polimix%maceio%','%polimix%jabotao%'])
ORDER BY name;


-- ============================================================
-- BLOCO 4 — NORMALIZAÇÃO DE NOMES (leads e projetos)
-- ============================================================

-- Corrigir nome do projeto Kroma/UFV Paudalho para padronizar
UPDATE public.projects
SET name = 'UFV Paudalho — Kroma Engenharia'
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8'
  AND name NOT ILIKE '%paudalho%';

-- Normalizar Polimix Jaboatão (grafia com til)
UPDATE public.projects
SET name = 'Polimix Jaboatão'
WHERE name ILIKE '%polimix%jabotao%'
  AND name NOT LIKE '%Jaboat%';

-- Normalizar Colarcoverde → Colgravata/Colarcoverde (conforme CLAUDE.md)
-- NOTA: manter como está se já correto. Só executar se necessário.
-- UPDATE public.projects SET name = 'Colgravata / Colarcoverde'
-- WHERE name ILIKE '%colarcoverde%' AND name NOT ILIKE '%colgravata%';
