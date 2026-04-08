# Arquitetura Tecnica - AG Central Hub

> **Complemento tecnico** do `ARQUITETURA_SISTEMA.md` (regras de negocio, fluxos, pessoas-chave).
> Em caso de conflito, `CLAUDE.md` prevalece sobre ambos.
> Atualizado: 07/04/2026

---

## Stack Tecnologico

| Camada          | Tecnologia                                    |
|-----------------|-----------------------------------------------|
| Framework       | React 18 + TypeScript 5.8                     |
| Build           | Vite 8                                        |
| Roteamento      | React Router DOM 6                            |
| Estado servidor | TanStack React Query 5                        |
| Estado auth     | React Context (AuthContext)                   |
| UI              | shadcn/ui (Radix UI) + Tailwind CSS 3        |
| Backend         | Supabase (Postgrest, Auth, Realtime, Edge Fn) |
| Mapas           | Leaflet / React Leaflet                       |
| Graficos        | Recharts                                      |
| Formularios     | React Hook Form + Zod                         |
| Testes          | Vitest + Playwright                           |
| Fila de emails  | pgmq (PostgreSQL Message Queue)               |
| Hospedagem      | Lovable (deploy + Supabase integrado)         |

---

## Estrutura de Diretorios

```
src/
  App.tsx                # Rotas principais
  main.tsx               # Entry point React
  components/
    AppLayout.tsx         # Layout: sidebar + header + outlet
    AppSidebar.tsx        # Menu lateral colapsavel com badges
    NotificationsPanel.tsx
    ui/                   # 60+ componentes shadcn/ui
    operacional/          # Componentes do modulo Campo
    projetos/             # Componentes de projetos
  pages/
    Dashboard.tsx         # Radar — visao panoramica
    Comercial.tsx         # Router Negocios
    comercial/            # Leads (Kanban+Lista), Clientes
    Operacional.tsx       # Router Campo
    operacional/          # ProjetosEmCampoKanban, Escala, Despesas, Veiculos
    SalaTecnica.tsx       # Router Prancheta
    salatecnica/          # STKanban, STProjectDetail
    Financeiro.tsx        # Router Faturamento
    financeiro/           # Dashboard financeiro
    Propostas.tsx         # Propostas
    propostas/            # Form, AI, Detail dialogs
    RH.tsx                # Router Pessoas
    rh/                   # Funcionarios, Ausencias
    projetos/             # Dashboard, Kanban, Historico
    admin/                # Usuarios, Cadastros, Configuracoes
    AprovacaoExterna.tsx  # Pagina publica /aprovacao/:token
    auth/                 # Login, ForgotPassword, ResetPassword, ChangePassword
  hooks/                  # Custom hooks (TanStack Query)
    useLeads.ts           # CRUD leads + interacoes + migracao 5 status
    useProposals.ts       # CRUD propostas
    useClients.ts         # CRUD clientes
    useProjects.ts        # CRUD projetos + status duplo
    useProjectServices.ts # Servicos dentro de projetos
    useEmployees.ts       # CRUD funcionarios + disponibilidade
    useDailySchedule.ts   # Escala diaria + diarias automaticas
    useMonthlySchedules.ts # Escala mensal + sync bidirecional
    useTeams.ts           # Grupos rapidos
    useVehicles.ts        # Veiculos + useActiveVehicles()
    useExpenseSheets.ts   # Folhas de despesa semanais
    useMeasurements.ts    # Medicoes mensais
    useAlerts.ts          # Alertas entre modulos + polling 30s
    useModuleAlertCounts.ts # Contagem de alertas por modulo (badges)
    useTechnicalTasks.ts  # Tarefas da Sala Tecnica (CRUD)
    useScopeItems.ts      # Itens de escopo de projeto (CRUD)
    useLeadConversion.ts  # Conversao lead → cliente + projeto + alertas
    useProjectAuthorizations.ts
    useFieldPayments.ts   # Pagamentos de campo
    use-mobile.tsx        # Deteccao de dispositivo movel
    use-toast.ts          # Toast notifications
  contexts/
    AuthContext.tsx        # Autenticacao, perfil, role, isMaster
  integrations/
    supabase/
      client.ts           # Cliente Supabase configurado
      types.ts            # Tipos gerados do banco (FONTE DE VERDADE do schema)
  lib/
    fieldRoles.ts         # FIELD_ROLES, TECH_ROLES, isCommercialDirector()
    serviceTypes.ts       # SERVICE_TYPES (15 tipos de servico)
    utils.ts              # Utilidades gerais

supabase/
  functions/              # Edge Functions (Deno)
    _shared/              #   Templates de email compartilhados
    auth-email-hook/      #   Hook de emails de autenticacao
    create-user/          #   Criacao de usuarios (somente master)
    generate-proposal/    #   Geracao de PDF de propostas
    import-schedules/     #   Importacao em lote de escalas
    process-email-queue/  #   Processador da fila pgmq
    seed-users/           #   Populacao inicial de dados
  migrations/             # 20+ arquivos de migracao SQL
```

---

## Arvore de Rotas

```
App (QueryClientProvider → AuthProvider → BrowserRouter → Toaster)
│
├── Rotas publicas
│   ├── /login                         Login
│   ├── /forgot-password               ForgotPassword
│   ├── /reset-password                ResetPassword
│   ├── /change-password               ChangePassword (so se must_change_password)
│   └── /aprovacao/:token              AprovacaoExterna (publica, sem login)
│
└── Rotas protegidas (ProtectedRoute → AppLayout → Outlet)
    │
    ├── /                              Dashboard (Radar)
    │
    ├── /comercial/*                   Comercial (Negocios)
    │   ├── /comercial/leads           Leads (Kanban + Lista)
    │   └── /comercial/clientes        Clientes
    │
    ├── /propostas                     Propostas
    │
    ├── /projetos/*
    │   ├── /projetos/kanban           Projetos (Kanban 6 colunas)
    │   └── /projetos/dashboard        ProjetosDashboard
    │
    ├── /operacional/*                 Operacional (Campo)
    │   ├── /operacional/projetos-campo   ProjetosEmCampoKanban (default)
    │   ├── /operacional/escala           Planejamento (escalas)
    │   ├── /operacional/despesas-de-campo DespesasDeCampoTabs
    │   └── /operacional/veiculos         Veiculos
    │
    ├── /sala-tecnica/*                Sala Tecnica (Prancheta)
    │   ├── /sala-tecnica/             STKanban (default)
    │   ├── /sala-tecnica/equipe       Painel de tecnicos
    │   ├── /sala-tecnica/minhas-tarefas MinhasTarefas
    │   └── /sala-tecnica/alertas      Alertas da Prancheta
    │
    ├── /financeiro/*                  Financeiro (Faturamento)
    │   └── /financeiro/dashboard      FinanceiroDashboard
    │
    ├── /rh/*                          RH (Pessoas)
    │   ├── /rh/funcionarios           Funcionarios
    │   └── /rh/ausencias              RelatorioAusencias
    │
    └── /admin/* (somente master)
        ├── /admin/usuarios            UserManagement
        ├── /admin/cadastros           CadastrosBase
        └── /admin/clientes            Clientes
```

---

## Implementacao dos Modulos

### Operacional — ProjetosEmCampoKanban (redesign 07/04/2026)

Kanban de 3 colunas para projetos em fase de campo:

| Coluna | execution_status | Acoes |
|--------|-----------------|-------|
| Aguardando Campo | `aguardando_campo` | Botao "Iniciar Campo" → `em_campo` + log historico |
| Em Campo | `em_campo` | Mostra equipe do dia, countdown de prazo, ocorrencias |
| Campo Concluido | `campo_concluido` | Botao "Finalizar" → `aguardando_processamento` + alerta Prancheta |

Cada card mostra:
- Equipe alocada hoje (de daily_schedule_entries)
- Prazo de campo com countdown
- Rastreamento de ocorrencias (retrabalho, clima, equipamento)
- Alerta "Sem escala hoje" se projeto nao tem alocacao

Auto-transicao: botoes no card disparam mudanca de `execution_status` + criam entrada em `project_status_history`.

### Sala Tecnica — STKanban (redesign 07/04/2026)

Kanban de 3 colunas com painel lateral de tecnicos:

| Coluna | Descricao |
|--------|-----------|
| Em preparacao | Projetos recem-chegados do campo |
| Em andamento | Processamento tecnico ativo |
| Pronto | Revisao concluida, pronto para entrega |

**Painel de Tecnicos** (25% da largura): mostra disponibilidade e carga de trabalho. Drag-and-drop para atribuir tecnicos a projetos.

**STProjectDetail**: visao detalhada do projeto com:
- Edicao inline de scope items (project_scope_items)
- Criacao/gestao de tarefas tecnicas (technical_tasks)
- Secao RRT (Registro de Responsabilidade Tecnica)
- Indicadores de tempo e retrabalho
- Opcao de retorno ao campo

### Leads — Funil Simplificado (07/04/2026)

O banco mantem 8 valores no enum `lead_status`, mas o **frontend usa apenas 5 status**:

| Status UI | Valor(es) no banco |
|-----------|--------------------|
| Novo | `novo` |
| Em Negociacao | `em_contato`, `qualificado` (migrados no frontend) |
| Proposta Enviada | `proposta_enviada` |
| Convertido | `convertido`, `aprovado` (migrados no frontend) |
| Perdido | `perdido`, `descartado` (migrados no frontend) |

Hook `useLeads.ts` normaliza os status antigos automaticamente nas queries. Transicoes permitidas: `novo → em_negociacao → proposta_enviada → convertido/perdido`.

---

## Autenticacao

### Fluxo

```
Login (email/senha) → Supabase Auth
  → onAuthStateChange
  → Promise.all([fetch profile, fetch user_roles])
  → must_change_password? → /change-password
  → Sessao ativa (localStorage, auto-refresh)
  → AuthContext: { user, session, profile, role, isMaster }
```

### Criacao de Usuarios (Edge Function `create-user`)
1. Verifica Authorization header do chamador
2. Confirma role `master` via user_roles
3. Cria usuario via Supabase Admin API (`email_confirm: true`)
4. Insere profile com `must_change_password: true`
5. Atribui role

### Protecao de Rotas
- `ProtectedRoute`: redireciona `/login` se nao autenticado; `/change-password` se must_change_password
- `AuthRoute`: redireciona `/` se ja autenticado
- `/aprovacao/:token`: publica, sem autenticacao

---

## Padroes de Dados (TanStack Query)

### Chaves de Query

```typescript
["projects"]                          // Colecao raiz
["projects-active"]                   // Variante filtrada
["leads"]                             // Colecao raiz
["leads", id]                         // Recurso individual
["lead_interactions", leadId]         // Recurso aninhado
["monthly-schedules", month, year]    // Parametrizado por tempo
["alerts", "unread_count"]            // Agregacao
["operacional-alerts"]                // Alertas nao resolvidos do operacional
```

### Padrao de Mutations

```typescript
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase
        .from("projects").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
```

### Invalidacao Seletiva

Updates invalidam colecao + recurso individual:

```typescript
onSuccess: (_, vars) => {
  qc.invalidateQueries({ queryKey: ["leads"] });
  qc.invalidateQueries({ queryKey: ["leads", vars.id] });
}
```

### Composicao de Mutations

`useLeadConversion()` orquestra multiplas mutations em sequencia: cria cliente (se novo) → cria projeto → cria alertas para Campo/Prancheta/Faturamento.

### Estrategias de Refresh

| Dado            | Estrategia                                  |
|-----------------|---------------------------------------------|
| Projetos        | `staleTime: 0`, `refetchOnMount: "always"`  |
| Alertas         | `refetchInterval: 30000` (polling 30s)      |
| Confirmacoes    | `refetchInterval: 30000` (polling 30s)      |
| Demais entidades| Default TanStack (~5min staleTime)           |

### Queries Condicionais

```typescript
export function useLeadById(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", id],
    enabled: !!id,  // So busca quando id existe
    queryFn: async () => { ... }
  });
}
```

---

## Composicao de Componentes

### Layout Principal (AppLayout)

```
AppLayout (flex row, min-h-screen)
├── AppSidebar (16px|64px, colapsavel)
│   ├── Logo
│   ├── Navegacao principal (hierarquica com icones)
│   │   └── Badges de alerta por modulo (useModuleAlertCounts)
│   ├── Navegacao admin (condicional: isMaster)
│   └── Botao de colapso
└── Area principal (flex-1, flex-col)
    ├── Header (h-16)
    │   ├── Campo de busca
    │   ├── NotificationsPanel
    │   └── Menu do usuario (iniciais, role, logout)
    └── Conteudo (flex-1, p-6, overflow-auto)
        └── <Outlet /> (React Router)
```

### Padrao de Formularios

- `Dialog` ou `Drawer` do shadcn/ui como container
- `React Hook Form` para estado do formulario
- `Zod` para validacao de schema
- Mesmo componente para criacao e edicao

---

## Sistema de Alertas

### Fluxo Inter-Modulo

```
Operacional → Prancheta: campo_concluido (auto, ao finalizar campo)
Prancheta → Faturamento: projeto entregue (auto, ao concluir processamento)
Qualquer modulo → Financeiro: email automatico para Alcione
```

### Implementacao
- Tabela `alerts` com `alert_recipient` (enum por modulo)
- `useAlerts()`: queries filtradas por modulo com polling 30s
- `useModuleAlertCounts()`: contagem de nao-resolvidos para badges na sidebar
- Resolucao: botao "Resolver" marca `resolved = true`
- STKanban mostra icone de sino (bell) em cards com `has_active_alert`

---

## Banco de Dados — Tabelas Complementares

> Tabelas principais documentadas em `ARQUITETURA_SISTEMA.md`. Aqui apenas as nao listadas la.

| Tabela | Funcao |
|--------|--------|
| technical_tasks | Tarefas da Sala Tecnica (status: pendente, em_andamento, concluida, cancelada) |
| project_scope_items | Itens de escopo por projeto (ART/RRT, com is_completed) |
| field_expense_discounts | Descontos aplicados em folhas de despesa |
| system_settings | Configuracoes do sistema (key-value) |
| calendar_events | Eventos de calendario (com google_event_id) |
| email_send_log | Log de envio de emails |
| email_send_state | Estado de rate limiting da fila |
| suppressed_emails | Emails bloqueados (bounce, complaint, unsubscribe) |

### Views

| View | Funcao |
|------|--------|
| vw_prazos_criticos | Projetos com prazos proximos/vencidos |
| vw_tarefas_dia | Tarefas tecnicas do dia com dados do tecnico |

---

## Infraestrutura de Email (pgmq)

```
Edge Function (process-email-queue)
  → pgmq (filas PostgreSQL nativas)
    ├── auth_emails         (TTL 15min, alta prioridade)
    └── transactional_emails (TTL 60min)
  → Envio com rate limiting (batch_size, delay_ms em email_send_state)
  → email_send_log (auditoria: pending/sent/failed/dlq)
  → Falhas → Dead Letter Queue
```

Funcoes de fila restritas a `service_role` com `SECURITY DEFINER`.

---

## Edge Functions (Deno)

| Funcao               | Descricao                                         |
|----------------------|---------------------------------------------------|
| create-user          | Criacao de usuarios com verificacao de role master |
| generate-proposal    | Geracao de PDF de propostas                       |
| import-schedules     | Importacao em lote de escalas                     |
| process-email-queue  | Processador da fila pgmq com rate limiting        |
| auth-email-hook      | Hook para emails de autenticacao Supabase         |
| seed-users           | Populacao inicial de dados                        |

---

## Padroes de Schema

### RLS (Row Level Security)
Habilitado em todas as tabelas. Politicas atuais permissivas para `authenticated`:
```sql
CREATE POLICY "Authenticated users full access"
  ON public.employees FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```
**Divida tecnica**: refinar por role.

### Triggers de updated_at
Todas as tabelas com `updated_at` possuem trigger automatico via `update_updated_at_column()`.

### Restricoes Compostas
```sql
UNIQUE(daily_schedule_id, employee_id)  -- 1 entrada por funcionario/dia
UNIQUE(team_id, employee_id)            -- 1 membro por equipe
```

### Cascading Deletes
`team_members`, `daily_schedule_entries`, `proposal_items` usam `ON DELETE CASCADE`.

---

## Variaveis de Ambiente

```
VITE_SUPABASE_URL              # URL da instancia Supabase
VITE_SUPABASE_PUBLISHABLE_KEY  # Chave publica (anon key)
```

---

## Scripts de Desenvolvimento

```bash
npm run dev        # Servidor de desenvolvimento (localhost:8080)
npm run build      # Build de producao
npm run build:dev  # Build em modo desenvolvimento
npm run lint       # Verificacao ESLint
npm run test       # Testes unitarios (Vitest)
npm run test:watch # Testes em modo watch
npm run preview    # Preview do build de producao
```

---

## Nota Arquitetural

**Estado atual: ~5.2/10** (07/04/2026)

| Faixa | Marco | Status |
|-------|-------|--------|
| 5-6   | SQL Fases 1-4 (campos sujos, tabelas novas/mortas) | Em andamento |
| 6-7   | Sala Tecnica funcional, Financeiro pipeline, execution_status em todos | Parcial (ST redesenhada) |
| 7-8   | Alertas automaticos, aprovacao despesas WhatsApp, relatorios | Pendente |
| 8-9   | Dados limpos, clientes deduplicados, ViaCEP, historico status | Pendente |
| 9-10  | Import/export, mobile polido, filtros avancados, zero bugs | Pendente |

### Dividas Tecnicas Principais
1. **RLS permissivo** — todas as tabelas com acesso total para authenticated
2. **Lead enum desalinhado** — banco tem 8 valores, frontend usa 5 (migracao no hook)
3. **Modulos placeholder** — partes de Financeiro e RH (documentos, exames)
4. **Campos sujos** — texto livre onde deveria ter FK (projects.responsible, etc.)
5. **Tabelas mortas** — attendance, schedule_confirmations, email_unsubscribe_tokens a eliminar
