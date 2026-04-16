# ESTADO ATUAL DO SISTEMA AG — 16/04/2026

**Referência rápida para novos chats**
Última atualização: 16/04/2026
Fonte de verdade: `src/integrations/supabase/types.ts`

---

## NÚMEROS ATUAIS

| Métrica | Valor |
|---|---|
| Tabelas no banco | 44 (38 originais + 6 novas) |
| Hooks React | 26 |
| Páginas totais | ~40+ |
| Migrations SQL | 58 |
| Módulos ativos | 9 (Radar, Negócios, Campo, Prancheta, Faturamento, Projetos, Pessoas, Admin, Infra) |

---

## STATUS POR MÓDULO (16/04/2026)

| Módulo | % | O que funciona | Mudanças desde v10 |
|---|---|---|---|
| **Negócios** | 95% | Leads kanban+lista+CRUD+conversão, Propostas workflow completo, Clientes diretório+contatos, Mobile | — |
| **Campo** | 90% | Dashboard KPIs, Escala diária+mensal, Despesas workflow aprovação, **Medições reconstruído (2 abas + 3 tipos boletim + PDF)**, RDF Digital, Encontro de Contas, Veículos+diárias auto, Equipes, Férias auto-sync | **+15%** — Medições, RDF Digital, Encontro de Contas |
| **Prancheta** | 90% | Kanban execution_status, Equipe+carga, Minhas Tarefas, Alertas, Detalhe projeto+scope items, NUNCA vê financeiro | — |
| **Faturamento** | 85% | Dashboard 5 abas (Alertas/A Receber/Medições/Pipeline/Relatórios), billing_type badges, modal Entregue | — |
| **Projetos** | 95% | Kanban 8+ colunas drag-drop, Dashboard analítico, Histórico, DeadlineBadge, **Benefícios de campo no detalhe** | +Benefícios |
| **Pessoas** | 40% | Funcionários CRUD+CSV, Férias auto-sync, Ausências. Docs/compliance/benefícios NÃO existem | — |
| **Radar** | 90% | KPIs, top 5 alertas, kanban resumido, visibilidade por role, mobile | — |
| **Base** | 90% | Usuários, cadastros, configurações, histórico cliente | — |
| **Infra** | 100% | Alertas CRUD+badges+painel, Email queue+log, Auth+roles, Sidebar colapsável, triggers, views, CEP, CSV, mobile | — |

---

## O QUE FOI CONSTRUÍDO DESDE v10 (15/04 → 16/04)

### Fase 1 — Escala→Benefícios→RDF ✅ CONCLUÍDO
- `employee_daily_records` — tabela + hook + migration (auto-gerado ao fechar escala)
- `project_benefits` — UI no detalhe do projeto (café/almoço dif/jantar/VT por projeto)
- `benefit_settlements` — tabela + hook + migration
- RDF Digital — página completa em `/operacional/rdf`
- Encontro de Contas — aba dentro de Despesas de Campo, reconciliação semanal

### Fase 1.5 — Encontro de Contas automático ✅ CONCLUÍDO
- Encontro de contas gera desconto automático na folha
- Movido para aba dentro de Despesas de Campo

### Medições — Módulo reconstruído ✅ CONCLUÍDO
- **Migration:** `20260416_refactor_measurements.sql` (NÃO executada — Aryanna precisa colar no SQL Editor)
  - measurements: +13 colunas (measurement_type, client_id, proposal_id, invoice_id, measurement_number, avanço, etc.)
  - `measurement_items` — itens do contrato por medição (FK → project_services)
  - `measurement_daily_entries` — grid dias × funcionários (FK → employee_daily_records)
- **Hooks novos/refatorados:**
  - `useMeasurements.ts` — refatorado com `useMeasurementWithItems`, `useCreateMeasurementFromProject`, `useCalculateMeasurementTotals`
  - `useMeasurementItems.ts` — CRUD itens
  - `useMeasurementDailyEntries.ts` — `useFieldControlGrid`, `usePopulateMeasurementDays`
- **Página** `/operacional/medicoes` — 2 abas:
  - **Controle de Campo:** grid calendário (dias × funcionários), resumo valores, PDF
  - **Boletins de Medição:** lista + CRUD, 3 tipos (grid_diarias, boletim_formal, resumo_entrega)
- **PDF:** `MeasurementPDF.tsx` — 3 modelos com cabeçalho AG, assinaturas, empresa faturadora
- **Sidebar:** "Medições" adicionado no módulo Campo com ícone BarChart3
- **Código automático:** AG-BM-{ANO}-{SEQ 3 dígitos}
- **ZERO texto livre:** toda referência é FK (client_id, project_id, proposal_id, project_service_id)

---

## TABELAS NOVAS (desde v10)

| Tabela | Tipo | Fase | Status no banco |
|---|---|---|---|
| employee_daily_records | Registros diários de presença | Fase 1 | ✅ Executada |
| benefit_settlements | Encontro de contas | Fase 1 | ✅ Executada |
| measurement_items | Itens da medição (FK → project_services) | Medições | ⏳ Migration gerada, NÃO executada |
| measurement_daily_entries | Grid dias × funcionários | Medições | ⏳ Migration gerada, NÃO executada |

### Colunas novas em measurements (migration pendente)
`measurement_number`, `measurement_type`, `proposal_id`, `client_id`, `invoice_id`, `approved_by_client`, `approved_at`, `avanco_periodo_pct`, `avanco_acumulado_pct`, `saldo_a_medir`, `requires_signature`

---

## HOOKS (26 total)

### Existentes (desde v10)
useAlerts, useCepAutofill, useClients, useDailySchedule, useEmployees, useExpenseSheets,
useLeadConversion, useLeads, useMeasurements, useModuleAlertCounts, useMonthlySchedules,
useProjectAuthorizations, useProjectContacts, useProjectServices, useProjects, useProposals,
useScopeItems, useTeams, useTechnicalTasks, useVehicles, use-mobile, use-toast

### Novos (pós v10)
useEmployeeDailyRecords, useProjectBenefits, useBenefitSettlements, useMeasurementItems, useMeasurementDailyEntries

---

## FILA DE EXECUÇÃO (atualizada 16/04)

| Fase | O que faz | Gaps | Prioridade | Status |
|---|---|---|---|---|
| **1 — Escala→Benefícios→RDF** | employee_daily_records + project_benefits UI + RDF Digital + Encontro de Contas | G1, G2 | 🔴 URGENTE | ✅ CONCLUÍDO |
| **Medições** | Módulo reconstruído: 3 tipos boletim, rastreabilidade proposta→NF, PDF | — | 🔴 URGENTE | ✅ CONCLUÍDO (migration pendente execução) |
| **2 — Compliance** | employee_documents + client_doc_requirements + integrations + compliance_tasks + alertas + badge escala | G3, G4, G5 | 🔴 URGENTE | Não iniciado |
| **3 — Pessoas completo** | Caixa semanal com encontro de contas + descontos mensais (Alelo+VT) + admissão/desligamento | G7, G8 | 🟡 ALTO | Não iniciado |
| **4 — Arq. Comercial** | Proposta→OS→Projeto + tipos proposta + descontos + FD | G6 | 🟡 ALTO | SQL-A1 a A5 escritos |
| **5 — Email Financeiro** | Email auto Alcione ao entregar | G9 | 🔵 MEDIO | — |
| **6 — Contas a Pagar** | Módulo novo conforme BPMN | G10 | 🔵 MEDIO | — |
| **7-9** | Almoxarifado, Qualidade+Marketing, Radar mobile | G11-G16 | ⚪ BAIXO | — |

---

## GAPS RESTANTES (atualizado 16/04)

| # | Gap | Impacto | Status |
|---|---|---|---|
| G1 | ~~Escala não gera RDF/benefícios ao fechar~~ | ~~Ger.Op. preenche planilhas~~ | ✅ RESOLVIDO — employee_daily_records auto |
| G2 | ~~project_benefits sem frontend~~ | ~~Não sabe benefícios por projeto~~ | ✅ RESOLVIDO — UI no detalhe do projeto |
| G3 | Docs funcionários não rastreados | ASO vencido = barrado no cliente | ❌ ABERTO |
| G4 | Compliance mensal sem calendário | Se Alcione faltar, ninguém sabe o que enviar | ❌ ABERTO |
| G5 | Integrações func-cliente não rastreadas | Equipe barrada na obra | ❌ ABERTO |
| G6 | Proposta→OS→Projeto não implementado | Fluxo comercial manual | ❌ ABERTO (SQL escrito) |
| G7 | Caixa semanal desconectada | Folha feita fora do sistema | ❌ ABERTO |
| G8 | Descontos mensais (Alelo/VT) manuais | Thyalcont recebe planilha dia 26 | ❌ ABERTO |

---

## AÇÕES PENDENTES IMEDIATAS

1. **Aryanna:** Executar migration `20260416_refactor_measurements.sql` no SQL Editor do Supabase
2. **Próxima fase:** Compliance (G3, G4, G5) — employee_documents, client_doc_requirements, calendário DP
3. **Decisões pendentes:** Ver CLAUDE.md seção "DECISÕES PENDENTES" (8 itens)

---

## ARQUIVOS-CHAVE

| Arquivo | Função |
|---|---|
| `src/integrations/supabase/types.ts` | Fonte de verdade do schema (44 tabelas) |
| `CLAUDE.md` | Documento consolidado v10 (regras, decisões, processos) |
| `supabase/migrations/20260416_refactor_measurements.sql` | **PENDENTE EXECUÇÃO** |
| `src/pages/operacional/Medicoes.tsx` | Página principal medições (2 abas) |
| `src/components/operacional/medicoes/` | 5 componentes: ControleCampoTab, BoletinsMedicaoTab, MeasurementCreateDialog, MeasurementViewDialog, MeasurementPDF |
| `src/hooks/useMeasurements.ts` | Hook principal refatorado (7 exports) |
| `src/hooks/useMeasurementItems.ts` | CRUD itens medição |
| `src/hooks/useMeasurementDailyEntries.ts` | Grid campo + popular dias |
