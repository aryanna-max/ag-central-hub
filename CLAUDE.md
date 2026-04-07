# AG CENTRAL HUB — CLAUDE.md
> Versão: 3.0 | Atualizado: 07/04/2026
> **Leia este arquivo completo antes de qualquer ação.**

---

## HIERARQUIA DE DOCUMENTOS

Leia nesta ordem:

1. **Este arquivo (CLAUDE.md)** — contexto, regras, estado atual. SEMPRE lido primeiro.
2. **ARQUITETURA_SISTEMA.md** — estrutura técnica detalhada, fluxos, 40 tabelas, enums. Consultar quando implementar módulos.
3. **DIAGNOSTICO_07abr2026.md** — snapshot do estado em 07/04/2026. Consultar para entender o que foi feito. NÃO editar — criar novo quando necessário.
4. **README.md** — ignorar, é placeholder do Lovable.

> Se houver conflito entre documentos, este CLAUDE.md prevalece.

---

## 1. STACK E ACESSO

- **App:** https://ag-central-hub.lovable.app
- **Lovable ID:** e5b79b44-8865-4599-b013-f3e91865a8f0
- **GitHub:** aryanna-max/ag-central-hub
- **Supabase ID:** bphgtvwgsgaqaxmkrtqj
- **types.ts:** fonte de verdade do schema → `src/integrations/supabase/types.ts`

### REGRA CRÍTICA — Supabase MCP
O Supabase MCP **NÃO TEM ACESSO** a este projeto (retorna "permission denied").
- ❌ NUNCA usar `execute_sql`, `list_tables` via MCP
- ✅ Alterações no banco: gerar SQL para Aryanna colar no **SQL Editor do Lovable**
- ✅ Para verificar schema: ler `src/integrations/supabase/types.ts`

---

## 2. MÓDULOS — NOMES E ROTAS

| Label UI | Rota | Role no banco | Usuário |
|---|---|---|---|
| 🎯 Radar | `/` | diretor | Aryanna, Sérgio, Ciro |
| 💼 Negócios | `/comercial/*` | comercial | Sérgio, Ciro |
| 🏕️ Campo | `/operacional/*` | operacional | Marcelo |
| 📐 Prancheta | `/sala-tecnica/*` | sala_tecnica | Emanuel Macedo |
| 💰 Faturamento | `/financeiro/*` | financeiro | Alcione (eventual) |
| 👥 Pessoas | `/rh/*` | financeiro | Alcione (eventual) |
| 🗂️ Base | `/admin/*` | master | Aryanna |

> ⚠️ Labels da UI usam nomes criativos. Rotas e roles no banco NÃO mudam.
> ⚠️ NÃO existe role `rh_financeiro` — Alcione usa role `financeiro` para ambos.

---

## 3. PESSOAS-CHAVE

| Pessoa | Papel | Role | Acessa sistema? |
|---|---|---|---|
| Aryanna | Diretora | master | Sim — tudo + botões admin (editar/apagar) em todas as telas |
| Sérgio | Diretor | diretor | Sim |
| Ciro | Diretor | diretor | Sim |
| Marcelo | Gerente Operacional | operacional | Sim — vê tudo (fase de testes) |
| Emanuel Macedo | Líder Prancheta | sala_tecnica | Sim |
| Alcione | RH + Financeiro | financeiro | Eventual — para tirar dúvidas. Não é usuária diária |

> ⚠️ Aryanna, Sérgio e Ciro são **Diretores** (sem tipo específico). Não são funcionários.
> ⚠️ Tudo que envolve "diretores" no sistema → esses 3 aparecem.

### Alcione — regras específicas
- Acesso eventual ao sistema só para consulta/dúvidas
- Gatilho principal: **email** para `financeiro@agtopografia.com.br`
- Email deve conter todos os dados para emitir NF/recibo sem abrir o sistema
- Cada módulo deve ter botão **"Enviar para Financeiro"** que dispara email + cria alerta
- Alertas `recipient='financeiro'` disparam email via pgmq E espelham no sistema
- Alertas automáticos devem ser gerados em:
  - Criação de projeto novo
  - Entrega de tarefa pela Sala Técnica (execution_status → 'entregue')
  - Medição registrada
  - Folha de despesa aprovada

### Aryanna — botões admin
- Role `master` → exibe botões de **Editar** e **Apagar** em locais estratégicos:
  - Projetos, Clientes, Leads, Propostas, Funcionários, Veículos, Equipes
  - Escalas (mesmo fechadas), Folhas de despesa, Medições
- Outros roles NÃO veem esses botões

### Marcelo — fase de testes
- Temporariamente vê **todos os projetos** (sem filtro de execution_status ou show_in_operational)
- Quando sair da fase de testes, voltar ao filtro padrão: `execution_status IN ('aguardando_campo','em_campo') AND show_in_operational = true`

---

## 4. ESTADO DO BANCO (07/04/2026)

### Contagem de registros
| Tabela | Registros |
|---|---|
| projects | 77 |
| project_services | 80 |
| employees | 64 (filtrado: status != desligado) |
| clients | 51 (filtrado: codigo IS NOT NULL) |
| leads | 21 |
| alerts | 38 |
| teams | 0 (limpo — aguarda repovoamento) |
| vehicles | 0 (limpo — aguarda repovoamento) |
| proposals | 0 |
| measurements | 0 |
| daily_schedules | 2 (não-legado) |

### Enums existentes (todos migrados)
- `execution_status`: aguardando_campo, em_campo, campo_concluido, aguardando_processamento, em_processamento, revisao, aprovado, entregue, faturamento, pago
- `lead_status`: novo, em_contato, qualificado, proposta_enviada, aprovado, convertido, perdido, descartado
- `proposal_status`: rascunho, enviada, aprovada, rejeitada, expirada
- `measurement_status`: rascunho, aguardando_aprovacao, aprovada, nf_emitida, paga, cancelada
- `removal_reason`: campo_concluido, pausa_temporaria, reagendado, clima, equipamento, falta_equipe
- `empresa_faturadora_enum`: ag_topografia, ag_cartografia
- `tipo_documento`: nf, recibo
- `employee_status`: disponivel, ferias, licenca, afastado, desligado
- `vehicle_status`: disponivel, em_uso, manutencao, indisponivel

### Tabelas existentes (40)
alerts, calendar_events, client_contacts, clients, daily_schedule_entries,
daily_schedules, daily_team_assignments, email_send_log, email_send_state,
employee_project_authorizations, employee_vacations, employees,
field_expense_discounts, field_expense_items, field_expense_sheets,
invoice_items, invoices, lead_interactions, leads, measurements,
monthly_schedules, profiles, project_benefits, project_scope_items,
project_services, project_status_history, projects, proposal_items,
proposals, suppressed_emails, system_settings, team_members, teams,
technical_tasks, user_roles, vehicle_payment_history, vehicles

Views: `vw_prazos_criticos`, `vw_tarefas_dia`

---

## 5. DECISÕES ARQUITETURAIS FECHADAS

| # | Decisão | Resolução |
|---|---|---|
| 1 | Subprojetos | NÃO existem. Usar `project_services` dentro do mesmo projeto |
| 2 | Status duplo | `project_status` (interno) + `execution_status` (visível na UI) em paralelo |
| 3 | Teams | Grupos Rápidos — presets para pré-preencher escalas. UI: "Grupos Rápidos" |
| 4 | Propostas | Dentro do Negócios. Código: ANO-P-SEQ (ex: 2026-P-001) |
| 5 | Custos campo | Não ratear. 1 presença = 1 custo. Custo vai pro projeto não-BRK |
| 6 | Lead convertido | Snapshot histórico — não editar após conversão |
| 7 | Alcione | Acesso eventual para consulta. Foco = email. Cada módulo tem "Enviar para Financeiro" |
| 8 | Marco Zero | 31/03/2026 — filtrar `is_legacy = false` em todas as queries operacionais |
| 9 | Sidebar | Colapsável — recolhe para ícones |
| 10 | Projetos sem lead | Aparecem no Negócios com tag visual "Sem lead" |
| 11 | Proposta sem lead | Permitido para cliente já existente. Cliente novo = obriga lead |
| 12 | Direcional duplicatas | NÃO são duplicatas — 2 projetos distintos assinados em 18/03/2026 |
| 13 | Férias na escala | `is_vacation_override` — aviso, Marcelo confirma, sem benefícios automáticos |
| 14 | Kanban geral | Absorvido pelo Radar. Sem item separado no menu |
| 15 | Colunas vazias kanban | Colapsam para faixa fina com contador — não somem |
| 16 | Alertas no Campo | Overlay/painel flutuante — não página separada |
| 17 | Veículos | Diárias e relatórios como abas internas — não itens de menu |
| 18 | Folhas de carros | Registradas no Campo, aprovadas por Alcione em Pessoas |
| 19 | Oportunidades | Eliminado — usar apenas Leads com funil completo |
| 20 | Status duplo na UI | `execution_status` é primário na interface. `project_status` fica interno |
| 21 | NF no sistema | Gerada fora por enquanto — sistema só registra. Avaliar integração futura |
| 22 | BRK no Operacional | `show_in_operational` controla visibilidade. Marcelo vê só BRK Obras e BRK Projetos (pós-testes) |
| 23 | Escala mensal | Opcional — facilitador de pré-preenchimento, não obrigação |
| 24 | Confirmação de escala | Eliminada — só existe fechamento (`is_closed`) |
| 25 | Diárias de veículos | Automáticas ao fechar escala diária |
| 26 | Aprovação de despesas | Via link externo WhatsApp sem login. Página pública `/aprovacao/:token` |

---

## 6. REGRAS DE NEGÓCIO

### Cliente vs. Tomador
- **Cliente** = entidade com quem a AG tem relacionamento comercial → `clients.id`
- **Tomador** = CNPJ que vai na NF (pode ser SPE/filial) → `projects.cnpj_tomador`
- ❌ NUNCA criar código de cliente separado para SPE do mesmo grupo
- Colorado: 1 cliente (COL), ~13 SPEs — cada SPE é um projeto com `cnpj_tomador` diferente
- BRK: 1 cliente (BRK), múltiplos projetos por cidade/CNPJ

### BRK — regras específicas
- Contrato guarda-chuva. Marcelo vê só "BRK Obras" e "BRK Projetos" (`show_in_operational=true`) — pós-testes
- BRK envia sua própria medição com autorização de NFs por CNPJ/cidade
- `contract_value` dos projetos BRK individuais = 0 (valor real vem da medição da BRK)
- NÃO é inadimplência. NFs já lançadas no Meu Dinheiro + portal BRK

### Escala — validações obrigatórias
- Funcionário com documento vencido → **bloqueio total** (não só alerta)
- Projeto ativo sem escala no dia → exige motivo obrigatório (removal_reason)
- Pessoa em 2+ projetos no mesmo dia → confirmação explícita + 1 custo total
- Contadores de prazo iniciam quando Marcelo **fecha** a escala, não quando planeja

### Tarefa automática ao criar projeto
- Sistema insere automaticamente tarefa em `technical_tasks`: criar pasta no servidor
- Caminho: `F:\Dados\Dados\AG\OPERACIONAL\{ANO}\{CÓDIGO}\`

---

## 7. BILLING_TYPE POR CLIENTE

| Cliente | billing_type | Observação |
|---|---|---|
| BRK Obras | medicao_mensal | Medição da própria BRK |
| BRK Projetos | entrega_nf | Pontuais |
| HBR Tabaiares | medicao_mensal | R$18.500/mês |
| HBR demais | entrega_nf | Santa Clara, Camaragibe etc. |
| Engeko | medicao_mensal | R$19.500/mês |
| Pernambuco Construtora | medicao_mensal | Porto de Pedra |
| JME | medicao_mensal | Apex |
| Flamboyant | medicao_mensal | Castanhal/PA — NF nunca emitida ⚠️ |
| Encar | medicao_mensal | Sucupira Curado Arena |
| Colgravata / Colarcoverde | medicao_mensal | SPE Colorado mensal |
| Colorado demais SPEs | entrega_nf | Colarrio, Colaru, Colapiraca etc. |
| Polimix Maceió | entrega_nf | Cliente separado do Jaboatão |
| Polimix Jaboatão | entrega_nf | Cliente separado do Maceió |
| Hoteis Salinas (Grupo Amarante) | entrega_nf | cnpj_tomador = Hoteis Salinas S/A |
| Gran Alpes | entrega_nf | 2 serviços pontuais, Gravatá |
| Direcional + SPEs | entrega_nf | cnpj_tomador = CNPJ da SPE |
| Simproja / Sindicato Educ. Jaboatão | entrega_nf | 2 serviços ⚠️ pendente confirmação |

> ⚠️ Esta tabela é a fonte de verdade. Ignorar billing_types em versões anteriores do CLAUDE.md.

---

## 8. CÓDIGOS PADRONIZADOS

| Entidade | Formato | Exemplo |
|---|---|---|
| Cliente | 3 letras maiúsculas | BRK, COL, HBR |
| Projeto | ANO-SIGLA-SEQ | 2026-BRK-001 |
| Proposta | ANO-P-SEQ | 2026-P-001 |
| Lead | ANO-L-SEQ | 2026-L-001 |
| Medição | ANO-SIGLA-SEQ-MSEQ | 2026-BRK-001-M01 |
| Folha despesa | ANO-FD-SEQ | 2026-FD-001 (semanal, reseta em janeiro) |
| NF | ANO-NF-SEQ | 2026-NF-001 |

---

## 9. FILTROS PADRÃO POR MÓDULO

```
Campo (Operacional) — FASE DE TESTES:
  Marcelo vê TODOS os projetos ativos (sem filtro de execution_status)
  
Campo (Operacional) — PRODUÇÃO (após testes):
  projects WHERE execution_status IN ('aguardando_campo','em_campo')
  AND show_in_operational = true
  AND is_legacy = false

Prancheta (Sala Técnica):
  projects WHERE execution_status IN ('campo_concluido','aguardando_processamento',
  'em_processamento','revisao')

Financeiro:
  projects WHERE execution_status IN ('aprovado','entregue','faturamento')
  OR billing_type = 'medicao_mensal'

Radar (Diretoria):
  Todos os projetos ativos

Escalas e despesas:
  WHERE is_legacy = false  (Marco Zero: 31/03/2026)

Funcionários (dropdowns):
  WHERE status != 'desligado'

Clientes (dropdowns):
  WHERE codigo IS NOT NULL

Veículos (dropdowns de alocação):
  useActiveVehicles() → WHERE status = 'disponivel'
```

---

## 10. VISIBILIDADE POR MÓDULO

| Dado | Radar | Negócios | Campo | Prancheta | Faturamento | Pessoas |
|---|---|---|---|---|---|---|
| Valores financeiros | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| NFs e medições | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Escalas de campo | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Tarefas técnicas | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Folhas de despesa | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Botão "Enviar p/ Financeiro" | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 11. PENDÊNCIAS ABERTAS

| # | Pendência | Responsável | Impacto |
|---|---|---|---|
| P1 | billing_type de projetos sem classificação | Aryanna + Sérgio | SQL pronto, só executar |
| P2 | Grupo Amarante — contratante confirmado? | Sérgio | `cnpj_tomador` vazio |
| P3 | Direcional SPEs: Bromélia e Lourdes billing_type | Sérgio/Ciro | Cadastros incompletos |
| P4 | SQL_6_IMPORTS — dados históricos | Aryanna | Funcionários, veículos, equipes |
| P5 | Repovoar veículos e equipes (tabelas zeradas) | Marcelo | Planilha modelo pronta |
| P6 | Diária de férias — valor e forma de pagamento | Alcione + Sérgio | `employee_vacations` incompleta |
| P7 | Flamboyant (Castanhal/PA) — NF nunca emitida | Aryanna | Alto valor sem faturar |
| P8 | Gran Alpes — verificar leads no sistema | Aryanna | Rastreabilidade comercial |
| P9 | pg_cron não habilitado | Dev | Alertas automáticos agendados |
| P10 | Categorias Meu Dinheiro — padronizar | Alcione | 82,6% lançamentos sem projeto |
| P11 | Engeko — NF em aberto, prioridade de cobrança | Aryanna/Sérgio | Inadimplência |
| P12 | Definir fluxogramas por tipo de serviço | Aryanna + Consultoria | Regras de fluxo não documentadas |

---

## 12. FILA DE PROMPTS LOVABLE

| Prompt | Status | O que faz |
|---|---|---|
| F1-F5, F-MENU, F4-REV | ✅ Executados | Base do sistema implementada |
| **F-FIN** | ▶️ **PRÓXIMO** | Faturamento completo: Alertas, Pipeline, Medições, Projetos, Relatórios + email Alcione |
| F-RH | 🔲 Pendente | Pessoas completo: Pagamentos, Folhas, Veículos, Férias, Ausências |
| F6 | 🔲 Pendente | Radar mobile-first: alertas no topo, KPIs, lista por grupo, Kanban secundário |

> ⚠️ Usar créditos Lovable APENAS para features novas grandes.
> ✅ Correções e ajustes → Claude Code → git push → Lovable sincroniza.

---

## 13. REGRAS GERAIS — NUNCA VIOLAR

- ❌ NUNCA usar "OBRA" → sempre "PROJETO"
- ❌ NUNCA criar cliente separado para SPE — usar `cnpj_tomador` no projeto
- ❌ NUNCA gerar código de projeto no funil de leads — só na criação do projeto
- ❌ NUNCA alterar valores de enum no banco para corresponder a labels da UI
- ❌ NUNCA mostrar dados com `is_legacy = true` no fluxo normal
- ❌ NUNCA usar Supabase MCP — retorna "permission denied"
- ✅ Prancheta NUNCA vê valores financeiros
- ✅ Alcione acessa eventual para dúvidas — foco é email automático
- ✅ Teams são presets temporários — não são equipes fixas
- ✅ 1 presença = 1 custo, sem rateio entre projetos
- ✅ Marco Zero: `WHERE is_legacy = false` em todas as queries operacionais
- ✅ Dívida técnica aceitável: ~70 casts `as any` nos hooks (funciona, sem type safety)
- ✅ Aryanna (master) vê botões Editar/Apagar em todas as telas estratégicas
- ✅ Diretores = Aryanna, Sérgio, Ciro — aparecem em tudo que envolve "diretores"
