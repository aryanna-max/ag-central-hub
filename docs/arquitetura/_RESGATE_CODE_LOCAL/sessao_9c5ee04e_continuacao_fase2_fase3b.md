# Sessão 9c5ee04e — Continuação Fase 2 → Fase 3B (20/04/2026)

**Classificação:** 🟡 Média (484 linhas, sessão continuation summary + execução)
**Origem:** `C--Users-aryan-Documents-Claude-Projects-Sistema-AG/9c5ee04e-1f7c-4284-b5be-a7c4b8ce66e8.jsonl`

---

## Decisões

### Leads — reverter "perdidos" agressivos
- Critério original agressivo da migration `20260417_limpeza_dados_legado.sql` marcou 14 leads como `perdido` via `WHERE converted_project_id IS NULL AND client_id IS NULL AND status NOT IN ('convertido','perdido')`.
- **Critério era frágil**: `client_id IS NULL` significa apenas "ainda não virou cliente", não lead morto.
- Após revert, estado final: 26 convertido, 3 proposta_enviada, 1 em_negociacao, 1 em_contato, 1 qualificado, 9 novo, **0 perdido**. Total 41 leads ativos.
- 3 leads `novo` classificados como ambíguos para decisão manual via Kanban: Polyana/Arq. Polyanna, Tiago Alan/Tecnoind, Irmão João Arimatea/Arautos.

### Medições — migration aplicada
- Tabelas `measurement_items` e `measurement_daily_entries` criadas.
- `measurements` foi de 23 → 36 colunas (13 novas via ALTER).
- Erro `policy "Auth full access mi" already exists` = ruído — tabelas ficaram íntegras (idempotência faltava no CREATE POLICY).
- Cadeia `proposals → project_services → measurements → measurement_items → invoices` consolidada.

### Código BM (Boletim de Medição) — reformulação
- **Antes:** `AG-BM-2026-001` (sequencial global por ano).
- **Depois:** `BM-BRK-003-NN` (sequencial por projeto, código do projeto sem o ano, 2 dígitos).
- Medições antigas preservam formato histórico. 3 commits: `baedd3e` → `7e982ba` (2 dígitos) → `244559c` (intervalo de datas livre).

### Medições — período livre
- Trocado `<Select Mês + Ano>` por dois `<input type="date">` (Período de / Período até).
- Default pré-preenchido com 1º/último dia do mês atual (fluxo mensal continua rápido).

### 4 pendências técnicas (VT hardcodes) — resolvidas
Commits `a6975fa` (hook) + `bc52016` (types.ts regenerado) + `df7bdca` (remove `as any`).

1. SQL: `ALTER employees ADD transporte_tipo TEXT CHECK IN (vt_cartao, dinheiro, nenhum)`.
2. SQL: `ALTER field_expense_items ADD subtipo CHECK IN (integral, complemento)` — CHECK fica no banco mesmo sem aparecer no types.ts (constraints não refletem em TS).
3. SQL: 4 keys em `system_settings` (vt_valor_viagem 4.50, vt_viagens_por_dia 2, vt_desconto_percentual 6, alelo_valor_dia 15.00). Tabela só tem `key` e `value` — sem `description`.
4. `useDailySchedule.ts`: sai hardcode `vt_value: 4.50`, passa a ler `transporte_tipo` do funcionário + `vt_valor_viagem` e `vt_viagens_por_dia` de `system_settings`. Aplica regra: só `vt_cartao` presente gera `vt_provided`.

### Fase 3 (Pessoas) — plano B→D (não executado completamente)
| # | O que | Onde |
|---|---|---|
| A | SQL: `salario_base` NUMERIC + `tipo_contrato` (clt/pj/autonomo/estagio/temporario) em employees | Banco |
| B | Form Funcionarios: 3 campos novos (transporte_tipo, salario_base, tipo_contrato) | `Funcionarios.tsx` |
| C | Hook + página "Folha Benefícios Mensal" (Alelo+VT, fecha dia 26, export CSV Thyalcont) | novo |
| D | Sidebar + rota | `AppSidebar.tsx` + `RH.tsx` |

Parte A começada como arquivo de migration. Chrome MCP desconectou antes de aplicar.

---

## Raciocínios

- **Lovable NÃO tem GitHub Action para regen types.ts** — regeneração passa pelo agente Lovable. Usuário depois disse "NAO UTILIZAR PROMPT" (não enviar mensagens pelo chat Lovable) → mudança de código via git push; SQL via Studio é OK, chat não.
- Modal "Confirm destructive operation" do Lovable **só aceita clique manual** — pointerdown/mouseup não registra no React.
- Métricas desatualizadas em CSVs/dashboards não refletem estado real pós-revert.

---

## Bugs

- **Policy duplicada em `measurement_items`**: idempotência do CREATE POLICY faltante; apenas ruído, não bloqueou migration.
- Migration agressiva de limpeza de leads (relatada como corrigida, mas comportamento da v1 foi documentado para não repetir).

---

## Pendências ao final

- **Fase 3 Pessoas**: parcialmente iniciada (parte A pronta como arquivo, não aplicada).
- Módulo Pessoas: admissão, desligamento, folha mensal Alelo+VT, integração com Encontro de Contas.
- **Fase 4 Arq. Comercial**: SQL escritos, não aplicados.
- `types.ts` regenerado com sucesso pós-Fase 2 + measurements (commit `77312c5`, +571 linhas).

---

## Arquivos tocados

- `supabase/migrations/20260416_fase2_compliance.sql`
- `supabase/migrations/20260416_fase2_vincular_clientes.sql`
- `supabase/migrations/20260417_limpeza_dados_legado.sql`
- `supabase/migrations/20260416_refactor_measurements.sql`
- `src/hooks/useEmployeeDocuments.ts` / `useComplianceTasks.ts` / `useMeasurements.ts` / `useProjects.ts` / `useDailySchedule.ts`
- `src/pages/rh/Documentos.tsx` / `Compliance.tsx`
- `src/components/rh/ComplianceBadge.tsx`
- `src/pages/financeiro/FaturamentoMedicoes.tsx` (reescrito read-only + NF + pagamento)
- `src/pages/financeiro/FaturamentoProjetos.tsx` (query A Receber só `execution_status=faturamento + is_active=true`)
- `src/pages/projetos/ProjetoHistorico.tsx` / `admin/ClienteHistorico.tsx` (trocar useProjects → useProjectsAll)
- `src/pages/Operacional.tsx` (remoção rota projetos-campo)
- `Sistema AG/_SQL/SQL_11_REVISAR_PERDIDOS.sql`

---

## Trechos relevantes

> "os leads sumirammmm" — feedback que disparou revert dos perdidos.

> "NAO UTILIZAR PROMOPT" / "REALIZAR MUDANÇA VIA GITHUB" — instrução que consolidou fluxo: código por push, SQL por Studio, nunca chat Lovable.

> "O erro `policy already exists` foi só ruído — o CREATE TABLE rodou antes e tabelas ficaram íntegras, só a segunda tentativa de CREATE POLICY falhou (idempotência faltando)."
