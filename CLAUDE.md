# SISTEMA AG — ARQUIVO CONSOLIDADO v11
**Supabase:** bphgtvwgsgaqaxmkrtqj
**Lovable:** e5b79b44-8865-4599-b013-f3e91865a8f0
**GitHub:** aryanna-max/ag-central-hub
**Data:** 21/04/2026 (v11 — inclui regra `as any` como criterio de fechamento de fase)
**Referencia:** types.ts (fonte de verdade) + `AG Topografia - Central/ARQUITETURA_SISTEMA_V2_15ABR2026.html`

> **Este arquivo substitui o v10.**
> v11 (21/04): corrige schema `projects` (3 colunas `responsible_*` no lugar de `responsible_id`), remove `useLeadConversion` da lista de hooks ativos (codigo morto), adiciona regra de fechamento de fase baseada em `as any` (secao nova).
> v10 (15/04): audit real do codigo (38 tabelas, 22 hooks), modelo operacional das planilhas (RDF, Caixa, beneficios, encontro de contas), compliance documental, processos BPMN por cargo, gap analysis.
> **Arquitetura completa:** `AG Topografia - Central/ARQUITETURA_SISTEMA_V2_15ABR2026.html` (documento definitivo)
> **Prompt Cowork:** `AG Topografia - Central/PROMPT_COWORK_AG.md`
> Para prompts Lovable: usar `AG Topografia - Central/PROMPTS_LOVABLE.md`

---

## ESTADO ATUAL DO SISTEMA (15/04/2026)

### Audit real do codigo (38 tabelas, 22 hooks, 12+ paginas)

| Modulo | % | O que funciona |
|---|---|---|
| **Negocios** | 95% | Leads kanban+lista+CRUD+conversao, Propostas workflow completo, Clientes diretorio+contatos, Mobile |
| **Campo** | 75% | Dashboard KPIs, Escala diaria+mensal, Despesas workflow aprovacao, Medicoes, Veiculos+diarias auto, Equipes, Ferias auto-sync, Mapa, Mobile |
| **Prancheta** | 90% | Kanban execution_status, Equipe+carga, Minhas Tarefas, Alertas, Detalhe projeto+scope items, NUNCA ve financeiro |
| **Faturamento** | 85% | Dashboard 5 abas (Alertas/A Receber/Medicoes/Pipeline/Relatorios), billing_type badges, modal Entregue |
| **Projetos** | 95% | Kanban 8+ colunas drag-drop, Dashboard analitico, Historico, DeadlineBadge |
| **Pessoas** | 40% | Funcionarios CRUD+CSV, Ferias auto-sync, Ausencias. Docs/compliance/beneficios NAO existem |
| **Radar** | 90% | KPIs, top 5 alertas, kanban resumido, visibilidade por role, mobile |
| **Base** | 90% | Usuarios, cadastros, configuracoes, historico cliente |
| **Infra** | 100% | Alertas CRUD+badges+painel, Email queue+log, Auth+roles, Sidebar colapsavel, trigger fn_on_status_change, views, CEP, CSV, mobile |

### Gaps criticos (impedem operacao real)

| # | Gap | Impacto |
|---|---|---|
| G1 | Escala nao gera RDF/beneficios ao fechar | Ger.Op. preenche 7 planilhas em paralelo ao sistema |
| G2 | project_benefits existe mas sem frontend | Nao sabe qual projeto paga cafe/almoco dif/jantar |
| G3 | Docs funcionarios nao rastreados | ASO vencido = barrado no cliente |
| G4 | Compliance mensal sem calendario | Se Alcione faltar, ninguem sabe o que enviar |
| G5 | Integracoes func-cliente nao rastreadas | Equipe barrada na obra |

### O que foi executado (prompts Lovable)
| Item | Status |
|---|---|
| Schema v3 + Fases 0-5 | ✅ |
| Enums (6/6) | ✅ |
| billing_type em projects | ✅ |
| Trigger fn_on_status_change | ✅ |
| Indices + RLS + updated_at (R1-R4) | ✅ |
| execution_status dos 77 projetos | ✅ |
| Prompts F1 a F5 + F-MENU + F4-REV | ✅ |
| Propostas refatorada + CadastrosBase | ✅ |
| F-FIN (Faturamento 5 abas) | ✅ (codigo existe, ~2.898 linhas) |

### Fila de execucao (atualizada 15/04 — baseada em gaps)
| Fase | O que faz | Gaps | Prioridade | Status |
|---|---|---|---|---|
| **1 — Escala→Beneficios→RDF** | UI project_benefits + auto-gerar employee_daily_records ao fechar + conectar despesas | G1, G2 | 🔴 URGENTE | Nao iniciado |
| **2 — Compliance** | employee_documents + client_doc_requirements + integracoes + compliance_tasks + alertas + badge escala | G3, G4, G5 | 🔴 URGENTE | Nao iniciado |
| **3 — Pessoas completo** | Caixa semanal com encontro de contas + descontos mensais (Alelo+VT) + admissao/desligamento | G7, G8 | 🟡 ALTO | Nao iniciado |
| **4 — Arq. Comercial** | Proposta→OS→Projeto + tipos proposta + descontos + FD | G6 | 🟡 ALTO | SQL-A1 a A5 escritos |
| **5 — Email Financeiro** | Email auto Alcione ao entregar | G9 | 🔵 MEDIO | — |
| **6 — Contas a Pagar** | Modulo novo conforme BPMN | G10 | 🔵 MEDIO | — |
| **7-9** | Almoxarifado, Qualidade+Marketing, Radar mobile | G11-G16 | ⚪ BAIXO | — |

---

## MODELO OPERACIONAL REAL (das planilhas — mapeado 15/04)

### RDF — Peca central
49 abas (1/funcionario). Dia a dia: OBRA + CAFE + ALMOCO + JANTA + VT + CARRO + FD. Totais + recebido + saldo.
Conecta: escala (quem foi onde) → beneficios (o que recebeu) → folha semanal (o que foi pago).
**No sistema:** project_benefits EXISTE mas nada gera registros diarios. Precisa: employee_daily_records auto ao fechar escala.

### Caixa (Folha Semanal)
~4 folhas/mes (29 em 2026). Beneficios de funcionarios SAO custos do projeto. Nao separar.
**No sistema:** field_expense_sheets funciona mas desconectado da escala.

### Beneficios

| Beneficio | Frequencia | Natureza | Desconto falta | Tabela |
|---|---|---|---|---|
| Alelo (R$15/dia) | Mensal | Fixo | MENSAL → Thyalcont dia 26 | 🆕 |
| Dif. almoco | Semanal | Adiantamento | SEMANAL → encontro contas | 🔧 project_benefits |
| Cafe | Semanal | Adiantamento | SEMANAL → encontro contas | 🔧 project_benefits |
| Jantar | Semanal | Adiantamento | SEMANAL → encontro contas | 🔧 project_benefits |
| VT (R$4,50/viagem) | Mensal | Fixo | MENSAL → nao creditar campo distante | 🆕 |

### Encontro de contas
- **Semanal** (cafe, almoco dif., jantar): adiantamento → faltou? → desconta proxima folha
- **Mensal** (Alelo, VT): relatorio dia 26 → Thyalcont aplica na folha

### 3 Empresas Emissoras

| Empresa | CNPJ | Banco | Simples | Folha ref. |
|---|---|---|---|---|
| Gonzaga e Berlim | 16.841.054/0001-10 | Bradesco | 22,5% | R$49.564 |
| AG Cartografia | 48.282.440/0001-05 | BB | 16,5% | R$53.481 |
| AG Topografia Avulsa | — | — | — | R$14.723 |
| **Total folha mensal** | | | | **R$103.045** |

---

## COMPLIANCE DOCUMENTAL (mapeado 15/04)

### Calendario mensal Analista DP
| Prazo | Atividade | Clientes |
|---|---|---|
| Dia 10 | Doc mensal CBC, Aeroporto, PDI | CBC, Aeroporto, PDI |
| Dia 15 | Doc mensal BRK (SERTRAS) | BRK |
| Dia 20 | Doc mensal Memorial Star | Memorial Star |
| Dia 20-25 | NF BRK D'Agile Blue (Alldocs) | BRK |
| Dia 26 | Planilha Alelo + VEM + Descontos → Thyalcont | — |
| 5o util | Conferir folha pagamento | — |

### Docs funcionario: ASO (anual), NR-18 (2 anos), NR-35 (2 anos), Ficha EPI, Integracao cliente
### Doc empresa: PCMSO 🔴 VENCIDO 07/2023, PGR verificar, Seguro vida verificar
### BRK e EXCECAO — compliance configuravel por cliente (2 camadas: universal + especifico)

---

## ORGANOGRAMA POR CARGO

| Cargo | Pessoa atual | Role | Processos | Carga |
|---|---|---|---|---|
| Diretor Comercial/Tecnico | Sergio, Ciro | diretor | 5 | OK |
| Diretora Administrativa | Aryanna | master | Todos | Construindo infra |
| Gerente Operacional | Marcelo | operacional | 8 | 🔴 CRITICO |
| Analista RH/DP | Alcione | financeiro | 7 | 🔴 CRITICO |
| Lider Sala Tecnica | Emanuel Macedo | sala_tecnica | 3 | OK |
| Almoxarife | Alexandre (000116) | — | 4 | Subutilizado |

**Regra:** Sistema por CARGO. Funcionalidades atribuidas ao cargo, nao a pessoa.

---

## PROCESSOS BPMN (8 entregues Bizagi + 6 previstos)

**Cadeia de valor:** Comercial → Planejamento → Execucao → Entrega → Faturamento → Pos-Entrega
**Apoio entregues:** Contas a Pagar, Compras, Entrada Material, Saida Material/EPI, Envio Doc Cliente
**Nao mapeados:** Escala Campo (critico), Admissao, Desligamento
**Previstos:** Marketing, Manutencao/Calibracao, Gestao da Qualidade

> Fluxos detalhados de cada processo: ver `ARQUITETURA_SISTEMA_V2_15ABR2026.html` secoes 3 e 4.

---

## ARQUITETURA COMERCIAL — DECISOES 08/04/2026

### Hierarquia
```
Proposta (ANO-P-SEQ) → Ordem de Servico (ANO-SIGLA-OS-SEQ) → Projeto (ANO-SIGLA-SEQ)
```

### Tipos de Proposta
| Tipo | Quando | Codigo |
|---|---|---|
| pontual | Servico unico | ANO-P-SEQ |
| guarda_chuva | Contrato-mae multi-OS | ANO-SIGLA-GC |
| aditivo | Mudanca escopo/prazo/valor | ANO-P-SEQ + proposta_pai_id |
| pedido | Informal/verbal | ANO-P-SEQ |

### 4 Regras (validar com Sergio/Ciro)
1. Todo pedido recebe codigo antes de ir a campo
2. Todo desconto tem rastro (aprovador + motivo + alerta Financeiro)
3. Toda mudanca de escopo/prazo/valor vira Proposta Aditiva
4. Toda entrega exige escopo 100% concluido na Prancheta

### Sala Tecnica guiada por scope_items (NAO tarefas)
- project_scope_items gerados da proposta → checklist de entrega
- technical_tasks = sub-divisao opcional de um scope_item
- Bloqueio "Entregue" se scope_items pendentes

### Sistema de Codigos
| Entidade | Codigo | Ex |
|---|---|---|
| Proposta | ANO-P-SEQ | 2026-P-042 |
| Guarda-Chuva | ANO-SIGLA-GC | 2026-BRK-GC |
| OS | ANO-SIGLA-OS-SEQ | 2026-BRK-OS-001 |
| Projeto | ANO-SIGLA-SEQ | 2026-BRK-003 |
| Folha Despesa | ANO-FD-SEQ | 2026-FD-008 |

---

## SCHEMA — NOMES CORRETOS

> Fonte de verdade: `src/integrations/supabase/types.ts`

### Tabela alerts
```
id, alert_type, title, message, origem_modulo, tipo, recipient (enum), priority (enum),
reference_id, reference_type, action_url, alert_status, read, resolved, resolved_at,
resolved_by, assigned_to, action_label, action_type, scheduled_at, created_at
```

### Tabela projects
```
id, name, codigo, client_id, status (enum), execution_status (enum), billing_type,
empresa_faturadora, cnpj_tomador, tipo_documento, contract_value, conta_bancaria,
referencia_contrato, instrucao_faturamento_variavel, contato_engenheiro, contato_financeiro,
start_date, end_date, delivery_deadline, delivery_days_estimated,
field_started_at, field_completed_at, field_deadline, field_days_estimated,
delivered_at, needs_tech_prep,
responsible_comercial_id, responsible_campo_id, responsible_tecnico_id,
lead_id, parent_project_id,
location, rua, numero, bairro, cidade, estado, cep, latitude, longitude,
service, scope_description, notes, is_active, created_at, updated_at
```

### Enums criticos
| Enum | Valores |
|---|---|
| execution_status | aguardando_campo, em_campo, campo_concluido, aguardando_processamento, em_processamento, revisao, aprovado, entregue, faturamento, pago |
| app_role | master, diretor, operacional, sala_tecnica, comercial, financeiro |
| alert_priority | urgente, importante, informacao |
| alert_recipient | operacional, comercial, financeiro, rh, sala_tecnica, diretoria, todos |
| billing_mode | fixo_mensal, diarias, esporadico |

### 38 tabelas existentes
alerts, calendar_events, client_contacts, clients, daily_schedule_entries, daily_schedules,
daily_team_assignments, email_send_log, email_send_state, employee_project_authorizations,
employee_vacations, employees, field_expense_discounts, field_expense_items, field_expense_sheets,
invoice_items, invoices, lead_interactions, leads, measurements, monthly_schedules, profiles,
project_benefits, project_contacts, project_scope_items, project_services, project_status_history,
projects, proposal_items, proposals, suppressed_emails, system_settings, team_members, teams,
technical_tasks, user_roles, vehicle_payment_history, vehicles

### Tabelas novas necessarias (por prioridade)
**P1:** employee_daily_records, benefit_settlements, monthly_discount_reports
**P2:** employee_documents, company_documents, client_doc_requirements, employee_client_integrations, monthly_compliance_tasks
**P3:** ordens_servico + colunas em proposals (tipo, proposta_pai_id, desconto_*)
**P4:** accounts_payable, fuel_records, overtime_records, purchase_requests, inventory_items, inventory_movements, epi_records

### 21 hooks existentes
useAlerts, useCepAutofill, useClients, useDailySchedule, useEmployees, useExpenseSheets,
useLeads, useMeasurements, useModuleAlertCounts, useMonthlySchedules,
useProjectAuthorizations, useProjectContacts, useProjectServices, useProjects, useProposals,
useScopeItems, useTeams, useTechnicalTasks, useVehicles, use-mobile, use-toast

> `useLeadConversion` existe no filesystem mas e **codigo morto** (nenhum importador).
> Fluxo real de conversao e `LeadConversionDialog.tsx`. Ver PR #9 (doc investigacao cat3).

---

## REGRAS DE NEGOCIO

### Faturamento
| billing_type | Quando fatura | Alerta auto |
|---|---|---|
| entrega_nf | Entregue → alerta imediato | SIM |
| entrega_recibo | Idem, recibo | SIM |
| medicao_mensal | Medicao aprovada | Quando OK |
| sem_documento | Sem alerta | NAO |

### Visibilidade
| Dado | Radar | Negocios | Campo | Prancheta | Faturamento | Pessoas |
|---|---|---|---|---|---|---|
| Valores financeiros | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| NFs e medicoes | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Escalas | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Tarefas tecnicas | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### Filtros padrao
```
Campo: WHERE execution_status IN ('aguardando_campo','em_campo') AND show_in_operational=true AND is_legacy=false
Prancheta: WHERE execution_status IN ('campo_concluido','aguardando_processamento','em_processamento','revisao')
Financeiro: WHERE execution_status IN ('aprovado','entregue','faturamento') OR billing_type='medicao_mensal'
Escalas/despesas: WHERE is_legacy=false (Marco Zero: 31/03/2026)
```

---

## DECISOES ARQUITETURAIS (26 fechadas)

| # | Decisao | Resolucao |
|---|---|---|
| 1 | Subprojetos | NAO existem. Usar project_services |
| 2 | Status duplo | project_status (interno) + execution_status (UI) |
| 3 | Teams | Grupos Rapidos (presets) |
| 4 | Propostas | Dentro do Negocios. ANO-P-SEQ |
| 5 | Custos campo | 1 presenca = 1 custo. Nao ratear |
| 6 | Lead convertido | Snapshot historico |
| 7 | Alcione | Acesso eventual. Email = gatilho. "Enviar p/ Fin." em cada modulo |
| 8 | Marco Zero | 31/03/2026, is_legacy=false |
| 9 | Sidebar | Colapsavel para icones |
| 10 | Projetos sem lead | Tag "Sem lead" |
| 11 | Proposta sem lead | OK se cliente existe |
| 12 | Kanban geral | Absorvido pelo Radar |
| 13 | Ferias na escala | is_vacation_override + aviso |
| 14 | Colunas vazias | Faixa fina com contador |
| 15 | Alertas Campo | Overlay flutuante |
| 16 | Veiculos | Abas internas |
| 17 | NF | Gerada fora, sistema registra |
| 18 | Escala mensal | Opcional, facilitador |
| 19 | Diarias veiculos | Auto ao fechar escala |
| 20 | Aprovacao despesas | Link externo /aprovacao/:token |
| 21 | BRK | EXCECAO. Compliance configuravel por cliente |
| 22 | Cargos | Sistema por cargo, nao pessoa |
| 23 | Scope items | Conceito principal Prancheta |
| 24 | billing_type | Derivado de tipo_servico |
| 25 | Encontro de contas | Semanal (campo) + mensal (Alelo/VT) |
| 26 | Despesas = custos | Beneficios func. SAO custos do projeto |

---

## REGRAS CRITICAS — NAO ERRAR

### Banco de dados
- ❌ NAO existe role `rh_financeiro` — usar `financeiro`
- ❌ NAO existe `campo_pausado` nem `proposta_aprovada` no execution_status
- ✅ SQL: criar migration em supabase/migrations/ + git push, OU gerar SQL para Aryanna colar no SQL Editor do Lovable
- ✅ Codigo projetos: `projects.codigo` (NAO `code`)
- ✅ Alertas: `message`, `recipient`, `reference_id`, `action_url`
- ✅ priority: `urgente | importante | informacao`

### Frontend / Lovable
- ❌ NAO usar nomes pessoais em strings de codigo
- ❌ NAO usar "OBRA" — sempre "PROJETO"
- ❌ NAO criar tabela clientes por modulo — `clients` e fonte unica
- ✅ Uma secao por vez no Lovable, confirmar antes de avancar

---

## REGRA — `as any` E FECHAMENTO DE FASE

> **Diagnostico 21/04/2026:** 286 `as any` em 71 arquivos. Cada um e sintoma
> de decisao arquitetural nao fechada ou de tipagem empurrada pro futuro.
> Mapa completo no PR #9 (`docs/investigacao-bugs-cat3-20260421.md`).

### Regra de aceitacao

Uma fase (1, 2, 3, 4, 5) so e considerada **fechada** quando zera os `as any`
dos arquivos tocados na fase.

Checklist obrigatorio em cada PR de fase:

```
- [ ] Feature funciona
- [ ] Build passa
- [ ] grep -n "as any" src/<territorio_da_fase>/ == 0
```

### Territorios por fase (estimativa)

| Fase | Arquivos principais | `as any` | Observacao |
|---|---|---|---|
| 1 — Escala→Beneficios→RDF | EscalaDiaria, EmployeeAvailabilityKanban, MonthlyCalendarGrid, PlanningReportsTab, RDFDigital, useBenefitSettlements, useDailySchedule | ~35 | Decidir `attendance` table + `responsible_campo_id` |
| 2 — Compliance | useEmployeeDocuments, useComplianceTasks, Compliance.tsx, useEmployees | ~30 | Maioria e falso-positivo (tabelas existem em types.ts) |
| 3 — Pessoas completo | Funcionarios.tsx, useBenefitSettlements | ~20 | Admissao/desligamento reescreve. `vt_*` dissolve naturalmente |
| 4 — Arq. Comercial | Projetos.tsx, LeadConversionDialog, Leads, Propostas, ClientFormDialog, LeadFormDialog, useLeads | ~60 | Maior bolsa. Projetos.tsx sozinho tem 27 |
| 5 — Email Financeiro | AprovacaoExterna.tsx | ~5 | Bug `enqueue_email` dissolve quando fase acontece |

**Subtotal:** ~150 (52%) morrem como efeito colateral das fases.

### O que sobra (~136 casts)

Polimento puro — joins do Supabase (useMeasurements, VehicleReportsTab) +
arrays literais de enum validos. Nao e arquitetura, so tipagem. Unico sprint
"cosmetico" de fato — deixar para o fim.

### O que NAO fazer

- ❌ Sprint de limpeza de `as any` em paralelo com fases — perde foco da
  arquitetura e o problema volta na proxima migration
- ❌ Remover `as any` sem rodar `npm run build` — muitos quebram tipagem real
- ❌ Fazer tudo num PR so

### O que fazer

- ✅ Cada prompt Lovable de fase cita os `as any` do territorio e pede
  remocao junto com a feature
- ✅ Usar checklist acima como criterio de aceitacao
- ✅ PR que nao zera `as any` do territorio volta pra Lovable

---

## BILLING_TYPE POR CLIENTE

| Cliente | billing_type | Obs |
|---|---|---|
| BRK Obras | medicao_mensal | Medicao propria BRK |
| BRK Projetos | entrega_nf | Pontuais |
| HBR Tabaiares | medicao_mensal | R$18.500/mes |
| HBR demais | entrega_nf | |
| Engeko | medicao_mensal | R$19.500/mes |
| Pernambuco Construtora | medicao_mensal | Porto de Pedra |
| JME | medicao_mensal | Apex |
| Flamboyant | medicao_mensal | NF NUNCA EMITIDA |
| Encar | medicao_mensal | |
| Colgravata/Colarcoverde | medicao_mensal | |
| Colorado demais SPEs | entrega_nf | |
| Polimix | entrega_nf | Maceio e Jaboatao separados |
| Hoteis Salinas (Amarante) | entrega_nf | |
| Direcional + SPEs | entrega_nf | cnpj_tomador = SPE |

---

## SITUACAO OPERACIONAL — 15/04/2026

### Alertas criticos
| # | Alerta | Responsavel |
|---|---|---|
| 🔴 | BRK R$168.279 vencido 06/04 | Sergio/Alcione |
| 🔴 | Engeko R$18.525 vence 18/04 | Alcione |
| 🔴 | Daniel Alves saiu AG Cartografia | Sergio/Ciro |
| 🔴 | NR-18 BRK: Jefferson, Richard, Rodrigo — renovar | Alcione/Marcelo |
| 🔴 | PCMSO vencido desde 07/2023 | Aryanna |
| 🟡 | Rescisao Marcelo Lisias — R$16.438 pago 14/04 | Sergio |
| 🟡 | Flamboyant R$24.199 vencido — NF nunca emitida | Alcione |
| 🟡 | HBR R$78k vencido | Sergio/Alcione |
| 🟡 | Faturamento abril NAO iniciado (copia do marco) | Marcelo/Alcione |
| 🟡 | A receber total vencido: R$386.273 | Diretoria |

### Resumo financeiro
| Indicador | Valor |
|---|---|
| Receita Q1/2026 | R$715.563 |
| Faturamento marco | R$322.866 |
| A receber vencido | R$386.273 (30 registros) |
| Folha mensal | R$103.045 |
| Base recorrente | ~R$280-320k/mes |

---

## DECISOES PENDENTES

| # | Decisao | Responsavel | Status |
|---|---|---|---|
| 2 | Confirmar contratante Grupo Amarante | Sergio | ⏳ |
| 3 | billing_type Simproja | Aryanna+Sergio | ⏳ |
| 7 | Marcos Aldeia: NF retroativa (risco fiscal) | Alcione | 🔴 |
| 8 | Colarcoverde: CNPJ tomador | Sergio | ⏳ |
| 10 | Shopping: cobrar a quem? | Sergio | 🟡 |
| 11 | Daniel Alves: impacto Flamboyant | Sergio/Ciro | 🟡 |
| 12 | Substituir Marcelo Lisias | Sergio/Marcelo | 🟡 |
| 14 | Bom Jardim: obra ativa sem projeto | Marcelo/Aryanna | ⏳ |

---

## ARQUIVOS DE REFERENCIA

| Arquivo | Usar para |
|---|---|
| `AG Topografia - Central/ARQUITETURA_SISTEMA_V2_15ABR2026.html` | **DOCUMENTO DEFINITIVO** — processos BPMN detalhados, audit codigo, modelo operacional, compliance, schema, gaps, fases |
| `AG Topografia - Central/PROMPT_COWORK_AG.md` | Prompt para sessoes Cowork/Claude.ai |
| `ag-central-hub/src/integrations/supabase/types.ts` | Fonte de verdade do schema |
| `REVISAO/ESTADO_ATUAL.md` | Referencia rapida para novos chats |
| `REVISAO/PROMPTS_LOVABLE.md` | Texto completo prompts F-MENU a F6 |
| `_HTML/ARQUITETURA_COMERCIAL_AG.html` | Proposta→OS→Projeto + SQL-A1 a A5 |
| `ARQUIVOS MARCELO/04-ABRIL .2026/` | Caixa, RDF, Escala, Medicao, Abastecimento, HE, Faturamento |
| `ARQUIVOS ALCIONE/11.DP/` | Alelo, VEM, Descontos, Folha, Atividades, Funcionarios por contrato |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              