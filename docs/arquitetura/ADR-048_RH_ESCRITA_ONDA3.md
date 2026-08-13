# ADR-048 — Ferramentas MCP de escrita de RH (Onda 3)

> **Renumerado em 11/08/2026: era ADR-045.** O número 045 estava em dois documentos do mesmo dia
> e ficou com `ADR-045_MCP_CADASTRO.md`, que já virou schema (commit `fa9d9d9`, PR #47).
> Conteúdo inalterado. A **Decisão #65** continua sendo deste ADR.

**Data:** 11/08/2026
**Autor:** Arquiteto (Cowork) — **RASCUNHO**
**Status:** 🟡 **RASCUNHO — aguarda a captura** (`CAPTURA_RH_ANTES_DA_SAIDA.md`). As regras de negócio de cada ferramenta **não estão preenchidas de propósito**: elas moram na operação real da pessoa de RH, e inventá-las violaria o princípio da casa. Este documento é o esqueleto da decisão; a captura o completa.
**Gera a decisão:** #65 (a registrar em `_DECISOES_FECHADAS.md`) — *incluir o agente RH e habilitar escrita de RH*.
**Depende de:** ADR-042 (padrão CQRS/engine — toda escrita entra por função SQL nomeada `SECURITY INVOKER` sob RLS), Decisão #55 (FK sempre vence texto livre), Decisão #61 (usuário OAuth por agente, papel mínimo), `WORKLIST_USUARIOS_OAUTH_AGENTES.md` §0 (papel `rh`), `CAPTURA_RH_ANTES_DA_SAIDA.md`.
**Motivo de existir agora:** a pessoa que acumula duas funções de RH está de saída; o objetivo do sistema (rastrear, não perder conhecimento entre setores) exige capturar e sistematizar antes que o conhecimento saia com ela.

---

## PARTE A — DECISÃO E RACIONAL

### 1. Frase de síntese
**A escrita de RH que o agente faz entra por funções SQL nomeadas com a regra da casa dentro; a ferramenta MCP é a porta.** Mesmo princípio do ADR-042. RH não abre exceção: folha, benefício, escala e documento têm política — não são CRUD que o agente faz sozinho.

### 2. Superfície real de RH já no schema (não inventar tabela)
| Domínio | Tabelas existentes | Hook |
|---|---|---|
| Funcionário | `employees`, `employee_dependents`, `employee_documents`, `employee_project_authorizations`, `employee_client_integrations` | `useEmployees`, `useEmployeeDocuments`, `useEmployeeDependents` |
| Folha | `payroll_periods` | `usePayrollPeriods` |
| Benefícios | `benefit_settlements`, `project_benefits` | `useBenefitSettlements` |
| Escala | `daily_schedules`, `monthly_schedules`, `daily_schedule_entries`, `employee_daily_records` | `useEmployeeDailyRecords` |
| Férias/ausência | `employee_vacations` | — |
| Compliance/ASO | `monthly_compliance_tasks`, `compliance_task_executions`, `company_documents` + `employee_documents` (tipos `aso`,`pcmso`,`pgr`,`nr*`) | `useComplianceTasks`, `useComplianceSummary` |
| Cargos | `job_roles` | — |

> Nenhuma tabela nova é assumida aqui. A modelagem definitiva sai da captura (pode revelar que algo hoje em planilha precisa virar tabela — aí sim, com decisão própria).

### 3. Candidatas a ferramenta — gate Engine vs. CRUD (a PREENCHER com a captura)
Cada candidata só vira ferramenta depois que a captura definir a regra. Classificação preliminar:

| Candidata | Tabela-alvo | Classificação prelim. | Regra que a captura precisa dar |
|---|---|---|---|
| `close_payroll_period` (fechar folha do mês) | `payroll_periods` | **ENGINE** | Quais rubricas, de onde vêm, o que trava o fechamento, quem aprova |
| `settle_benefits` (acerto de benefício do período) | `benefit_settlements` | **ENGINE** | Cálculo previsto × realizado; como escala/dias viram valor; Alelo/VEM |
| `register_absence` / `register_vacation` | `employee_vacations` | **ENGINE** | O que a ausência dispara em folha/escala/benefício |
| `register_employee_document` (ASO, NR, etc.) | `employee_documents` | **ENGINE-lite** | Validade, cliente que exige, o que "vencendo" significa por cliente |
| `admit_employee` | `employees` + docs | **ENGINE** | Passos obrigatórios, ASO admissional, portais, prazos legais |
| `terminate_employee` | `employees` | **ENGINE** | Rescisão, exame demissional, baixa em portais, prazos com multa |
| `fill_schedule_day` | `daily_schedule_entries` | **verificar** | Já existe `fn_preencher_escala_dia` — avaliar reuso antes de criar |

**Nenhuma classificada como CRUD puro à primeira vista** — coerente com o ADR-042: escrita que agente faz sozinho é escrita com regra. Confirmar caso a caso após a captura.

### 4. RLS e papel (liga com a Decisão #61 e o worklist §0)
- O papel `rh` (criado no `WORKLIST_USUARIOS_OAUTH_AGENTES.md` §0) é o papel mínimo do agente. Hoje ele não tem política de escrita em nenhuma tabela de RH — **correto**: a permissão sobe **junto** com cada ferramenta, tabela por tabela, com política explícita `master, diretor, rh` (ou o que a captura indicar).
- Funções `SECURITY INVOKER`, como no ADR-042. Agente sem papel é recusado pelo banco.
- **`employees` é o dado-sujeito de RH, não os agentes.** Os agentes continuam fora de `employees` (Princípio #7); o agente RH *escreve sobre* funcionários, não *é* funcionário.

### 5. Perguntas a decidir (uma de cada vez, depois da captura)
1. A folha é **fechamento** (uma função que consolida o mês) ou **entrada rubrica a rubrica**? Muda toda a forma de `close_payroll_period`.
2. Benefício é calculado pelo sistema a partir da escala, ou registrado como valor já apurado fora? Define se `settle_benefits` é engine de cálculo ou de registro.
3. Admissão/desligamento entram como **uma** ferramenta multi-passo cada, ou como vários eventos pequenos? (Preferência inicial: uma função por evento de negócio, como `create_titulo`.)
4. ASO/compliance: o agente **registra** o documento e o sistema deriva "vencendo/vencido", ou o agente também **resolve alerta** de vencimento? (Liga com `resolve_alert` já existente + papel `rh`.)
5. O que **fica de fora** da Onda 3 por ser julgamento humano puro (§4 da captura)?

### 6. Fora do escopo
- Não implementar nada antes da captura. Este ADR não autoriza migration ainda.
- Sala Técnica e Documentação seguem sem agente (fora desta onda).

### 7. Critério de pronto
Igual ao ADR-042: cada ferramenta de RH só é "entregue" quando o agente RH a usa em produção por 2 semanas sem correção manual — e quando o que a pessoa que saiu fazia à mão está de fato no sistema, não numa planilha herdada.

---

## PARTE B — IMPLEMENTAÇÃO
*(vazia — preencher após a captura e a decisão das 5 perguntas da §5, no mesmo formato do ADR-042 Parte B: migration única `timestamp_uuid.sql`, funções `SECURITY INVOKER`, ferramentas em `src/lib/mcp/tools/`, checklist de aceite.)*
