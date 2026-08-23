alter table public.order_status_events
add column actor_user_id uuid,
add column actor_email text check (actor_email is null or char_length(actor_email) between 3 and 254);

create or replace function public.record_order_status_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  saved_actor_id uuid := nullif(current_setting('romana.actor_user_id', true), '')::uuid;
  saved_actor_email text := nullif(current_setting('romana.actor_email', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, status, actor_user_id, actor_email)
    values (new.id, new.status, saved_actor_id, saved_actor_email);
  elsif new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status, actor_user_id, actor_email)
    values (new.id, new.status, saved_actor_id, saved_actor_email);
  end if;
  return new;
end;
$$;

create function public.start_preparing_order(
  target_order_id uuid,
  performed_by_user_id uuid,
  performed_by_email text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  changed_rows integer;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required.' using errcode = '22004';
  end if;

  perform set_config('romana.actor_user_id', performed_by_user_id::text, true);
  perform set_config('romana.actor_email', coalesce(performed_by_email, ''), true);

  update public.orders
  set status = 'processing', updated_at = now()
  where id = target_order_id and status = 'paid';

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke execute on function public.start_preparing_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_preparing_order(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
