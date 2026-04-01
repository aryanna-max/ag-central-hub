# Arquitetura - AG Central Hub

## Visao Geral

Sistema de gestao empresarial para operacoes de campo, projetos e vendas. Construido com React + TypeScript no frontend e Supabase (PostgreSQL) como backend.

---

## Stack Tecnologico

| Camada         | Tecnologia                                    |
|----------------|-----------------------------------------------|
| Framework      | React 18 + TypeScript 5.8                     |
| Build          | Vite 8                                        |
| Roteamento     | React Router DOM 6                            |
| Estado servidor| TanStack React Query 5                        |
| Estado auth    | React Context (AuthContext)                   |
| UI             | shadcn/ui (Radix UI) + Tailwind CSS 3        |
| Backend        | Supabase (Postgrest, Auth, Realtime)          |
| Mapas          | Leaflet / React Leaflet                       |
| Graficos       | Recharts                                      |
| Formularios    | React Hook Form + Zod                         |
| Testes         | Vitest + Playwright                           |

---

## Estrutura de Diretorios

```
src/
  pages/           # Componentes de pagina (nivel de rota)
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
    supabase/       #   Cliente e tipos do banco
  lib/              # Utilitarios e constantes
  assets/           # Imagens e arquivos estaticos
  test/             # Configuracao de testes
```

---

## Modulos do Sistema

### 1. Dashboard (`/`)
Painel principal com KPIs de projetos, leads, propostas, alertas e despesas. Visao diferenciada para diretores.

### 2. Comercial (`/comercial`)
- **Leads**: Kanban + lista, maquina de estados (novo -> qualificado -> proposta_enviada -> aprovado -> convertido/perdido)
- **Clientes**: Cadastro com CNPJ, segmento e contato

### 3. Propostas (`/propostas`)
Criacao de propostas com itens, calculo de custos, desconto, geracao assistida por IA. Status: rascunho -> enviada -> aprovada/rejeitada -> convertida.

### 4. Projetos (`/projetos`)
Kanban de 6 colunas: Planejamento -> Execucao -> Entrega -> Faturamento -> Concluido/Pausado. Servicos, medicoes e modos de faturamento (fixo mensal, diarias, esporadico).

### 5. Operacional (`/operacional`)
- **Equipes**: Criacao e atribuicao de membros
- **Escala Diaria**: Alocacao de funcionarios/veiculos por dia, check-in/out
- **Escala Mensal**: Planejamento mensal de equipes
- **Medicoes**: Registros de medicao de campo
- **Despesas de Campo**: Planilhas de despesas com itens
- **Veiculos**: Cadastro, manutencao e alocacao

### 6. Financeiro (`/financeiro`)
Dashboard de faturamento, pagamentos e acompanhamento por projeto.

### 7. RH (`/rh`)
Cadastro de funcionarios, cargos (variantes de Topografo), ausencias (ferias, licenca medica, afastamento).

### 8. Sala Tecnica (`/sala-tecnica`)
Modulo placeholder para gestao de arquivos tecnicos e entregas.

### 9. Admin (`/admin`) - somente role master
Gestao de usuarios, cadastros base e clientes.

---

## Autenticacao e Autorizacao

**Fluxo:**
1. Login via Supabase Auth (email/senha)
2. Troca de senha obrigatoria no primeiro acesso (`must_change_password`)
3. Sessao persistida em localStorage com auto-refresh
4. Perfil e role carregados via AuthContext

**Roles:**
| Role           | Acesso                                    |
|----------------|-------------------------------------------|
| master         | Acesso total + Admin                      |
| diretor        | Dashboard estrategico                     |
| operacional    | Operacoes de campo                        |
| comercial      | Leads, clientes, propostas                |
| financeiro     | Dados financeiros                         |
| sala_tecnica   | Entregas tecnicas                         |

---

## Padroes Arquiteturais

### Hooks de Dados (TanStack Query)
Cada entidade possui um hook dedicado (`useProjects`, `useLeads`, `useClients`, etc.) que encapsula:
- Queries com cache automatico
- Mutations para CRUD com invalidacao de cache
- Chaves de query semanticas

### Componentes de Formulario
Padrao consistente: `Dialog` + `React Hook Form` + `Zod` para validacao. Formularios de criacao e edicao compartilham o mesmo componente.

### Navegacao
Sidebar colapsavel com badges de alertas por modulo. Rotas protegidas redirecionam para `/login` se nao autenticado.

### Responsividade
Hook `use-mobile` para deteccao de dispositivo. Layouts adaptaveis com grid Tailwind.

---

## Banco de Dados (Supabase/PostgreSQL)

### Tabelas Principais

| Tabela                          | Descricao                                |
|---------------------------------|------------------------------------------|
| profiles                        | Perfis de usuario                        |
| user_roles                      | Atribuicao de roles                      |
| employees                       | Cadastro de funcionarios                 |
| teams / team_members            | Equipes e membros                        |
| projects                        | Projetos (status, valor, datas)          |
| project_services                | Servicos dentro de projetos              |
| clients                         | Clientes (CNPJ, segmento)               |
| leads                           | Leads comerciais                         |
| proposals / proposal_items      | Propostas e itens                        |
| measurements                    | Medicoes de campo                        |
| daily_schedules                 | Escalas diarias                          |
| daily_schedule_entries          | Entradas de presenca diaria              |
| monthly_schedules               | Escalas mensais                          |
| field_expense_sheets/items      | Planilhas de despesas                    |
| vehicles                        | Veiculos                                 |
| alerts                          | Alertas do sistema                       |

### Enums Importantes
- `employee_status`: disponivel, ferias, licenca, afastado, desligado
- `alert_priority`: urgente, importante, informacao
- `app_role`: master, diretor, operacional, sala_tecnica, comercial, financeiro
- `absence_type`: ferias, licenca_medica, afastamento, falta, outros
- `billing_mode`: fixo_mensal, diarias, esporadico

---

## Variaveis de Ambiente

```
VITE_SUPABASE_URL          # URL da instancia Supabase
VITE_SUPABASE_PUBLISHABLE_KEY  # Chave publica do Supabase
```

---

## Scripts de Desenvolvimento

```bash
npm run dev        # Servidor de desenvolvimento (localhost:8080)
npm run build      # Build de producao
npm run lint       # Verificacao ESLint
npm run test       # Testes unitarios (Vitest)
npm run preview    # Preview do build de producao
```
