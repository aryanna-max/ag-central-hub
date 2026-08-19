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
