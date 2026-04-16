-- ============================================================
-- SQL_INSERT_NOVOS_LEADS_ABRIL2026.sql
-- Novos leads identificados na auditoria de abril/2026
-- Colar no SQL Editor do Lovable — NÃO é migration
-- Data: 15/04/2026
-- ============================================================

-- LEAD 1: EBP Brasil / INGREDION — Cabo de Santo Agostinho
-- Confirmado 2 dias de campo + integração 27/04. Alto potencial.
INSERT INTO public.leads (
  name, company, source, status, servico, location, notes, origin,
  responsible_id, created_at
) VALUES (
  'EBP Brasil / INGREDION',
  'EBP Brasil',
  'email',
  'negociacao',
  'Topografia Industrial / Integração de campo',
  'Cabo de Santo Agostinho - PE',
  'Confirmado 2 dias de campo + integração 27/04. Necessita cartão CNPJ. Alto potencial. Identificado em 06-15/04/2026.',
  'email_direto',
  (SELECT id FROM public.employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  now()
);

-- LEAD 2: SCR / Shopping Recife — Claraboia
-- Solicitação de levantamento de claraboia. 15/04.
INSERT INTO public.leads (
  name, company, source, status, servico, location, notes,
  responsible_id, created_at
) VALUES (
  'SCR / Shopping Recife — Claraboia',
  'SCR Shopping Recife',
  'email',
  'prospeccao',
  'Levantamento Topográfico / Claraboia',
  'Shopping Recife - Recife/PE',
  'Solicitação de levantamento de claraboia no Shopping Recife. Enviar proposta. Identificado em 15/04/2026.',
  (SELECT id FROM public.employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  now()
);

-- LEAD 3: VIP Gestão / Marques Engenharia
-- Proposta 046 ACEITA. Novo cliente. 15/04.
INSERT INTO public.leads (
  name, company, source, status, servico, notes,
  responsible_id, created_at
) VALUES (
  'VIP Gestão / Marques Engenharia',
  'Marques Engenharia',
  'indicacao',
  'proposta_enviada',
  'Topografia (serviço contratado)',
  'Proposta 046 ACEITA em 15/04/2026. Novo cliente. Cadastrar cliente + projeto no sistema.',
  (SELECT id FROM public.employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  now()
);

-- LEAD 4: Everest Engenharia
-- Proposta solicitada para levantamento topográfico (~120m2, PE). 02/04.
INSERT INTO public.leads (
  name, company, source, status, servico, location, notes,
  responsible_id, created_at
) VALUES (
  'Everest Engenharia',
  'Everest Engenharia',
  'email',
  'prospeccao',
  'Levantamento Topográfico (~120m2)',
  'Pernambuco - PE',
  'Proposta solicitada para levantamento topográfico (~120m2). Identificado em 02/04/2026. Verificar se proposta foi enviada.',
  (SELECT id FROM public.employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  now()
);

-- LEAD 5: Governo PE / SLM — Aerofotogrametria
-- Solicitação de processamento. PDU enviou arquivos em 20/03. 26/03.
INSERT INTO public.leads (
  name, company, source, status, servico, notes,
  responsible_id, created_at
) VALUES (
  'Governo PE / SLM — Aerofotogrametria',
  'Governo do Estado de Pernambuco',
  'email',
  'prospeccao',
  'Processamento de Aerofotogrametria',
  'PDU enviou arquivos de referência em 20/03. Verificar status da proposta e registro no sistema. Identificado em 26/03/2026.',
  (SELECT id FROM public.employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  now()
);

-- ============================================================
-- VERIFICAÇÃO — rodar APÓS os INSERTs
-- ============================================================
SELECT name, company, source, status, servico, created_at
FROM public.leads
WHERE created_at > now() - interval '1 minute'
ORDER BY created_at;
