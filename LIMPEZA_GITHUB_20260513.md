# Limpeza GitHub — 13/05/2026

Resultado da tarefa de limpeza de branches órfãs descrita no prompt do Cowork (PR de limpeza #40, base `397fa20`).

## ⚠️ Limitação do ambiente

Este Code rodou em ambiente onde o `git push --delete` retorna **HTTP 403** (proxy local bloqueia deleção de refs) e o GitHub MCP server não expõe ferramenta `delete_branch`/`delete_ref`. **Não foi possível executar as deleções via tooling.**

O que está abaixo é o relatório de inspeção e o script de deleção. Aryanna roda o script local ou usa a UI do GitHub depois de mergear este PR (ou cancela a deleção das branches sinalizadas como inesperadas).

## PR fechado

- **PR #34** `fix(escala): attendance fantasma → day_type discriminador` — fechado sem merge com comentário apontando para PR #35 (já mergeado).

## Branches confirmadas como seguras para deletar (32 total — 0 commits únicos vs main)

Verificação: `git log origin/main..origin/<branch> --oneline` retornou vazio para todas.

```
claude/add-db-type-safety-FoKfX          (PR #31)
claude/cleanup-as-any-types-UNHsT        (PR #30)
claude/cleanup-typescript-any-VnWkk      (PR #36)
claude/expand-employee-records-BrYG0     (PR #7)
claude/fix-attendance-architecture-Yzlam (PR #35)
claude/fix-attendance-day-type-NGj1b     (PR #34 fechado agora — 1 commit único, esperado)
claude/fix-company-documents-seed-fbn29  (PR #22)
claude/fix-lead-proposta-bugs-CutDt      (PR #39)
claude/migrate-compliance-content-MSJSK  (PR #25)
claude/migrate-compliance-content-b73wl  (PR #26)
claude/redesign-prompt-leads-he7M2       (PR #29)
claude/refactor-directory-structure-s91Bm (PR #27)
claude/refactor-project-types-xe8RU      (PR #32)
claude/refactor-vehicle-type-safety-WI3cw (PR #33)
claude/rename-phase-4-migration-x29S8    (PR #38)
claude/setup-routes-sidebar-pages-fsvIQ  (PR #23)
chore/drop-legadas                       (PR #13)
cliente-como-centro                      (PR #28)
docs/claude-md-v11-as-any-rule           (doc snapshot)
docs/investigacao-bugs-cat3              (PR #9)
fase3b-hooks-only                        (PR #8)
feat/client-doc-requirements-ui          (PR #21)
feat/compliance-validation-badge         (PR #20)
feat/event-log-c04                       (PR #12)
feat/fase4-ui-comercial                  (PR #37)
feat/ferias-cleanup-bugs-escala          (PR #18)
feat/onda3-admissao-desligamento         (PR #16)
feat/onda3-config-pessoas                (PR #15)
feat/onda3-descontos-mensais             (PR #17)
feat/onda3-pr-c-pessoas-completo         (PR #19)
fix/bug5-aprovacao-externa               (PR #14)
update-claude-md-v14.1                   (PR #24)
```

## ⚠️ Branches listadas como "seguras" no prompt, mas que TÊM commits únicos — NÃO deletadas

A regra do prompt manda parar e reportar se aparecer commit único. Estas 5 caem nessa categoria:

### `claude/connect-scale-benefits-expenses-qRpj2` — 888 commits únicos
Origem PR #3 (antigo). Os commits topo incluem `feat: Fase 1 — employee_daily_records + project_benefits UI`, `feat: connect schedule closing to benefits and expense auto-fill (FASE 1B)`, `Fix UFV Paudalho`, mais centenas de commits de história antiga. Provável: branch base de antes do reset/refator de `main`. Conteúdo provavelmente já está em main por outros caminhos, mas como o merge-base não existe não dá pra confirmar trivialmente.
**Recomendação:** confirmar com Aryanna se conteúdo está coberto e então deletar manualmente.

### `claude/organize-ag-system-yqvNF` — 12 commits únicos
Inclui `feat(campo): add Encontro de Contas — weekly benefit reconciliation`, `feat: adicionar migration benefit_settlements`, mais ajustes de sidebar/menu recolhido. Pode ter sido superada por outros PRs.
**Recomendação:** revisar diff e descartar se redundante.

### `claude/rebuild-measurements-module-9lwPq` — 3 commits únicos
- `f6a8cd1 fix: renomear migration de measurements para formato YYYYMMDDHHMMSS`
- `ff9d590 chore: add supabase/.temp/ to .gitignore`
- `ab351a4 docs: criar REVISAO/ESTADO_ATUAL.md`

**Recomendação:** docs/chore só. Provavelmente descartável. Confirmar.

### `claude/sistema-ag-project-b3tby` — 565 commits únicos
PR #2 (closed). Contém história inicial enorme: `Add attendance tables`, `Add billing_type column to projects`, e centenas de commits de fundação. Como PR #2 foi closed (não merged) e `main` foi reconstruído, esta branch é o melhor registro da história antiga.
**Recomendação:** NÃO deletar agora — preservar como arquivo histórico até decisão explícita.

### `docs/estado-atual-20260420` — 1 commit único
- `d5e0b44 docs: criar REVISAO/ESTADO_ATUAL.md (snapshot 20/04/2026)`

Snapshot de estado superado pela documentação em `Sistema AG/` (local). Seguro descartar.
**Recomendação:** descartar.

## Branches preservadas conforme instrução (3A/3B/3C — não deletar)

### 3A `claude/execute-phase-3-QMz6A` — 2 commits únicos
Commits:
- `4a857ad feat: Fase 3 — Pessoas completo (admissao/desligamento + descontos mensais)`
- `509647f wip: Fase 3b — schema reshape (migration + hooks; UI pendente)`

Arquivos alterados (7):
```
M  src/components/AppSidebar.tsx
A  src/hooks/useJobRoles.ts
A  src/hooks/useMonthlyDiscountReports.ts
A  src/hooks/usePayrollPeriods.ts
M  src/pages/RH.tsx
M  src/pages/rh/Funcionarios.tsx
A  supabase/migrations/20260420_fase3b_pessoas_expandido.sql
```
Conteúdo relevante: hooks novos (`useJobRoles`, `useMonthlyDiscountReports`, `usePayrollPeriods`) + migration fase3b. Provável que main já cubra via PRs onda3 (#15-19) e PR #8 (fase3b-hooks-only). **Recomendação: cherry-pick seletivo dos hooks se faltar algo em main, senão descartar.**

### 3B `claude/system-diagnostic-3htKM` — 2 commits únicos (mas sem merge-base com main)
Commits topo:
- `550a662 feat: RDF viewer + Beneficios de Campo no detalhe do projeto`
- `de91b72 fix: resolve merge conflicts com main, manter RDFDigital do main`

Conteúdo relevante: provável UI de "RDF viewer + Benefícios de Campo no detalhe do projeto" — não confirmado se a UI já vive em main. Diff total é gigante (185 arquivos) por ausência de merge-base, mas a maioria é ruído de história antiga.
**Recomendação: Aryanna abre o commit `550a662` e cherry-picka apenas se a UI faltar em main; senão descartar.**

### 3C `claude/system-diagnostic-cleanup-qtcz8` — 3 commits únicos (sem merge-base)
Commits topo:
- `aa4aefd Atualizar CLAUDE.md com estado real do banco após SQL Consolidado`
- `e7f3eae Corrigir Gran Alpes: PJ, não PF — billing_type pendente de confirmação`
- `6f8d897 Gran Alpes: entrega_recibo confirmado — sem NF no servidor`

Conteúdo relevante: atualização do CLAUDE.md antigo (provavelmente v11 ou anterior — bem antes da v14.1 atual) + dados sobre cliente Gran Alpes (PJ, billing_type, entrega_recibo). Diff total 204 arquivos por falta de merge-base.
**Recomendação: extrair só os dados de Gran Alpes (revisar se a info já está propagada para `clients`/`projects` em main), descartar o resto.**

## Script de deleção (rodar local após revisão)

```bash
#!/usr/bin/env bash
# Roda local, com gh CLI autenticado.
for b in \
  claude/add-db-type-safety-FoKfX \
  claude/cleanup-as-any-types-UNHsT \
  claude/cleanup-typescript-any-VnWkk \
  claude/expand-employee-records-BrYG0 \
  claude/fix-attendance-architecture-Yzlam \
  claude/fix-attendance-day-type-NGj1b \
  claude/fix-company-documents-seed-fbn29 \
  claude/fix-lead-proposta-bugs-CutDt \
  claude/migrate-compliance-content-MSJSK \
  claude/migrate-compliance-content-b73wl \
  claude/redesign-prompt-leads-he7M2 \
  claude/refactor-directory-structure-s91Bm \
  claude/refactor-project-types-xe8RU \
  claude/refactor-vehicle-type-safety-WI3cw \
  claude/rename-phase-4-migration-x29S8 \
  claude/setup-routes-sidebar-pages-fsvIQ \
  chore/drop-legadas \
  cliente-como-centro \
  docs/claude-md-v11-as-any-rule \
  docs/investigacao-bugs-cat3 \
  fase3b-hooks-only \
  feat/client-doc-requirements-ui \
  feat/compliance-validation-badge \
  feat/event-log-c04 \
  feat/fase4-ui-comercial \
  feat/ferias-cleanup-bugs-escala \
  feat/onda3-admissao-desligamento \
  feat/onda3-config-pessoas \
  feat/onda3-descontos-mensais \
  feat/onda3-pr-c-pessoas-completo \
  fix/bug5-aprovacao-externa \
  update-claude-md-v14.1; do
  echo "deleting $b"
  gh api -X DELETE "repos/aryanna-max/ag-central-hub/git/refs/heads/$b"
done
```

Branches a manter (em revisão): `claude/connect-scale-benefits-expenses-qRpj2`, `claude/organize-ag-system-yqvNF`, `claude/rebuild-measurements-module-9lwPq`, `claude/sistema-ag-project-b3tby`, `docs/estado-atual-20260420`, `claude/execute-phase-3-QMz6A`, `claude/system-diagnostic-3htKM`, `claude/system-diagnostic-cleanup-qtcz8`, `claude/github-cleanup-ksNSw` (este PR).

## Estado final esperado após rodar o script

- Branches em `main`: 1
- Branches com trabalho pendente de decisão: 8 (5 inesperadas + 3 expressamente preservadas)
- PRs abertos: 1 (este, draft)
