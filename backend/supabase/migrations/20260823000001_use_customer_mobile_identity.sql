update public.customers
set phone = case
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
    then '+63' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
    then '+63' || regexp_replace(phone, '[^0-9]', '', 'g')
  else '+' || regexp_replace(phone, '[^0-9]', '', 'g')
end;

alter table public.orders
  add column customer_email text,
  add column customer_first_name text,
  add column customer_last_name text,
  add column customer_phone text;

update public.orders as orders
set
  customer_email = customers.email,
  customer_first_name = customers.first_name,
  customer_last_name = customers.last_name,
  customer_phone = customers.phone
from public.customers as customers
where customers.id = orders.customer_id;

with duplicate_customers as (
  select
    id,
    first_value(id) over (partition by phone order by created_at, id) as retained_id
  from public.customers
)
update public.orders as orders
set customer_id = duplicate_customers.retained_id
from duplicate_customers
where orders.customer_id = duplicate_customers.id
  and duplicate_customers.id <> duplicate_customers.retained_id;

delete from public.customers as customer
where exists (
  select 1
  from public.customers as retained
  where retained.phone = customer.phone
    and (retained.created_at, retained.id) < (customer.created_at, customer.id)
);

alter table public.customers drop constraint customers_email_key;
alter table public.customers add constraint customers_phone_key unique (phone);

alter table public.orders
  alter column customer_email set not null,
  alter column customer_first_name set not null,
  alter column customer_last_name set not null,
  alter column customer_phone set not null,
  add constraint orders_customer_email_check check (char_length(customer_email) between 3 and 254),
  add constraint orders_customer_first_name_check check (char_length(customer_first_name) between 1 and 100),
  add constraint orders_customer_last_name_check check (char_length(customer_last_name) between 1 and 100),
  add constraint orders_customer_phone_check check (char_length(customer_phone) between 7 and 30);

create or replace function public.complete_paid_storefront_checkout(payment_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  checkout_session public.storefront_checkout_sessions%rowtype;
  saved_customer_id uuid;
  saved_order_id uuid;
  normalized_phone text;
  phone_digits text;
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

  phone_digits := regexp_replace(checkout_session.customer->>'phone', '[^0-9]', '', 'g');
  normalized_phone := case
    when phone_digits ~ '^09[0-9]{9}$' then '+63' || substr(phone_digits, 2)
    when phone_digits ~ '^9[0-9]{9}$' then '+63' || phone_digits
    else '+' || phone_digits
  end;

  insert into public.customers (email, first_name, last_name, phone)
  values (
    lower(btrim(checkout_session.customer->>'email')),
    checkout_session.customer->>'firstName',
    checkout_session.customer->>'lastName',
    normalized_phone
  )
  on conflict (phone) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = now()
  returning id into saved_customer_id;

  insert into public.orders (
    customer_id, request_reference_number, maya_payment_id, total, shipping_address, delivery_notes,
    customer_email, customer_first_name, customer_last_name, customer_phone
  ) values (
    saved_customer_id, checkout_session.request_reference_number, payment_id,
    checkout_session.total, checkout_session.shipping_address, checkout_session.delivery_notes,
    lower(btrim(checkout_session.customer->>'email')),
    checkout_session.customer->>'firstName',
    checkout_session.customer->>'lastName',
    normalized_phone
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
