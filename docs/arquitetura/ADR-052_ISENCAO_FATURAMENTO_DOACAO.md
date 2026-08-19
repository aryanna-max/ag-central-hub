# ADR-052 — Projeto sem contrapartida financeira (doação / cortesia)

- **Status:** **Aprovado** — Aryanna, 19/08/2026. Aprovou a decisão central: doação vira
  `billing_type = 'sem_faturamento'`, marcada só por diretoria e com motivo obrigatório.
  As duas questões abertas do §9 (se a isenção baixa o alerta sozinha; comportamento de
  `fixo_mensal`) seguem pendentes e **não bloqueiam** a implementação.
- **Data:** 2026-08-19
- **Autor:** Arquiteto (Cowork)
- **Destino no repo:** `docs/arquitetura/ADR-052_ISENCAO_FATURAMENTO_DOACAO.md`
- **Migration:** `supabase/migrations/20260819120000_adr052_isencao_faturamento.sql`
- **Supersede/altera:** ADR-042 §B2 (Decisão #62 — "alerta de emissão exige o documento"). Não revoga; qualifica.
- **Pré-requisito de leitura:** `docs/arquitetura/INVENTARIO_DERIVA_SCHEMA.md`

---

## 1. Contexto — o caso que forçou a decisão

Projeto `2026-HCA-001` (Henrique Camara), entregue em 30/04/2026. O trigger `fn_on_status_change`
gerou o alerta urgente `entrega_concluida` — "Emitir NF" (id `3c83c8db-d49d-431b-a439-a8865840f70d`).
Em 19/08/2026, 111 dias depois, a Aryanna confirmou: **foi doação, não gera nota.**

O sistema não tinha como registrar isso:

| Caminho tentado | Resultado |
|---|---|
| `resolve_alert` | Recusado. `fn_resolve_alert` exige um título em `invoices` para qualquer alerta `entrega_concluida`. |
| `create_titulo` com `valor_bruto = 0` | Recusado duas vezes: Zod `z.number().positive()` no MCP e `raise exception 'valor_bruto deve ser maior que zero.'` em `fn_create_titulo`. |
| `update_project` para outro `billing_type` | Nenhum dos três valores aceitos (`entrega_nf`, `medicao_mensal`, `entrega_recibo`) descreve doação. |

O alerta ficou **impossível de fechar por qualquer caminho existente**.

### O diagnóstico, que é maior que o caso

Não é um bug de validação. É uma **lacuna de vocabulário** que virou beco sem saída porque
uma regra bloqueante nomeou uma única saída e essa saída não se aplicava.

Duas descobertas do mapeamento que sustentam isso:

1. **O trigger já conhece o conceito; o caminho de escrita não.** `fn_on_status_change` tem a
   linha `when 'sem_documento' then null` — ou seja, o gerador de alertas já prevê um projeto que
   não gera documento. Mas `fn_update_project` recusa `sem_documento`, e nenhuma ferramenta MCP
   consegue gravar esse valor. **Existe um estado alcançável pela leitura e inalcançável pela escrita.**
2. **`billing_type` é `text` puro em produção — sem enum, sem CHECK.** O domínio só existe em
   `src/lib/statusConstants.ts` e em dois `CASE` de plpgsql, que discordam entre si. Projeto com
   `billing_type` nulo cai no `else 'Verificar documento'` do trigger e produz o mesmo beco sem saída
   deste caso, por outro caminho.

### Regra de projeto que este ADR institui

> **Regra da saída nomeada.** Toda regra que bloqueia uma ação tem de nomear pelo menos uma saída
> alcançável pelo ator que recebeu o bloqueio. Regra bloqueante sem saída não é controle — é dívida
> que vence em alerta velho.

- **Referência:** Gawande, *Checklist Manifesto* — um item de checklist que não pode ser marcado
  ensina a equipe a ignorar o checklist. O custo do beco sem saída não é o alerta parado; é a
  erosão da confiança em todos os alertas.
- **Anti-referência:** o `force: true` / `motivo_override` genérico. Uma válvula de escape universal
  transforma toda política em sugestão. A saída tem que ser **específica e nomeada**, não um bypass.

---

## 2. Gate Engine vs. CRUD

Pergunta obrigatória antes de implementar: **existe semântica de negócio?**

Sim, e em duas camadas distintas — que exigem tratamentos diferentes. É aqui que a resposta
"é só mais um `billing_type`" está pela metade.

### Camada 1 — o valor: é `billing_type`, não uma flag nova

`billing_type` responde uma pergunta só: **"como este projeto vira dinheiro?"**
Doação responde exatamente essa pergunta: *não vira*. É um valor da dimensão existente.

Uma flag booleana `is_doacao` ao lado de `billing_type` produziria o produto cartesiano
`is_doacao = true AND billing_type = 'entrega_nf'` — um estado sem significado que o banco
aceitaria de bom grado. Quando o produto cartesiano de dois campos contém estados impossíveis,
não são dois campos: é um.

- **Síntese:** doação é um jeito de faturar (o jeito "não fatura"), não um adjetivo colado a outro jeito.
- **Referência:** Evans, *Ubiquitous Language* / Bounded Context — uma palavra, um significado, um campo.
  Reforçado por "make illegal states unrepresentable" (Yaron Minsky).
- **Anti-referência:** o flag ortogonal (`is_doacao`, `isento`, `nao_fatura`) que multiplica os
  estados possíveis sem multiplicar os estados válidos.

**Decisão 1:** novo valor `sem_faturamento` em `projects.billing_type`. Nenhuma coluna de estado nova,
nenhum booleano.

### Camada 2 — o ato: é Engine, não CRUD

Gravar `billing_type = 'sem_faturamento'` **não é editar um campo.** É renunciar a receita.
O ato tem autor, tem justificativa, tem quem pode e quem não pode, e tem pré-condição
(não se doa o que já foi faturado). Isso é política, e política mora em função SQL nomeada.

Por isso este valor **não entra em `fn_update_project`**. `fn_update_project` é um atualizador de
campos com semântica "null = não mexe", aberto a `comercial`, sem motivo obrigatório para
`billing_type`. Passar a isenção por ele seria transformar uma decisão de diretoria em um `PATCH`.

- **Síntese:** o agente diz *"isente este projeto, pelo motivo X"* — não *"escreva esta string neste campo"*.
- **Referência:** Tell, Don't Ask. E Policy as Code — a política é uma função nomeada, não um `if` espalhado.
- **Anti-referência:** adicionar `'sem_faturamento'` à lista de valores aceitos de `fn_update_project`.
  É a mudança de uma linha, funciona hoje, e joga fora autor, motivo e pré-condição para sempre.

**Decisão 2:** engine dedicado `fn_isentar_faturamento_projeto(p_projeto_codigo, p_motivo, p_origem_ref)`.
`fn_update_project` recusa `sem_faturamento` e aponta a ferramenta certa.

### Camada 3 — a decisão "gera alerta?" sai de dentro do trigger

Hoje a decisão está num `CASE` inline dentro de `fn_on_status_change` (produtor) e é
**re-implementada por omissão** dentro de `fn_resolve_alert` (consumidor), que assume que todo
`entrega_concluida` exige documento. Duas cópias da mesma regra, já divergentes — é essa divergência
que produziu o beco sem saída.

**Decisão 3:** extrair para `fn_politica_documento_entrega(p_billing_type text) returns text`,
chamada pelos dois lados. Produtor e consumidor passam a não poder discordar.

- **Síntese:** quem cria o alerta e quem baixa o alerta consultam a mesma função.
- **Referência:** Single Source of Truth aplicado a regra, não só a dado.
- **Anti-referência:** manter o `CASE` no trigger e adicionar um `if billing_type = 'sem_faturamento'`
  no `fn_resolve_alert`. Funciona, e garante que na próxima mudança de domínio um dos dois vai ficar para trás.

---

## 3. A DECISÃO REJEITADA — e por que ela é a mais perigosa

**Rejeitado: relaxar `valor_bruto > 0` para permitir título de R$ 0,00 como forma de fechar o alerta.**

É o conserto de cinco minutos. Está errado por quatro motivos independentes:

1. **Grava documento fiscal que não existe.** `invoices` é o livro do que foi emitido. Uma linha lá
   afirma que houve NF ou recibo. Na doação, não houve.
2. **Corrompe `v_titulos_receber`.** Um título de valor 0 tem `saldo = 0`, logo `situacao = 'quitado'`
   na primeira leitura — aparece como recebido dinheiro que nunca entrou.
3. **Contamina receita para sempre.** Contagem de títulos emitidos, faturamento por empresa e
   conciliação passam a ter linhas fantasmas que ninguém consegue distinguir das reais depois.
4. **Perde a informação que importa.** "Doamos R$ X em 2026" é um número que a diretoria vai querer.
   Título zerado destrói justamente esse dado.

- **Anti-referência declarada:** o registro-fantasma para satisfazer uma validação — primo do
  cliente "DIVERSOS" e do CPF `000.000.000-00`. O sistema aceita, o relatório mente.
- **Referência:** Scott, *Seeing Like a State* — quando o formulário não tem a caixa certa, as pessoas
  preenchem a caixa errada, e o mapa oficial deixa de descrever o território. A correção é criar a caixa.

**Também rejeitado:** tabela separada `project_exemptions`. Dividiria a fonte canônica da política de
faturamento de um projeto entre `projects.billing_type` e uma tabela irmã. O histórico já tem casa
canônica — `event_log`.

---

## 4. Especificação

### 4.1 Domínio de `billing_type`

`projects.billing_type` permanece `text` (não vira enum PG). Justificativa da assimetria com
`execution_status` e `project_status`, que **são** enums: aqueles têm **ordem** significativa e o código
depende dela (`array_position(enum_range(...))` detecta retrocesso de status em `fn_update_execution_status`).
`billing_type` não tem ordem. Enum PG aqui só traria custo: `ALTER TYPE ... ADD VALUE` não roda em
transação junto com outro DDL e valor de enum não se remove. `CHECK` é reversível e suficiente.

Domínio, com `CHECK ... NOT VALID` (novas escritas obrigadas; linhas legadas preservadas):

| Valor | Significado | Gera alerta na entrega? |
|---|---|---|
| `entrega_nf` | entrega gera Nota Fiscal | sim — "Emitir NF" |
| `entrega_recibo` | entrega gera Recibo | sim — "Emitir Recibo" |
| `medicao_mensal` | documento nasce da medição, não da entrega | não |
| **`sem_faturamento`** | **doação / cortesia — sem contrapartida financeira** | **não** |
| `fixo_mensal` | recorrente (agrupado com `medicao_mensal` no frontend) | não |
| `sem_documento` | **LEGADO** — ambíguo, reclassificar | não |
| `misto` | **LEGADO** — ambíguo | sim — "Verificar documento" |
| `NULL` / desconhecido | não classificado | sim — "Verificar documento" |

`sem_documento` **não é reaproveitado** para doação: ele diz "não sai papel", que é diferente de
"não entra dinheiro". Um `medicao_mensal` também não emite papel na entrega. Conflar os dois
devolveria a ambiguidade em um mês. Fica marcado como legado, com nota para reclassificação
pelo Financeiro. Não é migrado automaticamente — presumir a semântica de linha existente
é decisão de negócio, não de arquitetura.

### 4.2 Colunas novas em `projects`

```
isencao_motivo          text          -- por quê
isencao_autorizada_por  uuid          -- FK profiles(id) — quem autorizou
isencao_autorizada_em   timestamptz   -- quando
```

Estado corrente da decisão. O **histórico** continua em `event_log` — não se duplica histórico
em coluna. As três colunas existem para uma coisa que `event_log` não faz: sustentar a constraint.

```sql
constraint ck_projects_isencao_coerente check (
  (coalesce(billing_type,'') = 'sem_faturamento')
  =
  (coalesce(length(btrim(isencao_motivo)),0) >= 10
   and isencao_autorizada_por is not null
   and isencao_autorizada_em  is not null)
)
```

Bicondicional, de propósito. Nos dois sentidos:

- `sem_faturamento` **sem** motivo e autorizador → o banco recusa. **Não existe doação anônima no Átina.**
- motivo preenchido com `billing_type` diferente → o banco recusa. Reverter a isenção **obriga** a limpar os campos.

Esta constraint entra **validada** (não `NOT VALID`): o valor `sem_faturamento` é novo, nenhuma
linha existente pode violá-la.

- **Síntese:** a integridade da doação é responsabilidade do banco, não da boa vontade de quem chama.
- **Referência:** "make illegal states unrepresentable". A regra vale para o `psql` da Aryanna também,
  não só para o MCP.
- **Anti-referência:** validar só na função e deixar a tabela permissiva — o padrão que produz
  linha órfã sempre que alguém escreve por outro caminho.

### 4.3 `fn_politica_documento_entrega(p_billing_type text) returns text`

`language sql`, `immutable`, `set search_path to 'public'`. Retorna:

| Retorno | Trigger faz | `resolve_alert` faz |
|---|---|---|
| `'nf'` | cria alerta "Emitir NF" | **exige título** (comportamento atual preservado) |
| `'recibo'` | cria alerta "Emitir Recibo" | **exige título** |
| `'nenhum'` | não cria alerta | **libera baixa manual** com `resolucao` |
| `'indefinido'` | cria alerta "Verificar documento" | **recusa, apontando `update_project`** |

Retorna a classificação, não um booleano, porque a pergunta tem quatro respostas de negócio, não duas.
O rótulo em português ("Emitir NF") fica no trigger — é apresentação, não política.

O caso `'indefinido'` é o segundo beco sem saída, fechado de brinde: projeto com `billing_type` nulo
gerava alerta que também não podia ser baixado. Agora recebe erro **com saída nomeada**
("defina o `billing_type` com `update_project`"), não um bloqueio cego.

### 4.4 `fn_isentar_faturamento_projeto` — o engine

Assinatura: `(p_projeto_codigo text, p_motivo text, p_origem_ref text default null) returns jsonb`.
Segue o estilo da casa: `SECURITY INVOKER`, `set search_path to 'public'`, guard clauses no topo,
`raise exception` em português dizendo o que fazer, `log_event` antes do `return`, idempotência
devolve objeto em vez de erro.

**Trilha de auditoria (resposta ao item 4 do pedido):**

| Exigência | Como é cumprida |
|---|---|
| Só diretoria marca | `has_any_role(auth.uid(), array['master','diretor'])`. **`financeiro` fica de fora.** |
| Motivo obrigatório | `p_motivo` com ≥ 10 caracteres úteis, no engine **e** na constraint da tabela. |
| Quem autorizou | `isencao_autorizada_por = auth.uid()`, FK para `profiles`. |
| Quando | `isencao_autorizada_em = now()`. |
| Histórico | `log_event('project.faturamento_isentado', ...)` com `billing_type` anterior, motivo, cliente, data de entrega e **`valor_renunciado` = `contract_value` no momento da isenção**. |
| Procedência | `context = {"canal":"mcp","ferramenta":"isentar_faturamento","origem_ref":...}`. |

**Por que `financeiro` não pode.** Renunciar receita é decisão de sócio, não operação de contabilidade.
Alcione registra o que aconteceu; ela não decide deixar de cobrar. `master` + `diretor` mapeia exatamente
para Aryanna, Sérgio e Ciro.

- **Síntese:** quem assina a renúncia é quem é dono do dinheiro renunciado.
- **Referência:** Sowell / Hayek sobre conhecimento disperso — o motivo da doação existe só na cabeça
  da diretoria no instante da decisão. O trabalho do sistema é capturá-lo naquele instante, não
  tentar reconstruí-lo 111 dias depois. É por isso que o motivo é obrigatório e não opcional.
- **Anti-referência:** herdar o gate de `fn_update_project` (`master, diretor, comercial, financeiro`)
  por preguiça de escrever um novo. Comercial poderia doar o próprio fechamento.

**Guarda dura:** projeto com título não cancelado em `invoices` → recusa.
Doação não convive com documento fiscal emitido. A mensagem manda cancelar o título primeiro.

**`valor_renunciado`:** capturar `contract_value` no evento é o que torna respondível a pergunta
"quanto a AG doou em 2026". Sem isso a isenção é write-only. A view `v_projetos_isentos`
(no fim da migration) entrega essa leitura pronta.

### 4.5 Reversão — `fn_reverter_isencao_faturamento`

Mesmo gate (`master`/`diretor`), motivo obrigatório, exige o novo `billing_type`, limpa as três
colunas e loga `project.isencao_revertida`. Sem ela um clique errado seria permanente e a
constraint bicondicional deixaria o projeto travado.

**Não é exposta como ferramenta MCP nesta onda.** Reversão é rara e cara; fica na UI/SQL Editor
sob a Aryanna. Menos superfície, menos regra para manter.

### 4.6 Alterações em funções existentes

| Função | Mudança | Risco |
|---|---|---|
| `fn_on_status_change` | o `CASE` inline passa a chamar `fn_politica_documento_entrega`. Comportamento **idêntico** para os valores atuais. | `create or replace` — **exige diff contra produção antes** (ver §7). |
| `fn_resolve_alert` | consulta a política do projeto do alerta em vez de sempre exigir título. Mensagem de erro ganha a saída nomeada. | idem. |
| `fn_update_project` | recusar `sem_faturamento` e recusar sair de `sem_faturamento`, apontando as ferramentas certas. | **fora desta migration** — edição cirúrgica, ver §7. |

Sobre deixar `fn_update_project` para depois: a `ck_projects_isencao_coerente` **já protege o banco**.
Se alguém tentar mover um projeto isento para `entrega_nf` por `fn_update_project`, a transação
falha na constraint. Falha fechada, com mensagem feia. A emenda em `fn_update_project` melhora a
mensagem — não é requisito de segurança. Por isso pode ser um passo separado, com dump de produção
antes, em vez de eu reconstruir 200 linhas de função a partir de fragmentos.

- **Síntese:** não se reescreve por `create or replace` uma função cujo corpo em produção você não leu.
- **Referência:** heurística pessoal, derivada do `INVENTARIO_DERIVA_SCHEMA.md` deste projeto — recriar
  o banco a partir de `supabase/migrations/` produz um banco diferente do que está no ar.
- **Anti-referência:** colar no arquivo a versão do repo e confiar. Apaga em silêncio tudo que foi
  aplicado direto no banco pelo Lovable.

---

## 5. O que acontece com o alerta `entrega_concluida` (resposta ao item 3)

**As duas coisas, e é isso que fecha o problema pelos dois lados.**

### Daqui para a frente: não nasce

Projeto marcado `sem_faturamento` **antes** de chegar em `entregue`:
`fn_politica_documento_entrega('sem_faturamento')` → `'nenhum'` → `v_doc_label` nulo →
o trigger não insere alerta. O alerta que não deveria existir não existe.

### Para o passado: nasce e passa a poder ser baixado

Projeto entregue **antes** da classificação (o caso HCA-001): o alerta já existe.
Depois da isenção, `fn_resolve_alert` consulta a mesma função, recebe `'nenhum'` e libera a baixa
manual — que continua exigindo `resolucao` com no mínimo 5 caracteres.

### O que explicitamente NÃO acontece: a isenção não baixa o alerta

`fn_isentar_faturamento_projeto` **não toca em `alerts`.** Ela devolve
`alertas_pendentes` e `proximo_passo` dizendo para chamar `resolve_alert`.

Contraste deliberado com `fn_create_titulo`, que **resolve o alerta sozinho**. Não é incoerência:

- Criar o título é o **cumprimento** exato do que o alerta pediu. A condição do alerta foi
  objetivamente satisfeita. O sistema pode concluir isso sozinho.
- Isentar é a **decisão de não fazer** o que o alerta pediu. Ninguém emitiu nada. Quem fecha o
  item do checklist é uma pessoa, escrevendo por quê.

Se a isenção baixasse o alerta em cascata, `isentar_faturamento` viraria um matador silencioso de
alertas — exatamente o que a Decisão #62 do ADR-042 foi construída para impedir. Dois atos,
dois registros em `event_log`, história completa.

- **Síntese:** o alerta morre por um ato nomeado, nunca como efeito colateral.
- **Referência:** Event-Driven / CQRS (Greg Young) — o log de eventos tem que contar o que aconteceu
  e por quê, não só o estado final.
- **Anti-referência:** o `DELETE FROM alerts WHERE ...` na migration para "limpar o passivo".
  Apaga a única evidência de que a entrega aconteceu e de que alguém precisou decidir sobre ela.

---

## 6. Fechamento do caso 2026-HCA-001 (resposta ao item 5)

Depois da migration aplicada. **Aryanna executa — ela é `master`.** Dois passos, nesta ordem.

**Passo 1 — registrar a isenção**

Ferramenta MCP `isentar_faturamento`:

```
projeto_codigo : 2026-HCA-001
motivo         : Serviço prestado como doação/cortesia a Henrique Camara, sem contrapartida
                 financeira. Autorizado pela diretoria em 19/08/2026.
origem_ref     : ADR-052 / decisão da diretoria 2026-08-19
```

O engine confere que não há título (é verdade — foi a origem do impasse), grava
`billing_type = 'sem_faturamento'`, o motivo, a autoria e a data, e registra
`project.faturamento_isentado` no `event_log` com o `contract_value` renunciado.

Retorno esperado: `isentado: true`, `alertas_pendentes: 1`, e o `proximo_passo`.

**Passo 2 — baixar o alerta**

Ferramenta MCP `resolve_alert`:

```
alerta_id  : 3c83c8db-d49d-431b-a439-a8865840f70d
resolucao  : Projeto isento de faturamento (doação, autorizado pela diretoria em 19/08/2026,
             ADR-052). Não há NF a emitir.
origem_ref : ADR-052
```

`fn_resolve_alert` lê o projeto do alerta, chama `fn_politica_documento_entrega('sem_faturamento')`,
recebe `'nenhum'`, pula a exigência de título e baixa. Alerta destinado a `financeiro`; `master` passa no gate.

**Resultado.** Duas linhas em `event_log` — `project.faturamento_isentado` e `alert.resolved` —
que juntas contam a história inteira: o que foi decidido, por quem, quando, por quê, e como o alerta
de 111 dias terminou. Nenhuma linha em `invoices`. Nenhum dado fiscal inventado.

**Não fazer:** `UPDATE alerts SET resolved = true` no SQL Editor. Pula o `log_event`, deixa
`resolved_by_profile_id` nulo e destrói exatamente a auditoria que este ADR existe para produzir.

---

## 7. Ordem de aplicação e riscos

Cadeia de canais: **Arquiteto (Cowork) prepara → Claude Code commita → Lovable/Supabase aplica.**
Eu não commito, não dou push e não rodo SQL em produção.

**Passo 0 — obrigatório, antes de tudo (deriva de schema).**
A migration faz `create or replace` em `fn_on_status_change` e `fn_resolve_alert`. Os corpos em
produção podem divergir do repo. No SQL Editor do Supabase, **em modo leitura**:

```sql
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fn_on_status_change','fn_resolve_alert','fn_update_project');
```

Diff contra as seções 2 e 3 da migration. **Se divergir, a migration é corrigida antes de aplicar**,
não depois. `fn_update_project` entra no dump porque é a base da emenda do Passo 3.

**Passo 1 — Claude Code:** commitar este ADR e a migration no repo. Sem aplicar.

**Passo 2 — aplicar a migration** (Lovable/Supabase). Ordem interna já é segura: colunas e constraints
antes das funções.

**Passo 3 — emenda cirúrgica em `fn_update_project`**, a partir do corpo real dumpado no Passo 0.
Inserir logo após a validação de `billing_type` existente:

```sql
  if p_billing_type = 'sem_faturamento' then
    raise exception 'Isenção de faturamento não se define por update_project. Use isentar_faturamento — ela exige motivo e autorização da diretoria.';
  end if;

  if coalesce(v_proj.billing_type,'') = 'sem_faturamento'
     and p_billing_type is not null
     and p_billing_type <> 'sem_faturamento' then
    raise exception 'Projeto % está isento de faturamento por decisão registrada. Reverta com fn_reverter_isencao_faturamento antes de mudar o billing_type.', v_proj.codigo;
  end if;
```

**Passo 4 — ferramenta MCP `isentar_faturamento`.** Criar `src/lib/mcp/tools/isentar-faturamento.ts`
e registrar no array `tools` de `src/lib/mcp/index.ts`.
**Não editar `supabase/functions/mcp/index.ts` à mão** — é auto-gerado pelo plugin Vite
(`@lovable.dev/mcp-js`) e a edição manual é sobrescrita. O arquivo é regerado pelo build.

**Passo 5 — fechar o HCA-001** conforme §6.

### Riscos

| Risco | Mitigação |
|---|---|
| Corpo em produção divergente do repo → `create or replace` apaga lógica viva | Passo 0 obrigatório. Bloqueante. |
| `ck_projects_billing_type` falhar na criação por linha legada com valor fora do domínio | Entra `NOT VALID`. Só vale para escrita nova. `VALIDATE CONSTRAINT` fica para depois da reclassificação, em outro ADR. |
| Projetos legados com `sem_documento` / `misto` mal classificados | Não são migrados automaticamente. Ficam para conferência do Financeiro. Reclassificar é decisão de negócio. |
| Agente sem papel de diretoria tentar isentar | Recusa com mensagem explícita. Comportamento correto, não bug — mesma posição do ADR-042 §7. |
| `event_log` hoje é legível e gravável por qualquer autenticado (regressão de RLS registrada no inventário de deriva) | **Não é resolvido aqui.** Fica registrado como pendência para ADR próprio. Afeta a confiabilidade da trilha desta e de todas as decisões. |

---

## 8. Consequências

**Ganhos**

- O beco sem saída deixa de existir, pelos dois lados (não nasce / pode ser baixado).
- O segundo beco (projeto com `billing_type` nulo) fecha junto.
- Doação vira dado consultável: `v_projetos_isentos` responde "quanto a AG doou, para quem, autorizado por quem".
- Produtor e consumidor do alerta passam a consultar a mesma função — não podem mais divergir.
- `billing_type` ganha domínio no banco, não só no frontend.

**Custos aceitos**

- Mais uma ferramenta MCP para manter (`isentar_faturamento` — entra na Onda 2, junto de `create_titulo`).
- Duas funções SQL novas + duas alteradas.
- `projects.tipo_documento` continua redundante com `billing_type` (`entrega_nf` implica `nota_fiscal`).
  **Deliberadamente não tocado aqui:** consolidar duas fontes canônicas do mesmo conceito é decisão
  arquitetural própria, e o trigger `validate_project_empresa_tipo` que valida esse campo **não tem
  corpo versionado no repo**. Fica nomeado como dívida, não empilhado neste ADR.

**Pendências nomeadas (ADRs futuros)**

1. `projects.tipo_documento` × `billing_type` — consolidar a fonte canônica.
2. Reclassificar os legados `sem_documento` / `misto` e então `VALIDATE CONSTRAINT`.
3. `billing_type` nulo na criação é a causa-raiz do alerta "Verificar documento".
   Avaliar tornar obrigatório em `fn_create_project`.
4. RLS de `event_log` — hoje qualquer autenticado lê e escreve a trilha de auditoria.

---

## 9. Decisões que precisam da Aryanna

Uma pergunta binária de cada vez, na ordem:

1. **Doação passa a ser `billing_type = 'sem_faturamento'`, marcada só por diretoria e com motivo obrigatório. Aprova?**
2. **A isenção não baixa o alerta sozinha — exige um `resolve_alert` explícito depois. Aprova?**
3. **`fixo_mensal` se comporta como `medicao_mensal` (não gera alerta na entrega). Confirma?**
   *(herdado de `RECURRING_BILLING_TYPES` no frontend — está na migration com esse comportamento)*
