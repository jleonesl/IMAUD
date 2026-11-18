drop policy if exists "authorized debt relief grants read" on public.debt_relief_grants;
create policy "authorized debt relief grants read" on public.debt_relief_grants
for select to authenticated using (
 public.has_permission('solvencies.read')
 or public.has_permission('solvencies.issue')
 or public.has_permission('debt_relief.apply')
 or public.has_permission('audit.read')
);
