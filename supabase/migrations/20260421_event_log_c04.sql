-- =============================================================================
-- ADR-040 Camada C0.4 — Auditoria de Eventos
-- =============================================================================
-- Propósito: fundação para rastreabilidade total (Entrega D do _OBJETIVO.md).
-- Toda ação relevante no sistema passa a ter rastro FK inalterável aqui.
-- Bug 5 (AprovacaoExterna) é sintoma da ausência desta camada.
--
-- Escopo desta migration (Onda 0 do ADR-040):
--   1. Tabela event_log + 3 índices
--   2. RPC public.log_event (helper para frontend autenticado)
--   3. RLS (leitura por role, escrita só via trigger/RPC)
--   4. Triggers de status_changed em 3 tabelas críticas:
--      - projects (execution_status, status)
--      - field_expense_sheets (status)
--      - proposals (status)
--
-- Fora do escopo (próximas migrations):
--   - UI timeline (vai para v1.1)
--   - Triggers em todas as demais tabelas
--   - Retenção/archive policy
-- =============================================================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'trigger', 'external')),
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_log IS
  'Camada C0.4 do ADR-040. Auditoria de eventos de toda a plataforma. Invisível à UI padrão — só leitura para master/diretor. Escrita SEMPRE via trigger ou RPC log_event — nunca direto do frontend.';

COMMENT ON COLUMN public.event_log.event_type IS
  'Padrão: <entidade>.<verbo>. Ex: expense_sheet.approved, email.queued, project.status_changed';

COMMENT ON COLUMN public.event_log.actor_type IS
  'user = usuário autenticado; system = Edge Function / service_role; trigger = trigger de banco; external = webhook / integração';

COMMENT ON COLUMN public.event_log.payload IS
  'Snapshot relevante do evento — antes/depois em status changes, dados em inserts, etc.';

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_event_log_entity
  ON public.event_log (entity_table, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_type
  ON public.event_log (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_actor
  ON public.event_log (actor_type, actor_id)
  WHERE actor_id IS NOT NULL;

-- 3. RLS
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Leitura: master e diretor total. Outros roles: só eventos onde são atores.
CREATE POLICY event_log_select_master_diretor
  ON public.event_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'diretor')
    )
  );

CREATE POLICY event_log_select_own_actor
  ON public.event_log FOR SELECT
  USING (actor_id = auth.uid());

-- Escrita: NINGUÉM do frontend escreve direto.
-- Só triggers (SECURITY DEFINER) e RPC log_event (SECURITY DEFINER).
-- Sem policy de INSERT/UPDATE/DELETE significa bloqueado para authenticated/anon.
-- Service role (Edge Functions) passa por cima do RLS.

-- 4. RPC helper para código autenticado logar evento de UI
CREATE OR REPLACE FUNCTION public.log_event(
  p_event_type text,
  p_entity_table text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_context jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_event exige usuário autenticado (use service_role/Edge Function para eventos system)';
  END IF;

  INSERT INTO public.event_log (
    event_type, entity_table, entity_id,
    actor_type, actor_id, payload, context
  ) VALUES (
    p_event_type, p_entity_table, p_entity_id,
    'user', auth.uid(), p_payload, p_context
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.log_event IS
  'Uso pelo frontend autenticado para registrar evento em event_log. Eventos de system/external devem ser logados direto pela Edge Function ou por trigger.';

GRANT EXECUTE ON FUNCTION public.log_event(text, text, uuid, jsonb, jsonb) TO authenticated;

-- 5. Trigger function reutilizável
CREATE OR REPLACE FUNCTION public.trg_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_old_exec text;
  v_new_exec text;
  v_payload jsonb;
  v_event_type text;
  v_actor_id uuid;
BEGIN
  v_actor_id := auth.uid();

  -- Detecta mudança em coluna `status` (todas as 3 tabelas têm)
  v_old_status := OLD.status::text;
  v_new_status := NEW.status::text;

  -- Detecta mudança em execution_status (só projects tem)
  IF TG_TABLE_NAME = 'projects' THEN
    v_old_exec := OLD.execution_status::text;
    v_new_exec := NEW.execution_status::text;
  END IF;

  -- Só registra se status OU execution_status mudou
  IF (v_old_status IS DISTINCT FROM v_new_status)
     OR (v_old_exec IS DISTINCT FROM v_new_exec) THEN

    v_payload := jsonb_build_object(
      'old_status', v_old_status,
      'new_status', v_new_status
    );

    IF v_old_exec IS NOT NULL OR v_new_exec IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object(
        'old_execution_status', v_old_exec,
        'new_execution_status', v_new_exec
      );
    END IF;

    v_event_type := TG_TABLE_NAME || '.status_changed';

    INSERT INTO public.event_log (
      event_type, entity_table, entity_id,
      actor_type, actor_id, payload
    ) VALUES (
      v_event_type, TG_TABLE_NAME, NEW.id,
      CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'trigger' END,
      v_actor_id, v_payload
    );
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.trg_log_status_change IS
  'Trigger genérico de registro em event_log ao mudar status/execution_status. Usar com AFTER UPDATE ON <table> FOR EACH ROW.';

-- 6. Triggers nas 3 tabelas críticas (Onda 0)
DROP TRIGGER IF EXISTS trg_projects_log_status ON public.projects;
CREATE TRIGGER trg_projects_log_status
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_status_change();

DROP TRIGGER IF EXISTS trg_field_expense_sheets_log_status ON public.field_expense_sheets;
CREATE TRIGGER trg_field_expense_sheets_log_status
  AFTER UPDATE ON public.field_expense_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_status_change();

DROP TRIGGER IF EXISTS trg_proposals_log_status ON public.proposals;
CREATE TRIGGER trg_proposals_log_status
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_status_change();

-- =============================================================================
-- Validação manual pós-deploy (rodar no SQL Editor):
--
--   -- Deve existir
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='event_log';
--
--   -- Deve ter 3 policies (2 SELECT, 0 INSERT/UPDATE/DELETE)
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='event_log';
--
--   -- Deve retornar 3 triggers
--   SELECT trigger_name, event_object_table FROM information_schema.triggers
--   WHERE trigger_name LIKE 'trg_%_log_status';
--
--   -- Smoke test: atualizar um projeto em staging/dev e conferir event_log
-- =============================================================================
