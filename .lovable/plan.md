## Plano: Edição de Escala Mobile + Interface Mobile de Despesas de Campo

### Problema

1. **Escala Mobile** (`MobileDailySchedule.tsx`): Só exibe equipes e permite fechar — falta o botão "Adicionar à Escala" com modal para selecionar projeto, funcionários e veículo (funcionalidade que existe no desktop `EscalaDiaria.tsx`)
2. **Despesas de Campo Mobile**: Não existe interface mobile — ao acessar `/operacional/despesas-de-campo` no celular, aparece a versão desktop

### Implementação

#### 1. Adicionar funcionalidade de edição à Escala Mobile

**Arquivo:** `src/components/mobile/schedule/MobileDailySchedule.tsx`

- Adicionar botão FAB "+" flutuante (ao lado do "Fechar Escala") quando escala existe e não está fechada
- Criar drawer/sheet mobile `AddToScheduleSheet.tsx` com:
  - Select de projeto (lista operacional)
  - Busca e seleção de funcionários (checkboxes com busca)
  - Atalho "Grupos Rápidos" para pré-carregar membros
  - Select de veículo (opcional)
  - Botão salvar que cria `daily_team_assignment` + `daily_schedule_entries`
- Reutilizar hooks existentes: `useAddTeamAssignment`, `useAddDailyEntry`, `useTeams`, `useActiveVehicles`, `useEmployees`

**Novo arquivo:** `src/components/mobile/schedule/AddToScheduleSheet.tsx`

#### 2. Interface Mobile de Despesas de Campo

**Novo arquivo:** `src/components/mobile/expenses/MobileExpenses.tsx`

- Lista de folhas de despesa como cards (semana, período, total, status com badge colorido)
- KPIs horizontais no topo (Total, Pendentes, Aprovadas)
- Botão "Nova Folha" no header
- Ação de submeter e copiar link de aprovação
- Tap no card abre detalhe

**Arquivo editado:** `src/pages/operacional/DespesasDeCampoTabs.tsx`

- Adicionar `useIsMobile()` → se mobile, renderizar `MobileExpenses` ao invés do layout desktop com tabs

#### 3. Roteamento

**Arquivo:** `src/components/mobile/BottomNav.tsx`

- Sem alteração necessária — o acesso a despesas já é via menu lateral (MobileMenuSheet)

### Arquivos a criar

- `src/components/mobile/schedule/AddToScheduleSheet.tsx`
- `src/components/mobile/expenses/MobileExpenses.tsx`

### Arquivos a editar

- `src/components/mobile/schedule/MobileDailySchedule.tsx` — adicionar botão + e integrar sheet
- `src/pages/operacional/DespesasDeCampoTabs.tsx` — condicional mobile

### Sem migrations necessárias

Tudo usa tabelas existentes.

O PROMPT 1 NAO FOI EXECUTADO COMPLETO, NAO VEJO SAUDAÇÃO POR EXEMPLO. QUERO OPÇÃO DE ORDENAR ALFANUMERICAMENTE QUALQUER COLUNA DE QUALQUER TABELA CLICANDO NO SEU NOME. OS FILTROS DE VISUALIZAÇÃO TB NAO ESTAO FUNCIONANDO, EX: SE QUISER OCULTAR ALGUMA COLUNA, EX: APROVADA QUE SERIA O MESMO QUE CONVERTIDA.