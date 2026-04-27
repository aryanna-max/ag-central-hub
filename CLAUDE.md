# SISTEMA AG — CLAUDE.md v14.1

**Versão:** 14.1 (delta 27/04/2026 — ADR-041 Compliance Cockpit aceito, decisão #56; P13 + P14 sobre seed/migrations adicionados)
**Substitui:** v11 (que estava neste arquivo até agora) e v14 base (21/04/2026)
**Supabase:** bphgtvwgsgaqaxmkrtqj
**Lovable:** e5b79b44-8865-4599-b013-f3e91865a8f0 (modo auto-apply ATIVO)
**GitHub:** aryanna-max/ag-central-hub
**Último commit main:** atualizar conforme estado real ao mergear este PR

> Este arquivo é **curto de propósito.** Detalhes ficam na máquina local da Aryanna em `Sistema AG/ARQUITETURA/` (não versionado neste repo).
> Para Code nuvem: as regras críticas estão neste arquivo. Aryanna cita caminhos `Sistema AG/...` quando precisar abrir documentação detalhada.

---

## OBJETIVO PRINCIPAL

O sistema existe para resolver três problemas concretos:

1. **Nada é rastreado entre setores** — informação não persiste, decisões somem.
2. **Setores não falam a mesma língua** — mesmo dado com cinco versões.
3. **Tempo perdido em planilhas múltiplas** — Marcelo 7, Alcione 5.

Entregas obrigatórias: zero planilhas operacionais, rastreabilidade completa, linguagem única, contingência offline.

---

## PRINCÍPIOS FUNDAMENTAIS

1. **CLIENTE é o centro do sistema.** Projetos são filhos do cliente. (Decisão 07/04/2026 — pendente de implementação.)
2. **Mais recente ≠ melhor.** Sempre consultar histórico antes de refazer um módulo.
3. **Não construir lógica nova via Lovable sem planejamento prévio.** Lovable é UI sobre arquitetura decidida.
4. **Toda referência = FK, nunca texto livre. (Decisão #55 — regra máxima)** Tudo enumerável vira tabela-domínio ou enum. Texto livre só para notas/descrições genuínas.
5. **Sintoma frequente é sinal de arquitetura ruim.** Corrigir sintoma sem corrigir raiz cristaliza bagunça.
6. **Uma decisão por vez, registrada antes de implementar.**
7. **Diretoria não é funcionário.** Papéis e entidades distintas.
8. **Dados de seed em migration ≠ verdade operacional. (P13)** INSERTs de exemplo são fixtures. Confirmar contra fonte primária antes de citar como fato.
9. **Migrations não populam dados operacionais. (P14)** Schema sim. Dados operacionais entram via documento de captura preenchido pelo dono do domínio (Alcione, Marcelo, etc.) ou via UI quando o sistema estiver pronto. Code recusa migration com `INSERT INTO <tabela_operacional>`.

---

## CRITÉRIOS DE DECISÃO (três testes)

Toda decisão passa por:

1. **Teste de negócio** — aproxima ou afasta dos objetivos A-G?
2. **Teste de débito técnico** — reduz ou aumenta débito?
3. **Teste raiz vs sintoma** — resolve causa ou tampa buraco?

**Regra de parada:** se alguma resposta é "não sei" → **PARAR e planejar antes de implementar.**

---

## FLUXO DE TRABALHO

**Pipeline real, confirmado 21/04/2026:**

### Quem faz o quê

| Ferramenta | O que faz | O que Aryanna faz |
|---|---|---|
| **Cowork (Claude desktop)** | Pensa arquitetura, escreve docs em `Sistema AG/`, gera prompt pro Code | Conversar, decidir |
| **Claude Code nuvem** | Escreve `.sql`/`.tsx`/`.ts`, branch nova, push, abre PR draft | Colar prompt do Cowork |
| **GitHub** | Repo + PRs + branch protection (main protegida) | Mergear PR (1 clique) |
| **Lovable** | App rodando + **aplica migration auto** quando arquivo novo entra em `supabase/migrations/` no main + regenera `types.ts` | Conferir preview |
| **Lovable SQL Editor** | Aplicação manual de SQL (emergência ou hotfix) | Colar e rodar |

### Regras invioláveis do fluxo

- ❌ Code **NÃO** pusha direto em `main` (branch protegida — corretamente)
- ❌ Cowork (Claude desktop) **NÃO** mexe em código do repo — só docs em `Sistema AG/` (pasta local)
- ❌ Aryanna **NÃO** precisa abrir SQL Editor manualmente — Lovable aplica auto
- ✅ Code **sempre** abre PR draft, nunca push em main
- ✅ Migration sensível (DROP, DELETE, RENAME COLUMN): Code escreve, Aryanna lê o `.sql` antes de mergear
- ✅ Bug fix simples: Aryanna mergeia sem ler

### Antes de mergear PR (checklist 30 segundos)

1. Ver título do PR — bate com o que pediu?
2. Ver lista de arquivos alterados — quantos? Se >10 e não pediu refactor grande, parar.
3. Se tem `.sql` em `supabase/migrations/`: abrir e procurar `DROP`, `DELETE FROM`, `TRUNCATE`. Se tiver, perguntar pra Aryanna antes de mergear.
4. Se tem `INSERT INTO` em migration tocando tabela operacional (`company_documents`, `clients`, `employees`, `projects` etc.): **VIOLAÇÃO P14** — recusar e abrir issue pedindo documento de captura.
5. Se nada disso → mergear.

---

## ARQUITETURA CANÔNICA (norma vigente)

| ADR | O quê | Decisão # |
|---|---|---|
| **ADR-040** | Matriz 7 Camadas × 8 Módulos. Norma vigente. Cockpits navegacionais ≠ módulos da matriz (nota 27/04). | #54 |
| **ADR-041** | Compliance como cockpit `/compliance` top-level transversal. Bloco 1: estrutura nova de rotas. | #56 |
| ADR-039 | Superseded — 7 Ondas incorporadas ao ADR-040 | — |

ADRs completos vivem em `Sistema AG/ARQUITETURA/` (local da Aryanna).

---

## ESTADO ATUAL (21/04/2026, atualizado 27/04 com errata PCMSO)

| Módulo | % | Obs. |
|---|---|---|
| Negócios | 95% | Leads kanban+lista+CRUD, Propostas completo, Clientes diretório. ⚠️ Leads — versão antiga mais funcional (revisar) |
| Campo | 90% | Dashboard, Escala, RDF Digital, Despesas 3 abas, Encontro de Contas, Férias auto-sync. Escala mobile **CONGELADA** |
| Prancheta | 90% | Kanban, Equipe+carga, Tarefas, Alertas. NUNCA vê financeiro |
| Faturamento | 85% | Dashboard 5 abas, billing_type. ⚠️ Bug 5 crítico: Alcione nunca recebeu email de aprovação externa |
| Projetos | 95% | Kanban drag-drop, Dashboard, Histórico |
| Pessoas | 60% | CRUD+CSV, Férias, Ausências, Compliance, Cargos (33), 32 campos Fase 3B. ⏳ UI Folha Mensal pendente |
| Radar | 90% | KPIs, alertas, visibilidade por role. ⚠️ Cliente como centro NÃO implementado |
| Base | 90% | Usuários, cadastros, configurações |

**Números:** 45 tabelas, 27 hooks, 60+ páginas. Marco Zero 31/03/2026.

---

## FILA DE EXECUÇÃO

| # | O que | Prioridade | Status |
|---|---|---|---|
| Limpar seed `company_documents` | Migration corretiva (errata PCMSO) | 🟡 ALTA | Prompt pronto |
| ADR-041 Bloco 1 | Estrutura `/compliance/*` + `/base/governanca` (rotas vazias + sidebar) | 🟡 ALTA | Prompt pronto |
| Bug 5 (enqueue_email) | Corrigir + log em email_send_log | 🔴 CRÍTICO | Aguarda decisão Aryanna |
| ADR Responsabilidades | Migration `project_participations` + triggers + refactor | 🟡 ALTO | Prompt engatilhado |
| Folha Mensal UI | Sessão planejamento + implementação | 🟡 ALTO | Simples vs sofisticada em aberto |
| Medições | Refazer módulo (3 modelos + FK) | 🟡 ALTO | Prompt pronto |
| Cleanup `as any` | Remover ~84 casts (Sprints 1-3) | 🟡 ALTO | Aguarda confirmação bugs cat3 |
| Leads redesenho | Sessão dedicada após análise versão original | 🟡 ALTO | Pendente |
| Radar centrado em CLIENTE | Resgatar decisão 07/04 | 🟡 ALTO | Pendente |
| Fase 4 | Arq. Comercial (Proposta→OS→Projeto) | 🟡 ALTO | SQL escritos |
| Fase 5-6 | Email Financeiro, Contas a Pagar | 🔵 MÉDIO | — |
| ADR-041 Bloco 2 | Migração de conteúdo `/rh/compliance/*` → `/compliance/*` | 🔵 MÉDIO | Aguarda Bloco 1 |
| Escala mobile | Revisão | 🚫 CONGELADA | Não revisar agora |

---

## REGRAS CRÍTICAS — NÃO ERRAR

### Banco

- ❌ Não existe role `rh_financeiro` — usar `financeiro`
- ❌ Não existe `campo_pausado` nem `proposta_aprovada` no `execution_status`
- ❌ Não usar `set_updated_at()` nem `handle_updated_at()` — usar **`update_updated_at_column()`**
- ❌ Não usar Supabase MCP (não disponível em nenhum Code)
- ❌ Diretoria (Aryanna, Sérgio, Ciro) NÃO entra em `employees` — só `profiles` + `user_roles`
- ❌ **Migration com INSERT em tabela operacional = VIOLAÇÃO P14.** Recusar e abrir issue.
- ✅ `projects.codigo` (não `code`)
- ✅ Alertas: `message`, `recipient`, `reference_id`, `action_url`
- ✅ `priority`: `urgente` | `importante` | `informacao`
- ✅ **Toda referência = FK, nunca texto livre (Decisão #55)** — enums e tabelas-domínio para tudo enumerável.
- ✅ `types.ts` é regenerado automaticamente pelo Lovable após cada merge de migration em `main` — nunca editar à mão.

### Frontend

- ❌ Não usar nomes pessoais em strings de código
- ❌ Não usar "OBRA" — sempre "PROJETO"
- ❌ Não criar tabela clientes por módulo — `clients` é fonte única
- ❌ Zero `as any` em código novo (critério de aceite de PR)
- ✅ Uma seção por vez no Lovable, confirmar antes de avançar

### Code

- ✅ **Sempre** branch nova, **sempre** PR draft
- ✅ Operação destrutiva (DROP, force-push, reset --hard) → perguntar antes
- ✅ Build local antes de commit (Code local) — quando aplicável
- ✅ Acompanhar PR após criar (Code nuvem) — reagir a CI failures
- ✅ Se prompt do Cowork pedir migration que viola P14 (INSERT operacional), recusar e abrir issue solicitando documento de captura

---

## PESSOAS-CHAVE

| Pessoa | Role | Módulo | Notas |
|---|---|---|---|
| Aryanna | master | Admin/Base | Sócia, não em `employees`, único CAU/CREA |
| Sérgio (sócio) | diretor | Radar/Negócios | Sócio, não em `employees` |
| Ciro | diretor | Radar/Negócios | Sócio, profile pendente |
| Marcelo | operacional | Campo | — |
| Emanuel Macedo | sala_tecnica | Prancheta (líder) | Mat 000133 |
| Diego | sala_tecnica | Prancheta (suplente) | — |
| Jonatha | sala_tecnica | Prancheta (técnico) | — |
| Alcione | financeiro | Faturamento/Pessoas | Consulta + alertas email |

Não confundir: Sérgio sócio ≠ Sérgio Gonzaga Jr (funcionário CLT, mat 000038, Relações Públicas).

---

## BUGS CRÍTICOS ABERTOS

1. **Bug 5 — `enqueue_email` em `AprovacaoExterna.tsx:104-111`**
   RPC com parâmetros errados (`p_to, p_subject, p_body` vs assinatura real `queue_name, payload`). Try/catch engole erro. **Alcione nunca recebeu email de aprovação externa desde sempre.**
   Correção: padrão de `supabase/functions/send-financial-alert/index.ts` + log em `email_send_log`.

2. **Cliente como centro** — decisão 07/04/2026 tomada, não implementada.

3. **Diretoria ainda em `employees`** — Sérgio + Aryanna precisam DELETE. Ciro precisa profile criado.

4. **UI Folha Mensal** — Alcione não tem tela para rodar Encontro de Contas mensal.

5. **Seed errado em `company_documents`** — 5 linhas falsas (PCMSO Gonzaga "vencido" inventado pelo Code, mas PCMSO sempre esteve dentro da vigência). Migration corretiva pendente. Errata em `Sistema AG/ARQUITETURA/_ERRATA_PCMSO_27ABR.md` (local).

---

## VERSÃO E HISTÓRICO

- **v14.1** (27/04/2026) — Delta: ADR-041 Compliance Cockpit aceito (#56). Princípios P13 + P14 adicionados após errata PCMSO. Pasta `Sistema AG/ARQUITETURA/` permanece local (não versionada no repo).
- **v14** (21/04/2026 — noite) — Corrige fluxo de ferramentas. Code não pusha main. Lovable aplica auto. ADR-040 aceito (#54).
- **v13** (21/04/2026 — tarde) — Enxuto. Detalhes migrados pra `ARQUITETURA/`.
- **v12** (21/04/2026 — manhã) — Consolidado pós Fase 3B, ADR Responsabilidades, Bug 5, 286 `as any`.
- **v11 Git** (PR #10, `0c33a2e`) — 452 linhas, 26 decisões + BPMN + Arquitetura Comercial 08/04. Estava neste arquivo até este PR.
- **v11 local** — tinha benefícios + encontro de contas detalhados.
