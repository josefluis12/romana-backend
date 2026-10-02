alter table public.delivery_receipts
  add column if not exists payment_mode text;

alter table public.delivery_receipts
  add constraint delivery_receipts_payment_mode_check
    check (payment_mode is null or payment_mode in ('cash', 'gcash', 'maya', 'bank_transfer', 'cheque'));

drop function if exists public.complete_driver_delivery(
  uuid, uuid, text, jsonb, double precision, double precision, double precision
);

create function public.complete_driver_delivery(
  target_order_id uuid,
  driver_user_id uuid,
  driver_email text,
  signature_strokes jsonb,
  p_signed_latitude double precision,
  p_signed_longitude double precision,
  p_location_accuracy double precision,
  p_payment_mode text
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
    or p_location_accuracy not between 0 and 10000
    or p_payment_mode is null
    or p_payment_mode not in ('cash', 'gcash', 'maya', 'bank_transfer', 'cheque') then
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
    payment_mode = p_payment_mode,
    client_acknowledged_at = now()
  where order_id = target_order_id;

  update public.channel_sales_orders
  set status = 'delivered', updated_at = now()
  where id = target_order_id;

  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (target_order_id, 'delivered', driver_user_id, driver_email);
  return true;
end; $$;

revoke execute on function public.complete_driver_delivery(
  uuid, uuid, text, jsonb, double precision, double precision, double precision, text
) from public, anon, authenticated;
grant execute on function public.complete_driver_delivery(
  uuid, uuid, text, jsonb, double precision, double precision, double precision, text
) to service_role;

notify pgrst, 'reload schema';
