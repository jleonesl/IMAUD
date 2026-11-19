-- Every terminal creation or status change is recorded in municipal audit log.
create or replace function public.audit_pos_terminal_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,before_data,after_data)
 values(auth.uid(),
  case when tg_op='INSERT' then 'pos_terminal_registered'
       when new.is_active is distinct from old.is_active then 'pos_terminal_status_changed'
       else 'pos_terminal_updated' end,
  'pos_terminals',new.id::text,
  case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.audit_pos_terminal_change() from public,anon,authenticated;
drop trigger if exists trg_audit_pos_terminal_change on public.pos_terminals;
create trigger trg_audit_pos_terminal_change
after insert or update on public.pos_terminals
for each row execute function public.audit_pos_terminal_change();