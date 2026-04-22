-- =============================================================================
-- Onda 3 — Resgate arquitetural Fase 3 original (P1: mais recente ≠ melhor)
-- =============================================================================
-- Fase 3B (20/04) simplificou excessivamente a Fase 3 original (17/04 — PR #6
-- fechado sem merge). Esta migration re-adiciona o que foi perdido:
--
-- 1. Enums estruturados para desligamento (termination_type, aviso_previo_type)
--    → antes: TEXT livre em motivo_demissao
-- 2. Colunas de desligamento detalhado (value, notes, terminated_by/at)
--    → antes: só data_demissao + motivo_demissao TEXT
-- 3. Campos Fase 3 original que 3B perdeu: nome_mae, escolaridade,
--    alelo_valor_dia por funcionário, recebe_alelo explícito
-- 4. Tabela nova monthly_discount_report_batches — container hierárquico
--    com workflow rascunho→revisão→enviado→aplicado + totais agregados
-- 5. Triggers de recálculo automático dos totais do batch
-- 6. RPC fn_generate_monthly_discount_batch — gera batch + items do mês
--
-- Natureza: 100% ADITIVA. Preserva tudo que já existe (main PR #7).
-- Backfill: copia data_demissao → terminated_at + detecta termination_type
-- por heurística do motivo_demissao TEXT atual.
-- =============================================================================

-- =============================================================================
-- BLOCO 1 — Enums
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.termination_type AS ENUM (
    'sem_justa_causa',
    'com_justa_causa',
    'pedido_demissao',
    'fim_contrato',
    'acordo_mutuo',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.aviso_previo_type AS ENUM (
    'trabalhado',
    'indenizado',
    'dispensado',
    'nao_aplica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.monthly_report_status AS ENUM (
    'rascunho',
    'revisao',
    'enviado',
    'aplicado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- BLOCO 2 — Colunas novas em employees
-- =============================================================================

ALTER TABLE public.employees
  -- Dados pessoais que Fase 3 tinha e 3B perdeu
  ADD COLUMN IF NOT EXISTS nome_mae TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade TEXT,

  -- Benefícios por funcionário (sobrescreve system_settings quando preciso)
  ADD COLUMN IF NOT EXISTS alelo_valor_dia NUMERIC(10,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS recebe_alelo BOOLEAN DEFAULT true,

  -- Desligamento estruturado (resgate da Fase 3 original)
  ADD COLUMN IF NOT EXISTS termination_type public.termination_type,
  ADD COLUMN IF NOT EXISTS aviso_previo_type public.aviso_previo_type,
  ADD COLUMN IF NOT EXISTS termination_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS termination_notes TEXT,
  ADD COLUMN IF NOT EXISTS terminated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.employees.nome_mae IS 'Nome da mãe — obrigatório para CLT (eSocial)';
COMMENT ON COLUMN public.employees.escolaridade IS 'Valores sugeridos: fundamental, medio, tecnico, superior, pos';
COMMENT ON COLUMN public.employees.alelo_valor_dia IS 'Valor Alelo diário deste funcionário. Default 15.00 (alinhado com system_settings.alelo_valor_dia). Sobrescrever só se negociado diferente.';
COMMENT ON COLUMN public.employees.recebe_alelo IS 'Se false, funcionário não entra em cálculo mensal de Alelo (ex: prestador PJ, estagiário sem direito).';
COMMENT ON COLUMN public.employees.termination_type IS 'Enum padronizado. Preserve motivo_demissao TEXT para descrição adicional se necessário.';
COMMENT ON COLUMN public.employees.aviso_previo_type IS 'Modalidade de aviso prévio — base para cálculo de verbas rescisórias (fora do sistema, via Thyalcont).';
COMMENT ON COLUMN public.employees.termination_value IS 'Valor total da rescisão em R$ — histórico financeiro.';
COMMENT ON COLUMN public.employees.terminated_by IS 'auth.users.id do responsável pelo registro de desligamento (auditoria).';
COMMENT ON COLUMN public.employees.terminated_at IS 'Timestamp do registro no sistema (difere de data_demissao que é a data efetiva).';

-- Índices novos
CREATE INDEX IF NOT EXISTS idx_employees_termination_type
  ON public.employees(termination_type) WHERE termination_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_aviso_previo
  ON public.employees(aviso_previo_type) WHERE aviso_previo_type IS NOT NULL;

-- Backfill: data_demissao existente → terminated_at (se ainda null)
UPDATE public.employees
SET terminated_at = (data_demissao::timestamptz + INTERVAL '12 hours')
WHERE terminated_at IS NULL AND data_demissao IS NOT NULL;

-- Backfill defensivo: recebe_alelo true para CLT ativo, false para prestador
UPDATE public.employees
SET recebe_alelo = CASE
    WHEN tipo_contrato = 'prestador' THEN false
    WHEN tipo_contrato = 'estagiario' THEN false
    ELSE true
  END
WHERE recebe_alelo IS NULL;

-- =============================================================================
-- BLOCO 3 — monthly_discount_report_batches (container hierárquico)
-- =============================================================================
-- 1 batch por mês. Agrega todos os monthly_discount_reports (flat, Fase 3B)
-- daquele mês via FK batch_id. Totais recalculados por trigger.

CREATE TABLE IF NOT EXISTS public.monthly_discount_report_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status public.monthly_report_status NOT NULL DEFAULT 'rascunho',

  -- Workflow timestamps + atores
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),

  -- Totais (recalculados automaticamente por trigger)
  total_alelo NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_vt NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mdrb_month ON public.monthly_discount_report_batches(reference_month);
CREATE INDEX IF NOT EXISTS idx_mdrb_status ON public.monthly_discount_report_batches(status);

CREATE OR REPLACE TRIGGER set_updated_at_mdrb
  BEFORE UPDATE ON public.monthly_discount_report_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_discount_report_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY mdrb_select_authenticated
  ON public.monthly_discount_report_batches FOR SELECT
  TO authenticated USING (true);

CREATE POLICY mdrb_insert_master_diretor_financeiro
  ON public.monthly_discount_report_batches FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('master', 'diretor', 'financeiro'))
  );

CREATE POLICY mdrb_update_master_diretor_financeiro
  ON public.monthly_discount_report_batches FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('master', 'diretor', 'financeiro'))
  );

CREATE POLICY mdrb_delete_master
  ON public.monthly_discount_report_batches FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'master')
  );

-- Ligar monthly_discount_reports (Fase 3B) ao batch
ALTER TABLE public.monthly_discount_reports
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.monthly_discount_report_batches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mdr_batch ON public.monthly_discount_reports(batch_id);

COMMENT ON TABLE public.monthly_discount_report_batches IS
  'Container mensal hierárquico para relatórios de desconto. 1 batch = 1 mês = N monthly_discount_reports (um por funcionário ativo). Workflow: rascunho → revisao → enviado (Thyalcont) → aplicado.';

-- =============================================================================
-- BLOCO 4 — Trigger de recálculo automático dos totais do batch
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_recalc_batch_totals(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.monthly_discount_report_batches b
  SET
    total_alelo = COALESCE((
      SELECT SUM(COALESCE(alelo_valor_final, 0))
      FROM public.monthly_discount_reports WHERE batch_id = p_batch_id
    ), 0),
    total_vt = COALESCE((
      SELECT SUM(COALESCE(vt_valor_final, 0))
      FROM public.monthly_discount_reports WHERE batch_id = p_batch_id
    ), 0),
    total_descontos = COALESCE((
      SELECT SUM(COALESCE(total_descontos, 0))
      FROM public.monthly_discount_reports WHERE batch_id = p_batch_id
    ), 0),
    total_liquido = COALESCE((
      SELECT SUM(COALESCE(alelo_valor_final, 0) + COALESCE(vt_valor_final, 0) - COALESCE(total_descontos, 0))
      FROM public.monthly_discount_reports WHERE batch_id = p_batch_id
    ), 0),
    employee_count = COALESCE((
      SELECT COUNT(*) FROM public.monthly_discount_reports WHERE batch_id = p_batch_id
    ), 0),
    updated_at = now()
  WHERE b.id = p_batch_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_trigger_recalc_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.batch_id IS NOT NULL THEN
    PERFORM public.fn_recalc_batch_totals(OLD.batch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou de batch, recalcula ambos
    IF OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
      IF OLD.batch_id IS NOT NULL THEN
        PERFORM public.fn_recalc_batch_totals(OLD.batch_id);
      END IF;
    END IF;
    IF NEW.batch_id IS NOT NULL THEN
      PERFORM public.fn_recalc_batch_totals(NEW.batch_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' AND NEW.batch_id IS NOT NULL THEN
    PERFORM public.fn_recalc_batch_totals(NEW.batch_id);
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_batch ON public.monthly_discount_reports;
CREATE TRIGGER trg_recalc_batch
  AFTER INSERT OR UPDATE OR DELETE ON public.monthly_discount_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalc_batch();

-- =============================================================================
-- BLOCO 5 — RPC fn_generate_monthly_discount_batch
-- =============================================================================
-- Gera batch + 1 monthly_discount_report por funcionário ativo no mês.
-- Consolida Alelo (dias úteis × alelo_valor_dia), VT (presenças × system_settings),
-- descontos (benefit_settlements + field_expense_discounts no período).

CREATE OR REPLACE FUNCTION public.fn_generate_monthly_discount_batch(
  p_reference_month DATE,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
  v_month_start DATE;
  v_month_end DATE;
  v_title TEXT;
  v_vt_valor NUMERIC;
  v_vt_viagens NUMERIC;
  v_vt_desconto_pct NUMERIC;
  v_month_names TEXT[] := ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
BEGIN
  v_month_start := date_trunc('month', p_reference_month)::date;
  v_month_end := (v_month_start + INTERVAL '1 month - 1 day')::date;

  v_title := COALESCE(p_title,
    'Alelo + VT + Descontos — ' ||
    v_month_names[EXTRACT(MONTH FROM v_month_start)::int] ||
    ' ' || EXTRACT(YEAR FROM v_month_start)::text);

  -- Lê configs de system_settings
  SELECT value::numeric INTO v_vt_valor
    FROM public.system_settings WHERE key = 'vt_valor_viagem';
  SELECT value::numeric INTO v_vt_viagens
    FROM public.system_settings WHERE key = 'vt_viagens_por_dia';
  SELECT value::numeric INTO v_vt_desconto_pct
    FROM public.system_settings WHERE key = 'vt_desconto_percentual';

  -- Cria batch (upsert por reference_month)
  INSERT INTO public.monthly_discount_report_batches (reference_month, title, status)
  VALUES (v_month_start, v_title, 'rascunho')
  ON CONFLICT (reference_month)
    DO UPDATE SET title = EXCLUDED.title, updated_at = now()
  RETURNING id INTO v_batch_id;

  -- Gera 1 monthly_discount_report por funcionário ativo no mês
  -- (não desligado, ou desligado depois do fim do mês)
  INSERT INTO public.monthly_discount_reports (
    batch_id, employee_id, year, month,
    alelo_dias_uteis, alelo_dias_ausente, alelo_dias_feriado,
    alelo_valor_cheio, alelo_desconto, alelo_valor_final,
    vt_dias_uteis, vt_dias_ausente, vt_dias_campo_distante, vt_dias_dinheiro_integral,
    vt_valor_cheio, vt_desconto_ausencias, vt_desconto_salario, vt_valor_final, vt_isento,
    outros_descontos, outros_descricao, total_descontos, status
  )
  SELECT
    v_batch_id,
    e.id,
    EXTRACT(YEAR FROM v_month_start)::int,
    EXTRACT(MONTH FROM v_month_start)::int,
    -- Alelo: 22 dias úteis default — recalc em fase futura
    22, 0, 0,
    CASE WHEN e.recebe_alelo THEN 22 * COALESCE(e.alelo_valor_dia, 15.00) ELSE 0 END,
    0,
    CASE WHEN e.recebe_alelo THEN 22 * COALESCE(e.alelo_valor_dia, 15.00) ELSE 0 END,
    -- VT: 22 dias úteis default
    22, 0, 0, 0,
    CASE WHEN e.transporte_tipo = 'vt_cartao' AND NOT COALESCE(e.vt_isento_desconto, false)
      THEN 22 * v_vt_valor * v_vt_viagens ELSE 0 END,
    0,
    -- Desconto 6% salário se vt_cartao e não isento
    CASE WHEN e.transporte_tipo = 'vt_cartao' AND NOT COALESCE(e.vt_isento_desconto, false)
      THEN COALESCE(e.salario_base, 0) * v_vt_desconto_pct ELSE 0 END,
    CASE WHEN e.transporte_tipo = 'vt_cartao' AND NOT COALESCE(e.vt_isento_desconto, false)
      THEN 22 * v_vt_valor * v_vt_viagens ELSE 0 END,
    (e.transporte_tipo = 'nenhum' OR e.transporte_tipo IS NULL),
    0, NULL, 0, 'rascunho'
  FROM public.employees e
  WHERE (e.data_demissao IS NULL OR e.data_demissao > v_month_end)
    AND (e.admission_date IS NULL OR e.admission_date <= v_month_end)
  ON CONFLICT DO NOTHING;  -- idempotente — se reexecutar, preserva edições

  -- Força recálculo dos totais (mesmo que o INSERT tenha sido no-op)
  PERFORM public.fn_recalc_batch_totals(v_batch_id);

  RETURN v_batch_id;
END $$;

COMMENT ON FUNCTION public.fn_generate_monthly_discount_batch IS
  'Gera (ou atualiza) batch mensal + 1 monthly_discount_report por funcionário ativo no mês. Idempotente — não sobrescreve items existentes, só cria faltantes. Valores iniciais são estimativas (22 dias úteis fixos); edição manual ou refinamento posterior via fn_recalc recalcula.';

GRANT EXECUTE ON FUNCTION public.fn_generate_monthly_discount_batch(DATE, TEXT) TO authenticated;

-- =============================================================================
-- BLOCO 6 — event_log integration (usa camada C0.4 da Onda 0)
-- =============================================================================
-- Logar mudanças de status do batch

CREATE OR REPLACE FUNCTION public.fn_log_batch_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.event_log (
      event_type, entity_table, entity_id,
      actor_type, actor_id, payload
    ) VALUES (
      'monthly_batch.status_changed',
      'monthly_discount_report_batches',
      NEW.id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
      auth.uid(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'reference_month', NEW.reference_month,
        'total_liquido', NEW.total_liquido,
        'employee_count', NEW.employee_count
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_batch_status ON public.monthly_discount_report_batches;
CREATE TRIGGER trg_log_batch_status
  AFTER UPDATE ON public.monthly_discount_report_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_batch_status_change();

-- =============================================================================
-- Validação pós-deploy (SQL Editor):
--
--   -- Novos enums
--   SELECT typname FROM pg_type
--   WHERE typname IN ('termination_type','aviso_previo_type','monthly_report_status');
--
--   -- Novas colunas em employees (8)
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'employees' AND column_name IN
--     ('nome_mae','escolaridade','alelo_valor_dia','recebe_alelo',
--      'termination_type','aviso_previo_type','termination_value',
--      'termination_notes','terminated_by','terminated_at');
--
--   -- Nova tabela batches
--   SELECT tablename FROM pg_tables
--   WHERE tablename = 'monthly_discount_report_batches';
--
--   -- Triggers
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE trigger_name IN ('trg_recalc_batch','trg_log_batch_status');
--
--   -- Smoke test RPC (mês de teste sem efeito em prod)
--   -- SELECT public.fn_generate_monthly_discount_batch('2026-04-01'::date);
-- =============================================================================
