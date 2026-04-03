# Arquitetura - AG Central Hub

## Visao Geral

Sistema de gestao empresarial para operacoes de campo, projetos e vendas. Construido com React + TypeScript no frontend e Supabase (PostgreSQL) como backend. Atende equipes de topografia e engenharia com modulos para comercial, operacional, financeiro, RH e sala tecnica.

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

---

## Estrutura de Diretorios

```
src/
  pages/            # Componentes de pagina (nivel de rota)
    auth/           #   Login, senha, recuperacao
    comercial/      #   Leads, clientes
    operacional/    #   Equipes, escalas, medicoes, despesas, veiculos
    projetos/       #   Dashboard e formularios de projetos
    propostas/      #   Criacao e detalhe de propostas
    financeiro/     #   Dashboard financeiro
    rh/             #   Funcionarios, ausencias
    admin/          #   Usuarios, cadastros (somente master)
  components/       # Componentes reutilizaveis
    ui/             #   60+ componentes shadcn/ui
    operacional/    #   Componentes especificos do modulo operacional
    projetos/       #   Componentes especificos de projetos
  hooks/            # Custom hooks (TanStack Query para CRUD)
  contexts/         # AuthContext (autenticacao e perfil)
  integrations/
    supabase/       #   Cliente e tipos do banco (types.ts auto-gerado)
  lib/              # Utilitarios e constantes (fieldRoles, utils)
  assets/           # Imagens e arquivos estaticos
  test/             # Configuracao de testes

supabase/
  functions/        # Edge Functions (Deno)
    _shared/        #   Templates de email compartilhados
    auth-email-hook/    # Hook de emails de autenticacao
    create-user/        # Criacao de usuarios (somente master)
    generate-proposal/  # Geracao de PDF de propostas
    import-schedules/   # Importacao em lote de escalas
    process-email-queue/ # Processador da fila de emails
    seed-users/         # Populacao inicial de dados
  migrations/       # 20+ arquivos de migracao SQL
```

---

## Arvore de Rotas

```
App (QueryClientProvider → AuthProvider → BrowserRouter → Toaster)
│
├── Rotas publicas (sem autenticacao)
│   ├── /login                    AuthRoute → Login
│   ├── /forgot-password          AuthRoute → ForgotPassword
│   ├── /reset-password           ResetPassword
│   └── /change-password          ChangePasswordRoute → ChangePassword
│
└── Rotas protegidas (ProtectedRoute → AppLayout → Outlet)
    ├── /                         Dashboard
    ├── /comercial/*              Comercial
    │   ├── /comercial/leads      Leads (Kanban + Lista)
    │   └── /comercial/clientes   Clientes
    ├── /propostas                Propostas
    ├── /projetos/*
    │   ├── /projetos/kanban      Projetos (Kanban)
    │   └── /projetos/dashboard   ProjetosDashboard
    ├── /operacional/*
    │   ├── /operacional/dashboard        DashboardOperacional
    │   ├── /operacional/equipes          Equipes
    │   ├── /operacional/escala-diaria    EscalaDiaria
    │   ├── /operacional/escala           EscalaMensal
    │   ├── /operacional/medicoes         Medicoes
    │   ├── /operacional/despesas-de-campo DespesasDeCampo
    │   ├── /operacional/veiculos         Veiculos
    │   └── /operacional/diarias-veiculos DiariasVeiculos
    ├── /sala-tecnica/*
    │   ├── /sala-tecnica/arquivos        (placeholder)
    │   └── /sala-tecnica/entregas        (placeholder)
    ├── /financeiro/*
    │   ├── /financeiro/dashboard         FinanceiroDashboard
    │   ├── /financeiro/faturamento       (placeholder)
    │   ├── /financeiro/pagamentos        (placeholder)
    │   └── /financeiro/contas            (placeholder)
    ├── /rh/*
    │   ├── /rh/funcionarios              Funcionarios
    │   ├── /rh/ausencias                 RelatorioAusencias
    │   ├── /rh/documentos                (placeholder)
    │   └── /rh/exames                    (placeholder)
    └── /admin/* (somente master)
        ├── /admin/usuarios               UserManagement
        ├── /admin/cadastros              CadastrosBase
        └── /admin/clientes               Clientes
```

**Protecao de rotas:**
- `ProtectedRoute`: redireciona para `/login` se nao autenticado; redireciona para `/change-password` se `must_change_password = true`
- `AuthRoute`: redireciona para `/` se ja autenticado
- `ChangePasswordRoute`: acessivel somente quando `must_change_password = true`

---

## Modulos do Sistema

### 1. Dashboard (`/`)
Painel principal com KPIs de projetos, leads, propostas, alertas e despesas. Visao diferenciada para diretores.

### 2. Comercial (`/comercial`)
- **Leads**: Kanban + lista com maquina de estados (novo → qualificado → proposta_enviada → aprovado → convertido/perdido). Conversao de lead cria projeto + alertas automaticamente.
- **Clientes**: Cadastro com CNPJ, segmento e contato

### 3. Propostas (`/propostas`)
Criacao de propostas com itens de linha, calculo de custos com desconto, geracao assistida por IA. Status: rascunho → enviada → aprovada/rejeitada → convertida.

### 4. Projetos (`/projetos`)
Kanban de 6 colunas: Planejamento → Execucao → Entrega → Faturamento → Concluido/Pausado. Servicos com beneficios, medicoes e modos de faturamento (fixo_mensal, diarias, esporadico).

### 5. Operacional (`/operacional`)
- **Equipes**: Criacao e atribuicao de membros com roles de campo
- **Escala Diaria**: Alocacao de funcionarios/veiculos por dia, check-in/out, relatorio diario
- **Escala Mensal**: Planejamento mensal com sincronizacao para escalas diarias
- **Medicoes**: Registros de medicao com status (rascunho → aguardando_nf → nf_emitida → pago/cancelado)
- **Despesas de Campo**: Planilhas de despesas com itens detalhados
- **Veiculos**: Cadastro, manutencao, alocacao e diarias

### 6. Financeiro (`/financeiro`)
Dashboard de faturamento, pagamentos e acompanhamento por projeto.

### 7. RH (`/rh`)
Cadastro de funcionarios com cargos (variantes de Topografo definidas em `lib/fieldRoles.ts`), ausencias (ferias, licenca_medica, afastamento, falta).

### 8. Sala Tecnica (`/sala-tecnica`)
Modulo placeholder para gestao de arquivos tecnicos e entregas.

### 9. Admin (`/admin`) - somente role master
Gestao de usuarios (criacao via Edge Function), cadastros base e clientes.

---

## Autenticacao e Autorizacao

### Fluxo de Autenticacao

```
Login (email/senha)
  ↓
Supabase Auth (onAuthStateChange)
  ↓
Carrega profile + user_roles em paralelo (Promise.all)
  ↓
must_change_password? → /change-password
  ↓
Sessao ativa (localStorage, auto-refresh)
  ↓
AuthContext disponibiliza: user, session, profile, role, isMaster
```

### Criacao de Usuarios (Edge Function `create-user`)
1. Verifica header Authorization do chamador
2. Confirma role `master` via tabela user_roles
3. Cria usuario via Supabase Admin API (`email_confirm: true`)
4. Insere profile com `must_change_password: true`
5. Atribui role na tabela user_roles

### Roles e Acesso

| Role           | Acesso                                    |
|----------------|-------------------------------------------|
| master         | Acesso total + Admin + criacao de usuarios|
| diretor        | Dashboard estrategico                     |
| operacional    | Operacoes de campo, equipes, escalas      |
| comercial      | Leads, clientes, propostas                |
| financeiro     | Dados financeiros                         |
| sala_tecnica   | Entregas tecnicas                         |

---

## Padroes de Dados (TanStack Query)

### Chaves de Query

Hierarquicas para invalidacao granular:

```typescript
["projects"]                          // Colecao raiz
["projects-active"]                   // Variante filtrada
["leads"]                             // Colecao raiz
["leads", id]                         // Recurso individual
["lead_interactions", leadId]         // Recurso aninhado
["monthly-schedules", month, year]    // Parametrizado por tempo
["alerts", "unread_count"]            // Agregacao
```

### Padrao de Mutations

Todas as mutations seguem o mesmo padrao com invalidacao automatica:

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

Updates invalidam tanto a colecao quanto o recurso individual:

```typescript
onSuccess: (_, vars) => {
  qc.invalidateQueries({ queryKey: ["leads"] });
  qc.invalidateQueries({ queryKey: ["leads", vars.id] });
}
```

### Composicao de Mutations

Operacoes complexas orquestram multiplas mutations. Exemplo: conversao de lead cria projeto + alertas em sequencia via `useLeadConversion()`.

### Estrategias de Refresh

| Dado            | Estrategia                                  |
|-----------------|---------------------------------------------|
| Projetos        | `staleTime: 0`, `refetchOnMount: "always"`  |
| Alertas         | `refetchInterval: 30000` (polling 30s)      |
| Confirmacoes    | `refetchInterval: 30000` (polling 30s)      |
| Demais entidades| Default TanStack (staleTime ~5min)           |

### Queries Condicionais

Queries dependentes usam flag `enabled` para evitar fetches desnecessarios:

```typescript
export function useLeadById(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", id],
    enabled: !!id,
    queryFn: async () => { ... }
  });
}
```

---

## Composicao de Componentes

### Layout Principal (AppLayout)

```
AppLayout (flex row, min-h-screen)
├── AppSidebar (largura 16px|64px, colapsavel)
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

Consistente em todo o sistema:
- `Dialog` ou `Drawer` do shadcn/ui como container
- `React Hook Form` para gerenciamento de estado do formulario
- `Zod` para validacao de schema
- Mesmo componente para criacao e edicao (modo controlado por props)

### Responsividade

- Hook `use-mobile` detecta dispositivos moveis
- Sidebar colapsa automaticamente
- Layouts adaptaveis com grid Tailwind

---

## Banco de Dados (Supabase/PostgreSQL)

### Tabelas Principais

| Tabela                          | Descricao                                |
|---------------------------------|------------------------------------------|
| profiles                        | Perfis de usuario (fk auth.users)        |
| user_roles                      | Atribuicao de roles por usuario          |
| employees                       | Cadastro de funcionarios (CPF, cargo)    |
| teams / team_members            | Equipes e membros (CASCADE delete)       |
| projects                        | Projetos (status, valor, datas, billing) |
| project_services                | Servicos dentro de projetos              |
| project_benefits                | Beneficios por servico                   |
| clients                         | Clientes (CNPJ, segmento, endereco)     |
| leads                           | Leads comerciais com interacoes          |
| proposals / proposal_items      | Propostas e itens de linha               |
| measurements                    | Medicoes de campo por projeto            |
| daily_schedules                 | Escalas diarias (cabecalho)              |
| daily_schedule_entries          | Presenca individual (check-in/out)       |
| daily_team_assignments          | Atribuicao equipe→dia (projeto, veiculo) |
| monthly_schedules               | Escalas mensais de planejamento          |
| field_expense_sheets/items      | Planilhas de despesas de campo           |
| vehicles                        | Frota de veiculos                        |
| vehicle_payment_history         | Historico de pagamentos de veiculos      |
| employee_project_authorizations | Autorizacoes de funcionarios por projeto |
| alerts                          | Alertas do sistema (prioridade, modulo)  |
| schedule_confirmations          | Confirmacoes de escala                   |

### Enums

```sql
employee_status:    disponivel | ferias | licenca | afastado | desligado
vehicle_status:     disponivel | em_uso | manutencao | indisponivel
attendance_status:  presente | falta | justificado | atrasado
alert_priority:     urgente | importante | informacao
alert_recipient:    operacional | comercial | financeiro | rh | sala_tecnica | diretoria | todos
app_role:           master | diretor | operacional | sala_tecnica | comercial | financeiro
absence_type:       ferias | licenca_medica | licenca_maternidade | licenca_paternidade | afastamento | falta | outros
billing_mode:       fixo_mensal | diarias | esporadico
```

### Padroes de Schema

**RLS (Row Level Security):**
Habilitado em todas as tabelas. Atualmente com politicas permissivas para usuarios autenticados (a ser refinado por role):
```sql
CREATE POLICY "Authenticated users full access"
  ON public.employees FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**Triggers de updated_at:**
Todas as tabelas com coluna `updated_at` possuem trigger automatico:
```sql
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Restricoes compostas:**
```sql
-- Um registro por funcionario por dia
UNIQUE(daily_schedule_id, employee_id)
-- Um membro por equipe
UNIQUE(team_id, employee_id)
```

**Cascading deletes:**
Membros de equipe e entradas de escala usam `ON DELETE CASCADE` para manter integridade referencial.

---

## Infraestrutura de Email

### Arquitetura da Fila (pgmq)

```
Supabase Edge Function (process-email-queue)
  ↓
pgmq (PostgreSQL Message Queue)
  ├── auth_emails       (TTL 15min, alta prioridade)
  └── transactional_emails (TTL 60min)
  ↓
Envio com rate limiting
  ↓
email_send_log (auditoria)
  ↓
Falhas → Dead Letter Queue (DLQ)
```

### Tabelas de Suporte

| Tabela               | Descricao                                         |
|----------------------|---------------------------------------------------|
| email_send_log       | Log de envio (status: pending/sent/failed/dlq)    |
| email_send_state     | Estado de rate limiting (batch_size, delay_ms)     |
| suppressed_emails    | Emails suprimidos (bounce, complaint, unsubscribe) |
| email_unsubscribe_tokens | Tokens de unsubscribe                         |

### Seguranca

Funcoes de fila restritas a `service_role` com `SECURITY DEFINER`:
```sql
REVOKE EXECUTE ON FUNCTION public.enqueue_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email TO service_role;
```

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

## Variaveis de Ambiente

```
VITE_SUPABASE_URL              # URL da instancia Supabase
VITE_SUPABASE_PUBLISHABLE_KEY  # Chave publica (anon key) do Supabase
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

## Decisoes Arquiteturais e Dividas Tecnicas

### Decisoes

1. **TanStack Query como camada de dados**: Toda comunicacao com Supabase passa por hooks dedicados, centralizando cache, invalidacao e tratamento de erros.
2. **shadcn/ui + Radix**: Componentes acessiveis e composiveis sem lock-in de biblioteca UI.
3. **Edge Functions para operacoes privilegiadas**: Criacao de usuarios e processamento de email requerem `service_role`, isolados em funcoes serverless.
4. **pgmq para emails**: Fila nativa do PostgreSQL evita dependencia externa para processamento assincrono.

### Dividas Tecnicas

1. **RLS permissivo**: Politicas atuais concedem acesso total a usuarios autenticados. Necessita refinamento por role.
2. **Modulos placeholder**: Sala Tecnica, partes de Financeiro e RH (documentos, exames) ainda sao placeholders.
3. **Tipos auto-gerados**: `types.ts` depende de regeneracao quando schema muda (`supabase gen types`).
