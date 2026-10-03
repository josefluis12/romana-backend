create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null check (nullif(btrim(label), '') is not null and char_length(label) <= 80),
  address jsonb not null check (jsonb_typeof(address) = 'object'),
  formatted_address text not null check (nullif(btrim(formatted_address), '') is not null and char_length(formatted_address) <= 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_addresses_one_default
on public.customer_addresses (customer_id) where is_default;
create index customer_addresses_customer_id on public.customer_addresses (customer_id, created_at);

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from anon, authenticated;
grant select, insert, update on public.customer_addresses to service_role;

insert into public.customer_addresses (customer_id, label, address, formatted_address, is_default)
select id, 'Primary', default_shipping_address, default_address, true
from public.customers
where default_shipping_address is not null
on conflict (customer_id) where is_default do nothing;

create function public.sync_customer_default_address()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.default_shipping_address is null or new.default_address is null then return new; end if;
  if tg_op = 'UPDATE' and new.default_shipping_address is not distinct from old.default_shipping_address then return new; end if;
  update public.customer_addresses
  set address = new.default_shipping_address, formatted_address = new.default_address, updated_at = now()
  where customer_id = new.id and is_default;
  if not found then
    insert into public.customer_addresses (customer_id, label, address, formatted_address, is_default)
    values (new.id, 'Primary', new.default_shipping_address, new.default_address, true);
  end if;
  return new;
end; $$;

create trigger sync_customer_default_address
after insert or update of default_shipping_address on public.customers
for each row execute function public.sync_customer_default_address();

revoke execute on function public.sync_customer_default_address() from public, anon, authenticated;

create function public.add_customer_address(
  target_customer_id uuid, address_label text, address_data jsonb, performed_by_user_id uuid
) returns uuid language plpgsql set search_path = public as $$
declare saved_address_id uuid; formatted_address text;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  if not exists (select 1 from public.customers where id = target_customer_id and is_active) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if nullif(btrim(address_label), '') is null or char_length(btrim(address_label)) > 80
    or jsonb_typeof(address_data) <> 'object'
    or address_data->>'country' <> 'Philippines'
    or nullif(btrim(address_data->>'street'), '') is null
    or nullif(btrim(address_data->>'region'), '') is null
    or nullif(btrim(address_data->>'locality'), '') is null
    or nullif(btrim(address_data->>'barangay'), '') is null
    or nullif(btrim(address_data->>'postalCode'), '') is null then
    raise exception 'A complete Philippine address is required' using errcode = '22023';
  end if;
  formatted_address := public.format_philippine_address(address_data);
  insert into public.customer_addresses (customer_id, label, address, formatted_address)
  values (target_customer_id, btrim(address_label), address_data, formatted_address)
  returning id into saved_address_id;
  return saved_address_id;
end; $$;

revoke execute on function public.add_customer_address(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.add_customer_address(uuid, text, jsonb, uuid) to service_role;

alter table public.channel_sales_orders
add column customer_address_id uuid references public.customer_addresses(id) on delete restrict;

update public.channel_sales_orders orders
set customer_address_id = addresses.id
from public.customer_addresses addresses
where addresses.customer_id = orders.customer_id and addresses.is_default
  and orders.customer_address_id is null;

drop function if exists public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text);
create function public.create_baguio_sale(
  selected_customer_id uuid, selected_customer_address_id uuid, selected_dispatch_id uuid,
  prepared_by_name text, order_notes text, item_data jsonb,
  performed_by_user_id uuid, performed_by_email text
) returns uuid language plpgsql set search_path = public as $$
declare
  saved_order_id uuid;
  calculated_total numeric(12, 2);
  initial_status text;
  selected_customer public.customers%rowtype;
  selected_address public.customer_addresses%rowtype;
  selected_dispatch public.baguio_dispatches%rowtype;
begin
  if performed_by_user_id is null or jsonb_typeof(item_data) <> 'array'
    or jsonb_array_length(item_data) not between 1 and 50 then
    raise exception 'Invalid Baguio sale input' using errcode = '22023';
  end if;
  select * into selected_dispatch from public.baguio_dispatches
  where id = selected_dispatch_id and status in ('preparing', 'in_transit') for update;
  if not found then raise exception 'Active dispatch not found' using errcode = 'P0002'; end if;
  select customers.* into selected_customer
  from public.customers customers
  join public.customer_sales_channels channels on channels.customer_id = customers.id
  where customers.id = selected_customer_id and customers.is_active
    and channels.channel_code = 'baguio' and channels.is_active;
  if not found then raise exception 'Baguio customer not found' using errcode = 'P0002'; end if;
  select * into selected_address from public.customer_addresses
  where id = selected_customer_address_id and customer_id = selected_customer_id;
  if not found then raise exception 'Customer address not found' using errcode = 'P0002'; end if;
  select sum((item->>'quantity')::integer * (item->>'unitPrice')::numeric)
  into calculated_total from jsonb_array_elements(item_data) item;
  initial_status := case when selected_dispatch.status = 'in_transit' then 'in_transit' else 'draft' end;

  insert into public.channel_sales_orders (
    channel_code, customer_id, customer_address_id, dispatch_id, client_name,
    client_address, client_phone, van_location_id, delivery_notes, total, status,
    added_after_departure, created_by_user_id, created_by_email
  ) values (
    'baguio', selected_customer.id, selected_address.id, selected_dispatch.id,
    coalesce(selected_customer.business_name, btrim(selected_customer.first_name || ' ' || selected_customer.last_name)),
    selected_address.formatted_address, selected_customer.phone, selected_dispatch.van_location_id,
    order_notes, calculated_total, initial_status, selected_dispatch.status = 'in_transit',
    performed_by_user_id, performed_by_email
  ) returning id into saved_order_id;

  insert into public.channel_sale_items (
    order_id, product_variant_id, product_title, variant_label, quantity, unit_price
  )
  select saved_order_id, variant.id, product.title, variant.label,
    (item->>'quantity')::integer, (item->>'unitPrice')::numeric
  from jsonb_array_elements(item_data) item
  join public.product_variants variant on variant.id = (item->>'productVariantId')::uuid
  join public.products product on product.id = variant.product_id;
  if (select count(*) from public.channel_sale_items where order_id = saved_order_id)
    <> jsonb_array_length(item_data) then
    raise exception 'One or more product variants were not found' using errcode = 'P0002';
  end if;
  insert into public.delivery_order_forms (order_id, prepared_by_name, status, dispatched_at)
  values (saved_order_id, prepared_by_name,
    case when initial_status = 'in_transit' then 'dispatched' else 'draft' end,
    case when initial_status = 'in_transit' then now() end);
  insert into public.delivery_receipts (order_id) values (saved_order_id);
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (saved_order_id, initial_status, performed_by_user_id, performed_by_email);
  return saved_order_id;
end; $$;

revoke execute on function public.create_baguio_sale(uuid, uuid, uuid, text, text, jsonb, uuid, text)
from public, anon, authenticated;
grant execute on function public.create_baguio_sale(uuid, uuid, uuid, text, text, jsonb, uuid, text)
to service_role;

notify pgrst, 'reload schema';
