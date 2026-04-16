-- ============================================================
-- AG CENTRAL HUB — FASE 1 — SQL S1 (CORRIGIDO)
-- Baseado no diagnóstico real de 15/04/2026
-- Cole no SQL Editor do Lovable, execute CADA BLOCO separadamente
-- ============================================================
-- CORREÇÕES vs. plano original:
--   1. handle_updated_at() NÃO EXISTE → criar primeiro
--   2. project_benefits real: almoco_type (text), NÃO almoco_diferenca_enabled (bool)
--   3. project_benefits real: NÃO tem vt, carro, fd
--   4. employee_daily_records ajustada para espelhar campos reais
--   5. vehicle_payment_history NÃO tem project_id → carro fica no entry
-- ============================================================


-- ============================================================
-- BLOCO S1-0 — CRIAR handle_updated_at (NÃO EXISTE NO BANCO)
-- Rode este PRIMEIRO. Se já existisse, daria erro — não existe.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- BLOCO S1-A — employee_daily_records (RDF digital)
-- 1 registro por funcionário por dia
-- Campos espelham project_benefits REAL + dados da escala
-- ============================================================
CREATE TABLE public.employee_daily_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- vínculos
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  schedule_entry_id UUID REFERENCES public.daily_schedule_entries(id),
  
  -- benefícios (espelha project_benefits REAL)
  cafe_enabled BOOLEAN DEFAULT false,
  cafe_value NUMERIC(8,2) DEFAULT 0,
  almoco_type TEXT DEFAULT 'va_cobre',
  almoco_diferenca_value NUMERIC(8,2) DEFAULT 0,
  jantar_enabled BOOLEAN DEFAULT false,
  jantar_value NUMERIC(8,2) DEFAULT 0,
  hospedagem_enabled BOOLEAN DEFAULT false,
  hospedagem_type TEXT DEFAULT 'pousada',
  hospedagem_value NUMERIC(8,2) DEFAULT 0,
  
  -- dados da escala (não vêm de project_benefits)
  usou_veiculo BOOLEAN DEFAULT false,
  vehicle_id UUID REFERENCES public.vehicles(id),
  
  -- pagamento
  pagamento_antecipado BOOLEAN DEFAULT false,
  dia_pagamento TEXT DEFAULT 'sexta',
  
  -- totais calculados
  total_beneficios NUMERIC(10,2) DEFAULT 0,
  
  -- controle
  source TEXT DEFAULT 'escala' CHECK (source IN ('escala', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- impede duplicata
  UNIQUE(employee_id, date)
);

-- Índices
CREATE INDEX idx_edr_employee_date ON public.employee_daily_records(employee_id, date);
CREATE INDEX idx_edr_project ON public.employee_daily_records(project_id);
CREATE INDEX idx_edr_date ON public.employee_daily_records(date);

-- RLS
ALTER TABLE public.employee_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access edr" ON public.employee_daily_records 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at automático
CREATE TRIGGER set_updated_at_edr
  BEFORE UPDATE ON public.employee_daily_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- BLOCO S1-B — benefit_settlements (encontro de contas semanal)
-- Compara adiantamentos vs. dias reais trabalhados
-- ============================================================
CREATE TABLE public.benefit_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- café
  cafe_dias_adiantados INTEGER DEFAULT 0,
  cafe_dias_trabalhados INTEGER DEFAULT 0,
  cafe_valor_adiantado NUMERIC(8,2) DEFAULT 0,
  cafe_valor_real NUMERIC(8,2) DEFAULT 0,
  cafe_saldo NUMERIC(8,2) DEFAULT 0,
  
  -- almoço diferença
  almoco_dif_dias_adiantados INTEGER DEFAULT 0,
  almoco_dif_dias_trabalhados INTEGER DEFAULT 0,
  almoco_dif_valor_adiantado NUMERIC(8,2) DEFAULT 0,
  almoco_dif_valor_real NUMERIC(8,2) DEFAULT 0,
  almoco_dif_saldo NUMERIC(8,2) DEFAULT 0,
  
  -- jantar
  jantar_dias_adiantados INTEGER DEFAULT 0,
  jantar_dias_trabalhados INTEGER DEFAULT 0,
  jantar_valor_adiantado NUMERIC(8,2) DEFAULT 0,
  jantar_valor_real NUMERIC(8,2) DEFAULT 0,
  jantar_saldo NUMERIC(8,2) DEFAULT 0,
  
  -- totais
  total_adiantado NUMERIC(10,2) DEFAULT 0,
  total_real NUMERIC(10,2) DEFAULT 0,
  total_saldo NUMERIC(10,2) DEFAULT 0,
  
  -- vínculo com folha semanal
  expense_sheet_id UUID REFERENCES public.field_expense_sheets(id),
  
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aplicado', 'cancelado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(employee_id, week_start)
);

-- RLS
ALTER TABLE public.benefit_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access bs" ON public.benefit_settlements 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at automático
CREATE TRIGGER set_updated_at_bs
  BEFORE UPDATE ON public.benefit_settlements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- BLOCO S1-C — VERIFICAÇÃO (rodar depois de S1-A e S1-B)
-- Confirma que tudo foi criado corretamente
-- ============================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('employee_daily_records', 'benefit_settlements')
ORDER BY table_name;

-- Deve retornar:
-- benefit_settlements
-- employee_daily_records
