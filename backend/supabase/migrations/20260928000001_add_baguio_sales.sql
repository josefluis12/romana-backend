create sequence if not exists public.channel_sale_reference_sequence;
create sequence if not exists public.delivery_order_number_sequence;
create sequence if not exists public.delivery_receipt_number_sequence;
create sequence if not exists public.channel_client_reference_sequence;

create table if not exists public.sales_channels (
  code text primary key,
  name text not null unique,
  is_active boolean not null default true
);

insert into public.sales_channels (code, name) values
  ('pos', 'POS Sales'),
  ('baguio', 'Baguio Sales'),
  ('online', 'Online Sales'),
  ('local_distributor', 'Local Distributor'),
  ('exhibit', 'Exhibit Sales')
on conflict (code) do nothing;

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  type text not null check (type in ('factory', 'vehicle')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.inventory_locations (code, name, type) values
  ('factory', 'Romana Factory', 'factory'),
  ('baguio-van-1', 'Baguio Van 1', 'vehicle')
on conflict (code) do nothing;

create table if not exists public.channel_clients (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default ('BGC-' || lpad(nextval('public.channel_client_reference_sequence')::text, 6, '0')),
  channel_code text not null references public.sales_channels(code),
  name text not null check (char_length(name) between 1 and 120),
  address text not null check (char_length(address) between 1 and 500),
  phone text not null check (char_length(phone) between 1 and 30),
  email text check (email is null or (email = lower(btrim(email)) and char_length(email) between 3 and 254)),
  contact_person text not null default '' check (char_length(contact_person) <= 120),
  is_active boolean not null default true,
  created_by_user_id uuid not null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_clients_channel_name_index on public.channel_clients(channel_code, name);

create table if not exists public.channel_sales_orders (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default ('BAG-' || lpad(nextval('public.channel_sale_reference_sequence')::text, 6, '0')),
  channel_code text not null references public.sales_channels(code),
  client_id uuid not null references public.channel_clients(id),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'loaded', 'in_transit', 'delivered', 'successful', 'cancelled')),
  client_name text not null check (char_length(client_name) between 1 and 120),
  client_address text not null check (char_length(client_address) between 1 and 500),
  client_phone text not null default '' check (char_length(client_phone) <= 30),
  van_location_id uuid not null references public.inventory_locations(id),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 500),
  total numeric(12, 2) not null check (total > 0),
  created_by_user_id uuid not null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.channel_sales_orders
add column if not exists client_id uuid references public.channel_clients(id);

insert into public.channel_clients (
  channel_code, name, address, phone, created_by_user_id, created_by_email
)
select distinct on (orders.client_name, orders.client_address, orders.client_phone)
  'baguio', orders.client_name, orders.client_address,
  coalesce(nullif(btrim(orders.client_phone), ''), 'Not provided'),
  orders.created_by_user_id, orders.created_by_email
from public.channel_sales_orders orders
where orders.channel_code = 'baguio'
  and orders.client_id is null
  and not exists (
    select 1 from public.channel_clients clients
    where clients.channel_code = 'baguio'
      and clients.name = orders.client_name
      and clients.address = orders.client_address
      and clients.phone = coalesce(nullif(btrim(orders.client_phone), ''), 'Not provided')
  )
order by orders.client_name, orders.client_address, orders.client_phone, orders.created_at;

update public.channel_sales_orders orders
set client_id = clients.id
from public.channel_clients clients
where orders.client_id is null
  and orders.channel_code = 'baguio'
  and clients.channel_code = 'baguio'
  and clients.name = orders.client_name
  and clients.address = orders.client_address
  and clients.phone = coalesce(nullif(btrim(orders.client_phone), ''), 'Not provided');

alter table public.channel_sales_orders alter column client_id set not null;

create table if not exists public.channel_sale_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.channel_sales_orders(id) on delete cascade,
  product_variant_id uuid not null,
  product_title text not null,
  variant_label text not null,
  quantity integer not null check (quantity between 1 and 10000),
  unit_price numeric(10, 2) not null check (unit_price > 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored,
  unique (order_id, product_variant_id)
);

create table if not exists public.delivery_order_forms (
  order_id uuid primary key references public.channel_sales_orders(id) on delete cascade,
  document_number text not null unique default ('DOF-' || lpad(nextval('public.delivery_order_number_sequence')::text, 6, '0')),
  status text not null default 'draft' check (status in ('draft', 'ready_for_signature', 'approved', 'dispatched', 'cancelled')),
  prepared_by_name text not null check (char_length(prepared_by_name) between 1 and 120),
  approved_at timestamptz,
  dispatched_at timestamptz
);

create table if not exists public.delivery_receipts (
  order_id uuid primary key references public.channel_sales_orders(id) on delete cascade,
  document_number text not null unique default ('DR-' || lpad(nextval('public.delivery_receipt_number_sequence')::text, 6, '0')),
  status text not null default 'pending' check (status in ('pending', 'issued', 'cancelled')),
  client_acknowledged_at timestamptz,
  issued_at timestamptz
);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.channel_sales_orders(id),
  source_location_id uuid not null references public.inventory_locations(id),
  destination_location_id uuid not null references public.inventory_locations(id),
  status text not null check (status = 'completed'),
  completed_at timestamptz not null default now(),
  check (source_location_id <> destination_location_id)
);

create table if not exists public.inventory_transfer_items (
  transfer_id uuid not null references public.inventory_transfers(id) on delete cascade,
  product_variant_id uuid not null,
  quantity integer not null check (quantity > 0),
  primary key (transfer_id, product_variant_id)
);

create table if not exists public.channel_sale_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.channel_sales_orders(id) on delete cascade,
  status text not null,
  actor_user_id uuid not null,
  actor_email text,
  created_at timestamptz not null default now()
);

alter table public.sales_channels enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.channel_clients enable row level security;
alter table public.channel_sales_orders enable row level security;
alter table public.channel_sale_items enable row level security;
alter table public.delivery_order_forms enable row level security;
alter table public.delivery_receipts enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_items enable row level security;
alter table public.channel_sale_events enable row level security;

revoke all on public.sales_channels, public.inventory_locations, public.channel_clients, public.channel_sales_orders,
  public.channel_sale_items, public.delivery_order_forms, public.delivery_receipts,
  public.inventory_transfers, public.inventory_transfer_items, public.channel_sale_events
from anon, authenticated;
grant select, insert, update on public.sales_channels, public.inventory_locations, public.channel_clients,
  public.channel_sales_orders, public.channel_sale_items, public.delivery_order_forms,
  public.delivery_receipts, public.inventory_transfers, public.inventory_transfer_items,
  public.channel_sale_events to service_role;
grant usage, select on sequence public.channel_sale_reference_sequence, public.delivery_order_number_sequence,
  public.delivery_receipt_number_sequence, public.channel_client_reference_sequence to service_role;

drop function if exists public.create_baguio_sale(jsonb, uuid, text, text, jsonb, uuid, text);

create or replace function public.create_baguio_sale(
  selected_client_id uuid,
  target_van_id uuid,
  prepared_by_name text,
  order_notes text,
  item_data jsonb,
  performed_by_user_id uuid,
  performed_by_email text
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_order_id uuid;
  calculated_total numeric(12, 2);
  selected_client public.channel_clients%rowtype;
begin
  if performed_by_user_id is null or jsonb_typeof(item_data) <> 'array' or jsonb_array_length(item_data) not between 1 and 50 then
    raise exception 'Invalid Baguio sale input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_locations where id = target_van_id and type = 'vehicle' and is_active) then
    raise exception 'Vehicle inventory location not found' using errcode = 'P0002';
  end if;
  select * into selected_client from public.channel_clients where id = selected_client_id and channel_code = 'baguio' and is_active;
  if not found then raise exception 'Baguio client not found' using errcode = 'P0002'; end if;
  select sum((item->>'quantity')::integer * (item->>'unitPrice')::numeric)
  into calculated_total from jsonb_array_elements(item_data) item;

  insert into public.channel_sales_orders (
    channel_code, client_id, client_name, client_address, client_phone, van_location_id,
    delivery_notes, total, created_by_user_id, created_by_email
  ) values (
    'baguio', selected_client.id, selected_client.name, selected_client.address, selected_client.phone,
    target_van_id, order_notes, calculated_total, performed_by_user_id, performed_by_email
  ) returning id into saved_order_id;

  insert into public.channel_sale_items (order_id, product_variant_id, product_title, variant_label, quantity, unit_price)
  select saved_order_id, variant.id, product.title, variant.label,
    (item->>'quantity')::integer, (item->>'unitPrice')::numeric
  from jsonb_array_elements(item_data) item
  join public.product_variants variant on variant.id = (item->>'productVariantId')::uuid
  join public.products product on product.id = variant.product_id;
  if (select count(*) from public.channel_sale_items where order_id = saved_order_id) <> jsonb_array_length(item_data) then
    raise exception 'One or more product variants were not found' using errcode = 'P0002';
  end if;

  insert into public.delivery_order_forms (order_id, prepared_by_name) values (saved_order_id, prepared_by_name);
  insert into public.delivery_receipts (order_id) values (saved_order_id);
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (saved_order_id, 'draft', performed_by_user_id, performed_by_email);
  return saved_order_id;
end;
$$;

create or replace function public.advance_baguio_sale(
  target_order_id uuid,
  requested_action text,
  performed_by_user_id uuid,
  performed_by_email text
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  current_status text;
  next_status text;
  factory_id uuid;
  transfer_id uuid;
begin
  if performed_by_user_id is null then raise exception 'An authenticated actor is required' using errcode = '22004'; end if;
  select status into current_status from public.channel_sales_orders where id = target_order_id and channel_code = 'baguio' for update;
  next_status := case
    when requested_action = 'submit' and current_status = 'draft' then 'pending_approval'
    when requested_action = 'approve' and current_status = 'pending_approval' then 'approved'
    when requested_action = 'load' and current_status = 'approved' then 'loaded'
    when requested_action = 'dispatch' and current_status = 'loaded' then 'in_transit'
    when requested_action = 'deliver' and current_status = 'in_transit' then 'delivered'
    when requested_action = 'complete' and current_status = 'delivered' then 'successful'
    else null end;
  if next_status is null then return false; end if;

  update public.channel_sales_orders set status = next_status, updated_at = now() where id = target_order_id;
  if requested_action = 'submit' then
    update public.delivery_order_forms set status = 'ready_for_signature' where order_id = target_order_id;
  elsif requested_action = 'approve' then
    update public.delivery_order_forms set status = 'approved', approved_at = now() where order_id = target_order_id;
  elsif requested_action = 'load' then
    select id into factory_id from public.inventory_locations where type = 'factory' and is_active order by created_at limit 1;
    insert into public.inventory_transfers (order_id, source_location_id, destination_location_id, status)
    select id, factory_id, van_location_id, 'completed' from public.channel_sales_orders where id = target_order_id
    returning id into transfer_id;
    insert into public.inventory_transfer_items (transfer_id, product_variant_id, quantity)
    select transfer_id, product_variant_id, quantity from public.channel_sale_items where order_id = target_order_id;
    update public.delivery_order_forms set status = 'dispatched', dispatched_at = now() where order_id = target_order_id;
  elsif requested_action = 'complete' then
    update public.delivery_receipts set status = 'issued', client_acknowledged_at = now(), issued_at = now() where order_id = target_order_id;
  end if;
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (target_order_id, next_status, performed_by_user_id, performed_by_email);
  return true;
end;
$$;

revoke execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function public.advance_baguio_sale(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) to service_role;
grant execute on function public.advance_baguio_sale(uuid, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
