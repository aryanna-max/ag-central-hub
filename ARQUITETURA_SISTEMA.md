# ARQUITETURA DO SISTEMA AG CENTRAL HUB

## O que e este sistema

Sistema de gestao interna da **AG Topografia**, empresa de topografia e cartografia em Pernambuco. Gerencia o ciclo completo: captacao de clientes (Comercial) → execucao de campo (Operacional) → processamento tecnico (Sala Tecnica) → faturamento (Financeiro).

**URL:** Hospedado no Lovable (lovable.dev)
**Repositorio:** github.com/aryanna-max/ag-central-hub

---

## Stack tecnica

- **Frontend:** React + TypeScript + Vite
- **UI:** ShadcnUI + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Hospedagem:** Lovable (gerencia deploy e Supabase integrado)
- **Estado:** React Query (TanStack Query) para cache e sync
- **Roteamento:** React Router v6

---

## Estrutura de pastas

```
src/
├── App.tsx                    # Rotas principais
├── components/
│   ├── AppSidebar.tsx         # Menu lateral colapsavel
│   ├── AppLayout.tsx          # Layout com sidebar + conteudo
│   ├── ui/                    # Componentes ShadcnUI (Button, Card, etc)
│   └── operacional/           # Componentes especificos do modulo
├── pages/
│   ├── Dashboard.tsx          # Radar — visao panoramica
│   ├── Comercial.tsx          # Router do modulo Negocios
│   ├── comercial/             # Leads, Propostas, Clientes
│   ├── Operacional.tsx        # Router do modulo Campo
│   ├── operacional/           # Escalas, Veiculos, Equipes, Despesas
│   ├── SalaTecnica.tsx        # Router do modulo Prancheta
│   ├── salatecnica/           # Kanban, Tarefas, Alertas
│   ├── Financeiro.tsx         # Router do modulo Faturamento
│   ├── financeiro/            # Medicoes, Pipeline, Relatorios
│   ├── RH.tsx                 # Router do modulo Pessoas
│   ├── rh/                    # Funcionarios, Ausencias
│   ├── projetos/              # Dashboard, Kanban, Historico
│   ├── admin/                 # Usuarios, Cadastros, Configuracoes
│   ├── AprovacaoExterna.tsx   # Pagina publica /aprovacao/:token
│   └── auth/                  # Login, Reset Password
├── hooks/
│   ├── useLeads.ts            # CRUD leads + interacoes
│   ├── useProposals.ts        # CRUD propostas
│   ├── useClients.ts          # CRUD clientes
│   ├── useProjects.ts         # CRUD projetos
│   ├── useProjectServices.ts  # Servicos dentro de projetos
│   ├── useEmployees.ts        # CRUD funcionarios + disponibilidade
│   ├── useDailySchedule.ts    # Escala diaria + diarias automaticas
│   ├── useMonthlySchedules.ts # Escala mensal + sync bidirecional
│   ├── useTeams.ts            # Grupos rapidos
│   ├── useVehicles.ts         # Veiculos + useActiveVehicles()
│   ├── useExpenseSheets.ts    # Folhas de despesa semanais
│   ├── useMeasurements.ts     # Medicoes mensais
│   ├── useAlerts.ts           # Alertas entre modulos
│   ├── useTechnicalTasks.ts   # Tarefas da Sala Tecnica
│   └── useScopeItems.ts       # Itens de escopo de projeto
├── lib/
│   ├── fieldRoles.ts          # FIELD_ROLES, TECH_ROLES, isCommercialDirector()
│   ├── serviceTypes.ts        # SERVICE_TYPES (15 tipos de servico)
│   └── utils.ts               # Utilidades gerais
├── integrations/
│   └── supabase/
│       ├── client.ts          # Cliente Supabase configurado
│       └── types.ts           # Tipos gerados do banco (fonte de verdade)
└── contexts/
    └── AuthContext.tsx         # Autenticacao e roles
```

---

## Modulos do sistema

### Nomes de exibicao vs rotas internas

| Sidebar | Rota interna | Funcao |
|---------|-------------|--------|
| Radar | `/` | Dashboard panoramico — Diretoria |
| Negocios | `/comercial/*` | Leads, Propostas, Clientes — Comercial |
| Campo | `/operacional/*` | Escalas, Veiculos, Equipes, Despesas — Operacional |
| Prancheta | `/sala-tecnica/*` | Kanban tecnico, Tarefas, Alertas — Sala Tecnica |
| Faturamento | `/financeiro/*` | Medicoes, Pipeline, Relatorios — Financeiro |
| Pessoas | `/rh/*` | Funcionarios, Ferias, Ausencias — RH |
| Admin | `/admin/*` | Usuarios, Cadastros Base, Configuracoes — Master |

### Pagina publica (sem login)
| Rota | Funcao |
|------|--------|
| `/aprovacao/:token` | Aprovacao de folha de despesa via celular |

---

## Banco de dados — 37 tabelas

### Tabelas principais

| Tabela | Funcao | FKs principais |
|--------|--------|---------------|
| leads | Funil comercial | client_id, responsible_id |
| lead_interactions | Historico de contatos | lead_id |
| clients | Cadastro de clientes | lead_id |
| client_contacts | Contatos por cliente | client_id |
| proposals | Propostas comerciais | lead_id, client_id, responsible_id |
| proposal_items | Itens da proposta | proposal_id |
| projects | Projetos (hub central) | client_id, lead_id, responsible_id |
| project_services | Servicos dentro do projeto | project_id, proposal_id |
| project_scope_items | Itens de escopo (ART/RRT) | project_id |
| project_status_history | Log de mudancas de status | project_id |
| employees | Funcionarios | — |
| employee_vacations | Periodos de ferias | employee_id |
| teams | Grupos rapidos (presets) | leader_id, default_vehicle_id, default_project_id |
| team_members | Membros dos grupos | team_id, employee_id |
| daily_schedules | Escala do dia | — |
| daily_schedule_entries | Funcionario no dia | daily_schedule_id, employee_id, project_id |
| daily_team_assignments | Grupo alocado no dia | daily_schedule_id, team_id, project_id |
| monthly_schedules | Previsao mensal | team_id, project_id, vehicle_id |
| vehicles | Frota de veiculos | responsible_employee_id |
| vehicle_payment_history | Diarias automaticas por mes | vehicle_id |
| field_expense_sheets | Folha semanal de despesa | approval_token |
| field_expense_items | Itens da folha | sheet_id, employee_id, project_id |
| measurements | Medicoes mensais | project_id |
| invoices | NFs e recibos | project_id |
| invoice_items | Itens da NF | invoice_id, project_service_id |
| technical_tasks | Tarefas da Sala Tecnica | project_id, assigned_to_id, scope_item_id |
| alerts | Alertas entre modulos | — |
| profiles | Perfis de usuario (Supabase Auth) | — |
| user_roles | Roles por usuario | user_id |
| system_settings | Configuracoes do sistema | — |

### Enums do banco

| Enum | Valores |
|------|---------|
| lead_status | novo, em_contato, qualificado, proposta_enviada, aprovado, convertido, perdido, descartado |
| execution_status | aguardando_campo, em_campo, campo_concluido, aguardando_processamento, em_processamento, revisao, aprovado, entregue, faturamento, pago |
| project_status | planejamento, execucao, entrega, faturamento, concluido, pausado |
| proposal_status | rascunho, enviada, aprovada, rejeitada, expirada |
| employee_status | disponivel, ferias, licenca, afastado, desligado |
| vehicle_status | disponivel, em_uso, manutencao, indisponivel |
| billing_mode | fixo_mensal, diarias, esporadico |
| empresa_faturadora_enum | ag_topografia, ag_cartografia |
| tipo_documento | nf, recibo |
| removal_reason | campo_concluido, pausa_temporaria, reagendado, clima, equipamento, falta_equipe |
| app_role | master, diretor, operacional, sala_tecnica, comercial, financeiro |

---

## Fluxos principais do sistema

### 1. Funil Comercial (Negocios)
```
Lead novo
  → Em contato → Qualificado
    → Proposta enviada (cria proposta, status auto)
      → Aprovado (proposta aprovada)
        → Convertido (cria projeto + cliente)
  ou → Perdido (com motivo obrigatorio)
```

### 2. Escala Operacional (Campo)
```
Vespera (~17h):
  Gerente Operacional abre Escala Diaria
    → Cria escala de amanha (pre-preenche da mensal se houver)
    → Ajusta equipes/funcionarios/veiculos/projeto
    → Exporta relatorio → envia PNG/PDF no grupo WhatsApp

Dia real:
  Gerente Operacional abre escala do dia
    → Ajusta trocas (quem faltou, veiculo quebrou)
    → Marca presenca
    → Fecha escala = dado real, travado
    → Diarias de veiculos geradas automaticamente
```

### 3. Folha de Despesa Semanal
```
Gerente Operacional cria folha semanal
  → Adiciona itens (funcionario + despesa extra)
  → Submete para aprovacao
  → Copia link → cola no WhatsApp da Diretoria
    → Diretoria Comercial abre no celular (sem login)
      → Aprova → Financeiro recebe email
      → Questiona (com comentario) → Gerente Operacional corrige
        → Mesmo link mostra versao atualizada
```

### 4. Processamento Tecnico (Prancheta)
```
Projeto com execution_status = campo_concluido
  → Aparece no Kanban da Sala Tecnica
    → Distribui tarefas para tecnicos
      → aguardando_processamento → em_processamento → revisao → aprovado
        → Entregue (verifica scope items pendentes)
```

### 5. Faturamento
```
Projeto entregue
  → Criar medicao (se medicao_mensal)
  → Registrar NF → cria invoice automaticamente
    → NF emitida → Pago
```

---

## Regras de negocio importantes

### BRK — Contrato especifico
- BRK e um contrato guarda-chuva com valor mensal
- Gerente Operacional ve apenas "BRK Obras" e "BRK Projetos" (show_in_operational=true)
- Demais projetos BRK (por tomador/CNPJ) sao visiveis apenas no Financeiro
- Distribuicao de custos entre tomadores e problema do Financeiro

### Projetos — Status duplo
- `project_status`: planejamento → execucao → entrega → faturamento → concluido (interno)
- `execution_status`: 10 valores de aguardando_campo ate pago (visivel na UI)
- execution_status e o primario na interface. project_status fica de-enfatizado

### Filtros por modulo
- **Operacional**: projetos com execution_status IN (aguardando_campo, em_campo) + show_in_operational=true
- **Sala Tecnica**: projetos com execution_status IN (campo_concluido, aguardando_processamento, em_processamento, revisao)
- **Financeiro**: projetos com execution_status IN (aprovado, entregue, faturamento) ou billing_type=medicao_mensal
- **Dashboard**: todos os projetos ativos

### Escala mensal = opcional
- Facilitador de pre-preenchimento, nao obrigacao
- Se Gerente Operacional preencheu, escala diaria vem pronta
- Se nao preencheu, monta do zero na vespera

### Veiculos — diarias automaticas
- Ao fechar escala diaria, sistema conta veiculos alocados
- Cria/atualiza vehicle_payment_history (1 diaria por veiculo por dia)
- total_value = days_count * daily_rate

### Aprovacao de despesas — sem login
- Pagina publica /aprovacao/:token
- Mobile-first, botoes grandes
- Aprovar ou Questionar (com comentario)
- Link sempre mostra dados atualizados

---

## Pessoas-chave (funcoes, nao nomes)

| Funcao | Quem | O que faz no sistema |
|--------|------|---------------------|
| Diretora Administrativa | Aryanna | Dona do sistema, acessa tudo |
| Gerente Operacional | — | Escalas diarias, veiculos, despesas de campo |
| Lider Sala Tecnica | Emanuel Macedo | Distribui tarefas tecnicas |
| Financeiro | — | Recebe alertas por email, NAO acessa o sistema |
| Diretores Comerciais | Sergio, Ciro | Aprovam despesas, gerenciam leads/propostas |

---

## Constantes centralizadas

### src/lib/fieldRoles.ts
- `FIELD_ROLES`: Topografo (I-IV), Ajudante de Topografia
- `TECH_ROLES`: Cadista, Cartografo, Tecnico de Saneamento, etc.
- `isFieldRole()`, `isTechRole()`, `isTopografo()`
- `isCommercialDirector()`: filtra Sergio e Ciro por nome

### src/lib/serviceTypes.ts
- `SERVICE_TYPES`: 15 tipos de servico (Levantamento, Georreferenciamento, etc.)
- Usado em: Leads, Propostas, Projetos

---

## Import/Export — Regras

### Pode importar via planilha + SQL
- Veiculos (tabela vazia)
- Equipes/Grupos (tabela vazia)
- Clientes novos (verificar duplicidade por CNPJ)

### NUNCA importar
- Projetos (muitas FKs em cascata)
- Leads (vinculados a clientes, propostas, projetos)
- Propostas (vinculadas a leads e clientes)
- Escalas (geradas pelo fluxo operacional)

### Planilhas modelo disponiveis no repo
- PLANILHA_VEICULOS.csv
- PLANILHA_EQUIPES.csv
- PLANILHA_MEMBROS_EQUIPE.csv
- PLANILHA_CLIENTES.csv

---

## Supabase — Acesso

**IMPORTANTE:** O Supabase MCP NAO tem acesso a este projeto (permission denied). O Lovable gerencia o Supabase internamente.

- Alteracoes no banco: preparar SQL para colar no SQL Editor do Lovable
- Para verificar schema: ler src/integrations/supabase/types.ts
- Supabase Project ID: bphgtvwgsgaqaxmkrtqj

---

## Decisoes arquiteturais fechadas (sessao 03-04/04/2026)

| # | Decisao | Resolucao |
|---|---------|-----------|
| 14 | Oportunidades vs Leads | Oportunidades eliminado — usar apenas Leads |
| 15 | Status duplo na UI | execution_status primario, project_status interno |
| 16 | NF gerada fora ou dentro | Fora por enquanto — avaliar integracao futura |
| 17 | Sergio e Ciro | Diretores Comerciais — aprovam folhas |
| 18 | BRK no Operacional | show_in_operational controla visibilidade |
| 19 | Escala mensal | Opcional — facilitador de pre-preenchimento |
| 20 | Confirmacao de escala | Eliminada — so existe fechamento |
| 21 | Diarias de veiculos | Automaticas ao fechar escala |
| 22 | Aprovacao de despesas | Via link externo (WhatsApp), sem login |
| 23 | Labels dos modulos | Nomes criativos: Radar, Negocios, Campo, Prancheta, Pessoas |
| 24 | Import/Export | Import via planilha+SQL, nunca projetos/leads/escalas |
| 25 | Filtro projetos Operacional | Default com toggle "Mostrar todos" |
| 26 | RH cards de resumo | Por setor: Campo, Sala Tecnica, Administrativo |
