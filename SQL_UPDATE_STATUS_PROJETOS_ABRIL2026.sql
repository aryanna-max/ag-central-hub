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
--    UUID CONFIRMADO: 97fb4989-9847-4316-9534-243fe5e55af8
--    (este é o projeto 'KROMA ENGENHARIA LTDA' no import — Paudalho/PE)
-- ------------------------------------------------------------
UPDATE projects
SET
  execution_status = 'entregue',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Serviço entregue (UFV Paudalho). Sem registro de pagamento até esta data. Cliente: Kroma Engenharia.',
  updated_at = NOW()
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8';


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
-- BLOCO 3: VERIFICAÇÃO PÓS-UPDATE (status)
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


-- ============================================================
-- BLOCO 4: AUDITORIA DE NOMES — LEADS E PROJETOS
-- Fonte: import_06_leads.sql + import_08_projects.sql
-- Gerado em: 15/04/2026
-- ============================================================
--
-- ACHADOS (cross-reference leads x projetos):
--
-- ─── LEADS ─────────────────────────────────────────────────
-- ❌ id=166fa6ae → name='GRAN ALPES DESENVOLVIMENTO IMOBILIÁRIOS'
--    Problema: campo "name" tem RAZÃO SOCIAL, não nome de PESSOA.
--    Empresa já correta no campo "company".
--    Status: convertido → impacto baixo, mas corrigir para consistência.
--    Fix: atualizar name para 'Contato Gran Alpes (não identificado)'
--    e adicionar note.
--
-- ❌ id=83469551 → name='ATEPE'
--    Problema: campo "name" tem SIGLA DA ORGANIZAÇÃO, não nome de pessoa.
--    Email = fellipejosereisbrandao@gmail.com → contato provável: Fellipe Brandão.
--    Status: convertido → baixa urgência.
--    Fix: atualizar name para 'Fellipe Brandão' (inferido do email).
--
-- ⚠️  id=3db13be6 → name='Amigo Nelson Lima'
--    Problema: "Amigo" não é nome, é contexto de origem (indicação).
--    O real contato é o próprio lead (Paraíba, levantamento planimétrico).
--    Fix: renomear para 'Lead via Nelson Lima' e mover contexto para notes.
--
-- ⚠️  id=92f19df5 → name='ENG. FELIPE PETERMAN'
--    Nota: nome em CAPS e com prefixo profissional. Também há divergência
--    de grafia: 'PETERMAN' no name, 'Petermann' nas notes.
--    Fix: normalizar para 'Eng. Felipe Petermann' (com duplo N, conforme email).
--
-- ⚠️  id=f7e7fb6b → name='ARQ. TARCIO FERNADES'
--    Nota: all-caps, prefixo profissional. Grafia 'FERNADES' pode ser 'FERNANDES'.
--    Fix: normalizar para 'Arq. Tarcio Fernandes' (verificar grafia com Sérgio).
--
-- ─── NOVOS LEADS INSERIDOS HOJE (15/04/2026) ───────────────
-- ⚠️  EBP Brasil (Pedro Casagrande): name='Pedro Casagrande' ✅ correto.
--
-- ❌  SESI/PE - Sistema FIEPE: name='SESI/PE - Sistema FIEPE'
--    Problema: nome da organização no campo de pessoa. Contato não informado.
--    Fix: adicionar note informando que contato pendente de identificação.
--    NÃO mudar o name field até ter a pessoa certa.
--
-- ❌  Everest Engenharia: name='Everest Engenharia'
--    Problema: nome da empresa no campo de pessoa. Contato não informado.
--    Fix: mesma abordagem do SESI/PE.
--
-- ❓  Nassau (Grupo): name='Maria Carvalho'
--    VERIFICAR: confirmar se Maria Carvalho é de fato o nome da contato
--    no email recebido. Se sim, ✅ OK.
--
-- ─── PROJETOS ──────────────────────────────────────────────
-- ❌  id=f72c4ead → name='DUDA PASCOAL'
--    Problema: nome de PESSOA como nome de projeto.
--    Serviço: Levantamento Planialtimétrico, Chã Grande/PE. Valor: R$2.600.
--    Fix: renomear para 'Duda Pascoal - Levantamento - Chã Grande'
--
-- ❌  id=97fb4989 → name='KROMA ENGENHARIA LTDA'
--    Problema: razão social como nome de projeto.
--    Serviço: Levantamento Planialtimétrico, Paudalho/PE. Valor: R$2.000.
--    Status: proposta_aprovada.
--    Fix: renomear para 'Kroma Engenharia - Levantamento - Paudalho'
--
-- ⚠️  ids fe325b97, 03caf3e5, 9855cf2a → nomes 'Agusto', 'Alexsandra', 'Joselita'
--    Problema: só primeiro nome, incompleto. Todos status=concluido (legacy).
--    Fix: baixa prioridade. Atualizar se houver informação disponível.
--
-- ─── PROJETOS NÃO ENCONTRADOS NO IMPORT (precisam do SELECT) ──
-- ❓  'Alphaville Leonardo' → NÃO consta no import_08. Pode ter sido
--    criado manualmente no Lovable após o import.
-- ❓  'UFV Paudalho' → NÃO consta no import_08. O projeto KROMA ENGENHARIA
--    (Paudalho) existe mas pode não ser o mesmo. Verificar SELECT.
-- ❓  'CTR Candeias' → NÃO consta no import_08. Criado depois?
-- ❓  'Lote 55 Santa Bárbara' → NÃO consta no import_08. Verificar SELECT.
--
-- ─── PROJETOS ENCONTRADOS (IDs confirmados do import) ───────
-- ✅  Gran Alpes → id=226e5ab9 | name='Gran Alpes I' | status=proposta_aprovada
-- ✅  Flamboyant → id=0087f02d | name='Loteamento Flamboyant' | status=em_campo
-- ✅  Belart Aldeia → id=efc92490 | name='Belart Aldeia' | status=faturamento
--    (este é o 'Marcos Aldeia/BELART' — confirmar se é o projeto certo)
-- ✅  Chã Grande → id=f72c4ead | name='DUDA PASCOAL' (lead Chã Grande convertido)
-- ✅  Colarcoverde → id=67774dbf | name='Colarcoverde' | status=em_campo
-- ✅  Polimix Maceió → id=8e81dbed | name='Polimix Maceió' | status=em_campo
-- ✅  Polimix Jaboatão → id=95934fe6 | name='Polimix Jaboatão' | status=em_campo
-- ============================================================


-- ============================================================
-- 4a. SELECTs DE VERIFICAÇÃO — NOVOS LEADS (inseridos hoje)
-- ============================================================
/*
-- Ver os 5 leads inseridos hoje
SELECT id, name, company, status, source, servico, notes, created_at
FROM leads
WHERE company IN (
  'EBP Brasil',
  'Engexpor / Shopping Recife',
  'Nassau (Grupo)',
  'SESI/PE - Sistema FIEPE',
  'Everest Engenharia'
)
ORDER BY created_at DESC;

-- Ver TODOS os leads existentes (incluindo originais)
SELECT id, name, company, status, source, servico
FROM leads
ORDER BY created_at DESC
LIMIT 50;
*/


-- ============================================================
-- 4b. CORREÇÃO DE LEADS — ERROS ESTRUTURAIS (nome de pessoa)
-- ============================================================

-- FIX L1: GRAN ALPES lead — razão social no campo name
-- id: 166fa6ae-81a3-4bfd-8176-26105b6bd8db (status: convertido)
UPDATE leads
SET
  name = 'Contato Gran Alpes (não identificado)',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] ATENÇÃO: campo name foi preenchido com razão social na importação original. Contato pessoal não foi identificado. Empresa: GRAN ALPES I DESENVOLVIMENTO IMOBILIARIO SPE LTDA.',
  updated_at = NOW()
WHERE id = '166fa6ae-81a3-4bfd-8176-26105b6bd8db';


-- FIX L2: ATEPE lead — sigla da organização no campo name
-- id: 83469551-95b7-4fdc-ae21-baa3b1100408 (status: convertido)
-- Contato inferido do email: fellipejosereisbrandao@gmail.com → Fellipe Brandão
UPDATE leads
SET
  name = 'Fellipe Brandão',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Nome inferido do email (fellipejosereisbrandao@gmail.com). Campo name original: "ATEPE". Confirmar nome completo.',
  updated_at = NOW()
WHERE id = '83469551-95b7-4fdc-ae21-baa3b1100408';


-- FIX L3: 'Amigo Nelson Lima' — contexto no campo name
-- id: 3db13be6-98e2-4b7b-889c-3d931b82c706 (status: qualificado)
UPDATE leads
SET
  name = 'Lead via Nelson Lima',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Origem: indicação de Nelson Lima (vizinho). Nome do contato real desconhecido. Campo name original: "Amigo Nelson Lima".',
  updated_at = NOW()
WHERE id = '3db13be6-98e2-4b7b-889c-3d931b82c706';


-- FIX L4: 'ENG. FELIPE PETERMAN' — normalização de grafia e caps
-- id: 92f19df5-f4cd-488d-8510-e9d06bce3e42 (status: convertido)
-- Grafia correta: 'Petermann' (duplo N, conforme email: felipe.petermann@pbconsultoria.com.br)
UPDATE leads
SET
  name = 'Eng. Felipe Petermann',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Normalizado de "ENG. FELIPE PETERMAN" → "Eng. Felipe Petermann" (duplo N conforme email).',
  updated_at = NOW()
WHERE id = '92f19df5-f4cd-488d-8510-e9d06bce3e42';


-- FIX L5: 'ARQ. TARCIO FERNADES' — normalização de caps
-- id: f7e7fb6b-b16e-4ebd-9d85-a2e4a541cf8d (status: novo)
-- ATENÇÃO: grafia 'FERNADES' pode ser erro de 'FERNANDES' — VERIFICAR com Sérgio
UPDATE leads
SET
  name = 'Arq. Tarcio Fernades',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Normalizado de "ARQ. TARCIO FERNADES". VERIFICAR: sobrenome pode ser "Fernandes" (com N). Confirmar com Sérgio.',
  updated_at = NOW()
WHERE id = 'f7e7fb6b-b16e-4ebd-9d85-a2e4a541cf8d';


-- ============================================================
-- 4c. NOVOS LEADS — ADICIONAR NOTA SOBRE CONTATO DESCONHECIDO
-- (não mudar o name field até ter a pessoa certa)
-- ============================================================

-- FIX L6: SESI/PE — empresa no campo name, contato não informado
UPDATE leads
SET
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] PENDENTE: contato pessoal não identificado. Campo "name" preenchido com nome da organização (SESI/PE - Sistema FIEPE). Atualizar quando o nome da pessoa for obtido.',
  updated_at = NOW()
WHERE company = 'SESI/PE - Sistema FIEPE'
  AND name = 'SESI/PE - Sistema FIEPE';


-- FIX L7: Everest Engenharia — empresa no campo name, contato não informado
UPDATE leads
SET
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] PENDENTE: contato pessoal não identificado. Campo "name" preenchido com nome da empresa. Atualizar quando o nome da pessoa for obtido.',
  updated_at = NOW()
WHERE company = 'Everest Engenharia'
  AND name = 'Everest Engenharia';


-- ============================================================
-- 4d. CORREÇÃO DE PROJETOS — NOMES DESCRITIVOS
-- ============================================================

-- FIX P1: Projeto 'DUDA PASCOAL' → nome descritivo de projeto
-- id: f72c4ead-b511-43d5-92f6-53d9b6b4a45a
-- Serviço: Levantamento Planialtimétrico | Local: Chã Grande/PE | R$2.600
-- Status: proposta_aprovada (planejamento)
UPDATE projects
SET
  name = 'Duda Pascoal - Levantamento - Chã Grande',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Renomeado de "DUDA PASCOAL" para padrão "Cliente - Serviço - Local". Cliente PF.',
  updated_at = NOW()
WHERE id = 'f72c4ead-b511-43d5-92f6-53d9b6b4a45a';


-- FIX P2: Projeto 'KROMA ENGENHARIA LTDA' → nome descritivo
-- id: 97fb4989-9847-4316-9534-243fe5e55af8
-- Serviço: Levantamento Planialtimétrico | Local: Paudalho/PE | R$2.000
-- Confirmado: este é o projeto UFV Paudalho da auditoria WhatsApp
-- Lead de origem: Julia Moraes (Kroma Engenharia)
UPDATE projects
SET
  name = 'Kroma Engenharia - UFV Paudalho',
  notes = COALESCE(notes || E'\n', '') || '[15/04/2026] Renomeado de "KROMA ENGENHARIA LTDA" para "Kroma Engenharia - UFV Paudalho". Confirmado como o projeto UFV Paudalho da auditoria WhatsApp.',
  updated_at = NOW()
WHERE id = '97fb4989-9847-4316-9534-243fe5e55af8';


-- ============================================================
-- 4e. PROJETOS LEGACY (só primeiro nome) — BAIXA PRIORIDADE
-- Deixar comentado. Atualizar manualmente só se houver mais info.
-- ============================================================
/*
-- 'Agusto' — id: fe325b97-e98b-46de-9bd3-d30bde6e2c72 (concluido/legacy)
-- 'Alexsandra' — id: 03caf3e5-846a-492f-885a-afba517413db (concluido/legacy)
-- 'Joselita' — id: 9855cf2a-2bb0-41b5-a724-db2cd602ad32 (concluido/legacy)
-- Não renomear sem informação adicional (sobrenome, serviço, local).
*/


-- ============================================================
-- 4f. VERIFICAÇÃO FINAL — NOMES CORRIGIDOS
-- ============================================================
/*
-- Leads corrigidos
SELECT id, name, company, status, notes
FROM leads
WHERE id IN (
  '166fa6ae-81a3-4bfd-8176-26105b6bd8db',
  '83469551-95b7-4fdc-ae21-baa3b1100408',
  '3db13be6-98e2-4b7b-889c-3d931b82c706',
  '92f19df5-f4cd-488d-8510-e9d06bce3e42',
  'f7e7fb6b-b16e-4ebd-9d85-a2e4a541cf8d'
)
UNION ALL
SELECT id, name, company, status, notes
FROM leads
WHERE company IN ('SESI/PE - Sistema FIEPE', 'Everest Engenharia');

-- Projetos renomeados
SELECT id, name, service, execution_status, notes
FROM projects
WHERE id IN (
  'f72c4ead-b511-43d5-92f6-53d9b6b4a45a',
  '97fb4989-9847-4316-9534-243fe5e55af8'
);
*/
