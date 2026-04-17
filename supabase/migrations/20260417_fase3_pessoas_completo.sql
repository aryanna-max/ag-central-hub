-- ============================================================
-- FASE 3 — PESSOAS COMPLETO
-- Admissao/Desligamento + Descontos Mensais (Alelo + VT)
-- Data: 17/04/2026
-- Gaps: G7 (Caixa semanal completo), G8 (admissao/desligamento)
-- ============================================================

-- ============================================================
-- BLOCO 1 — ENUMS auxiliares
-- ============================================================

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
  CREATE TYPE public.tipo_contrato AS ENUM (
    'clt',
    'prestador',
    'estagiario',
    'temporario'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.empresa_emissora AS ENUM (
    'gonzaga_berlim',
    'ag_cartografia',
    'ag_topografia_avulsa'
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

-- ============================================================
-- BLOCO 2 — EMPLOYEES: novos campos de admissao e desligamento
-- ============================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS pis TEXT,
  ADD COLUMN IF NOT EXISTS ctps_numero TEXT,
  ADD COLUMN IF NOT EXISTS ctps_serie TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS nome_mae TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade TEXT,
  ADD COLUMN IF NOT EXISTS banco_nome TEXT,
  ADD COLUMN IF NOT EXISTS banco_agencia TEXT,
  ADD COLUMN IF NOT EXISTS banco_conta TEXT,
  ADD COLUMN IF NOT EXISTS banco_tipo_conta TEXT,
  ADD COLUMN IF NOT EXISTS endereco_rua TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
  ADD COLUMN IF NOT EXISTS tipo_contrato public.tipo_contrato,
  ADD COLUMN IF NOT EXISTS empresa_emissora public.empresa_emissora,
  ADD COLUMN IF NOT EXISTS salario_base NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS alelo_valor_dia NUMERIC(10,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS recebe_alelo BOOLEAN DEFAULT false,
  -- Desligamento
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS termination_type public.termination_type,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS termination_notes TEXT,
  ADD COLUMN IF NOT EXISTS aviso_previo_type public.aviso_previo_type,
  ADD COLUMN IF NOT EXISTS termination_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS terminated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;

-- Backfill tipo_contrato a partir da matricula
UPDATE public.employees
SET tipo_contrato = 'clt'::public.tipo_contrato
WHERE tipo_contrato IS NULL AND matricula ~ '^000';

UPDATE public.employees
SET tipo_contrato = 'prestador'::public.tipo_contrato
WHERE tipo_contrato IS NULL AND matricula ILIKE 'PREST-%';

-- Indices uteis
CREATE INDEX IF NOT EXISTS idx_employees_termination_date
  ON public.employees(termination_date) WHERE termination_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_empresa_emissora
  ON public.employees(empresa_emissora) WHERE empresa_emissora IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_tipo_contrato
  ON public.employees(tipo_contrato) WHERE tipo_contrato IS NOT NULL;

-- ============================================================
-- BLOCO 3 — monthly_discount_reports
-- Relatorio consolidado dia 26 -> Thyalcont
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_discount_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month DATE NOT NULL,                     -- primeiro dia do mes
  title           TEXT NOT NULL,                     -- ex: "Alelo + VT + Descontos — Abril 2026"
  status          public.monthly_report_status NOT NULL DEFAULT 'rascunho',
  sent_at         TIMESTAMPTZ,
  sent_by         UUID REFERENCES auth.users(id),
  applied_at      TIMESTAMPTZ,                       -- quando Thyalcont aplicou
  total_alelo     NUMERIC(14,2) DEFAULT 0,
  total_vt        NUMERIC(14,2) DEFAULT 0,
  total_descontos NUMERIC(14,2) DEFAULT 0,
  total_liquido   NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_month)
);

CREATE INDEX IF NOT EXISTS idx_mdr_month ON public.monthly_discount_reports(reference_month);
CREATE INDEX IF NOT EXISTS idx_mdr_status ON public.monthly_discount_reports(status);

CREATE OR REPLACE TRIGGER set_updated_at_monthly_discount_reports
  BEFORE UPDATE ON public.monthly_discount_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_discount_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mdr_all_authenticated" ON public.monthly_discount_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- BLOCO 4 — monthly_discount_report_items
-- Uma linha por funcionario no relatorio
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_discount_report_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES public.monthly_discount_reports(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  -- Alelo
  alelo_dias      INT DEFAULT 0,
  alelo_valor_dia NUMERIC(10,2) DEFAULT 15.00,
  alelo_total     NUMERIC(12,2) DEFAULT 0,
  alelo_desconto_faltas NUMERIC(12,2) DEFAULT 0,
  -- VT (cartao ou VEM)
  vt_viagens      INT DEFAULT 0,
  vt_valor_viagem NUMERIC(10,2) DEFAULT 4.50,
  vt_total        NUMERIC(12,2) DEFAULT 0,
  vt_desconto_faltas NUMERIC(12,2) DEFAULT 0,
  -- Descontos semanais (acumulado das benefit_settlements)
  descontos_semanais NUMERIC(12,2) DEFAULT 0,
  -- Consolidado
  valor_liquido   NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(report_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_mdri_report ON public.monthly_discount_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_mdri_employee ON public.monthly_discount_report_items(employee_id);

CREATE OR REPLACE TRIGGER set_updated_at_monthly_discount_report_items
  BEFORE UPDATE ON public.monthly_discount_report_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_discount_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mdri_all_authenticated" ON public.monthly_discount_report_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- BLOCO 5 — Funcao auxiliar: fn_recalc_monthly_discount_report
-- Recalcula os totais do relatorio a partir dos itens
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_recalc_monthly_discount_report(p_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.monthly_discount_reports r
  SET
    total_alelo     = COALESCE((SELECT SUM(alelo_total)         FROM public.monthly_discount_report_items WHERE report_id = p_report_id), 0),
    total_vt        = COALESCE((SELECT SUM(vt_total)            FROM public.monthly_discount_report_items WHERE report_id = p_report_id), 0),
    total_descontos = COALESCE((SELECT SUM(descontos_semanais + alelo_desconto_faltas + vt_desconto_faltas) FROM public.monthly_discount_report_items WHERE report_id = p_report_id), 0),
    total_liquido   = COALESCE((SELECT SUM(valor_liquido)       FROM public.monthly_discount_report_items WHERE report_id = p_report_id), 0),
    updated_at      = now()
  WHERE r.id = p_report_id;
END $$;

-- Trigger que recalcula automaticamente ao inserir/atualizar/deletar itens
CREATE OR REPLACE FUNCTION public.fn_trigger_recalc_mdr()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_monthly_discount_report(OLD.report_id);
    RETURN OLD;
  ELSE
    PERFORM public.fn_recalc_monthly_discount_report(NEW.report_id);
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_mdr ON public.monthly_discount_report_items;
CREATE TRIGGER trg_recalc_mdr
  AFTER INSERT OR UPDATE OR DELETE ON public.monthly_discount_report_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalc_mdr();

-- ============================================================
-- BLOCO 6 — Funcao: fn_generate_monthly_discount_report
-- Gera (ou regenera) items para um mes a partir de:
--  * employee_daily_records (Alelo: dias presente; VT: viagens)
--  * benefit_settlements    (descontos semanais consolidados)
--  * employees              (alelo_valor_dia, has_vt, vt_value)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_generate_monthly_discount_report(p_reference_month DATE)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_id UUID;
  v_mes_inicio DATE := date_trunc('month', p_reference_month)::DATE;
  v_mes_fim    DATE := (date_trunc('month', p_reference_month) + INTERVAL '1 month - 1 day')::DATE;
  v_mes_label  TEXT := to_char(v_mes_inicio, 'TMMonth YYYY');
  v_vt_valor_viagem NUMERIC := 4.50;
  v_vt_viagens_dia INT := 2;
BEGIN
  -- Pegar config VT do system_settings
  SELECT COALESCE((value)::NUMERIC, 4.50) INTO v_vt_valor_viagem
    FROM public.system_settings WHERE key = 'vt_valor_viagem' LIMIT 1;
  SELECT COALESCE((value)::INT, 2) INTO v_vt_viagens_dia
    FROM public.system_settings WHERE key = 'vt_viagens_por_dia' LIMIT 1;

  -- Upsert do relatorio (manter status se ja existir em rascunho)
  INSERT INTO public.monthly_discount_reports (reference_month, title, status)
  VALUES (v_mes_inicio, 'Alelo + VT + Descontos — ' || v_mes_label, 'rascunho')
  ON CONFLICT (reference_month)
  DO UPDATE SET title = EXCLUDED.title, updated_at = now()
  RETURNING id INTO v_report_id;

  -- Nao regerar se ja foi enviado/aplicado
  IF (SELECT status FROM public.monthly_discount_reports WHERE id = v_report_id)
     IN ('enviado', 'aplicado') THEN
    RETURN v_report_id;
  END IF;

  -- Limpar itens existentes (regenerar)
  DELETE FROM public.monthly_discount_report_items WHERE report_id = v_report_id;

  -- Gerar itens a partir de employee_daily_records + benefit_settlements
  INSERT INTO public.monthly_discount_report_items (
    report_id, employee_id,
    alelo_dias, alelo_valor_dia, alelo_total,
    vt_viagens, vt_valor_viagem, vt_total,
    descontos_semanais, valor_liquido
  )
  SELECT
    v_report_id,
    e.id AS employee_id,
    COALESCE(edr.dias_presente, 0) AS alelo_dias,
    COALESCE(e.alelo_valor_dia, 15.00) AS alelo_valor_dia,
    CASE WHEN e.recebe_alelo
         THEN COALESCE(edr.dias_presente, 0) * COALESCE(e.alelo_valor_dia, 15.00)
         ELSE 0 END AS alelo_total,
    COALESCE(edr.dias_com_vt, 0) * v_vt_viagens_dia AS vt_viagens,
    v_vt_valor_viagem AS vt_valor_viagem,
    CASE WHEN e.has_vt AND e.transporte_tipo = 'vt_cartao'
         THEN COALESCE(edr.dias_com_vt, 0) * v_vt_viagens_dia * v_vt_valor_viagem
         ELSE 0 END AS vt_total,
    COALESCE(bs.total_desconto, 0) AS descontos_semanais,
    -- Liquido = Alelo + VT - descontos
    (CASE WHEN e.recebe_alelo
          THEN COALESCE(edr.dias_presente, 0) * COALESCE(e.alelo_valor_dia, 15.00)
          ELSE 0 END)
    + (CASE WHEN e.has_vt AND e.transporte_tipo = 'vt_cartao'
            THEN COALESCE(edr.dias_com_vt, 0) * v_vt_viagens_dia * v_vt_valor_viagem
            ELSE 0 END)
    - COALESCE(bs.total_desconto, 0) AS valor_liquido
  FROM public.employees e
  LEFT JOIN (
    SELECT employee_id,
           COUNT(*) FILTER (WHERE attendance IN ('presente','atrasado') OR attendance IS NULL) AS dias_presente,
           COUNT(*) FILTER (WHERE vt_provided = true) AS dias_com_vt
    FROM public.employee_daily_records
    WHERE schedule_date BETWEEN v_mes_inicio AND v_mes_fim
    GROUP BY employee_id
  ) edr ON edr.employee_id = e.id
  LEFT JOIN (
    SELECT employee_id, SUM(saldo_desconto) AS total_desconto
    FROM public.benefit_settlements
    WHERE semana_inicio BETWEEN v_mes_inicio AND v_mes_fim
      AND status IN ('fechado','descontado')
    GROUP BY employee_id
  ) bs ON bs.employee_id = e.id
  WHERE e.status <> 'desligado'
    AND (e.termination_date IS NULL OR e.termination_date > v_mes_inicio)
    AND (COALESCE(edr.dias_presente, 0) > 0
         OR COALESCE(bs.total_desconto, 0) > 0
         OR e.recebe_alelo = true
         OR e.has_vt = true);

  -- Forcar recalculo (trigger ja roda, mas garantir)
  PERFORM public.fn_recalc_monthly_discount_report(v_report_id);

  RETURN v_report_id;
END $$;

-- ============================================================
-- BLOCO 7 — Sincronizar status quando termination_date preenchida
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_on_employee_termination()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Quando termination_date eh setada, marca status=desligado e registra terminated_at
  IF NEW.termination_date IS NOT NULL
     AND (OLD.termination_date IS NULL OR OLD.termination_date <> NEW.termination_date) THEN
    NEW.status := 'desligado'::public.employee_status;
    NEW.terminated_at := COALESCE(NEW.terminated_at, now());
  END IF;

  -- Quando termination_date eh limpa (reversao), volta para disponivel
  IF NEW.termination_date IS NULL AND OLD.termination_date IS NOT NULL THEN
    IF NEW.status = 'desligado'::public.employee_status THEN
      NEW.status := 'disponivel'::public.employee_status;
    END IF;
    NEW.terminated_at := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_on_employee_termination ON public.employees;
CREATE TRIGGER trg_on_employee_termination
  BEFORE UPDATE OF termination_date ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_employee_termination();

-- ============================================================
-- FIM FASE 3 SQL
-- ============================================================
