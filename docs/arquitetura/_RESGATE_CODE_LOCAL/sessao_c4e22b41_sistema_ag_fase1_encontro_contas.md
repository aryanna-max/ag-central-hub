# Resgate — Sessão `c4e22b41` (Sistema AG, 31/03→15/04/2026)

**Origem:** `C:\Users\aryan\.claude\projects\C--Users-aryan-Documents-Claude-Projects-Sistema-AG\c4e22b41-d0ff-444e-bed2-a026701d607e.jsonl` (31 MB, 3.641 linhas).
**Projeto Claude:** `SISTEMA AG`.
**Escopo real da sessão:** continuação longa que começou em 31/03 (arquitetura inicial, schema v3, imports) e terminou em 15/04 (retomada pós-6 dias parados, Prompt F-FIN, branches). **Não cobre Encontro de Contas nem fórmulas de benefícios** — esses temas aparecem apenas marginalmente (sessão dedicada ficou em outro transcript).
**Método:** JSONL lido em streaming; filtrado por keywords arquiteturais; priorizadas mensagens da Aryanna e respostas de diagnóstico. Blobs de código e logs de tool call descartados. Muitas das "user messages" longas eram summaries automáticas de compactação — tratadas como contexto, não como decisão nova.
**Omissões de privacidade:** valores absolutos de inadimplência e saldos bancários de clientes **preservados** (aparecem em CLAUDE.md do repo e são operacionais); nada especificamente sensível foi retirado.

---

## 1. Decisões de Arquitetura

### 1.1 Infraestrutura e acesso

- **Nunca criar novo projeto Supabase** — tudo no existente `bphgtvwgsgaqaxmkrtqj`, gerenciado pelo Lovable. (Aryanna, 31/03: *"NAO VOU UTILIZAR NOVO SUPABASE, QUERO FAZER TUDO NO EXISTENTE"*.)
- **Supabase MCP = sem acesso.** Confirmado em múltiplos pontos. Fluxo é: gerar SQL → Aryanna cola no SQL Editor do Lovable. Fonte de verdade do schema = `src/integrations/supabase/types.ts` no GitHub.
- **Clone local do GitHub** serve para edição de frontend sem consumir créditos Lovable; SQL sempre vai no banco real.
- **Lovable opera no `main`.** Não olha pastas locais — olha GitHub. Para mudança chegar no sistema: salvar local → push → Lovable sincroniza.

### 1.2 Dual-status em `projects`

`project_status` (6 valores: `planejamento|execucao|entrega|faturamento|concluido|pausado`) **e** `execution_status` (10 valores: `aguardando_campo|em_campo|campo_concluido|aguardando_processamento|em_processamento|revisao|aprovado|entregue|faturamento|pago`) **coexistem em paralelo**. Um não substitui o outro. Cada módulo tem um Kanban parcial sobre `execution_status`; não existe Kanban único compartilhado.

### 1.3 Modelo Lead → Cliente → Projeto

- **Lead = snapshot histórico** após conversão. Cliente e Projeto são fontes de verdade independentes.
- Histórico reconstruído via JOINs: `leads.client_id`, `leads.converted_project_id`, `projects.lead_id`.
- Um cliente pode ter múltiplos projetos.
- `cnpj_tomador` do projeto **pode ser diferente** do `clients.cnpj` (caso SPE). **Não é redundante** — Aryanna corrigiu: *"UM CLIENTE PODE TER VARIOS PROJETOS, CNPJ DO TOMADOR DO PROJETO PODE NAO SER O DO CLIENTE"*.

### 1.4 `billing_type` e roteamento de alertas

Campo texto em `projects`, valores: `entrega_nf | entrega_recibo | medicao_mensal | misto | sem_documento`. Regra de roteamento:

- `entrega_nf` / `entrega_recibo` → alerta a `financeiro` quando `execution_status = entregue`.
- `medicao_mensal` → alerta apenas quando medição é aprovada (não na entrega).
- `sem_documento` → nenhum alerta.
- `misto` → caso a caso.

### 1.5 Nomenclatura canônica (confirmada nesta sessão)

| Entidade | Formato | Exemplo |
|---|---|---|
| Cliente | 3 letras | BRK, COL, HBR |
| Projeto | ANO-SIGLA-SEQ | 2026-BRK-001 |
| Proposta | ANO-P-SEQ (sequencial único por ano, reseta em janeiro, **sem sigla de cliente**) | 2026-P-001 |
| Lead | ANO-L-SEQ | 2026-L-001 |
| Folha Despesa | ANO-SEQ (simplificado a pedido de Aryanna) | 2026-001 |
| NF | ANO-NF-SEQ | 2026-NF-001 |
| Recibo | ANO-RC-SEQ | 2026-RC-001 |

Aryanna: *"proposta nao precisa ter codigo cliente"*, *"quanto mais simplificado melhor"*.

### 1.6 ENUMs e colunas reais (contra padrões antigos)

- Coluna do código do projeto: **`codigo`**, NÃO `code`. Triggers antigos usavam `NEW.code` — bug.
- Tabela `alerts` é **em inglês**: `message`, `recipient`, `priority`, `reference_id`, `reference_type`, `action_url`, `title`, `resolved`. Traduções antigas (`mensagem`, `prioridade`, `destinatario_perfil`) não existem no banco. CLAUDE.md v8-v9 traziam trigger com nomes errados.
- `alert_priority`: `urgente | importante | informacao` (NÃO `alta`).
- `alert_recipient`: `operacional | comercial | financeiro | rh | sala_tecnica | diretoria | todos`. Já corrigido para roles (antes tinha nomes de pessoas — *alcione*, *marcelo*).
- `parent_project_id` **não existe** — para múltiplos serviços em um projeto, usar `project_services`.

### 1.7 Marco Zero (31/03/2026) e dados legados

- Coluna `is_legacy boolean` adicionada a `daily_schedules`, `monthly_schedules`, `field_expense_sheets`.
- Filtro operacional = `WHERE is_legacy = false`. Não usar filtro por data literal.

### 1.8 Sidebar e Férias-com-escala

- **Sidebar colapsável** — recolhe para strip de ícones, estado salvo por usuário.
- **`is_vacation_override boolean` em `daily_schedule_entries`** — funcionário de férias escalado como avulso (pagamento sem benefícios, modal de aviso, Marcelo confirma). Aryanna: *"SE O FUNCIONARIO ESTÁ DE FERIAS EM TESE NEM DEVERIA TRABALHAR, NAO QUERO COMPLICAR... MARCELO ESCALA ELE AS VEZES E É ALGO TOTALMENTE POR FORA DAS REGRAS TRABALHISTAS, COMO SE FOSSE UM PRESTADOR DE SERVIÇO, COMO POSSO FAZER DA FORMA MAIS SIMPLIFICADA POSSIVEL?"*.

### 1.9 Frequência dos relatórios

Flexível por enquanto (usuário escolhe intervalo). Regras mensais fixas ficam para fase posterior. Aryanna: *"por enquanto deve ficar permitido escolher o intervalo e depois definimos regras"*.

### 1.10 Direcional e SPEs

- Direcional = 1 cliente (sigla DIR), múltiplas SPEs (Bromélia, Imperatriz, Casa Amarela, Lourdes), cada uma com seu `cnpj_tomador`.
- Projetos antigos que aparecem só com nome da SPE ou só com código do contrato devem ser renomeados para ter **as duas informações no nome**. (Aryanna concordou: *"O QUE ACHA?"* → tratado como aprovado.)
- Pernambuco = cliente do projeto Porto de Pedra.
- Estrutura idêntica à do cliente Colorado (referência interna).

### 1.11 Rebuild do módulo Faturamento (15/04)

Abas definitivas decididas nesta sessão:

1. **Alertas** (padrão ao entrar) — NFs para emitir (entregue → faturamento).
2. **A Receber** — projetos em `faturamento` aguardando pagamento; tela para cruzar com extrato BB (data, valor recebido, PIX/TED). Antes era só um relatório enterrado; virou tela principal.
3. **Medições** — CRUD de medições mensais.
4. **Pipeline** — próximas entregas previstas.
5. **Relatórios** — histórico e exportações.

Motivo da reestruturação (diagnóstico da assistant, confirmado): o rascunho anterior não tinha "Confirmar pagamento recebido" (faturamento → pago), nem expunha os R$386k vencidos para Alcione.

Visibilidade: Alcione (role `financeiro`) vê **tudo** dentro deste módulo — `contract_value`, NFs, medições, valores. Sem restrições financeiras dentro do Faturamento.

---

## 2. Raciocínios / Trade-offs explicitados

- **Criar schema novo vs preservar regras existentes:** Aryanna foi explícita que "já validada" não significa "melhor" — regras devem ser reavaliadas criticamente, não preservadas por inércia. Mas algumas regras existentes (ex.: `clients.codigo` com CHECK de 3 caracteres) são genuinamente boas e foram mantidas.
- **`cnpj_tomador` remover vs manter:** debate fechado com manter (SPEs têm CNPJ diferente do cliente comercial).
- **Meu Dinheiro importar vs recriar limpo:** adiado — depende de arquitetura estar pronta primeiro. Aryanna: *"está tudo bagunçado pq está sendo colocado intuitivamente sem entender o que é nada"*.
- **Prompt F-FIN dividido em 3 rodadas** (contexto do Lovable é limitado): (1) estrutura + Alertas, (2) A Receber + Medições, (3) Projetos + Relatórios.
- **Branch cleanup (09/04 → 15/04):** `claude/fix-lead-statuses-7O1c9` tinha 4 arquivos valiosos (`masks.ts`, `executionStatusAlerts.ts`, `ProjectContactsEditor.tsx`, `useProjectContacts.ts`) + 12 fixes. Branch `architecture-notes`, `replace-root-files`, `list-markdown-files` = descartáveis. Merge acabou sendo feito por outra sessão paralela (`compare-differences-Z9Tne`) antes desta tentar — commit `72d50fe`.

---

## 3. Bugs diagnosticados com causa raiz

| # | Bug | Causa raiz |
|---|---|---|
| B1 | Trigger `fn_on_status_change` falhava silenciosamente | Usava `NEW.code` — coluna real é `codigo`. Corrigido em todos os blocos (11, 12, 14, 15, 16). |
| B2 | Bloco 18 do v3 com JOIN quebrado | `p.proposal_id` não existe em `projects`. Bloco removido/reescrito. |
| B3 | Duplicação de colunas em `alerts` | v3 adicionava `mensagem`, `prioridade`, `destinatario_perfil` em português — já existiam em inglês. Reescrito para adicionar só `origem_modulo`, `tipo`, `alert_status`, `scheduled_at`, `calendar_event_id`, `ignored_reason`, `ignored_by_id`. |
| B4 | `proposals.sent_at` com tipo divergente | Já existia como `timestamptz`; v3 declarava `date`. `IF NOT EXISTS` evita quebra mas inconsistência permanece registrada. |
| B5 | `alert_recipient` enum com nomes pessoais | `alcione`, `marcelo` — substituídos por roles. |
| B6 | Go-live 13/04 não aconteceu | GitHub sem commits desde 09/04; módulo F-FIN nunca foi implementado no Lovable. |
| B7 | Tabela `proposals` e `vehicles` vazias | Imports nunca rodados; pendente SQL_6_IMPORTS. |
| B8 | NF Colarcoverde março R$22.000 — fórmula mostrando R$0 | Possível não emissão. Não resolvido na sessão. |
| B9 | Flamboyant, Marcos Aldeia — NFs nunca emitidas | Risco fiscal. Aguarda decisão Alcione/Aryanna (retroativa?). |
| B10 | M.L. Lopes — PIX R$2.000 sem projeto identificado; Bom Jardim sem projeto; Gaja Empreendimentos medições sem cliente cadastrado | Clientes faltando. |

---

## 4. Restrições ("não fazer X")

- ❌ Não criar novo projeto Supabase.
- ❌ Não usar Supabase MCP (permission denied).
- ❌ Não usar nomes em português para colunas de `alerts` (`mensagem`, `prioridade`, `destinatario_perfil`).
- ❌ Não usar `NEW.code` em triggers — é `NEW.codigo`.
- ❌ Não usar `alta` em priority — é `urgente`.
- ❌ Não criar `parent_project_id` — usar `project_services`.
- ❌ Não tratar "Gameleira" como cliente/projeto — é localização residencial de funcionário que aparecia na escala por ser endereço dele. Cinco referências removidas do CLAUDE.md em 15/04.
- ❌ Não incluir `cnpj_tomador` na lista de "colunas a remover" de `projects`.
- ❌ Não filtrar dados operacionais por data literal — usar `is_legacy = false`.
- ❌ Não rodar imports de despesas (`import_10_expenses.sql`) sem confirmar estrutura de `field_expense_sheets`.
- ❌ Não colar prompts de frontend no SQL Editor do Lovable — é só para SQL. Aryanna cometeu o erro uma vez (15/04 ~18:01); foi corrigida.
- ❌ Não mergear `architecture-notes`, `replace-root-files`, `list-markdown-files` — conteúdo superado.

---

## 5. Convenções de nome / terminologia

- **Módulo "Pessoas" (não RH)**, rota `/rh` por herança. Papéis internos: `rh`, `financeiro`.
- **"Grupos Rápidos"** na UI = tabelas `teams`/`team_members` no banco (são presets, não times fixos).
- **"Sala Técnica"** = módulo Prancheta. Líder confirmado: Emanuel Macedo.
- **"Alcione (Financeiro)"** recebe alertas por email em `financeiro@agtopografia.com.br` — sessão antiga assumia que ela não acessava o sistema; 15/04 a decisão se atualiza: ela usa o módulo Faturamento (é a "tela principal" dela).
- **ADMINISTRATIVO e OPERACIONAL misturados no servidor** — reorganização é Fase 2, não agora.

---

## 6. Arquivos relevantes (citados / criados na sessão)

### Repositório `ag-central-hub/`
- `src/integrations/supabase/types.ts` — fonte de verdade do schema.
- `src/pages/financeiro/FaturamentoAlertas.tsx` — reescrito em 15/04 com as 5 abas e modal de NF.
- `src/pages/Projetos.tsx` — usa `project_status` (OK, dual-status é intencional).
- `src/pages/SalaTecnica.tsx` — era placeholder.
- `src/hooks/useAlerts.ts`, `src/hooks/useClients.ts`, `src/hooks/useLeads.ts`, `src/hooks/useProjectContacts.ts`.
- `src/lib/masks.ts`, `src/lib/executionStatusAlerts.ts` — trazidos da branch `fix-lead-statuses`.
- `src/components/projetos/ProjectContactsEditor.tsx`.
- `CLAUDE.md` (do repo) — mais autoritativo que os de outras pastas.

### `Sistema AG/` (pasta Claude Code local)
- `CLAUDE.md` — v8 (13/04 go-live), v9 (15/04 atualizado).
- `ag_schema_v3_corrigido.sql` — 20 blocos.
- `REVISAO/ESTADO_ATUAL.md` — master reference substituído por v9 do repo.
- `REVISAO/SQL_1_FASE5_COLUNAS.sql`, `SQL_5_TRIGGER.sql` — com `is_vacation_override` e triggers em nomes corretos.
- `REVISAO/PROMPT_F-FIN.md` — criado 15/04, v2.0, dividido em 3 partes.
- `REVISAO/script_extrair_nfs.py` — pdfplumber, busca em ADM\ e OPERACIONAL\.
- `REVISAO/DIAGNOSTICO_07abr2026.md`, `EXPLORACAO_COMPLETA_11042026.md`.
- `solicitacao_cowork_nfs_2026.md`.
- `PROMPTS_LOVABLE_DEFINITIVOS.md`.
- `AUDITORIA_Rastreamento_AG_Abril2026.docx` (não lido — formato).
- Import files `import_01_clients.sql` ... `import_10_expenses.sql` (último comentado).

---

## 7. Trechos ilustrativos (parafraseados)

**Aryanna, 31/03 sobre Schema:**
> "JA VALIDADA NAO QUER DIZER MELHOR PQ FUI CRIANDO SEM PLANEJAR."

**Aryanna, 02/04 sobre lead → cliente:**
> "proposta nao precisa ter codigo cliente. é importante que alterações em leads ja convertidos reflitam no cliente/projeto ou o contrario, como deveria ser? é importante que a historia do cliente carregue tudo e o projeto tb."

**Aryanna, 02/04 sobre Férias-escalado:**
> "SE O FUNCIONARIO ESTÁ DE FERIAS EM TESE NEM DEVERIA TRABALHAR, MARCELO ESCALA ELE AS VEZES E É ALGO TOTALMENTE POR FORA DAS REGRAS TRABALHISTAS, COMO SE FOSSE UM PRESTADOR DE SERVIÇO, COMO POSSO FAZER DA FORMA MAIS SIMPLIFICADA POSSIVEL?"

**Aryanna, 02/04 sobre organização do servidor:**
> "NFS POR EXEMPLO DEVERIAM ESTAR EM ADM POIS AGORA É ALCIONE QUE FAZ MAS AINDA ESTAO EM OPERACIONAL, COMO MARCELO ERA PARTE FIN E AGORA NAO MAIS, MUITAS COISAS AINDA ESTAO MISTURADAS E NAO TEMOS EXPERIENCIA PARA REFORMULAR A ORGANIZAÇÃO DO SERVIDOR, SERÁ UMA PROXIMA ETAPA."

**Aryanna, 15/04:**
> "AS PASTAS LOCAIS FORAM ATUALIZADAS E OS PROJETOS NO COWORK TB, EU NAO FIZ NADA NO SISTEMA DO QUE CONVERSAMOS."

**Diagnóstico 15/04:**
> "Go-live de 13/04 não aconteceu. GitHub sem commits desde 09/04 — 6 dias parado. O próximo módulo (F-FIN — Faturamento) nunca foi implementado."

**Reescrita F-FIN (motivo):**
> "Falta 'Confirmar pagamento recebido'. O prompt atual tem 'Marcar como emitido' (entregue → faturamento) mas não tem 'Confirmar pagamento' (faturamento → pago). Esse é o ato de cruzar o extrato. A Receber R$386.273 vencidos (30 registros) deve aparecer logo que Alcione abre o módulo, não escondido na aba Relatórios."

---

## 8. Pendências deixadas em aberto (ao fim da sessão, 15/04)

1. Colar Parte 2 e Parte 3 do Prompt F-FIN no Lovable (após Parte 1 processada ✅).
2. Executar SQL Bloco B (popular `billing_type` dos projetos existentes).
3. Importar `proposals` e `vehicles` (SQL_6_IMPORTS).
4. Cadastrar clientes faltantes: Gaja Empreendimentos, Bom Jardim, M.L. Lopes, Praia do Tocantins.
5. Decisões fiscais: NF retroativa Marcos Aldeia? NF Flamboyant? Verificação de Colarcoverde R$22k.
6. Substituto de Marcelo Lisias (rescisão paga R$16.438).
7. Prompts futuros: SQL-A (arquitetura comercial: OS, descontos, código FD), F-RH, F6 Radar mobile.
8. `import_10_expenses.sql` ainda comentado.
9. `types.ts` precisa regeneração no Lovable pós-SQL novos.
10. `AUDITORIA_Rastreamento_AG_Abril2026.docx` (15/04 11:47) — não foi lido; pedir versão .txt ou .pdf.

---

## 9. Nota sobre escopo

Esta sessão **não** discutiu Encontro de Contas mensal, fórmulas de VT/VR/VA, nem triggers `update_updated_at_column` em profundidade, apesar de o prompt do resgate mencionar esses temas como possíveis. Menções isoladas (ver seção 3, B8) são tangenciais. Os tópicos de Fase 1.5 Encontro de Contas ficaram em outro transcript — provavelmente uma sessão posterior a 15/04 ou paralela sob outro UUID.
