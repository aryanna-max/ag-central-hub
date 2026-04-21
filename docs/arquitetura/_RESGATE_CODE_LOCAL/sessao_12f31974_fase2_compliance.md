# Resgate de decisões — Sessão `12f31974`

**Origem:** `~/.claude/projects/.../12f31974-d6b6-41ce-a3dd-923be9bfc8d7.jsonl` (1576 linhas, 17/04/2026 → 20/04/2026)
**Escopo real executado:** Fase 2 Compliance + reescrita de Medições (Operacional + Financeiro) + Limpeza de dados legado + Regeneração de `types.ts` + Cleanup de hardcodes VT.

---

## Decisões fechadas

### Compliance / Fase 2
- **Enums criados:** `doc_type` (21 valores: aso, nr18, nr35, nr10, nr33, ficha_epi, integracao, ctps, rg, cpf, cnh, comprovante_residencia, certidao_nascimento, titulo_eleitor, reservista, pis, conta_bancaria, foto_3x4, crea, contrato_trabalho, outro) e `doc_status` (5: valido, vencido, proximo_vencer, pendente, em_analise). `proximo_vencer` = 30 dias.
- **6 tabelas Fase 2:** `employee_documents`, `company_documents`, `client_doc_requirements`, `employee_client_integrations`, `monthly_compliance_tasks`, `compliance_task_executions`.
- **Seed obrigatório:** 6 tarefas mensais + 5 docs da empresa com PCMSO marcado VENCIDO (desde 07/2023).
- **Unique index parcial:** `(employee_id, doc_type) WHERE doc_status IN ('valido','proximo_vencer','em_analise')` — permite múltiplas versões históricas mas só 1 ativo por tipo.
- **Trigger `update_updated_at_column()`** (nunca `set_updated_at` / `handle_updated_at`).

### Medições (refactor Operacional + Financeiro)
- **Fonte única:** Marcelo cria/edita medições no Operacional; Alcione só visualiza + 2 ações (Registrar NF, Confirmar pagamento). "Aprovar/rejeitar" é ação do cliente (não do financeiro).
- **`FaturamentoMedicoes.tsx` passa a read-only** — removidos 11 campos digitáveis antigos (`dias_semana`, `dias_fds`, `valor_diaria_*`, `codigo_bm` manual). Adicionadas colunas **Tipo** (Grid/Boletim/Resumo) e **Avanço %**. Diff -315/+93.
- **Remover opção `ag_topografia`** no select de empresa faturadora (usar `gonzaga_berlim` | `ag_cartografia`).
- **Formato código BM revisado:** antes `AG-BM-{ANO}-{SEQ:03d}` global; agora `BM-{CODIGO_PROJETO_SEM_ANO}-{SEQ:02d}` — sequencial por projeto, 2 dígitos. Ex: projeto `2026-BRK-003` → `BM-BRK-003-01`, `BM-BRK-003-02`. Medições antigas (`AG-BM-2026-XXX`) ficam como histórico.
- **Campo `external_code`** previsto em `measurements` para clientes que ditam formato próprio (Engeko `FSQ-GTR-009`, HBR `BM-07`).
- **Período do BM:** trocado select Mês+Ano → dois `<input type="date">` (Período de / até), default mês atual.

### Política de códigos (já implementada no código)
- `clients.codigo` — 3 chars (CHECK), sugestão automática via `suggestCode()` em `ClientFormDialog.tsx:16-25` (stopwords: de/do/da/dos/das/e/a/o/em/para/com/ltda/sa/s/a/me/epp/eireli).
- `projects.codigo` — `{ANO}-{SIGLA_CLIENTE}-{SEQ:03d}` em `ProjectFormDialog.tsx:19-28`.
- Feature ativa desde migration `20260327170752` — registros anteriores vieram com `codigo=NULL`.

### Limpeza de dados legado (migration `20260417_limpeza_dados_legado.sql`)
- **Regra do dono:** "projetos ativos ficam e tudo que veio de lead"; "escalas, caixa — tudo para trás é lixo"; "tudo importado a partir de 18/03 fica".
- **Descoberta:** corte por `created_at >= 2026-03-18` não funciona — imports rodaram em abril, timestamp é da execução do INSERT.
- **Critério final adotado:** FICA se `lead_id IS NOT NULL` OU `execution_status` em `em_campo|proposta_aprovada|campo_pausado|faturamento`; ARQUIVA se sem lead E `execution_status` em `concluido|pago|campo_concluido|NULL`.
- **Resultado aplicado:** projects_ativos 95→64; projects_arquivados 0→31; clients_ativos 59→40; clients_arquivados 1→20; alerts 104→0; daily_schedules 5→0.
- **TRUNCATE CASCADE em 15 tabelas operacionais:** benefit_settlements, employee_daily_records, daily_team_assignments, daily_schedule_entries, daily_schedules, monthly_schedules, field_expense_discounts, field_expense_items, field_expense_sheets, measurements, invoices, invoice_items, project_benefits, alerts, lead_interactions.
- **Não deletar** — só `is_active=false` (FKs preservam histórico).

### Arquitetura de queries
- **`useProjects()` passa a filtrar `is_active=true` por padrão**; criado `useProjectsAll()` para telas de histórico (ProjetoHistorico, ClienteHistorico).
- **`FaturamentoProjetos.tsx` (A Receber)** — removido status `pago` do filtro (conceitualmente errado listar pago como a receber); fica só `faturamento`.
- **Página "Projetos em Campo" removida** do Operacional (rota, sidebar, página). "Em Obra" → "Em Projeto" nos labels.

### Cleanup VT (pendências técnicas)
- Adicionada coluna `employees.transporte_tipo` TEXT CHECK `vt_cartao|dinheiro|nenhum` DEFAULT `vt_cartao`.
- Adicionada coluna `field_expense_items.subtipo` TEXT CHECK `integral|complemento` (NULL permitido).
- 4 keys em `system_settings` (tabela só tem `key|value`, sem `description`): `vt_valor_viagem=4.50`, `vt_viagens_por_dia=2`, `vt_desconto_percentual=6`, `alelo_valor_dia=15.00`.
- `useDailySchedule.ts` — hardcodes `vt_provided=true` e `vt_value=4.50` substituídos: lê `system_settings` + `employees.transporte_tipo` via join no select.

---

## Raciocínios / trade-offs

- **Numeração por projeto vs global:** escolhido sequencial por projeto (2 dígitos) porque HBR fala "BM-07 do contrato"; ano no prefixo vem do código do projeto.
- **Alertas de medição:** recomendada **trigger SQL reativa** + pgcron para agings diários, em vez de recalcular no frontend — segue o padrão das outras partes (`useModuleAlertCounts` já lê de `alerts`). Gatilhos propostos por persona (Alcione / Marcelo / Diretoria) — não implementado na sessão.
- **Backfill de `codigo` em 47 clientes + 96 projetos:** abandonado em favor de arquivamento por qualidade. "Fazer código de dado sujo só propaga lixo."
- **Cliente como tabela única:** arquitetura **está íntegra** (100% FK). Problema real é duplicatas intra-`clients` (ENCAR+ENCAR Construções; Colorado+Colgravata+Colarcoverde; Shopping Plaza+Plaza Casa Forte) + 2 UIs de CRUD (`/admin/clientes` vs `/comercial/clientes`) + `leads.company` texto livre sem match fuzzy na conversão.
- **Lovable↔GitHub:** aplica DDL (CREATE/ALTER) automático; **DML (TRUNCATE/UPDATE) exige "Run anyway" manual** no modal destrutivo (React não aceita clique programático — `isTrusted` check).

---

## Bugs / incidentes

- **Regressão de status de leads:** critério agressivo `converted_project_id IS NULL AND client_id IS NULL` marcou 14 leads legítimos como `perdido`. `client_id IS NULL` não significa lead morto (só "ainda não virou cliente"). Revertido em etapas:
  1. Primeira reversão mandou todos para `novo` (perdeu status originais).
  2. Restauração precisa via `name|company` recuperada dos arquivos de import (9 de 14 reestabelecidos).
  3. Enum `lead_status` tem `em_negociacao` (não `negociacao`) e `em_contato` (não `prospeccao`) — primeira tentativa falhou por valor inválido.
  4. SESI/PE tinha `company = "SESI/PE — Sistema FIEPE"` (travessão, não hífen) — UPDATE não casou.
- **`policy "Auth full access mi" already exists`** ao re-aplicar migration de measurements — as tabelas já tinham sido criadas numa execução anterior; ruído, não bloqueante (`CREATE POLICY` não é idempotente).
- **Bug amplificado em Faturamento A Receber:** listava 31 projetos `pago` como "a receber".

---

## Pendências deixadas

- 3 leads em `novo` sem pista (Polyana/Arq.Polyanna 26/03; TIAGO ALAN/TECNOIND 26/03; IRMÃO JOÃO ARIMATEA/ARAUTOS DO EVANGELHO 31/03) — requerem decisão manual via Kanban.
- `useCreateMeasurementFromProject` depende de `project_services` cadastrado — BMs de BRK/Engeko/HBR virão vazios se propostas não tiverem services.
- Engeko (`FSQ-GTR-009`) e HBR (`BM-07`) usam códigos próprios — requer implementação de `external_code` no PDF.
- Alertas reativos de medição (triggers + cron aging >30d/>60d) — planejado, não implementado.
- Consolidação de duplicatas em `clients` (ENCAR, Colorado, Plaza) — pendente.
- Unificação CRUD de clientes (remover `/admin/clientes` OU apontar para `/comercial/clientes`).
- Migrar `clients.cidade`+`city` e `estado`+`state` para campo único.
- Match fuzzy de `leads.company` contra `clients.name` na conversão.

---

## Arquivos criados/modificados

- `supabase/migrations/20260416_fase2_compliance.sql` (6 tabelas + 2 enums + RLS + seed)
- `supabase/migrations/20260416_fase2_vincular_clientes.sql` (UPDATE idempotente monthly_compliance_tasks)
- `supabase/migrations/20260416_refactor_measurements.sql` (+ measurement_items, measurement_daily_entries, 13 colunas em measurements)
- `supabase/migrations/20260417_limpeza_dados_legado.sql` (TRUNCATE + arquivamento)
- `src/hooks/useEmployeeDocuments.ts`, `src/hooks/useComplianceTasks.ts` (novos)
- `src/hooks/useMeasurements.ts`, `useMeasurementItems.ts`, `useMeasurementDailyEntries.ts`
- `src/hooks/useProjects.ts` (filtro `is_active`) + `useProjectsAll.ts` novo
- `src/hooks/useDailySchedule.ts` (cleanup VT)
- `src/pages/rh/Documentos.tsx`, `src/pages/rh/Compliance.tsx` (3 abas)
- `src/components/rh/ComplianceBadge.tsx` (integrado em `EscalaDiaria.tsx` em topógrafo + auxiliares)
- `src/pages/financeiro/FaturamentoMedicoes.tsx` (reescrito read-only)
- `src/pages/operacional/ProjetosEmCampoKanban.tsx` — **deletado**
- `src/pages/comercial/ClientFormDialog.tsx` (ref `suggestCode`)
- `src/pages/projetos/ProjectFormDialog.tsx` (ref `generateProjectCode`)
- `src/integrations/supabase/types.ts` (regenerado pelo Lovable, +571 linhas)
- `Sistema AG/_SQL/SQL_9_FASE2_COMPLIANCE.sql`, `SQL_9b_FASE2_VINCULAR_CLIENTES.sql`, `SQL_10_DIAGNOSTICO_CORTE_18MAR.sql`, `SQL_11_REVISAR_PERDIDOS.sql`
- `Sistema AG/simulacao_bms.html` (3 modelos Grid/Boletim/Resumo com dados fictícios e botão Imprimir→PDF)

### Commits relevantes na `main`

- `d11f6d1` Fase 2 migration principal
- `cab72f6` vincular tarefas↔clientes
- `93063b6` FaturamentoMedicoes read-only
- `08007dd` Limpeza dados legado + `useProjects` filtro
- `019be50` Remover Projetos em Campo
- `baedd3e` código BM por projeto
- `7e982ba` BM com 2 dígitos
- `244559c` período por intervalo de datas
- `77312c5` regenerar types.ts (Lovable)
- `a6975fa` remover hardcodes VT
- `df7bdca` remover cast `as any` pós types.ts

---

## Trechos relevantes

```sql
-- Critério de arquivamento de projetos
UPDATE projects SET is_active = false
WHERE lead_id IS NULL
  AND execution_status::text IN ('concluido','pago','campo_concluido');
```

```typescript
// Geração nova de código BM (useMeasurements.ts)
// Antes: AG-BM-{ANO}-{SEQ:03d} global
// Agora: BM-{codigo_projeto_sem_ano}-{SEQ:02d} por projeto
const prefix = projetoCodigoSemAno;           // ex: "BRK-003"
const { count } = await supabase.from("measurements")
  .select("id", { count: "exact", head: true })
  .eq("project_id", projectId);
const seq = (count ?? 0) + 1;
const codigoBm = `BM-${prefix}-${String(seq).padStart(2, "0")}`;
```

```typescript
// Cleanup VT em useDailySchedule (a6975fa)
const { data: vtConfigData } = await supabase
  .from("system_settings").select("key, value")
  .in("key", ["vt_valor_viagem", "vt_viagens_por_dia"]);
const settingsMap = new Map((vtConfigData || []).map(s => [s.key, s.value]));
const vtValorViagem = parseFloat(settingsMap.get("vt_valor_viagem") || "4.50");
const vtViagensDia  = parseInt(settingsMap.get("vt_viagens_por_dia") || "2", 10);
const vtDiario = vtValorViagem * vtViagensDia;
```

### Convenções reforçadas na sessão
- `projects.codigo` (não `code`).
- Empresa faturadora: `gonzaga_berlim` | `ag_cartografia` (nunca `ag_topografia`).
- Enum `lead_status`: `novo | em_contato | qualificado | convertido | descartado | proposta_enviada | aprovado | perdido | em_negociacao`.
- Toda referência de projeto é FK (20 tabelas verificadas) — única exceção é `vw_tarefas_dia` (VIEW com JOIN dinâmico, OK).
- Supabase MCP = permission denied; Supabase Dashboard bloqueia automação ("Stop Claude"); usar SQL Editor do Lovable com confirmação manual em DML.
