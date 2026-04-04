# AG Central Hub — Contexto Completo para Claude Code

## O que é este projeto
Sistema de gestão interna da **AG Topografia**, empresa de topografia e cartografia em Pernambuco. Gerencia o ciclo completo: captação de clientes (Comercial) → execução de campo (Operacional) → processamento técnico (Sala Técnica) → faturamento (Financeiro).

**Stack:** React + TypeScript + Vite + ShadcnUI + TailwindCSS + Supabase (PostgreSQL + Auth + RLS)
**Hospedagem:** Lovable (gerencia deploy e Supabase integrado)
**Supabase Project ID:** bphgtvwgsgaqaxmkrtqj
**Lovable Project ID:** e5b79b44-8865-4599-b013-f3e91865a8f0

---

## Meta de Qualidade — Nota Arquitetural

**Objetivo:** chegar a **10/10**
**Ponto de partida:** 2.8/10 (antes das correções de abril/2026)
**Estado atual:** ~5.2/10 (após diagnóstico fase imediata — 04/04/2026)

| Faixa | Marco | Status |
|-------|-------|--------|
| **5-6** | SQL Fases 1-4 executadas (campos sujos, tabelas novas, tabelas mortas) | Em andamento |
| **6-7** | Sala Técnica funcional, Financeiro com pipeline real, execution_status em todos os módulos | Pendente |
| **7-8** | Alertas automáticos (email Alcione), aprovação despesas via WhatsApp, relatórios por módulo | Pendente |
| **8-9** | Dados 100% limpos, clientes deduplicados, ViaCEP, histórico de status | Pendente |
| **9-10** | Import/export estável, mobile polido, filtros avançados, zero bugs, performance otimizada | Pendente |

---

## REGRAS CRÍTICAS

### Supabase MCP — SEM ACESSO
O Supabase MCP **NÃO TEM ACESSO** a este projeto (retorna "permission denied"). O Lovable gerencia seu próprio Supabase internamente.
- NUNCA tentar `execute_sql`, `list_tables` etc. via MCP
- Alterações no banco: preparar SQL para Aryanna colar no **SQL Editor do Lovable**
- Para verificar estado atual: gerar query SELECT e pedir resultado, ou ler `src/integrations/supabase/types.ts`
- O GitHub (ag-central-hub) tem o types.ts como fonte de verdade do schema

### Prompts Lovable — Não desperdiçar créditos
- Uma seção por vez, confirmar antes de avançar
- Não alterar módulos não mencionados
- Não criar rotas não listadas
- Cada seção deve ser independente e testável

---

## Arquitetura — Documento de referência
**SEMPRE consultar:** `ARQUITETURA_DEFINITIVA_AG_v4.html` na pasta raiz do projeto (Sistema AG)

---

## Módulos do sistema

| Módulo | Usuário | Caminho páginas | Hook principal |
|--------|---------|-----------------|----------------|
| Comercial | Sérgio/Ciro | `pages/comercial/` | `useLeads`, `useProposals` |
| Operacional | Marcelo | `pages/operacional/` | `useDailySchedule`, `useMonthlySchedules`, `useTeams` |
| Sala Técnica | Emanuel Macedo | `pages/SalaTecnica.tsx` | (a implementar: `useTechnicalTasks`) |
| Financeiro | Alcione (via email) | `pages/financeiro/` | `useMeasurements`, `useExpenseSheets` |
| Projetos | Todos | `pages/projetos/` | `useProjects`, `useProjectServices` |
| RH | Aryanna | `pages/rh/` | `useEmployees` |
| Diretoria | Aryanna | `pages/Dashboard.tsx` | visão panorâmica |

---

## Decisões Arquiteturais

### 1. SEM subprojetos — usar project_services
**NÃO existe `parent_project_id`.** Quando o cliente pede serviços diferentes no mesmo local, cada pedido vira um **novo serviço** (`project_services`) dentro do mesmo projeto. A tabela já existe com `billing_mode`, `contract_value`, `status`, `cnpj_tomador`. NFs se ligam a serviços via `invoice_items`.

Exemplo:
```
Projeto: 2026-COL-001 — Colorado Lote 5
  ├─ Serviço 1: Levantamento (diarias, R$ 800/dia)
  ├─ Serviço 2: Marcação de lotes (esporadico, R$ 15.000)
  └─ Serviço 3: Equipe mensal (fixo_mensal, R$ 25.000/mês)
```

Ano diferente + mesmo local = projeto novo (código novo).

### 2. Status duplo em projetos
- `project_status` (enum, 6 valores): planejamento, execucao, entrega, faturamento, concluido, pausado
- `execution_status` (enum, 10 valores): aguardando_campo → em_campo → campo_concluido → aguardando_processamento → em_processamento → revisao → aprovado → entregue → faturamento → pago
- Rodam em paralelo, um NÃO substitui o outro

### 3. Teams = Grupos Rápidos (presets)
Tabelas `teams` e `team_members` são atalhos para pré-preencher escalas. Não são equipes fixas. Na UI chamar "Grupos Rápidos".

### 4. Propostas dentro do Comercial
O módulo Propostas foi incorporado ao Comercial. `proposta_enviada`, `aprovado` e `perdido` são tags automáticas no lead.
Código da proposta: ANO-P-SEQ (ex: 2026-P-001) — sem sigla de cliente.

### 12. Lead convertido — rastreabilidade, não sync
Após conversão, o lead é snapshot histórico — não editar. Cliente e projeto são fontes da verdade independentes.
Vínculos de rastreabilidade:
- `leads.client_id` → cliente originado
- `leads.converted_project_id` → projeto criado
- `projects.lead_id` → lead de origem
A "história completa" do cliente e do projeto é obtida por JOIN, não por sync bidirecional.

### 5. Custos — NÃO ratear
Quando funcionário trabalha em BRK + outro projeto no mesmo dia, a diária vai para o projeto não-BRK. BRK tem medição própria. 1 presença = 1 custo total.

### 6. Escala bidirecional
`useMonthlySchedules.ts` já implementa sync: `syncDailyToMonthly` e `syncMonthlyToDaily`. Mensal é previsão, diário é verdade.

### 7. Alcione (Financeiro) não acessa o sistema
Alertas financeiros vão por email para `financeiro@agtopografia.com.br`. Infraestrutura: pgmq + pg_cron + vault (migration 20260330).

### 8. Marco Zero: 31/03/2026
Dados operacionais (escalas, ausências, despesas) anteriores a 31/03/2026 são legado. Coluna `is_legacy` já adicionada em daily_schedules, monthly_schedules, field_expense_sheets. Queries operacionais filtram `WHERE is_legacy = false`.

### 9. Férias
Tabela `employee_vacations` (a criar): employee_id, start_date, end_date, daily_rate (a definir), payment_method (a definir). Alerta bloqueante ao alocar funcionário de férias.

### 10. Validações operacionais
1. **Projeto ausente do diário**: projeto ativo sem escala no dia → exige motivo (removal_reason)
2. **Pessoa em 2+ projetos**: alerta de confirmação
3. **Campo concluído**: removal_reason = campo_concluido → trigger atualiza execution_status → alerta Sala Técnica

### 11. Cada módulo tem seu Kanban/view
Não existe Kanban único. Diretoria vê panorâmica. Sala Técnica nunca vê dados financeiros.

---

## Schema Atual — Estado do banco (31/03/2026)

### 31 tabelas existentes
alerts, attendance, calendar_events, clients, daily_schedule_entries, daily_schedules, daily_team_assignments, email_send_log, email_send_state, email_unsubscribe_tokens, employee_project_authorizations, employees, field_expense_items, field_expense_sheets, leads, measurements, monthly_schedules, profiles, project_benefits, project_services, projects, proposal_items, proposals, schedule_confirmations, suppressed_emails, system_settings, team_members, teams, user_roles, vehicle_payment_history, vehicles

### Contagem de registros (31/03/2026)
| Tabela | Registros |
|--------|-----------|
| projects | 77 |
| project_services | 80 |
| employees | 64 |
| clients | 51 |
| alerts | 38 |
| teams | 18 |
| vehicles | 18 |
| leads | 15 |
| daily_schedules | 5 (3 legado) |
| proposals, measurements, monthly_schedules, expense_sheets/items, daily_entries | 0 |

### Enums existentes (types.ts)
- `absence_type`: ferias, licenca_medica, licenca_maternidade, licenca_paternidade, afastamento, falta, outros
- `alert_priority`: urgente, importante, informacao
- `alert_recipient`: operacional, comercial, financeiro, rh, sala_tecnica, diretoria, todos
- `app_role`: master, diretor, operacional, sala_tecnica, comercial, financeiro
- `attendance_status`: presente, falta, justificado, atrasado
- `billing_mode`: fixo_mensal, diarias, esporadico
- `employee_status`: disponivel, ferias, licenca, afastado, desligado
- `field_payment_status`: rascunho, em_revisao, aprovada, paga, cancelada, submetido, devolvido
- `lead_interaction_type`: nota, ligacao, email, whatsapp, reuniao, visita
- `lead_source`: whatsapp, telefone, email, site, indicacao, rede_social, licitacao, outros
- `lead_status`: novo, em_contato, qualificado, convertido, descartado (faltam: proposta_enviada, aprovado, perdido)
- `opportunity_stage`: prospeccao, qualificacao, proposta_enviada, negociacao, fechado_ganho, fechado_perdido (OBSOLETO — eliminar)
- `project_status`: planejamento, execucao, entrega, faturamento, concluido, pausado
- `service_status`: planejamento, execucao, medicao, faturamento, concluido, cancelado
- `vehicle_status`: disponivel, em_uso, manutencao, indisponivel

### Enums a CRIAR
- `execution_status`: aguardando_campo, em_campo, campo_concluido, aguardando_processamento, em_processamento, revisao, aprovado, entregue, faturamento, pago
- `proposal_status`: rascunho, enviada, aprovada, rejeitada, expirada
- `measurement_status`: rascunho, aguardando_aprovacao, aprovada, nf_emitida, paga, cancelada
- `empresa_faturadora_enum`: ag_topografia, ag_cartografia
- `tipo_documento`: nf, recibo
- `removal_reason`: campo_concluido, pausa_temporaria, reagendado, clima, equipamento, falta_equipe

### Tabelas a CRIAR (6)
1. `project_scope_items` — itens de escopo (tipo ART/RRT)
2. `project_status_history` — log de mudanças de status
3. `technical_tasks` — tarefas da Sala Técnica
4. `invoices` — NFs e recibos
5. `invoice_items` — itens da NF (liga NF a serviços)
6. `employee_vacations` — períodos de férias

### Tabelas a ELIMINAR (3)
- `attendance` — duplicada com daily_schedule_entries
- `schedule_confirmations` — funcionalidade em daily_schedules.is_closed
- `email_unsubscribe_tokens` — absorvido por suppressed_emails

### Total final: 34 tabelas (31 - 3 + 6)

---

## Campos sujos a limpar (texto → FK)

### projects (7 campos)
- `client` (text) → já tem `client_id` FK
- `client_cnpj` (text) → join client_id → clients.cnpj
- `client_name` (text) → join client_id → clients.name
- `responsible` (text) → criar `responsible_id` FK → employees
- `cnpj` (text) → já tem `cnpj_tomador`
- `obra_id` (text) → eliminar
- `empresa_emissora` (text) → já tem `empresa_faturadora`
- `modalidade_faturamento` (text) → vive em project_services.billing_mode
- `has_multiple_services` (bool) → calculado, não precisa

### proposals (3 campos)
- `client_name` → client_id → clients
- `responsible` → criar responsible_id FK
- `opportunity_id` → módulo eliminado

### leads (2 campos)
- `responsible` → criar responsible_id FK
- `obra_id` → eliminar

### measurements (2 campos)
- `obra_id` → project_id já existe
- `responsavel_cobranca` → criar responsavel_cobranca_id FK

### field_expense_items (3 campos)
- `project_name` → join project_id → projects
- `receiver_name` → join receiver_id → employees
- `receiver_document` → join receiver_id → employees.cpf

### field_expense_sheets (1 campo)
- `approved_by` → approved_by_id já existe

### daily_schedules (1 campo)
- `created_by` → created_by_id já existe

### daily_team_assignments (1 campo)
- `obra_id` → project_id já existe

---

## Colunas a ADICIONAR

### projects
- `execution_status` (execution_status enum)
- `needs_tech_prep` (boolean, default true)
- `cep`, `rua`, `bairro`, `numero`, `cidade`, `estado` (text — auto-fill ViaCEP)
- `field_started_at`, `field_deadline`, `delivery_deadline`, `field_completed_at`, `delivered_at` (date)
- `field_days_estimated`, `delivery_days_estimated` (integer)
- `scope_description` (text)

### clients
- `cep`, `rua`, `bairro`, `numero`, `cidade`, `estado` (text)
- `requires_nf` (boolean, default true)
- `default_payment_days` (integer, default 30)
- `financial_notes` (text)

### leads
- `responsible_id` (FK → employees)
- `codigo` (text, ANO-L-SEQ)

### proposals
- `responsible_id` (FK → employees)

### project_services
- `proposal_id` (FK → proposals)
- `scope_description` (text)
- `daily_rate`, `monthly_rate` (numeric)

### measurements
- `project_service_id` (FK → project_services)
- `responsavel_cobranca_id` (FK → employees)

### field_expense_sheets
- `codigo` (text, ANO-SEQ — ex: 2026-001, reseta em janeiro)

### alerts
- `origem_modulo`, `tipo`, `alert_status` (text)
- `scheduled_at` (timestamptz)

### daily_schedule_entries
- `removal_reason` (removal_reason enum)
- `removed_at` (timestamptz)

---

## Códigos padronizados
| Entidade | Formato | Exemplo |
|----------|---------|---------|
| Cliente | 3 letras | BRK, COL, HBR, DIR |
| Projeto | ANO-SIGLA-SEQ | 2026-BRK-001 |
| Proposta | ANO-P-SEQ | 2026-P-001 (sem sigla de cliente, sequencial único por ano) |
| Lead | ANO-L-SEQ | 2026-L-001 |
| Folha Despesa | ANO-SEQ | 2026-001 (reseta em janeiro) |
| NF/Recibo | ANO-NF-SEQ / ANO-RC-SEQ | 2026-NF-001 |

---

## Limpeza de dados — Clientes duplicados

### Regra: Cliente ≠ Tomador
O cliente é a empresa-mãe. O tomador (SPE/filial com CNPJ diferente) fica em `cnpj_tomador` no projeto ou serviço. SPEs NÃO criam clientes separados.

### Direcional Engenharia (DIR)
Cliente único: `Direcional Engenharia` (id: e6720b0d-a82b-4483-bb84-c5363bf8c955, código: DIR)
- `Casa Amarela Empreendimentos` (CNPJ 57.237.395/0001-68) é SPE da Direcional → **NÃO é cliente separado**. Projetos com esse CNPJ devem ter `client_id = Direcional` e `cnpj_tomador = 57.237.395/0001-68`
- CNPJ filial Recife: 16.614.075/0049-47 → usar em cnpj_tomador dos projetos
- Projetos duplicados a resolver:
  - "Direcional 652C - Sucupira" = duplicata de "Direcional 652C Sucupira"
  - "Direcional 747 Petribu" = duplicata de "Direcional 747"
  - "Direcional 788C" = duplicata de "Direcional 788"

### Simproja = Sindicato Educ. Jaboatão
- Simproja é o mesmo cliente que "Sindicato Educ. Jaboatão" (CNPJ 41.229.436/0001-34)
- **Cliente sediado em Jaboatão dos Guararapes/PE** (NÃO é Goiana — são cidades diferentes)
- **Projeto localizado em Muribequinha/Carne de Vaca, Goiana/PE** (local da obra, diferente da sede do cliente)
- 3 serviços: 2 levantamentos para o Sindicato + 1 levantamento para Clube de Campo
- billing_type: `entrega_nf` (NF na entrega de cada serviço)
- Limpeza: deletar cliente "Simproja", migrar projeto para "Sindicato Educ. Jaboatão", cada serviço como project_service separado

### Billing type por cliente — regras definitivas (02/04/2026)

| Cliente | Sigla | billing_type | Observação |
|---|---|---|---|
| BRK Ambiental — Obras | BRK | `medicao_mensal` | Multi-localização, ciclo mensal |
| BRK Ambiental — Projetos | BRK | `entrega_nf` | Projetos pontuais |
| HBR — Tabaiares | HBR | `medicao_mensal` | R$18.500/mês, recorrente perfeito |
| HBR — demais projetos | HBR | `entrega_nf` | Santa Clara, Camaragibe, Parque Gourmet etc. |
| Engeko | EGK | `medicao_mensal` | R$19.500/mês, recorrente perfeito |
| Pernambuco Construtora / Porto de Pedra | PCPE | `medicao_mensal` | R$19.500/mês |
| JME | JME | `medicao_mensal` | Apex — arquivo de medição mensal confirmado |
| Flamboyant | FLMB | `medicao_mensal` | Castanhal/PA — arquivo de medição JAN/FEV confirmado |
| Gran Alpes | GRAN | `entrega_nf` | 2 serviços pontuais novos em Gravatá. Leo era intermediador, contato real = Rodrigo. Verificar leads. Os arquivos "MEDIÇAO GRAN ALPES" são tipo de serviço, não cobrança mensal |
| Encar | ENCAR | `medicao_mensal` | Sucupira Curado Arena — arquivo medição JAN/FEV confirmado |
| Colgravata (COL SPE) | COL | `medicao_mensal` | SPE Colorado com medição mensal |
| Colarcoverde (COL SPE) | COL | `medicao_mensal` | SPE Colorado — arquivo medição MAR/ABR confirmado |
| Demais SPEs Colorado (Colarrio, Colaru, Colapiraca etc.) | COL | `entrega_nf` | Serviços esporádicos, NF por entrega |
| Polimix | POL | `entrega_nf` | Esporádico — NF por entrega de cada serviço |
| Hoteis Salinas S/A (Grupo Amarante) | AMAR | `entrega_nf` | Tomador real nas NFs é Hoteis Salinas S/A. Grupo Amarante é o grupo. Esporádico |
| Direcional Engenharia + SPEs | DIR | `entrega_nf` | Modelo idêntico ao Colorado. SPEs confirmadas: Bromelia, Imperatriz, Casa Amarela, Lourdes (e outras). Cada SPE = 1 projeto com cnpj_tomador da SPE. Projetos às vezes cadastrados com código de contrato no nome (ex: 00095787) — corrigir manualmente. Não são duplicatas |
| Simproja / Sindicato Educ. Jaboatão | SIMP | `entrega_nf` | 2 serviços, 2 NFs. Sede em Jaboatão/PE, projeto em Goiana/PE |

> **ATENÇÃO:** O CLAUDE2.md e CLAUDE.md (Sistema AG/) têm billing_types errados para JME, Engeko, HBR e Colorado. Usar EXCLUSIVAMENTE esta tabela como referência.

---

## Pessoas-chave
- **Aryanna** — Diretora Administrativa, dona do sistema
- **Marcelo** — Operacional, escalas diárias/mensais
- **Emanuel Macedo** — Líder Sala Técnica (confirmado 31/03/2026)
- **Alcione** — Financeiro, recebe alertas por email, NÃO acessa o sistema
- **Sérgio/Ciro** — Comercial, gerenciam leads e propostas

---

## Frontend — Regras obrigatórias
- **Sidebar colapsável** — recolhe para strip de ícones, estado salvo por usuário (decisão 02/04/2026)
- Tabelas com scroll horizontal (`overflow-x: auto`)
- Títulos de colunas são filtros de ordenação (clique = asc/desc)
- Filtros de visualização em todas as telas e relatórios
- Sala Técnica nunca vê dados financeiros
- Cada módulo tem seu próprio Kanban/view
- **Projetos sem lead** aparecem no Comercial com tag visual "Sem lead" (decisão 02/04/2026)
- **Proposta pode ser criada sem lead** — vincula direto ao cliente existente; se cliente não existe, obriga lead (decisão 02/04/2026)

---

## Fases de migração SQL (executar no Lovable SQL Editor)

Arquivos na pasta `Sistema AG/`:

1. **SQL_FASE_0_DIAGNOSTICO.sql** — apenas SELECTs
2. **SQL_FASE_0b_MARCO_ZERO.sql** — marcar registros legados (já executado parcialmente)
3. **SQL_FASE_1_ENUMS.sql** — criar novos enums + corrigir lead_status
4. **SQL_FASE_2_TABELAS_COLUNAS.sql** — criar 6 tabelas + add colunas
5. **SQL_FASE_3_LIMPEZA_CAMPOS.sql** — migrar texto → FK, depois DROP campos sujos
6. **SQL_FASE_4_DROP_TABELAS.sql** — eliminar attendance, schedule_confirmations, email_unsubscribe_tokens

**ATENÇÃO:** Aryanna mexeu em coisas e o estado pode estar diferente do diagnosticado. Rodar novo diagnóstico antes de executar qualquer fase.

---

## Decisões arquiteturais — fechadas em 02/04/2026

| # | Decisão | Resolução |
|---|---|---|
| 10 | Direcional projetos duplicados | NÃO são duplicatas. São 2 projetos distintos assinados em 18/03/2026. Manter os dois com escopos diferentes |
| 11 | Sidebar colapsável ou fixa | **Colapsável** — recolhe para ícones, ganha espaço horizontal para Kanban e tabelas |
| 12 | Projetos sem lead no Comercial | **Aparecem** com tag "Sem lead" — Sérgio precisa de visão completa da carteira ativa |
| 13 | Proposta sem lead | **Permitido** para clientes já existentes. Cliente novo = obriga lead. |

## Decisões pendentes

| # | Pendência | Fonte | Impacto |
|---|---|---|---|
| 1 | Nomear líder Sala Técnica | Sérgio / Ciro | Módulo ST bloqueado |
| 2 | billing_type Direcional e Casa Amarela | Scripts / Sérgio | Cadastros incompletos |
| 3 | Diária de férias — valor e forma de pagamento | Scripts / RH | Tabela employee_vacations incompleta |
| 4 | Frequência relatórios automáticos (campo, veículos, ausências, férias) | Scripts | Email alerts não configurados |
| 5 | Categorias e centros de custo Meu Dinheiro | Alcione | Financeiro sem estrutura |
| 6 | Gran Alpes — verificar se está nos leads e qual o status | Leads no sistema | Cadastro cliente pendente |
| 7 | Integração NF — hoje gerada fora do sistema. Verificar APIs futuras (Enotas, Nuvem Fiscal, Focus NFe) para emissão automática | Diretoria | Financeiro — fase futura |

## Decisões fechadas (03/04/2026)

| # | Decisão | Resolução |
|---|---|---|
| 14 | Oportunidades vs Leads | **Oportunidades eliminado** — usar apenas Leads com funil completo |
| 15 | Status duplo (status + execution_status) | **Simplificar UI** — Financeiro e Operacional veem só execution_status. project_status fica interno |
| 16 | NF gerada fora ou dentro do sistema | **Fora por enquanto** — sistema só registra. Avaliar integração futura (Enotas, Nuvem Fiscal, Focus NFe) |
| 17 | Sérgio e Ciro | **Diretores Comerciais** — aprovam folhas de despesa, gerenciam comercial |
| 18 | BRK no Operacional | **show_in_operational** — Gerente Operacional vê só BRK Obras e BRK Projetos. Demais projetos BRK só no Financeiro |
| 19 | Escala mensal obrigatória | **Opcional** — é facilitador de pré-preenchimento, não obrigação |
| 20 | Confirmação de escala | **Eliminada** — só existe fechamento (is_closed). Véspera=montar, dia=ajustar+fechar |
| 21 | Diárias de veículos | **Automáticas** — ao fechar escala diária, gera 1 diária por veículo em vehicle_payment_history |
| 22 | Aprovação de despesas | **Via link externo** — Gerente Operacional submete, copia link, envia no WhatsApp. Diretoria Comercial aprova no celular sem login. Financeiro recebe email |
| 23 | Labels dos módulos | **Nomes criativos mantidos** — Radar, Negócios, Campo, Prancheta, Faturamento, Pessoas (rotas internas não mudam) |
| 24 | Import/Export | **Import via planilha+SQL** — seguro para veículos, equipes, clientes novos. NUNCA importar projetos, leads ou escalas |
| 25 | Filtro de projetos no Operacional | **Default com toggle** — por padrão mostra só execution_status IN (aguardando_campo, em_campo). Checkbox "Mostrar todos" libera lista completa |
| 26 | RH cards de resumo | **Por setor** — Total, Campo (FIELD_ROLES), Sala Técnica (TECH_ROLES), Administrativo (restante) |

## Servidor — estado atual (02/04/2026)

Pastas: **ADMINISTRATIVO**, **OPERACIONAL**, **SALA TÉCNICA** — mas os arquivos estão **misturados entre ADM e OPERACIONAL** por herança do período em que Marcelo acumulava financeiro + operacional.

- NFs: deveriam estar em ADM, ainda estão em OPERACIONAL (e em ADM também)
- Contratos, medições: idem — misturados nas duas pastas
- **Regra para scripts:** varrer ADM e OPERACIONAL recursivamente, retornar em qual pasta encontrou cada arquivo
- **Reorganização do servidor = Fase 2** — não bloqueia o sistema agora
- O resultado dos scripts vira o inventário para a reorganização futura