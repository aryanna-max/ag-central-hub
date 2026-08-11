# WORKLIST — 4 usuários OAuth dos agentes (Decisão #61 + inclusão RH 11/08/2026)

**Data:** 11/08/2026
**Origem:** ADR-042 §7 (RLS) e §8 / Decisão #61 (`_DECISOES_FECHADAS.md`). **RH incluído por decisão da Aryanna em 11/08/2026** — motivo registrado abaixo.
**Executa:** Aryanna (master), no Supabase (Auth + SQL Editor) / Lovable. **Nenhum agente cria a si mesmo.**
**Depende de:** PR #44 mergeado (funções `SECURITY INVOKER` + RLS já valendo). **Para o RH, também:** a migração de pré-requisito da §0.
**Bloqueia:** Fase 0 (recarga) — os agentes só escrevem depois que os usuários/roles existirem.

---

## 0. Pré-requisito só do RH — papel `rh` (migração à parte)

> **Por que o RH entrou agora:** hoje o RH depende de uma única pessoa que acumula duas funções e **está de saída** — o conhecimento sai com ela. Reservar já a identidade + auditoria do agente RH é o primeiro passo para tirar essa dependência. **Atenção honesta:** o que de fato assume o trabalho dela (folha, benefícios, ASO, escala) são **ferramentas de escrita de RH da Onda 3**, que ainda não existem. Criar o usuário agora **não** substitui a pessoa; prepara o terreno e para de sangrar auditoria. O alívio real depende de priorizar a Onda 3 de RH (ver §5).

O agente RH precisa de um papel próprio — dar-lhe `financeiro` seria over-privilege (RH podendo faturar). Não existe `rh` no enum `app_role` ainda. **Antes de criar o `claudio.rh@`, aplicar esta migração** (arquivo próprio `supabase/migrations/<timestamp>_<uuid>.sql`, PR separado do #44):

```sql
-- Papel do agente de RH. Aditivo, idempotente, sem DROP/RENAME.
alter type public.app_role add value if not exists 'rh';
```

E, para o agente RH conseguir dar baixa nos alertas do seu setor, incluir `rh` no mapa de `fn_resolve_alert` (troca cirúrgica de uma linha — o `recipient='rh'` hoje mapeia só para `financeiro`):

```sql
-- dentro de fn_resolve_alert, no CASE v_alert.recipient:
--   when 'rh' then array['master','diretor','financeiro','rh']::public.app_role[]
-- (só acrescenta 'rh' ao array; resto do corpo idêntico)
```

> `alter type ... add value` não roda dentro de bloco de transação com o valor já em uso na mesma transação — por isso vai em migração própria, **antes** da que altera a função. Mantém a regra: um arquivo, nome `timestamp_uuid`, zero DROP/DELETE/RENAME.

> **Princípio que rege tudo aqui:** papel **mínimo**, um por agente, nada além. As funções são `SECURITY INVOKER` sob RLS — agente sem o papel certo é **corretamente recusado** pelo banco. É a auditoria (`event_log.actor_id`) que fica verdadeira: o que o agente fez ≠ o que a Alcione fez. Sem usuário compartilhado, sem login humano nos agentes.

---

## 1. Os três usuários

| Agente | E-mail (login OAuth) | Papel único (`app_role`) | Por que esse papel |
|---|---|---|---|
| **Financeiro** | `claudio.financeiro@<domínio-AG>` | `financeiro` | `invoices`/`receipts`/`receipt_allocations` têm RLS de INSERT = `master, diretor, financeiro`. Sem `financeiro`, `create_titulo` e `register_recebimento` falham (é o comportamento correto). |
| **Comercial** | `claudio.comercial@<domínio-AG>` | `comercial` | `leads` tem RLS de escrita = `master, diretor, comercial, financeiro`. `comercial` é o mínimo para `update_lead_status`. |
| **Operacional** | `claudio.operacional@<domínio-AG>` | `operacional` | `project_status_history` tem RLS = `master, diretor, operacional, sala_tecnica, financeiro`. `operacional` é o mínimo para `update_execution_status`. |
| **RH** | `claudio.rh@<domínio-AG>` | `rh` *(novo — §0)* | Papel próprio, mínimo. **Nesta leva só resolve alerta `recipient='rh'`** (após a migração da §0). As ferramentas de escrita de RH (folha/benefícios/ASO/escala) são Onda 3 — ver §5. |

**Domínio:** use um domínio que você controla (ex.: o mesmo dos e-mails da AG). O e-mail é só identidade de login — não precisa de caixa postal ativa, mas precisa ser único e não colidir com humano.

### Quem resolve qual alerta (consequência do papel — `fn_resolve_alert`)
- **Financeiro** resolve alertas com `recipient` = `financeiro`. (Alerta `entrega_concluida` = "Emitir NF" **não** se baixa direto — Decisão #62; ele fecha sozinho quando o Financeiro roda `create_titulo`.)
- **Comercial** resolve `recipient` = `comercial`.
- **Operacional** resolve `recipient` = `operacional`.
- **RH** resolve `recipient` = `rh` — **somente depois** da migração da §0 (que cria o papel `rh` e o inclui no mapa de `fn_resolve_alert`). Sem ela, o `claudio.rh@` fica sem poder de baixar nada, o que é o comportamento correto até o pré-requisito subir.
- Alertas de `sala_tecnica` e `diretoria` **não** têm agente nesta leva. Não dê esses papéis aos agentes.

---

## 2. Passo a passo (por agente — repetir 4×)

Faça um de cada vez e valide antes de ir para o próximo. **O `claudio.rh@` só depois de aplicada a migração da §0.**

### 2.1 Criar o usuário no Supabase Auth
- Supabase → **Authentication → Users → Add user** (ou o fluxo de convite).
- E-mail = o da tabela acima. Senha: gere uma **forte e única** e guarde no gerenciador de senhas (essa é a credencial que o cliente MCP do agente vai usar para logar). **Marque como confirmado** (sem precisar de clique em e-mail).
- ⚠️ **Não** entre com essa senha em lugar nenhum a meu pedido — quem define e guarda a senha é você.

### 2.2 Garantir a linha em `profiles`
Pode ser que o trigger de signup já crie a `profiles`. Confira no SQL Editor:
```sql
-- troque o e-mail
select id, email, full_name from public.profiles where email = 'claudio.financeiro@<domínio-AG>';
```
Se **não** existir, crie usando o id do auth.users:
```sql
insert into public.profiles (id, email, full_name)
select id, email, 'Cláudio — Agente Financeiro'
from auth.users
where email = 'claudio.financeiro@<domínio-AG>'
on conflict (id) do nothing;
```

### 2.3 Atribuir **exatamente um** papel em `user_roles`
```sql
-- Financeiro
insert into public.user_roles (user_id, role)
select id, 'financeiro'::public.app_role
from auth.users where email = 'claudio.financeiro@<domínio-AG>'
on conflict do nothing;
```
Repita trocando e-mail + papel para `comercial`, `operacional` e — após a §0 — `rh`:
```sql
-- RH (só funciona depois de 'rh' existir no enum — §0)
insert into public.user_roles (user_id, role)
select id, 'rh'::public.app_role
from auth.users where email = 'claudio.rh@<domínio-AG>'
on conflict do nothing;
```

**Confira que não sobrou papel a mais** (o trigger de signup pode ter dado um papel default):
```sql
select u.email, array_agg(r.role) as papeis
from auth.users u
left join public.user_roles r on r.user_id = u.id
where u.email like 'claudio.%@<domínio-AG>'
group by u.email;
```
Esperado: **um** papel por agente, e **exatamente** o da tabela. Se aparecer outro (ex.: um default), remova o extra — cada linha errada é permissão que o agente não deveria ter.

### 2.4 Confirmar que o agente NÃO está em `employees`
Agente é como a diretoria (Princípio #7): entra em `profiles` + `user_roles`, **nunca** em `employees`.
```sql
select e.id from public.employees e
join auth.users u on u.email = 'claudio.financeiro@<domínio-AG>'
-- ajuste o join conforme o vínculo real; o esperado é: ZERO linhas
where e.email = u.email;
```

---

## 3. Ligar cada agente ao MCP `ag-central-flow`
- O servidor MCP é o **mesmo** já usado pelas ferramentas de leitura (`list_projects`, `list_clients`, …). A autenticação é OAuth contra o Supabase Auth do projeto (`auth.oauth.issuer`, audiência `authenticated`) — ver `src/lib/mcp/index.ts`.
- No cliente de cada agente (Cláudio), configure a conexão ao MCP e faça o **login OAuth com o e-mail/senha do próprio agente** (2.1). O agente passa a operar sob a RLS desse usuário.
- Cada agente usa **só** a sua credencial. Nunca a sua (master) nem uma compartilhada.

---

## 4. Verificação de aceite (rodar após ligar os 3)
- [ ] **Financeiro cria título:** logado como `claudio.financeiro@`, `create_titulo` num projeto retorna `criado: true`. Como `claudio.comercial@`, o mesmo `create_titulo` retorna **erro de permissão** (RLS). ✅ é o comportamento esperado.
- [ ] **Comercial move lead:** `claudio.comercial@` roda `update_lead_status` (ex.: → `em_negociacao`) com sucesso. `claudio.operacional@` na mesma chamada é recusado.
- [ ] **Operacional move status:** `claudio.operacional@` roda `update_execution_status` (ex.: → `em_campo`) com sucesso.
- [ ] **RH (após §0):** `claudio.rh@` resolve um alerta `recipient='rh'` com sucesso e é recusado em `create_titulo` (não tem papel financeiro). Antes da §0, `claudio.rh@` é recusado em tudo — o esperado.
- [ ] **Alerta por setor:** cada agente resolve alerta do seu `recipient` e é recusado em alerta de outro setor.
- [ ] **Auditoria verdadeira:** cada chamada bem-sucedida grava `event_log` com `actor_id` = o usuário do agente (não a Alcione, não a master) e `context.canal = 'mcp'`.
- [ ] **Papel mínimo:** a query de 2.3 mostra exatamente um papel por agente; nenhum é `master`/`diretor`; nenhum está em `employees`.

---

## 5. O que ainda falta para o RH resolver o problema real (Onda 3)

Criar o `claudio.rh@` reserva identidade + auditoria, mas **não assume o trabalho** da pessoa que está saindo. Para isso faltam as **ferramentas de escrita de RH** — que ainda não existem e precisam de ADR próprio:

- **Captura do que a pessoa faz hoje** — antes de ela sair, mapear as duas funções que ela acumula em processos/entregáveis. Isso é o que vira requisito das ferramentas; sem isso, o conhecimento sai com ela. **É o item mais urgente e independe de código.**
- **Ferramentas de escrita de RH (Onda 3):** folha mensal, benefícios (Alelo/VEM), escala, admissão/desligamento, ASO/exames. Cada uma passa pelo gate Engine vs. CRUD e por uma função SQL própria — mesmo padrão do ADR-042.
- **Papel `rh`** já terá sido criado (§0); as RLS das tabelas de RH incluirão `rh` quando essas ferramentas subirem.

**Recomendação:** abrir o ADR da Onda 3 de RH agora, com prioridade, justamente pela saída da pessoa. Este worklist entrega o usuário; o ADR entrega o que tira a dependência.

### Ainda fora do escopo
- Agentes de **Sala Técnica** e **Documentação** — e os papéis correspondentes. Não criar agora.
- Nenhum agente recebe `master` ou `diretor`. Se um fluxo futuro exigir mais permissão, isso é decisão nova (ADR), não um papel a mais dado por conveniência.
