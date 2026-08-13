-- =============================================================================
-- RETRATO DO SCHEMA REAL — NÃO É MIGRATION.
-- =============================================================================
-- Projeto Supabase: bphgtvwgsgaqaxmkrtqj (schema public)
-- Gerado em 13/08/2026 lendo o banco AO VIVO via MCP (query_database sobre
-- pg_catalog), reconstruído do catálogo. Entregável 1 da ADR-050 B2.
--
-- ⚠️ NÃO editar à mão. NÃO aplicar. Não é migration:
--    fica em supabase/ (fora de migrations/) e o nome não começa com timestamp
--    de 14 dígitos, então `supabase db push` nunca tenta aplicá-lo.
--
-- Objetivo: linha de base fiel do que está em produção, para medir deriva
-- (ver docs/arquitetura/INVENTARIO_DERIVA_SCHEMA.md) e destravar test env /
-- rollback confiável nas fases seguintes da ADR-050.
--
-- Ordem: (1) enums (2) tabelas (3) constraints (4) índices (5) funções
--        (6) triggers (7) RLS + policies (8) views.
-- Reconstruído do catálogo — fiel ao estado lógico do schema, mas pode diferir
-- em detalhes de formatação de um `supabase db dump` (sequences/ownership/grants
-- de sistema não incluídos; o foco é estrutura + lógica + RLS).
-- =============================================================================

-- =============================================================================
-- 1. TIPOS (ENUMS)
-- =============================================================================

CREATE TYPE public.absence_status AS ENUM ('planejada', 'aprovada', 'em_curso', 'concluida', 'cancelada');
CREATE TYPE public.absence_type AS ENUM ('ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'afastamento', 'falta', 'outros');
CREATE TYPE public.alert_priority AS ENUM ('urgente', 'importante', 'informacao');
CREATE TYPE public.alert_recipient AS ENUM ('operacional', 'comercial', 'financeiro', 'rh', 'sala_tecnica', 'diretoria', 'todos');
CREATE TYPE public.app_role AS ENUM ('master', 'diretor', 'operacional', 'sala_tecnica', 'comercial', 'financeiro', 'rh');
CREATE TYPE public.attendance_status AS ENUM ('presente', 'falta', 'justificado', 'atrasado');
CREATE TYPE public.billing_mode AS ENUM ('fixo_mensal', 'diarias', 'esporadico');
CREATE TYPE public.company_role AS ENUM ('topografia', 'cartografia');
CREATE TYPE public.contact_type AS ENUM ('cliente', 'financeiro', 'engenheiro', 'outro');
CREATE TYPE public.day_type AS ENUM ('normal', 'folga', 'falta', 'atestado', 'reserva_ag');
CREATE TYPE public.doc_status AS ENUM ('valido', 'vencendo', 'vencido', 'pendente', 'nao_aplicavel');
CREATE TYPE public.doc_type AS ENUM ('aso', 'nr18', 'nr35', 'nr10', 'nr33', 'ficha_epi', 'integracao_cliente', 'ctps', 'rg', 'cpf', 'cnh', 'comprovante_residencia', 'certidao_nascimento', 'titulo_eleitor', 'reservista', 'pis', 'conta_bancaria', 'foto_3x4', 'pcmso', 'pgr', 'seguro_vida', 'alvara', 'contrato_social', 'cnpj_cartao', 'crea', 'art', 'outro');
CREATE TYPE public.employee_status AS ENUM ('disponivel', 'ferias', 'licenca', 'afastado', 'desligado');
CREATE TYPE public.empresa_faturadora_enum AS ENUM ('ag_topografia', 'ag_cartografia');
CREATE TYPE public.execution_status AS ENUM ('aguardando_campo', 'em_campo', 'campo_concluido', 'aguardando_processamento', 'em_processamento', 'revisao', 'aprovado', 'entregue', 'faturamento', 'pago');
CREATE TYPE public.field_payment_status AS ENUM ('rascunho', 'em_revisao', 'aprovada', 'paga', 'cancelada', 'submetido', 'devolvido');
CREATE TYPE public.invoice_status AS ENUM ('pendente', 'emitida', 'paga', 'cancelada');
CREATE TYPE public.lead_interaction_type AS ENUM ('nota', 'ligacao', 'email', 'whatsapp', 'reuniao', 'visita');
CREATE TYPE public.lead_source AS ENUM ('whatsapp', 'telefone', 'email', 'site', 'indicacao', 'rede_social', 'licitacao', 'outros', 'site_instagram', 'cliente_recorrente', 'contrato_ativo', 'outro');
CREATE TYPE public.lead_status AS ENUM ('novo', 'em_contato', 'qualificado', 'convertido', 'descartado', 'proposta_enviada', 'aprovado', 'perdido', 'em_negociacao');
CREATE TYPE public.measurement_status AS ENUM ('rascunho', 'aguardando_aprovacao', 'aprovada', 'nf_emitida', 'paga', 'cancelada');
CREATE TYPE public.project_status AS ENUM ('planejamento', 'execucao', 'entrega', 'faturamento', 'concluido', 'pausado');
CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'enviada', 'aprovada', 'rejeitada', 'expirada');
CREATE TYPE public.proposal_unit AS ENUM ('verba', 'mes', 'diaria', 'hora', 'hectare', 'metro_linear', 'metro_quadrado', 'unidade', 'lote');
CREATE TYPE public.removal_reason AS ENUM ('campo_concluido', 'pausa_temporaria', 'reagendado', 'clima', 'equipamento', 'falta_equipe');
CREATE TYPE public.service_status AS ENUM ('planejamento', 'execucao', 'medicao', 'faturamento', 'concluido', 'cancelado');
CREATE TYPE public.tipo_documento AS ENUM ('nf', 'recibo');
CREATE TYPE public.vehicle_status AS ENUM ('disponivel', 'em_uso', 'manutencao', 'indisponivel');

-- =============================================================================
-- 2. TABELAS
-- =============================================================================

CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  priority alert_priority NOT NULL DEFAULT 'importante'::alert_priority,
  recipient alert_recipient NOT NULL,
  title text NOT NULL,
  message text,
  reference_type text,
  reference_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_to uuid,
  action_url text,
  action_label text,
  action_type text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  origem_modulo text,
  tipo text,
  alert_status text DEFAULT 'ativo'::text,
  scheduled_at timestamp with time zone,
  resolved_by_profile_id uuid
);

CREATE TABLE public.benefit_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  employee_id uuid NOT NULL,
  cafe_previsto integer DEFAULT 0,
  cafe_realizado integer DEFAULT 0,
  almoco_previsto integer DEFAULT 0,
  almoco_realizado integer DEFAULT 0,
  jantar_previsto integer DEFAULT 0,
  jantar_realizado integer DEFAULT 0,
  saldo_desconto numeric(10,2) DEFAULT 0,
  status text DEFAULT 'aberto'::text,
  sheet_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module text NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time without time zone,
  related_id uuid,
  related_type text,
  google_event_id text,
  calendar_id text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  project_id uuid,
  nome text NOT NULL,
  email text,
  telefone text,
  cargo text,
  area text,
  tipo text DEFAULT 'secundario'::text,
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.client_doc_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  doc_type doc_type NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true,
  validity_months integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  segmento text,
  contato_cliente text,
  contato_financeiro text,
  tipo text,
  codigo text,
  cep text,
  rua text,
  bairro text,
  numero text,
  cidade text,
  estado text,
  requires_nf boolean DEFAULT true,
  default_payment_days integer DEFAULT 30,
  financial_notes text,
  parent_client_id uuid
);

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_curto text NOT NULL,
  papel company_role NOT NULL,
  faturadora_enum empresa_faturadora_enum,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.company_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  doc_type doc_type NOT NULL,
  doc_status doc_status NOT NULL DEFAULT 'pendente'::doc_status,
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid
);

CREATE TABLE public.compliance_task_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  reference_month integer NOT NULL,
  reference_year integer NOT NULL,
  due_date date NOT NULL,
  completed_at timestamp with time zone,
  completed_by uuid,
  status text NOT NULL DEFAULT 'pendente'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.daily_schedule_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  daily_schedule_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  team_id uuid,
  vehicle_id uuid,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  attendance attendance_status DEFAULT 'presente'::attendance_status,
  absence_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  daily_team_assignment_id uuid,
  project_id uuid,
  removal_reason removal_reason,
  removed_at timestamp with time zone,
  is_vacation_override boolean DEFAULT false,
  day_type day_type,
  validated_at timestamp with time zone,
  validated_by_id uuid
);

CREATE TABLE public.daily_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  schedule_date date NOT NULL,
  notes text,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'planejada'::text,
  project_id uuid,
  kanban_filled boolean NOT NULL DEFAULT false,
  created_by_id uuid,
  monthly_schedule_id uuid,
  is_legacy boolean DEFAULT false,
  last_synced_at timestamp with time zone
);

CREATE TABLE public.daily_team_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  daily_schedule_id uuid NOT NULL,
  team_id uuid NOT NULL,
  vehicle_id uuid,
  location_override text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  project_id uuid
);

CREATE TABLE public.email_send_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL,
  error_message text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.email_send_state (
  id integer NOT NULL DEFAULT 1,
  retry_after_until timestamp with time zone,
  batch_size integer NOT NULL DEFAULT 10,
  send_delay_ms integer NOT NULL DEFAULT 200,
  auth_email_ttl_minutes integer NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_absences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  absence_type absence_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status absence_status NOT NULL DEFAULT 'planejada'::absence_status,
  daily_rate numeric(10,2),
  payment_method text,
  notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_by_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_client_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  client_id uuid NOT NULL,
  integration_date date,
  expiry_date date,
  status doc_status NOT NULL DEFAULT 'pendente'::doc_status,
  notes text,
  registered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_daily_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  schedule_date date NOT NULL,
  project_id uuid,
  daily_schedule_id uuid,
  attendance text DEFAULT 'presente'::text,
  cafe_provided boolean DEFAULT false,
  cafe_value numeric(10,2) DEFAULT 0,
  almoco_dif_provided boolean DEFAULT false,
  almoco_dif_value numeric(10,2) DEFAULT 0,
  jantar_provided boolean DEFAULT false,
  jantar_value numeric(10,2) DEFAULT 0,
  vt_provided boolean DEFAULT false,
  vt_value numeric(10,2) DEFAULT 4.50,
  hospedagem_provided boolean DEFAULT false,
  hospedagem_value numeric(10,2) DEFAULT 0,
  vehicle_id uuid,
  expense_sheet_id uuid,
  status text DEFAULT 'provisorio'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_dependents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  name text NOT NULL,
  cpf text,
  data_nascimento date,
  parentesco text NOT NULL DEFAULT 'outro'::text,
  is_dependente_irrf boolean NOT NULL DEFAULT false,
  is_dependente_saude boolean NOT NULL DEFAULT false,
  is_dependente_salario_familia boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  doc_type doc_type NOT NULL,
  doc_status doc_status NOT NULL DEFAULT 'pendente'::doc_status,
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_project_authorizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  project_id uuid NOT NULL,
  integration_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'pendente'::text,
  docs jsonb,
  registered_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.employee_vacations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate numeric(10,2),
  payment_method text,
  notes text,
  created_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  role text NOT NULL DEFAULT 'Ajudante'::text,
  phone text,
  email text,
  admission_date date,
  status employee_status NOT NULL DEFAULT 'disponivel'::employee_status,
  photo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  matricula text,
  has_vt boolean DEFAULT false,
  vt_cash boolean DEFAULT false,
  vt_value numeric DEFAULT 0,
  transporte_tipo text DEFAULT 'vt_cartao'::text,
  rg text,
  pis text,
  ctps_numero text,
  ctps_serie text,
  cnh text,
  cnh_categoria text,
  cnh_validade date,
  data_nascimento date,
  estado_civil text,
  genero text,
  nacionalidade text DEFAULT 'Brasileiro(a)'::text,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  job_role_id uuid,
  empresa_contratante text DEFAULT 'gonzaga_berlim'::text,
  tipo_contrato text DEFAULT 'clt'::text,
  jornada text DEFAULT '44h'::text,
  salario_base numeric(10,2),
  data_demissao date,
  motivo_demissao text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  pix_chave text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  contato_emergencia_parentesco text,
  vt_isento_desconto boolean DEFAULT false,
  recebe_alelo boolean NOT NULL DEFAULT false,
  alelo_valor_dia numeric NOT NULL DEFAULT 0,
  employer_company_id uuid NOT NULL
);

CREATE TABLE public.event_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'user'::text,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.field_expense_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL,
  discount_type text NOT NULL,
  amount numeric NOT NULL,
  observation text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_id uuid
);

CREATE TABLE public.field_expense_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  project_id uuid,
  expense_type text NOT NULL,
  nature text NOT NULL DEFAULT 'reembolso'::text,
  description text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  receiver_id uuid,
  intermediary_reason text,
  payment_status text NOT NULL DEFAULT 'pendente'::text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  item_type text NOT NULL DEFAULT 'funcionario'::text,
  payment_method text NOT NULL DEFAULT 'cartao'::text,
  receiver_type text,
  total_value numeric DEFAULT value,
  fiscal_alert boolean NOT NULL DEFAULT false,
  receiver_name text,
  receiver_document text,
  subtipo text
);

CREATE TABLE public.field_expense_sheets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_value numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho'::text,
  return_comment text,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  week_number integer NOT NULL,
  week_year integer NOT NULL,
  week_label text DEFAULT ((lpad((week_number)::text, 3, '0'::text) || '/'::text) || ((week_year % 100))::text),
  project_id uuid,
  approved_by_id uuid,
  is_legacy boolean DEFAULT false,
  codigo text,
  approval_token uuid DEFAULT gen_random_uuid(),
  approval_comments jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  project_service_id uuid,
  description text,
  value numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  codigo text,
  tipo tipo_documento NOT NULL DEFAULT 'nf'::tipo_documento,
  nf_numero text,
  nf_data date,
  empresa_faturadora empresa_faturadora_enum,
  cnpj_tomador text,
  valor_bruto numeric(12,2),
  retencao numeric(12,2) DEFAULT 0,
  valor_liquido numeric(12,2),
  status invoice_status NOT NULL DEFAULT 'pendente'::invoice_status,
  notes text,
  created_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  due_date date,
  source_ref text
);

CREATE TABLE public.job_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL DEFAULT 'campo'::text,
  cbo_code text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  interaction_type text NOT NULL DEFAULT 'nota'::text,
  content text NOT NULL,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  source lead_source NOT NULL DEFAULT 'outros'::lead_source,
  status lead_status NOT NULL DEFAULT 'novo'::lead_status,
  notes text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  servico text,
  endereco text,
  valor numeric,
  cnpj text,
  client_id uuid,
  converted_project_id uuid,
  origin text DEFAULT 'outro'::text,
  location text,
  client_type text DEFAULT 'pj'::text,
  responsible_id uuid,
  codigo text
);

CREATE TABLE public.measurement_daily_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL,
  date date NOT NULL,
  employee_id uuid NOT NULL,
  project_id uuid NOT NULL,
  day_type text DEFAULT 'normal'::text,
  worked boolean DEFAULT true,
  daily_record_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.measurement_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL,
  project_service_id uuid,
  item_number integer NOT NULL,
  description text NOT NULL,
  unit text DEFAULT 'diaria'::text,
  contracted_quantity numeric(10,2) DEFAULT 0,
  unit_value numeric(12,2) DEFAULT 0,
  total_contracted numeric(12,2) DEFAULT 0,
  measured_quantity numeric(10,2) DEFAULT 0,
  measured_value numeric(12,2) DEFAULT 0,
  accumulated_quantity numeric(10,2) DEFAULT 0,
  accumulated_value numeric(12,2) DEFAULT 0,
  remaining_quantity numeric(10,2) DEFAULT 0,
  remaining_value numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_bm text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  dias_semana integer NOT NULL DEFAULT 0,
  valor_diaria_semana numeric NOT NULL DEFAULT 0,
  dias_fds integer NOT NULL DEFAULT 0,
  valor_diaria_fds numeric NOT NULL DEFAULT 0,
  retencao_pct numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'rascunho'::text,
  nf_numero text,
  nf_data date,
  pdf_signed_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  empresa_faturadora text NOT NULL DEFAULT 'ag_topografia'::text,
  tipo_documento text NOT NULL DEFAULT 'nota_fiscal'::text,
  valor_bruto numeric DEFAULT valor_diaria_semana,
  valor_retencao numeric DEFAULT round(((valor_diaria_semana * retencao_pct) / 100.0), 2),
  valor_nf numeric DEFAULT round((valor_diaria_semana * (1.0 - (retencao_pct / 100.0))), 2),
  project_id uuid,
  instrucao_faturamento text,
  project_service_id uuid,
  responsavel_cobranca_id uuid,
  measurement_number integer,
  measurement_type text DEFAULT 'grid_diarias'::text,
  proposal_id uuid,
  client_id uuid,
  approved_by_client boolean DEFAULT false,
  approved_at timestamp with time zone,
  invoice_id uuid,
  avanco_periodo_pct numeric(5,2) DEFAULT 0,
  avanco_acumulado_pct numeric(5,2) DEFAULT 0,
  saldo_a_medir numeric(12,2) DEFAULT 0,
  requires_signature boolean DEFAULT false
);

CREATE TABLE public.monthly_compliance_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  client_id uuid,
  responsible_id uuid,
  day_of_month integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid
);

CREATE TABLE public.monthly_discount_report_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reference_month date NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'rascunho'::text,
  sent_at timestamp with time zone,
  sent_by uuid,
  applied_at timestamp with time zone,
  applied_by uuid,
  total_alelo numeric NOT NULL DEFAULT 0,
  total_vt numeric NOT NULL DEFAULT 0,
  total_descontos numeric NOT NULL DEFAULT 0,
  total_liquido numeric NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.monthly_discount_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_period_id uuid,
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  alelo_dias_uteis integer DEFAULT 0,
  alelo_dias_ausente integer DEFAULT 0,
  alelo_dias_feriado integer DEFAULT 0,
  alelo_valor_cheio numeric(10,2) DEFAULT 0,
  alelo_desconto numeric(10,2) DEFAULT 0,
  alelo_valor_final numeric(10,2) DEFAULT 0,
  vt_dias_uteis integer DEFAULT 0,
  vt_dias_ausente integer DEFAULT 0,
  vt_dias_campo_distante integer DEFAULT 0,
  vt_dias_dinheiro_integral integer DEFAULT 0,
  vt_valor_cheio numeric(10,2) DEFAULT 0,
  vt_desconto_ausencias numeric(10,2) DEFAULT 0,
  vt_desconto_salario numeric(10,2) DEFAULT 0,
  vt_valor_final numeric(10,2) DEFAULT 0,
  vt_isento boolean DEFAULT false,
  outros_descontos numeric(10,2) DEFAULT 0,
  outros_descricao text,
  total_descontos numeric(10,2) DEFAULT 0,
  status text DEFAULT 'rascunho'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_id uuid
);

CREATE TABLE public.monthly_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  vehicle_id uuid,
  schedule_type text NOT NULL DEFAULT 'mensal'::text,
  project_id uuid,
  is_legacy boolean DEFAULT false
);

CREATE TABLE public.payroll_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  competencia_inicio date NOT NULL,
  competencia_fim date NOT NULL,
  fechamento_escala date NOT NULL,
  fechamento_dp date NOT NULL,
  apresentacao_thyalcont date NOT NULL,
  data_pagamento date,
  status text DEFAULT 'aberto'::text,
  fechado_escala_por uuid,
  fechado_escala_em timestamp with time zone,
  fechado_dp_por uuid,
  fechado_dp_em timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  must_change_password boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_benefits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  cafe_enabled boolean DEFAULT false,
  cafe_value numeric DEFAULT 0,
  almoco_type text DEFAULT 'va_cobre'::text,
  almoco_diferenca_value numeric DEFAULT 0,
  jantar_enabled boolean DEFAULT false,
  jantar_value numeric DEFAULT 0,
  hospedagem_enabled boolean DEFAULT false,
  hospedagem_type text DEFAULT 'pousada'::text,
  hospedagem_value numeric DEFAULT 0,
  pagamento_antecipado boolean DEFAULT false,
  dia_pagamento text DEFAULT 'sexta'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  tipo contact_type NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  notas text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_participations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  role text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.project_scope_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  description text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_by_id uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  service_type text NOT NULL,
  billing_mode billing_mode NOT NULL DEFAULT 'esporadico'::billing_mode,
  contract_value numeric DEFAULT 0,
  cnpj_tomador text,
  nf_number text,
  nf_date date,
  status service_status NOT NULL DEFAULT 'planejamento'::service_status,
  start_date date,
  end_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  proposal_id uuid,
  scope_description text,
  daily_rate numeric(10,2),
  monthly_rate numeric(10,2),
  service_type_id uuid
);

CREATE TABLE public.project_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by_id uuid,
  modulo text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service text,
  contract_value numeric,
  lead_id uuid,
  status project_status NOT NULL DEFAULT 'planejamento'::project_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  start_date date,
  end_date date,
  empresa_faturadora text NOT NULL DEFAULT 'ag_topografia'::text,
  tipo_documento text NOT NULL DEFAULT 'nota_fiscal'::text,
  location text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true,
  conta_bancaria text,
  referencia_contrato text,
  instrucao_faturamento_variavel boolean DEFAULT false,
  client_id uuid,
  codigo text,
  cnpj_tomador text,
  execution_status execution_status DEFAULT 'aguardando_campo'::execution_status,
  needs_tech_prep boolean DEFAULT true,
  cep text,
  rua text,
  bairro text,
  numero text,
  cidade text,
  estado text,
  field_started_at date,
  field_deadline date,
  delivery_deadline date,
  field_completed_at date,
  delivered_at date,
  field_days_estimated integer,
  delivery_days_estimated integer,
  scope_description text,
  billing_type text,
  responsible_comercial_id uuid,
  responsible_campo_id uuid,
  responsible_tecnico_id uuid,
  show_in_operational boolean NOT NULL DEFAULT true,
  area_m2 numeric,
  rrt_numero text,
  rrt_emitido_em date,
  rrt_profissional_id uuid,
  nf_data date
);

CREATE TABLE public.proposal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  description text NOT NULL,
  unit text DEFAULT 'un'::text,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  unit_enum proposal_unit
);

CREATE TABLE public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  client_id uuid,
  lead_id uuid,
  empresa_faturadora text NOT NULL DEFAULT 'ag_topografia'::text,
  service text,
  scope text,
  location text,
  estimated_value numeric DEFAULT 0,
  discount_pct numeric DEFAULT 0,
  final_value numeric DEFAULT 0,
  validity_days integer DEFAULT 30,
  estimated_duration text,
  payment_conditions text,
  technical_notes text,
  status text NOT NULL DEFAULT 'rascunho'::text,
  sent_at timestamp with time zone,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  responsible_id uuid
);

CREATE TABLE public.receipt_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  valor numeric NOT NULL,
  origem_ref text,
  allocated_by_id uuid,
  allocated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  empresa_recebedora empresa_faturadora_enum NOT NULL,
  data_recebimento date NOT NULL,
  valor numeric NOT NULL,
  referencia_pagamento text NOT NULL,
  conta text,
  origem_ref text,
  observacoes text,
  estorna_id uuid,
  created_by_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.service_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.suppressed_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
  key text NOT NULL,
  value text NOT NULL
);

CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  role text NOT NULL DEFAULT 'auxiliar'::text
);

CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  leader_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  default_vehicle_id uuid,
  default_project_id uuid
);

CREATE TABLE public.technical_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scope_item_id uuid,
  title text NOT NULL,
  description text,
  assigned_to_id uuid,
  status text NOT NULL DEFAULT 'pendente'::text,
  priority text DEFAULT 'normal'::text,
  due_date date,
  completed_at timestamp with time zone,
  created_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL
);

CREATE TABLE public.vehicle_payment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  employee_id uuid,
  month integer NOT NULL,
  year integer NOT NULL,
  days_count integer NOT NULL,
  daily_rate numeric NOT NULL,
  total_value numeric NOT NULL,
  closed_at timestamp with time zone DEFAULT now(),
  closed_by uuid,
  notes text,
  status text NOT NULL DEFAULT 'pendente'::text,
  fuel_value numeric NOT NULL DEFAULT 0,
  toll_value numeric NOT NULL DEFAULT 0,
  maintenance_value numeric NOT NULL DEFAULT 0,
  period_start date,
  period_end date
);

CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  model text NOT NULL,
  brand text,
  year integer,
  status vehicle_status NOT NULL DEFAULT 'disponivel'::vehicle_status,
  daily_rate numeric(10,2) DEFAULT 0,
  km_current integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tracker_url text,
  color text,
  owner_name text,
  responsible_employee_id uuid,
  home_address text,
  is_rented boolean NOT NULL DEFAULT false,
  rental_start date,
  rental_end date
);

-- =============================================================================
-- 3. CONSTRAINTS (PK / FK / UNIQUE / CHECK)
-- =============================================================================

ALTER TABLE public.alerts ADD CONSTRAINT alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES employees(id);
ALTER TABLE public.alerts ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.alerts ADD CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES employees(id);
ALTER TABLE public.alerts ADD CONSTRAINT alerts_resolved_by_profile_id_fkey FOREIGN KEY (resolved_by_profile_id) REFERENCES profiles(id);
ALTER TABLE public.benefit_settlements ADD CONSTRAINT benefit_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.benefit_settlements ADD CONSTRAINT benefit_settlements_pkey PRIMARY KEY (id);
ALTER TABLE public.benefit_settlements ADD CONSTRAINT benefit_settlements_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES field_expense_sheets(id) ON DELETE SET NULL;
ALTER TABLE public.benefit_settlements ADD CONSTRAINT benefit_settlements_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'fechado'::text, 'descontado'::text])));
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.client_doc_requirements ADD CONSTRAINT client_doc_requirements_client_id_doc_type_key UNIQUE (client_id, doc_type);
ALTER TABLE public.client_doc_requirements ADD CONSTRAINT client_doc_requirements_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_doc_requirements ADD CONSTRAINT client_doc_requirements_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_codigo_check CHECK (((codigo IS NULL) OR (char_length(codigo) = 3)));
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);
ALTER TABLE public.clients ADD CONSTRAINT clients_parent_client_id_fkey FOREIGN KEY (parent_client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD CONSTRAINT clients_parent_not_self CHECK (((parent_client_id IS NULL) OR (parent_client_id <> id)));
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE public.company_documents ADD CONSTRAINT company_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public.company_documents ADD CONSTRAINT company_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.compliance_task_executions ADD CONSTRAINT compliance_task_executions_pkey PRIMARY KEY (id);
ALTER TABLE public.compliance_task_executions ADD CONSTRAINT compliance_task_executions_reference_month_check CHECK (((reference_month >= 1) AND (reference_month <= 12)));
ALTER TABLE public.compliance_task_executions ADD CONSTRAINT compliance_task_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES monthly_compliance_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.compliance_task_executions ADD CONSTRAINT compliance_task_executions_task_id_reference_month_referenc_key UNIQUE (task_id, reference_month, reference_year);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_daily_schedule_id_employee_id_key UNIQUE (daily_schedule_id, employee_id);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_daily_schedule_id_fkey FOREIGN KEY (daily_schedule_id) REFERENCES daily_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_daily_team_assignment_id_fkey FOREIGN KEY (daily_team_assignment_id) REFERENCES daily_team_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
ALTER TABLE public.daily_schedule_entries ADD CONSTRAINT daily_schedule_entries_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_monthly_schedule_id_fkey FOREIGN KEY (monthly_schedule_id) REFERENCES monthly_schedules(id) ON DELETE SET NULL;
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_schedule_date_key UNIQUE (schedule_date);
ALTER TABLE public.daily_team_assignments ADD CONSTRAINT daily_team_assignments_daily_schedule_id_fkey FOREIGN KEY (daily_schedule_id) REFERENCES daily_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.daily_team_assignments ADD CONSTRAINT daily_team_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_team_assignments ADD CONSTRAINT daily_team_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.daily_team_assignments ADD CONSTRAINT daily_team_assignments_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
ALTER TABLE public.daily_team_assignments ADD CONSTRAINT daily_team_assignments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);
ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);
ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'suppressed'::text, 'failed'::text, 'bounced'::text, 'complained'::text, 'dlq'::text])));
ALTER TABLE public.email_send_state ADD CONSTRAINT email_send_state_id_check CHECK ((id = 1));
ALTER TABLE public.email_send_state ADD CONSTRAINT email_send_state_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id);
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_check CHECK ((end_date >= start_date));
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_client_integrations ADD CONSTRAINT employee_client_integrations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.employee_client_integrations ADD CONSTRAINT employee_client_integrations_employee_id_client_id_key UNIQUE (employee_id, client_id);
ALTER TABLE public.employee_client_integrations ADD CONSTRAINT employee_client_integrations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_client_integrations ADD CONSTRAINT employee_client_integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_daily_schedule_id_fkey FOREIGN KEY (daily_schedule_id) REFERENCES daily_schedules(id) ON DELETE SET NULL;
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_employee_id_schedule_date_project_id_key UNIQUE (employee_id, schedule_date, project_id);
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_expense_sheet_id_fkey FOREIGN KEY (expense_sheet_id) REFERENCES field_expense_sheets(id);
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.employee_daily_records ADD CONSTRAINT employee_daily_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);
ALTER TABLE public.employee_dependents ADD CONSTRAINT employee_dependents_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_employee_id_project_id_key UNIQUE (employee_id, project_id);
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES profiles(id);
ALTER TABLE public.employee_project_authorizations ADD CONSTRAINT employee_project_authorizations_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'vencido'::text, 'pendente'::text])));
ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_vacations ADD CONSTRAINT vacation_dates_valid CHECK ((end_date >= start_date));
ALTER TABLE public.employees ADD CONSTRAINT employees_cnh_categoria_check CHECK (((cnh_categoria IS NULL) OR (cnh_categoria = ANY (ARRAY['A'::text, 'B'::text, 'AB'::text, 'C'::text, 'D'::text, 'E'::text]))));
ALTER TABLE public.employees ADD CONSTRAINT employees_cpf_key UNIQUE (cpf);
ALTER TABLE public.employees ADD CONSTRAINT employees_employer_company_id_fkey FOREIGN KEY (employer_company_id) REFERENCES companies(id);
ALTER TABLE public.employees ADD CONSTRAINT employees_empresa_contratante_check CHECK ((empresa_contratante = ANY (ARRAY['gonzaga_berlim'::text, 'ag_cartografia'::text])));
ALTER TABLE public.employees ADD CONSTRAINT employees_estado_civil_check CHECK (((estado_civil IS NULL) OR (estado_civil = ANY (ARRAY['solteiro'::text, 'casado'::text, 'divorciado'::text, 'viuvo'::text, 'uniao_estavel'::text]))));
ALTER TABLE public.employees ADD CONSTRAINT employees_genero_check CHECK (((genero IS NULL) OR (genero = ANY (ARRAY['masculino'::text, 'feminino'::text, 'outro'::text]))));
ALTER TABLE public.employees ADD CONSTRAINT employees_job_role_id_fkey FOREIGN KEY (job_role_id) REFERENCES job_roles(id);
ALTER TABLE public.employees ADD CONSTRAINT employees_jornada_check CHECK ((jornada = ANY (ARRAY['44h'::text, '36h'::text, '30h'::text, '20h'::text, 'escala'::text])));
ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE public.employees ADD CONSTRAINT employees_tipo_conta_check CHECK (((tipo_conta IS NULL) OR (tipo_conta = ANY (ARRAY['corrente'::text, 'poupanca'::text, 'salario'::text]))));
ALTER TABLE public.employees ADD CONSTRAINT employees_tipo_contrato_check CHECK ((tipo_contrato = ANY (ARRAY['clt'::text, 'prestador'::text, 'estagiario'::text, 'temporario'::text])));
ALTER TABLE public.employees ADD CONSTRAINT employees_transporte_tipo_check CHECK ((transporte_tipo = ANY (ARRAY['vt_cartao'::text, 'dinheiro'::text, 'nenhum'::text])));
ALTER TABLE public.event_log ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);
ALTER TABLE public.field_expense_discounts ADD CONSTRAINT field_expense_discounts_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.field_expense_discounts ADD CONSTRAINT field_expense_discounts_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.field_expense_discounts ADD CONSTRAINT field_expense_discounts_pkey PRIMARY KEY (id);
ALTER TABLE public.field_expense_discounts ADD CONSTRAINT field_expense_discounts_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES field_expense_sheets(id) ON DELETE CASCADE;
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_pkey PRIMARY KEY (id);
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES employees(id);
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES field_expense_sheets(id) ON DELETE CASCADE;
ALTER TABLE public.field_expense_items ADD CONSTRAINT field_expense_items_subtipo_check CHECK (((subtipo IS NULL) OR (subtipo = ANY (ARRAY['integral'::text, 'complemento'::text]))));
ALTER TABLE public.field_expense_sheets ADD CONSTRAINT field_expense_sheets_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES employees(id);
ALTER TABLE public.field_expense_sheets ADD CONSTRAINT field_expense_sheets_pkey PRIMARY KEY (id);
ALTER TABLE public.field_expense_sheets ADD CONSTRAINT field_expense_sheets_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_project_service_id_fkey FOREIGN KEY (project_service_id) REFERENCES project_services(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.job_roles ADD CONSTRAINT job_roles_department_check CHECK ((department = ANY (ARRAY['campo'::text, 'sala_tecnica'::text, 'administrativo'::text, 'diretoria'::text])));
ALTER TABLE public.job_roles ADD CONSTRAINT job_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.job_roles ADD CONSTRAINT job_roles_title_key UNIQUE (title);
ALTER TABLE public.lead_interactions ADD CONSTRAINT lead_interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_interactions ADD CONSTRAINT lead_interactions_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_status_history ADD CONSTRAINT lead_status_history_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_daily_record_id_fkey FOREIGN KEY (daily_record_id) REFERENCES employee_daily_records(id);
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_day_type_check CHECK ((day_type = ANY (ARRAY['normal'::text, 'sabado'::text, 'domingo'::text, 'feriado'::text])));
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_measurement_id_date_employee_id_key UNIQUE (measurement_id, date, employee_id);
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE;
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.measurement_daily_entries ADD CONSTRAINT measurement_daily_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE public.measurement_items ADD CONSTRAINT measurement_items_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE;
ALTER TABLE public.measurement_items ADD CONSTRAINT measurement_items_pkey PRIMARY KEY (id);
ALTER TABLE public.measurement_items ADD CONSTRAINT measurement_items_project_service_id_fkey FOREIGN KEY (project_service_id) REFERENCES project_services(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_measurement_type_check CHECK ((measurement_type = ANY (ARRAY['grid_diarias'::text, 'boletim_formal'::text, 'resumo_entrega'::text])));
ALTER TABLE public.measurements ADD CONSTRAINT measurements_pkey PRIMARY KEY (id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_project_service_id_fkey FOREIGN KEY (project_service_id) REFERENCES project_services(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES proposals(id);
ALTER TABLE public.measurements ADD CONSTRAINT measurements_responsavel_cobranca_id_fkey FOREIGN KEY (responsavel_cobranca_id) REFERENCES employees(id);
ALTER TABLE public.monthly_compliance_tasks ADD CONSTRAINT monthly_compliance_tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.monthly_compliance_tasks ADD CONSTRAINT monthly_compliance_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE public.monthly_compliance_tasks ADD CONSTRAINT monthly_compliance_tasks_day_of_month_check CHECK (((day_of_month >= 1) AND (day_of_month <= 31)));
ALTER TABLE public.monthly_compliance_tasks ADD CONSTRAINT monthly_compliance_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.monthly_compliance_tasks ADD CONSTRAINT monthly_compliance_tasks_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.monthly_discount_report_batches ADD CONSTRAINT monthly_discount_report_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.monthly_discount_reports ADD CONSTRAINT monthly_discount_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.monthly_discount_reports ADD CONSTRAINT monthly_discount_reports_employee_id_year_month_key UNIQUE (employee_id, year, month);
ALTER TABLE public.monthly_discount_reports ADD CONSTRAINT monthly_discount_reports_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE public.monthly_discount_reports ADD CONSTRAINT monthly_discount_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.monthly_discount_reports ADD CONSTRAINT monthly_discount_reports_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'revisado'::text, 'enviado'::text, 'aplicado'::text])));
ALTER TABLE public.monthly_schedules ADD CONSTRAINT monthly_schedules_month_check CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public.monthly_schedules ADD CONSTRAINT monthly_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.monthly_schedules ADD CONSTRAINT monthly_schedules_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.monthly_schedules ADD CONSTRAINT monthly_schedules_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.monthly_schedules ADD CONSTRAINT monthly_schedules_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_fechado_dp_por_fkey FOREIGN KEY (fechado_dp_por) REFERENCES profiles(id);
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_fechado_escala_por_fkey FOREIGN KEY (fechado_escala_por) REFERENCES profiles(id);
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_month_check CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'escala_fechada'::text, 'dp_fechado'::text, 'enviado_thyalcont'::text, 'pago'::text, 'encerrado'::text])));
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_year_month_key UNIQUE (year, month);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.project_benefits ADD CONSTRAINT project_benefits_pkey PRIMARY KEY (id);
ALTER TABLE public.project_benefits ADD CONSTRAINT project_benefits_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_benefits ADD CONSTRAINT project_benefits_project_id_key UNIQUE (project_id);
ALTER TABLE public.project_contacts ADD CONSTRAINT project_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.project_contacts ADD CONSTRAINT project_contacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_participations ADD CONSTRAINT project_participations_pkey PRIMARY KEY (id);
ALTER TABLE public.project_scope_items ADD CONSTRAINT project_scope_items_completed_by_id_fkey FOREIGN KEY (completed_by_id) REFERENCES employees(id);
ALTER TABLE public.project_scope_items ADD CONSTRAINT project_scope_items_pkey PRIMARY KEY (id);
ALTER TABLE public.project_scope_items ADD CONSTRAINT project_scope_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_services ADD CONSTRAINT project_services_pkey PRIMARY KEY (id);
ALTER TABLE public.project_services ADD CONSTRAINT project_services_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_services ADD CONSTRAINT project_services_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES proposals(id);
ALTER TABLE public.project_services ADD CONSTRAINT project_services_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id);
ALTER TABLE public.project_status_history ADD CONSTRAINT project_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES profiles(id);
ALTER TABLE public.project_status_history ADD CONSTRAINT project_status_history_pkey PRIMARY KEY (id);
ALTER TABLE public.project_status_history ADD CONSTRAINT project_status_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_campo_id_fkey FOREIGN KEY (responsible_campo_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_comercial_id_fkey FOREIGN KEY (responsible_comercial_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_responsible_tecnico_id_fkey FOREIGN KEY (responsible_tecnico_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_rrt_profissional_id_fkey FOREIGN KEY (rrt_profissional_id) REFERENCES employees(id);
ALTER TABLE public.proposal_items ADD CONSTRAINT proposal_items_pkey PRIMARY KEY (id);
ALTER TABLE public.proposal_items ADD CONSTRAINT proposal_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_code_unique UNIQUE (code);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.receipt_allocations ADD CONSTRAINT ck_alloc_valor_nao_zero CHECK ((valor <> (0)::numeric));
ALTER TABLE public.receipt_allocations ADD CONSTRAINT receipt_allocations_allocated_by_id_fkey FOREIGN KEY (allocated_by_id) REFERENCES profiles(id);
ALTER TABLE public.receipt_allocations ADD CONSTRAINT receipt_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE public.receipt_allocations ADD CONSTRAINT receipt_allocations_pkey PRIMARY KEY (id);
ALTER TABLE public.receipt_allocations ADD CONSTRAINT receipt_allocations_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES receipts(id);
ALTER TABLE public.receipts ADD CONSTRAINT ck_receipts_valor_nao_zero CHECK ((valor <> (0)::numeric));
ALTER TABLE public.receipts ADD CONSTRAINT receipts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.receipts ADD CONSTRAINT receipts_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.receipts ADD CONSTRAINT receipts_estorna_id_fkey FOREIGN KEY (estorna_id) REFERENCES receipts(id);
ALTER TABLE public.receipts ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);
ALTER TABLE public.service_types ADD CONSTRAINT service_types_code_key UNIQUE (code);
ALTER TABLE public.service_types ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);
ALTER TABLE public.suppressed_emails ADD CONSTRAINT suppressed_emails_email_key UNIQUE (email);
ALTER TABLE public.suppressed_emails ADD CONSTRAINT suppressed_emails_pkey PRIMARY KEY (id);
ALTER TABLE public.suppressed_emails ADD CONSTRAINT suppressed_emails_reason_check CHECK ((reason = ANY (ARRAY['unsubscribe'::text, 'bounce'::text, 'complaint'::text])));
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.team_members ADD CONSTRAINT team_members_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD CONSTRAINT teams_default_project_id_fkey FOREIGN KEY (default_project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD CONSTRAINT teams_default_vehicle_id_fkey FOREIGN KEY (default_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES employees(id);
ALTER TABLE public.teams ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE public.technical_tasks ADD CONSTRAINT technical_tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES employees(id);
ALTER TABLE public.technical_tasks ADD CONSTRAINT technical_tasks_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id);
ALTER TABLE public.technical_tasks ADD CONSTRAINT technical_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.technical_tasks ADD CONSTRAINT technical_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.technical_tasks ADD CONSTRAINT technical_tasks_scope_item_id_fkey FOREIGN KEY (scope_item_id) REFERENCES project_scope_items(id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.vehicle_payment_history ADD CONSTRAINT vehicle_payment_history_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES employees(id);
ALTER TABLE public.vehicle_payment_history ADD CONSTRAINT vehicle_payment_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public.vehicle_payment_history ADD CONSTRAINT vehicle_payment_history_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicle_payment_history ADD CONSTRAINT vehicle_payment_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_plate_key UNIQUE (plate);
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_responsible_employee_id_fkey FOREIGN KEY (responsible_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- =============================================================================
-- 4. ÍNDICES
-- =============================================================================

CREATE INDEX idx_alerts_dedup ON public.alerts USING btree (reference_id, tipo, alert_status, created_at);
CREATE INDEX idx_alerts_status ON public.alerts USING btree (alert_status, recipient);
CREATE INDEX idx_bs_employee ON public.benefit_settlements USING btree (employee_id);
CREATE UNIQUE INDEX idx_bs_employee_semana ON public.benefit_settlements USING btree (employee_id, semana_inicio);
CREATE INDEX idx_bs_semana ON public.benefit_settlements USING btree (semana_inicio);
CREATE INDEX idx_bs_status ON public.benefit_settlements USING btree (status);
CREATE INDEX idx_cc_client ON public.client_contacts USING btree (client_id);
CREATE INDEX idx_cc_project ON public.client_contacts USING btree (project_id);
CREATE INDEX idx_client_doc_req_client ON public.client_doc_requirements USING btree (client_id);
CREATE UNIQUE INDEX clients_codigo_unique ON public.clients USING btree (upper(codigo)) WHERE (codigo IS NOT NULL);
CREATE INDEX idx_clients_parent_client_id ON public.clients USING btree (parent_client_id);
CREATE UNIQUE INDEX ux_clients_cnpj ON public.clients USING btree (regexp_replace(cnpj, '\D'::text, ''::text, 'g'::text)) WHERE (cnpj IS NOT NULL);
CREATE UNIQUE INDEX ux_clients_codigo ON public.clients USING btree (codigo) WHERE (codigo IS NOT NULL);
CREATE UNIQUE INDEX ux_companies_cnpj ON public.companies USING btree (cnpj);
CREATE UNIQUE INDEX ux_companies_faturadora_enum ON public.companies USING btree (faturadora_enum) WHERE (faturadora_enum IS NOT NULL);
CREATE INDEX idx_company_documents_empresa ON public.company_documents USING btree (empresa);
CREATE INDEX idx_company_documents_expiry ON public.company_documents USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX ix_company_documents_company ON public.company_documents USING btree (company_id);
CREATE INDEX idx_cte_due ON public.compliance_task_executions USING btree (due_date);
CREATE INDEX idx_cte_status ON public.compliance_task_executions USING btree (status);
CREATE INDEX idx_cte_task ON public.compliance_task_executions USING btree (task_id);
CREATE INDEX idx_daily_entries_schedule ON public.daily_schedule_entries USING btree (daily_schedule_id);
CREATE INDEX idx_daily_schedule_date ON public.daily_schedules USING btree (schedule_date);
CREATE INDEX idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);
CREATE INDEX idx_email_send_log_message ON public.email_send_log USING btree (message_id);
CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);
CREATE INDEX idx_ea_ativas ON public.employee_absences USING btree (employee_id, start_date, end_date) WHERE (status = ANY (ARRAY['aprovada'::absence_status, 'em_curso'::absence_status]));
CREATE INDEX idx_ea_date_range ON public.employee_absences USING btree (start_date, end_date);
CREATE INDEX idx_ea_employee_status ON public.employee_absences USING btree (employee_id, status);
CREATE INDEX idx_eci_client ON public.employee_client_integrations USING btree (client_id);
CREATE INDEX idx_eci_employee ON public.employee_client_integrations USING btree (employee_id);
CREATE INDEX idx_eci_expiry ON public.employee_client_integrations USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_edr_date ON public.employee_daily_records USING btree (schedule_date);
CREATE INDEX idx_edr_employee ON public.employee_daily_records USING btree (employee_id);
CREATE INDEX idx_edr_employee_date ON public.employee_daily_records USING btree (employee_id, schedule_date);
CREATE INDEX idx_edr_project ON public.employee_daily_records USING btree (project_id);
CREATE INDEX idx_edr_status ON public.employee_daily_records USING btree (status);
CREATE INDEX idx_employee_documents_employee ON public.employee_documents USING btree (employee_id);
CREATE INDEX idx_employee_documents_expiry ON public.employee_documents USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_employee_documents_status ON public.employee_documents USING btree (doc_status);
CREATE INDEX idx_employee_vacations_dates ON public.employee_vacations USING btree (start_date, end_date);
CREATE INDEX idx_employee_vacations_employee ON public.employee_vacations USING btree (employee_id);
CREATE INDEX idx_employees_data_demissao ON public.employees USING btree (data_demissao) WHERE (data_demissao IS NOT NULL);
CREATE INDEX idx_employees_empresa ON public.employees USING btree (empresa_contratante);
CREATE INDEX idx_employees_job_role ON public.employees USING btree (job_role_id);
CREATE INDEX ix_employees_employer ON public.employees USING btree (employer_company_id);
CREATE INDEX idx_event_log_entity ON public.event_log USING btree (entity_table, entity_id, occurred_at DESC);
CREATE INDEX idx_event_log_type ON public.event_log USING btree (event_type, occurred_at DESC);
CREATE UNIQUE INDEX idx_expense_sheets_approval_token ON public.field_expense_sheets USING btree (approval_token);
CREATE INDEX idx_invoices_project ON public.invoices USING btree (project_id);
CREATE INDEX ix_invoices_project ON public.invoices USING btree (project_id);
CREATE INDEX ix_invoices_status_due ON public.invoices USING btree (status, due_date);
CREATE UNIQUE INDEX ux_invoices_empresa_nf ON public.invoices USING btree (empresa_faturadora, nf_numero) WHERE ((nf_numero IS NOT NULL) AND (status <> 'cancelada'::invoice_status));
CREATE UNIQUE INDEX ux_invoices_source_ref ON public.invoices USING btree (source_ref) WHERE (source_ref IS NOT NULL);
CREATE INDEX idx_mde_date ON public.measurement_daily_entries USING btree (date);
CREATE INDEX idx_mde_measurement ON public.measurement_daily_entries USING btree (measurement_id);
CREATE INDEX idx_mi_measurement ON public.measurement_items USING btree (measurement_id);
CREATE INDEX idx_mi_service ON public.measurement_items USING btree (project_service_id);
CREATE INDEX idx_mct_client ON public.monthly_compliance_tasks USING btree (client_id);
CREATE INDEX idx_mct_day ON public.monthly_compliance_tasks USING btree (day_of_month);
CREATE INDEX ix_monthly_compliance_company ON public.monthly_compliance_tasks USING btree (company_id);
CREATE INDEX idx_mdr_employee ON public.monthly_discount_reports USING btree (employee_id);
CREATE INDEX idx_mdr_period ON public.monthly_discount_reports USING btree (payroll_period_id);
CREATE INDEX idx_mdr_status ON public.monthly_discount_reports USING btree (status);
CREATE INDEX idx_mdr_year_month ON public.monthly_discount_reports USING btree (year, month);
CREATE INDEX idx_monthly_schedule_period ON public.monthly_schedules USING btree (year, month);
CREATE INDEX idx_pp_status ON public.payroll_periods USING btree (status);
CREATE INDEX idx_pp_year_month ON public.payroll_periods USING btree (year, month);
CREATE INDEX idx_project_contacts_project ON public.project_contacts USING btree (project_id);
CREATE INDEX idx_pp_active ON public.project_participations USING btree (project_id, employee_id) WHERE (end_date IS NULL);
CREATE INDEX idx_pp_employee ON public.project_participations USING btree (employee_id);
CREATE INDEX idx_pp_project ON public.project_participations USING btree (project_id);
CREATE INDEX idx_scope_items_project ON public.project_scope_items USING btree (project_id);
CREATE INDEX idx_project_services_project_id ON public.project_services USING btree (project_id);
CREATE INDEX idx_project_services_service_type_id ON public.project_services USING btree (service_type_id);
CREATE INDEX idx_project_services_status ON public.project_services USING btree (status);
CREATE INDEX idx_projects_client ON public.projects USING btree (client_id);
CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX idx_projects_exec_status ON public.projects USING btree (execution_status);
CREATE INDEX idx_projects_execution_status ON public.projects USING btree (execution_status);
CREATE UNIQUE INDEX ux_projects_codigo ON public.projects USING btree (codigo) WHERE (codigo IS NOT NULL);
CREATE INDEX ix_alloc_invoice ON public.receipt_allocations USING btree (invoice_id);
CREATE INDEX ix_alloc_receipt ON public.receipt_allocations USING btree (receipt_id);
CREATE UNIQUE INDEX ux_alloc_receipt_invoice ON public.receipt_allocations USING btree (receipt_id, invoice_id) WHERE (valor > (0)::numeric);
CREATE INDEX ix_receipts_client ON public.receipts USING btree (client_id, data_recebimento);
CREATE UNIQUE INDEX ux_receipts_referencia ON public.receipts USING btree (referencia_pagamento);
CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);
CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);
CREATE INDEX idx_technical_tasks_assigned ON public.technical_tasks USING btree (assigned_to_id);
CREATE INDEX idx_technical_tasks_project ON public.technical_tasks USING btree (project_id);
CREATE INDEX idx_tt_proj_status ON public.technical_tasks USING btree (project_id, status);

-- =============================================================================
-- 5. RLS — ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_doc_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_client_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_project_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_expense_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_expense_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_compliance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_discount_report_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_discount_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS — POLICIES
-- =============================================================================

CREATE POLICY "Auth full access" ON public.alerts AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY finance_ops_manage_benefit_settlements ON public.benefit_settlements AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY auth_full_calendar ON public.calendar_events AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY contact_roles_manage_client_contacts ON public.client_contacts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY auth_full_client_doc_requirements ON public.client_doc_requirements AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY adr045_clients_insert ON public.clients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY adr045_clients_update ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY clients_delete_commercial_roles ON public.clients AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role]));
CREATE POLICY clients_select_authenticated ON public.clients AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY clients_update_commercial_roles ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY clients_write_commercial_roles ON public.clients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY companies_select ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY companies_write ON public.companies AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'rh'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'rh'::app_role]));
CREATE POLICY auth_full_company_documents ON public.company_documents AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY auth_full_compliance_task_executions ON public.compliance_task_executions AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.daily_schedule_entries AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.daily_schedules AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.daily_team_assignments AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Service role can insert send log" ON public.email_send_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read send log" ON public.email_send_log AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can update send log" ON public.email_send_log AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can manage send state" ON public.email_send_state AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY ea_select ON public.employee_absences AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'rh'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY ea_write ON public.employee_absences AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'rh'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'rh'::app_role]));
CREATE POLICY hr_roles_manage_employee_client_integrations ON public.employee_client_integrations AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]));
CREATE POLICY "Authenticated users full access" ON public.employee_daily_records AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY hr_roles_manage_employee_dependents ON public.employee_dependents AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]));
CREATE POLICY hr_roles_manage_employee_documents ON public.employee_documents AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]));
CREATE POLICY auth_full_employee_project_authorizations ON public.employee_project_authorizations AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY hr_roles_manage_vacations ON public.employee_vacations AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]));
CREATE POLICY employees_select_rh ON public.employees AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['rh'::app_role]));
CREATE POLICY hr_roles_manage_employees ON public.employees AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'financeiro'::app_role]));
CREATE POLICY auth_insert_event_log ON public.event_log AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY auth_read_event_log ON public.event_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY finance_ops_manage_expense_discounts ON public.field_expense_discounts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY finance_ops_manage_expense_items ON public.field_expense_items AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY finance_ops_manage_expense_sheets ON public.field_expense_sheets AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY finance_roles_manage_invoice_items ON public.invoice_items AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]));
CREATE POLICY finance_roles_manage_invoices ON public.invoices AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]));
CREATE POLICY "Auth full access jr" ON public.job_roles AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.lead_interactions AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY auth_full_lead_status_history ON public.lead_status_history AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY leads_delete_commercial_roles ON public.leads AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role]));
CREATE POLICY leads_insert_commercial_roles ON public.leads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY leads_select_authenticated ON public.leads AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY leads_update_commercial_roles ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY "Auth full access mde" ON public.measurement_daily_entries AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Auth full access mi" ON public.measurement_items AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY measurements_auth ON public.measurements AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY auth_full_monthly_compliance_tasks ON public.monthly_compliance_tasks AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY finance_ops_manage_mdr_batches ON public.monthly_discount_report_batches AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY finance_ops_manage_mdr ON public.monthly_discount_reports AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY "Authenticated users full access" ON public.monthly_schedules AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY finance_roles_manage_payroll_periods ON public.payroll_periods AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]));
CREATE POLICY "Service role full access profiles" ON public.profiles AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((id = auth.uid()));
CREATE POLICY "Users can read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = id) OR has_role(auth.uid(), 'master'::app_role)));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));
CREATE POLICY auth_full_project_benefits ON public.project_benefits AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY contact_roles_manage_project_contacts ON public.project_contacts AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY auth_full_project_participations ON public.project_participations AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can manage scope items" ON public.project_scope_items AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can manage project_services" ON public.project_services AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY policy_psh_select ON public.project_status_history AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY psh_insert_authorized_roles ON public.project_status_history AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'operacional'::app_role, 'sala_tecnica'::app_role, 'financeiro'::app_role]));
CREATE POLICY "Auth full access" ON public.projects AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY adr045_projects_insert ON public.projects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role]));
CREATE POLICY adr045_projects_update ON public.projects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'comercial'::app_role, 'financeiro'::app_role]));
CREATE POLICY auth_full_proposal_items ON public.proposal_items AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY auth_full_proposals ON public.proposals AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY alloc_insert ON public.receipt_allocations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]));
CREATE POLICY alloc_select ON public.receipt_allocations AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY receipts_insert ON public.receipts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]));
CREATE POLICY receipts_lock_for_allocation ON public.receipts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role]))
  WITH CHECK (false);
CREATE POLICY receipts_select ON public.receipts AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY service_types_master_only_write ON public.service_types AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY service_types_read_all ON public.service_types AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'service_role'::text));
CREATE POLICY system_settings_admin_write ON public.system_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role]));
CREATE POLICY system_settings_read_authenticated ON public.system_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.team_members AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users full access" ON public.teams AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY policy_tt_delete ON public.technical_tasks AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['master'::app_role, 'diretor'::app_role]))))));
CREATE POLICY policy_tt_insert ON public.technical_tasks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['master'::app_role, 'diretor'::app_role, 'sala_tecnica'::app_role]))))));
CREATE POLICY policy_tt_update ON public.technical_tasks AS PERMISSIVE FOR UPDATE TO public
  USING (((created_by_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['master'::app_role, 'diretor'::app_role, 'sala_tecnica'::app_role])))))));
CREATE POLICY "Service role full access roles" ON public.user_roles AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY user_roles_delete_master_only ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY user_roles_insert_master_only ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'master'::app_role) AND (user_id <> auth.uid())));
CREATE POLICY user_roles_select_own_or_master ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'master'::app_role)));
CREATE POLICY user_roles_update_master_only ON public.user_roles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY finance_ops_manage_vehicle_payments ON public.vehicle_payment_history AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['master'::app_role, 'diretor'::app_role, 'financeiro'::app_role, 'operacional'::app_role]));
CREATE POLICY "Authenticated users full access" ON public.vehicles AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));

-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================

CREATE TRIGGER trg_notify_financial_alert AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION fn_notify_financial_alert();
CREATE TRIGGER trg_validate_alert_action_type BEFORE INSERT OR UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION validate_alert_action_type();
CREATE TRIGGER set_updated_at_benefit_settlements BEFORE UPDATE ON public.benefit_settlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_client_doc_req_updated BEFORE UPDATE ON public.client_doc_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_company_documents_updated BEFORE UPDATE ON public.company_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cte_updated BEFORE UPDATE ON public.compliance_task_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_advance_service_status_on_dse_validation AFTER UPDATE OF validated_at ON public.daily_schedule_entries FOR EACH ROW EXECUTE FUNCTION fn_advance_service_status_on_dse_validation();
CREATE TRIGGER trg_validate_daily_schedule_status BEFORE INSERT OR UPDATE ON public.daily_schedules FOR EACH ROW EXECUTE FUNCTION validate_daily_schedule_status();
CREATE TRIGGER set_updated_at_employee_absences BEFORE UPDATE ON public.employee_absences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_materialize_absence AFTER INSERT OR UPDATE ON public.employee_absences FOR EACH ROW EXECUTE FUNCTION fn_materialize_absence_to_dse();
CREATE TRIGGER trg_eci_updated BEFORE UPDATE ON public.employee_client_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_daily_records_updated_at BEFORE UPDATE ON public.employee_daily_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employee_dependents_updated_at BEFORE UPDATE ON public.employee_dependents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employee_documents_updated BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_validate_expense_item_status BEFORE INSERT OR UPDATE ON public.field_expense_items FOR EACH ROW EXECUTE FUNCTION validate_expense_item_status();
CREATE TRIGGER trg_validate_expense_item_type BEFORE INSERT OR UPDATE ON public.field_expense_items FOR EACH ROW EXECUTE FUNCTION validate_expense_item_type();
CREATE TRIGGER trg_expense_sheet_approved AFTER UPDATE ON public.field_expense_sheets FOR EACH ROW EXECUTE FUNCTION on_expense_sheet_approved();
CREATE TRIGGER trg_expense_sheet_updated_at BEFORE UPDATE ON public.field_expense_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_validate_expense_sheet_status BEFORE INSERT OR UPDATE ON public.field_expense_sheets FOR EACH ROW EXECUTE FUNCTION validate_expense_sheet_status();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_measurement_items_updated_at BEFORE UPDATE ON public.measurement_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_measurement_awaiting_nf AFTER UPDATE ON public.measurements FOR EACH ROW EXECUTE FUNCTION on_measurement_awaiting_nf();
CREATE TRIGGER trg_measurements_updated_at BEFORE UPDATE ON public.measurements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_validate_measurement_empresa_tipo BEFORE INSERT OR UPDATE ON public.measurements FOR EACH ROW EXECUTE FUNCTION validate_measurement_empresa_tipo();
CREATE TRIGGER trg_validate_measurement_status BEFORE INSERT OR UPDATE ON public.measurements FOR EACH ROW EXECUTE FUNCTION validate_measurement_status();
CREATE TRIGGER trg_mct_updated BEFORE UPDATE ON public.monthly_compliance_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_mdr_batches_updated_at BEFORE UPDATE ON public.monthly_discount_report_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdr_updated_at BEFORE UPDATE ON public.monthly_discount_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_project_participations_updated_at BEFORE UPDATE ON public.project_participations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_services FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER trg_materialize_services_on_project_insert AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION fn_materialize_services_on_project_insert();
CREATE TRIGGER trg_on_status_change BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION fn_on_status_change();
CREATE TRIGGER trg_validate_project_empresa_tipo BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION validate_project_empresa_tipo();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_materialize_project_services_on_proposal_approval AFTER INSERT OR UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION fn_materialize_project_services_on_proposal_approval();
CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_validate_proposal_empresa BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION validate_proposal_empresa();
CREATE TRIGGER trg_validate_proposal_status BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION validate_proposal_status();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tt_updated BEFORE UPDATE ON public.technical_tasks FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 8. VIEWS

CREATE OR REPLACE VIEW public.v_credito_cliente AS
 SELECT r.client_id,
    c.name AS cliente,
    r.empresa_recebedora,
    sum(r.valor) AS total_recebido,
    COALESCE(sum(al.alocado), (0)::numeric) AS total_alocado,
    (sum(r.valor) - COALESCE(sum(al.alocado), (0)::numeric)) AS credito_disponivel
   FROM ((receipts r
     JOIN clients c ON ((c.id = r.client_id)))
     LEFT JOIN LATERAL ( SELECT sum(ra.valor) AS alocado
           FROM receipt_allocations ra
          WHERE (ra.receipt_id = r.id)) al ON (true))
  GROUP BY r.client_id, c.name, r.empresa_recebedora;

CREATE OR REPLACE VIEW public.v_titulos_receber AS
 SELECT i.id AS titulo_id,
    i.project_id,
    p.codigo AS projeto_codigo,
    p.name AS projeto_nome,
    p.client_id,
    c.name AS cliente,
    i.empresa_faturadora,
    i.tipo,
    i.nf_numero,
    i.nf_data,
    i.due_date,
    i.valor_bruto,
    i.retencao,
    COALESCE(i.valor_liquido, i.valor_bruto) AS valor_titulo,
    COALESCE(a.valor_alocado, (0)::numeric) AS valor_recebido,
    (COALESCE(i.valor_liquido, i.valor_bruto) - COALESCE(a.valor_alocado, (0)::numeric)) AS saldo,
    a.ultimo_recebimento_em,
        CASE
            WHEN (i.status = 'cancelada'::invoice_status) THEN 'cancelado'::text
            WHEN (COALESCE(a.valor_alocado, (0)::numeric) <= (0)::numeric) THEN 'em_aberto'::text
            WHEN (COALESCE(a.valor_alocado, (0)::numeric) >= COALESCE(i.valor_liquido, i.valor_bruto)) THEN 'quitado'::text
            ELSE 'parcial'::text
        END AS situacao,
    i.status AS status_documento,
    i.source_ref
   FROM (((invoices i
     JOIN projects p ON ((p.id = i.project_id)))
     LEFT JOIN clients c ON ((c.id = p.client_id)))
     LEFT JOIN LATERAL ( SELECT sum(ra.valor) AS valor_alocado,
            max(r.data_recebimento) AS ultimo_recebimento_em
           FROM (receipt_allocations ra
             JOIN receipts r ON ((r.id = ra.receipt_id)))
          WHERE (ra.invoice_id = i.id)) a ON (true));

CREATE OR REPLACE VIEW public.vw_prazos_criticos AS
 SELECT p.id,
    p.codigo,
    p.name,
    c.name AS client_name,
    'Campo'::text AS tipo_prazo,
    p.field_deadline AS data_limite,
    (p.field_deadline - CURRENT_DATE) AS dias_restantes,
    'operacional'::text AS modulo,
    '/operacional'::text AS rota
   FROM (projects p
     LEFT JOIN clients c ON ((c.id = p.client_id)))
  WHERE ((p.field_deadline IS NOT NULL) AND (p.execution_status = ANY (ARRAY['aguardando_campo'::execution_status, 'em_campo'::execution_status])) AND ((p.field_deadline - CURRENT_DATE) <= 7))
UNION ALL
 SELECT p.id,
    p.codigo,
    p.name,
    c.name AS client_name,
    'Entrega'::text AS tipo_prazo,
    p.delivery_deadline AS data_limite,
    (p.delivery_deadline - CURRENT_DATE) AS dias_restantes,
    'sala_tecnica'::text AS modulo,
    ('/sala-tecnica/projetos/'::text || (p.id)::text) AS rota
   FROM (projects p
     LEFT JOIN clients c ON ((c.id = p.client_id)))
  WHERE ((p.delivery_deadline IS NOT NULL) AND (p.execution_status = ANY (ARRAY['aguardando_processamento'::execution_status, 'em_processamento'::execution_status, 'revisao'::execution_status, 'aprovado'::execution_status])) AND ((p.delivery_deadline - CURRENT_DATE) <= 7))
  ORDER BY 7;

CREATE OR REPLACE VIEW public.vw_tarefas_dia AS
 SELECT tt.id,
    tt.title,
    tt.status,
    tt.due_date,
    tt.assigned_to_id,
    tt.project_id,
    tt.created_by_id,
    p.codigo AS project_codigo,
    p.name AS project_name,
    p.delivery_deadline,
    e.name AS employee_name
   FROM ((technical_tasks tt
     JOIN projects p ON ((p.id = tt.project_id)))
     LEFT JOIN employees e ON ((e.id = tt.assigned_to_id)))
  WHERE (tt.status <> ALL (ARRAY['concluida'::text, 'cancelada'::text]));

-- =============================================================================
-- 9. FUNÇÕES / TRIGGER FUNCTIONS — INVENTÁRIO (assinaturas)
-- =============================================================================
-- Os CORPOS das 63 funções NÃO estão reconstruídos aqui: são ~82 KB e o caminho
-- fiel para eles é `supabase db dump` (workflow schema-baseline.yml), hoje
-- bloqueado pela ausência dos secrets SUPABASE_* no repo. Enquanto isso, o
-- inventário abaixo (nome, argumentos, retorno, linguagem, SECURITY DEFINER)
-- fecha o mapa: as triggers da seção 7 referenciam estas funções. Regerar o
-- baseline completo (com corpos) assim que os secrets existirem.
--
--   delete_email(queue_name text, message_id bigint) -> boolean  [plpgsql, SECURITY DEFINER]
--   email_queue_dispatch() -> void  [plpgsql, SECURITY DEFINER]
--   email_queue_wake() -> trigger  [plpgsql, SECURITY DEFINER]
--   enqueue_email(queue_name text, payload jsonb) -> bigint  [plpgsql, SECURITY DEFINER]
--   fn_advance_service_status_on_dse_validation() -> trigger  [plpgsql, SECURITY DEFINER]
--   fn_allocate_recebimento(p_recebimento_id uuid, p_alocacoes jsonb, p_origem_ref text DEFAULT NULL::text) -> jsonb  [plpgsql]
--   fn_client_required_doc_types(p_client_id uuid) -> TABLE(doc_type doc_type)  [sql, SECURITY DEFINER]
--   fn_cnpj_digits(p_cnpj text) -> text  [plpgsql]
--   fn_create_client(p_name text, p_cnpj text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_segmento text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text, p_parent_client_id uuid DEFAULT NULL::uuid, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   fn_create_project(p_client_id uuid, p_name text, p_empresa_faturadora text, p_ano integer DEFAULT NULL::integer, p_contract_value numeric DEFAULT NULL::numeric, p_billing_type text DEFAULT NULL::text, p_tipo_documento text DEFAULT NULL::text, p_cnpj_tomador text DEFAULT NULL::text, p_service text DEFAULT NULL::text, p_status project_status DEFAULT 'planejamento'::project_status, p_execution_status execution_status DEFAULT 'aguardando_campo'::execution_status, p_permitir_valor_baixo boolean DEFAULT false, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   fn_create_titulo(p_projeto_codigo text, p_valor_bruto numeric, p_origem_ref text, p_tipo tipo_documento DEFAULT NULL::tipo_documento, p_nf_numero text DEFAULT NULL::text, p_nf_data date DEFAULT NULL::date, p_vencimento date DEFAULT NULL::date, p_retencao numeric DEFAULT 0, p_cnpj_tomador text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   fn_employee_badge_for_project(p_employee_id uuid, p_project_id uuid) -> jsonb  [plpgsql, SECURITY DEFINER]
--   fn_employee_day_status(p_employee_id uuid, p_date date) -> TABLE(day_type day_type, attendance attendance_status, project_id uuid, project_name text, project_codigo text, absence_reason text, validated_at timestamp with time zone, validated_by_id uuid, conta_como_dia_util boolean, conta_como_vt boolean)  [plpgsql, SECURITY DEFINER]
--   fn_employees_badges_for_project(p_employee_ids uuid[], p_project_id uuid) -> TABLE(employee_id uuid, badge jsonb)  [sql, SECURITY DEFINER]
--   fn_find_approved_proposal_for_lead(p_lead_id uuid) -> TABLE(proposal_id uuid, code text, title text, approved_at timestamp with time zone, items_count bigint)  [sql, SECURITY DEFINER]
--   fn_generate_monthly_discount_batch(p_reference_month date, p_title text DEFAULT NULL::text) -> uuid  [plpgsql, SECURITY DEFINER]
--   fn_materialize_absence_to_dse() -> trigger  [plpgsql, SECURITY DEFINER]
--   fn_materialize_project_services_on_proposal_approval() -> trigger  [plpgsql, SECURITY DEFINER]
--   fn_materialize_services_on_project_insert() -> trigger  [plpgsql, SECURITY DEFINER]
--   fn_normalize_name(p_txt text) -> text  [sql]
--   fn_notify_financial_alert() -> trigger  [plpgsql, SECURITY DEFINER]
--   fn_on_status_change() -> trigger  [plpgsql]
--   fn_preencher_escala_dia(p_schedule_date date) -> TABLE(daily_schedule_id uuid, created_count integer, updated_count integer, skipped_validated_count integer, conflicts jsonb)  [plpgsql, SECURITY DEFINER]
--   fn_recalc_project_paid(p_project_id uuid) -> boolean  [plpgsql]
--   fn_register_recebimento(p_cliente_id uuid, p_valor numeric, p_data_recebimento date, p_referencia_pagamento text, p_empresa_recebedora empresa_faturadora_enum, p_alocacoes jsonb DEFAULT '[]'::jsonb, p_conta text DEFAULT NULL::text, p_origem_ref text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text) -> jsonb  [plpgsql]
--   fn_resolve_alert(p_alert_id uuid, p_resolucao text, p_origem_ref text DEFAULT NULL::text) -> jsonb  [plpgsql]
--   fn_resolver_conflito_preencher(p_entry_id uuid, p_acao text, p_new_project_id uuid DEFAULT NULL::uuid) -> void  [plpgsql, SECURITY DEFINER]
--   fn_set_updated_at() -> trigger  [plpgsql]
--   fn_unvalidate_day_entry(p_entry_id uuid, p_motivo text) -> void  [plpgsql, SECURITY DEFINER]
--   fn_update_client(p_client_id uuid, p_name text DEFAULT NULL::text, p_cnpj text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_segmento text DEFAULT NULL::text, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   fn_update_execution_status(p_projeto_codigo text, p_novo_status execution_status, p_data_efetiva date DEFAULT NULL::date, p_motivo text DEFAULT NULL::text, p_origem_ref text DEFAULT NULL::text, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   fn_update_lead_status(p_lead_id uuid, p_novo_status lead_status, p_observacao text DEFAULT NULL::text, p_origem_ref text DEFAULT NULL::text) -> jsonb  [plpgsql]
--   fn_update_project(p_project_id uuid, p_empresa_faturadora text DEFAULT NULL::text, p_contract_value numeric DEFAULT NULL::numeric, p_tipo_documento text DEFAULT NULL::text, p_billing_type text DEFAULT NULL::text, p_cnpj_tomador text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_permitir_valor_baixo boolean DEFAULT false, p_recarga boolean DEFAULT false) -> jsonb  [plpgsql]
--   get_user_role(_user_id uuid) -> app_role  [sql, SECURITY DEFINER]
--   has_any_role(_user_id uuid, _roles app_role[]) -> boolean  [sql, SECURITY DEFINER]
--   has_role(_user_id uuid, _role app_role) -> boolean  [sql, SECURITY DEFINER]
--   log_event(p_event_type text, p_entity_table text, p_entity_id uuid, p_payload jsonb DEFAULT '{}'::jsonb, p_context jsonb DEFAULT NULL::jsonb) -> uuid  [plpgsql, SECURITY DEFINER]
--   moddatetime() -> trigger  [c]
--   move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) -> bigint  [plpgsql, SECURITY DEFINER]
--   on_expense_sheet_approved() -> trigger  [plpgsql]
--   on_measurement_awaiting_nf() -> trigger  [plpgsql]
--   read_email_batch(queue_name text, batch_size integer, vt integer) -> TABLE(msg_id bigint, read_ct integer, message jsonb)  [plpgsql, SECURITY DEFINER]
--   update_updated_at_column() -> trigger  [plpgsql]
--   validate_alert_action_type() -> trigger  [plpgsql]
--   validate_attendance_status() -> trigger  [plpgsql]
--   validate_attendance_status_v2() -> trigger  [plpgsql]
--   validate_benefit_type() -> trigger  [plpgsql]
--   validate_daily_schedule_status() -> trigger  [plpgsql]
--   validate_employee_transport() -> trigger  [plpgsql]
--   validate_expense_item_status() -> trigger  [plpgsql]
--   validate_expense_item_type() -> trigger  [plpgsql]
--   validate_expense_sheet_status() -> trigger  [plpgsql]
--   validate_measurement_empresa_tipo() -> trigger  [plpgsql]
--   validate_measurement_status() -> trigger  [plpgsql]
--   validate_medicao_status() -> trigger  [plpgsql]
--   validate_payment_item_status() -> trigger  [plpgsql]
--   validate_payment_method_type() -> trigger  [plpgsql]
--   validate_payment_review_action() -> trigger  [plpgsql]
--   validate_project_benefits() -> trigger  [plpgsql]
--   validate_project_empresa_tipo() -> trigger  [plpgsql]
--   validate_proposal_empresa() -> trigger  [plpgsql]
--   validate_proposal_status() -> trigger  [plpgsql]
--   validate_reopen_history_action() -> trigger  [plpgsql]
