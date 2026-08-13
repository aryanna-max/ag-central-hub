
drop policy if exists "Service can insert profiles" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
