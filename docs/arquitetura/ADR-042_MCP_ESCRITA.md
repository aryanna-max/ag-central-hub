# ADR-042 — Ferramentas MCP de Escrita do Átina (Ondas 1 e 2)

**Data:** 10/08/2026
**Autor:** Arquiteto (Cowork)
**Status:** APROVADO — **Decisões #58 a #62 CONFIRMADAS em 10/08/2026** (todas na opção recomendada; ver `_DECISOES_FECHADAS.md`). Pronto para implementação (Ondas 1+2 juntas para a Fase 0). Aguarda handoff ao Code/Lovable — prompt em `HANDOFF_MCP_ESCRITA_10AGO.md`. Nada implementado ainda no banco.
**Revisão 2 (10/08/2026):** §3.1 nova (recebimento como entidade própria), §2, §4 (A7), §6, §7, §8 (#59), B1, B2, B3, B4 e Apêndices A/C reescritos. Motivo: a resposta da Aryanna — *"é variado e às vezes dão adiantamento"* — invalidou a recomendação anterior de "baixa integral só". **`mark_titulo_pago` deixou de existir**; foi substituída por `register_recebimento` + `allocate_recebimento`. Nada deste ADR havia sido implementado quando a revisão foi feita, então não há retrocompatibilidade a preservar.
**Contexto:** o Átina está desatualizado desde 17/05/2026. A Fase 0 (recarga de ~3 meses de operação real a partir de e-mail e Drive) só pode ser feita pelos agentes se o sistema aceitar comandos de escrita.
**Depende de:** ADR-040 (matriz canônica), Decisão #55 (FK sempre vence texto livre), Decisão #02 (CLIENTE é o centro).
**Gera as decisões:** #58 a #62 (ver §8). **#58 já confirmada e registrada em `_DECISOES_FECHADAS.md` (10/08/2026).**

---

# PARTE A — DECISÃO E RACIONAL

*(esta parte é para ler e decidir; não colar no Lovable)*

## 1. Frase de síntese

**Toda escrita dos agentes no Átina entra por uma função SQL nomeada que carrega a regra de negócio; a ferramenta MCP é só a porta, nunca o dono da regra.**

**Referência conceitual:** CQRS (Greg Young / Fowler) — o lado de comando é um conjunto de intenções nomeadas do negócio (`create_titulo`, `resolve_alert`), não uma projeção do schema. Reforçado por *Tell, Don't Ask*: o agente diz "dá baixa neste alerta"; ele não lê o registro, decide sozinho e devolve um UPDATE montado por fora.

**Anti-referência (o que estamos deliberadamente evitando):** o **CRUD genérico sobre tabela** — expor `update_row(table, id, fields)` ou seis ferramentas espelhando seis tabelas. É o caminho rápido e é exatamente o que produz o problema que o Átina existe para resolver: cada canal escrevendo à sua maneira, sem regra comum, sem rastro. Também evitamos o **service role**: nenhuma ferramenta roda como super-usuário; todas rodam como o usuário OAuth logado, sob RLS.

## 2. O gate Engine vs. CRUD — classificação de cada ferramenta

| Ferramenta MCP | Onda | Classificação | Por quê | Função SQL |
|---|---|---|---|---|
| `resolve_alert` | 1 | **ENGINE** | Há política: quem pode dar baixa depende do destinatário do alerta, e alerta de emissão de documento não pode ser baixado sem o documento existir | `fn_resolve_alert` |
| `update_lead_status` | 1 | **ENGINE** | Há política: `convertido` é consequência da conversão (gera projeto), não um status que se digita; descarte exige motivo | `fn_update_lead_status` |
| `create_titulo` | 2 | **ENGINE** | Há política pesada: coerência de CNPJ emissor/tomador, cálculo de líquido, idempotência por nota, avanço do projeto para faturamento, baixa do alerta que a originou | `fn_create_titulo` |
| `register_recebimento` | 2 | **ENGINE** | Há política pesada: dinheiro pertence ao **cliente**, não à nota; alocação não pode exceder o saldo do título nem o não-alocado do recebimento; empresa recebedora tem que bater com a emissora; sobra vira crédito explícito, não erro; dupla baixa travada pela referência bancária | `fn_register_recebimento` |
| `allocate_recebimento` | 2 | **ENGINE** | Há política: é o ato de dizer "este dinheiro que já entrou refere-se a esta nota". Mesmas travas de saldo. É por aqui que o adiantamento encontra a nota quando ela sai | `fn_allocate_recebimento` |
| ~~`mark_titulo_pago`~~ | 2 | **NÃO EXISTE** | Ver §3.1. "Título pago" é consequência de recebimento alocado, nunca um comando | — |
| `update_execution_status` | 2 | **ENGINE** | Há política: `faturamento` e `pago` são derivados do módulo financeiro e não podem ser digitados; retrocesso exige motivo; a data do fato ≠ a data do registro | `fn_update_execution_status` |
| `register_nf` | 2 | **NÃO EXISTE** | Ver §3 | — |

Nenhuma ferramenta desta leva foi classificada como CRUD. Isso não é coincidência: escrita que os agentes fazem sozinhos é sempre escrita com regra. CRUD puro é para tela com humano na frente.

## 3. `register_nf` não deve existir — a NF entra por `create_titulo`

> **DECIDIDO — Decisão #58, confirmada por Aryanna em 10/08/2026.** Esta seção deixou de ser proposta e passou a ser norma vigente. O que segue é o racional registrado.

A pergunta era se registrar NF é ferramenta própria ou parte de `update_execution_status`. A resposta é: **nenhuma das duas.**

Uma nota fiscal tem identidade própria — número, empresa emissora, tomador, valor bruto, retenção, líquido, vencimento, data de pagamento. Isso é uma entidade, não um atributo de projeto. No schema ela já existe: a tabela `invoices`. `projects.nf_data` é um campo espelho que ficou para trás.

Criar `register_nf` seria abrir uma **segunda porta para a mesma entidade** — e o resultado previsível é o de sempre: metade das notas em `invoices`, metade em `projects.nf_data`, e ninguém sabendo qual vale. Portanto:

> **Título a receber = uma linha em `invoices`. `create_titulo` é o único caminho de entrada de NF e recibo no sistema.** `projects.nf_data` passa a espelho depreciado, escrito pelo engine apenas quando estiver nulo, e some quando a UI for ajustada.

**Consequência já em vigor (Decisão #58):** é proibido gravar NF em `projects.nf_data` como registro primário, criar segunda porta de entrada para nota fiscal, ou responder "essa nota foi emitida / quem está devendo" a partir de `projects.nf_data`, `project_services.nf_number` ou `measurements.nf_numero`. A resposta vem de `invoices`. Vale para UI, migration, prompt de Lovable e ferramenta MCP.

**Anti-referência:** *Seeing Like a State* (Scott) — o campo `nf_data` no projeto é a simplificação legível que apaga a realidade (uma nota tem número, emissor, retenção e vencimento). O sistema tem que caber no negócio, não o contrário.

## 3.1 Recebimento é entidade própria — e saldo nunca é campo

> **Substitui a recomendação anterior da Decisão #59** ("baixa integral só; parcelamento vira N títulos"). Aquela recomendação partia de uma premissa falsa: a de que o parcelamento é combinado antes. Não é.

### O que a operação real mostra

Levantado nos relatórios de 03/08/2026 (`RELATORIOS_03AGO2026/FINANCEIRO/10` e `/11`), com dado real, não hipótese:

| Cliente | Em aberto | O que o banco mostra | Natureza |
|---|---|---|---|
| **HORIZON WEST** | R$ 4.500 | R$ 1.500 em 10/06 | **pagamento parcial puro** — restariam R$ 3.000 |
| **ECOMIX** | R$ 3.500 | R$ 6.000 (03/07) + R$ 1.200 (16/07) | dois recebimentos, um título, e ainda sobra |
| **AGUIA SISTEMAS** | R$ 2.000 | R$ 16.000 em 03/07 | **crédito 8× maior que o título** |
| **LOTES COLORADO** | R$ 12.000 | R$ 19.260 em 28/07 | excedente de R$ 7.260 sem destino |
| **POLIMIX** | R$ 74,9 mil (bloco) | R$ 58,1 mil em **7 parcelas** desde maio | irregular, contra um bloco de títulos |
| **GRAN ALPES** | R$ 7.000 | R$ 18.000 no ano | crédito acumulado |

Dez dos 43 títulos vencidos estão marcados no relatório como *"conferir abatimento antes de cobrar"*. Isso não é exceção: **é o padrão da casa.** O relatório 11 chega a estimar que o vencido cai de R$ 264 mil para R$ 220–230 mil só de conciliar dinheiro que já entrou e ninguém sabe contra o quê.

O diagnóstico correto não é "falta baixa parcial". É: **no momento em que o dinheiro entra, o sistema não sabe a qual título ele pertence — e às vezes o título nem existe ainda.** Modelar isso como atributo da nota é impossível por construção.

### Frase de síntese

**O dinheiro que entra é um lançamento próprio, imutável, ligado ao CLIENTE; o vínculo com a nota é uma segunda linha, também imutável; e o saldo do título é sempre uma soma, nunca um campo que alguém edita.**

**Referência conceitual:** o padrão **Account / Entry** de Martin Fowler (*Analysis Patterns*, capítulo de Accounting) — o saldo de uma conta não se guarda, se calcula pela soma dos lançamentos. Reforçado pelo princípio contábil que existe há quinhentos anos: **lançamento não se edita, se contra-lança.** Um estorno é uma linha nova de sinal oposto, não um `UPDATE`.

**Anti-referência (o que estamos deliberadamente evitando):**
1. **O campo `saldo` mutável** — `update invoices set saldo = saldo - 1500`. É *read-modify-write*: perde a história (quem abateu, quando, com qual comprovante), não sobrevive a duas baixas simultâneas, e não responde "por que o saldo é esse". A preocupação original da Aryanna estava certa; a modelagem abaixo a atende sem abrir mão do caso real.
2. **O adiantamento como nota fantasma** — criar uma NF que não existe no mundo só para ter onde pendurar o dinheiro. É *Seeing Like a State* (Scott) de novo: falsificar a realidade para caber no formulário. E colide de frente com a Decisão #58, que acabou de estabelecer `invoices` como registro de documento fiscal real.
3. **`mark_titulo_pago` como comando** — dizer ao sistema "este título está pago" é *Ask*, não *Tell*. O fato do negócio é "caiu R$ X do cliente Y no dia D"; "pago" é conclusão que o sistema tira sozinho.

### A modelagem

Três objetos, dois deles novos:

| Objeto | O que é | Muta? |
|---|---|---|
| `invoices` | o título — o que o cliente **deve**. Já existe (Decisão #58) | só o ciclo do documento (`pendente` → `emitida` / `cancelada`) |
| **`receipts`** (novo) | o recebimento — o dinheiro que **entrou**. Pertence ao **cliente** e à empresa recebedora, não à nota | **nunca.** Sem `UPDATE`, sem `DELETE` — nem por RLS |
| **`receipt_allocations`** (novo) | a alocação — "esta parte deste dinheiro refere-se a este título" | **nunca.** Desalocar é linha de sinal oposto |

E dois saldos, ambos **derivados por soma**, ambos em view:

- `v_titulos_receber.saldo` = `valor_liquido − Σ alocações do título`. Situação (`em_aberto` / `parcial` / `quitado`) sai daí.
- `v_credito_cliente.credito_disponivel` = `Σ recebimentos do cliente − Σ alocações desses recebimentos`. **Isto é o adiantamento.**

### Como cada caso real se resolve

| Caso | Como entra |
|---|---|
| **HORIZON WEST** paga 1.500 de uma nota de 4.500 | 1 recebimento (1.500) + 1 alocação (1.500) → título fica `parcial`, saldo 3.000. Nenhum campo editado |
| **POLIMIX** paga 7 vezes contra um bloco | 7 recebimentos, N alocações. O bloco quita quando a soma cobre. A ordem e o tamanho das parcelas são irrelevantes para o modelo |
| **AGUIA** manda 16.000 tendo 2.000 em aberto | 1 recebimento (16.000) + 1 alocação (2.000) → título `quitado`, **crédito do cliente = 14.000**, visível e nominal |
| **Adiantamento antes da NF existir** | 1 recebimento **sem nenhuma alocação**. É crédito puro. Quando a nota sair, `create_titulo` avisa que há crédito e `allocate_recebimento` faz o encontro |
| Pix devolvido / lançamento errado | recebimento novo com valor negativo apontando para o original (`estorna_id`). O original permanece. A soma se corrige sozinha |

O ponto que fecha o argumento: **o adiantamento deixa de ser uma anomalia e passa a ser o estado natural do modelo** — um recebimento que ainda não foi alocado. Não precisa de tabela especial, de flag, nem de saldo negativo em lugar nenhum. É a mesma linha que qualquer outro dinheiro, só que sem par.

*Heurística pessoal, não referência de autor:* quando o caso "excepcional" exige uma estrutura própria, quase sempre a estrutura principal está errada. Adiantamento não é exceção de pagamento — pagamento é que é adiantamento que já encontrou sua nota.

### O que isso custa

Duas tabelas e duas views a mais que a proposta anterior. Em troca: as quatro colunas mutáveis que o ADR ia criar em `invoices` (`valor_recebido`, `paid_at`, `payment_ref`, `paid_by_id`) **deixam de existir** — a dívida é evitada antes de nascer, não paga depois. Saldo líquido de complexidade: praticamente zero, e a resposta a *"quem está devendo"* passa a ser uma consulta a uma view em vez de uma reconciliação manual como a de 03/08.

## 4. Achados de schema que condicionam a implementação

Levantados hoje direto no banco de produção (leitura de schema, nunca de linha).

| # | Achado | Impacto | Tratamento |
|---|---|---|---|
| **A1** | `alerts.resolved_by` tem FK para **`employees`** | **Bloqueante.** Quem resolve um alerta é usuário, não funcionário. Aryanna, Sérgio e Ciro não estão em `employees` (Princípio #7) — hoje literalmente não conseguem resolver alerta sem violar a FK. Os usuários dos agentes também não | Coluna nova `resolved_by_profile_id` → `profiles`. A antiga fica, marcada como depreciada. Sem DROP |
| **A2** | `fn_on_status_change` insere alerta a cada `campo_concluido` e `entregue`; todo alerta com `recipient='financeiro'` dispara `fn_notify_financial_alert` → e-mail | **Bloqueante para a Fase 0.** Recarregar 3 meses geraria uma enxurrada de alertas e e-mails para a Alcione sobre fatos já resolvidos | Chave de sessão `ag.backfill`. Com ela ligada, o trigger não emite alerta |
| **A3** | `fn_on_status_change` faz `NEW.responsible_campo_id := auth.uid()` ao entrar em `em_campo` (idem técnico em `aguardando_processamento`) | **Bloqueante para a Fase 0.** A recarga reescreveria o responsável real de campo pelo usuário do agente, apagando a autoria verdadeira | Passa a `COALESCE(NEW.responsible_campo_id, v_uid)` — só preenche o que está vazio |
| **A4** | O mesmo trigger usa `CURRENT_DATE` para `field_completed_at` e `delivered_at` | Entregas de maio ficariam datadas de agosto | O engine grava a data real no mesmo UPDATE; o `COALESCE` do trigger a preserva. Parâmetro `data_efetiva` |
| **A5** | Número de NF vive em 4 lugares: `projects.nf_data`, `project_services.nf_number/nf_date`, `measurements.nf_numero/nf_data`, `invoices.nf_numero/nf_data` | Fonte canônica dividida — proibido por princípio | **Resolvido por decisão: #58 CONFIRMADA 10/08/2026.** `invoices` é a fonte; os outros viram espelho/legado |
| **A6** | `invoices.status` é `text` livre, sem CHECK, sem enum | Viola Decisão #55 | Vira enum `invoice_status` (`pendente`, `emitida`, `paga`, `cancelada`), com verificação prévia que aborta a migration se houver valor fora do conjunto |
| **A7** | `invoices` não tem vencimento nem qualquer registro de recebimento | Sem isso não existe contas a receber — o agente Financeiro não consegue responder "quem está devendo" | **Revisado (§3.1).** Em `invoices`, só `due_date` e `source_ref`. Recebimento vira tabela própria (`receipts` + `receipt_allocations`); saldo é derivado em view. **`paid_at`, `valor_recebido`, `payment_ref`, `paid_by_id` não são criados** |
| **A12** | Dez dos 43 títulos vencidos de 03/08 estão marcados como *"conferir abatimento"*: o cliente pagou valor que não corresponde a título nenhum | Confirma que pagamento irregular e adiantamento são o padrão, não a exceção. Fonte: `RELATORIOS_03AGO2026/FINANCEIRO/11` | Resolvido pela modelagem de §3.1 |
| **A13** | Podem existir linhas legadas com `invoices.status = 'paga'` sem recebimento correspondente | Depois de §3.1, a verdade sobre recebimento é `v_titulos_receber.situacao`; `status='paga'` vira legado órfão | O enum mantém `'paga'` para os dados existentes caberem, **mas nenhuma função escreve esse valor**. Regularizar as linhas legadas é trabalho da Fase 0 do Financeiro (exige comprovante real) — não da migration, que não inventa referência bancária |
| **A8** | Trigger `on_measurement_awaiting_nf` consulta `public.obras` (tabela inexistente) e `NEW.obra_id` (coluna inexistente) | Qualquer medição que vá para `aguardando_nf` quebra em runtime. Também usa vocabulário proibido | **Fora do escopo desta onda.** Correção pronta no Apêndice B, para aplicar separado |
| **A9** | `projects.tipo_documento` usa `'nota_fiscal'`; o enum `tipo_documento` de `invoices` usa `'nf'` | Mesmo conceito, dois vocabulários | O engine traduz. Registrado no `_GLOSSARIO` como dívida |
| **A10** | O rótulo do enum `ag_topografia` corresponde a **GONZAGA E BERLIM CONSTRUÇÕES** (16.841.054/0001-10), não a uma razão social chamada "AG Topografia" | Risco alto de o agente escolher a empresa errada | Descrição de toda ferramenta traz razão social + CNPJ explícitos. Enum não é renomeado agora (renomear é destrutivo) |
| **A11** | `supabase/functions/mcp/index.ts` é **auto-gerado** a partir de `src/lib/mcp/` | Editar o arquivo gerado é perda de trabalho garantida | A implementação mexe só em `src/lib/mcp/tools/*` e `src/lib/mcp/index.ts` |

## 5. Auditoria — quem, quando, por qual canal

Não se cria tabela nova. O sistema já tem `event_log` e a função `log_event(event_type, entity_table, entity_id, payload, context)`, que grava `actor_id = auth.uid()` e `occurred_at`.

Cada engine chama `log_event` uma vez, com:

```json
{ "canal": "mcp", "ferramenta": "create_titulo", "origem_ref": "<Message-ID do e-mail ou caminho no Drive>", "recarga": true }
```

Três garantias em uma linha:
- **quem** — `auth.uid()`, o usuário OAuth real do agente (não service role);
- **quando** — `occurred_at`;
- **por qual canal** — `context.canal='mcp'` + qual ferramenta + **qual documento de origem justificou a escrita**.

O `origem_ref` é o que transforma auditoria em prova: dá para voltar do lançamento ao e-mail que o originou. **É obrigatório em `create_titulo`** e recomendado nas demais.

*Heurística pessoal, não referência de autor:* rastro sem ponteiro para a fonte externa é rastro pela metade.

## 6. Idempotência — a recarga vai reprocessar e-mails

| Ferramenta | Chave natural | Segunda chamada faz o quê |
|---|---|---|
| `resolve_alert` | o próprio alerta | devolve `ja_resolvido: true`, sem erro e sem sobrescrever quem resolveu |
| `update_lead_status` | lead + status | se já está no status, devolve `sem_alteracao: true` e **não** grava histórico duplicado |
| `create_titulo` | `origem_ref` (único) **e** (`empresa_faturadora`, `nf_numero`) (único parcial) | devolve o título existente com `criado: false`. Índice único no banco — a proteção é do schema, não da boa vontade da aplicação |
| `register_recebimento` | `referencia_pagamento` (única no banco) | devolve o recebimento existente com `criado: false`. **É a trava de dupla baixa**: a mesma linha de extrato não entra duas vezes, nem que dois agentes tentem ao mesmo tempo |
| `allocate_recebimento` | (`recebimento_id`, `titulo_id`) — único no banco | segunda chamada do mesmo par devolve `ja_alocado: true`. Alocar valor diferente para o mesmo par é recusado: seria edição de lançamento |
| `update_execution_status` | projeto + status | se já está no status, `sem_alteracao: true` |

Nenhuma ferramenta apaga nada. Correção de título errado é `cancelada` + novo título; correção de recebimento errado é contra-lançamento (`estorna_id`), nunca `UPDATE`. Ambos no `event_log`. Não existe `delete_*` neste ADR nem deve existir depois.

## 7. RLS — as ferramentas rodam como o usuário

Confirmado hoje no banco (políticas de 10/08):

| Tabela | Quem escreve |
|---|---|
| `alerts` | qualquer autenticado (a política de *quem pode resolver* é do engine, mais restritiva que a RLS) |
| `leads` | master, diretor, comercial, financeiro |
| `projects` | qualquer autenticado |
| `invoices` | **master, diretor, financeiro apenas** |
| `receipts` (novo) | INSERT: master, diretor, financeiro. **Sem política de UPDATE nem de DELETE — a imutabilidade é do banco, não da boa vontade da aplicação** |
| `receipt_allocations` (novo) | idem `receipts` |
| `project_status_history` | master, diretor, operacional, sala_tecnica, financeiro |

Consequência operacional direta: **as funções são `SECURITY INVOKER`** (nunca `DEFINER`) para que a RLS continue valendo. Logo, o agente Financeiro precisa operar com um usuário de papel `financeiro` ou superior — senão `create_titulo` falha com permissão negada, o que é o comportamento correto. Ver Decisão #61.

## 8. O que a Aryanna precisa decidir — 4 perguntas binárias restantes

Uma de cada vez, com a recomendação primeiro.

**Decisão #58 — ✅ CONFIRMADA em 10/08/2026. Fechada.**
`invoices` é a única fonte de verdade de nota fiscal e título a receber; `projects.nf_data` vira espelho depreciado, escrito só quando estiver vazio. Registrada em `_DECISOES_FECHADAS.md` com a lista do que passa a ser proibido. Não reabrir sem ADR substituto.

**Decisão #59 — RECOMENDAÇÃO REVISADA em 10/08/2026. Recomendo: SIM — recebimento vira entidade própria.**

*A recomendação anterior era "baixa integral só, parcelamento vira N títulos". Ela caiu.* A resposta da Aryanna — **"é variado e às vezes dão adiantamento"** — e a conferência nos relatórios de 03/08 mostram que o recebimento irregular é o padrão da casa: HORIZON WEST pagou 1.500 de 4.500; AGUIA mandou 16.000 tendo 2.000 em aberto; POLIMIX pagou 58,1 mil em 7 parcelas. Dez títulos estão marcados como *"conferir abatimento"*. Dois títulos não cobrem isso, porque dois títulos pressupõem parcelamento combinado antes — e não é o caso.

O dinheiro que entra passa a ser uma linha própria (`receipts`), ligada ao **cliente**, imutável. O vínculo com a nota é outra linha (`receipt_allocations`), também imutável. **Saldo do título e crédito do cliente são somas em view, nunca campos editáveis** — a preocupação original com saldo mutável continua valendo e é justamente o que esta modelagem preserva. Adiantamento = recebimento ainda sem alocação. Consequência: `mark_titulo_pago` deixa de existir, substituída por `register_recebimento` e `allocate_recebimento`. Detalhe completo em §3.1.

*Confirma que o Financeiro passa a registrar o dinheiro que entra (recebimento), em vez de marcar o título como pago?*

**Decisão #60 — Recomendo: SIM.**
Durante a Fase 0, a recarga roda com alertas e e-mails automáticos suprimidos (chave `ag.backfill`). Fatos de maio não devem virar tarefa de agosto na caixa da Alcione.
*Confirma?*

**Decisão #61 — Recomendo: SIM.**
Cada agente do Cláudio ganha usuário OAuth próprio (ex.: `claudio.financeiro@`), separado dos usuários humanos, com o papel mínimo necessário. Assim o `event_log` distingue o que o agente fez do que a Alcione fez.
*Confirma?*

**Decisão #62 — Recomendo: SIM.**
`resolve_alert` recusa baixar alerta de emissão de documento (`entrega_concluida`) enquanto não existir título para aquele projeto. O agente não pode limpar o radar sem executar.
*Confirma?*

## 9. Fora do escopo (registrado para não voltar como surpresa)

- Ondas 3 e 4 (medições, RH, webhooks WhatsApp) — não entram aqui.
- `measurements` continua com seu próprio ciclo de status paralelo ao de `invoices`. São dois relógios para o mesmo fato; a unificação é da Onda 3.
- Correção do trigger quebrado de medições — Apêndice B, aplicar separado.
- Nenhum `DROP`, `DELETE` ou `RENAME` em qualquer bloco deste ADR.

## 10. Critério de pronto

Cada onda só é considerada entregue quando **o agente dono usa a ferramenta em produção por 2 semanas sem correção manual**. Onda 1 tem que estar nesse estado antes de a Onda 2 ir para produção — exceto durante a Fase 0, em que as duas sobem juntas por necessidade (a recarga precisa de título e de status).

---
---

# PARTE B — ESPECIFICAÇÃO DE IMPLEMENTAÇÃO

> ## ▼ COLAR A PARTIR DAQUI NO CHAT DO LOVABLE

Implemente as ferramentas de escrita do servidor MCP `ag-central-flow`, conforme a especificação abaixo. Siga na ordem: migration primeiro, funções depois, ferramentas por último.

**Regras de execução, inegociáveis:**

1. A migration deve ser criada como **ARQUIVO em `supabase/migrations/` com nome no padrão `<timestamp>_<uuid>.sql`** (o auto-apply ignora silenciosamente nomes humanos — já aconteceu duas vezes neste projeto). Depois de aplicar, regenere `types.ts`.
2. **Não edite `supabase/functions/mcp/index.ts`** — ele é auto-gerado. Crie os arquivos em `src/lib/mcp/tools/` e registre em `src/lib/mcp/index.ts`.
3. Todas as funções SQL são **`SECURITY INVOKER`** (o padrão — não escreva `SECURITY DEFINER`). As ferramentas têm que rodar sob a RLS do usuário logado.
4. Toda a migration é **idempotente** (`if not exists`, `create or replace`).
5. **Zero `as any`** no TypeScript (o ESLint quebra o build).
6. Nenhum `DROP`, `DELETE`, `TRUNCATE` ou `RENAME`.

---

## B1. Migration

```sql
-- =====================================================================
-- ADR-042 — MCP de escrita, ondas 1 e 2
-- Estrutura para: resolve_alert, update_lead_status, create_titulo,
--                 register_recebimento, allocate_recebimento,
--                 update_execution_status
-- Idempotente. Sem DROP/DELETE/RENAME.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. alerts: quem resolve é USUÁRIO, não funcionário
--    (resolved_by aponta para employees — diretoria não está lá)
-- ---------------------------------------------------------------------
alter table public.alerts
  add column if not exists resolved_by_profile_id uuid references public.profiles(id);

comment on column public.alerts.resolved_by is
  'DEPRECIADO (ADR-042). FK para employees; quem resolve alerta é usuário, não funcionário. Usar resolved_by_profile_id.';

-- ---------------------------------------------------------------------
-- 2. invoices: status vira enum (Decisão #55)
--    Aborta com mensagem legível se houver valor fora do conjunto.
-- ---------------------------------------------------------------------
do $$
declare v_bad text;
begin
  select string_agg(distinct status, ', ') into v_bad
  from public.invoices
  where status is not null
    and status not in ('pendente','emitida','paga','cancelada');

  if v_bad is not null then
    raise exception
      'ADR-042 abortado: invoices.status contém valores fora do enum (%). Normalizar antes de converter.', v_bad;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('pendente','emitida','paga','cancelada');
  end if;
end $$;

do $$
begin
  if (select udt_name from information_schema.columns
      where table_schema='public' and table_name='invoices' and column_name='status') = 'text' then
    alter table public.invoices alter column status drop default;
    alter table public.invoices
      alter column status type public.invoice_status
      using coalesce(status,'pendente')::public.invoice_status;
    alter table public.invoices alter column status set default 'pendente'::public.invoice_status;
    alter table public.invoices alter column status set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. invoices: vencimento e rastro de origem
--    ATENÇÃO (ADR-042 §3.1): NÃO existem aqui paid_at, valor_recebido,
--    payment_ref nem paid_by_id. Recebimento é entidade própria e saldo
--    é derivado por soma — nunca campo editável.
-- ---------------------------------------------------------------------
alter table public.invoices
  add column if not exists due_date   date,
  add column if not exists source_ref text;

comment on column public.invoices.due_date   is 'Vencimento do título.';
comment on column public.invoices.source_ref is 'Documento de origem (Message-ID de e-mail, caminho no Drive). Chave de idempotência da recarga.';
comment on column public.invoices.status     is
  'Ciclo do DOCUMENTO (pendente/emitida/cancelada). O valor ''paga'' é LEGADO e nenhuma função o escreve: a situação de recebimento vem de v_titulos_receber.situacao (ADR-042 §3.1).';

-- ---------------------------------------------------------------------
-- 4. Idempotência no schema, não na aplicação
-- ---------------------------------------------------------------------
create unique index if not exists ux_invoices_source_ref
  on public.invoices (source_ref)
  where source_ref is not null;

create unique index if not exists ux_invoices_empresa_nf
  on public.invoices (empresa_faturadora, nf_numero)
  where nf_numero is not null and status <> 'cancelada';

create index if not exists ix_invoices_project        on public.invoices (project_id);
create index if not exists ix_invoices_status_due     on public.invoices (status, due_date);

-- ---------------------------------------------------------------------
-- 4.1 receipts — o dinheiro que ENTROU. Lançamento imutável.
--     Pertence ao CLIENTE (Decisão #02), não à nota.
--     Estorno = linha nova de sinal oposto (estorna_id). Nunca UPDATE.
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients(id),
  empresa_recebedora   public.empresa_faturadora_enum not null,
  data_recebimento     date not null,
  valor                numeric not null,
  referencia_pagamento text not null,
  conta                text,
  origem_ref           text,
  observacoes          text,
  estorna_id           uuid references public.receipts(id),
  created_by_id        uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  constraint ck_receipts_valor_nao_zero check (valor <> 0)
);

comment on table  public.receipts is
  'Recebimento: dinheiro que entrou, ligado ao CLIENTE. IMUTÁVEL — sem UPDATE, sem DELETE. Correção é contra-lançamento via estorna_id. ADR-042 §3.1.';
comment on column public.receipts.referencia_pagamento is
  'Linha do extrato ou identificador do comprovante. ÚNICA no sistema — é a trava de dupla baixa.';
comment on column public.receipts.empresa_recebedora is
  'PJ que recebeu. ag_topografia = GONZAGA E BERLIM CONSTRUÇÕES (16.841.054/0001-10); ag_cartografia = AG CARTOGRAFIA (48.282.440/0001-05).';

create unique index if not exists ux_receipts_referencia
  on public.receipts (referencia_pagamento);
create index if not exists ix_receipts_client
  on public.receipts (client_id, data_recebimento);

-- ---------------------------------------------------------------------
-- 4.2 receipt_allocations — "esta parte deste dinheiro é desta nota".
--     Também imutável. Um recebimento aloca no máximo uma vez por título.
-- ---------------------------------------------------------------------
create table if not exists public.receipt_allocations (
  id              uuid primary key default gen_random_uuid(),
  receipt_id      uuid not null references public.receipts(id),
  invoice_id      uuid not null references public.invoices(id),
  valor           numeric not null,
  origem_ref      text,
  allocated_by_id uuid references public.profiles(id),
  allocated_at    timestamptz not null default now(),
  constraint ck_alloc_valor_nao_zero check (valor <> 0)
);

comment on table public.receipt_allocations is
  'Vínculo recebimento→título. IMUTÁVEL. Desalocar é linha de sinal oposto. Saldo do título = valor_liquido - soma daqui. ADR-042 §3.1.';

create unique index if not exists ux_alloc_receipt_invoice
  on public.receipt_allocations (receipt_id, invoice_id)
  where valor > 0;
create index if not exists ix_alloc_invoice on public.receipt_allocations (invoice_id);
create index if not exists ix_alloc_receipt on public.receipt_allocations (receipt_id);

-- ---------------------------------------------------------------------
-- 4.3 RLS: escreve quem pode faturar. NÃO existe policy de UPDATE nem
--     de DELETE — a imutabilidade é garantida pelo banco.
-- ---------------------------------------------------------------------
alter table public.receipts            enable row level security;
alter table public.receipt_allocations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipts' and policyname='receipts_select') then
    create policy receipts_select on public.receipts
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipts' and policyname='receipts_insert') then
    create policy receipts_insert on public.receipts
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','financeiro']::public.app_role[]));
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipt_allocations' and policyname='alloc_select') then
    create policy alloc_select on public.receipt_allocations
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipt_allocations' and policyname='alloc_insert') then
    create policy alloc_insert on public.receipt_allocations
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','financeiro']::public.app_role[]));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4.4 Os dois saldos — DERIVADOS POR SOMA, jamais campo.
-- ---------------------------------------------------------------------
create or replace view public.v_titulos_receber as
select
  i.id                as titulo_id,
  i.project_id,
  p.codigo            as projeto_codigo,
  p.name              as projeto_nome,
  p.client_id,
  c.name              as cliente,
  i.empresa_faturadora,
  i.tipo, i.nf_numero, i.nf_data, i.due_date,
  i.valor_bruto, i.retencao,
  coalesce(i.valor_liquido, i.valor_bruto)                                  as valor_titulo,
  coalesce(a.valor_alocado, 0)                                             as valor_recebido,
  coalesce(i.valor_liquido, i.valor_bruto) - coalesce(a.valor_alocado, 0)  as saldo,
  a.ultimo_recebimento_em,
  case
    when i.status = 'cancelada'                                                        then 'cancelado'
    when coalesce(a.valor_alocado,0) <= 0                                              then 'em_aberto'
    when coalesce(a.valor_alocado,0) >= coalesce(i.valor_liquido, i.valor_bruto)       then 'quitado'
    else 'parcial'
  end                 as situacao,
  i.status            as status_documento,
  i.source_ref
from public.invoices i
join public.projects p on p.id = i.project_id
left join public.clients c on c.id = p.client_id
left join lateral (
  select sum(ra.valor)            as valor_alocado,
         max(r.data_recebimento)  as ultimo_recebimento_em
  from public.receipt_allocations ra
  join public.receipts r on r.id = ra.receipt_id
  where ra.invoice_id = i.id
) a on true;

comment on view public.v_titulos_receber is
  'Contas a receber. saldo e situacao são SOMA, não campo. Responde "quem está devendo". ADR-042 §3.1.';

-- Sem isto a view roda como o DONO e a RLS das tabelas de baixo é ignorada.
-- Mesmo princípio do SECURITY INVOKER das funções (§7).
alter view public.v_titulos_receber set (security_invoker = on);

-- Adiantamento = recebimento ainda sem alocação. Não precisa de estrutura própria.
create or replace view public.v_credito_cliente as
select
  r.client_id,
  c.name                                          as cliente,
  r.empresa_recebedora,
  sum(r.valor)                                    as total_recebido,
  coalesce(sum(al.alocado), 0)                    as total_alocado,
  sum(r.valor) - coalesce(sum(al.alocado), 0)     as credito_disponivel
from public.receipts r
join public.clients c on c.id = r.client_id
left join lateral (
  select sum(ra.valor) as alocado
  from public.receipt_allocations ra
  where ra.receipt_id = r.id
) al on true
group by r.client_id, c.name, r.empresa_recebedora;

comment on view public.v_credito_cliente is
  'Crédito do cliente = dinheiro recebido ainda não alocado a título. É o ADIANTAMENTO. ADR-042 §3.1.';

alter view public.v_credito_cliente set (security_invoker = on);

-- ---------------------------------------------------------------------
-- 5. fn_on_status_change: 2 correções cirúrgicas
--    (a) não sobrescrever responsável já preenchido  [A3]
--    (b) não emitir alerta quando a sessão é de recarga  [A2]
--    Todo o resto do corpo é idêntico ao vigente.
-- ---------------------------------------------------------------------
create or replace function public.fn_on_status_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_doc_label text;
  v_backfill boolean;
begin
  begin
    v_uid := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  exception when others then
    v_uid := null;
  end;

  v_backfill := coalesce(current_setting('ag.backfill', true), 'off') = 'on';

  -- Campo iniciado
  if NEW.execution_status = 'em_campo' and OLD.execution_status <> 'em_campo' then
    NEW.field_started_at := coalesce(NEW.field_started_at, current_date);
    -- ADR-042: só preenche se estiver vazio; nunca reescreve autoria real
    NEW.responsible_campo_id := coalesce(NEW.responsible_campo_id, v_uid);
  end if;

  -- Entrou em processamento
  if NEW.execution_status = 'aguardando_processamento'
     and OLD.execution_status <> 'aguardando_processamento' then
    NEW.responsible_tecnico_id := coalesce(NEW.responsible_tecnico_id, v_uid);
  end if;

  -- Campo concluído
  if NEW.execution_status = 'campo_concluido' and OLD.execution_status <> 'campo_concluido' then
    NEW.field_completed_at := coalesce(NEW.field_completed_at, current_date);

    if not v_backfill then
      insert into public.alerts (
        alert_type, title, message, origem_modulo, tipo,
        recipient, priority, alert_status, reference_id, reference_type, action_url
      ) values (
        'campo_concluido',
        'Campo concluído: ' || NEW.codigo,
        'Campo concluído — disponível para processamento: ' || NEW.codigo || ' — ' || NEW.name,
        'operacional', 'campo_concluido',
        'sala_tecnica', 'importante', 'ativo',
        NEW.id, 'project', '/sala-tecnica/projetos/' || NEW.id::text
      );
    end if;
  end if;

  -- Entregue
  if NEW.execution_status = 'entregue' and OLD.execution_status <> 'entregue' then
    NEW.delivered_at := coalesce(NEW.delivered_at, current_date);

    v_doc_label := case NEW.billing_type
      when 'entrega_nf'     then 'Emitir NF'
      when 'entrega_recibo' then 'Emitir Recibo'
      when 'medicao_mensal' then null
      when 'sem_documento'  then null
      else 'Verificar documento'
    end;

    if v_doc_label is not null and not v_backfill then
      insert into public.alerts (
        alert_type, title, message, origem_modulo, tipo,
        recipient, priority, alert_status, reference_id, reference_type, action_url
      ) values (
        'entrega_concluida',
        v_doc_label || ': ' || NEW.codigo,
        v_doc_label || ' — ' || NEW.codigo || ' · ' || NEW.name
          || ' · Entregue em ' || to_char(coalesce(NEW.delivered_at, current_date), 'DD/MM/YYYY'),
        'sala_tecnica', 'entrega_concluida',
        'financeiro', 'urgente', 'ativo',
        NEW.id, 'project', '/financeiro/projetos/' || NEW.id::text
      );
    end if;
  end if;

  -- Preparação técnica
  if NEW.needs_tech_prep = true
     and OLD.execution_status is distinct from NEW.execution_status
     and NEW.execution_status = 'aguardando_processamento'
     and not v_backfill then
    insert into public.alerts (
      alert_type, title, message, origem_modulo, tipo,
      recipient, priority, alert_status, reference_id, reference_type, action_url
    ) values (
      'needs_tech_prep',
      'Novo projeto para distribuir: ' || NEW.codigo,
      'Novo projeto requer preparação técnica: ' || NEW.codigo || ' — ' || NEW.name,
      'comercial', 'needs_tech_prep',
      'sala_tecnica', 'importante', 'ativo',
      NEW.id, 'project', '/sala-tecnica/projetos/' || NEW.id::text
    );
  end if;

  return NEW;
end;
$function$;
```

---

## B2. Funções SQL (os engines)

### `fn_resolve_alert`

```sql
create or replace function public.fn_resolve_alert(
  p_alert_id   uuid,
  p_resolucao  text,
  p_origem_ref text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_alert   public.alerts%rowtype;
  v_roles   public.app_role[];
  v_tem_titulo boolean;
begin
  if coalesce(trim(p_resolucao),'') = '' then
    raise exception 'Informe o que foi feito para resolver o alerta (parâmetro resolucao).';
  end if;

  select * into v_alert from public.alerts where id = p_alert_id;
  if not found then
    raise exception 'Alerta % não encontrado.', p_alert_id;
  end if;

  -- Idempotente: já resolvido não é erro
  if v_alert.resolved then
    return jsonb_build_object(
      'ja_resolvido', true,
      'alerta_id', v_alert.id,
      'titulo', v_alert.title,
      'resolvido_em', v_alert.resolved_at
    );
  end if;

  -- Política: quem pode dar baixa depende do destinatário
  v_roles := case v_alert.recipient
    when 'operacional'  then array['master','diretor','operacional']::public.app_role[]
    when 'comercial'    then array['master','diretor','comercial']::public.app_role[]
    when 'financeiro'   then array['master','diretor','financeiro']::public.app_role[]
    when 'rh'           then array['master','diretor','financeiro']::public.app_role[]
    when 'sala_tecnica' then array['master','diretor','sala_tecnica']::public.app_role[]
    when 'diretoria'    then array['master','diretor']::public.app_role[]
    else array['master','diretor','operacional','sala_tecnica','comercial','financeiro']::public.app_role[]
  end;

  if not public.has_any_role(auth.uid(), v_roles) then
    raise exception 'Sem permissão: alerta destinado a % exige papel compatível.', v_alert.recipient;
  end if;

  -- Política: alerta de emissão de documento exige o documento (Decisão #62)
  if v_alert.alert_type = 'entrega_concluida' and v_alert.reference_type = 'project' then
    select exists (
      select 1 from public.invoices i
      where i.project_id = v_alert.reference_id and i.status <> 'cancelada'
    ) into v_tem_titulo;

    if not v_tem_titulo then
      raise exception
        'Este alerta pede emissão de documento e não existe título para o projeto. Registre com create_titulo — o título resolve o alerta sozinho.';
    end if;
  end if;

  update public.alerts
     set resolved = true,
         resolved_at = now(),
         resolved_by_profile_id = auth.uid(),
         alert_status = 'resolvido',
         read = true
   where id = p_alert_id;

  perform public.log_event(
    'alert.resolved', 'alerts', p_alert_id,
    jsonb_build_object('alert_type', v_alert.alert_type, 'recipient', v_alert.recipient, 'resolucao', p_resolucao),
    jsonb_build_object('canal','mcp','ferramenta','resolve_alert','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'ja_resolvido', false,
    'alerta_id', v_alert.id,
    'titulo', v_alert.title,
    'tipo', v_alert.alert_type,
    'resolvido_em', now()
  );
end;
$$;
```

### `fn_update_lead_status`

```sql
create or replace function public.fn_update_lead_status(
  p_lead_id     uuid,
  p_novo_status public.lead_status,
  p_observacao  text default null,
  p_origem_ref  text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'Lead % não encontrado.', p_lead_id;
  end if;

  if v_lead.status = p_novo_status then
    return jsonb_build_object('sem_alteracao', true, 'lead_id', v_lead.id,
                              'codigo', v_lead.codigo, 'status', v_lead.status);
  end if;

  -- Política: 'convertido' é consequência da conversão (que cria o projeto), não um status que se digita
  if p_novo_status = 'convertido' then
    raise exception
      'Status convertido é resultado da conversão do lead em projeto. Use o fluxo de conversão — não mova o status na mão.';
  end if;

  -- Política: perda exige motivo
  if p_novo_status in ('descartado','perdido') and coalesce(trim(p_observacao),'') = '' then
    raise exception 'Descarte e perda exigem motivo (parâmetro observacao).';
  end if;

  update public.leads
     set status = p_novo_status, updated_at = now()
   where id = p_lead_id;

  insert into public.lead_status_history (lead_id, from_status, to_status, changed_by_id, notes)
  values (p_lead_id, v_lead.status::text, p_novo_status::text, auth.uid(), p_observacao);

  perform public.log_event(
    'lead.status_changed', 'leads', p_lead_id,
    jsonb_build_object('de', v_lead.status, 'para', p_novo_status, 'observacao', p_observacao),
    jsonb_build_object('canal','mcp','ferramenta','update_lead_status','origem_ref', p_origem_ref)
  );

  return jsonb_build_object('sem_alteracao', false, 'lead_id', v_lead.id, 'codigo', v_lead.codigo,
                            'nome', v_lead.name, 'de', v_lead.status, 'para', p_novo_status);
end;
$$;
```

### `fn_create_titulo`

```sql
create or replace function public.fn_create_titulo(
  p_projeto_codigo text,
  p_valor_bruto    numeric,
  p_origem_ref     text,
  p_tipo           public.tipo_documento default null,
  p_nf_numero      text default null,
  p_nf_data        date default null,
  p_vencimento     date default null,
  p_retencao       numeric default 0,
  p_cnpj_tomador   text default null,
  p_observacoes    text default null,
  p_recarga        boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj      public.projects%rowtype;
  v_cli       public.clients%rowtype;
  v_existente public.invoices%rowtype;
  v_empresa   public.empresa_faturadora_enum;
  v_tipo      public.tipo_documento;
  v_cnpj      text;
  v_status    public.invoice_status;
  v_liquido   numeric;
  v_id        uuid;
  v_alertas   int := 0;
  v_credito   numeric := 0;
begin
  if coalesce(trim(p_origem_ref),'') = '' then
    raise exception 'origem_ref é obrigatório: informe o documento que originou o título (Message-ID do e-mail ou caminho no Drive).';
  end if;
  if p_valor_bruto is null or p_valor_bruto <= 0 then
    raise exception 'valor_bruto deve ser maior que zero.';
  end if;
  if p_nf_numero is not null and p_nf_data is null then
    raise exception 'Informou número de nota: informe também a data de emissão.';
  end if;

  -- Idempotência 1: mesma origem
  select * into v_existente from public.invoices where source_ref = p_origem_ref;
  if found then
    return jsonb_build_object('criado', false, 'motivo', 'origem_ja_registrada',
      'titulo_id', v_existente.id, 'nf_numero', v_existente.nf_numero, 'status', v_existente.status);
  end if;

  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  -- Idempotência 2: mesma nota da mesma empresa emissora
  v_empresa := v_proj.empresa_faturadora::public.empresa_faturadora_enum;
  if p_nf_numero is not null then
    select * into v_existente from public.invoices
     where empresa_faturadora = v_empresa and nf_numero = p_nf_numero and status <> 'cancelada';
    if found then
      return jsonb_build_object('criado', false, 'motivo', 'nota_ja_registrada',
        'titulo_id', v_existente.id, 'nf_numero', v_existente.nf_numero, 'status', v_existente.status);
    end if;
  end if;

  -- Regra da casa: nunca misturar os dois CNPJs. A empresa emissora é a do contrato do projeto.
  if v_proj.client_id is null then
    raise exception 'Projeto % não tem cliente vinculado. CLIENTE é o centro — vincule antes de faturar.', p_projeto_codigo;
  end if;
  select * into v_cli from public.clients where id = v_proj.client_id;

  v_cnpj := coalesce(p_cnpj_tomador, v_proj.cnpj_tomador, v_cli.cnpj);
  if p_cnpj_tomador is not null and v_cli.cnpj is not null
     and regexp_replace(p_cnpj_tomador,'\D','','g') <> regexp_replace(v_cli.cnpj,'\D','','g') then
    raise exception 'CNPJ do tomador (%) diverge do cadastro do cliente % (%). Corrija o cadastro antes de faturar.',
      p_cnpj_tomador, v_cli.name, v_cli.cnpj;
  end if;

  -- Tradução de vocabulário: projects usa 'nota_fiscal', o enum usa 'nf'
  v_tipo := coalesce(p_tipo,
              case when v_proj.tipo_documento = 'recibo' then 'recibo'::public.tipo_documento
                   else 'nf'::public.tipo_documento end);

  v_liquido := p_valor_bruto - coalesce(p_retencao, 0);
  if v_liquido < 0 then
    raise exception 'Retenção (%) maior que o valor bruto (%).', p_retencao, p_valor_bruto;
  end if;

  v_status := case when p_nf_numero is not null then 'emitida'::public.invoice_status
                   else 'pendente'::public.invoice_status end;

  insert into public.invoices (
    project_id, tipo, nf_numero, nf_data, empresa_faturadora, cnpj_tomador,
    valor_bruto, retencao, valor_liquido, due_date, status, notes,
    created_by_id, source_ref
  ) values (
    v_proj.id, v_tipo, p_nf_numero, p_nf_data, v_empresa, v_cnpj,
    p_valor_bruto, coalesce(p_retencao,0), v_liquido, p_vencimento, v_status, p_observacoes,
    auth.uid(), p_origem_ref
  ) returning id into v_id;

  -- Espelho depreciado (ADR-042 §3): só preenche se estiver vazio
  if p_nf_data is not null and v_proj.nf_data is null then
    update public.projects set nf_data = p_nf_data where id = v_proj.id;
  end if;

  -- Nota emitida move o projeto para faturamento (derivado, não digitado)
  if v_status = 'emitida'
     and v_proj.execution_status is distinct from 'faturamento'
     and v_proj.execution_status is distinct from 'pago' then
    if p_recarga then perform set_config('ag.backfill','on',true); end if;
    update public.projects set execution_status = 'faturamento' where id = v_proj.id;
    if p_recarga then perform set_config('ag.backfill','off',true); end if;
  end if;

  -- Fecha o laço: o alerta que pediu a emissão morre com o título criado
  update public.alerts
     set resolved = true, resolved_at = now(), resolved_by_profile_id = auth.uid(),
         alert_status = 'resolvido', read = true
   where alert_type = 'entrega_concluida' and reference_type = 'project'
     and reference_id = v_proj.id and resolved = false;
  get diagnostics v_alertas = row_count;

  perform public.log_event(
    'titulo.created', 'invoices', v_id,
    jsonb_build_object('projeto', v_proj.codigo, 'cliente', v_cli.name, 'tipo', v_tipo,
                       'nf_numero', p_nf_numero, 'valor_bruto', p_valor_bruto,
                       'retencao', coalesce(p_retencao,0), 'valor_liquido', v_liquido,
                       'empresa_faturadora', v_empresa),
    jsonb_build_object('canal','mcp','ferramenta','create_titulo','origem_ref', p_origem_ref,'recarga', p_recarga)
  );

  -- ADR-042 §3.1: se o cliente já mandou dinheiro sem destino, AVISA.
  -- Não aloca sozinho: adivinhar a que se refere é inventar dado.
  select coalesce(credito_disponivel, 0) into v_credito
    from public.v_credito_cliente
   where client_id = v_proj.client_id and empresa_recebedora = v_empresa;

  return jsonb_build_object(
    'criado', true, 'titulo_id', v_id, 'projeto', v_proj.codigo, 'cliente', v_cli.name,
    'empresa_faturadora', v_empresa, 'tipo', v_tipo, 'nf_numero', p_nf_numero,
    'valor_bruto', p_valor_bruto, 'retencao', coalesce(p_retencao,0), 'valor_liquido', v_liquido,
    'vencimento', p_vencimento, 'status', v_status, 'alertas_resolvidos', v_alertas,
    'credito_do_cliente_disponivel', coalesce(v_credito,0),
    'dica', case when coalesce(v_credito,0) > 0
                 then 'Este cliente tem crédito não alocado (adiantamento). Use allocate_recebimento para abater este título.'
                 else null end
  );
end;
$$;
```

### `fn_recalc_project_paid` — auxiliar

O projeto vira `pago` quando nenhum título dele tem saldo. **Derivado, recalculado — nunca incrementado.**

```sql
create or replace function public.fn_recalc_project_paid(p_project_id uuid)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare
  v_com_saldo int;
  v_titulos   int;
begin
  select count(*) filter (where saldo > 0.01), count(*)
    into v_com_saldo, v_titulos
    from public.v_titulos_receber
   where project_id = p_project_id and situacao <> 'cancelado';

  if v_titulos > 0 and v_com_saldo = 0 then
    update public.projects
       set execution_status = 'pago'
     where id = p_project_id and execution_status is distinct from 'pago';
    return true;
  end if;

  return false;
end;
$$;
```

### `fn_allocate_recebimento`

O ato de dizer "este dinheiro que já entrou refere-se a esta nota". É por aqui que o **adiantamento encontra a nota** quando ela finalmente sai.

```sql
create or replace function public.fn_allocate_recebimento(
  p_recebimento_id uuid,
  p_alocacoes      jsonb,          -- [{"titulo_id":"uuid","valor":1500.00}, ...]
  p_origem_ref     text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_rec        public.receipts%rowtype;
  v_item       jsonb;
  v_titulo_id  uuid;
  v_valor      numeric;
  v_inv        public.invoices%rowtype;
  v_proj       public.projects%rowtype;
  v_saldo      numeric;
  v_nao_aloc   numeric;
  v_ja         boolean;
  v_result     jsonb := '[]'::jsonb;
  v_quitados   jsonb := '[]'::jsonb;
  v_total      numeric := 0;
begin
  -- Trava a linha: duas alocações simultâneas não podem estourar o recebimento
  select * into v_rec from public.receipts where id = p_recebimento_id for update;
  if not found then
    raise exception 'Recebimento % não encontrado.', p_recebimento_id;
  end if;
  if v_rec.valor < 0 then
    raise exception 'Recebimento % é um estorno (valor negativo). Estorno não se aloca.', p_recebimento_id;
  end if;

  select v_rec.valor - coalesce(sum(ra.valor), 0) into v_nao_aloc
    from public.receipt_allocations ra where ra.receipt_id = p_recebimento_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_alocacoes, '[]'::jsonb))
  loop
    v_titulo_id := (v_item->>'titulo_id')::uuid;
    v_valor     := (v_item->>'valor')::numeric;

    if v_valor is null or v_valor <= 0 then
      raise exception 'Valor de alocação deve ser maior que zero (título %).', v_titulo_id;
    end if;

    -- Idempotência: um recebimento aloca no máximo uma vez por título
    select exists (
      select 1 from public.receipt_allocations
       where receipt_id = p_recebimento_id and invoice_id = v_titulo_id and valor > 0
    ) into v_ja;

    if v_ja then
      v_result := v_result || jsonb_build_array(
        jsonb_build_object('titulo_id', v_titulo_id, 'ja_alocado', true));
      continue;
    end if;

    select * into v_inv from public.invoices where id = v_titulo_id for update;
    if not found then
      raise exception 'Título % não encontrado.', v_titulo_id;
    end if;
    if v_inv.status = 'cancelada' then
      raise exception 'Título % está cancelado e não recebe alocação.', v_titulo_id;
    end if;

    select * into v_proj from public.projects where id = v_inv.project_id;

    -- Regra da casa: dinheiro do cliente só abate título do próprio cliente
    if v_proj.client_id is distinct from v_rec.client_id then
      raise exception
        'Título % pertence a outro cliente. Recebimento é do cliente %; não se abate título de terceiro.',
        v_titulo_id, v_rec.client_id;
    end if;

    -- Regra da casa: nunca misturar os dois CNPJs
    if v_inv.empresa_faturadora is distinct from v_rec.empresa_recebedora then
      raise exception
        'Empresa não bate: o título foi emitido por % e o dinheiro entrou em %. Confira em qual PJ o crédito caiu.',
        v_inv.empresa_faturadora, v_rec.empresa_recebedora;
    end if;

    select saldo into v_saldo from public.v_titulos_receber where titulo_id = v_titulo_id;

    if v_valor > v_saldo + 0.01 then
      raise exception
        'Alocação de % excede o saldo do título % (saldo %). Aloque no máximo o saldo; o resto fica como crédito do cliente.',
        v_valor, coalesce(v_inv.nf_numero, v_titulo_id::text), v_saldo;
    end if;

    if v_valor > v_nao_aloc + 0.01 then
      raise exception
        'Alocação de % excede o que resta do recebimento (disponível %). O dinheiro não estica.',
        v_valor, v_nao_aloc;
    end if;

    insert into public.receipt_allocations (receipt_id, invoice_id, valor, origem_ref, allocated_by_id)
    values (p_recebimento_id, v_titulo_id, v_valor, p_origem_ref, auth.uid());

    v_nao_aloc := v_nao_aloc - v_valor;
    v_total    := v_total + v_valor;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'titulo_id', v_titulo_id, 'ja_alocado', false,
      'nf_numero', v_inv.nf_numero, 'projeto', v_proj.codigo,
      'saldo_anterior', v_saldo, 'alocado', v_valor, 'saldo_atual', v_saldo - v_valor,
      'situacao', case when v_saldo - v_valor <= 0.01 then 'quitado' else 'parcial' end));

    if public.fn_recalc_project_paid(v_proj.id) then
      v_quitados := v_quitados || jsonb_build_array(v_proj.codigo);
    end if;
  end loop;

  perform public.log_event(
    'recebimento.allocated', 'receipts', p_recebimento_id,
    jsonb_build_object('alocado_nesta_chamada', v_total, 'credito_restante', v_nao_aloc,
                       'titulos', v_result),
    jsonb_build_object('canal','mcp','ferramenta','allocate_recebimento','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'recebimento_id', p_recebimento_id,
    'valor_recebimento', v_rec.valor,
    'alocado_nesta_chamada', v_total,
    'credito_disponivel', v_nao_aloc,
    'titulos', v_result,
    'projetos_quitados', v_quitados);
end;
$$;
```

### `fn_register_recebimento`

```sql
create or replace function public.fn_register_recebimento(
  p_cliente_id           uuid,
  p_valor                numeric,
  p_data_recebimento     date,
  p_referencia_pagamento text,
  p_empresa_recebedora   public.empresa_faturadora_enum,
  p_alocacoes            jsonb default '[]'::jsonb,
  p_conta                text default null,
  p_origem_ref           text default null,
  p_observacoes          text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_exist  public.receipts%rowtype;
  v_cli    public.clients%rowtype;
  v_id     uuid;
  v_aloc   jsonb;
begin
  if coalesce(trim(p_referencia_pagamento),'') = '' then
    raise exception 'referencia_pagamento é obrigatória (linha do extrato ou identificador do comprovante). É ela que impede dupla baixa.';
  end if;
  if p_data_recebimento is null then
    raise exception 'data_recebimento é obrigatória. Não inventar data.';
  end if;
  if p_data_recebimento > current_date then
    raise exception 'data_recebimento no futuro (%). O sistema registra dinheiro que já entrou.', p_data_recebimento;
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor deve ser maior que zero. Estorno não entra por aqui — é decisão humana pela tela.';
  end if;

  -- Idempotência e trava de dupla baixa: a mesma linha de extrato não entra duas vezes
  select * into v_exist from public.receipts where referencia_pagamento = p_referencia_pagamento;
  if found then
    return jsonb_build_object('criado', false, 'motivo', 'referencia_ja_registrada',
      'recebimento_id', v_exist.id, 'valor', v_exist.valor,
      'data_recebimento', v_exist.data_recebimento);
  end if;

  -- CLIENTE é o centro: dinheiro sem dono não entra
  select * into v_cli from public.clients where id = p_cliente_id;
  if not found then
    raise exception 'Cliente % não encontrado. Recebimento sem cliente não é registrável.', p_cliente_id;
  end if;

  insert into public.receipts (
    client_id, empresa_recebedora, data_recebimento, valor,
    referencia_pagamento, conta, origem_ref, observacoes, created_by_id
  ) values (
    p_cliente_id, p_empresa_recebedora, p_data_recebimento, p_valor,
    p_referencia_pagamento, p_conta, p_origem_ref, p_observacoes, auth.uid()
  ) returning id into v_id;

  perform public.log_event(
    'recebimento.created', 'receipts', v_id,
    jsonb_build_object('cliente', v_cli.name, 'valor', p_valor,
                       'data_recebimento', p_data_recebimento,
                       'empresa_recebedora', p_empresa_recebedora,
                       'referencia', p_referencia_pagamento, 'conta', p_conta),
    jsonb_build_object('canal','mcp','ferramenta','register_recebimento','origem_ref', p_origem_ref)
  );

  -- Alocações são opcionais. Sem elas, o dinheiro fica como CRÉDITO do cliente
  -- (adiantamento) — que é um estado válido, não um erro.
  v_aloc := public.fn_allocate_recebimento(v_id, coalesce(p_alocacoes,'[]'::jsonb), p_origem_ref);

  return jsonb_build_object(
    'criado', true,
    'recebimento_id', v_id,
    'cliente', v_cli.name,
    'empresa_recebedora', p_empresa_recebedora,
    'valor', p_valor,
    'data_recebimento', p_data_recebimento,
    'alocado', v_aloc->'alocado_nesta_chamada',
    'credito_gerado', v_aloc->'credito_disponivel',
    'titulos', v_aloc->'titulos',
    'projetos_quitados', v_aloc->'projetos_quitados',
    'dica', case when (v_aloc->>'credito_disponivel')::numeric > 0.01
                 then 'Sobrou crédito não alocado para este cliente (adiantamento). Quando a nota sair, use allocate_recebimento.'
                 else null end);
end;
$$;
```

### `fn_update_execution_status`

```sql
create or replace function public.fn_update_execution_status(
  p_projeto_codigo text,
  p_novo_status    public.execution_status,
  p_data_efetiva   date default null,
  p_motivo         text default null,
  p_origem_ref     text default null,
  p_recarga        boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj  public.projects%rowtype;
  v_data  date;
  v_pos_old int;
  v_pos_new int;
begin
  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  if v_proj.execution_status = p_novo_status then
    return jsonb_build_object('sem_alteracao', true, 'projeto', v_proj.codigo, 'status', v_proj.execution_status);
  end if;

  -- Política: faturamento e pago são derivados do financeiro, não se digitam aqui
  if p_novo_status in ('faturamento','pago') then
    raise exception
      'Status % é consequência do módulo Financeiro: use create_titulo (faturamento) ou register_recebimento (pago — o projeto quita sozinho quando nenhum título tem saldo).', p_novo_status;
  end if;

  v_pos_old := array_position(enum_range(null::public.execution_status), v_proj.execution_status);
  v_pos_new := array_position(enum_range(null::public.execution_status), p_novo_status);

  -- Política: voltar atrás é correção e exige motivo registrado
  if v_pos_new < v_pos_old and coalesce(trim(p_motivo),'') = '' then
    raise exception 'Retrocesso de % para % é correção e exige motivo.', v_proj.execution_status, p_novo_status;
  end if;

  v_data := coalesce(p_data_efetiva, current_date);
  if v_data > current_date then
    raise exception 'data_efetiva no futuro (%). O sistema registra fato ocorrido.', v_data;
  end if;

  if p_recarga then perform set_config('ag.backfill','on',true); end if;

  update public.projects
     set execution_status  = p_novo_status,
         field_started_at   = case when p_novo_status = 'em_campo'        then coalesce(field_started_at,  v_data) else field_started_at  end,
         field_completed_at = case when p_novo_status = 'campo_concluido' then coalesce(field_completed_at, v_data) else field_completed_at end,
         delivered_at       = case when p_novo_status = 'entregue'        then coalesce(delivered_at,      v_data) else delivered_at      end
   where id = v_proj.id;

  if p_recarga then perform set_config('ag.backfill','off',true); end if;

  insert into public.project_status_history (project_id, from_status, to_status, changed_by_id, modulo, notes)
  values (v_proj.id, v_proj.execution_status::text, p_novo_status::text, auth.uid(), 'mcp', p_motivo);

  perform public.log_event(
    'project.execution_status_changed', 'projects', v_proj.id,
    jsonb_build_object('de', v_proj.execution_status, 'para', p_novo_status,
                       'data_efetiva', v_data, 'motivo', p_motivo,
                       'retrocesso', (v_pos_new < v_pos_old)),
    jsonb_build_object('canal','mcp','ferramenta','update_execution_status','origem_ref', p_origem_ref,'recarga', p_recarga)
  );

  return jsonb_build_object('sem_alteracao', false, 'projeto', v_proj.codigo, 'nome', v_proj.name,
    'de', v_proj.execution_status, 'para', p_novo_status, 'data_efetiva', v_data,
    'retrocesso', (v_pos_new < v_pos_old));
end;
$$;
```

---

## B3. Ferramentas MCP

Padrão de implementação — cada ferramenta é um arquivo em `src/lib/mcp/tools/`, no mesmo estilo de `create-lead.ts`, e chama **exclusivamente** a função SQL correspondente via `supabase.rpc(...)`. **Nenhuma regra de negócio no TypeScript.** Erro vindo do banco é devolvido ao agente com `isError: true` e a mensagem original em português — as mensagens foram escritas para o agente ler e corrigir sozinho.

Modelo (usar para as seis, trocando nome, schema e RPC):

```ts
// src/lib/mcp/tools/resolve-alert.ts
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resolve_alert",
  title: "Resolver alerta",
  description:
    "Dá baixa em um alerta do Radar depois que a ação foi executada. Exige descrever o que foi feito. " +
    "Só pode ser usada pelo setor destinatário do alerta (ou diretoria). " +
    "Alerta que pede emissão de nota/recibo não pode ser baixado aqui: registre o título com create_titulo, que o alerta fecha sozinho.",
  inputSchema: {
    alerta_id: z.string().uuid().describe("UUID do alerta, obtido em list_alerts."),
    resolucao: z.string().trim().min(5).describe("O que foi feito para resolver. Vai para o registro de auditoria."),
    origem_ref: z.string().trim().optional()
      .describe("Documento que justificou a baixa (Message-ID do e-mail, caminho no Drive)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ alerta_id, resolucao, origem_ref }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_resolve_alert", {
      p_alert_id: alerta_id,
      p_resolucao: resolucao,
      p_origem_ref: origem_ref ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
```

Registrar as **seis** em `src/lib/mcp/index.ts`, no array `tools`: `resolve_alert`, `update_lead_status`, `create_titulo`, `register_recebimento`, `allocate_recebimento`, `update_execution_status`.

### Onda 1

#### `resolve_alert` — Resolver alerta

**Descrição (é o que o agente lê):** *"Dá baixa em um alerta do Radar depois que a ação foi executada. Exige descrever o que foi feito. Só pode ser usada pelo setor destinatário do alerta (ou diretoria). Alerta que pede emissão de nota/recibo não pode ser baixado aqui: registre o título com `create_titulo`, que o alerta fecha sozinho."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `alerta_id` | uuid | **sim** | vem de `list_alerts` |
| `resolucao` | string (mín. 5) | **sim** | o que foi feito |
| `origem_ref` | string | não | documento que justificou |

**Retorna:** `{ ja_resolvido, alerta_id, titulo, tipo, resolvido_em }`
**Não permite:** resolver alerta de outro setor; resolver `entrega_concluida` sem título; apagar alerta; reabrir alerta resolvido; baixa em massa (uma chamada, um alerta).

#### `update_lead_status` — Mover lead no funil

**Descrição:** *"Move um lead para outro status do funil comercial. Use ao confirmar contato, envio de proposta, negociação, perda ou descarte. Perda e descarte exigem motivo. Para transformar lead em projeto use o fluxo de conversão — o status `convertido` não se digita."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `lead_id` | uuid | **sim** | de `list_leads` |
| `novo_status` | enum: `novo`, `em_contato`, `qualificado`, `proposta_enviada`, `em_negociacao`, `aprovado`, `perdido`, `descartado` | **sim** | `convertido` fora da lista de propósito |
| `observacao` | string | condicional | obrigatório em `perdido` e `descartado` |
| `origem_ref` | string | não | — |

**Retorna:** `{ sem_alteracao, lead_id, codigo, nome, de, para }`
**Não permite:** `convertido`; perder/descartar sem motivo; alterar outros campos do lead; apagar lead; histórico duplicado quando o status já é o mesmo.

### Onda 2

#### `create_titulo` — Registrar título (NF ou recibo)

**Descrição:** *"Registra no Financeiro uma nota fiscal ou recibo de um projeto — o título a receber. Empresa emissora e CNPJ do tomador vêm do contrato do projeto e do cadastro do cliente; não se escolhe na mão. Sem número de nota, o título nasce `pendente` (a emitir); com número, nasce `emitida` e o projeto avança para faturamento. Se havia alerta pedindo a emissão, ele é resolvido automaticamente. `origem_ref` é obrigatório: identifica o e-mail ou arquivo que originou o lançamento e impede que a mesma nota vire dois títulos."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `projeto_codigo` | string | **sim** | ex.: `2026-VIM-002` |
| `valor_bruto` | number > 0 | **sim** | — |
| `origem_ref` | string | **sim** | chave de idempotência |
| `tipo` | enum `nf` \| `recibo` | não | default = o do projeto |
| `nf_numero` | string | não | ausente ⇒ título a emitir |
| `nf_data` | date | condicional | obrigatório se houver `nf_numero` |
| `vencimento` | date | não | deixar vazio se não souber. **Não estimar** |
| `retencao` | number ≥ 0 | não | default 0 |
| `cnpj_tomador` | string | não | só para conferência; divergir do cliente é erro |
| `observacoes` | string | não | — |
| `recarga` | boolean | não | default false; `true` suprime alertas (Fase 0) |

**Retorna:** `{ criado, motivo?, titulo_id, projeto, cliente, empresa_faturadora, tipo, nf_numero, valor_bruto, retencao, valor_liquido, vencimento, status, alertas_resolvidos }`

**Regras embutidas:** empresa emissora = a do projeto — **GONZAGA E BERLIM CONSTRUÇÕES (16.841.054/0001-10) = `ag_topografia`; AG CARTOGRAFIA (48.282.440/0001-05) = `ag_cartografia`**; líquido = bruto − retenção; projeto sem cliente não fatura; nota já registrada retorna a existente sem duplicar.
**Não permite:** escolher empresa emissora diferente da do projeto; CNPJ de tomador diferente do cliente; retenção maior que o bruto; valor zero ou negativo; criar título sem `origem_ref`; duas notas com o mesmo número na mesma empresa.

#### `register_recebimento` — Registrar dinheiro que entrou

**Descrição:** *"Registra um recebimento: dinheiro que entrou na conta, do cliente X, no dia D. O recebimento pertence ao **cliente**, não a uma nota — por isso funciona mesmo quando o cliente adianta antes de a nota existir, ou paga um valor que não corresponde a título nenhum. Se você sabe a que título(s) o dinheiro se refere, informe em `alocacoes`; o que sobrar fica como **crédito do cliente** e pode ser abatido depois com `allocate_recebimento`. Se não sabe, não invente: registre sem alocação. `referencia_pagamento` é a linha do extrato ou o identificador do comprovante — é ela que impede que o mesmo crédito entre duas vezes. Título não se marca como pago: ele fica quitado sozinho quando a soma das alocações cobre o valor."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `cliente_id` | uuid | **sim** | de `list_clients`. Dinheiro sem dono não entra |
| `valor` | number > 0 | **sim** | o que caiu na conta |
| `data_recebimento` | date | **sim** | data real do crédito; futuro é recusado |
| `referencia_pagamento` | string | **sim** | linha do extrato / comprovante. **Única no sistema** |
| `empresa_recebedora` | enum `ag_topografia` \| `ag_cartografia` | **sim** | em qual PJ o dinheiro caiu |
| `alocacoes` | array de `{ titulo_id, valor }` | não | vazio ⇒ crédito puro (adiantamento) |
| `conta` | string | não | Bradesco, BB Gonzaga, BB Cartografia |
| `origem_ref` | string | não | extrato/comprovante de origem |
| `observacoes` | string | não | — |

**Retorna:** `{ criado, motivo?, recebimento_id, cliente, empresa_recebedora, valor, data_recebimento, alocado, credito_gerado, titulos[], projetos_quitados[], dica }`

**Regras embutidas:** dinheiro do cliente só abate título do próprio cliente; empresa recebedora tem que bater com a emissora do título — **GONZAGA E BERLIM CONSTRUÇÕES (16.841.054/0001-10) = `ag_topografia`; AG CARTOGRAFIA (48.282.440/0001-05) = `ag_cartografia`**; alocação nunca excede o saldo do título nem o não-alocado do recebimento; sobra vira crédito nominal, não erro; projeto vira `pago` sozinho quando nenhum título dele tem saldo.
**Não permite:** repetir a mesma `referencia_pagamento`; valor zero ou negativo (estorno é decisão humana, pela tela); data futura; alocar em título de outro cliente ou de outra PJ; alocar mais do que o saldo; editar recebimento já registrado.

#### `allocate_recebimento` — Dizer a que nota o dinheiro se refere

**Descrição:** *"Vincula dinheiro já recebido a um ou mais títulos. Use quando o cliente tinha adiantado e a nota saiu depois, ou quando você descobriu a que se referia um crédito antigo. Não altera o recebimento nem o título: cria o vínculo, e o saldo se recalcula sozinho. Um recebimento só aloca uma vez para cada título — chamar de novo devolve `ja_alocado` sem duplicar."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `recebimento_id` | uuid | **sim** | de `register_recebimento` ou da consulta de crédito |
| `alocacoes` | array de `{ titulo_id, valor }` | **sim** | pelo menos um item |
| `origem_ref` | string | não | — |

**Retorna:** `{ recebimento_id, valor_recebimento, alocado_nesta_chamada, credito_disponivel, titulos[], projetos_quitados[] }`
**Não permite:** alocar estorno; exceder saldo do título; exceder o não-alocado do recebimento; cruzar cliente ou PJ; desalocar (contra-lançamento é decisão humana); alocar em título cancelado.

#### `update_execution_status` — Atualizar status de execução do projeto

**Descrição:** *"Move o status de execução de um projeto — campo, processamento, revisão, aprovação, entrega. Informe `data_efetiva` com a data real do fato, não a de hoje: é isso que mantém o histórico correto ao registrar acontecimentos passados. Voltar para um status anterior é correção e exige motivo. `faturamento` e `pago` não entram aqui — vêm de `create_titulo` e do recebimento alocado."*

| Parâmetro | Tipo | Obrig. | Nota |
|---|---|---|---|
| `projeto_codigo` | string | **sim** | — |
| `novo_status` | enum: `aguardando_campo`, `em_campo`, `campo_concluido`, `aguardando_processamento`, `em_processamento`, `revisao`, `aprovado`, `entregue` | **sim** | `faturamento` e `pago` fora de propósito |
| `data_efetiva` | date | não | default hoje; futuro é recusado |
| `motivo` | string | condicional | obrigatório em retrocesso |
| `origem_ref` | string | não | — |
| `recarga` | boolean | não | default false |

**Retorna:** `{ sem_alteracao, projeto, nome, de, para, data_efetiva, retrocesso }`
**Não permite:** `faturamento` ou `pago`; data futura; retrocesso sem motivo; alterar responsáveis (o trigger só preenche responsável vazio, nunca reescreve); mudar outros campos do projeto.

---

## B4. Checklist de aceite (rodar antes de considerar pronto)

1. `resolve_alert` chamada duas vezes no mesmo alerta: segunda devolve `ja_resolvido: true`, sem erro.
2. `resolve_alert` num alerta `entrega_concluida` sem título: recusa com a mensagem indicando `create_titulo`.
3. `update_lead_status` para `convertido`: recusa.
4. `update_lead_status` para `perdido` sem observação: recusa.
5. `create_titulo` duas vezes com o mesmo `origem_ref`: segunda devolve `criado: false` e **não** cria linha nova.
6. `create_titulo` com `nf_numero` já usado na mesma empresa: devolve o título existente.
7. `create_titulo` com `nf_numero`: projeto vai para `faturamento` e o alerta de emissão fica resolvido.
8. `register_recebimento` duas vezes com a mesma `referencia_pagamento`: segunda devolve `criado: false` e **não** cria linha nova.
9. **Caso HORIZON WEST (parcial):** título de R$ 4.500; `register_recebimento` de R$ 1.500 alocando tudo nele → `v_titulos_receber` mostra `saldo = 3000`, `situacao = 'parcial'`, e o projeto **não** vai para `pago`.
10. **Caso AGUIA (adiantamento por excedente):** título de R$ 2.000; recebimento de R$ 16.000 alocando 2.000 → título `quitado`, `v_credito_cliente.credito_disponivel = 14000`, `credito_gerado` no retorno.
11. **Caso adiantamento puro:** `register_recebimento` sem `alocacoes` → nenhum título muda, crédito do cliente sobe, retorno traz a `dica`. Em seguida `create_titulo` para esse cliente: o retorno avisa `credito_do_cliente_disponivel`.
12. **Caso POLIMIX (irregular):** 7 recebimentos em datas e valores diferentes contra o mesmo bloco de títulos → soma bate, títulos quitam na ordem em que foram alocados, nenhum campo de saldo foi escrito.
13. `allocate_recebimento` repetindo o mesmo par (recebimento, título): `ja_alocado: true`, sem linha nova.
14. `allocate_recebimento` com valor acima do saldo do título: recusa com o saldo na mensagem.
15. `allocate_recebimento` em título de **outro cliente** ou de **outra PJ**: recusa.
16. `UPDATE` ou `DELETE` direto em `receipts` / `receipt_allocations` por usuário autenticado: **bloqueado pela RLS** (não há política — é o comportamento esperado).
17. `update_execution_status` para `entregue` com `data_efetiva` de maio: `delivered_at` fica em maio, **não** na data de hoje.
18. `update_execution_status` com `recarga: true`: **nenhum** alerta novo em `alerts` e nenhum e-mail disparado.
19. Toda chamada bem-sucedida das seis deixa uma linha em `event_log` com `actor_id` preenchido e `context.canal = 'mcp'`.
20. Usuário sem papel financeiro chamando `create_titulo` ou `register_recebimento`: erro de permissão (RLS funcionando — é o comportamento esperado).

> ## ▲ FIM DO TRECHO A COLAR

---

# APÊNDICE A — Fase 0 (recarga) em uma página

Ordem obrigatória por projeto, para não gerar fato fora de ordem:

1. `update_execution_status` com `recarga: true` e `data_efetiva` real, até o último status operacional verdadeiro (`entregue`, na maioria).
2. `create_titulo` com `origem_ref` = Message-ID do e-mail da nota, `nf_data` real, `recarga: true`.
3. `register_recebimento` com `referencia_pagamento` = linha do extrato e `data_recebimento` real — **só quando houver comprovante**. Sem comprovante, o título fica em aberto: título em aberto que já foi pago é erro menor do que baixa inventada.
4. **Alocação só quando houver certeza.** Não sabe a que nota aquele Pix se refere? Registre o recebimento **sem** `alocacoes`. Ele fica como crédito do cliente, aparece em `v_credito_cliente`, e é abatido depois com `allocate_recebimento`. Isso é exatamente o que resolve os 10 casos de *"conferir abatimento"* do relatório de 03/08: o dinheiro entra no sistema mesmo antes de se saber seu destino, em vez de ficar fora dele.

Ordem prática dentro do passo 3–4: recebimento primeiro, alocação depois. Nunca o contrário — não existe alocação sem dinheiro.

Regra que vale acima de todas: **não inventar valor, data ou número.** Não conseguiu ler? Deixa em aberto e pergunta. (Fundamentos AG.)

# APÊNDICE B — Correção do trigger quebrado de medições (aplicar SEPARADO)

Achado A8. `on_measurement_awaiting_nf` consulta `public.obras` (não existe) e `NEW.obra_id` (não existe): qualquer medição movida para `aguardando_nf` quebra em runtime. Também carrega vocabulário proibido. **Não aplicar junto com a migration principal** — é outro assunto, merece PR próprio.

```sql
create or replace function public.on_measurement_awaiting_nf()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_projeto text;
begin
  if NEW.status = 'aguardando_nf' and (OLD.status is null or OLD.status <> 'aguardando_nf') then
    select p.name into v_projeto from public.projects p where p.id = NEW.project_id;

    insert into public.calendar_events (module, title, description, event_date, related_id, related_type)
    values (
      'medicoes',
      'Emitir NF — ' || coalesce(v_projeto,'') || ' ' || NEW.period_start || ' a ' || NEW.period_end,
      'Código BM: ' || NEW.codigo_bm,
      current_date, NEW.id, 'measurement'
    );
  end if;
  return NEW;
end;
$$;
```

# APÊNDICE C — Dívidas registradas por este ADR

| # | Dívida | Onda |
|---|---|---|
| D1 | `projects.nf_data`, `project_services.nf_number/nf_date` são espelhos de `invoices`. Devem virar view ou sumir quando a UI for ajustada | pós-Onda 2 |
| D2 | `measurements` tem ciclo de status próprio (`aguardando_nf`, `nf_emitida`, `pago`) paralelo a `invoices.status` — dois relógios para o mesmo fato | Onda 3 |
| D3 | `alerts.resolved_by` e `alerts.assigned_to` com FK para `employees`. Depreciados; remover quando nenhuma tela usar | pós-Onda 2 |
| D4 | Rótulo de enum `ag_topografia` não corresponde à razão social (GONZAGA E BERLIM) | quando houver janela para renomear enum |
| D5 | `projects.tipo_documento` (`nota_fiscal`) vs. enum `tipo_documento` (`nf`) — dois vocabulários, um conceito | `_GLOSSARIO` |
| D6 | Glossário: "título a receber" = linha em `invoices`; "recebimento" = linha em `receipts`; "adiantamento/crédito do cliente" = recebimento não alocado. Nome da tabela e nome do negócio não batem | `_GLOSSARIO` |
| D7 | `invoices.status = 'paga'` em linhas legadas, sem recebimento correspondente. A verdade passa a ser `v_titulos_receber.situacao`. Regularizar exige comprovante real — trabalho da Fase 0 do Financeiro, não de migration | Fase 0 |
| D8 | A UI de Faturamento ainda lê "pago" do título. Precisa passar a ler `v_titulos_receber` e ganhar tela de recebimento + crédito do cliente | pós-Onda 2 |
