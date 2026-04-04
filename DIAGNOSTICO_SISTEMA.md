# DIAGNOSTICO COMPLETO DO SISTEMA AG CENTRAL HUB

**Data:** 03/04/2026 (atualizado)
**Versao:** 2.0

---

## SUMARIO EXECUTIVO

| Modulo | Status | Observacao |
|--------|--------|-----------|
| Comercial (Leads/Propostas/Clientes) | ✅ Funcional | Funil completo, Oportunidades eliminado |
| Operacional (Escala/Veiculos/Equipes) | ✅ Funcional | Filtros is_legacy, show_in_operational, diarias automaticas |
| Sala Tecnica (Kanban/Tarefas) | ✅ Funcional | TECH_ROLES centralizado, responsaveis editaveis |
| Financeiro (Medicoes/Faturas) | ✅ Funcional | nf_data nos relatorios, invoices linkadas |
| Projetos (Hub central) | ✅ Funcional | service como Select, execution_status por modulo |
| RH (Funcionarios/Ferias) | ✅ Funcional | Role como Select, sync status-ferias |
| Dashboard (Radar) | ✅ Funcional | Alertas padronizados (resolved boolean) |
| Admin (Usuarios/Config) | ✅ Funcional | SystemSettings UI, senha aleatoria |
| Aprovacao Externa | ✅ Funcional | Pagina publica mobile, status "aprovado" correto |

**Problemas criticos restantes:** 0
**Divida tecnica:** ~70 casts `as any` nos hooks (funciona, sem type safety)

---

## 1. ALTERACOES REALIZADAS NESTA SESSAO

### Fase 1 — Filtros criticos (9 itens)
- [x] useDailySchedule: filtro is_legacy=false
- [x] useMonthlySchedules: filtro is_legacy=false
- [x] useVehicles: hook useActiveVehicles com status=disponivel
- [x] EscalaDiaria: fallback team_id corrigido (null, nao schedule.id)
- [x] EscalaDiaria: validacao project_id antes do insert
- [x] useProposals: responsible_id na interface (ja existia)
- [x] Dropdowns operacionais: useActiveVehicles em 4 arquivos
- [x] Filtro execution_status por modulo (aguardando_campo, em_campo)
- [x] Toggle "Mostrar todos os projetos ativos" nos dropdowns

### Fase 2 — Integridade de dados (11 itens)
- [x] C2: Lista de servicos centralizada em serviceTypes.ts
- [x] C3: Filtro responsaveis centralizado em isCommercialDirector()
- [x] C4: Modulo Oportunidades eliminado (3 arquivos deletados)
- [x] C5: Conversao de lead salva contato em client_contacts
- [x] RH2: Role funcionario como Select com FIELD_ROLES
- [x] A1: Senha padrao removida, gera aleatoria com dialog
- [x] D1: Alertas padronizados (resolved + alert_status)
- [x] F2: Relatorios financeiros usam nf_data
- [x] F3: execution_status como status primario na UI
- [x] ST2: TECH_ROLES centralizado em fieldRoles.ts
- [x] ST3: Editar responsible_tecnico/campo no detalhe ST

### Fase 3 — Melhorias (6 itens)
- [x] C6: Propostas ordenadas por status (enviada primeiro)
- [x] C7: Badge "Expirada" para propostas vencidas
- [x] C8: Motivo de perda exibido separadamente com badge
- [x] O9: Duplicate errors logados (console.warn)
- [x] ST4: MinhasTarefas com descricao e prioridade
- [x] P3: Retry na geracao de codigo para race condition

### Decisoes fechadas
- [x] F3: Status duplo simplificado (execution_status primario)
- [x] P2: parent_project_id dropado (unico campo legado restante)
- [x] RH3: Sync employee.status com employee_vacations

### Features novas
- [x] show_in_operational: controla visibilidade de projetos no Operacional
- [x] Pagina aprovacao externa /aprovacao/:token (mobile, sem login)
- [x] Botoes Submeter + Copiar Link nas folhas de despesa
- [x] Diarias de veiculos automaticas ao fechar escala
- [x] SystemSettings UI em /admin/configuracoes
- [x] Link medicoes -> invoices automatico ao registrar NF

### Fluxo Operacional ajustado
- [x] Escala diaria: subtitulo dinamico (amanha=montar, hoje=confirmar)
- [x] Confirmacao de escala eliminada (so fechamento)
- [x] Mensal renomeada "Visao Mensal" (facilitador, nao obrigatorio)
- [x] Labels: Radar, Negocios, Campo, Prancheta, Faturamento, Pessoas

### SQLs executados no banco
- [x] show_in_operational (boolean, default true) em projects
- [x] approval_token (uuid) e approval_comments (jsonb) em field_expense_sheets
- [x] Limpeza: 3 escalas legado + 18 teams + 18 veiculos deletados
- [x] DROP parent_project_id de projects

---

## 2. IMPORT / EXPORT — REGRAS DE SEGURANCA

### Cadastros que PODEM ser importados via planilha

| Cadastro | Risco | Condicao | Planilha modelo |
|----------|-------|---------|----------------|
| Veiculos | ✅ Seguro | Tabela vazia, sem dependencias | PLANILHA_VEICULOS.csv |
| Equipes (Grupos) | ✅ Seguro | Tabela vazia, sem dependencias | PLANILHA_EQUIPES.csv |
| Membros de Equipe | ✅ Seguro | Vincula por nome do funcionario | PLANILHA_MEMBROS_EQUIPE.csv |
| Clientes (novos) | ⚠️ Com cuidado | Verificar duplicidade por CNPJ antes | PLANILHA_CLIENTES.csv |
| Funcionarios (update) | ⚠️ Com cuidado | Atualizar dados, NAO duplicar | Sob demanda |

### Cadastros que NAO devem ser importados

| Cadastro | Motivo |
|----------|--------|
| Projetos | Muitas FKs em cascata (escalas, medicoes, despesas, alertas) |
| Leads | Vinculados a clientes, propostas, projetos convertidos |
| Propostas | Vinculadas a leads e clientes |
| Medicoes | Vinculadas a projetos e invoices |
| Escalas | Geradas pelo fluxo operacional (mensal -> diaria) |

### Processo de importacao seguro
1. Preencher planilha CSV modelo
2. Enviar para Claude gerar SQL de INSERT/UPDATE
3. SQL verifica duplicidade antes de inserir
4. Rodar SQL no SQL Editor do Lovable
5. Verificar contagens pos-importacao

### Exportacao
- Qualquer tabela pode ser exportada via SELECT no SQL Editor
- Scripts de export prontos em SQL_BACKUP_EXPORT.sql
- SQL_EXPORT_VEICULOS_TEAMS.sql (dados antes da limpeza — ja executado)

---

## 3. ESTADO ATUAL DO BANCO

### Contagem de registros (03/04/2026)

| Tabela | Registros | Observacao |
|--------|-----------|-----------|
| leads | 21 | Ativos |
| clients | 51 | Filtrados por codigo NOT NULL |
| projects | 77 | Com show_in_operational |
| project_services | 80 | |
| employees | 64 | Filtrados por status != desligado |
| proposals | 0 | Ainda nao criadas |
| alerts | 38 | |
| teams | 0 | Limpo, aguardando repovoamento |
| vehicles | 0 | Limpo, aguardando repovoamento |
| daily_schedules | 2 | Nao-legado |
| monthly_schedules | 0 | |
| measurements | 0 | |
| field_expense_sheets | 0 | |

### Enums existentes (todos migrados)
- lead_status: 8 valores (inclui em_contato, proposta_enviada, aprovado, perdido)
- execution_status: 10 valores
- proposal_status: 5 valores
- measurement_status: 6 valores
- removal_reason: 6 valores
- empresa_faturadora_enum: 2 valores
- tipo_documento: 2 valores

### Tabelas novas (todas criadas)
- project_scope_items ✅
- project_status_history ✅
- technical_tasks ✅
- invoices ✅
- invoice_items ✅
- employee_vacations ✅

---

## 4. MAPA DE DEPENDENCIAS ENTRE MODULOS

```
                    ┌─────────────┐
                    │    Radar    │
                    │ (Dashboard) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        v                  v                  v
┌───────────┐    ┌─────────────┐    ┌─────────────┐
│ Negocios  │    │    Campo    │    │  Prancheta  │
│  (Leads)  │    │  (Escalas)  │    │  (Tarefas)  │
└─────┬─────┘    └──────┬──────┘    └──────┬──────┘
      │                 │                  │
      v                 v                  v
┌─────────────────────────────────────────────────┐
│              PROJETOS (Hub Central)              │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────┴───────┐
              │  Faturamento  │
              │  (Medicoes)   │
              └───────────────┘

Transversais: Pessoas (employees), Clientes
```

### Fluxo principal

```
Lead (Negocios)
  → Proposta
    → Projeto
      → Escala de campo (Campo)
        → Fechar escala = diarias de veiculo automaticas
          → Tarefas tecnicas (Prancheta)
            → Medicao/Fatura (Faturamento)

Folha de despesa semanal (Campo)
  → Submeter → Copiar link WhatsApp
    → Diretoria Comercial aprova via celular
      → Financeiro recebe email
```

---

## 5. DIVIDA TECNICA (nao bloqueante)

| Item | Quantidade | Impacto |
|------|-----------|---------|
| Casts `as any` nos hooks | ~25 | Sem type safety, funciona |
| Casts `as any` nas pages | ~45 | Idem |
| document.write() no print | 1 | Funciona mas padrao antigo |
| console.warn/error intencionais | 6 | Corretos, para debug |

---

## 6. PENDENCIAS DE DADOS

| O que | Quem | Status |
|-------|------|--------|
| Cadastrar veiculos novos | Gerente Operacional | Planilha modelo pronta |
| Cadastrar equipes/grupos | Gerente Operacional | Planilha modelo pronta |
| Definir show_in_operational nos projetos BRK | Diretoria | SQL pronto quando decidir |
| Testar fluxo escala no celular | Gerente Operacional | Aguardando |
| Testar pagina aprovacao no celular | Diretoria Comercial | Aguardando |

---

## 7. DECISOES ARQUITETURAIS FECHADAS NESTA SESSAO

| # | Decisao | Resolucao |
|---|---------|-----------|
| 14 | Oportunidades vs Leads | Oportunidades eliminado — usar apenas Leads |
| 15 | Status duplo na UI | execution_status primario, project_status interno |
| 16 | NF gerada fora ou dentro | Fora por enquanto — avaliar integracao futura |
| 17 | Sergio e Ciro | Diretores Comerciais — aprovam folhas |
| 18 | BRK no Operacional | show_in_operational controla visibilidade |
| 19 | Escala mensal obrigatoria | Opcional — facilitador de pre-preenchimento |
| 20 | Confirmacao de escala | Eliminada — so existe fechamento |
| 21 | Diarias de veiculos | Automaticas ao fechar escala diaria |
| 22 | Aprovacao de despesas | Via link externo (WhatsApp), sem login |
| 23 | Labels dos modulos | Nomes criativos: Radar, Negocios, Campo, Prancheta, Pessoas |

---

*Relatorio atualizado em 03/04/2026 — Versao 2.0*
