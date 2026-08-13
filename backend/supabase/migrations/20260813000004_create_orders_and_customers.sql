create table public.storefront_checkout_sessions (
  request_reference_number uuid primary key,
  maya_checkout_id uuid unique,
  customer jsonb not null check (jsonb_typeof(customer) = 'object'),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 500),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  total numeric(12, 2) not null check (total > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  phone text not null check (char_length(phone) between 7 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  request_reference_number uuid not null unique,
  maya_payment_id uuid not null unique,
  status text not null default 'paid' check (status in ('paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded')),
  total numeric(12, 2) not null check (total > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 500),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_slug text not null,
  product_title text not null,
  variant_label text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(10, 2) not null check (unit_price > 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored
);

alter table public.storefront_checkout_sessions enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.storefront_checkout_sessions, public.customers, public.orders, public.order_items from anon, authenticated;
grant select, insert, update on public.storefront_checkout_sessions to service_role;
grant select, insert, update on public.customers to service_role;
grant select, insert, update on public.orders to service_role;
grant select, insert on public.order_items to service_role;

create function public.complete_paid_storefront_checkout(payment_id uuid)
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
