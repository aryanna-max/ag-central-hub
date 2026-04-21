# Sessão Code local — 544c0f7e — SISTEMA AG (Marco Zero → 15/04)

**Origem:** `C:\Users\aryan\.claude\projects\C--Users-aryan-Documents-Claude-Projects-Sistema-AG\544c0f7e-b556-4f6c-87bc-6a02d24748fb.jsonl`
**Período:** 2026-03-31T02:34Z → 2026-04-15T18:40Z
**Volume:** 3742 linhas JSONL, 32 MB, 1146 mensagens user / 1761 assistant
**Dias ativos:** 31/03 (841), 02/04 (548), 03/04 (1176), 11/04 (715), 15/04 (449)

Sessão fundacional — cobre o **Marco Zero (31/03/2026)**, as fases 0-4 do SQL de reestruturação, toda a negociação do modelo `billing_type`, o mapeamento SPE→cliente da Direcional e decisões de UX da sidebar/menus em 03/04. A decisão "CLIENTE é o centro" NÃO ocorre neste transcript — deve vir de sessão de 07/04 em outro lugar.

Bom pedaço do transcript são **summaries de compactação geradas automaticamente** (a sessão estourou contexto várias vezes). Essas summaries funcionam como ata oficial das decisões.

---

## Decisões tomadas

1. **Usar Supabase existente do Lovable (bphgtvwgsgaqaxmkrtqj), nunca criar novo projeto.**
   Literal: "NAO VOU UTILIZAR NOVO SUPABASE, QUERO FAZER TUDO NO EXISTENTE". Supabase MCP não tem acesso — tudo via GitHub `types.ts` (fonte de verdade) + SQL colado no editor Lovable.

2. **Schema v3 não é sagrado.** "JA VALIDADA NAO QUER DIZER MELHOR PQ FUI CRIANDO SEM PLANEJAR" — avaliar regras existentes criticamente, não preservar cegamente.

3. **`cnpj_tomador` FICA em projects** (separado de `client.cnpj`).
   Razão: tomador = entidade contratante (pode ser SPE/subsidiária), cliente = relação comercial. "UM CLIENTE PODE TER VARIOS PROJETOS, CNPJ DO TOMADOR DO PROJETO PODE NAO SER O DO CLIENTE". Decisão central do modelo de dados.

4. **Dual status em paralelo: `project_status` + `execution_status`.**
   Nenhum substitui o outro. 6 valores (planejamento/execucao/entrega/faturamento/concluido/pausado) + 10 valores (aguardando_campo → pago). Cada módulo tem kanban parcial diferente — não existe kanban único compartilhado.

5. **Lead = snapshot histórico.** Após conversão, cliente e projeto são fontes independentes. Histórico via JOINs (`leads.client_id`, `leads.converted_project_id`, `projects.lead_id`). Alterações em lead convertido NÃO propagam. Literal: "é importante que a historia do cliente carregue tudo e o projeto tb."

6. **Proposta NÃO precisa código do cliente.** Formato final: `ANO-P-SEQ` (ex `2026-P-001`) — sequencial único por ano, reseta em janeiro. Simplificou o antigo `ANO-SIGLA-PSEQ`.

7. **Folha de despesa = `ANO-SEQ`** (ex `2026-001`). "quanto mais simplificado melhor".

8. **Convenção de códigos canônica:**
   | Entidade | Formato | Ex |
   |---|---|---|
   | Cliente | 3 letras | BRK, COL, HBR |
   | Projeto | ANO-SIGLA-SEQ | 2026-BRK-001 |
   | Proposta | ANO-P-SEQ | 2026-P-001 |
   | Lead | ANO-L-SEQ | 2026-L-001 |
   | Folha Despesa | ANO-SEQ | 2026-001 |
   | NF / Recibo | ANO-NF-SEQ / ANO-RC-SEQ | 2026-NF-001 |

9. **Marco Zero = 31/03/2026.** Coluna `is_legacy` em daily_schedules / monthly_schedules / field_expense_sheets. Dados operacionais novos filtrados por `is_legacy = false` (abandonou filtro por data).

10. **`billing_type` (projects, text) é crítico — dispara alertas financeiros.**
    Valores: `entrega_nf` | `entrega_recibo` | `medicao_mensal` | `misto` | `sem_documento`. Alertas só disparam para nf/recibo ou na aprovação da medição. `sem_documento` = sem alerta.

11. **`alert_recipient` é por role, não por pessoa.**
    Enum corrigido: operacional | comercial | financeiro | rh | sala_tecnica | diretoria | todos. Versões anteriores tinham `alcione`, `marcelo` como valores — erro de modelagem resolvido.

12. **Alcione (Financeiro) NÃO acessa o sistema ativamente.**
    Recebe alertas por email em financeiro@agtopografia.com.br. Decisão depois refinada em 03/04: "alcione pode entrar a qualquer momento para visualizar e tirar duvidas, telas de alerta sao importantes. principlemente quando um email é enviado para ela". Ou seja: pode consultar, mas fluxo principal é email.

13. **Teams = "Grupos Rápidos"** (apenas presets, não equipes fixas).

14. **`is_vacation_override` (boolean em `daily_schedule_entries`).**
    Para quando Marcelo escala funcionário em férias como avulso/prestador. Sem benefícios, sem horas trabalhadas, modal de aviso obrigatório. "é algo totalmente por fora das regras trabalhistas, como se fosse um prestador de serviço, como posso fazer da forma mais simplificada possivel?"

15. **Sidebar colapsável** (não fixa). Recolhe para strip de ícones, estado salvo por usuário.

16. **Projetos sem lead de origem aparecem no Comercial. Propostas sem lead podem ser criadas diretamente.** (opção B em ambos).

17. **Direcional — modelo idêntico à Colorado.** 1 cliente (DIR) + múltiplas SPEs, cada uma com próprio `cnpj_tomador`. Mapa final:
    - 625P → Curado (Imperatriz)
    - 652C → Sucupira (Imperatriz)
    - 747C → Petribu (Lourdes)
    - 788C → Cerâmica (Casa Amarela)
    - 792  → Padre Cícero/Várzea (Bromélia) — faltava cadastrar como `2026-DIR-006`
    Decisão de nomenclatura: "OS DIRECIONAL QUE ESTAO SÓ CODIGO E SÓ NOME DEVEM TER AS DUAS COISAS NO NOME" → padrão "Direcional — CÓDIGO — Local (SPE)".

18. **Casa Amarela, Bromélia, Imperatriz, Lourdes são SPEs da Direcional, não clientes.** "Gameleira nao é cliente, é apenas a localização da moradia de um funcionário" (15/04) — evitar confundir endereços com clientes.

19. **Diretoria (sócios) acessam pelo celular.** "socio nao sao muito afeicoados com tecnologia e vao acessar pelo celular" — motiva UI mobile-first para Radar/Diretoria.

20. **Menu — regras de reorganização (03/04):**
    - Relatórios de Operacional movem para Financeiro
    - Clientes não é item separado do menu Comercial
    - Diárias de veículos entra dentro de Veículos (não é sublateral)
    - Férias sai de Operacional (já aparece na Escala)
    - Medições está dentro de Projetos, pode também existir em Relatórios
    - Radar: alertas recentes em cima, kanban logo abaixo; mesmo padrão em Projetos em Campo
    - Sala Técnica precisa ter visualização própria tipo "projetos em campo"
    - Kanban geral de Projetos: execução dividida entre Campo e Sala Técnica; ocultar colunas sem uso ou permitir filtros
    - "escala mensal pode se chamar planejamento" — renomear sugerido

21. **Marcelo vê valores** (operacional vê); Sala Técnica NÃO vê. Prompt anterior que dizia "Marcelo não vê valores" estava errado.

---

## Raciocínios técnicos relevantes

- **Trigger `fn_on_status_change` — bug persistente:** múltiplas versões do CLAUDE.md tinham colunas em português (`mensagem`, `destinatario_perfil`, `prioridade`, `referencia_id`, `referencia_rota`) e `NEW.code`. Corretas: `message`, `recipient`, `priority`, `reference_id`, `action_url`, `NEW.codigo`. Usar casts `'urgente'::alert_priority`, `'sala_tecnica'::alert_recipient`.

- **Colunas adicionais em `alerts`:** `tipo`, `alert_status` (default 'ativo'), `scheduled_at`, `ignored_reason`, `ignored_by_id` — permitem dedup/agendamento/ignorar.

- **`NEW.codigo` (não `NEW.code`)** em todos os triggers. Erro recorrente em 4 blocos do schema v3.

- **Clone local serve só para editar frontend** (não consome créditos Lovable). SQL sempre vai para Supabase real. "se rodar o sql vai ser no clone ou no real?" → sempre no real.

- **Types.ts é fonte de verdade.** Regeneração em Lovable roda via migration no-op.

- **Migração texto→FK (Fase 3):** `projects.responsible`, `leads.responsible`, `proposals.responsible` → `responsible_id` via match `employees.name`. Sempre verificar contagem "sem match" antes de DROP das colunas texto.

- **Tabelas DROPPED na Fase 4:** `attendance`, `schedule_confirmations`, `email_unsubscribe_tokens`. Enum `opportunity_stage` dropado. Resultado esperado: ~34 tabelas.

- **Colunas mortas removidas de `projects`:** `obra_id` (FK órfã), `client` (texto redundante), `client_cnpj` (redundante), `responsible` (redundante). `cnpj_tomador` FICA.

- **NFS-e de Aliança tem layout padrão** — permite extração automatizada (`script_extrair_nfs.py` via pdfplumber).

- **Servidor misturado:** NFs estão tanto em ADM quanto em OP porque Marcelo antes era parte financeira. Reorganização é Fase 2 (não agora).

- **Scoring sistema (em 02/04):** 5.5/10 — banco razoável, frontend desconectado (types.ts stale, Sala Técnica só placeholder, sem UI billing_type, Financeiro esqueleto).

---

## Bugs investigados

- **Bug alerts trigger** — colunas em português inexistentes. Corrigido em `SQL_5_TRIGGER.sql`.
- **`proposta_aprovada` não existia em `execution_status`** — valor referenciado em UPDATE sem existir no enum. Verificação pendente.
- **`projects.responsible` não existe** (coluna texto já removida) — erro frequente em queries antigas. "DICA: Talvez voce quisesse se referir à coluna 'p.responsible_id'".
- **`role`, `profile_id` inexistentes** — queries antigas que presumiam esquema diferente. "ACHO QUE OS PROMPTS ESTAO DESATUALIZADOS" (03/04).
- **Gran Alpes classificado errado:** eu (Claude) marquei `medicao_mensal` baseado em arquivos "MEDIÇAO GRAN ALPES", mas "MEDIÇAO" era tipo de serviço, não frequência de faturamento. Correção: `entrega_nf`. "GRAN ALPES NAO É ANTIGO FORAM SERVIÇOS ESPECIFICOS E SAO SUPER NOVOS".
- **Bromélia não atualizava** via `ILIKE '%BROMELIA%'` por causa do acento. Fix: usar `codigo = '2026-BRM-001'` direto.
- **JME e Engeko** listados como `entrega_nf` em CLAUDE2.md — corrigido para `medicao_mensal` (arquivos mensais em "ARQUIVOS MARCELO" confirmam).
- **CLAUDE2.md inteiro desatualizado** — adicionado aviso explícito em `ag-central-hub/CLAUDE.md` para ignorar os outros arquivos CLAUDE*.md.

---

## Pendências geradas

- Rodar Blocos 5-8 do `SQL_1_FASE5_COLUNAS.sql` (populate billing_type + is_vacation_override)
- `SQL_2` (Fase 3A — migrate text→FK, após validar sem-match)
- `SQL_3` (Fase 3B — drop dirty columns, só após 2 validado)
- `SQL_4` (drop attendance + schedule_confirmations)
- `SQL_5` (trigger corrigido `fn_on_status_change`)
- Regenerar types.ts em Lovable
- Frontend Prompts F1-F6 Lovable em ordem
- import_09 (daily_schedules full), import_10 (expenses — ainda comentado, precisa validar `field_expense_sheets`)
- Meu Dinheiro: manual de preenchimento (categorias, centros de custo, tags) — Alcione implementa após padronização
- Criar projeto `2026-DIR-006` (Bromélia/Padre Cícero) — faltava
- Script NF: Aryanna roda no servidor direto (não importar dados ainda)
- Decisão formal do líder da Sala Técnica — Emanuel Macedo candidato (confirmado depois em v13)
- Relatórios de medições — existiam antes, se perderam em mudanças (mencionado 11/04)

---

## Arquivos tocados / criados

- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\REVISAO\ESTADO_ATUAL.md` (master reference)
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\REVISAO\SQL_1_FASE5_COLUNAS.sql` até `SQL_5_TRIGGER.sql`
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\REVISAO\script_extrair_nfs.py` (pdfplumber, busca ADM e OP recursivamente)
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\solicitacao_cowork_nfs_2026.md`
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\PROMPTS_LOVABLE_DEFINITIVOS.md`
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\ag-central-hub\CLAUDE.md` (repo-level, autoritativo)
- `ag_schema_v3_corrigido.sql` (4 bugs corrigidos: NEW.codigo, Block 18, alerts columns, sent_at)
- `.claude/launch.json` + `start-dev.cmd` (Vite na porta 8080)
- Import SQLs 01-10 (clients/employees/vehicles/teams/team_members/leads/proposals/projects/daily_schedules/expenses)
- `gen_imports.js`
- `Cowork SQL phases 0, 0b, 1, 2, 3, 4` (executados)
- `src/integrations/supabase/types.ts` (regenerado via no-op migration)
- `src/pages/Projetos.tsx`, `src/pages/SalaTecnica.tsx`, `src/hooks/useAlerts.ts`, `EscalaDiaria.tsx`, `FaturamentoProjetos.tsx`, `FaturamentoAlertas.tsx`, `LeadConversionDialog.tsx`, `LeadDetailDialog.tsx`, `LeadFormDialog.tsx`, `useLeads.ts`, `useProposals.ts`, `useTechnicalTasks.ts`

---

## Trechos literais importantes

> "JA VALIDADA NAO QUER DIZER MELHOR PQ FUI CRIANDO SEM PLANEJAR"

> "NAO EXISTE UM PROJECTS.ID? UM CLIENTE PODE TER VARIOS PROJETOS, CNPJ DO TOMADOR DO PROJETO PODE NAO SER O DO CLIENTE"

> "proposta nao precisa ter codigo cliente. nao sei como está hj mas é importante que alterações em leads ja convertidos reflitam no cliente/projeto ou o contrario, como deveria ser? é importante que a historia do cliente carregue tudo e o projeto tb."

> "está tudo bagunçado pq está sendo colocado intuitivamente sem entender o que é nada, estamos tentando usar tags mas ainda estao sem regras e muito menos categorias, nomes de projetos, clientes ou centros de custo." *(sobre Meu Dinheiro — motiva a padronização antes de importar)*

> "nos ajustes da arquitetura do sistema vamos ter essas respostas pq os codigos vao vir de la. vamos voltar a arquitetura."

> "SE O FUNCIONARIO ESTÁ DE FERIAS EM TESE NEM DEVERIA TRABALHAR... MARCELO ESCALA ELE AS VEZES E É ALGO TOTALMENTE POR FORA DAS REGRAS TRABALHISTAS, COMO SE FOSSE UM PRESTADOR DE SERVIÇO, COMO POSSO FAZER DA FORMA MAIS SIMPLIFICADA POSSIVEL?"

> "NFS POR EXEMPLO DEVERIAM ESTAR EM ADM POIS AGORA É ALCIONE QUE FAZ MAS AINDA ESTAO EM OPERACIONAL, COMO MARCELO ERA PARTE FIN E AGORA NAO MAIS, MUITAS COISAS AINDA ESTAO MISTURADAS E NAO TEMOS EXPERIENCIA PARA REFORMULAR A ORGANIZAÇÃO DO SERVIDOR, SERÁ UMA PROXIMA ETAPA"

> "PODEMOS CRIAR UMA PASTA DE REVISAO DO SISTEMA APENAS COM OS ARQUIVOS ATUALIZADOS PARA QUE NAO SEJA NECESSÁRIO LER TUDO?" *(origem da pasta REVISAO/ESTADO_ATUAL.md)*

> "deixar diretoria bem intuitiva e visual para alertas e tomadas de decisao, socio nao sao muito afeicoados com tecnologia e vao acessar pelo celular"

> "alcione pode entrar a qualquer momento para visualizar e tirar duvidas, telas de alerta sao importantes. principalmente quando um email é enviado para ela"

> "esse modulo deve ter varias opções de relatorios e ser bem intuitivo sobre visualizacao de tarefas relacionadas a projetos. tenho que fazer tudo para que fique mais facil pra ela e para empresa, encurtando caminhos e diminuindo a dependencia de marcelo. as coisas devem estar a mao para que o financeiro nao tenha surpresas." *(motiva módulo Faturamento robusto)*

> "gameleira nao é cliente, é apenas a localização da moradia de um funcionário" *(15/04 — princípio: não confundir localidade com cliente)*

> "ACHO QUE OS PROMPTS ESTAO DESATUALIZADOS" *(sintoma recorrente que motivou a política de "types.ts é fonte de verdade")*

> "SE DEPOIS EU DESCOBRIR QUE É MEDIÇÃO TENHO COMO MUDAR?" *(billing_type deve ser editável — não imutável)*

---

## Omissões

- CPFs de funcionários nos CSVs de import (apareciam em listagens); **não reproduzidos** aqui.
- Tokens/credenciais: nenhum token Supabase ou API key foi vazado no transcript — mesmo assim não foram propagados.
- Valores salariais ou de propostas específicas: mencionados pontualmente no transcript mas **omitidos** aqui por serem dados sensíveis de negócio.
- Muitas mensagens são stdout de Bash/Grep/Read/Edit (~85% do volume do JSONL) — ignoradas conforme briefing.
