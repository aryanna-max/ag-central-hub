
alter table public.companies enable row level security;
grant select on public.companies to authenticated;
grant insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated using (true);

drop policy if exists companies_write on public.companies;
create policy companies_write on public.companies for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]));

drop policy if exists ea_all on public.employee_absences;
revoke all on public.employee_absences from anon;
grant select, insert, update, delete on public.employee_absences to authenticated;
grant all on public.employee_absences to service_role;
alter table public.employee_absences enable row level security;

create policy ea_select on public.employee_absences for select to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role,'financeiro'::app_role,'operacional'::app_role]));

create policy ea_write on public.employee_absences for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]));
