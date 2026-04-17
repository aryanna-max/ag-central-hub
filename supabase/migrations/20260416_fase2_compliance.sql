-- ============================================================
-- FASE 2 — COMPLIANCE DOCUMENTAL
-- 5 tabelas + 2 enums + triggers + RLS
-- Data: 16/04/2026
-- ============================================================

-- ===================== ENUMS =====================

-- Tipos de documento de funcionário
CREATE TYPE public.doc_type AS ENUM (
  'aso',              -- Atestado de Saúde Ocupacional
  'nr18',             -- Segurança na Construção
  'nr35',             -- Trabalho em Altura
  'nr10',             -- Segurança em Eletricidade
  'nr33',             -- Espaço Confinado
  'ficha_epi',        -- Ficha de EPI
  'integracao',       -- Integração com cliente
  'ctps',             -- Carteira de Trabalho
  'rg',
  'cpf',
  'cnh',
  'comprovante_residencia',
  'certidao_nascimento',
  'titulo_eleitor',
  'reservista',
  'pis',
  'conta_bancaria',
  'foto_3x4',
  'crea',             -- Registro profissional
  'contrato_trabalho',
  'outro'
);

-- Status do documento
CREATE TYPE public.doc_status AS ENUM (
  'valido',
  'vencido',
  'proximo_vencer',   -- dentro de 30 dias
  'pendente',         -- nunca enviado
  'em_analise'
);

-- ===================== TABELA 1: employee_documents =====================
-- Documentos individuais de cada funcionário (ASO, NR-18, NR-35, etc.)

CREATE TABLE public.employee_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type public.doc_type NOT NULL,
  doc_status public.doc_status NOT NULL DEFAULT 'pendente',
  issue_date DATE,                      -- data de emissão
  expiry_date DATE,                     -- data de vencimento (NULL = não vence)
  file_url TEXT,                        -- link do arquivo (futuro: storage)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX idx_employee_documents_expiry ON public.employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_employee_documents_status ON public.employee_documents(doc_status);
CREATE UNIQUE INDEX idx_employee_documents_unique_active ON public.employee_documents(employee_id, doc_type)
  WHERE doc_status IN ('valido', 'proximo_vencer', 'em_analise');

-- Trigger updated_at
CREATE TRIGGER set_updated_at_employee_documents
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_documents_all" ON public.employee_documents FOR ALL USING (true) WITH CHECK (true);

-- ===================== TABELA 2: company_documents =====================
-- Documentos da empresa (PCMSO, PGR, Seguro Vida, Alvará, etc.)

CREATE TABLE public.company_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL DEFAULT 'gonzaga_berlim',  -- gonzaga_berlim | ag_cartografia | ag_topografia_avulsa
  doc_name TEXT NOT NULL,               -- ex: "PCMSO", "PGR", "Seguro Vida Coletivo"
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  doc_status public.doc_status NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_company_documents_expiry ON public.company_documents(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TRIGGER set_updated_at_company_documents
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_documents_all" ON public.company_documents FOR ALL USING (true) WITH CHECK (true);

-- ===================== TABELA 3: client_doc_requirements =====================
-- Requisitos documentais por cliente (BRK é exceção com 2 camadas)
-- Ex: BRK exige ASO + NR-18 + NR-35 + Integração SERTRAS

CREATE TABLE public.client_doc_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type public.doc_type NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  validity_days INTEGER,                -- override de validade (ex: NR-18 BRK = 730 dias)
  notes TEXT,                           -- ex: "SERTRAS exige formato específico"
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(client_id, doc_type)
);

CREATE INDEX idx_client_doc_requirements_client ON public.client_doc_requirements(client_id);

CREATE TRIGGER set_updated_at_client_doc_requirements
  BEFORE UPDATE ON public.client_doc_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_doc_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_doc_requirements_all" ON public.client_doc_requirements FOR ALL USING (true) WITH CHECK (true);

-- ===================== TABELA 4: employee_client_integrations =====================
-- Rastreia integração de cada funcionário com cada cliente
-- Se employee_id + client_id existe e status='ativo', pode ir para obra

CREATE TABLE public.employee_client_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  integration_date DATE,                -- data da integração
  expiry_date DATE,                     -- validade (NULL = não vence)
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo', 'pendente', 'vencido', 'revogado')),
  file_url TEXT,                        -- comprovante
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(employee_id, client_id)
);

CREATE INDEX idx_eci_employee ON public.employee_client_integrations(employee_id);
CREATE INDEX idx_eci_client ON public.employee_client_integrations(client_id);

CREATE TRIGGER set_updated_at_employee_client_integrations
  BEFORE UPDATE ON public.employee_client_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employee_client_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eci_all" ON public.employee_client_integrations FOR ALL USING (true) WITH CHECK (true);

-- ===================== TABELA 5: monthly_compliance_tasks =====================
-- Calendário mensal do Analista DP (dia 10 CBC, dia 15 BRK, dia 20 Memorial, dia 26 Alelo/VEM)

CREATE TABLE public.monthly_compliance_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,                  -- ex: "Enviar docs CBC/Aeroporto/PDI"
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,  -- NULL = tarefa geral
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),  -- dia do mês
  recurrence TEXT NOT NULL DEFAULT 'mensal' CHECK (recurrence IN ('mensal', 'trimestral', 'semestral', 'anual')),
  responsible_role TEXT NOT NULL DEFAULT 'financeiro',  -- role responsável (financeiro = Analista DP)
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de execução mensal (marca se a tarefa foi feita naquele mês)
CREATE TABLE public.compliance_task_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.monthly_compliance_tasks(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,        -- primeiro dia do mês (ex: 2026-04-01)
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(task_id, reference_month)
);

CREATE INDEX idx_mct_due_day ON public.monthly_compliance_tasks(due_day);
CREATE INDEX idx_cte_month ON public.compliance_task_executions(reference_month);

CREATE TRIGGER set_updated_at_monthly_compliance_tasks
  BEFORE UPDATE ON public.monthly_compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_compliance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_task_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mct_all" ON public.monthly_compliance_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cte_all" ON public.compliance_task_executions FOR ALL USING (true) WITH CHECK (true);

-- ===================== DADOS INICIAIS =====================

-- Calendário mensal do Analista DP (mapeado 15/04 da rotina real)
INSERT INTO public.monthly_compliance_tasks (title, description, due_day, recurrence, responsible_role) VALUES
  ('Doc mensal CBC/Aeroporto/PDI', 'Enviar documentação mensal para CBC, Aeroporto e PDI', 10, 'mensal', 'financeiro'),
  ('Doc mensal BRK (SERTRAS)', 'Enviar documentação mensal BRK via plataforma SERTRAS', 15, 'mensal', 'financeiro'),
  ('Doc mensal Memorial Star', 'Enviar documentação mensal Memorial Star', 20, 'mensal', 'financeiro'),
  ('NF BRK D''Agile Blue (Alldocs)', 'Emitir NF BRK via plataforma Alldocs D''Agile Blue', 22, 'mensal', 'financeiro'),
  ('Planilha Alelo + VEM + Descontos → Thyalcont', 'Gerar planilha consolidada de benefícios e enviar para contabilidade', 26, 'mensal', 'financeiro'),
  ('Conferir folha de pagamento', 'Conferir folha recebida da Thyalcont (5º dia útil)', 7, 'mensal', 'financeiro');

-- Documentos empresa conhecidos (PCMSO vencido é alerta crítico!)
INSERT INTO public.company_documents (empresa, doc_name, expiry_date, doc_status, notes) VALUES
  ('gonzaga_berlim', 'PCMSO', '2023-07-01', 'vencido', 'VENCIDO desde 07/2023 — URGENTE renovar'),
  ('gonzaga_berlim', 'PGR', NULL, 'pendente', 'Verificar validade'),
  ('gonzaga_berlim', 'Seguro Vida Coletivo', NULL, 'pendente', 'Verificar validade'),
  ('ag_cartografia', 'PCMSO', NULL, 'pendente', 'Verificar se compartilha com Gonzaga'),
  ('ag_cartografia', 'PGR', NULL, 'pendente', 'Verificar validade');

-- Requisitos padrão universais (todo cliente exige no mínimo)
-- Nota: client_id será preenchido via UI, aqui só documenta a lógica
-- BRK: ASO + NR-18 + NR-35 + Integração SERTRAS
-- HBR: ASO + NR-18
-- Engeko: ASO + NR-18 + NR-35

-- ===================== FIM FASE 2 SQL =====================
