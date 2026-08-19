# Handoff para o Claude Code — ADR-052 (isenção de faturamento / doação)

**Status:** aprovado pela Aryanna em 19/08/2026.
**Escopo:** implementar. Nada foi aplicado em produção até aqui.

---

## Arquivos deste pacote

| Arquivo | Destino no repo |
|---|---|
| `ADR-052_ISENCAO_FATURAMENTO_DOACAO.md` | `docs/arquitetura/` |
| `20260819120000_adr052_isencao_faturamento.sql` | `supabase/migrations/` |
| `isentar-faturamento.ts` | `src/lib/mcp/tools/` |

---

## PASSO 0 — BLOQUEANTE. Não pule.

Antes de aplicar a migration, dumpar de **produção**:

```sql
select pg_get_functiondef('fn_on_status_change'::regproc);
select pg_get_functiondef('fn_resolve_alert'::regproc);
select pg_get_functiondef('fn_update_project'::regproc);
```

Diffar contra as seções 3 e 4 da migration.

**Por quê:** `supabase/migrations/` não é fonte de verdade do schema (ver
`INVENTARIO_DERIVA_SCHEMA.md`). O Lovable aplicou alterações direto no banco. Um
`create or replace` sobre corpo não lido apaga essas alterações **em silêncio** — sem erro,
sem aviso.

Se o diff divergir: pare e reporte antes de aplicar.

---

## Ordem de implementação

1. Passo 0 (acima).
2. Aplicar a migration — CHECK `NOT VALID` em `billing_type`, colunas de isenção,
   `fn_politica_documento_entrega`, `fn_isentar_faturamento_projeto`.
3. Registrar a ferramenta MCP: arquivo em `src/lib/mcp/tools/` **+ registro em
   `src/lib/mcp/index.ts`**. Não editar `supabase/functions/mcp/index.ts` — é auto-gerado.
4. Fechar o caso `2026-HCA-001`: `isentar_faturamento` → depois `resolve_alert`.
   Dois passos, duas linhas em `event_log`, zero linha em `invoices`.

---

## Invariantes que não podem quebrar

- **Nenhuma linha em `invoices`** para projeto isento. Título de R$ 0 tem `saldo = 0`, logo
  `situacao = 'quitado'` em `v_titulos_receber` — apareceria como dinheiro recebido que nunca
  entrou. Foi a alternativa rejeitada; não reintroduzir por conveniência.
- **Gate de papel:** só `master` e `diretor` isentam. `financeiro` fica de fora — a Alcione
  registra o que aconteceu, não decide deixar de cobrar.
- **CHECK bicondicional:** sem motivo e autor não existe `sem_faturamento`; motivo preenchido
  com outro `billing_type` também é recusado. Não pode existir doação anônima no banco, nem
  via SQL Editor.
- **Isentar não baixa o alerta.** Criar o título *cumpre* o que o alerta pediu; isentar é
  *decidir não fazer*. São atos diferentes e a baixa continua explícita.
- `event_log` grava `valor_renunciado` — é o que torna respondível "quanto a AG doou em 2026".

---

## Fora de escopo nesta onda

- Emenda em `fn_update_project` (edição cirúrgica sobre o corpo dumpado; a CHECK já protege).
- `projects.tipo_documento` — redundante com `billing_type`. Registrado como dívida.
- Reverter isenção: existe como função SQL, **não** exposta no MCP.

---

## Questões abertas — não bloqueiam

Estão no §9 do ADR, para decisão posterior da Aryanna:
1. A isenção deve baixar o alerta sozinha?
2. Comportamento de `fixo_mensal`.

— Cláudio 🤖

---

## PASSO 0 — EXECUTADO ✅ (19/08/2026)

Dump rodado pela Aryanna no SQL Editor do Lovable e conferido pelo Code.

**Resultado: SEM DERIVA.** Os corpos em produção de `fn_on_status_change` e
`fn_resolve_alert` são **idênticos** ao repo (comparação token a token, normalizando
espaço em branco):

| Função | Produção vs. repo | Baseline no repo |
|---|---|---|
| `fn_on_status_change` | idêntico (3073 chars) | `20260811162220_64b02cf5` |
| `fn_resolve_alert` | idêntico (2516 chars) | `20260811162330_7601e15d` |

Nota: a migration cita como base `20260811143000` e `20260811150100`. Existem migrations
**posteriores** que redefinem as mesmas funções (`20260811162220`, `20260811162330`) — os
corpos são idênticos entre elas, então as bases citadas valem.

Logo o `create or replace` das seções 3 e 4 **não apaga nada**: a única diferença é a
mudança pretendida pelo ADR-052.

### Achado no dump de `fn_update_project` — corrige o Passo 3

O corpo em produção valida `billing_type` assim:

```sql
if p_billing_type is not null
   and p_billing_type not in ('entrega_nf','medicao_mensal','entrega_recibo') then
  raise exception 'billing_type inválido (%). Use entrega_nf, medicao_mensal ou entrega_recibo.', p_billing_type;
end if;
```

**Consequência:** o §7 do ADR manda inserir a guarda de `sem_faturamento` *"logo após a
validação de `billing_type` existente"*. Se for aplicado assim, a **primeira guarda vira
código morto** — `sem_faturamento` não está na lista dos 3 aceitos, então a validação
existente dispara antes, com a mensagem genérica "billing_type inválido", e a mensagem
que aponta para `isentar_faturamento` nunca aparece.

**Correção:** a primeira guarda (`p_billing_type = 'sem_faturamento'`) tem que entrar
**ANTES** da validação existente. A segunda guarda (bloquear a *saída* de
`sem_faturamento`) pode ficar depois — ela testa valores que passam na validação.

Isso não afeta esta migration (o Passo 3 é fora dela). Fica registrado para quando for aplicado.

### `fixo_mensal` — §9.3 continua em aberto

`fn_update_project` **não aceita** `fixo_mensal` (só os 3 valores acima), e
`BILLING_LABELS` no frontend também não o lista — só `RECURRING_BILLING_TYPES`. Pode ser
que nenhum projeto tenha esse valor, e aí a mudança de comportamento do §9.3 é inócua.
Confirmar com:

```sql
select coalesce(billing_type,'(null)') as billing_type, count(*)
from public.projects group by 1 order by 2 desc;
```
