-- ============================================================
-- LIMPEZA DE DADOS LEGADO — 17/04/2026
--
-- Contexto: sistema começa a ser usado de verdade a partir desta data.
-- Todos os dados operacionais (escalas, caixa, medições, NF, benefícios,
-- alerts) importados dos CSVs históricos ou gerados em testes são LIXO.
-- Projetos "pago" sem origem em lead são históricos.
--
-- Conforme diagnóstico (SQL_10_DIAGNOSTICO_CORTE_18MAR.sql):
-- - Operacional 100% vazio ou irrelevante (truncate seguro)
-- - 31 projetos 'pago' sem lead_id → arquivar
-- - 64 projetos ficam (40 ativos + 21 de lead + 3 aguardando/entregue)
-- ============================================================

-- ============================================================
-- BLOCO 1 — WIPE OPERACIONAL (tudo é lixo ou ruído de teste)
-- ============================================================

TRUNCATE TABLE
  public.benefit_settlements,
  public.employee_daily_records,
  public.daily_team_assignments,
  public.daily_schedule_entries,
  public.daily_schedules,
  public.monthly_schedules,
  public.field_expense_discounts,
  public.field_expense_items,
  public.field_expense_sheets,
  public.measurements,
  public.invoice_items,
  public.invoices,
  public.project_benefits,
  public.alerts,
  public.lead_interactions
CASCADE;

-- ============================================================
-- BLOCO 2 — ARQUIVAR 31 PROJETOS HISTÓRICOS
-- Critério: execution_status 'pago' (ou concluído/campo_concluido) E sem lead_id
-- ============================================================

UPDATE public.projects
  SET is_active = false
WHERE lead_id IS NULL
  AND execution_status::text IN ('concluido', 'pago', 'campo_concluido');

-- ============================================================
-- BLOCO 3 — ARQUIVAR CLIENTES SEM PROJETO ATIVO E SEM LEAD
-- Clientes que ficaram sem nenhum projeto ativo após bloco 2
-- Preserva os que vieram de lead (mesmo sem projeto ainda)
-- ============================================================

UPDATE public.clients
  SET is_active = false
WHERE lead_id IS NULL
  AND id NOT IN (
    SELECT DISTINCT client_id FROM public.projects
    WHERE is_active = true AND client_id IS NOT NULL
  );

-- ============================================================
-- BLOCO 4 — MARCAR LEADS RETROATIVOS SEM MOVIMENTO
-- Os 12 leads importados em 15/04 sem conversão nem cliente vinculado
-- Não deleta, marca como 'perdido' pra sair do funil ativo
-- ============================================================

UPDATE public.leads
  SET status = 'perdido'
WHERE converted_project_id IS NULL
  AND client_id IS NULL
  AND status::text NOT IN ('convertido', 'perdido');

-- ============================================================
-- VERIFICAÇÃO (opcional, rodar depois para conferir)
-- ============================================================
-- SELECT 'projects_ativos', COUNT(*) FROM projects WHERE is_active = true;
-- SELECT 'projects_arquivados', COUNT(*) FROM projects WHERE is_active = false;
-- SELECT 'clients_ativos', COUNT(*) FROM clients WHERE is_active = true;
-- SELECT 'clients_arquivados', COUNT(*) FROM clients WHERE is_active = false;
-- SELECT 'leads_ativos', COUNT(*) FROM leads WHERE status NOT IN ('convertido','perdido');
