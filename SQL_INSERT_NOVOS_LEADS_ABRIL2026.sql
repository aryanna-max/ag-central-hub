-- ============================================================
-- INSERT NOVOS LEADS — ABRIL 2026
-- Gerado em: 15/04/2026
-- Executar no Lovable SQL Editor (Supabase: bphgtvwgsgaqaxmkrtqj)
-- ============================================================
-- SCHEMA REAL (leads table):
--   name (text, required) = nome do contato
--   company (text)        = empresa
--   source (enum)         = lead_source: whatsapp|telefone|email|site|indicacao|...
--   status (enum)         = lead_status: novo|proposta_enviada|em_contato|...
--   servico (text)        = descrição do serviço
--   email (text)          = email do contato
--   phone (text)          = telefone
--   notes (text)          = observações
--   valor (numeric)       = valor estimado
--   location (text)       = localização
--   origin (text)         = origem livre (texto)
--   responsible_id (uuid) = FK → employees.id
-- ============================================================

-- 1. EBP Brasil — Levantamento topográfico Cabo de Santo Agostinho
INSERT INTO leads (
  name,
  company,
  source,
  status,
  servico,
  email,
  notes,
  valor,
  origin,
  responsible_id
) VALUES (
  'Pedro Casagrande',
  'EBP Brasil',
  'email',
  'proposta_enviada',
  'Levantamento topográfico - Cabo de Santo Agostinho',
  NULL,
  'Integração prevista para 27/04/2026. Cliente confirmou 2 diárias. Proposta com 2 diárias (valor a definir).',
  NULL,
  'email_direto',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1)
);

-- 2. Engexpor / Shopping Recife — Levantamento 2 claraboias
INSERT INTO leads (
  name,
  company,
  source,
  status,
  servico,
  email,
  notes,
  valor,
  origin,
  responsible_id
) VALUES (
  'Marilia Muniz',
  'Engexpor / Shopping Recife',
  'email',
  'novo',
  'Levantamento de 2 claraboias na cobertura do Shopping Recife',
  'm.muniz@engexpor.com',
  'Solicitação recebida 15/04/2026. CC: arthur.mafra@shoppingrecife.com.br',
  NULL,
  'email_direto',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1)
);

-- 3. Nassau (Grupo) — Georreferenciamento rural Floresta/PE — URGENTE
INSERT INTO leads (
  name,
  company,
  source,
  status,
  servico,
  email,
  notes,
  valor,
  location,
  origin,
  responsible_id
) VALUES (
  'Maria Carvalho',
  'Nassau (Grupo)',
  'email',
  'novo',
  'Georreferenciamento rural - Fazenda Itapemirim, Floresta/PE',
  NULL,
  'URGENTE. Solicitação recebida 11/04/2026. 3 pessoas em cópia: Mateus, Sérgio, Marcelle. Domínio nassau.com.br.',
  NULL,
  'Floresta/PE',
  'email_direto',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1)
);

-- 4. SESI/PE - Sistema FIEPE — Cotação serviços topográficos
INSERT INTO leads (
  name,
  company,
  source,
  status,
  servico,
  valor,
  origin
) VALUES (
  'SESI/PE - Sistema FIEPE',
  'SESI/PE - Sistema FIEPE',
  'site',
  'novo',
  'Cotação de serviços topográficos',
  NULL,
  'site'
);

-- 5. Everest Engenharia — Cotação
INSERT INTO leads (
  name,
  company,
  source,
  status,
  servico,
  valor,
  origin,
  responsible_id
) VALUES (
  'Everest Engenharia',
  'Everest Engenharia',
  'email',
  'novo',
  'Cotação solicitada',
  NULL,
  'email_direto',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1)
);

-- ============================================================
-- VERIFICAÇÃO (rodar depois dos INSERTs):
-- ============================================================
-- SELECT id, name, company, status, source, servico, created_at
-- FROM leads
-- WHERE company IN (
--   'EBP Brasil',
--   'Engexpor / Shopping Recife',
--   'Nassau (Grupo)',
--   'SESI/PE - Sistema FIEPE',
--   'Everest Engenharia'
-- )
-- ORDER BY created_at DESC;
