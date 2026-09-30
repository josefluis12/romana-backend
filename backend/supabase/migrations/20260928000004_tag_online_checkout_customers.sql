create or replace function public.complete_paid_storefront_checkout(payment_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  checkout_session public.storefront_checkout_sessions%rowtype;
  saved_customer_id uuid;
  saved_order_id uuid;
  was_created boolean := false;
begin
  select * into checkout_session
  from public.storefront_checkout_sessions
  where maya_checkout_id = payment_id
  for update;

  if not found then
    return null;
  end if;

  select id into saved_order_id from public.orders where maya_payment_id = payment_id;
  if saved_order_id is not null then
    return jsonb_build_object('orderId', saved_order_id, 'created', false);
  end if;

  insert into public.customers (email, first_name, last_name, phone)
  values (
    lower(btrim(checkout_session.customer->>'email')),
    checkout_session.customer->>'firstName',
    checkout_session.customer->>'lastName',
    checkout_session.customer->>'phone'
  )
  on conflict (email) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    updated_at = now()
  returning id into saved_customer_id;

  insert into public.customer_sales_channels (customer_id, channel_code)
  values (saved_customer_id, 'online')
  on conflict (customer_id, channel_code) do update set is_active = true;

  insert into public.orders (
    customer_id, request_reference_number, maya_payment_id, total, shipping_address, delivery_notes
  ) values (
    saved_customer_id, checkout_session.request_reference_number, payment_id,
    checkout_session.total, checkout_session.shipping_address, checkout_session.delivery_notes
  ) returning id into saved_order_id;

  insert into public.order_items (order_id, product_slug, product_title, variant_label, quantity, unit_price)
  select
    saved_order_id,
    item->>'productSlug',
    item->>'productTitle',
    item->>'variantLabel',
    (item->>'quantity')::integer,
    (item->>'unitPrice')::numeric
  from jsonb_array_elements(checkout_session.items) as item;

  update public.storefront_checkout_sessions
  set completed_at = now(), updated_at = now()
  where request_reference_number = checkout_session.request_reference_number;
  was_created := true;

  return jsonb_build_object('orderId', saved_order_id, 'created', was_created);
end;
$$;

revoke execute on function public.complete_paid_storefront_checkout(uuid) from public, anon, authenticated;
grant execute on function public.complete_paid_storefront_checkout(uuid) to service_role;

notify pgrst, 'reload schema';
