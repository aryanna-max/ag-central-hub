-- ============================================================
-- FASE 2: COMPLIANCE DOCUMENTAL
-- ============================================================

-- 1) ENUMS
CREATE TYPE public.doc_type AS ENUM (
  'aso','nr18','nr35','nr10','nr33','ficha_epi','integracao_cliente',
  'ctps','rg','cpf','cnh','comprovante_residencia','certidao_nascimento',
  'titulo_eleitor','reservista','pis','conta_bancaria','foto_3x4',
  'pcmso','pgr','seguro_vida','alvara','contrato_social','cnpj_cartao',
  'crea','art','outro'
);

CREATE TYPE public.doc_status AS ENUM (
  'valido','vencendo','vencido','pendente','nao_aplicavel'
);

-- 2) COLUNAS NOVAS EM field_expense_items
ALTER TABLE public.field_expense_items
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_document text;

-- 3) employee_documents
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type public.doc_type NOT NULL,
  doc_status public.doc_status NOT NULL DEFAULT 'pendente',
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX idx_employee_documents_expiry ON public.employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_employee_documents_status ON public.employee_documents(doc_status);

-- 4) company_documents
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  doc_type public.doc_type NOT NULL,
  doc_status public.doc_status NOT NULL DEFAULT 'pendente',
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_documents_empresa ON public.company_documents(empresa);
CREATE INDEX idx_company_documents_expiry ON public.company_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- 5) client_doc_requirements
CREATE TABLE public.client_doc_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type public.doc_type NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  validity_months integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, doc_type)
);
CREATE INDEX idx_client_doc_req_client ON public.client_doc_requirements(client_id);

-- 6) employee_client_integrations
CREATE TABLE public.employee_client_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  integration_date date,
  expiry_date date,
  status public.doc_status NOT NULL DEFAULT 'pendente',
  notes text,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, client_id)
);
CREATE INDEX idx_eci_employee ON public.employee_client_integrations(employee_id);
CREATE INDEX idx_eci_client ON public.employee_client_integrations(client_id);
CREATE INDEX idx_eci_expiry ON public.employee_client_integrations(expiry_date) WHERE expiry_date IS NOT NULL;

-- 7) monthly_compliance_tasks (calendário recorrente)
CREATE TABLE public.monthly_compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  responsible_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  is_active boolean NOT NULL DEFAULT true,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mct_day ON public.monthly_compliance_tasks(day_of_month);
CREATE INDEX idx_mct_client ON public.monthly_compliance_tasks(client_id);

-- 8) compliance_task_executions
CREATE TABLE public.compliance_task_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.monthly_compliance_tasks(id) ON DELETE CASCADE,
  reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year integer NOT NULL,
  due_date date NOT NULL,
  completed_at timestamptz,
  completed_by uuid,
  status text NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, reference_month, reference_year)
);
CREATE INDEX idx_cte_task ON public.compliance_task_executions(task_id);
CREATE INDEX idx_cte_due ON public.compliance_task_executions(due_date);
CREATE INDEX idx_cte_status ON public.compliance_task_executions(status);

-- 9) RLS — autenticados têm acesso completo (mesmo padrão das outras tabelas)
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_doc_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_client_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_compliance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_full_employee_documents ON public.employee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_full_company_documents ON public.company_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_full_client_doc_requirements ON public.client_doc_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_full_employee_client_integrations ON public.employee_client_integrations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_full_monthly_compliance_tasks ON public.monthly_compliance_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_full_compliance_task_executions ON public.compliance_task_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10) Triggers updated_at
CREATE TRIGGER trg_employee_documents_updated BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_company_documents_updated BEFORE UPDATE ON public.company_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_client_doc_req_updated BEFORE UPDATE ON public.client_doc_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_eci_updated BEFORE UPDATE ON public.employee_client_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mct_updated BEFORE UPDATE ON public.monthly_compliance_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cte_updated BEFORE UPDATE ON public.compliance_task_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();