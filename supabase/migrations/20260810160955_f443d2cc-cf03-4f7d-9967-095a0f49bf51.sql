
-- helper
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

-- ============ PESSOAS / PII ============
DROP POLICY IF EXISTS "Authenticated users full access" ON public.employees;
CREATE POLICY "hr_roles_manage_employees" ON public.employees FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_employee_documents" ON public.employee_documents;
CREATE POLICY "hr_roles_manage_employee_documents" ON public.employee_documents FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_employee_dependents" ON public.employee_dependents;
CREATE POLICY "hr_roles_manage_employee_dependents" ON public.employee_dependents FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_employee_client_integrations" ON public.employee_client_integrations;
CREATE POLICY "hr_roles_manage_employee_client_integrations" ON public.employee_client_integrations FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "Authenticated users can manage vacations" ON public.employee_vacations;
CREATE POLICY "hr_roles_manage_vacations" ON public.employee_vacations FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','financeiro']::public.app_role[]));

-- ============ FINANCEIRO ============
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;
CREATE POLICY "finance_roles_manage_invoices" ON public.invoices FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;
CREATE POLICY "finance_roles_manage_invoice_items" ON public.invoice_items FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "Auth full access pp" ON public.payroll_periods;
CREATE POLICY "finance_roles_manage_payroll_periods" ON public.payroll_periods FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro']::public.app_role[]));

DROP POLICY IF EXISTS "Auth full access mdr" ON public.monthly_discount_reports;
CREATE POLICY "finance_ops_manage_mdr" ON public.monthly_discount_reports FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_mdr_batches" ON public.monthly_discount_report_batches;
CREATE POLICY "finance_ops_manage_mdr_batches" ON public.monthly_discount_report_batches FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_items" ON public.field_expense_items;
CREATE POLICY "finance_ops_manage_expense_items" ON public.field_expense_items FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_sheets" ON public.field_expense_sheets;
CREATE POLICY "finance_ops_manage_expense_sheets" ON public.field_expense_sheets FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_field_expense_discounts" ON public.field_expense_discounts;
CREATE POLICY "finance_ops_manage_expense_discounts" ON public.field_expense_discounts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "bs_all_authenticated" ON public.benefit_settlements;
CREATE POLICY "finance_ops_manage_benefit_settlements" ON public.benefit_settlements FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_vehicle_payment_history" ON public.vehicle_payment_history;
CREATE POLICY "finance_ops_manage_vehicle_payments" ON public.vehicle_payment_history FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','financeiro','operacional']::public.app_role[]));

-- ============ CLIENTES / LEADS / CONTATOS ============
DROP POLICY IF EXISTS "Auth full access" ON public.clients;
CREATE POLICY "clients_select_authenticated" ON public.clients FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "clients_write_commercial_roles" ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::public.app_role[]));
CREATE POLICY "clients_update_commercial_roles" ON public.clients FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::public.app_role[]));
CREATE POLICY "clients_delete_commercial_roles" ON public.clients FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial']::public.app_role[]));

DROP POLICY IF EXISTS "Authenticated users full access" ON public.leads;
CREATE POLICY "leads_select_authenticated" ON public.leads FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "leads_insert_commercial_roles" ON public.leads FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional']::public.app_role[]));
CREATE POLICY "leads_update_commercial_roles" ON public.leads FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro']::public.app_role[]));
CREATE POLICY "leads_delete_commercial_roles" ON public.leads FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial']::public.app_role[]));

DROP POLICY IF EXISTS "auth_manage_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "auth_view_contacts" ON public.client_contacts;
CREATE POLICY "contact_roles_manage_client_contacts" ON public.client_contacts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional']::public.app_role[]));

DROP POLICY IF EXISTS "auth_full_project_contacts" ON public.project_contacts;
CREATE POLICY "contact_roles_manage_project_contacts" ON public.project_contacts FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','comercial','financeiro','operacional']::public.app_role[]));

-- ============ SYSTEM SETTINGS ============
DROP POLICY IF EXISTS "auth_full_system_settings" ON public.system_settings;
CREATE POLICY "system_settings_read_authenticated" ON public.system_settings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "system_settings_admin_write" ON public.system_settings FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['master','diretor']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor']::public.app_role[]));

-- ============ PROJECT STATUS HISTORY ============
DROP POLICY IF EXISTS "policy_psh_insert" ON public.project_status_history;
CREATE POLICY "psh_insert_authorized_roles" ON public.project_status_history FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['master','diretor','operacional','sala_tecnica','financeiro']::public.app_role[]));

-- ============ USER ROLES (no self-assignment) ============
DROP POLICY IF EXISTS "Master can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_master" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::public.app_role));
CREATE POLICY "user_roles_insert_master_only" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role) AND user_id <> auth.uid());
CREATE POLICY "user_roles_update_master_only" ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'master'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));
CREATE POLICY "user_roles_delete_master_only" ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'master'::public.app_role));

-- ============ SECURITY DEFINER EXECUTE HARDENING ============
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_advance_service_status_on_dse_validation() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_materialize_project_services_on_proposal_approval() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_materialize_services_on_project_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_financial_alert() FROM authenticated;
