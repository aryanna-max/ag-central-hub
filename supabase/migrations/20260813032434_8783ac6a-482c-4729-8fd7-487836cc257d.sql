-- ADR-050 fase B1 — papel `rh` passa a LER employees.
-- Política ADITIVA: políticas permissivas de RLS combinam por OU, entao esta so pode
-- ampliar acesso, nunca reduzir. NAO altera `hr_roles_manage_employees`.
-- Escopo: apenas SELECT. Escrita de RH e o ADR-048 (rascunho, aguarda captura).

drop policy if exists employees_select_rh on public.employees;

create policy employees_select_rh on public.employees
  for select to authenticated
  using (public.has_any_role(auth.uid(), ARRAY['rh']::public.app_role[]));

comment on policy employees_select_rh on public.employees is
  'ADR-050 B1. Leitura de employees pelo papel rh (agente claudio.rh@). Aditiva: nao substitui hr_roles_manage_employees.';
