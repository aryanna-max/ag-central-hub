# Inventário de deriva de schema — ADR-050 B2

**Data:** 13/08/2026
**Método:** comparação entre o schema **real** do banco (`bphgtvwgsgaqaxmkrtqj`, lido ao vivo via `pg_catalog`/`pg_policies`/`supabase_migrations.schema_migrations` em 13/08/2026) e a **soma das migrations** em `supabase/migrations/` no `origin/main`.
**Escopo:** este documento **mede**. Não altera schema, não corrige deriva, não aplica nada. Cada correção vira decisão própria em fase posterior da ADR-050.

> **Tese da ADR-050 B2, confirmada:** recriar o banco a partir de `supabase/migrations/` produz um banco **diferente** do que está no ar. Abaixo, a lista nomeada do que está fora de controle.

---

## Resumo executivo

| Categoria | Quantidade | Gravidade |
|---|---|---|
| Enums em produção que **nenhuma** migration do repo cria | **9** | 🔴 recriar o schema falha (tipos inexistentes) |
| Enums que o repo cria mas **não existem** em produção | 4 | 🟡 migrations mortas / nunca aplicadas |
| Enums com **valores divergentes** entre repo e produção | ≥5 | 🟡 recriação produz enum incompleto |
| Migrations no repo **ausentes** do histórico aplicado | ≥5 (recentes) | 🔴 sem rastro de aplicação confiável |
| Colisão de timestamp | 1 par | 🟠 ordem de aplicação indefinida |
| `ALTER TYPE app_role ADD VALUE 'rh'` repetido | 3 migrations | 🟡 sintoma do mesmo descontrole |

**Números de base:** 98 arquivos `.sql` em `supabase/migrations/`; 28 enums em `public` no banco; ~72 versões registradas em `supabase_migrations.schema_migrations`. Esses três conjuntos não fecham entre si.

---

## 1. Objetos em produção que nenhuma migration cria

Recriar o schema a partir do repo **falha** ou produz um banco diferente, porque estes objetos existem no banco e nenhum `CREATE` no repo os produz.

### 1.1 `empresa_faturadora_enum` — o caso emblemático

- **No banco:** enum `public.empresa_faturadora_enum` = `{ag_topografia, ag_cartografia}`.
- **No repo:** o tipo é **usado** em pelo menos 3 migrations —
  `20260811143000_5458ee17` (colunas e funções), `20260811162220_64b02cf5`, e
  `20260812120000_764e2efa` (ADR-044, `faturadora_enum public.empresa_faturadora_enum`) —
  mas **nenhum `CREATE TYPE ... empresa_faturadora_enum`** existe em todo `supabase/`.
- **De onde veio:** criado direto no banco pelo Lovable, fora de qualquer migration versionada. As migrations que o *referenciam* só funcionam porque o tipo já existia no banco.
- **Risco de recriar sem ele:** `db reset`/recriação **quebra** — a primeira migration que referencia `public.empresa_faturadora_enum` aborta com "type does not exist".

### 1.2 Outros 8 enums em produção sem `CREATE TYPE` no repo

Confirmado por varredura `CREATE TYPE public.<nome>` em `origin/main -- supabase/migrations` (retorno vazio para todos):

| Enum (produção) | Valores no banco |
|---|---|
| `billing_mode` | `{fixo_mensal, diarias, esporadico}` |
| `contact_type` | `{cliente, financeiro, engenheiro, outro}` |
| `execution_status` | `{aguardando_campo, em_campo, campo_concluido, aguardando_processamento, em_processamento, revisao, aprovado, entregue, faturamento, pago}` |
| `measurement_status` | `{rascunho, aguardando_aprovacao, aprovada, nf_emitida, paga, cancelada}` |
| `proposal_status` | `{rascunho, enviada, aprovada, rejeitada, expirada}` |
| `removal_reason` | `{campo_concluido, pausa_temporaria, reagendado, clima, equipamento, falta_equipe}` |
| `service_status` | `{planejamento, execucao, medicao, faturamento, concluido, cancelado}` |
| `tipo_documento` | `{nf, recibo}` |

- **De onde vieram:** criados no banco pelo Lovable sem migration correspondente no repo. Vários são enums **centrais** (`execution_status`, `proposal_status`), o que mostra que o repo nunca foi a fonte de verdade do schema completo.
- **Risco de recriar sem eles:** recriação quebra em cascata — colunas e funções que referenciam esses tipos não sobem.

### 1.3 Políticas RLS de `companies`

- **No banco:** `companies_select` (SELECT, `authenticated`, `using true`) e `companies_write` (ALL, restrito a `master/diretor/rh`).
- **No repo:** **agora existem** — foram adicionadas por `20260813025426_e4ee81c1` (autoria do agente do Lovable, 13/08). No momento em que a ADR-044 (`20260812120000_764e2efa`) criou a tabela `companies`, ela **não** trouxe RLS/policy nenhuma; as políticas entraram depois, por fora, e só voltaram ao repo hoje.
- **Observação:** é o mesmo padrão de deriva, resolvido tarde. Serve de exemplo vivo: objeto nasceu no banco e o repo só o capturou dias depois, por commit de agente.

---

## 2. Enums que o repo cria mas produção não tem

`CREATE TYPE` presente no repo, enum **ausente** do banco (`pg_type`):

| Enum (repo) | Situação |
|---|---|
| `opportunity_stage` | criado no repo, inexistente em prod |
| `aviso_previo_type` | criado no repo, inexistente em prod |
| `termination_type` | criado no repo, inexistente em prod |
| `monthly_report_status` | criado no repo, inexistente em prod |

- **Interpretação:** essas migrations **nunca foram aplicadas** ao banco atual (ou os tipos foram removidos depois, sem o repo registrar o `DROP`). São "migrations mortas" do ponto de vista do banco real.
- **Risco:** dão falsa impressão de que o schema do repo é mais rico do que o banco; qualquer código que dependa desses tipos assumindo que existem vai falhar em produção.

---

## 3. Enums com valores divergentes (repo × produção)

O `CREATE TYPE` do repo define um conjunto de valores; produção tem outro (ampliado por `ALTER TYPE ... ADD VALUE` fora do repo, ou direto no banco):

| Enum | `CREATE TYPE` no repo | Em produção (a mais) |
|---|---|---|
| `app_role` | `master, diretor, operacional, sala_tecnica, comercial, financeiro` | **+ `rh`** |
| `project_status` | `planejamento, execucao, entrega, faturamento, concluido` | **+ `pausado`** |
| `lead_status` | `novo, em_contato, qualificado, convertido, descartado` | **+ `proposta_enviada, aprovado, perdido, em_negociacao`** |
| `lead_source` | `whatsapp, telefone, email, site, indicacao, outros` | **+ `rede_social, licitacao, site_instagram, cliente_recorrente, contrato_ativo, outro`** |
| `alert_recipient` | dois `CREATE` conflitantes: `{alcione, marcelo, diretoria, todos}` (velho) e `{operacional, comercial, financeiro, rh, sala_tecnica, diretoria, todos}` (novo) | banco tem só o **novo** |

- **Risco de recriar:** dependendo de qual `CREATE` prevalece na recriação, o enum sai **incompleto** e inserts com o valor faltante quebram (ex.: um `pausado` de projeto, um lead `em_negociacao`).

---

## 4. Migrations no repo ausentes do histórico aplicado

`supabase_migrations.schema_migrations` é o histórico que o banco reconhece. Vários arquivos recentes do repo **não constam** lá com o mesmo timestamp — o Lovable aplica sob **timestamps-espelho** próprios (documentado no cabeçalho de `.github/workflows/apply-supabase-migrations.yml`).

| Arquivo no repo (`version`) | Consta no histórico aplicado? |
|---|---|
| `20260714172013_c203f372` | ❌ — aplicado como `20260714172015` (espelho, +2s) |
| `20260811143000_5458ee17` (engine ADR-042, ~800 linhas) | ❌ ausente com esse timestamp |
| `20260811150000_e2ebdeef` | ❌ ausente (ver §5, colisão) |
| `20260811150000_ece43904` | ❌ ausente (ver §5, colisão) |
| `20260811150100_70ec944d` | ❌ ausente com esse timestamp |
| `20260812120000_764e2efa` (ADR-044, cria `companies`) | ❌ ausente com esse timestamp — mas `companies` existe em prod |

- **Consequência:** não há mapeamento confiável arquivo↔aplicação. "Esta migration foi aplicada?" não se responde pelo timestamp. `companies` prova o ponto: existe em prod, mas seu arquivo de origem não está no histórico com o próprio timestamp.
- **Recomendação:** ao adotar o baseline (Entregável 1) como marco zero, reconciliar `schema_migrations` com `supabase migration repair --status applied <version>` para cada migration já refletida no banco, ou arquivar as antigas sob um `_archive/`. Decidir em fase posterior.

---

## 5. Colisão de timestamp `20260811150000`

Dois arquivos distintos com o **mesmo** `version`:

- `supabase/migrations/20260811150000_e2ebdeef-b00a-48ce-8843-0a15fd701536.sql`
- `supabase/migrations/20260811150000_ece43904-82f1-4a7a-9734-f6f72c762ab7.sql`

- **Problema:** `supabase db push` ordena por `version`; com empate, a ordem entre os dois é **indefinida**. Se um depende do outro, a aplicação pode quebrar ou pular um (foi um dos motivos de desarmar o gatilho automático no PR #50).
- **Recomendação de reconciliação:** renomear um dos dois para um segundo distinto e explícito (ex.: `_e2ebdeef` → `20260811150001_...`), respeitando a dependência real (o `§0`/pré-requisito antes do cadastro). Como ambos provavelmente **já foram aplicados** sob timestamps-espelho, a renomeação é higiene do repo para recriação futura, não reaplicação — validar contra o histórico antes.

---

## 6. `ALTER TYPE app_role ADD VALUE 'rh'` — três vezes

O mesmo `ADD VALUE 'rh'` aparece em **três** migrations distintas:

- `20260518200654_bad6f520` — `ALTER TYPE public.app_role ADD VALUE 'rh';`
- `20260811150000_e2ebdeef` — `alter type public.app_role add value if not exists 'rh';`
- `20260811162257_c8c5d46f` — `alter type public.app_role add value if not exists 'rh';`

- **Interpretação:** sintoma do mesmo descontrole — sem uma fonte de verdade única, o mesmo passo é reescrito por autores/sessões diferentes. As duas versões com `if not exists` são idempotentes; a primeira (`20260518`) **não** é, e reexecutá-la fora de ordem quebraria.
- **Risco de recriar:** numa recriação linear, a primeira ocorrência adiciona o valor; as seguintes viram no-op (se `if not exists`) — ok. Mas indica que **o enum-base `app_role` no repo já nasce sem `rh`** (§3), e depende desses ALTERs espalhados para chegar ao estado de produção.

---

## Como gerar o baseline (Entregável 1)

O retrato do schema real (`supabase/schema_baseline_20260813.sql`) **não** está neste PR de propósito — gerá-lo exige credenciais do banco. Dois caminhos:

- **(A) Workflow** `.github/workflows/schema-baseline.yml` (incluído neste PR): dispara **só** por `workflow_dispatch`, roda `supabase db dump --linked --schema public` e abre um PR com o arquivo. Reaproveita os secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`. ⚠️ **Confirmar antes que esses secrets existem** no repositório (Settings → Secrets and variables → Actions) — o cabeçalho do PR #48 os lista como *necessários*, não como *configurados*.
- **(B) Local**, se os secrets não existirem:
  ```bash
  supabase link --project-ref bphgtvwgsgaqaxmkrtqj
  supabase db dump --linked --schema public > supabase/schema_baseline_20260813.sql
  ```
  Adicionar no topo do arquivo o comentário "NÃO É MIGRATION" e abrir o PR com ele.

O arquivo fica em `supabase/` (fora de `migrations/`) e o nome não começa com timestamp de 14 dígitos, então `supabase db push` nunca tenta aplicá-lo.

---

## O que este documento deliberadamente NÃO faz

- Não corrige a deriva (não cria os 9 enums no repo, não renomeia a colisão, não reconcilia o histórico).
- Não aplica nem altera nada no banco (foi tudo somente leitura).
- Cada correção acima é uma decisão própria de fase posterior da ADR-050. **Esta fase mede.**
