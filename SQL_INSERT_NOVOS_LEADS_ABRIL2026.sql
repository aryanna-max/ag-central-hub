-- ============================================================
-- SQL_INSERT_NOVOS_LEADS_ABRIL2026.sql
-- Colar no SQL Editor do Lovable (ou Supabase Dashboard)
-- Data: 16/04/2026
-- Origem: Auditoria Rastreamento AG Abril 2026
-- ============================================================

-- VERIFICAR antes de rodar:
-- SELECT name, company FROM leads WHERE company ILIKE ANY(ARRAY['%EBP%','%Nassau%','%Engexpor%','%SESI%','%Everest%']);

-- ── LEAD 1: EBP Brasil ──────────────────────────────────────
INSERT INTO leads (name, company, source, status, origin, servico, notes, responsible_id, created_at)
VALUES (
  'Pedro Casagrande',
  'EBP Brasil',
  'email',
  'proposta_enviada',
  'email_direto',
  'Topografia / Levantamento',
  '[16/04/2026] Lead captado via auditoria. Proposta enviada. Aguardando retorno.',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  NOW()
);

-- ── LEAD 2: Engexpor / Shopping Recife ──────────────────────
INSERT INTO leads (name, company, source, status, origin, servico, notes, responsible_id, created_at)
VALUES (
  'Marilia Muniz',
  'Engexpor / Shopping Recife',
  'indicacao',
  'negociacao',
  NULL,
  'Topografia de Obras',
  '[16/04/2026] Contato: Marilia Muniz. Em negociacao. Verificar proposta com Sergio/Ciro.',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  NOW()
);

-- ── LEAD 3: Nassau Grupo ────────────────────────────────────
INSERT INTO leads (name, company, source, status, origin, servico, notes, responsible_id, created_at)
VALUES (
  'Maria Carvalho',
  'Nassau Grupo',
  'email',
  'proposta_enviada',
  'email_direto',
  'Topografia / Levantamento',
  '[16/04/2026] URGENTE - Proposta enviada, aguarda resposta. Contato: Maria Carvalho.',
  (SELECT id FROM employees WHERE name ILIKE '%Ciro%' LIMIT 1),
  NOW()
);

-- ── LEAD 4: SESI/PE – Sistema FIEPE ────────────────────────
INSERT INTO leads (name, company, source, status, origin, servico, notes, responsible_id, created_at)
VALUES (
  'SESI/PE - Sistema FIEPE',
  'SESI/PE - Sistema FIEPE',
  'prospeccao',
  'prospeccao',
  NULL,
  'Topografia de Obras',
  '[16/04/2026] Prospeccao ativa. Sem contato definido. Acompanhar com diretoria.',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  NOW()
);

-- ── LEAD 5: Everest Engenharia ──────────────────────────────
INSERT INTO leads (name, company, source, status, origin, servico, notes, responsible_id, created_at)
VALUES (
  'Everest Engenharia',
  'Everest Engenharia',
  'prospeccao',
  'prospeccao',
  NULL,
  'Topografia de Obras',
  '[16/04/2026] Prospeccao ativa. Sem contato definido.',
  (SELECT id FROM employees WHERE name ILIKE '%Sergio%Gonzaga%' LIMIT 1),
  NOW()
);

-- ── Verificacao pos-insert ───────────────────────────────────
SELECT name, company, status, source, origin, created_at
FROM leads
WHERE created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
