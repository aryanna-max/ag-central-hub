# DIAGNOSTICO COMPLETO DO SISTEMA AG CENTRAL HUB

**Data:** 03/04/2026
**Versao:** 1.0

---

## SUMARIO EXECUTIVO

| Modulo | Status | Problemas Criticos | Prioridade |
|--------|--------|-------------------|------------|
| Comercial (Leads/Propostas/Clientes) | ⚠️ Parcial | 4 | 1 |
| Operacional (Escala/Veiculos/Equipes) | ⚠️ Parcial | 6 | 1 |
| Sala Tecnica (Projetos/Tarefas) | ⚠️ Parcial | 3 | 2 |
| Financeiro (Medicoes/Faturas) | ⚠️ Parcial | 4 | 2 |
| Projetos (Hub central) | ⚠️ Parcial | 3 | 2 |
| RH (Funcionarios/Ferias) | ⚠️ Parcial | 4 | 2 |
| Dashboard/Diretoria (Radar) | ✅ Funcional | 2 | 3 |
| Admin/Cadastros Base | ⚠️ Parcial | 3 | 3 |

**Total de problemas encontrados:** 29 (10 criticos, 11 importantes, 8 melhorias)

---

## 1. VERIFICACAO DE ROTAS E NAVEGACAO

### 1.1 Mapeamento de Nomes Antigos vs Atuais

| Nome Antigo (Sidebar) | Nome Atual (Rota) | Status da Rota |
|------------------------|-------------------|----------------|
| "Radar" | `/` (Dashboard) | ✅ Funcional |
| "Negocios" | `/comercial/*` | ✅ Funcional |
| "Campo" | `/operacional/*` | ✅ Funcional |
| "Prancheta" | `/sala-tecnica/*` | ✅ Funcional |
| "Faturamento" | `/financeiro/*` | ✅ Funcional |
| "Pessoas" | `/rh/*` | ✅ Funcional |
| "Base" | `/admin/*` | ✅ Funcional |

### 1.2 Labels antigos ainda no codigo (cosmetico, nao quebra nada)

- `AppSidebar.tsx`: Sidebar exibe "Negocios", "Campo", "Prancheta", "Pessoas", "Radar"
- `AppLayout.tsx`: Role labels usam nomes antigos (operacional="Campo", sala_tecnica="Prancheta")
- `Dashboard.tsx`: Grupos kanban chamados "Campo" e "Prancheta"
- `SalaTecnica.tsx`: Titulo da pagina diz "Prancheta"
- `RH.tsx`: Titulo do modulo diz "Pessoas"

### 1.3 Rotas antigas removidas

Nenhuma rota antiga (`/negocios`, `/campo`, `/prancheta`, `/pessoas`, `/radar`) foi encontrada.
Todas as rotas foram migradas corretamente. Nenhum import quebrado detectado.

---

## 2. ESTADO DO SCHEMA (Supabase types.ts)

### 2.1 Tabelas planejadas vs existentes

| Tabela | CLAUDE.md | types.ts | Status |
|--------|-----------|----------|--------|
| project_scope_items | A criar | ✅ Existe | Migrado |
| project_status_history | A criar | ✅ Existe | Migrado |
| technical_tasks | A criar | ✅ Existe | Migrado |
| invoices | A criar | ✅ Existe | Migrado |
| invoice_items | A criar | ✅ Existe | Migrado |
| employee_vacations | A criar | ✅ Existe | Migrado |

### 2.2 Enums planejados vs existentes

| Enum | CLAUDE.md | types.ts | Status |
|------|-----------|----------|--------|
| execution_status | A criar | ✅ 10 valores | Migrado |
| proposal_status | A criar | ✅ 5 valores | Migrado |
| measurement_status | A criar | ✅ 6 valores | Migrado |
| empresa_faturadora_enum | A criar | ✅ 2 valores | Migrado |
| tipo_documento | A criar | ✅ 2 valores | Migrado |
| removal_reason | A criar | ✅ 6 valores | Migrado |
| lead_status | Corrigir | ✅ 8 valores | Inclui proposta_enviada, aprovado, perdido |

**Conclusao:** O schema esta MAIS COMPLETO que o CLAUDE.md previa. Todas as migracoes foram executadas.

---

## 3. DIAGNOSTICO POR MODULO

---

### 3.1 COMERCIAL (Leads / Propostas / Clientes)

**Arquivos:**
- Pages: `pages/comercial/Leads.tsx`, `Propostas.tsx`, `Clientes.tsx`, `LeadFormDialog.tsx`, `LeadDetailDialog.tsx`, `LeadConversionDialog.tsx`, `ClientFormDialog.tsx`, `Oportunidades.tsx`, `OpportunityFormDialog.tsx`
- Hooks: `hooks/useLeads.ts`, `hooks/useProposals.ts`, `hooks/useClients.ts`, `hooks/useOpportunities.ts`

**Tabelas acessadas:** leads, lead_interactions, proposals, proposal_items, clients, client_contacts, opportunities

**FKs usadas corretamente:**
- leads.client_id -> clients.id ✅
- leads.responsible_id -> employees.id ✅
- proposals.client_id -> clients.id ✅
- proposals.lead_id -> leads.id ✅
- leads.converted_project_id -> projects.id ✅

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| C1 | `responsible_id` ausente na interface Proposal do useProposals.ts — campo salvo mas nunca recuperado | Critico | 1 |
| C2 | Lista de servicos duplicada em 4 arquivos (LeadFormDialog, LeadDetailDialog, OpportunityFormDialog, Propostas) — deveria ser constante centralizada | Importante | 2 |
| C3 | Filtro de responsaveis hardcoded por nome ("Sergio"/"Ciro") em 3 locais — fragil, deveria usar role | Importante | 2 |
| C4 | Oportunidades vs Leads: funcionalidade duplicada. Oportunidades usa `responsible` como texto livre, nao FK | Importante | 2 |
| C5 | LeadConversionDialog cria cliente mas NAO salva contato inicial em client_contacts, mesmo coletando nome/telefone/email | Importante | 2 |
| C6 | Proposals query sem filtro de status — mostra todas incluindo expiradas | Melhoria | 3 |
| C7 | Sem logica de expiracao automatica de propostas (validity_days nao verificado) | Melhoria | 3 |
| C8 | loss_reason do lead concatenado no campo notes com prefixo [PERDIDO] — deveria ter campo proprio | Melhoria | 3 |

---

### 3.2 OPERACIONAL (Escala Diaria/Mensal / Veiculos / Equipes)

**Arquivos:**
- Pages: `pages/operacional/EscalaDiaria.tsx`, `EscalaMensal.tsx`, `Equipes.tsx`, `Veiculos.tsx`, `Planejamento.tsx`, `ProjetosEmCampoKanban.tsx`, `DespesasDeCampoTabs.tsx`, `DespesasCampo.tsx`, `Ferias.tsx`, `DiariasVeiculos.tsx`, `Medicoes.tsx`, `Relatorios.tsx`, `DashboardOperacional.tsx`
- Hooks: `hooks/useDailySchedule.ts`, `hooks/useMonthlySchedules.ts`, `hooks/useTeams.ts`, `hooks/useVehicles.ts`, `hooks/useScheduleConfirmations.ts`
- Components: `components/operacional/VehicleEditDialog.tsx`, `VehicleDetailDialog.tsx`, `MonthlyDayEditDialog.tsx`, `MonthlyCalendarGrid.tsx`, `PlanningReportsTab.tsx`, `MonthlyScheduleReport.tsx`, `AbsencesSection.tsx`, `EmployeeAvailabilityBadge.tsx`, `EmployeeAvailabilityKanban.tsx`

**Tabelas acessadas:** daily_schedules, daily_schedule_entries, daily_team_assignments, monthly_schedules, teams, team_members, vehicles, vehicle_payment_history, field_expense_sheets, field_expense_items, employees, projects

**FKs usadas corretamente:**
- team_members.employee_id -> employees.id ✅
- vehicles.responsible_employee_id -> employees.id ✅
- teams.leader_id -> employees.id ✅
- teams.default_vehicle_id -> vehicles.id ✅
- teams.default_project_id -> projects.id ✅
- daily_team_assignments.project_id -> projects.id ✅
- monthly_schedules.project_id -> projects.id ✅

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| O1 | **useDailySchedule.ts SEM filtro is_legacy=false** — mostra dados legado misturados com atuais | Critico | 1 |
| O2 | **useMonthlySchedules.ts SEM filtro is_legacy=false** — mesmo problema | Critico | 1 |
| O3 | **useVehicles.ts SEM filtro de status** — veiculos em manutencao/indisponivel aparecem nos dropdowns de alocacao | Critico | 1 |
| O4 | **EscalaDiaria.tsx L228: fallback team_id usa schedule.id** — type mismatch, deveria rejeitar form | Critico | 1 |
| O5 | EscalaDiaria permite editar escalas fechadas (is_closed) — read-only visual mas sem bloqueio real no state | Importante | 2 |
| O6 | VehicleDetailDialog.tsx consulta daily_team_assignments sem filtro is_legacy | Importante | 2 |
| O7 | EscalaMensal.tsx referencia `s.obras?.name` mas estrutura de dados usa `s.projects` | Importante | 2 |
| O8 | Status do veiculo NAO atualiza para "em_uso" quando alocado a escala | Importante | 2 |
| O9 | Duplicate entry errors silenciados (silent swallow) — deveria notificar usuario | Melhoria | 3 |
| O10 | project_id pode ser NULL em daily_team_assignments — sem validacao antes do insert | Importante | 2 |

---

### 3.3 SALA TECNICA (Kanban / Equipe / Tarefas / Alertas)

**Arquivos:**
- Router: `pages/SalaTecnica.tsx`
- Pages: `pages/salatecnica/STKanban.tsx`, `STEquipe.tsx`, `STMinhasTarefas.tsx`, `STAlertas.tsx`, `STProjectDetail.tsx`
- Hooks: `hooks/useTechnicalTasks.ts`, `hooks/useScopeItems.ts`, `hooks/useAlerts.ts`

**Tabelas acessadas:** projects, project_scope_items, technical_tasks, alerts, employees, profiles, project_status_history

**FKs usadas corretamente:**
- technical_tasks.project_id -> projects.id ✅
- technical_tasks.assigned_to_id -> employees.id ✅
- technical_tasks.scope_item_id -> project_scope_items.id ✅
- project_scope_items.project_id -> projects.id ✅
- project_status_history.project_id -> projects.id ✅

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| ST1 | Entrega de projeto so emite warning quando ha scope items pendentes — deveria BLOQUEAR | Critico | 1 |
| ST2 | Roles tecnicos hardcoded (Cadista, Cartografo, etc.) — deveria vir do banco ou constante centralizada | Importante | 2 |
| ST3 | STProjectDetail nao permite editar responsible_tecnico_id ou responsible_campo_id | Importante | 2 |
| ST4 | STMinhasTarefas nao busca descricao ou prioridade das tarefas | Melhoria | 3 |

---

### 3.4 FINANCEIRO (Dashboard / Medicoes / Projetos / Pipeline / Relatorios)

**Arquivos:**
- Router: `pages/Financeiro.tsx`
- Pages: `pages/financeiro/FinanceiroDashboard.tsx`, `FaturamentoAlertas.tsx`, `FaturamentoMedicoes.tsx`, `FaturamentoProjetos.tsx`, `FaturamentoPipeline.tsx`, `FaturamentoRelatorios.tsx`
- Hooks: `hooks/useMeasurements.ts`, `hooks/useExpenseSheets.ts`

**Tabelas acessadas:** measurements, projects, clients, alerts, field_expense_sheets, field_expense_items, invoices

**FKs usadas corretamente:**
- measurements.project_id -> projects.id ✅
- field_expense_sheets.project_id -> projects.id ✅
- invoices.project_id -> projects.id ✅
- invoice_items.project_service_id -> project_services.id ✅

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| F1 | Medicoes nao validam se project.billing_type == "medicao_mensal" antes de criar | Critico | 1 |
| F2 | Relatorios usam updated_at em vez de nf_data para datas de faturamento — resultados incorretos | Importante | 2 |
| F3 | FaturamentoProjetos mostra status duplo (status + execution_status) sem explicacao clara ao usuario | Importante | 2 |
| F4 | Sem link entre medicoes e invoices — pipeline desconectado | Importante | 2 |

---

### 3.5 PROJETOS (Hub Central)

**Arquivos:**
- Pages: `pages/projetos/ProjetosDashboard.tsx`, `ProjectFormDialog.tsx`, `ProjetoHistorico.tsx`
- Hooks: `hooks/useProjects.ts`, `hooks/useProjectServices.ts`, `hooks/useScopeItems.ts`

**Tabelas acessadas:** projects, project_services, project_scope_items, project_status_history, clients, measurements, alerts

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| P1 | Campo `service` no projeto e texto livre — deveria usar project_services | Importante | 2 |
| P2 | Campos legado (`client` texto, `client_name` texto) coexistem com client_id FK — confusao | Importante | 2 |
| P3 | Geracao de codigo pode ter race condition em criacao simultanea | Melhoria | 3 |

---

### 3.6 RH (Funcionarios / Ferias / Ausencias)

**Arquivos:**
- Router: `pages/RH.tsx`
- Pages: `pages/rh/Funcionarios.tsx`, `RelatorioAusencias.tsx`
- Pages extras: `pages/operacional/Ferias.tsx` (importado pelo RH)
- Hooks: `hooks/useEmployees.ts`

**Tabelas acessadas:** employees, employee_vacations, attendance, profiles

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| RH1 | Tabela `attendance` NAO existe no types.ts — codigo usa `as any` para contornar | Critico | 1 |
| RH2 | Campo `role` do funcionario e texto livre — deveria ser Select com FIELD_ROLES | Importante | 2 |
| RH3 | Status do employee (ferias/licenca) NAO sincroniza com employee_vacations | Importante | 2 |
| RH4 | VT fields (has_vt, vt_value, vt_cash) atualizados em chamada separada — nao atomico | Melhoria | 3 |

---

### 3.7 DASHBOARD / DIRETORIA (Radar)

**Arquivos:**
- Page: `pages/Dashboard.tsx`

**Tabelas acessadas:** projects, clients, alerts

**Status: ✅ Funcional** — Kanban de 10 colunas com execution_status, KPIs, filtros por cliente/prazo/billing_type.

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| D1 | Inconsistencia no campo de alertas: codigo verifica `alert_status="ativo"` mas types.ts define `resolved` boolean | Importante | 2 |
| D2 | Sem visao financeira agregada (receita mensal, despesas por projeto) | Melhoria | 3 |

---

### 3.8 ADMIN / CADASTROS BASE

**Arquivos:**
- Pages: `pages/admin/CadastrosBase.tsx`, `UserManagement.tsx`

**Tabelas acessadas:** profiles, user_roles, system_settings

**PROBLEMAS ENCONTRADOS:**

| # | Problema | Severidade | Prioridade |
|---|---------|-----------|------------|
| A1 | Senha padrao hardcoded "32725203AG" para novos usuarios | Importante | 2 |
| A2 | Sem UI para gerenciar system_settings (tabela existe mas sem pagina admin) | Importante | 2 |
| A3 | Sem funcao de deletar usuario — apenas criacao | Melhoria | 3 |

---

## 4. MAPA DE DEPENDENCIAS ENTRE MODULOS

```
                    ┌─────────────┐
                    │  Dashboard  │
                    │   (Radar)   │
                    └──────┬──────┘
                           │ le projects, clients, alerts
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        v                  v                  v
┌───────────┐    ┌─────────────┐    ┌─────────────┐
│ Comercial │    │ Operacional │    │ Sala Tecnica│
│  (Leads)  │    │  (Escalas)  │    │  (Tarefas)  │
└─────┬─────┘    └──────┬──────┘    └──────┬──────┘
      │                 │                  │
      │ converte        │ aloca            │ processa
      v                 v                  v
┌─────────────────────────────────────────────────┐
│              PROJETOS (Hub Central)              │
│  projects, project_services, project_scope_items │
└─────────────────────┬───────────────────────────┘
                      │
                      v
              ┌───────────────┐
              │  Financeiro   │
              │  (Medicoes)   │
              └───────────────┘

Dependencias transversais:
- TODOS os modulos dependem de: employees (RH), clients (Comercial)
- Operacional depende de: vehicles, teams
- Sala Tecnica depende de: technical_tasks, project_scope_items
- Financeiro depende de: measurements, invoices, field_expense_sheets
```

### Fluxo de dados principal:

```
Lead (Comercial)
  → Proposta (Comercial)
    → Projeto (Projetos)
      → Escala de campo (Operacional)
        → execution_status: em_campo → campo_concluido
          → Tarefas tecnicas (Sala Tecnica)
            → execution_status: em_processamento → aprovado → entregue
              → Medicao/Fatura (Financeiro)
                → execution_status: faturamento → pago
```

---

## 5. LISTA CONSOLIDADA DE PROBLEMAS POR PRIORIDADE

### Prioridade 1 — CRITICO (corrigir imediatamente)

| ID | Modulo | Problema |
|----|--------|---------|
| O1 | Operacional | useDailySchedule.ts sem filtro is_legacy=false |
| O2 | Operacional | useMonthlySchedules.ts sem filtro is_legacy=false |
| O3 | Operacional | useVehicles.ts sem filtro de status — veiculos quebrados nos dropdowns |
| O4 | Operacional | EscalaDiaria.tsx team_id fallback usa schedule.id (type mismatch) |
| C1 | Comercial | responsible_id ausente na interface Proposal — dados perdidos no save |
| F1 | Financeiro | Medicoes criadas sem validar billing_type do projeto |
| ST1 | Sala Tecnica | Entrega de projeto nao bloqueia com scope items pendentes |
| RH1 | RH | Tabela attendance nao existe no types.ts — usa as any |
| O10 | Operacional | project_id pode ser NULL em daily_team_assignments |

### Prioridade 2 — IMPORTANTE (corrigir nesta sprint)

| ID | Modulo | Problema |
|----|--------|---------|
| C2 | Comercial | Lista de servicos duplicada em 4 arquivos |
| C3 | Comercial | Filtro de responsaveis hardcoded por nome |
| C4 | Comercial | Oportunidades vs Leads: funcionalidade duplicada |
| C5 | Comercial | Conversao de lead nao salva contato em client_contacts |
| O5 | Operacional | Escala fechada pode ser editada |
| O6 | Operacional | VehicleDetail sem filtro is_legacy |
| O7 | Operacional | EscalaMensal referencia obras em vez de projects |
| O8 | Operacional | Status veiculo nao atualiza quando alocado |
| ST2 | Sala Tecnica | Roles tecnicos hardcoded |
| ST3 | Sala Tecnica | Sem edicao de responsible_tecnico/campo no detalhe |
| F2 | Financeiro | Relatorios usam updated_at em vez de nf_data |
| F3 | Financeiro | Status duplo confuso para usuario |
| F4 | Financeiro | Pipeline medicoes-invoices desconectado |
| P1 | Projetos | Campo service e texto livre |
| P2 | Projetos | Campos legado coexistem com FKs |
| RH2 | RH | Role de funcionario e texto livre |
| RH3 | RH | Status employee nao sincroniza com vacations |
| D1 | Dashboard | Alerts: alert_status vs resolved inconsistente |
| A1 | Admin | Senha padrao hardcoded |
| A2 | Admin | Sem UI para system_settings |

### Prioridade 3 — MELHORIA (proximo ciclo)

| ID | Modulo | Problema |
|----|--------|---------|
| C6 | Comercial | Proposals query sem filtro de status |
| C7 | Comercial | Sem logica de expiracao de propostas |
| C8 | Comercial | loss_reason concatenado no notes |
| O9 | Operacional | Duplicate errors silenciados |
| ST4 | Sala Tecnica | MinhasTarefas sem descricao/prioridade |
| D2 | Dashboard | Sem visao financeira agregada |
| P3 | Projetos | Race condition na geracao de codigo |
| RH4 | RH | VT fields nao atomicos |
| A3 | Admin | Sem funcao deletar usuario |

---

## 6. RECOMENDACOES DE ACAO

### Fase 1 (Semana 1) — Filtros criticos
1. Adicionar `.eq("is_legacy", false)` em useDailySchedule e useMonthlySchedules
2. Adicionar filtro de status em useVehicles (excluir manutencao/indisponivel dos dropdowns)
3. Corrigir fallback de team_id em EscalaDiaria.tsx
4. Adicionar responsible_id na interface Proposal em useProposals.ts
5. Adicionar attendance ao types.ts ou migrar para tabela existente

### Fase 2 (Semana 2) — Integridade de dados
1. Centralizar lista de servicos em constante unica
2. Substituir filtro hardcoded de responsaveis por filtro baseado em role
3. Validar billing_type antes de criar medicao
4. Bloquear entrega com scope items pendentes
5. Sincronizar employee.status com employee_vacations

### Fase 3 (Semana 3) — Limpeza e UX
1. Resolver duplicidade Oportunidades vs Leads
2. Corrigir referencia obras -> projects no EscalaMensal
3. Usar nf_data nos relatorios financeiros
4. Criar UI admin para system_settings
5. Limpar campos legado dos projetos

---

*Relatorio gerado automaticamente em 03/04/2026*
