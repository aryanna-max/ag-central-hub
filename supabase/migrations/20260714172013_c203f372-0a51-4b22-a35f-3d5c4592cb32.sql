
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1) DROP anon-role policies (keep authenticated policies)
DROP POLICY IF EXISTS "Anon full access" ON public.alerts;
DROP POLICY IF EXISTS "anon_full_calendar" ON public.calendar_events;
DROP POLICY IF EXISTS "Anon full access" ON public.clients;
DROP POLICY IF EXISTS "Anon read access" ON public.daily_schedule_entries;
DROP POLICY IF EXISTS "Anon read access" ON public.daily_schedules;
DROP POLICY IF EXISTS "Anon read access" ON public.daily_team_assignments;
DROP POLICY IF EXISTS "Anon read access" ON public.employees;
DROP POLICY IF EXISTS "anon_full_items" ON public.field_expense_items;
DROP POLICY IF EXISTS "anon_full_sheets" ON public.field_expense_sheets;
DROP POLICY IF EXISTS "Anon read access" ON public.lead_interactions;
DROP POLICY IF EXISTS "Anon read access" ON public.leads;
DROP POLICY IF EXISTS "measurements_anon" ON public.measurements;
DROP POLICY IF EXISTS "Anon read access" ON public.monthly_schedules;
DROP POLICY IF EXISTS "anon_full_project_benefits" ON public.project_benefits;
DROP POLICY IF EXISTS "Anon full access" ON public.projects;
DROP POLICY IF EXISTS "anon_full_proposal_items" ON public.proposal_items;
DROP POLICY IF EXISTS "anon_full_proposals" ON public.proposals;
DROP POLICY IF EXISTS "anon_full_system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Anon read access" ON public.team_members;
DROP POLICY IF EXISTS "Anon read access" ON public.teams;
DROP POLICY IF EXISTS "anon_full_vehicle_payment_history" ON public.vehicle_payment_history;
DROP POLICY IF EXISTS "Anon read access" ON public.vehicles;

-- 2) Enable RLS on missing tables + add authenticated policies
ALTER TABLE public.employee_project_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_employee_project_authorizations"
  ON public.employee_project_authorizations FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.field_expense_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_field_expense_discounts"
  ON public.field_expense_discounts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_project_contacts"
  ON public.project_contacts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Tighten broad "true/true" authenticated policies -> require authenticated
--    Replace ALL policies to use auth.uid() IS NOT NULL instead of true.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND cmd='ALL'
      AND 'authenticated' = ANY(roles)
      AND qual = 'true'
      AND with_check = 'true'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;

-- Also tighten the event_log INSERT WITH CHECK true (broad)
ALTER POLICY "auth_insert_event_log" ON public.event_log
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4) Remove overly permissive blanket policies where role-scoped ones already exist
DROP POLICY IF EXISTS "Authenticated users can manage technical tasks" ON public.technical_tasks;
DROP POLICY IF EXISTS "Authenticated users can manage status history" ON public.project_status_history;

-- Restrict project_status_history SELECT to authenticated users
DROP POLICY IF EXISTS "policy_psh_select" ON public.project_status_history;
CREATE POLICY "policy_psh_select" ON public.project_status_history
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- 5) Fix search_path on functions missing it
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.fn_on_status_change() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;

-- 6) Lock down SECURITY DEFINER function EXECUTE privileges
--    Revoke from PUBLIC + anon, grant only to authenticated for client-called RPCs
--    and to service_role for queue/admin helpers.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Client-invoked RPCs: allow authenticated
GRANT EXECUTE ON FUNCTION public.fn_employee_badge_for_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employees_badges_for_project(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_employee_day_status(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_event(text, text, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_monthly_discount_batch(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_preencher_escala_dia(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolver_conflito_preencher(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_unvalidate_day_entry(uuid, text) TO authenticated;

-- Service-role only helpers (queues, cron)
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

-- 7) Fix SECURITY DEFINER views -> use security_invoker
ALTER VIEW public.vw_tarefas_dia SET (security_invoker = on);
ALTER VIEW public.vw_prazos_criticos SET (security_invoker = on);
