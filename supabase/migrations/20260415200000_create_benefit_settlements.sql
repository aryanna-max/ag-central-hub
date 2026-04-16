-- ============================================================
-- benefit_settlements: Encontro de contas semanal
-- Adiantamento (café, almoço dif, jantar) vs realizado
-- Semana fechada → desconto na próxima folha se falta
-- ============================================================

CREATE TABLE IF NOT EXISTS public.benefit_settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_inicio   DATE NOT NULL,
  semana_fim      DATE NOT NULL,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cafe_previsto   INT DEFAULT 0,
  cafe_realizado  INT DEFAULT 0,
  almoco_previsto INT DEFAULT 0,
  almoco_realizado INT DEFAULT 0,
  jantar_previsto INT DEFAULT 0,
  jantar_realizado INT DEFAULT 0,
  saldo_desconto  NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','descontado')),
  sheet_id        UUID REFERENCES public.field_expense_sheets(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bs_employee ON public.benefit_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_bs_semana   ON public.benefit_settlements(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_bs_status   ON public.benefit_settlements(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bs_employee_semana ON public.benefit_settlements(employee_id, semana_inicio);

ALTER TABLE public.benefit_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bs_all_authenticated"
  ON public.benefit_settlements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE TRIGGER set_updated_at_benefit_settlements
  BEFORE UPDATE ON public.benefit_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
