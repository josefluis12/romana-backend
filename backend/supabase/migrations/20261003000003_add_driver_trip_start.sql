alter table public.baguio_dispatches
  drop constraint if exists baguio_dispatches_status_check;

alter table public.baguio_dispatches
  add constraint baguio_dispatches_status_check
  check (status in ('preparing', 'ready_for_departure', 'in_transit', 'completed', 'cancelled'));

create or replace function public.advance_baguio_dispatch(
  target_dispatch_id uuid, requested_action text,
  performed_by_user_id uuid, performed_by_email text
) returns boolean language plpgsql set search_path = public as $$
declare current_status text; order_count integer; unready_count integer;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  select status into current_status from public.baguio_dispatches
  where id = target_dispatch_id for update;
  if requested_action = 'start' and current_status = 'preparing' then
    select count(*), count(*) filter (where status <> 'loaded')
    into order_count, unready_count from public.channel_sales_orders
    where dispatch_id = target_dispatch_id;
    if order_count = 0 or unready_count > 0 then return false; end if;
    update public.baguio_dispatches set status = 'ready_for_departure'
    where id = target_dispatch_id;
    return true;
  end if;
  if requested_action = 'complete' and current_status = 'in_transit' and not exists (
    select 1 from public.channel_sales_orders
    where dispatch_id = target_dispatch_id and status not in ('delivered', 'successful')
  ) then
    update public.baguio_dispatches set status = 'completed', completed_at = now()
    where id = target_dispatch_id;
    return true;
  end if;
  return false;
end; $$;

create or replace function public.start_driver_trip(
  target_dispatch_id uuid,
  authenticated_driver_user_id uuid,
  driver_email text
) returns boolean language plpgsql set search_path = public as $$
declare current_status text; order_count integer; unready_count integer;
begin
  if authenticated_driver_user_id is null then
    raise exception 'An authenticated driver is required' using errcode = '22004';
  end if;
  select status into current_status from public.baguio_dispatches
  where id = target_dispatch_id
    and driver_user_id = authenticated_driver_user_id
  for update;
  if current_status <> 'ready_for_departure' then return false; end if;
  select count(*), count(*) filter (where status <> 'loaded')
  into order_count, unready_count from public.channel_sales_orders
  where dispatch_id = target_dispatch_id;
  if order_count = 0 or unready_count > 0 then return false; end if;
  insert into public.baguio_dispatch_allocation_snapshots (
    dispatch_id, order_id, order_reference_number, client_name,
    product_variant_id, product_title, variant_label, quantity
  )
  select target_dispatch_id, orders.id, orders.reference_number, orders.client_name,
    items.product_variant_id, items.product_title, items.variant_label, items.quantity
  from public.channel_sales_orders orders
  join public.channel_sale_items items on items.order_id = orders.id
  where orders.dispatch_id = target_dispatch_id
  on conflict (dispatch_id, order_id, product_variant_id) do nothing;
  update public.baguio_dispatches
  set status = 'in_transit', departed_at = now()
  where id = target_dispatch_id;
  update public.channel_sales_orders set status = 'in_transit', updated_at = now()
  where dispatch_id = target_dispatch_id;
  update public.delivery_order_forms forms
  set status = 'dispatched', dispatched_at = now()
  from public.channel_sales_orders orders
  where orders.dispatch_id = target_dispatch_id and forms.order_id = orders.id;
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  select id, 'in_transit', authenticated_driver_user_id, driver_email
  from public.channel_sales_orders where dispatch_id = target_dispatch_id;
  return true;
end; $$;

revoke execute on function public.start_driver_trip(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.start_driver_trip(uuid, uuid, text)
to service_role;

notify pgrst, 'reload schema';
