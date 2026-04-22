-- =============================================================================
-- PR C — Tabela employee_dependents
-- =============================================================================
-- Objetivo Entrega A: eliminar planilha "IRRF" que Alcione faz manualmente.
-- Base de dados para cálculo correto de IRRF + plano saúde + auxílio creche.
--
-- Natureza: aditiva (CREATE TABLE). Zero impacto em dados existentes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employee_dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  -- Identificação
  name TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  parentesco TEXT NOT NULL
    CHECK (parentesco IN ('filho','filha','conjuge','companheiro','pai','mae','outro')),

  -- Elegibilidade (permite marcar quais vantagens)
  is_dependente_irrf BOOLEAN NOT NULL DEFAULT false,
  is_dependente_saude BOOLEAN NOT NULL DEFAULT false,
  is_dependente_salario_familia BOOLEAN NOT NULL DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_dependents IS
  'Dependentes de funcionários para cálculo de IRRF, plano saúde, salário família e outros benefícios legais (Entrega A: elimina planilha IRRF manual da Alcione).';

COMMENT ON COLUMN public.employee_dependents.is_dependente_irrf IS
  'Dedutível no IRRF (até 21 anos, ou até 24 se universitário, ou inválido qualquer idade).';
COMMENT ON COLUMN public.employee_dependents.is_dependente_saude IS
  'Inscrito no plano de saúde da empresa (se houver).';
COMMENT ON COLUMN public.employee_dependents.is_dependente_salario_familia IS
  'Elegível ao salário família INSS (até 14 anos ou inválido).';

CREATE INDEX IF NOT EXISTS idx_dependents_employee
  ON public.employee_dependents(employee_id);

CREATE INDEX IF NOT EXISTS idx_dependents_irrf
  ON public.employee_dependents(employee_id)
  WHERE is_dependente_irrf = true;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_dependents
  BEFORE UPDATE ON public.employee_dependents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY dependents_select_authenticated
  ON public.employee_dependents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY dependents_write_master_diretor_financeiro
  ON public.employee_dependents FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('master', 'diretor', 'financeiro'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('master', 'diretor', 'financeiro'))
  );

-- =============================================================================
-- Log de mudanças sensíveis em employee_dependents -> event_log
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_dependent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.event_log (
      event_type, entity_table, entity_id, actor_type, actor_id, payload
    ) VALUES (
      'dependent.added',
      'employees',
      NEW.employee_id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
      auth.uid(),
      jsonb_build_object(
        'dependent_id', NEW.id,
        'name', NEW.name,
        'parentesco', NEW.parentesco,
        'is_dependente_irrf', NEW.is_dependente_irrf
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.event_log (
      event_type, entity_table, entity_id, actor_type, actor_id, payload
    ) VALUES (
      'dependent.removed',
      'employees',
      OLD.employee_id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
      auth.uid(),
      jsonb_build_object(
        'dependent_id', OLD.id,
        'name', OLD.name,
        'parentesco', OLD.parentesco
      )
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_dependent_change ON public.employee_dependents;
CREATE TRIGGER trg_log_dependent_change
  AFTER INSERT OR DELETE ON public.employee_dependents
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_dependent_change();

-- =============================================================================
-- Validação pós-deploy:
--
--   SELECT tablename FROM pg_tables WHERE tablename = 'employee_dependents';
--   SELECT policyname FROM pg_policies WHERE tablename = 'employee_dependents';
--   SELECT trigger_name FROM information_schema.triggers
--     WHERE trigger_name = 'trg_log_dependent_change';
-- =============================================================================
