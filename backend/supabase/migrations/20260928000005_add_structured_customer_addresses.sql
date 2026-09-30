alter table public.customers
  add column if not exists default_shipping_address jsonb
  check (default_shipping_address is null or jsonb_typeof(default_shipping_address) = 'object');

create or replace function public.format_philippine_address(address jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select concat_ws(', ',
    nullif(btrim(address->>'street'), ''),
    nullif(btrim(address->>'barangay'), ''),
    nullif(btrim(address->>'district'), ''),
    nullif(btrim(address->>'locality'), ''),
    nullif(btrim(address->>'province'), ''),
    nullif(btrim(address->>'region'), ''),
    nullif(btrim(address->>'postalCode'), ''),
    nullif(btrim(address->>'country'), '')
  );
$$;

revoke execute on function public.format_philippine_address(jsonb) from public, anon, authenticated;
grant execute on function public.format_philippine_address(jsonb) to service_role;

update public.customers customers
set
  default_shipping_address = latest.shipping_address,
  default_address = case
    when btrim(customers.default_address) = '' then public.format_philippine_address(latest.shipping_address)
    else customers.default_address
  end
from (
  select distinct on (customer_id) customer_id, shipping_address
  from public.orders
  where shipping_address is not null
  order by customer_id, created_at desc
) latest
where customers.id = latest.customer_id
  and customers.default_shipping_address is null;

drop function if exists public.register_customer(text, text, text, text, text, text, uuid, text);
drop function if exists public.register_customer(text, text, jsonb, text, text, text, uuid, text);

create function public.register_customer(
  customer_channel_code text,
  customer_name text,
  customer_address jsonb,
  customer_phone text,
  customer_email text,
  customer_contact_person text,
  performed_by_user_id uuid,
  performed_by_email text
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_customer_id uuid;
  formatted_address text;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  if jsonb_typeof(customer_address) <> 'object'
    or customer_address->>'country' <> 'Philippines'
    or nullif(btrim(customer_address->>'street'), '') is null
    or nullif(btrim(customer_address->>'region'), '') is null
    or nullif(btrim(customer_address->>'locality'), '') is null
    or nullif(btrim(customer_address->>'barangay'), '') is null
    or nullif(btrim(customer_address->>'postalCode'), '') is null then
    raise exception 'A complete Philippine address is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sales_channels where code = customer_channel_code and is_active) then
    raise exception 'Sales channel not found' using errcode = 'P0002';
  end if;
  formatted_address := public.format_philippine_address(customer_address);
  if char_length(formatted_address) > 500 then
    raise exception 'The formatted address is too long' using errcode = '22001';
  end if;
  insert into public.customers (
    email, first_name, last_name, phone, business_name, contact_person,
    default_address, default_shipping_address, created_by_user_id, created_by_email
  ) values (
    nullif(lower(btrim(customer_email)), ''), '', '', customer_phone, customer_name,
    customer_contact_person, formatted_address, customer_address, performed_by_user_id, performed_by_email
  ) returning id into saved_customer_id;
  insert into public.customer_sales_channels (customer_id, channel_code)
  values (saved_customer_id, customer_channel_code);
  return saved_customer_id;
end;
$$;

revoke execute on function public.register_customer(text, text, jsonb, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.register_customer(text, text, jsonb, text, text, text, uuid, text) to service_role;

create or replace function public.complete_paid_storefront_checkout(payment_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  checkout_session public.storefront_checkout_sessions%rowtype;
  saved_customer_id uuid;
  saved_order_id uuid;
begin
  select * into checkout_session
  from public.storefront_checkout_sessions
  where maya_checkout_id = payment_id
  for update;

  if not found then return null; end if;
  select id into saved_order_id from public.orders where maya_payment_id = payment_id;
  if saved_order_id is not null then
    return jsonb_build_object('orderId', saved_order_id, 'created', false);
  end if;

  insert into public.customers (
    email, first_name, last_name, phone, default_address, default_shipping_address
  ) values (
    lower(btrim(checkout_session.customer->>'email')),
    checkout_session.customer->>'firstName',
    checkout_session.customer->>'lastName',
    checkout_session.customer->>'phone',
    public.format_philippine_address(checkout_session.shipping_address),
    checkout_session.shipping_address
  )
  on conflict (email) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    default_address = excluded.default_address,
    default_shipping_address = excluded.default_shipping_address,
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
  select saved_order_id, item->>'productSlug', item->>'productTitle', item->>'variantLabel',
    (item->>'quantity')::integer, (item->>'unitPrice')::numeric
  from jsonb_array_elements(checkout_session.items) as item;

  update public.storefront_checkout_sessions
  set completed_at = now(), updated_at = now()
  where request_reference_number = checkout_session.request_reference_number;

  return jsonb_build_object('orderId', saved_order_id, 'created', true);
end;
$$;

revoke execute on function public.complete_paid_storefront_checkout(uuid) from public, anon, authenticated;
grant execute on function public.complete_paid_storefront_checkout(uuid) to service_role;

notify pgrst, 'reload schema';
