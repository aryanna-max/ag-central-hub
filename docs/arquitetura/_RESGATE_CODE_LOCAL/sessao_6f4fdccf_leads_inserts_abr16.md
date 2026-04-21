# Sessão 6f4fdccf — Leads novos + inserts + Fase 1/1.5 (16/04/2026)

**Classificação:** 🔴 Rica (1074 linhas, decisões de negócio consolidadas)
**Origem:** `C--Users-aryan-Documents-Claude-Projects-Sistema-AG/6f4fdccf-9169-4ae5-b34b-438c2579bd30.jsonl`
**Nota de omissão:** emails e telefones de contatos de leads foram [OMITIDO] neste resgate.

---

## Decisões

### Enums e nomenclatura
- `lead_source` **não aceita** `email_direto` — usar `email`; `email_direto` vai como texto livre no campo `origin`.
- Trigger correta: `public.update_updated_at_column()`. **`set_updated_at()` não existe** no banco (erro vivido ao rodar migration de `benefit_settlements`).
- `execution_status` segue ordem: `aguardando_campo → em_campo → campo_concluido → aguardando_processamento → em_processamento → revisao → aprovado → entregue → faturamento → pago → arquivado`.
- Fonte de verdade quando arquitetura diverge: **código do repositório** (migrations + `types.ts`), não documentos HTML/MD.

### Regras de benefícios — DOIS FLUXOS SEPARADOS
| Benefício | Frequência | Dono | Destino |
|---|---|---|---|
| Café / Almoço Dif. / Jantar | Semanal | Gerente Operacional | Encontro de Contas → desconto auto na folha |
| Alelo / VT | Mensal | Analista DP | Relatório dia 26 → Thyalcont |

### Transporte — regras definitivas
- Padrão é definido pelo **Analista DP (RH)**, não por Marcelo.
- 3 tipos por funcionário: `vt_cartao` (desconto 6% salário) | `dinheiro` (semanal) | `nenhum`.
- Transporte em dinheiro na folha é **sempre vinculado a um projeto** (custo do projeto).
- Subtipo dinheiro: `integral` (substitui VT naquele dia — não conta no mensal) vs `complemento` (VT usado + extra).
- Valores em `system_settings`: `vt_valor_viagem` (4,50), `vt_viagens_por_dia` (2), `vt_desconto_percentual` (6), `alelo_valor_dia` (15,00).

### Encontro de Contas → Folha (D2 — automático)
- Fechar semana gera `field_expense_items` negativos idempotentes na folha vigente.
- `benefit_settlements.sheet_id` ancora rastreabilidade.
- Desconto aparece como linha vermelha read-only na folha, com badge "DESCONTO", sem botão Pagar/Estornar.
- Observação no relatório: *"Desconto encontro de contas — semana DD/MM a DD/MM: R$XX,XX"*.

### Fase 2 Compliance — ordem decidida (D3)
1. `employee_documents` (ASO/NR-18/NR-35) → NR-18 BRK vencido = risco imediato.
2. Badge na escala.
3. `company_documents` (PCMSO vencido 07/2023, PGR, seguro vida).
4. `client_doc_requirements` + `employee_client_integrations`.
5. `monthly_compliance_tasks`.

### Estrutura UI
- Encontro de Contas foi colocado como **aba dentro de Despesas de Campo** (não item separado na sidebar). 3 abas: Despesas / Relatórios / Encontro de Contas.
- RDF Digital virou página própria em `/operacional/rdf`.

### Confirmações de negócio do WhatsApp audit
- UFV Paudalho = Kroma Engenharia (UUID `97fb4989`).
- Marcos Aldeia/BELART "Pix 30% sem NF" → risco fiscal registrado em `notes` com status `pago`.
- Flamboyant: última NF, próxima só em julho se Daniel voltar.

---

## Raciocínios

- **Acesso real com anon key**: REST API permitiu INSERTs/UPDATEs em `leads` e `projects` mesmo sem service_role (RLS permissiva). DDL ficou bloqueado — dependeu da Aryanna colar no SQL Editor.
- **Chrome MCP inviável**: "Grouping is not supported" + computer-use deu Chrome em read-only tier. Fallback: pedir Aryanna clicar "Run anyway".
- **SQL_S1_FASE1_CORRIGIDO.sql (raiz) usa schema errado** (`date`, `cafe_enabled`, `source`, `total_beneficios`). Tabela real já existe via migration `20260415190000` com schema correto (`schedule_date`, `cafe_provided`, `almoco_dif_provided`, `vt_provided`...). **NÃO executar esse SQL.**
- **Documentos de arquitetura divergem do código** — Cowork vs Claude Chat: código ganha.

---

## Bugs corrigidos

1. **`useDailySchedule.ts:241` early return** — `if (!assignments?.length) return` impedia geração de `employee_daily_records` quando escala não tinha veículos. Fix: envolver bloco de veículos em `if (assignments?.length) { ... }` sem return; geração de registros diários segue independente.
2. **`EscalaDiaria.tsx:95`** — query `(supabase.from as any)("attendance")` numa tabela que não existe mais. Gera erro de console; funcionalidade não quebra. Cosmético.

## Bugs identificados e não corrigidos

- `vt_provided = true` hardcoded em `useDailySchedule.ts` para todo funcionário presente (ignora `transporte_tipo`).
- `vt_value: 4.50` hardcoded.
- Falta campo `transporte_tipo` em `employees`.
- Falta campo `subtipo` em `field_expense_items`.
- Faltam 4 keys VT/Alelo em `system_settings`.

---

## Pendências entregues ao fim da sessão

- **Fase 1**: ✅ concluída (escala → benefícios → RDF).
- **Fase 1.5**: ✅ concluída (Encontro de Contas → Folha automático, commit `70f4d84`).
- **Fase 2** (Compliance Docs): próxima, 🔴 URGENTE.
- **Fase 3** (Pessoas Completo): tabelas pendentes (`monthly_discount_reports`, enum `transporte_tipo`, fluxos admissão/desligamento).
- Repositório sincronizado após pull de `a22c018` (Cowork entregou módulo Medições).
- Patch `PATCH_CLEANUP_ORFAOS.patch` aplicado (commit `8e2645e`).

---

## Arquivos tocados / criados

- `supabase/migrations/20260415190000_create_employee_daily_records.sql`
- `supabase/migrations/20260415200000_create_benefit_settlements.sql`
- `src/integrations/supabase/types.ts` (append manual de `benefit_settlements` antes do gen types)
- `src/hooks/useDailySchedule.ts` (fix early return)
- `src/hooks/useBenefitSettlements.ts` (5 funções; `useCloseWeekSettlements` expandido para gerar desconto)
- `src/pages/operacional/RDFDigital.tsx` (novo)
- `src/pages/operacional/EncontroDeContas.tsx` (novo → aba em Despesas de Campo)
- `src/pages/operacional/DespesasDeCampo.tsx` (3 abas; linha read-only desconto)
- `src/pages/Operacional.tsx` (rota `/operacional/rdf`, remoção rota Encontro)
- `src/components/AppSidebar.tsx` (RDF Digital; remoção item Encontro)
- `SQL_INSERT_NOVOS_LEADS_ABRIL2026.sql` (5 leads — PII [OMITIDO])
- `SQL_UPDATE_STATUS_PROJETOS_ABRIL2026.sql` (4 blocos: verificação, UPDATEs, normalizações, pós-check)
- `AG Topografia - Central/ESTADO_ATUAL.md` (handoff Cowork)

---

## Trechos relevantes

> "TUDO RELACIONADO A VT É COM RH E NAO COM MARCELO" — define a divisão de responsabilidades: RH dono, Campo só consome.

> "PARA DEPOSITOS QUE SAO FEITOS SEMANALMENTE O ENCONTRO DE CONTAS É SEMANAL, PARA OS BENEFICIOS QUE SAO FEITOS MENSALMENTE, O DESCONTO É MENSAL" — separa os dois fluxos canônicos.

> "ESSAS QUESTOES DA FOLHA SEMANAL ESTAO SEMPRE RELACIONADAS A PROJETOS. O PADRAO DE TRANSPORTE É DEFINIDO COM ALCIONE." — consolida: custo em dinheiro = custo de projeto; padrão = RH.

> "a fonte de verdade é sempre o repositório (`supabase/migrations/` + `types.ts`). Os documentos de arquitetura podem ter nomes divergentes — quando houver conflito, o código ganha."

## Leads inseridos (dados mascarados)

1. EBP Brasil — Pedro Casagrande — Cabo de Santo Agostinho, proposta_enviada — [email OMITIDO]
2. Engexpor / Shopping Recife — Marilia Muniz — [emails OMITIDO]
3. Nassau Grupo — Maria Carvalho — Fazenda Itapemirim, Floresta/PE — URGENTE
4. SESI/PE – Sistema FIEPE — site
5. Everest Engenharia — email_direto

## Renames de leads (auditoria)

- `GRAN ALPES DESENVOLVIMENTO IMOBILIÁRIOS` → `Contato Gran Alpes (não identificado)`
- `ATEPE` → `Fellipe Brandão` (inferido do email)
- `Amigo Nelson Lima` → `Lead via Nelson Lima`
- `ENG. FELIPE PETERMAN` → `Eng. Felipe Petermann`
- `KROMA ENGENHARIA LTDA` → `Kroma Engenharia - UFV Paudalho`
