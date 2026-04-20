# ESTADO ATUAL — Sistema AG Central Hub

**Última atualização:** 20/04/2026
**Referência completa:** `CLAUDE.md` + `AG Topografia - Central/ARQUITETURA_SISTEMA_V2_15ABR2026.html`

---

## Snapshot de 20/04/2026

### PRs desta sessão

| PR | Título | Status |
|---|---|---|
| #7 | feat(pessoas): fase 3b — migration SQL (job_roles, payroll_periods, monthly_discount_reports, +34 cols em employees) | ✅ merged |
| #6 | UI Fase 3B (Funcionarios.tsx quebrado, imports para componentes inexistentes) | ❌ fechado sem merge |
| #8 | feat: hooks Fase 3B sem UI (useJobRoles, usePayrollPeriods, useMonthlyDiscountReports) | 🟡 draft, build local passou |

### Migration Fase 3b aplicada no banco?

⚠️ **Pendente.** Migration `supabase/migrations/20260420_fase3b_expand_employees.sql` está no repo (merged em main via PR #7) mas ainda não foi aplicada no Supabase. `SELECT COUNT(*) FROM job_roles` retorna "relation does not exist".

**Para aplicar:** `supabase db push` OU colar o conteúdo do arquivo no SQL Editor do Lovable/Supabase.

### Pendências de diagnóstico

- **Aryanna em `employees`?** Rodar no SQL Editor:
  ```sql
  SELECT id, matricula, name, role, tipo_contrato, status
  FROM public.employees WHERE name ILIKE '%aryanna%';

  SELECT id, email, name, role
  FROM public.profiles
  WHERE email ILIKE '%aryanna%' OR name ILIKE '%aryanna%';
  ```
  Esperado: Query 1 = 0 linhas; Query 2 = 1 linha com `role = master` ou `diretor`.

### Decisões reforçadas nesta sessão

- Aryanna Gonzaga (Diretora Administrativa, sócia) **não entra em `employees`**. Só em `profiles` + `user_roles`.
- Tela Pessoas mostra apenas funcionários (CLT `000XXX` + prestadores `PREST-XXX`).
- PRs com UI que importa componentes inexistentes são fechados sem merge; hooks são resgatados em PR separado.

---

## Fila de execução (sem alteração vs. CLAUDE.md de 15/04)

| Fase | Prioridade | Status |
|---|---|---|
| 1 — Escala→Benefícios→RDF | 🔴 URGENTE | Não iniciado |
| 2 — Compliance | 🔴 URGENTE | Não iniciado |
| 3 — Pessoas completo (inclui Fase 3b já migrada) | 🟡 ALTO | Migration ok, hooks em PR #8, UI pendente |
| 4 — Arq. Comercial | 🟡 ALTO | SQL-A1 a A5 escritos |
| 5 — Email Financeiro | 🔵 MÉDIO | — |
| 6 — Contas a Pagar | 🔵 MÉDIO | — |
| 7-9 | ⚪ BAIXO | — |

---

## Como usar este arquivo

Referência rápida para novos chats. Para detalhes (processos BPMN, schema, gaps, modelo operacional), ver:
- `CLAUDE.md` (fonte de verdade de instruções)
- `AG Topografia - Central/ARQUITETURA_SISTEMA_V2_15ABR2026.html` (documento definitivo)
- `src/integrations/supabase/types.ts` (schema atual)
