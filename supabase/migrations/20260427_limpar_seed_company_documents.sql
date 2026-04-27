-- Migration corretiva — Princípio P14
--
-- Apaga seed errado da tabela company_documents inserido pela migration
-- 20260416_fase2_compliance.sql (linhas 206-211). Aryanna confirmou em
-- 27/04/2026 que NENHUM desses dados é fato operacional — é seed de
-- demonstração escrito pelo Code, não auditado contra a pasta da Alcione.
--
-- A tabela fica vazia. Alcione preencherá via documento de captura quando
-- o sistema estiver pronto, OU diretamente pela UI de /rh/compliance/empresa
-- (Bloco 2 do ADR-041, futuro /base/governanca).
--
-- Errata: Sistema AG/ARQUITETURA/_ERRATA_PCMSO_27ABR.md
-- Princípio: Sistema AG/ARQUITETURA/_PRINCIPIOS.md (P13 + P14)

BEGIN;

DELETE FROM public.company_documents
WHERE (empresa = 'gonzaga_berlim' AND doc_name IN ('PCMSO', 'PGR', 'Seguro Vida Coletivo'))
   OR (empresa = 'ag_cartografia' AND doc_name IN ('PCMSO', 'PGR'));

COMMIT;
