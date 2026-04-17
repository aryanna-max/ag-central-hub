-- ============================================================
-- MIGRAÇÃO: Refatorar measurements + criar measurement_items + measurement_daily_entries
-- Data: 16/04/2026
-- NÃO EXECUTAR AUTOMATICAMENTE — Aryanna cola no SQL Editor
-- ============================================================

-- ============================================================
-- BLOCO 1 — Adicionar FKs e colunas que faltam em measurements
-- ============================================================
ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS measurement_number INTEGER,
  ADD COLUMN IF NOT EXISTS measurement_type TEXT DEFAULT 'grid_diarias'
    CHECK (measurement_type IN ('grid_diarias', 'boletim_formal', 'resumo_entrega')),
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES public.proposals(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS approved_by_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS retencao_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_retencao NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avanco_periodo_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avanco_acumulado_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_a_medir NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT false;

-- ============================================================
-- BLOCO 2 — Criar measurement_items (itens da medição = itens do contrato)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.measurement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,

  -- FK para o item do contrato/proposta
  project_service_id UUID REFERENCES public.project_services(id),

  -- Dados do item (herdados do project_service, editáveis na medição)
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'diaria',

  -- Valores contratados (snapshot da proposta)
  contracted_quantity NUMERIC(10,2) DEFAULT 0,
  unit_value NUMERIC(12,2) DEFAULT 0,
  total_contracted NUMERIC(12,2) DEFAULT 0,

  -- Medido neste período
  measured_quantity NUMERIC(10,2) DEFAULT 0,
  measured_value NUMERIC(12,2) DEFAULT 0,

  -- Acumulado (soma de todas medições anteriores + esta)
  accumulated_quantity NUMERIC(10,2) DEFAULT 0,
  accumulated_value NUMERIC(12,2) DEFAULT 0,

  -- Saldo
  remaining_quantity NUMERIC(10,2) DEFAULT 0,
  remaining_value NUMERIC(12,2) DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mi_measurement ON public.measurement_items(measurement_id);
CREATE INDEX IF NOT EXISTS idx_mi_service ON public.measurement_items(project_service_id);

ALTER TABLE public.measurement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access mi" ON public.measurement_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_measurement_items_updated_at
  BEFORE UPDATE ON public.measurement_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BLOCO 3 — Criar measurement_daily_entries (grid dias x funcionários)
-- Vincula medição com os registros diários da escala
-- ============================================================
CREATE TABLE IF NOT EXISTS public.measurement_daily_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),

  -- Tipo do dia
  day_type TEXT DEFAULT 'normal'
    CHECK (day_type IN ('normal', 'sabado', 'domingo', 'feriado')),
  worked BOOLEAN DEFAULT true,

  -- FK para registro da escala (rastreabilidade)
  daily_record_id UUID REFERENCES public.employee_daily_records(id),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(measurement_id, date, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_mde_measurement ON public.measurement_daily_entries(measurement_id);
CREATE INDEX IF NOT EXISTS idx_mde_date ON public.measurement_daily_entries(date);

ALTER TABLE public.measurement_daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access mde" ON public.measurement_daily_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
