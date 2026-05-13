-- ============================================================================
-- Fase 4 — UI Comercial: Proposta → Serviços → Projeto
-- Decisão #57. Princípios: P4 (FK não texto livre), P14 (seed só em domínio).
--
-- Entregas:
--   1) Tabela-domínio service_types (seed dos 9 tipos atuais).
--   2) project_services.service_type_id FK + backfill best-effort.
--   3) Enum proposal_unit + coluna proposal_items.unit_enum + backfill.
--   4) Trigger fn_materialize_project_services_on_proposal_approval.
--   5) Função fn_find_approved_proposal_for_lead (RPC).
--   6) Trigger fn_advance_service_status_on_dse_validation.
--   7) RLS para service_types.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) TABELA-DOMÍNIO service_types
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.service_types IS
  'Domínio dos tipos de serviço comercializáveis. P4: substitui texto livre em project_services.service_type.';

-- Seed pelos 9 valores reais do datalist em ProjectServicesSection.tsx (28/04/2026)
INSERT INTO public.service_types (code, label, category, sort_order) VALUES
  ('topografia_obras',              'Topografia de Obras',           'topografia',  10),
  ('topografia_projeto',            'Topografia de Projeto',         'topografia',  20),
  ('levantamento_planialtimetrico', 'Levantamento Planialtimétrico', 'topografia',  30),
  ('georreferenciamento',           'Georreferenciamento',           'geo',         40),
  ('locacao_obra',                  'Locação de Obra',               'topografia',  50),
  ('cartografia',                   'Cartografia',                   'geo',         60),
  ('topografia_industrial',         'Topografia Industrial',         'topografia',  70),
  ('acompanhamento_obras',          'Acompanhamento de Obras',       'topografia',  80),
  ('levantamento_cadastral_urbano', 'Levantamento Cadastral Urbano', 'geo',         90)
ON CONFLICT (code) DO NOTHING;

-- RLS: leitura para todos autenticados; escrita só master.
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_types_read_all
  ON public.service_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY service_types_master_only_write
  ON public.service_types
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- ============================================================================
-- 2) project_services.service_type_id (FK) + backfill
-- ============================================================================

ALTER TABLE public.project_services
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

CREATE INDEX IF NOT EXISTS idx_project_services_service_type_id
  ON public.project_services(service_type_id);

-- Backfill: tenta casar service_type (texto) por code derivado ou por label exato.
UPDATE public.project_services ps
SET service_type_id = st.id
FROM public.service_types st
WHERE ps.service_type_id IS NULL
  AND (
       lower(regexp_replace(ps.service_type, '[^a-zA-Z0-9]+', '_', 'g')) = st.code
    OR lower(ps.service_type) = lower(st.label)
  );

COMMENT ON COLUMN public.project_services.service_type IS
  'DEPRECATED — usar service_type_id (FK). Coluna mantida para registros legados que não bateram no backfill.';

-- ============================================================================
-- 3) Enum proposal_unit + proposal_items.unit_enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_unit') THEN
    CREATE TYPE public.proposal_unit AS ENUM (
      'verba',
      'mes',
      'diaria',
      'hora',
      'hectare',
      'metro_linear',
      'metro_quadrado',
      'unidade',
      'lote'
    );
  END IF;
END$$;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS unit_enum public.proposal_unit;

UPDATE public.proposal_items
SET unit_enum = CASE
  WHEN unit IS NULL THEN 'verba'::public.proposal_unit
  WHEN lower(unit) LIKE '%verba%' THEN 'verba'::public.proposal_unit
  WHEN lower(unit) IN ('mes', 'mês', 'mensal', 'mensais') THEN 'mes'::public.proposal_unit
  WHEN lower(unit) LIKE '%diári%' OR lower(unit) LIKE '%diari%' OR lower(unit) = 'dia' THEN 'diaria'::public.proposal_unit
  WHEN lower(unit) LIKE '%hor%' THEN 'hora'::public.proposal_unit
  WHEN lower(unit) LIKE '%hectare%' OR lower(unit) = 'ha' THEN 'hectare'::public.proposal_unit
  WHEN lower(unit) LIKE '%metro linear%' OR lower(unit) = 'ml' THEN 'metro_linear'::public.proposal_unit
  WHEN lower(unit) LIKE '%metro quadrado%' OR lower(unit) IN ('m2', 'm²') THEN 'metro_quadrado'::public.proposal_unit
  WHEN lower(unit) IN ('un', 'und', 'unidade', 'unidades') THEN 'unidade'::public.proposal_unit
  WHEN lower(unit) LIKE '%lote%' THEN 'lote'::public.proposal_unit
  ELSE 'verba'::public.proposal_unit
END
WHERE unit_enum IS NULL;

COMMENT ON COLUMN public.proposal_items.unit IS
  'DEPRECATED — usar unit_enum (typed). Coluna mantida para backfill manual de divergências.';

-- ============================================================================
-- 4) TRIGGER: materializa project_services ao aprovar proposta
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_materialize_project_services_on_proposal_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_default_service_type_id uuid;
  v_items_count int;
BEGIN
  -- Só dispara na transição → aprovada (não em re-aprovação direta)
  IF NEW.status <> 'aprovada' OR (OLD.status IS NOT NULL AND OLD.status = 'aprovada') THEN
    RETURN NEW;
  END IF;

  -- Achar projeto ligado ao mesmo lead. Sem projeto ainda → conversão acontecerá
  -- quando o lead for convertido (LeadConvertFullDialog dispara INSERT em projects;
  -- não precisamos materializar aqui ainda, porque o gatilho corre antes do projeto existir).
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE lead_id = NEW.lead_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Default fallback service_type (acompanhamento como neutro genérico)
  SELECT id INTO v_default_service_type_id
  FROM public.service_types
  WHERE code = 'acompanhamento_obras'
  LIMIT 1;

  -- Materializar 1 project_service por proposal_item.
  -- Idempotência: apenas inserir se ainda não existe item com (project_id, proposal_id, service_type)
  -- igual (proxy de sort_order, já que project_services não tem coluna sort_order).
  INSERT INTO public.project_services (
    project_id,
    proposal_id,
    service_type,
    service_type_id,
    billing_mode,
    contract_value,
    scope_description,
    status,
    notes
  )
  SELECT
    v_project_id,
    NEW.id,
    pi.description,
    COALESCE(
      (SELECT st.id FROM public.service_types st
        WHERE position(st.code IN lower(regexp_replace(pi.description, '[^a-zA-Z0-9]+', '_', 'g'))) > 0
        ORDER BY length(st.code) DESC
        LIMIT 1),
      v_default_service_type_id
    ),
    CASE pi.unit_enum
      WHEN 'mes' THEN 'fixo_mensal'::public.billing_mode
      WHEN 'diaria' THEN 'diarias'::public.billing_mode
      ELSE 'esporadico'::public.billing_mode
    END,
    pi.total_price,
    pi.description,
    'planejamento'::public.service_status,
    'Materializado da proposta ' || NEW.code || ' em ' || now()::date::text
  FROM public.proposal_items pi
  WHERE pi.proposal_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_services ps
      WHERE ps.project_id   = v_project_id
        AND ps.proposal_id  = NEW.id
        AND ps.service_type = pi.description
    );

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  -- Log em event_log (Camada C0.4)
  INSERT INTO public.event_log (
    event_type, entity_table, entity_id, actor_type, actor_id, payload
  )
  VALUES (
    'proposal.materialized',
    'proposals',
    NEW.id,
    CASE WHEN auth.uid() IS NULL THEN 'trigger' ELSE 'user' END,
    auth.uid(),
    jsonb_build_object(
      'project_id', v_project_id,
      'proposal_code', NEW.code,
      'services_created', v_items_count
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_project_services_on_proposal_approval ON public.proposals;
CREATE TRIGGER trg_materialize_project_services_on_proposal_approval
  AFTER INSERT OR UPDATE OF status ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_materialize_project_services_on_proposal_approval();

-- ============================================================================
-- 4b) TRIGGER: ao criar projeto, materializa serviços de propostas já aprovadas
--     do mesmo lead. Cobre o caso "aprovou proposta antes de converter o lead".
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_materialize_services_on_project_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_service_type_id uuid;
  v_total_inserted int := 0;
  v_inserted_now int;
  r_proposal record;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_default_service_type_id
  FROM public.service_types
  WHERE code = 'acompanhamento_obras'
  LIMIT 1;

  FOR r_proposal IN
    SELECT id, code
    FROM public.proposals
    WHERE lead_id = NEW.lead_id
      AND status = 'aprovada'
  LOOP
    INSERT INTO public.project_services (
      project_id, proposal_id, service_type, service_type_id, billing_mode,
      contract_value, scope_description, status, notes
    )
    SELECT
      NEW.id,
      r_proposal.id,
      pi.description,
      COALESCE(
        (SELECT st.id FROM public.service_types st
          WHERE position(st.code IN lower(regexp_replace(pi.description, '[^a-zA-Z0-9]+', '_', 'g'))) > 0
          ORDER BY length(st.code) DESC
          LIMIT 1),
        v_default_service_type_id
      ),
      CASE pi.unit_enum
        WHEN 'mes' THEN 'fixo_mensal'::public.billing_mode
        WHEN 'diaria' THEN 'diarias'::public.billing_mode
        ELSE 'esporadico'::public.billing_mode
      END,
      pi.total_price,
      pi.description,
      'planejamento'::public.service_status,
      'Materializado da proposta ' || r_proposal.code || ' em ' || now()::date::text
    FROM public.proposal_items pi
    WHERE pi.proposal_id = r_proposal.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.project_services ps
        WHERE ps.project_id   = NEW.id
          AND ps.proposal_id  = r_proposal.id
          AND ps.service_type = pi.description
      );

    GET DIAGNOSTICS v_inserted_now = ROW_COUNT;
    v_total_inserted := v_total_inserted + v_inserted_now;
  END LOOP;

  IF v_total_inserted > 0 THEN
    INSERT INTO public.event_log (
      event_type, entity_table, entity_id, actor_type, actor_id, payload
    )
    VALUES (
      'project.services_materialized',
      'projects',
      NEW.id,
      CASE WHEN auth.uid() IS NULL THEN 'trigger' ELSE 'user' END,
      auth.uid(),
      jsonb_build_object(
        'lead_id', NEW.lead_id,
        'services_created', v_total_inserted
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_services_on_project_insert ON public.projects;
CREATE TRIGGER trg_materialize_services_on_project_insert
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_materialize_services_on_project_insert();

-- ============================================================================
-- 5) FUNÇÃO RPC: fn_find_approved_proposal_for_lead
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_find_approved_proposal_for_lead(p_lead_id uuid)
RETURNS TABLE (
  proposal_id   uuid,
  code          text,
  title         text,
  approved_at   timestamptz,
  items_count   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.code,
    p.title,
    p.approved_at,
    (SELECT COUNT(*) FROM public.proposal_items pi WHERE pi.proposal_id = p.id)
  FROM public.proposals p
  WHERE p.lead_id = p_lead_id
    AND p.status = 'aprovada'
  ORDER BY p.approved_at DESC NULLS LAST, p.created_at DESC;
$$;

COMMENT ON FUNCTION public.fn_find_approved_proposal_for_lead IS
  'Retorna todas as propostas aprovadas de um lead. 0 linhas = nenhuma; 1 = caminho feliz; >1 = combobox no LeadConvertFullDialog.';

-- ============================================================================
-- 6) TRIGGER: avança service_status ao validar entry em campo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_advance_service_status_on_dse_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara na transição NULL → não-NULL (primeira validação do dia)
  IF NEW.validated_at IS NULL OR OLD.validated_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.project_services
  SET status = 'execucao'::public.service_status,
      start_date = COALESCE(start_date, current_date)
  WHERE project_id = NEW.project_id
    AND status = 'planejamento'::public.service_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_service_status_on_dse_validation ON public.daily_schedule_entries;
CREATE TRIGGER trg_advance_service_status_on_dse_validation
  AFTER UPDATE OF validated_at ON public.daily_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_advance_service_status_on_dse_validation();

COMMIT;
