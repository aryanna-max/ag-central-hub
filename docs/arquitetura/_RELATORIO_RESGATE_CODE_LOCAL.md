# Relatório — Resgate de sessões do Code local

**Data:** 2026-04-21
**Executado por:** Claude Code local (sessão 449ddfb8) via 5 subagents em paralelo

## Números

- Sessões encontradas: **12**
- Sessões 🔴 EXTRAIR: **7** (544c0f7e, c4e22b41, 12f31974, 20051cb3, 6f4fdccf, 9c5ee04e, 9421f5de)
- Sessões 🟡 PARCIAL: **0** (todas caíram em 🔴 ou 🟢 após leitura)
- Sessões 🟢 IGNORAR: **4** (4b4488f1 duplicata, c556339c inventário mecânico, 730e92d8 só verificação, 31f557af git status)
- Sessão atual: **1** (449ddfb8 — este resgate)
- **Decisões novas** adicionadas em `_DECISOES_FECHADAS.md`: **12** (#39 → #50)
- Arquivos criados em `_RESGATE_CODE_LOCAL/`: **9** (um por sessão não-atual, inclui as IGNORAR com justificativa)

## O que foi resgatado (resumo das decisões mais importantes)

**Modelo de dados e nomenclatura (estavam só no chat):**
- `cnpj_tomador` fica separado de `clients.cnpj` — SPEs da Direcional/Colorado têm CNPJ próprio (decisão #3 já documentada, confirmada).
- Dual status `project_status` + `execution_status` em paralelo — nenhum substitui outro.
- Lead = snapshot histórico; após conversão, cliente e projeto são fontes independentes, alterações no lead NÃO propagam.
- Convenção de códigos canônica consolidada: cliente 3 letras / projeto `ANO-SIGLA-SEQ` / proposta `ANO-P-SEQ` / folha `ANO-SEQ` / BM `BM-{PROJ}-NN` **por projeto, não global** (#40).
- Marco Zero via `is_legacy=false`, não filtro por data — imports rodaram em abril e quebram qualquer corte temporal (#39).

**Regras operacionais novas:**
- **Dois fluxos de benefícios** (#42): semanal (Café/Almoço/Jantar → Encontro → desconto na folha) vs mensal (Alelo/VT → Thyalcont via relatório dia 26). Misturar quebra ambos.
- **Transporte é RH, não Marcelo** (#43): enum `vt_cartao|dinheiro|nenhum`; subtipo `integral|complemento`; valores em `system_settings`.
- **Medições = fonte única Marcelo** (#44): FaturamentoMedicoes.tsx ficou read-only, Alcione só Registra NF e Confirma Pagamento.
- **Período BM por intervalo de datas** (#41), não mês+ano.
- **BRK é exceção, não padrão** (#45): compliance leve por default, complexidade por cliente via `client_doc_requirements`.
- **Sistema por CARGO (raias BPMN), não pessoa** (#46): Alcione ocupa 3 cargos hoje, mas permissões/alertas são por cargo.
- **Cliente como HUB central** (#47): confirma decisão 07/04, ainda não implementada no código.
- **`ag_topografia` removido do select faturador** (#48): só `gonzaga_berlim`/`ag_cartografia` emitem NF.
- **Diretoria mobile-first** (#49) + **Alcione email-first com sistema secundário** (#50).

**Bugs históricos documentados (contexto que somem sem este resgate):**
- Rebuild 20/03 (commit `85cd923`) **deletou** `field_payments`, `field_payment_items`, `benefit_rules` — `project_benefits` virou tabela órfã. (Sessão 20051cb3.)
- Trigger correta: `update_updated_at_column()`. `set_updated_at()` e `handle_updated_at()` **não existem** no banco — erro vivido ao rodar migration de `benefit_settlements`.
- 14 leads marcados `perdido` agressivamente pela migration `20260417_limpeza_dados_legado.sql` (critério frágil `client_id IS NULL`) — revertidos manualmente. 3 leads ambíguos em `novo` para decisão manual via Kanban (Polyana/Arq Polyanna, Tiago Alan/Tecnoind, Irmão João Arimatea/Arautos).
- **PR #6 (Fase 3B) quebra build**: `Funcionarios.tsx` importa `AdmissaoWizard` e `DesligamentoDialog` de `@/components/rh/` — arquivos inexistentes. Resolução: criado branch `fase3b-migration-only` com só a migration, sem UI.
- `CREATE POLICY` não-idempotente — erro `policy "Auth full access mi" already exists` virou ruído recorrente.
- Gran Alpes historicamente mal-classificado; SESI/PE não casou em import por travessão vs hífen.

**Restrições aprendidas:**
- Claude Code **não tem** MCP Supabase nem `SUPABASE_ACCESS_TOKEN` nem `service_role`. Anon key não faz DDL. CLAUDE.md dizia "fazer via GitHub" — verdade, mas só para migrations. Para SELECT/diagnóstico, depende de tokens não disponíveis hoje.
- Fonte de verdade quando MDs divergem = **código do repositório** (migrations + `types.ts`), não documentos.
- Branch protection ativa em `main` — PRs são obrigatórios.
- Ciclo V2→V3→CONSOLIDADA das sessões 20051cb3/4b4488f1 produziu confusão; Aryanna acabou descartando V3 inteiro — sinal pra evitar múltiplas versões paralelas de ARQUITETURA.md.

## O que ficou aberto / pendente após resgate

1. **Cliente como HUB (#47)** — decidido 07/04, confirmado 15/04, ainda NÃO implementado. Bug crítico ativo em CLAUDE.md.
2. **3 leads ambíguos `novo`** — decisão manual pendente via Kanban (Polyana, Tiago Alan, Irmão João Arimatea).
3. **`external_code` em `measurements`** — previsto mas não implementado. Clientes Engeko e HBR continuam sem código externo rastreável.
4. **Alertas reativos de medição** — triggers + cron pendentes (hoje medições não disparam alerta automático ao vencer prazo).
5. **Consolidação de duplicatas em `clients`** — apareceu como pendência em 12f31974, não fechada.
6. **Unificação dos 2 CRUDs de cliente** — duas telas de cadastro ainda coexistem.
7. **Fase 3 parte C-D** (Folha Benefícios Mensal UI + sidebar/rota) — SQL escrito, implementação travada. Alcione segue sem tela de Encontro de Contas mensal.
8. **Almoxarife = Alexandre mat 000116** — correção de atribuição pendente quando houver UI de cargos.
9. **Ciclo V3 descartado** — ARQUITETURA/ atual precisa confirmar que incorpora o V2 puro (sem código existente), não o V3 híbrido.

## Omissões por sensibilidade

- **Telefones e emails de leads** (sessão 6f4fdccf, INSERT de ~10 leads novos) mascarados como `[OMITIDO]` no arquivo de resgate. Os dados originais permanecem no banco e no JSONL.
- Nenhuma senha/token encontrado nos transcripts.
- Salários específicos de funcionários não apareceram detalhadamente (aparece só em menções de enum `tipo_contrato` e `salario_base NUMERIC`, sem valores).

## Recomendações pra próxima fase

**Migrar pra Code nuvem agora? → SIM, com reservas.**

**A favor:**
- Histórico crítico está resgatado em markdown — qualquer Claude futuro lê do repo, não depende do JSONL local.
- 12 decisões (#39-#50) que viviam só no chat agora estão em `_DECISOES_FECHADAS.md`.
- Sessões grandes (544c0f7e, c4e22b41) tinham 4 summaries automáticos cada — já estavam estouradas de contexto; continuar localmente não é sustentável.
- Code nuvem dá acesso a MCPs (incluindo Supabase) que o local não tem hoje.

**Reservas:**
- **Confirmar antes de migrar** que estes 9 arquivos de resgate estão commitados (ou ao menos em disco fora do .claude/projects) — se a Aryanna reset do profile local, o JSONL some mas o markdown fica.
- Os 5 JSONL grandes (~90 MB total) em `C:\Users\aryan\.claude\projects\` devem ser **arquivados manualmente** (zip + mover para fora do .claude) antes de qualquer limpeza de perfil. Eles são fallback caso o resgate markdown tenha lacuna.

**Tópicos que precisam sessão dedicada com Aryanna para fechar:**
- Cliente como HUB — implementação (decisão tomada, não materializada).
- Unificação dos 2 CRUDs de cliente.
- Folha Mensal UI (decisão simples vs sofisticada ainda em aberto, per CLAUDE.md fila).
- Medições — ADR formal para alertas reativos (triggers + cron).
- Leads — redesenho (CLAUDE.md diz "versão antiga mais funcional — revisar").

## Pasta do resgate

- Inventário: [`_INVENTARIO_SESSOES_CODE_LOCAL.md`](_INVENTARIO_SESSOES_CODE_LOCAL.md)
- Resgates por sessão: `_RESGATE_CODE_LOCAL/sessao_*.md` (9 arquivos)
- Decisões consolidadas: [`_DECISOES_FECHADAS.md`](_DECISOES_FECHADAS.md) — entradas #39 a #50 são as adicionadas neste resgate

## Lista dos arquivos de resgate

| Arquivo | Tamanho | Classificação |
|---|---|---|
| `sessao_544c0f7e_sistema_ag_marco_zero.md` | 15 KB | 🔴 21 decisões resgatadas |
| `sessao_c4e22b41_sistema_ag_fase1_encontro_contas.md` | 16 KB | 🔴 Dual status, billing_type, alert_recipient, rebuild Faturamento |
| `sessao_12f31974_fase2_compliance.md` | 12 KB | 🔴 Fase 2 + refactor Medições + limpeza legado + cleanup VT |
| `sessao_20051cb3_diagnostic_cleanup.md` | 9.6 KB | 🔴 Auditoria 12h, CARGO vs pessoa, BRK exceção, arqueologia rebuild 20/03 |
| `sessao_6f4fdccf_leads_inserts_abr16.md` | 7.7 KB | 🔴 Duplo fluxo benefícios, transporte = RH |
| `sessao_9c5ee04e_continuacao_fase2_fase3b.md` | 5.9 KB | 🔴 Revert leads, migration measurements, código BM reformulado |
| `sessao_9421f5de_fase3b_aplicar_pr6.md` | 5.2 KB | 🔴 Bug bloqueante PR #6, branch alternativo, limites reais de acesso |
| `sessao_4b4488f1_teleport_abr21.md` | 2.3 KB | 🟢 Quase duplicata de 20051cb3 |
| `sessao_730e92d8_verificacao_fase3.md` | 1.9 KB | 🟢 Só verificação, sem decisão nova |
