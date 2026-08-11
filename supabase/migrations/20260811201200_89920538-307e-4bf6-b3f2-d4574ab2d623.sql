do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'receipts'
       and policyname = 'receipts_lock_for_allocation'
  ) then
    create policy receipts_lock_for_allocation
      on public.receipts for update to authenticated
      using ( has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'financeiro'::app_role]) )
      with check (false);
  end if;
end$$;

comment on policy receipts_lock_for_allocation on public.receipts is 'Habilita SELECT FOR UPDATE (trava de linha) para papeis financeiros em fn_allocate_recebimento. receipts e append-only: WITH CHECK (false) permite a trava mas barra UPDATE real de colunas. ADR-042 Onda 2.';