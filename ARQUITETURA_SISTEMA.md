# ARQUITETURA DO SISTEMA AG CENTRAL HUB
> Versão: 2.0 | Atualizado: 07/04/2026
> Consultar quando implementar ou modificar módulos.
> Em caso de conflito com outros documentos, CLAUDE.md prevalece.

---

## 1. VISÃO GERAL

Sistema de gestão interna da **AG Topografia e Construções** (Gonzaga e Berlim Construções Ltda, CNPJ 16.841.054/0001-10), Aliança/PE.

**Dois CNPJs ativos:**
- Gonzaga e Berlim Construções Ltda — CNPJ 16.841.054/0001-10
- AG Cartografia — CNPJ 48.282.440/0001-05

**O sistema gerencia o ciclo completo:**
```
Captação (Negócios) → Campo (Operacional) → Processamento (Prancheta) → Faturamento
```

---

## 2. STACK TÉCNICA

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI | ShadcnUI + TailwindCSS |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Estado | TanStack Query (React Query) |
| Roteamento | React Router v6 |
| Hospedagem | Lovable (gerencia deploy + Supabase integrado) |

---

## 3. ESTRUTURA DE PASTAS

```
src/
├── App.tsx                    # Rotas principais
├── components/
│   ├── AppSidebar.tsx         # Menu lateral colapsável
│   ├── AppLayout.tsx          # Layout com sidebar + conteúdo
│   ├── ui/                    # Componentes ShadcnUI
│   ├── operacional/           # Componentes do módulo Campo
│   └── mobile/                # Componentes mobile (fase futura)
├── pages/
│   ├── Dashboard.tsx          # Radar — visão panorâmica
│   ├── Comercial.tsx          # Router Negócios
│   ├── comercial/             # Leads, Propostas, Clientes
│   ├── Operacional.tsx        # Router Campo
│   ├── operacional/           # Escalas, Veículos, Equipes, Despesas
│   ├── SalaTecnica.tsx        # Router Prancheta
│   ├── salatecnica/           # Kanban, Tarefas, Alertas
│   ├── Financeiro.tsx         # Router Faturamento
│   ├── financeiro/            # Medições, Pipeline, Relatórios
│   ├── RH.tsx                 # Router Pessoas
│   ├── rh/                    # Funcionários, Férias, Ausências
│   ├── projetos/              # Hub central de projetos
│   ├── admin/                 # Usuários, Cadastros, Configurações
│   ├── AprovacaoExterna.tsx   # Página pública /aprovacao/:token
│   └── auth/                  # Login, Reset Password
├── hooks/
│   ├── useLeads.ts
│   ├── useProposals.ts
│   ├── useClients.ts
│   ├── useProjects.ts
│   ├── useProjectServices.ts
│   ├── useEmployees.ts
│   ├── useDailySchedule.ts
│   ├── useMonthlySchedules.ts
│   ├── useTeams.ts
│   ├── useVehicles.ts         # + useActiveVehicles() para dropdowns
│   ├── useExpenseSheets.ts
│   ├── useMeasurements.ts
│   ├── useAlerts.ts
│   ├── useModuleAlertCounts.ts
│   ├── useTechnicalTasks.ts
│   ├── useScopeItems.ts
│   ├── useCepAutofill.ts
│   ├── useLeadConversion.ts
│   ├── useProjectAuthorizations.ts
│   ├── use-mobile.tsx         # useIsMobile() — detecção de tela
│   └── use-toast.ts
├── lib/
│   ├── fieldRoles.ts          # FIELD_ROLES, TECH_ROLES, isCommercialDirector()
│   ├── serviceTypes.ts        # SERVICE_TYPES (15 tipos de serviço)
│   └── utils.ts
├── integrations/
│   └── supabase/
│       ├── client.ts
│       └── types.ts           # ← FONTE DE VERDADE DO SCHEMA
└── contexts/
    └── AuthContext.tsx
```

---

## 4. ROTAS

| Label UI | Rota | Acesso |
|---|---|---|
| Radar | `/` | diretor, master |
| Negócios | `/comercial/*` | comercial, diretor, master |
| Campo | `/operacional/*` | operacional, diretor, master |
| Prancheta | `/sala-tecnica/*` | sala_tecnica, diretor, master |
| Faturamento | `/financeiro/*` | financeiro, diretor, master |
| Pessoas | `/rh/*` | financeiro, master |
| Base | `/admin/*` | master |
| Aprovação externa | `/aprovacao/:token` | **pública, sem login** |

---

## 5. BANCO DE DADOS — 40 TABELAS

### Tabelas principais

| Tabela | Função | FKs principais |
|---|---|---|
| leads | Funil comercial | client_id, responsible_id |
| lead_interactions | Histórico de contatos | lead_id |
| clients | Cadastro de clientes | — |
| client_contacts | Contatos por cliente | client_id |
| proposals | Propostas comerciais | lead_id, client_id, responsible_id |
| proposal_items | Itens da proposta | proposal_id |
| projects | Hub central | client_id, lead_id, responsible_id |
| project_services | Serviços dentro do projeto | project_id, proposal_id |
| project_scope_items | Itens de escopo (ART/RRT) | project_id |
| project_status_history | Log de mudanças de status | project_id |
| project_benefits | Benefícios por projeto | project_id |
| employees | Funcionários | — |
| employee_vacations | Períodos de férias | employee_id |
| employee_project_authorizations | Autorizações por projeto | employee_id, project_id |
| teams | Grupos rápidos (presets) | leader_id, default_vehicle_id, default_project_id |
| team_members | Membros dos grupos | team_id, employee_id |
| daily_schedules | Escala do dia | project_id, created_by_id |
| daily_schedule_entries | Funcionário no dia | daily_schedule_id, employee_id, project_id |
| daily_team_assignments | Grupo alocado no dia | daily_schedule_id, team_id, project_id |
| monthly_schedules | Previsão mensal | team_id, project_id, vehicle_id |
| vehicles | Frota | responsible_employee_id |
| vehicle_payment_history | Diárias automáticas | vehicle_id |
| field_expense_sheets | Folha semanal de despesa | approval_token |
| field_expense_items | Itens da folha | sheet_id, employee_id, project_id |
| field_expense_discounts | Descontos nas folhas | sheet_id |
| measurements | Medições mensais | project_id, project_service_id |
| invoices | NFs e recibos | project_id |
| invoice_items | Itens da NF | invoice_id, project_service_id |
| technical_tasks | Tarefas da Prancheta | project_id, assigned_to_id, scope_item_id |
| alerts | Alertas entre módulos | — |
| calendar_events | Eventos de calendário | created_by |
| profiles | Perfis de usuário (Auth) | — |
| user_roles | Roles por usuário | user_id |
| system_settings | Configurações do sistema | — |
| email_send_log | Log de emails enviados | — |
| email_send_state | Estado da fila de emails | — |
| suppressed_emails | Emails bloqueados | — |

Views: `vw_prazos_criticos`, `vw_tarefas_dia`

### Colunas críticas em `projects`
```
execution_status, needs_tech_prep, show_in_operational,
billing_type,
field_started_at, field_deadline, delivery_deadline,
field_completed_at, delivered_at,
field_days_estimated, delivery_days_estimated,
scope_description, cep, rua, bairro, numero, cidade, estado,
client_id, lead_id, responsible_id,
responsible_comercial_id, responsible_diretor_id,
responsible_campo_id, responsible_tecnico_id
```

---

## 6. ENUMS COMPLETOS

| Enum | Valores |
|---|---|
| execution_status | aguardando_campo → em_campo → campo_concluido → aguardando_processamento → em_processamento → revisao → aprovado → entregue → faturamento → pago |
| project_status | planejamento, execucao, entrega, faturamento, concluido, pausado |
| lead_status | novo, em_contato, qualificado, proposta_enviada, aprovado, convertido, perdido, descartado |
| proposal_status | rascunho, enviada, aprovada, rejeitada, expirada |
| measurement_status | rascunho, aguardando_aprovacao, aprovada, nf_emitida, paga, cancelada |
| employee_status | disponivel, ferias, licenca, afastado, desligado |
| vehicle_status | disponivel, em_uso, manutencao, indisponivel |
| billing_mode | fixo_mensal, diarias, esporadico |
| empresa_faturadora_enum | ag_topografia, ag_cartografia |
| tipo_documento | nf, recibo |
| removal_reason | campo_concluido, pausa_temporaria, reagendado, clima, equipamento, falta_equipe |
| app_role | master, diretor, operacional, sala_tecnica, comercial, financeiro |
| alert_recipient | operacional, comercial, financeiro, rh, sala_tecnica, diretoria, todos |

---

## 7. FLUXOS PRINCIPAIS

### Fluxo 1 — Funil Comercial
```
Lead novo
  → em_contato → qualificado
  → proposta_enviada (cria proposta, status automático)
  → aprovado (proposta aprovada pelo cliente)
  → convertido (cria projeto + cliente se novo)
  ou → perdido (motivo obrigatório)

Projeto criado:
  → Tarefa automática: criar pasta servidor F:\Dados\Dados\AG\OPERACIONAL\{ANO}\{CÓDIGO}\
  → Alerta para Campo (operacional) + Prancheta (sala_tecnica) + Faturamento (financeiro)
```

### Fluxo 2 — Escala Operacional
```
Véspera (~17h) — Marcelo:
  Abre Escala Diária de amanhã
  → Pré-preenche da mensal (se houver)
  → Ajusta equipes/funcionários/veículos/projeto
  → Exporta relatório → envia PNG no grupo WhatsApp

Dia real — Marcelo:
  Ajusta trocas (quem faltou, veículo quebrou)
  → Fecha escala = dado real, travado (is_closed = true)
  → Diárias de veículos geradas automaticamente (vehicle_payment_history)
```

### Fluxo 3 — Folha de Despesa Semanal
```
Marcelo cria folha semanal
  → Adiciona itens (funcionário + despesa extra)
  → Submete → Copia link → Cola no WhatsApp da Diretoria
  → Diretores abrem no celular (sem login) → /aprovacao/:token
  → Aprovam ou Questionam (com comentário)
  → Alcione recebe email automático
  → Faturamento espelha alerta no sistema
```

### Fluxo 4 — Processamento Técnico (Prancheta)
```
Projeto com execution_status = campo_concluido
  → Aparece no Kanban da Prancheta
  → Emanuel distribui tarefas para técnicos
  → aguardando_processamento → em_processamento → revisao → aprovado
  → Entregue (verifica scope items pendentes — BLOQUEIA se houver)
```

### Fluxo 5 — Faturamento
```
Projeto entregue:
  → billing_type = entrega_nf: criar invoice → registrar NF → pago
  → billing_type = medicao_mensal: criar medição mensal → aprovar → NF → pago

Email automático para Alcione (financeiro@agtopografia.com.br):
  Contém: cliente, projeto, valor, CNPJ tomador, dados bancários
  Alcione emite NF sem precisar abrir o sistema
```

---

## 8. CONSTANTES CENTRALIZADAS

### src/lib/fieldRoles.ts
- `FIELD_ROLES`: Topógrafo I-IV, Ajudante de Topografia
- `TECH_ROLES`: Cadista, Cartógrafo, Técnico de Saneamento, etc.
- `isFieldRole()`, `isTechRole()`, `isTopografo()`
- `isCommercialDirector()`: filtra Sérgio e Ciro

### src/lib/serviceTypes.ts
```
SERVICE_TYPES (15 opções):
Levantamento Topográfico Planialtimétrico
Levantamento Topográfico Planialtimétrico Cadastral Georreferenciado
Levantamento Cadastral Urbano
Levantamento Altimétrico
Levantamento Planimétrico
Levantamento para Projeto de Engenharia
Georreferenciamento
Cartografia
Implantação de Lotes
Acompanhamento de Obras
Locação de Equipe
Locação de Equipe Mensal
Masterplan
Processamento de Dados
Outros
```

---

## 9. REGRAS DE FRONTEND

- Sidebar colapsável — recolhe para strip de ícones
- Tabelas com scroll horizontal (`overflow-x: auto`)
- Títulos de colunas são filtros de ordenação
- Filtros de visualização em todas as telas
- **Prancheta NUNCA vê valores financeiros**
- Cada módulo tem seu próprio Kanban/view
- Colunas vazias do Kanban colapsam para faixa fina — não somem
- Projetos sem lead aparecem no Negócios com tag "Sem lead"
- Mobile-first no Radar (diretores acessam pelo celular)
- Cada módulo tem botão **"Enviar para Financeiro"** (gera email + alerta)
- Aryanna (master) vê botões Editar/Apagar em todas as telas estratégicas

---

## 10. IMPORT/EXPORT — REGRAS DE SEGURANÇA

### Pode importar via planilha + SQL
| Cadastro | Planilha modelo |
|---|---|
| Veículos | PLANILHA_VEICULOS.csv |
| Equipes/Grupos | PLANILHA_EQUIPES.csv |
| Membros de Equipe | PLANILHA_MEMBROS_EQUIPE.csv |
| Clientes novos | PLANILHA_CLIENTES.csv (verificar CNPJ antes) |

### NUNCA importar
- Projetos — muitas FKs em cascata
- Leads — vinculados a clientes, propostas, projetos
- Propostas — vinculadas a leads e clientes
- Escalas — geradas pelo fluxo operacional
- Medições — vinculadas a projetos e invoices

### Processo seguro
1. Preencher CSV modelo
2. Enviar para Claude gerar SQL de INSERT com verificação de duplicidade
3. Rodar SQL no SQL Editor do Lovable
4. Verificar contagens pós-importação

---

## 11. SUPABASE — ACESSO

⚠️ **O Supabase MCP NÃO tem acesso a este projeto** (permission denied).
- Alterações no banco: preparar SQL para colar no SQL Editor do Lovable
- Para verificar schema: ler `src/integrations/supabase/types.ts`
- Supabase Project ID: bphgtvwgsgaqaxmkrtqj

---

## 12. PESSOAS-CHAVE

| Função | Quem | O que faz no sistema |
|---|---|---|
| Diretora | Aryanna | Dona do sistema, acessa tudo, botões admin |
| Diretor | Sérgio | Aprova despesas, gerencia comercial |
| Diretor | Ciro | Aprova despesas, gerencia comercial |
| Gerente Operacional | Marcelo | Escalas diárias, veículos, despesas de campo |
| Líder Prancheta | Emanuel Macedo | Distribui tarefas técnicas |
| RH + Financeiro | Alcione | Acesso eventual para dúvidas. Foco = email automático |
