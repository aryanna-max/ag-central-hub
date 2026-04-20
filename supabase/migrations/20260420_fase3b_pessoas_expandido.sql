-- ============================================================
-- FASE 3b — EXPANDIR CADASTRO DE FUNCIONARIOS
-- + CARGOS (job_roles) + PERIODOS DE COMPETENCIA (payroll_periods)
-- + DESCONTOS MENSAIS (monthly_discount_reports)
-- Data: 20/04/2026
-- Regra: menos texto livre, mais FK e enum/CHECK
-- Empresas: APENAS gonzaga_berlim e ag_cartografia (2 CNPJs)
-- ============================================================

-- ============================================================
-- BLOCO 1a — job_roles (cargos com departamento e CBO)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL DEFAULT 'campo'
    CHECK (department IN ('campo', 'sala_tecnica', 'administrativo', 'diretoria')),
  cbo_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.job_roles (title, department) VALUES
  ('Topógrafo', 'campo'),
  ('Topógrafo I', 'campo'),
  ('Topógrafo II', 'campo'),
  ('Topógrafo III', 'campo'),
  ('Topógrafo III A', 'campo'),
  ('Topógrafo IV', 'campo'),
  ('Ajudante de Topografia', 'campo'),
  ('Auxiliar de Topografia', 'campo'),
  ('Desenhista', 'sala_tecnica'),
  ('Cadista', 'sala_tecnica'),
  ('Projetista', 'sala_tecnica'),
  ('Técnico em Geoprocessamento', 'sala_tecnica'),
  ('Estagiário', 'sala_tecnica'),
  ('Técnico em Saneamento', 'sala_tecnica'),
  ('Cartógrafo', 'sala_tecnica'),
  ('Administrativo', 'administrativo'),
  ('Financeiro', 'administrativo'),
  ('Comercial', 'administrativo'),
  ('RH', 'administrativo'),
  ('Almoxarife', 'administrativo'),
  ('Motorista', 'campo'),
  ('Auxiliar', 'administrativo'),
  ('Gerente Operacional', 'diretoria'),
  ('Líder Sala Técnica', 'diretoria'),
  ('Diretor', 'diretoria')
ON CONFLICT (title) DO NOTHING;

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access jr" ON public.job_roles;
CREATE POLICY "Auth full access jr" ON public.job_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- BLOCO 1b — EMPLOYEES: novos campos (pessoais, endereco,
-- contrato, bancario, emergencia)
-- ============================================================

ALTER TABLE public.employees
  -- Dados pessoais
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS pis TEXT,
  ADD COLUMN IF NOT EXISTS ctps_numero TEXT,
  ADD COLUMN IF NOT EXISTS ctps_serie TEXT,
  ADD COLUMN IF NOT EXISTS cnh TEXT,
  ADD COLUMN IF NOT EXISTS cnh_categoria TEXT
    CHECK (cnh_categoria IS NULL OR cnh_categoria IN ('A','B','AB','C','D','E')),
  ADD COLUMN IF NOT EXISTS cnh_validade DATE,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT
    CHECK (estado_civil IS NULL OR estado_civil IN ('solteiro','casado','divorciado','viuvo','uniao_estavel')),
  ADD COLUMN IF NOT EXISTS genero TEXT
    CHECK (genero IS NULL OR genero IN ('masculino','feminino','outro')),
  ADD COLUMN IF NOT EXISTS nacionalidade TEXT DEFAULT 'Brasileiro(a)',
  -- Endereco
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS rua TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  -- Contrato
  ADD COLUMN IF NOT EXISTS job_role_id UUID REFERENCES public.job_roles(id),
  ADD COLUMN IF NOT EXISTS empresa_contratante TEXT DEFAULT 'gonzaga_berlim'
    CHECK (empresa_contratante IN ('gonzaga_berlim', 'ag_cartografia')),
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'clt'
    CHECK (tipo_contrato IN ('clt', 'prestador', 'estagiario', 'temporario')),
  ADD COLUMN IF NOT EXISTS jornada TEXT DEFAULT '44h'
    CHECK (jornada IN ('44h', '36h', '30h', '20h', 'escala')),
  ADD COLUMN IF NOT EXISTS salario_base NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS data_demissao DATE,
  ADD COLUMN IF NOT EXISTS motivo_demissao TEXT,
  -- Bancario
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS conta TEXT,
  ADD COLUMN IF NOT EXISTS tipo_conta TEXT
    CHECK (tipo_conta IS NULL OR tipo_conta IN ('corrente','poupanca','salario')),
  ADD COLUMN IF NOT EXISTS pix_chave TEXT,
  -- Contato emergencia
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco TEXT,
  -- Flag de isencao do desconto VT 6%
  ADD COLUMN IF NOT EXISTS vt_isento_desconto BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_employees_job_role ON public.employees(job_role_id);
CREATE INDEX IF NOT EXISTS idx_employees_empresa ON public.employees(empresa_contratante);
CREATE INDEX IF NOT EXISTS idx_employees_data_demissao
  ON public.employees(data_demissao) WHERE data_demissao IS NOT NULL;

-- ============================================================
-- BLOCO 1c — payroll_periods (competencia / ciclo de folha)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  competencia_inicio DATE NOT NULL,
  competencia_fim DATE NOT NULL,
  fechamento_escala DATE NOT NULL,
  fechamento_dp DATE NOT NULL,
  apresentacao_thyalcont DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'aberto'
    CHECK (status IN ('aberto','escala_fechada','dp_fechado','enviado_thyalcont','pago','encerrado')),
  fechado_escala_por UUID REFERENCES public.profiles(id),
  fechado_escala_em TIMESTAMPTZ,
  fechado_dp_por UUID REFERENCES public.profiles(id),
  fechado_dp_em TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_pp_year_month ON public.payroll_periods(year, month);
CREATE INDEX IF NOT EXISTS idx_pp_status ON public.payroll_periods(status);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access pp" ON public.payroll_periods;
CREATE POLICY "Auth full access pp" ON public.payroll_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_payroll_periods_updated_at ON public.payroll_periods;
CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BLOCO 1d — monthly_discount_reports (relatorio dia 26)
-- Um registro por funcionario / competencia
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_discount_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  -- Alelo
  alelo_dias_uteis INTEGER DEFAULT 0,
  alelo_dias_ausente INTEGER DEFAULT 0,
  alelo_dias_feriado INTEGER DEFAULT 0,
  alelo_valor_cheio NUMERIC(10,2) DEFAULT 0,
  alelo_desconto NUMERIC(10,2) DEFAULT 0,
  alelo_valor_final NUMERIC(10,2) DEFAULT 0,
  -- VT
  vt_dias_uteis INTEGER DEFAULT 0,
  vt_dias_ausente INTEGER DEFAULT 0,
  vt_dias_campo_distante INTEGER DEFAULT 0,
  vt_dias_dinheiro_integral INTEGER DEFAULT 0,
  vt_valor_cheio NUMERIC(10,2) DEFAULT 0,
  vt_desconto_ausencias NUMERIC(10,2) DEFAULT 0,
  vt_desconto_salario NUMERIC(10,2) DEFAULT 0,
  vt_valor_final NUMERIC(10,2) DEFAULT 0,
  vt_isento BOOLEAN DEFAULT false,
  -- Outros descontos
  outros_descontos NUMERIC(10,2) DEFAULT 0,
  outros_descricao TEXT,
  -- Total
  total_descontos NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','revisado','enviado','aplicado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_mdr_employee ON public.monthly_discount_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_mdr_year_month ON public.monthly_discount_reports(year, month);
CREATE INDEX IF NOT EXISTS idx_mdr_period ON public.monthly_discount_reports(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_mdr_status ON public.monthly_discount_reports(status);

ALTER TABLE public.monthly_discount_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access mdr" ON public.monthly_discount_reports;
CREATE POLICY "Auth full access mdr" ON public.monthly_discount_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_mdr_updated_at ON public.monthly_discount_reports;
CREATE TRIGGER update_mdr_updated_at
  BEFORE UPDATE ON public.monthly_discount_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BLOCO 8 — Backfill: role (texto) -> job_role_id (FK)
-- NAO dropa a coluna role (compatibilidade)
-- ============================================================

UPDATE public.employees e
SET job_role_id = jr.id
FROM public.job_roles jr
WHERE LOWER(TRIM(e.role)) = LOWER(TRIM(jr.title))
  AND e.job_role_id IS NULL;

-- Backfill tipo_contrato a partir da matricula (se ainda nulo)
UPDATE public.employees
SET tipo_contrato = 'clt'
WHERE tipo_contrato IS NULL AND matricula ~ '^000';

UPDATE public.employees
SET tipo_contrato = 'prestador'
WHERE tipo_contrato IS NULL AND matricula ILIKE 'PREST-%';

-- ============================================================
-- FIM FASE 3b SQL
-- ============================================================
