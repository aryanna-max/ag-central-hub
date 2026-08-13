# Relatório de impacto — 9 achados de segurança (nada aplicado)

Nenhum arquivo alterado, nenhuma migration executada. Tudo abaixo é leitura do banco (`pg_policies`, `pg_class`, grants) feita agora.

## 1. Estado atual do RLS (schema `public`)

### 1.1 Políticas para `anon` — não existe nenhuma
Nenhuma política em `public` foi criada `TO anon`. As únicas com `roles = {public}` (que inclui anon) são:

| Tabela | Política | cmd | qual / with_check |
|---|---|---|---|
| email_send_log | Service role can read/insert/update send log | SELECT/INSERT/UPDATE | `auth.role() = 'service_role'` |
| email_send_state | Service role can manage send state | ALL | `auth.role() = 'service_role'` |
| suppressed_emails | Service role read/insert | SELECT/INSERT | `auth.role() = 'service_role'` |
| profiles | Users can read own profile | SELECT | `auth.uid() = id OR has_role(auth.uid(),'master')` |
| profiles | Users can update own profile | UPDATE | `auth.uid() = id` |
| technical_tasks | policy_tt_insert/update/delete | INSERT/UPDATE/DELETE | `EXISTS (select 1 from user_roles ...)` |

Ou seja: `anon` tem GRANT de SELECT nas tabelas (`has_table_privilege('anon', ...) = true`), mas **zero linhas passam**, porque não há política que o alcance.

### 1.2 Achado crítico já existente (anterior a qualquer correção)
`src/pages/AprovacaoExterna.tsx` lê `field_expense_sheets` e `field_expense_items` (com join em `employees`) direto pela chave anon, sem login. As únicas políticas dessas tabelas são `finance_ops_manage_expense_sheets` / `..._items`, ambas `TO authenticated` com `has_any_role(...)`. **Sob RLS, a rota `/aprovacao/:token` retorna zero linhas hoje** — a tela deve estar caindo em "Folha de despesa não encontrada ou link inválido". A submissão continua funcionando (Edge Function `approve-expense-sheet` roda como service_role); o que está quebrado é a leitura. Isso não é causado pelas 9 correções — é o estado atual, e precisa de decisão à parte.

### 1.3 Políticas permissivas ("qualquer autenticado") hoje
`qual = true` ou `auth.uid() IS NOT NULL`, todas `TO authenticated`, em: alerts, calendar_events, client_doc_requirements, clients (SELECT), companies (SELECT), company_documents, compliance_task_executions, daily_schedules, daily_schedule_entries, daily_team_assignments, employee_daily_records, employee_project_authorizations, event_log (SELECT), job_roles, lead_interactions, lead_status_history, leads (SELECT), measurements, measurement_items, measurement_daily_entries, monthly_compliance_tasks, monthly_schedules, project_benefits, project_participations, project_scope_items, project_services, project_status_history (SELECT), projects, proposals, proposal_items, receipts (SELECT), receipt_allocations (SELECT), service_types, system_settings (SELECT), team_members, teams, vehicles.

Tabelas já com papel restrito: employees, clients (write), leads (write), invoices, receipts (write), receipt_allocations (write), field_expense_sheets/items, benefit_settlements, client_contacts, companies (write), employee_absences, projects (INSERT/UPDATE via adr045).

### 1.4 Agentes MCP (confirmado no banco)
`claudio.financeiro@` = financeiro; `claudio.comercial@` = comercial; `claudio.operacional@` = operacional; `claudio.rh@` = rh; `claudio.salatecnica@` = sala_tecnica. Um papel cada, como previsto na worklist.

## 2. SQL que seria aplicado, por achado (não aplicado)

**A. `broad_auth_uid_not_null_policies`** — ~25 tabelas com `ALL` aberto a qualquer autenticado. Padrão por tabela:
```sql
DROP POLICY "Authenticated users full access" ON public.daily_schedules;
CREATE POLICY daily_schedules_rw ON public.daily_schedules FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','operacional','sala_tecnica']::app_role[]))
WITH CHECK (same);
```
Repetido com o array de papéis adequado a cada tabela (comercial para leads_*/proposals, financeiro para measurements, rh para company_documents/compliance, etc.).

**B. `clients_select_authenticated_any_user`**
```sql
DROP POLICY clients_select_authenticated ON public.clients;
CREATE POLICY clients_select_roles ON public.clients FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional','sala_tecnica']::app_role[]));
```

**C. `leads_select_authenticated_any_user`**
```sql
DROP POLICY leads_select_authenticated ON public.leads;
CREATE POLICY leads_select_roles ON public.leads FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::app_role[]));
```

**D. `event_log_select_any_authenticated`**
```sql
DROP POLICY auth_read_event_log ON public.event_log;
CREATE POLICY event_log_select_admin ON public.event_log FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor']::app_role[]));
```
(INSERT `auth_insert_event_log` permanece — é o que grava auditoria dos agentes.)

**E. `receipts_select_any_authenticated`**
```sql
DROP POLICY receipts_select ON public.receipts;
CREATE POLICY receipts_select_fin ON public.receipts FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::app_role[]));
```

**F. `receipt_allocations_select_any_authenticated`** — idêntico ao E, na tabela `receipt_allocations`, política `alloc_select`.

**G. `realtime_daily_team_assignments_no_role_restriction`**
```sql
DROP POLICY "Authenticated users full access" ON public.daily_team_assignments;
CREATE POLICY dta_select ON public.daily_team_assignments FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','operacional','sala_tecnica','rh']::app_role[]));
CREATE POLICY dta_write ON public.daily_team_assignments FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','operacional']::app_role[]))
WITH CHECK (same);
```

**H. `employees_select_missing_policy`** — verificação; se mantida a leitura por papel, adicionar SELECT explícito:
```sql
CREATE POLICY employees_select_roles ON public.employees FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['master','diretor','rh','financeiro','operacional']::app_role[]));
```
Hoje só existe `hr_roles_manage_employees` (ALL) e ela **não inclui `rh`** — corrigir isso é obrigatório antes de qualquer aperto.

**I. `SUPA_*_security_definer_function_executable` / `function_search_path_mutable`**
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM anon;      -- e/ou authenticated
ALTER FUNCTION public.<fn>(...) SET search_path = public;
```
Aplicável apenas às funções internas (triggers, `email_queue_*`, `moddatetime`), **nunca** às chamadas por MCP/UI.

## 3. Risco por correção

| # | Correção | `/aprovacao/:token` (anon) | Agentes MCP | Telas RH/Fin/Op |
|---|---|---|---|---|
| A | Apertar ~25 tabelas `ALL` | Neutro (já bloqueado) | **Alto** — cada agente perde tudo que o array esquecer; `sala_tecnica` e `rh` são os mais frágeis | **Alto** — quebra silenciosa (listas vazias, não erro) |
| B | clients SELECT | Neutro | Médio — agente op/ST precisa ler cliente em telas de projeto | Médio |
| C | leads SELECT | Neutro | Baixo/Médio — `list_leads` do agente operacional deixa de funcionar | Baixo |
| D | event_log SELECT | Neutro | Baixo — agentes escrevem, não leem | Baixo (só telas de histórico master/diretor) |
| E | receipts SELECT | Neutro | Baixo — só o financeiro lê | Médio: Faturamento visto por operacional/diretor deixa de ver recebimentos |
| F | receipt_allocations SELECT | Neutro | Baixo | Igual E |
| G | daily_team_assignments | Neutro | Médio — escala é caminho de agente operacional | Médio (Realtime + escala) |
| H | employees SELECT explícito | Neutro | **Corrige** o `rh` (hoje sem acesso) | Positivo |
| I | REVOKE EXECUTE / search_path | Neutro se restrito a funções internas | **Crítico se errar o alvo** — revogar `fn_create_titulo`, `fn_update_lead_status`, `fn_resolve_alert` etc. derruba os agentes | Idem |

Observação transversal: RLS negando devolve **lista vazia**, não erro. Sem teste por papel, a quebra passa despercebida por dias.

## 4. Seguras isoladamente vs. exigem código junto

**Seguras de aplicar isoladamente** (só SQL, impacto contido, reversível):
- H — SELECT explícito em `employees` incluindo `rh` (corrige gap real).
- D — event_log restrito a master/diretor.
- E e F — receipts / receipt_allocations restritos a master/diretor/financeiro, **desde que** confirmado antes que nenhuma tela não-financeira consulte essas tabelas.
- I — apenas para funções de trigger e de fila de e-mail, com lista explícita e revisada uma a uma.

**Exigem mudança/validação de código junto:**
- A — precisa de mapeamento tabela→papéis derivado dos hooks (`src/hooks/*`) e de teste logado por papel; é o único item que merece ser fatiado em lotes pequenos.
- B e C — as telas de Projetos, Prancheta e Escala leem `clients` (e `leads` no funil); trocar sem revisar os hooks gera telas vazias.
- G — Realtime + escala; exige revalidar `useDailySchedule`/`usePreencherEscala` e o mobile.
- I sobre funções de negócio — só depois de listar quais funções o MCP e a UI chamam.

**Fora dos 9, mas precisa de decisão:** a rota pública `/aprovacao/:token` está sem caminho de leitura sob RLS. As saídas são (a) política `TO anon` restrita por `approval_token` em `field_expense_sheets`/`field_expense_items`, ou (b) mover a leitura para a Edge Function `approve-expense-sheet` (service_role), que é a opção mais segura. Isso é mudança de código.

### Sequência sugerida
1. H (destrava `rh`) → 2. D → 3. E/F com checagem prévia dos consumidores → 4. decidir `/aprovacao` → 5. G → 6. B/C → 7. A em lotes por módulo → 8. I com lista nominal de funções.
