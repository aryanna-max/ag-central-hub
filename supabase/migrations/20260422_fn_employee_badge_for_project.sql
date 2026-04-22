-- =============================================================================
-- Validação docs funcionário × cliente — função + helpers (Gap 5)
-- =============================================================================
-- Resolve: Alcione não consegue saber se Marcelo pode escalar funcionário X
-- em cliente Y sem verificar manualmente ASO/NR-18/integração em várias telas.
--
-- Entrega: fn_employee_badge_for_project(emp_id, project_id) retorna JSONB
-- estruturado com cor (verde/amarelo/vermelho) + lista de razões.
--
-- Arquitetura v2 seção 8 (badge escala): verde = OK, amarelo = atenção,
-- vermelho = bloqueio.
-- =============================================================================

-- Lista doc_types obrigatórios de um cliente
CREATE OR REPLACE FUNCTION public.fn_client_required_doc_types(p_client_id UUID)
RETURNS TABLE(doc_type public.doc_type)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT doc_type
  FROM public.client_doc_requirements
  WHERE client_id = p_client_id
    AND is_mandatory = true;
$$;

COMMENT ON FUNCTION public.fn_client_required_doc_types IS
  'Lista doc_types obrigatórios de um cliente (is_mandatory=true). Alimenta fn_employee_badge_for_project.';

-- =============================================================================
-- Função principal: fn_employee_badge_for_project
-- =============================================================================
-- Retorna JSONB:
--   {
--     "color": "verde" | "amarelo" | "vermelho",
--     "reason": "resumo humano",
--     "missing_docs": ["nr18", "integracao_cliente"],
--     "expired_docs": ["aso"],
--     "expiring_docs": [{"type":"nr35","expiry_date":"2026-05-20","days_left":28}],
--     "not_integrated": false,
--     "integration_expired": false,
--     "required_docs": ["aso","nr18","integracao_cliente"]
--   }

CREATE OR REPLACE FUNCTION public.fn_employee_badge_for_project(
  p_employee_id UUID,
  p_project_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_required_docs public.doc_type[];
  v_missing public.doc_type[];
  v_expired public.doc_type[];
  v_expiring JSONB;
  v_integration RECORD;
  v_not_integrated BOOLEAN := false;
  v_integration_expired BOOLEAN := false;
  v_integration_required BOOLEAN := false;
  v_color TEXT;
  v_reason TEXT;
BEGIN
  -- 1. Buscar cliente do projeto
  SELECT client_id INTO v_client_id
  FROM public.projects WHERE id = p_project_id;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'color', 'amarelo',
      'reason', 'Projeto sem cliente vinculado',
      'missing_docs', '[]'::jsonb,
      'expired_docs', '[]'::jsonb,
      'expiring_docs', '[]'::jsonb,
      'not_integrated', false,
      'integration_expired', false,
      'required_docs', '[]'::jsonb
    );
  END IF;

  -- 2. Lista de doc_types obrigatórios do cliente
  SELECT array_agg(doc_type) INTO v_required_docs
  FROM public.fn_client_required_doc_types(v_client_id);

  IF v_required_docs IS NULL OR array_length(v_required_docs, 1) = 0 THEN
    RETURN jsonb_build_object(
      'color', 'verde',
      'reason', 'Cliente sem requisitos documentais cadastrados',
      'missing_docs', '[]'::jsonb,
      'expired_docs', '[]'::jsonb,
      'expiring_docs', '[]'::jsonb,
      'not_integrated', false,
      'integration_expired', false,
      'required_docs', '[]'::jsonb
    );
  END IF;

  v_integration_required := ('integracao_cliente' = ANY(v_required_docs));

  -- 3. Docs faltando (nunca cadastrados OU marcados como pendente)
  SELECT array_agg(dt) INTO v_missing
  FROM unnest(v_required_docs) AS dt
  WHERE dt != 'integracao_cliente'
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_documents ed
      WHERE ed.employee_id = p_employee_id
        AND ed.doc_type = dt
        AND ed.doc_status IN ('valido', 'proximo_vencer', 'em_analise')
    );

  v_missing := COALESCE(v_missing, ARRAY[]::public.doc_type[]);

  -- 4. Docs vencidos
  SELECT array_agg(DISTINCT ed.doc_type) INTO v_expired
  FROM public.employee_documents ed
  WHERE ed.employee_id = p_employee_id
    AND ed.doc_type = ANY(v_required_docs)
    AND ed.doc_status = 'vencido';

  v_expired := COALESCE(v_expired, ARRAY[]::public.doc_type[]);

  -- 5. Docs próximos de vencer (com data restante)
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', ed.doc_type,
      'expiry_date', ed.expiry_date,
      'days_left', (ed.expiry_date - CURRENT_DATE)::int
    )
    ORDER BY ed.expiry_date ASC
  ) INTO v_expiring
  FROM public.employee_documents ed
  WHERE ed.employee_id = p_employee_id
    AND ed.doc_type = ANY(v_required_docs)
    AND ed.doc_status = 'proximo_vencer'
    AND ed.expiry_date IS NOT NULL;

  v_expiring := COALESCE(v_expiring, '[]'::jsonb);

  -- 6. Integração cliente
  IF v_integration_required THEN
    SELECT status, expiry_date INTO v_integration
    FROM public.employee_client_integrations
    WHERE employee_id = p_employee_id
      AND client_id = v_client_id
    LIMIT 1;

    IF NOT FOUND THEN
      v_not_integrated := true;
    ELSIF v_integration.status = 'vencido' THEN
      v_integration_expired := true;
    ELSIF v_integration.status = 'pendente' THEN
      v_not_integrated := true;
    END IF;
  END IF;

  -- 7. Determinar cor + reason
  -- VERMELHO: doc vencido OU ausente OU integração inválida
  IF array_length(v_expired, 1) > 0
     OR array_length(v_missing, 1) > 0
     OR v_not_integrated
     OR v_integration_expired THEN
    v_color := 'vermelho';
    v_reason := CASE
      WHEN array_length(v_expired, 1) > 0 THEN
        'Documentos vencidos: ' || array_to_string(v_expired::text[], ', ')
      WHEN array_length(v_missing, 1) > 0 THEN
        'Documentos faltando: ' || array_to_string(v_missing::text[], ', ')
      WHEN v_not_integrated THEN
        'Funcionário não integrado neste cliente'
      WHEN v_integration_expired THEN
        'Integração no cliente vencida'
      ELSE 'Pendência documental'
    END;
  -- AMARELO: algo próximo de vencer
  ELSIF jsonb_array_length(v_expiring) > 0 THEN
    v_color := 'amarelo';
    v_reason := jsonb_array_length(v_expiring) || ' documento(s) próximo(s) de vencer';
  -- VERDE: tudo OK
  ELSE
    v_color := 'verde';
    v_reason := 'Todos os documentos válidos';
  END IF;

  RETURN jsonb_build_object(
    'color', v_color,
    'reason', v_reason,
    'missing_docs', to_jsonb(v_missing::text[]),
    'expired_docs', to_jsonb(v_expired::text[]),
    'expiring_docs', v_expiring,
    'not_integrated', v_not_integrated,
    'integration_expired', v_integration_expired,
    'required_docs', to_jsonb(v_required_docs::text[])
  );
END $$;

COMMENT ON FUNCTION public.fn_employee_badge_for_project IS
  'Valida se funcionário está apto a trabalhar num projeto específico com base nos documentos obrigatórios do cliente. Retorna cor do badge (verde/amarelo/vermelho) + razão + listas estruturadas de pendências. Consumido pelo componente EmployeeBadge no frontend.';

GRANT EXECUTE ON FUNCTION public.fn_employee_badge_for_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_client_required_doc_types(UUID) TO authenticated;

-- =============================================================================
-- Função "em lote" — badges para múltiplos funcionários no mesmo projeto
-- Útil para Kanban da escala: Marcelo vê todos os funcionários com cor
-- na hora de escalar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_employees_badges_for_project(
  p_employee_ids UUID[],
  p_project_id UUID
)
RETURNS TABLE(
  employee_id UUID,
  badge JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    emp_id AS employee_id,
    public.fn_employee_badge_for_project(emp_id, p_project_id) AS badge
  FROM unnest(p_employee_ids) AS emp_id;
$$;

COMMENT ON FUNCTION public.fn_employees_badges_for_project IS
  'Versão em lote de fn_employee_badge_for_project. Ideal para Kanban/listas — 1 chamada retorna badges de N funcionários.';

GRANT EXECUTE ON FUNCTION public.fn_employees_badges_for_project(UUID[], UUID) TO authenticated;

-- =============================================================================
-- Validação pós-deploy:
--
--   -- Cliente com requisitos (BRK como exemplo)
--   SELECT c.name, array_agg(r.doc_type::text) AS docs_required
--   FROM clients c
--   LEFT JOIN client_doc_requirements r ON r.client_id = c.id AND r.is_mandatory
--   WHERE c.name ILIKE '%brk%'
--   GROUP BY c.name;
--
--   -- Badge de funcionário X cliente Y:
--   SELECT fn_employee_badge_for_project(
--     (SELECT id FROM employees LIMIT 1),
--     (SELECT id FROM projects WHERE client_id IS NOT NULL LIMIT 1)
--   );
-- =============================================================================
