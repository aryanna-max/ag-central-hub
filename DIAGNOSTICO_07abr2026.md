# DIAGNÓSTICO DO SISTEMA AG CENTRAL HUB
> Data: 07/04/2026 | Versão: 3.0
> Snapshot do estado atual. NÃO editar — criar novo arquivo quando necessário.

---

## SUMÁRIO EXECUTIVO

| Módulo | Status | Observação |
|---|---|---|
| Negócios (Leads/Propostas/Clientes) | ✅ Funcional | Funil completo, Oportunidades eliminado |
| Campo (Escala/Veículos/Equipes) | ✅ Funcional | Filtros is_legacy, show_in_operational, diárias automáticas |
| Prancheta (Kanban/Tarefas) | ✅ Funcional | TECH_ROLES centralizado, responsáveis editáveis |
| Faturamento (Medições/Faturas) | ⚠️ Parcial | Módulo existe mas F-FIN ainda não executado |
| Projetos (Hub central) | ✅ Funcional | execution_status por módulo, service como Select |
| Pessoas (RH) | ⚠️ Parcial | Base funcional, F-RH ainda não executado |
| Radar (Dashboard) | ✅ Funcional | Kanban 10 colunas, KPIs, filtros |
| Admin (Cadastros/Config) | ✅ Funcional | SystemSettings UI, senha aleatória |
| Aprovação externa | ✅ Funcional | Página pública mobile, token de aprovação |

**Problemas críticos:** 0
**Dívida técnica:** ~70 casts `as any` nos hooks (funciona, sem type safety)
**Nota arquitetural estimada:** ~6/10

---

## 1. O QUE FOI FEITO (histórico de sessões)

### Fase 1 — Filtros críticos (03/04/2026)
- ✅ useDailySchedule: filtro `is_legacy=false`
- ✅ useMonthlySchedules: filtro `is_legacy=false`
- ✅ useVehicles: hook `useActiveVehicles()` com `status=disponivel`
- ✅ EscalaDiaria: fallback `team_id` corrigido (null, não schedule.id)
- ✅ EscalaDiaria: validação `project_id` antes do insert
- ✅ Dropdowns operacionais: `useActiveVehicles` em 4 arquivos
- ✅ Filtro `execution_status` por módulo
- ✅ Toggle "Mostrar todos os projetos ativos"

### Fase 2 — Integridade de dados (03/04/2026)
- ✅ Lista de serviços centralizada em `serviceTypes.ts`
- ✅ Filtro de responsáveis centralizado em `isCommercialDirector()`
- ✅ Módulo Oportunidades eliminado (3 arquivos deletados)
- ✅ Conversão de lead salva contato em `client_contacts`
- ✅ Role de funcionário como Select com `FIELD_ROLES`
- ✅ Senha padrão removida — gera aleatória com dialog
- ✅ Alertas padronizados (`resolved` boolean + `alert_status`)
- ✅ Relatórios financeiros usam `nf_data` (não `updated_at`)
- ✅ `execution_status` como status primário na UI
- ✅ `TECH_ROLES` centralizado em `fieldRoles.ts`
- ✅ Editar `responsible_tecnico/campo` no detalhe da Prancheta

### Fase 3 — Melhorias (03/04/2026)
- ✅ Propostas ordenadas por status (enviada primeiro)
- ✅ Badge "Expirada" para propostas vencidas
- ✅ Motivo de perda exibido separadamente com badge
- ✅ Duplicate errors logados (console.warn)
- ✅ MinhasTarefas com descrição e prioridade
- ✅ Retry na geração de código (race condition)

### Features novas (03/04/2026)
- ✅ `show_in_operational` em projects
- ✅ Página aprovação externa `/aprovacao/:token`
- ✅ Botões Submeter + Copiar Link nas folhas de despesa
- ✅ Diárias de veículos automáticas ao fechar escala
- ✅ SystemSettings UI em `/admin/configuracoes`
- ✅ Link medições → invoices automático ao registrar NF

### Correções módulo Comercial (07/04/2026)
- ✅ LEAD_STATUSES sem duplicata de "aprovado" (7 status na ordem correta)
- ✅ Botão "Converter" na view de lista para leads com status "aprovado"
- ✅ Campo `servico` como Select com 15 opções em Leads e LeadDetailDialog
- ✅ Campo `responsible_id` filtrado para Sérgio e Ciro
- ✅ `useClients` filtrado por `codigo IS NOT NULL`

### SQLs executados no banco
- ✅ `show_in_operational` (boolean, default true) em projects
- ✅ `approval_token` (uuid) e `approval_comments` (jsonb) em field_expense_sheets
- ✅ Limpeza: 3 escalas legado + 18 teams + 18 veículos deletados
- ✅ DROP `parent_project_id` de projects
- ✅ Filtro `is_legacy=false` implementado nas queries

---

## 2. ESTADO DO BANCO (07/04/2026)

| Tabela | Registros | Observação |
|---|---|---|
| projects | 77 | Com `show_in_operational` |
| project_services | 80 | |
| employees | 64 | Filtrado: status != desligado |
| clients | 51 | Filtrado: codigo IS NOT NULL |
| leads | 21 | Ativos |
| alerts | 38 | |
| teams | 0 | Limpo — aguarda repovoamento |
| vehicles | 0 | Limpo — aguarda repovoamento |
| proposals | 0 | Ainda não criadas |
| measurements | 0 | |
| daily_schedules | 2 | Não-legado |
| monthly_schedules | 0 | |
| field_expense_sheets | 0 | |

---

## 3. PENDÊNCIAS DE DADOS

| O que | Quem | Status |
|---|---|---|
| Cadastrar veículos | Marcelo | Planilha modelo pronta (PLANILHA_VEICULOS.csv) |
| Cadastrar equipes/grupos | Marcelo | Planilha modelo pronta (PLANILHA_EQUIPES.csv) |
| Popular `billing_type` por cliente | Aryanna | SQL pronto — só executar |
| Confirmar `show_in_operational` nos projetos BRK | Diretoria | SQL pronto quando decidir |
| Testar fluxo escala no celular | Marcelo | Aguardando veículos cadastrados |
| Testar página aprovação no celular | Sérgio/Ciro | Aguardando folha de despesa criada |

---

## 4. PRÓXIMOS PROMPTS LOVABLE

### F-FIN — Módulo Faturamento Completo (PRÓXIMO)
Abas: Alertas | Pipeline | Medições | Projetos | Relatórios
- Email automático para Alcione com dados completos da NF
- Pipeline de entregas previstas por prazo
- Relatórios: faturamento por período, NFs pendentes, projeção do mês

### F-RH — Módulo Pessoas Completo
Abas: Pagamentos | Folhas Funcionários | Folhas Veículos | Férias | Ausências | Relatórios
- Aprovação de folhas com descontos
- Resumo semanal consolidado

### F6 — Radar Mobile-First
- Alertas urgentes no topo (fixo)
- KPIs visuais em grade 2×2
- Lista de projetos por grupo com toggle
- Kanban 10 colunas como visão secundária

---

## 5. DÍVIDA TÉCNICA

| Item | Quantidade | Impacto |
|---|---|---|
| Casts `as any` nos hooks | ~25 | Sem type safety, funciona |
| Casts `as any` nas pages | ~45 | Idem |
| `billing_type` sem valor | ~15 projetos | SQL pronto para popular |
