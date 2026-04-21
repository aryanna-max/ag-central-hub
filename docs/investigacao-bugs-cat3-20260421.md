# Investigação — Bugs cat3 identificados pela auditoria de `as any`

**Data:** 21/04/2026
**Escopo:** Diagnóstico de 5 pontos onde `as any` escondia possível bug real. Sem alteração de código. Documento de decisão.
**Branch base:** `main` (commit `9d13325`)

---

## Resumo executivo

Dos 5 pontos investigados, apenas **2 são bugs ativos**; 3 são **casts obsoletos** herdados de versões anteriores do `types.ts` — funcionam na prática mas mascaram o verificador de tipo.

| # | Item | Veredito | Severidade |
|---|---|---|---|
| 1 | `projects.responsible_comercial_id/_campo_id/_tecnico_id` | Cast obsoleto (colunas existem) | Baixa |
| 2 | `employees.has_vt/vt_cash/vt_value` | Cast obsoleto (colunas existem) | Baixa |
| 3 | `lead_source` enum em `useLeads.ts:206` | Cast obsoleto (valores válidos) | Baixa |
| 4 | `useLeadConversion.ts` | **Código morto**, campo fantasma `responsible` | Média |
| 5 | `enqueue_email` RPC em `AprovacaoExterna.tsx` | **Bug ativo em produção** | **Alta** |

**Recomendação geral:** tratar Bug 5 com urgência (Alcione não recebe emails de aprovação hoje); deletar hook morto do Bug 4; limpar os 3 casts obsoletos em lote.

---

## Bug 1 — `responsible_*` em `projects`

### Arquivos
- `src/pages/Projetos.tsx:241-243, 533-561`
- `src/pages/operacional/EscalaDiaria.tsx:309`

### Evidências
- `src/integrations/supabase/types.ts:2427-2429, 2479-2481, 2531-2533` — as **3 colunas existem** em `projects` (Row/Insert/Update) + FKs para `employees` (linhas 2562-2580).
- `projects.responsible_id` **NÃO existe** no schema atual (CLAUDE.md menciona mas está desatualizado — `types.ts` é fonte de verdade).
- Outros componentes já usam sem cast: `STProjectDetail.tsx`, `STKanban.tsx`, `ProjectFormDialog.tsx`, `LeadConversionDialog.tsx`.
- `ProjectInsert` em `useProjects.ts:70-89` tem apenas `responsible_comercial_id` — faltam `responsible_campo_id` e `responsible_tecnico_id`.

### Diagnóstico
Feature implementada e em uso. O `as any` é resquício do momento antes do `types.ts` ser regenerado. Os commits `bc52016 Regenerou tipos Supabase atual` e `df7bdca chore: remover cast 'as any' apos types.ts regenerado` fizeram parte da limpeza, mas esses pontos escaparam.

### Impacto
Nenhum bug funcional. O cast só desliga o TypeScript. Risco: rename de coluna não avisaria esses pontos.

### Opções
- **A.** Remover `as any` nos 6 pontos + completar `ProjectInsert` com as 2 colunas faltantes
- **B.** Manter

### Recomendação
**A.** Limpeza barata, alinha com política do commit `df7bdca`.

---

## Bug 2 — `vt_*` em `employees`

### Arquivo
`src/pages/rh/Funcionarios.tsx:156, 171-173, 186-190`

### Evidências
- `types.ts:1142, 1152, 1153` — `has_vt`, `vt_cash`, `vt_value` **existem** em `employees` (Row/Insert/Update). Criadas na migration `20260323213745`.
- `types.ts:1150` — `transporte_tipo` também existe.
- `vt_isento_desconto` existe na migration `20260420_fase3b_expand_employees.sql:109` mas **não aparece em `types.ts`** → migration ainda não aplicada no banco do Lovable (bate com o erro `SELECT COUNT(*) FROM job_roles` visto hoje).
- Commit `a6975fa` é sobre `useDailySchedule.ts` (cálculo de VT via `system_settings`), não sobre este form.
- `Funcionarios.tsx` faz dois UPDATEs: o primeiro via `updateEmployee.mutateAsync` (campos básicos) e um segundo direto no supabase client só para VT.

### Diagnóstico
Colunas reais, em produção, necessárias. Cast obsoleto + UI com update fragmentado em duas chamadas.

### Impacto
Nenhum bug funcional. Código frágil: se `Number("abc")` virar `NaN`, grava `NaN` no banco sem validação.

### Opções
- **A.** Remover `as any` (linhas 156, 171-173, 186-190) — compila direto
- **B.** Refatorar para um único `updateEmployee` com todos os campos
- **C.** Regenerar `types.ts` incluindo `vt_isento_desconto` (depende de Lovable aplicar a migration 3b)

### Recomendação
**A agora** (baixo custo), **B depois** (refactor dedicado). **C só se** o form passar a expor `vt_isento_desconto` na UI.

---

## Bug 3 — `lead_source` enum em `useLeads.ts:206`

### Arquivo
`src/hooks/useLeads.ts:187-206`

### Evidências
- `types.ts:3310-3322` — enum `lead_source` com 12 valores.
- `ORIGIN_TO_SOURCE` mapeia `LeadOrigin` para `indicacao | whatsapp | site | licitacao | outros` — todos válidos.
- Fallback `|| "outros"` também válido.
- `origin` vem do form já tipado.

### Diagnóstico
Cast desnecessário. Todos os valores gerados estão dentro do enum. Possivelmente sobrou de quando `source` era string livre.

### Impacto
Nenhum.

### Opções
- **A.** Remover cast + tipar `source` como `Database["public"]["Enums"]["lead_source"]`
- **B.** Manter

### Recomendação
**A.**

---

## Bug 4 — `useLeadConversion.ts` — código morto + campo fantasma

### Arquivos
- `src/hooks/useLeadConversion.ts` (arquivo inteiro)
- `src/hooks/useProjects.ts:78` (campo `responsible` fantasma em `ProjectInsert`)

### Evidências
- Linha 17 insere em `projects` com `responsible: lead.responsible_id as any`.
- `projects` **não tem coluna `responsible`** (`types.ts:2389-2545`). Só `responsible_campo/comercial/tecnico_id`.
- `ProjectInsert` declara `responsible?: string | null` — campo fantasma, sem backing no banco.
- `useCreateProject` faz `insert(payload as any)` — passa o campo fantasma direto pro PostgREST.
- `grep -rn "useLeadConversion" src/` — **nenhum importador** no codebase.
- Fluxo real de conversão é `LeadConversionDialog.tsx:223`, que usa `responsible_comercial_id: directorId` + cria OS + preenche códigos novos (ANO-SIGLA-SEQ) conforme arquitetura comercial v10.

### Diagnóstico
Código morto de uma versão antiga do fluxo de conversão. Se chamado hoje, provavelmente daria erro PostgREST ou silenciosamente descartaria o campo. Não cria OS, não respeita codes, viola a arquitetura comercial v10.

### Impacto
Nenhum operacional (hook não é chamado). Risco médio: alguém pode importar por engano e criar projeto mal-formado.

### Opções
- **A.** Deletar `src/hooks/useLeadConversion.ts` + remover campo `responsible` de `ProjectInsert`
- **B.** Refatorar para delegar ao fluxo do `LeadConversionDialog` (duplicação)
- **C.** Manter e corrigir (não faz sentido — já existe fluxo canônico)

### Recomendação
**A.** Deletar. Mantém uma única fonte de verdade para conversão de lead.

---

## Bug 5 — `enqueue_email` RPC em `AprovacaoExterna.tsx` 🔴 BUG ATIVO

### Arquivo
`src/pages/AprovacaoExterna.tsx:104-111`

### Evidências
- `types.ts:3182-3185` — assinatura real: `enqueue_email(payload: Json, queue_name: string): number`.
- Migration `20260330131613_email_infra.sql:131` confirma `enqueue_email(queue_name TEXT, payload JSONB)`.
- Invocações **corretas** existentes:
  - `supabase/functions/send-financial-alert/index.ts:126-129`
  - `supabase/functions/auth-email-hook/index.ts:253`
- Invocação **errada** em `AprovacaoExterna.tsx:104`:
  ```ts
  supabase.rpc("enqueue_email" as any, {
    p_to: emailAlcione,
    p_subject: `...`,
    p_body: `...`
  })
  ```
  Passa `p_to`, `p_subject`, `p_body` — parâmetros que não existem. Cast `as any` esconde o erro TS.
- Try/catch (linhas 109-111) engole o erro com comentário "Email infrastructure may not be configured yet" — sem log, sem alerta.

### Diagnóstico
**Bug ativo em produção desde a criação do arquivo.** Cada aprovação externa de folha de despesas tenta notificar Alcione, o RPC falha por assinatura incorreta, e o catch silencioso impede que qualquer pessoa perceba.

### Impacto
**Alto.** Por decisão arquitetural (CLAUDE.md #7: "Alcione: acesso eventual. Email = gatilho"), Alcione deveria ser notificada por email sempre que uma folha for aprovada pela Diretoria para que ela dispare o pagamento. **Isso nunca funcionou.** A aprovação acontece no sistema mas Alcione não sabe. Zero telemetria para detectar o problema.

### Opções
- **A.** Corrigir chamada seguindo padrão do `send-financial-alert`:
  ```ts
  supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: { to: emailAlcione, subject, html, from }
  })
  ```
  + remover `as any`
  + trocar catch vazio por log em `email_send_log` (tabela já existe, padrão em `send-financial-alert:134-140`)
- **B.** Manter (quebra processo operacional crítico)

### Recomendação
**A.** Prioridade máxima. É o único dos 5 com consequência operacional real hoje.

---

## Decisões pendentes — checklist

- [ ] **Bug 5 (URGENTE):** aprovar correção do `enqueue_email` + substituição do catch silencioso por log em `email_send_log`
- [ ] **Bug 4:** confirmar deleção de `src/hooks/useLeadConversion.ts` + remoção do campo fantasma `responsible` em `ProjectInsert`
- [ ] **Bugs 1-3:** fazer limpeza em lote (PR único) ou separados?
- [ ] **Bug 2:** aceitar só remoção de `as any` (opção A) ou também refatorar o update fragmentado (opção B)?
- [ ] **Migration Fase 3b:** confirmar no Lovable se foi aplicada; se sim, regenerar `types.ts` para incluir `vt_isento_desconto`, `job_role_id`, `payroll_periods`, `monthly_discount_reports`
- [ ] **Meta:** após estes fixes, rodar `tsc --strict` global e listar os `as any` remanescentes para próxima onda?

---

## Arquivos relevantes (absolutos)

| Arquivo | Linhas | Papel |
|---|---|---|
| `/home/user/ag-central-hub/src/pages/Projetos.tsx` | 241-243, 533-562 | Bug 1 |
| `/home/user/ag-central-hub/src/pages/operacional/EscalaDiaria.tsx` | 309 | Bug 1 |
| `/home/user/ag-central-hub/src/pages/rh/Funcionarios.tsx` | 156, 171-173, 186-190 | Bug 2 |
| `/home/user/ag-central-hub/src/hooks/useLeads.ts` | 187-206 | Bug 3 |
| `/home/user/ag-central-hub/src/hooks/useLeadConversion.ts` | arquivo inteiro | Bug 4 (deletar) |
| `/home/user/ag-central-hub/src/hooks/useProjects.ts` | 70-89 | Bug 4 (ProjectInsert) |
| `/home/user/ag-central-hub/src/pages/AprovacaoExterna.tsx` | 104-111 | Bug 5 🔴 |
| `/home/user/ag-central-hub/src/integrations/supabase/types.ts` | 1136-1191, 2389-2589, 3182-3185, 3310-3322 | Fonte de verdade |
| `/home/user/ag-central-hub/supabase/functions/send-financial-alert/index.ts` | 118-140 | Exemplo correto do RPC |
| `/home/user/ag-central-hub/supabase/migrations/20260330131613_email_infra.sql` | 131 | Assinatura `enqueue_email` |
| `/home/user/ag-central-hub/supabase/migrations/20260420_fase3b_expand_employees.sql` | 109 | `vt_isento_desconto` não regenerado |
