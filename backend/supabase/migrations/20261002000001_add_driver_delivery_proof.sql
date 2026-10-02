alter table public.delivery_receipts
  add column if not exists client_signature jsonb,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_latitude double precision,
  add column if not exists signed_longitude double precision,
  add column if not exists location_accuracy double precision,
  add column if not exists signed_by_driver_user_id uuid references auth.users(id);

alter table public.delivery_receipts
  add constraint delivery_receipts_signed_latitude_check
    check (signed_latitude is null or signed_latitude between -90 and 90),
  add constraint delivery_receipts_signed_longitude_check
    check (signed_longitude is null or signed_longitude between -180 and 180),
  add constraint delivery_receipts_location_accuracy_check
    check (location_accuracy is null or location_accuracy between 0 and 10000),
  add constraint delivery_receipts_signature_array_check
    check (client_signature is null or jsonb_typeof(client_signature) = 'array');

create or replace function public.complete_driver_delivery(
  target_order_id uuid,
  driver_user_id uuid,
  driver_email text,
  signature_strokes jsonb,
  p_signed_latitude double precision,
  p_signed_longitude double precision,
  p_location_accuracy double precision
) returns boolean language plpgsql set search_path = public as $$
declare
  current_status text;
  assigned_driver_id uuid;
begin
  if driver_user_id is null
    or jsonb_typeof(signature_strokes) <> 'array'
    or jsonb_array_length(signature_strokes) = 0
    or p_signed_latitude not between -90 and 90
    or p_signed_longitude not between -180 and 180
    or p_location_accuracy not between 0 and 10000 then
    raise exception 'Invalid driver delivery proof' using errcode = '22023';
  end if;

  select orders.status, dispatches.driver_user_id
    into current_status, assigned_driver_id
  from public.channel_sales_orders orders
  join public.baguio_dispatches dispatches on dispatches.id = orders.dispatch_id
  where orders.id = target_order_id and orders.channel_code = 'baguio'
  for update of orders;

  if not found or assigned_driver_id is distinct from driver_user_id then
    return false;
  end if;
  if current_status = 'delivered' then
    return true;
  end if;
  if current_status <> 'in_transit' then
    return false;
  end if;

  update public.delivery_receipts set
    client_signature = signature_strokes,
    signed_at = now(),
    signed_latitude = p_signed_latitude,
    signed_longitude = p_signed_longitude,
    location_accuracy = p_location_accuracy,
    signed_by_driver_user_id = driver_user_id,
    client_acknowledged_at = now()
  where order_id = target_order_id;

  update public.channel_sales_orders
  set status = 'delivered', updated_at = now()
  where id = target_order_id;

  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (target_order_id, 'delivered', driver_user_id, driver_email);
  return true;
end; $$;

revoke execute on function public.complete_driver_delivery(uuid, uuid, text, jsonb, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.complete_driver_delivery(uuid, uuid, text, jsonb, double precision, double precision, double precision)
  to service_role;

notify pgrst, 'reload schema';
