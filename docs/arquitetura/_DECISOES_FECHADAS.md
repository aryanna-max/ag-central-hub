# DECISÕES FECHADAS — Sistema AG

> Decisões arquiteturais numeradas e datadas. Cada uma teve motivação registrada.
> **Fechada ≠ imutável** — para alterar, abrir ADR substituto e referenciar o número.
> Decisões tomadas e **não implementadas** ficam marcadas com ⚠️.

**Última atualização:** 21/04/2026
**Fonte primária:** PR #10 (`0c33a2e`, mergeado 21/04 15:13) + sessões 07/04 a 21/04

---

## Índice rápido

| # | Tema | Data | Status |
|---|---|---|---|
| 1 | Subprojetos não existem | ~03/2026 | ✅ Implementada |
| 2 | Status duplo (project_status + execution_status) | ~03/2026 | ✅ Implementada |
| 3 | Teams = Grupos Rápidos | ~03/2026 | ✅ Implementada |
| 4 | Propostas dentro de Negócios | ~03/2026 | ✅ Implementada |
| 5 | Custos campo — 1 presença = 1 custo | ~03/2026 | ✅ Implementada |
| 6 | Lead convertido = snapshot histórico | ~03/2026 | ✅ Implementada |
| 7 | Alcione — acesso eventual + email gatilho | ~03/2026 | ⚠️ Parcial (Bug 5 bloqueia) |
| 8 | Marco Zero 31/03/2026 | 31/03/2026 | ✅ Implementada |
| 9 | Sidebar colapsável | ~03/2026 | ✅ Implementada |
| 10 | Projetos sem lead → tag "Sem lead" | ~03/2026 | ✅ Implementada |
| 11 | Proposta sem lead | ~03/2026 | ✅ Implementada |
| 12 | Kanban geral absorvido pelo Radar | ~03/2026 | ✅ Implementada |
| 13 | Férias na escala (is_vacation_override) | ~03/2026 | ✅ Implementada |
| 14 | Colunas vazias — faixa fina com contador | ~03/2026 | ✅ Implementada |
| 15 | Alertas Campo — overlay flutuante | ~03/2026 | ✅ Implementada |
| 16 | Veículos — abas internas | ~03/2026 | ✅ Implementada |
| 17 | NF gerada fora, sistema registra | ~03/2026 | ✅ Implementada |
| 18 | Escala mensal — facilitador (revisado 16/04) | ~03/2026 → 16/04 | ✅ Implementada |
| 19 | Diárias veículos — auto ao fechar escala | ~03/2026 | ✅ Implementada |
| 20 | Aprovação despesas — link externo /aprovacao/:token | ~03/2026 | ⚠️ Bug 5 ativo |
| 21 | BRK — compliance configurável por cliente | ~03/2026 | ✅ Implementada |
| 22 | Cargos — sistema por cargo, não pessoa | ~03/2026 | ✅ Fase 3B |
| 23 | Scope items — conceito principal Prancheta | ~03/2026 | ✅ Implementada |
| 24 | billing_type derivado de tipo_servico | ~03/2026 | ✅ Implementada |
| 25 | Encontro de contas — semanal + mensal | ~03/2026 | ✅ Fase 1.5 |
| 26 | Despesas = custos (benefícios são custos) | ~03/2026 | ✅ Implementada |
| **27** | **CLIENTE como centro do sistema** | **07/04/2026** | ⚠️ **NÃO implementada** |
| **28** | **Arquitetura Comercial — Proposta→OS→Projeto** | **08/04/2026** | 🟡 SQL escritos |
| **29** | **Escala diária/mensal — fechamento obrigatório** | **16/04/2026** | ✅ Implementada |
| **30** | **Composição de Custo = ORÇAMENTO (Negócios)** | **16/04/2026** | 🟡 Pendente UI |
| **31** | **Modelo de fonte única confirmado** | **16/04/2026** | ✅ Implementada |
| **32** | **Medições — 3 modelos + rastreabilidade FK** | **17/04/2026** | 🟡 Prompt pronto |
| **33** | **Diretoria não é funcionário** | **~04/2026** | ⚠️ Parcial (DELETE pendente) |
| **34** | **Regra `as any` por fase** | **21/04/2026** | 🟡 Em aplicação |
| **35** | **ADR Responsabilidades em Projeto (3 papéis)** | **21/04/2026** | 🟡 Prompt engatilhado |
| **36** | **Mais recente ≠ melhor (princípio histórico)** | **21/04/2026** | ✅ Princípio ativo |
| **37** | **Não construir lógica via Lovable sem planejamento** | **21/04/2026** | ✅ Princípio ativo |
| **38** | **Escala mobile CONGELADA** | **21/04/2026** | ✅ Congelada |

---

## Decisões 1-26 (herdadas de v11 Git, PR #10)

### #1 — Subprojetos não existem
**Resolução:** Usar `project_services` para representar múltiplos escopos dentro de um projeto.
**Motivação:** Subprojeto adicionava nível hierárquico desnecessário; cada serviço já pode ter status independente.

### #2 — Status duplo
**Resolução:** `project_status` (interno, ciclo de vida financeiro/administrativo) + `execution_status` (UI operacional, para Kanbans e filtros).
**Motivação:** Operação e faturamento têm lógicas diferentes; unificar confundia.

### #3 — Teams = Grupos Rápidos
**Resolução:** Teams como presets reutilizáveis (não estrutura rígida).
**Motivação:** Equipes AG se formam por necessidade diária; preset acelera escala.

### #4 — Propostas dentro de Negócios
**Resolução:** Módulo Propostas fica sob Negócios. Código: `ANO-P-SEQ` (ex: 2026-P-001).
**Motivação:** Proposta é etapa do funil comercial, não módulo separado.

### #5 — Custos de campo: 1 presença = 1 custo
**Resolução:** Cada funcionário-dia-projeto gera 1 linha de custo. **Não ratear** entre projetos.
**Motivação:** Rateio oculta realidade (quem trabalhou onde); presença direta preserva verdade operacional.

### #6 — Lead convertido = snapshot histórico
**Resolução:** Ao converter lead em projeto, preservar snapshot dos dados do lead no momento da conversão.
**Motivação:** Lead pode mudar depois; histórico do que foi aprovado precisa congelar.

### #7 — Alcione — acesso eventual + email como gatilho
**Resolução:** Alcione não tem uso diário do sistema. Email automático serve como gatilho operacional. Botão "Enviar p/ Financeiro" em cada módulo.
**Motivação:** Financeiro é consumidor de eventos, não operador de UI.
**Status:** ⚠️ **Bug 5 bloqueia** — `enqueue_email` em `AprovacaoExterna.tsx` nunca funcionou.

### #8 — Marco Zero 31/03/2026
**Resolução:** Todos os dados antes de 31/03/2026 marcados `is_legacy = true`. Telas filtram `WHERE is_legacy = false` por padrão.
**Motivação:** Dar virada de chave limpa. Legado fica para consulta, não polui operação.

### #9 — Sidebar colapsável
**Resolução:** Sidebar recolhe para ícones. Permite mais espaço em telas pequenas.

### #10 — Projetos sem lead → tag "Sem lead"
**Resolução:** Projeto pode existir sem lead (entrada direta). Recebe tag visual para rastreamento.
**Motivação:** Alguns clientes pulam funil (recorrentes, relacionamento antigo).

### #11 — Proposta sem lead
**Resolução:** OK se o cliente já existe. Cria proposta direto.
**Motivação:** Mesma lógica do #10 — nem tudo passa pelo funil.

### #12 — Kanban geral absorvido pelo Radar
**Resolução:** Não existe Kanban independente de todos os projetos. Radar cumpre esse papel (resumo executivo).
**Motivação:** Evitar duas telas que fazem quase a mesma coisa.

### #13 — Férias na escala
**Resolução:** `employee_vacations` gera `is_vacation_override` em `daily_schedule_entries`. Interface mostra aviso ao tentar escalar funcionário de férias.

### #14 — Colunas vazias — faixa fina
**Resolução:** Em Kanbans, colunas sem cards recolhem para faixa fina com contador.
**Motivação:** Evitar poluição visual.

### #15 — Alertas Campo — overlay flutuante
**Resolução:** Alertas do Campo aparecem como overlay sobre a tela, não em sidebar fixa.
**Motivação:** Prioridade alta, não pode ser ignorado.

### #16 — Veículos — abas internas
**Resolução:** Tela de veículos organizada em abas (Frota, Diárias, Pagamentos, Histórico).

### #17 — NF gerada fora, sistema registra
**Resolução:** NF continua sendo emitida no Meu Dinheiro. Sistema registra número + arquivo. Não emite.
**Motivação:** Integração fiscal complexa, Meu Dinheiro já cobre.

### #18 — Escala mensal (revisado 16/04)
**Resolução original:** Escala mensal opcional, facilitador para planejamento macro.
**Revisão 16/04/2026:** Escala Mensal = planejamento por projeto. Gerar Escala Diária = pré-preenchida pela mensal. **Fechamento da diária no dia real é obrigatório** — tranca edição (só master reabre). Dia fechado atualiza Mensal (também trava). Fechamento é o evento-gatilho que alimenta `employee_daily_records`, benefícios, RDF, caixa.
**Motivação:** Sem fechamento obrigatório, dados ficam flutuando e consolidações viram fantasia.

### #19 — Diárias de veículos — auto ao fechar escala
**Resolução:** Ao fechar escala diária, sistema gera lançamento de diária de veículo automaticamente.

### #20 — Aprovação de despesas — link externo
**Resolução:** Aprovação externa via link `/aprovacao/:token` (sem login). Destinada a diretores e Alcione.
**Status:** ⚠️ Bug 5 ativo — email de aprovação nunca chega.

### #21 — BRK — compliance configurável
**Resolução:** Cada cliente pode ter configuração própria de documentos de compliance. BRK é exceção-regra, não driver.
**Motivação:** Generalizar (`compliance_documents` com `client_id`) para absorver qualquer cliente.

### #22 — Cargos — sistema por cargo, não pessoa
**Resolução:** Benefícios, regras salariais, compliance atrelados ao **cargo** (`job_roles`), não ao funcionário individual.
**Implementação:** Fase 3B (20/04/2026) — 33 cargos cadastrados, 64/64 funcionários backfill.

### #23 — Scope items — conceito principal da Prancheta
**Resolução:** `project_scope_items` é a unidade de trabalho da Sala Técnica. Prancheta trabalha sobre itens de escopo, não sobre projetos inteiros.

### #24 — billing_type derivado de tipo_servico
**Resolução:** Campo `billing_type` em `projects` derivado da lógica de `tipo_servico`. `medicao_mensal` | `entrega_nf`.

### #25 — Encontro de contas — semanal + mensal
**Resolução:** Semanal para benefícios-adiantamento (café/almoço diferença/jantar) → desconta folha semanal. Mensal para benefícios fixos (Alelo R$15/dia, VT R$4,50×2) → relatório dia 26 para Thyalcont.
**Implementação:** Fase 1.5 (semanal), Fase 3B (mensal — apenas schema).

### #26 — Despesas = custos
**Resolução:** Benefícios pagos a funcionários **SÃO custos do projeto** (não despesas administrativas).
**Motivação:** Custo real do projeto inclui tudo que o funcionário consumiu em função daquele projeto.

---

## Decisões 27+ (sessões recentes)

### #27 — CLIENTE como centro do sistema ⚠️ NÃO IMPLEMENTADA
**Data:** 07/04/2026 (sessão Claude.ai `1d295289-...`)
**Origem:** Aryanna identificou: *"Eu criei todo o sistema como se o projeto fosse o foco e agora estou achando que na verdade o cliente que é, já que tudo surge a partir dele e ele pode ter vários projetos."*

**Resolução:**
- Radar vira central de inteligência centrada no CLIENTE
- Negócios: lista de CLIENTES (não leads soltos)
- Faturamento: receita agregada POR CLIENTE
- Visão 360° ao clicar em cliente (status, projetos ativos, proposta aberta, último contato, total faturado, alertas)

**Motivação:** A empresa trabalha em relacionamento. Projeto é filho do cliente, não entidade independente.

**Status:** Decisão tomada e validada. Sessões posteriores voltaram ao foco operacional sem redesenhar Radar/Negócios. **Precisa sessão dedicada.**
**Ver:** `modulos/radar/radar_centrado_em_cliente.md`

---

### #28 — Arquitetura Comercial — Proposta→OS→Projeto
**Data:** 08/04/2026
**Resolução:**
- Hierarquia: Lead → Proposta → OS (Ordem de Serviço) → Projeto
- 3 tipos de proposta: **Pontual**, **Recorrente**, **Sob Demanda**
- 4 regras de conversão documentadas em `modulos/negocios/arquitetura_comercial_0804.md`
- Sistema de códigos: `ANO-SIGLA-SEQ` (ex: 2026-P-001, 2026-OS-042)
- Prancheta trabalha por escopo (scope item), não por projeto inteiro

**Status:** 🟡 SQL escritos, implementação pendente.

---

### #29 — Escala diária/mensal — fechamento obrigatório
**Data:** 16/04/2026
**Resolução:** Ver decisão #18 revisada acima. Fluxo completo:

```
Escala Mensal (planejamento)
  → Gerar Escala Diária (pré-preenchida)
    → Ajustes livres até o dia real
      → Pendente de fechamento no dia real
        → FECHAMENTO obrigatório (trava)
          → Dia atualizado na Mensal (trava)
            → employee_daily_records + benefícios + RDF + caixa gerados
```

**Motivação:** Fechamento é o evento-gatilho. Sem ele, dados operacionais não consolidam.

---

### #30 — Composição de Custo = ORÇAMENTO (Negócios)
**Data:** 16/04/2026
**Resolução:** Composição de custo (salários+encargos+alimentação+transporte+combustível+hospedagem+EPI+lucro+Simples) pertence ao módulo **Comercial/Negócios**, vinculada à proposta. **NÃO faz parte de Medições.**
**Motivação:** Composição é base de cálculo do preço, não da execução.

---

### #31 — Modelo de fonte única confirmado
**Data:** 16/04/2026
**Resolução:** Todo dado operacional deriva de `daily_schedule_entries`. RDF, Caixa, Alelo, VEM, Medições, Resumo HS = telas/relatórios, **NÃO tabelas**. Únicas tabelas novas: compliance (6 tabelas, Fase 2).

Enriquecimentos:
- `employee_daily_records`: +horas_extras, +pernoite, +combustivel_litros
- `employees`: +transporte_tipo, +salario_base, +tipo_contrato + mais 29 campos (Fase 3B ✅)
- `field_expense_items`: já tem payment_method, receiver_id, payment_status, nature, item_type
- `system_settings`: 4 chaves VT/Alelo (pendente)

**Motivação:** Uma fonte. Tudo que parece independente é derivação.

---

### #32 — Medições — 3 modelos + rastreabilidade FK
**Data:** 17/04/2026 (após inventário `INVENTARIO_MEDICOES_AG_2026.docx`)
**Resolução:** 3 modelos de medição:

| Modelo | Uso | Clientes |
|---|---|---|
| Grid Diárias | Contratos mensais, calendário dias×equipe | HBR, PE Construtora, BRK, Flamboyant, ENCAR |
| Boletim Formal | Itens serviço, acumulado, saldo, BM sequencial | Engeko (FSQ-GTR-009), HBR (BM-07) |
| Resumo Entrega | Serviços pontuais, valor fixo, ref proposta | Direcional, esporádicos |

Cadeia de rastreabilidade (toda FK, zero texto):
```
proposals → project_services → measurements → measurement_items → invoices
                                    ↑
                         employee_daily_records (escala)
```

**Status:** 🟡 Prompt para Code pronto (`PROMPT_CODE_MEDICOES_DEFINITIVO.md`).
**Ver:** `modulos/faturamento/medicoes.md`

---

### #33 — Diretoria não é funcionário
**Data:** ~04/2026 (princípio operacional formalizado)
**Resolução:** Aryanna, Sérgio, Ciro são sócios-administradores. **NÃO entram em `employees`**. Só em `profiles` + `user_roles`. Sem matrícula. Tela Pessoas mostra só funcionários (CLT 000XXX + prestadores PREST-XXX).
**Motivação:** Papéis e entidades distintas. Sócio é dono do negócio, funcionário é contratado pelo negócio.
**Pendências:**
- DELETE Aryanna + Sérgio sócio de `employees`
- Criar profile do Ciro + DELETE Ciro de `employees`

---

### #34 — Regra `as any` por fase
**Data:** 21/04/2026 (PR #10)
**Resolução:** Uma fase (1, 2, 3, 4, 5) só é considerada **fechada** quando zera os `as any` dos arquivos tocados.

Checklist obrigatório em cada PR:
```
- [ ] Feature funciona
- [ ] Build passa
- [ ] grep -n "as any" src/<territorio_da_fase>/ == 0
```

**Territórios por fase (do PR #10):**

| Fase | `as any` | Observação |
|---|---|---|
| 1 — Escala→Benefícios→RDF | ~35 | Decidir `attendance` table + `responsible_campo_id` |
| 2 — Compliance | ~30 | Maioria é falso-positivo |
| 3 — Pessoas | ~20 | Admissão reescreve. `vt_*` dissolve |
| 4 — Arq. Comercial | ~60 | Maior bolsa (Projetos.tsx tem 27) |
| 5 — Email Financeiro | ~5 | Bug `enqueue_email` dissolve |

**Subtotal:** ~150 (52%) morrem como efeito colateral das fases. ~136 restantes = polimento puro.

**O que NÃO fazer:**
- ❌ Sprint de limpeza paralelo com fases
- ❌ Remover `as any` sem rodar `npm run build`
- ❌ Fazer tudo num PR só

**Ver:** `ag-central-hub/docs/investigacao-bugs-cat3-20260421.md`

---

### #35 — ADR Responsabilidades em Projeto (3 papéis)
**Data:** 21/04/2026
**Resolução:** 3 papéis com modelagem diferente:

**A) Responsável Comercial** — coluna direta `projects.responsible_comercial_id`
- FK profiles, só diretor (Sérgio, Ciro)
- Vem do lead; editável qualquer fase
- Um por projeto, sem histórico

**B) Responsável Técnico** — coluna direta `projects.responsavel_tecnico_id`
- FK profiles
- Default: Aryanna (único CAU/CREA)
- Editável (futuros técnicos com CAU próprio)
- Um por projeto

**C) Participações** — tabela `project_participations` (histórica)
- N:N projetos×funcionários
- Role: `topografo_campo | desenho_tecnico | projetista | cartografo`
- Source: `escala | prancheta | manual`
- Triggers populam (auxiliares NÃO contam como topógrafo)
- Lista histórica com dias e períodos

**Geração de planta:** modal escolhe entre 4 critérios (primeiro topógrafo / todos / mais dias / manual). Escolha salva no PDF.

**Status:** 🟡 Prompt para Code engatilhado (`PROMPT_CODE_2_ADR_RESPONSABILIDADES.md`).
**Ver:** `ADR_RESPONSABILIDADES_PROJETO.md` + `modulos/projetos/responsabilidades_projeto.md`

---

### #36 — Mais recente ≠ melhor (princípio histórico)
**Data:** 21/04/2026
**Resolução:** Sempre consultar histórico antes de refazer um módulo. Sintomas frequentes podem ser sinais de arquitetura ruim — corrigir sintoma sem corrigir raiz cristaliza bagunça.

**Casos confirmados de "versão antiga era melhor":**
- **Leads** — versão inicial mais simples e funcional
- **Escala mobile** — versão desktop estável foi substituída por mobile bugada
- **Dashboards** — várias mudanças sem critério
- **Benefícios** — várias mudanças

**Ver:** `_HISTORICO_EVOLUCAO.md`

---

### #37 — Não construir lógica via Lovable sem planejamento
**Data:** 21/04/2026
**Resolução:** Lovable é para ajustes de UI sobre arquitetura já decidida. Construir lógica nova direto bagunça o sistema.

**Caso confirmado:** Escala mobile — criada via prompts Lovable sem planejamento, virou "decorrada do sistema" (visualmente excelente, funcionalmente quebrada).

**Regra de ouro:** antes de qualquer prompt Lovable de lógica nova, existir ADR ou decisão arquitetural fechada.

---

### #38 — Escala mobile CONGELADA
**Data:** 21/04/2026
**Resolução:** Módulo escala mobile congelado. **Não revisar até que o resto do sistema esteja estável.**
**Motivação:** Revisar agora empurraria retrabalho quando a base ainda está mudando. É caso do #36 + #37.
**Ver:** `_CONGELADAS.md`

---

### #39 — Critério final de dados legado: `lead_id` + `execution_status`, não data
**Data:** 17/04/2026
**Origem:** Resgatada de sessão Code local `12f31974` (17-20/04) — migration `20260417_limpeza_dados_legado.sql`.
**Resolução:** Corte por `created_at >= 2026-03-18` não funciona (imports rodaram em abril; timestamp é do INSERT, não do dado original).
**Critério final adotado:**
- FICA se `lead_id IS NOT NULL` OU `execution_status IN (em_campo, proposta_aprovada, campo_pausado, faturamento)`.
- ARQUIVA se sem lead E `execution_status IN (concluido, pago, campo_concluido, NULL)`.
**Implementação:** `is_active=false` (nunca DELETE — FKs preservam histórico). `useProjects()` passa a filtrar `is_active=true`; criado `useProjectsAll()` para telas de histórico.
**Resultado aplicado:** projects_ativos 95→64, arquivados 0→31; clients_ativos 59→40, arquivados 1→20; alerts 104→0; daily_schedules 5→0. TRUNCATE CASCADE em 15 tabelas operacionais.

---

### #40 — Código BM por projeto, não global
**Data:** 17-20/04/2026
**Origem:** Resgatada de sessões Code local `12f31974` + `9c5ee04e`.
**Antes:** `AG-BM-{ANO}-{SEQ:03d}` (sequencial global por ano).
**Depois:** `BM-{CODIGO_PROJETO_SEM_ANO}-{SEQ:02d}` — sequencial por projeto, 2 dígitos. Ex: projeto `2026-BRK-003` → `BM-BRK-003-01`, `BM-BRK-003-02`.
**Motivação:** rastreabilidade por projeto; cliente muitas vezes pede sequencial deste projeto, não do ano inteiro.
**Adicional:** medições antigas (`AG-BM-2026-XXX`) preservam formato histórico. Campo `external_code` previsto em `measurements` para clientes que ditam formato próprio (Engeko `FSQ-GTR-009`, HBR `BM-07`).

---

### #41 — Período de medição: intervalo de datas, não mês/ano
**Data:** 17-20/04/2026
**Origem:** Resgatada de sessões Code local `12f31974` + `9c5ee04e` (commit `244559c`).
**Resolução:** Trocado `<Select Mês + Ano>` por dois `<input type="date">` (Período de / Período até). Default pré-preenchido com 1º/último dia do mês atual (fluxo mensal continua rápido, mas permite medições que cruzam meses).

---

### #42 — Fluxo duplo de benefícios: semanal (Encontro) vs mensal (Thyalcont)
**Data:** 16/04/2026
**Origem:** Resgatada de sessão Code local `6f4fdccf`.
| Benefício | Frequência | Dono | Destino |
|---|---|---|---|
| Café / Almoço Diferenciado / Jantar | Semanal | Gerente Operacional (Marcelo) | Encontro de Contas → desconto auto na folha (D2) |
| Alelo / VT | Mensal | Analista DP | Relatório dia 26 → Thyalcont |
**Motivação:** benefícios têm dois ciclos naturais diferentes — operacional (semanal, por projeto) vs RH (mensal, consolidado para folha externa). Misturar num só fluxo quebra ambos.

---

### #43 — Transporte é propriedade do RH, não do Marcelo
**Data:** 16-20/04/2026
**Origem:** Resgatada de sessões Code local `6f4fdccf` + `12f31974` + `9c5ee04e`.
**Coluna `employees.transporte_tipo` TEXT CHECK:**
- `vt_cartao` — desconto 6% do salário, padrão.
- `dinheiro` — pago semanalmente, sempre vinculado a projeto (custo do projeto).
- `nenhum` — sem benefício.
**Subtipo em `field_expense_items.subtipo` (quando dinheiro):** `integral` (substitui VT naquele dia, não conta no mensal) | `complemento` (VT usado + extra).
**Valores em `system_settings`:** `vt_valor_viagem=4.50`, `vt_viagens_por_dia=2`, `vt_desconto_percentual=6`, `alelo_valor_dia=15.00`.
**Hardcodes removidos de `useDailySchedule.ts` (commit `a6975fa`).**

---

### #44 — Medições são fonte única de Marcelo; Alcione só visualiza
**Data:** 17-20/04/2026
**Origem:** Resgatada de sessão Code local `12f31974`.
**Resolução:** `FaturamentoMedicoes.tsx` passa a **read-only** — removidos 11 campos digitáveis antigos (`dias_semana`, `dias_fds`, `valor_diaria_*`, `codigo_bm` manual). Alcione tem 2 ações apenas: **Registrar NF** e **Confirmar pagamento**. "Aprovar/rejeitar" é ação do cliente (externa), não do financeiro.
**Motivação:** duplicidade de entrada causava dados divergentes. Marcelo é quem sabe o que foi medido.

---

### #45 — BRK é exceção, não padrão do sistema de compliance
**Data:** 15/04/2026
**Origem:** Resgatada de sessão Code local `20051cb3`.
**Resolução:** BRK (licitação pública, SERTRAS, NR-18, 39% da receita hoje) tem regras que só Alcione conhece. Arquitetura de compliance deve ser **leve por padrão, com configuração extra por cliente via `client_doc_requirements`** — nunca forçar os ~48 clientes simples a workflow complexo.
**Motivação:** gravitar o sistema em torno do caso extremo trava adoção nos casos comuns.

---

### #46 — Sistema por CARGO (raias BPMN), não por pessoa
**Data:** 15/04/2026
**Origem:** Resgatada de sessão Code local `20051cb3`.
**Resolução:** Permissões, alertas, relatórios são modelados por cargo/raia BPMN. Hoje uma pessoa ocupa múltiplos cargos (Alcione = Analista RH + Almoxarife? + Supervisor Fin; Marcelo = Gerente Op + Analista de algo). Separar cargo de pessoa permite delegar e contratar sem refatorar.
**Pendência:** Almoxarife = Alexandre (mat 000116), não Alcione — corrigir atribuição quando houver UI de cargos.
**Relação:** complementa #11 (`alert_recipient` por role, não por pessoa).

---

### #47 — Cliente como HUB central (confirmação da decisão 07/04)
**Data confirmada:** 15/04/2026 (decisão original 07/04/2026)
**Origem:** Resgatada de sessão Code local `20051cb3` — já registrada em CLAUDE.md como pendente.
**Resolução:** Cada módulo (Negócios/Campo/Prancheta/Faturamento/Documentos/Integrações/Emails/Alertas) é camada de visualização do mesmo cliente. Não existe "cliente do módulo X" — existe cliente, e o módulo X o vê sob um ângulo.
**Status implementação:** ainda NÃO implementado no código. Aparece como bug crítico #2 em CLAUDE.md.

---

### #48 — Remover `ag_topografia` do select de empresa faturadora
**Data:** 17-20/04/2026
**Origem:** Resgatada de sessão Code local `12f31974`.
**Resolução:** Opções válidas em faturadora são **apenas** `gonzaga_berlim` e `ag_cartografia`. AG Topografia não emite NF — é marca comercial, não PJ faturadora.

---

### #49 — Diretoria mobile-first (Radar/Negócios)
**Data:** 31/03 - 03/04/2026
**Origem:** Resgatada de sessão Code local `544c0f7e`.
**Resolução:** Sócios (Aryanna, Sérgio, Ciro) acessam principalmente pelo celular. Literal: "socio nao sao muito afeicoados com tecnologia e vao acessar pelo celular". Justifica priorizar UI mobile em Radar e Negócios. Sidebar colapsável (estado por usuário).

---

### #50 — Alcione: email-first, acesso ao sistema secundário
**Data:** 31/03 → refinado 03/04/2026
**Origem:** Resgatada de sessão Code local `544c0f7e`.
**Resolução:** Fluxo principal de Alcione = email em `financeiro@agtopografia.com.br`. Refinamento 03/04: "alcione pode entrar a qualquer momento para visualizar e tirar duvidas, telas de alerta sao importantes. principlemente quando um email é enviado para ela". Ou seja: pode consultar, mas sistema não assume que ela está logada.
**Relação com Bug 5:** se email não dispara (caso atual de `enqueue_email`), ela literalmente não sabe que tem aprovação externa. Bug é crítico por causa desta decisão.

---

## Processo para nova decisão

1. Abrir ADR (Architecture Decision Record) em `modulos/<area>/` ou `ADR_<nome>.md` se cross-module
2. Passar pelos 3 testes (negócio, débito, raiz vs sintoma) — ver `_OBJETIVO.md`
3. Registrar neste arquivo com próximo número
4. Atualizar CLAUDE.md se afetar regra crítica
5. Implementar (Code ou Lovable, com prompt bem planejado)

**Nunca:**
- Implementar antes de decidir
- Decidir sem os 3 testes
- Decidir verbalmente sem registrar aqui
