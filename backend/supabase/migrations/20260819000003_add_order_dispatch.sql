alter table public.orders
add column shipping_carrier text check (shipping_carrier is null or char_length(shipping_carrier) between 2 and 100),
add column tracking_number text check (tracking_number is null or char_length(tracking_number) between 2 and 100),
add column dispatch_note text not null default '' check (char_length(dispatch_note) <= 500),
add column dispatched_at timestamptz;

alter table public.order_status_events
add column metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object');

create or replace function public.record_order_status_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  saved_actor_id uuid := nullif(current_setting('romana.actor_user_id', true), '')::uuid;
  saved_actor_email text := nullif(current_setting('romana.actor_email', true), '');
  event_metadata jsonb := '{}';
begin
  if new.status = 'shipped' then
    event_metadata := jsonb_build_object(
      'carrier', new.shipping_carrier,
      'trackingNumber', new.tracking_number,
      'dispatchNote', new.dispatch_note
    );
  end if;

  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, status, actor_user_id, actor_email, metadata)
    values (new.id, new.status, saved_actor_id, saved_actor_email, event_metadata);
  elsif new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status, actor_user_id, actor_email, metadata)
    values (new.id, new.status, saved_actor_id, saved_actor_email, event_metadata);
  end if;
  return new;
end;
$$;

create function public.ship_order(
  target_order_id uuid,
  performed_by_user_id uuid,
  performed_by_email text,
  carrier_name text,
  shipment_tracking_number text,
  shipment_dispatch_note text
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
  set
    status = 'shipped',
    shipping_carrier = carrier_name,
    tracking_number = shipment_tracking_number,
    dispatch_note = shipment_dispatch_note,
    dispatched_at = now(),
    updated_at = now()
  where id = target_order_id and status = 'processing';

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke execute on function public.ship_order(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ship_order(uuid, uuid, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
