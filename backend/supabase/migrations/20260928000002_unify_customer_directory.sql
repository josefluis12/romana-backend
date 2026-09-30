create sequence if not exists public.customer_reference_sequence;

alter table public.customers drop constraint if exists customers_email_check;
alter table public.customers drop constraint if exists customers_first_name_check;
alter table public.customers drop constraint if exists customers_last_name_check;
alter table public.customers drop constraint if exists customers_email_format_check;
alter table public.customers drop constraint if exists customers_first_name_length_check;
alter table public.customers drop constraint if exists customers_last_name_length_check;
alter table public.customers alter column email drop not null;
alter table public.customers alter column first_name set default '';
alter table public.customers alter column last_name set default '';
alter table public.customers
  add constraint customers_email_format_check check (
    email is null or (email = lower(btrim(email)) and char_length(email) between 3 and 254)
  ),
  add constraint customers_first_name_length_check check (char_length(first_name) <= 100),
  add constraint customers_last_name_length_check check (char_length(last_name) <= 100);

alter table public.customers
  add column if not exists reference_number text default ('CUS-' || lpad(nextval('public.customer_reference_sequence')::text, 6, '0')),
  add column if not exists business_name text check (business_name is null or char_length(business_name) between 1 and 120),
  add column if not exists contact_person text not null default '' check (char_length(contact_person) <= 120),
  add column if not exists default_address text not null default '' check (char_length(default_address) <= 500),
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text;

alter table public.customers alter column reference_number set not null;
create unique index if not exists customers_reference_number_key on public.customers(reference_number);

create table if not exists public.customer_sales_channels (
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel_code text not null references public.sales_channels(code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (customer_id, channel_code)
);

insert into public.customer_sales_channels (customer_id, channel_code)
select id, 'online' from public.customers
on conflict (customer_id, channel_code) do nothing;

create table if not exists public.customer_channel_client_migration_work (
  channel_client_id uuid primary key,
  customer_id uuid not null
);

alter table public.customer_channel_client_migration_work enable row level security;
revoke all on public.customer_channel_client_migration_work from anon, authenticated;
truncate table public.customer_channel_client_migration_work;

insert into public.customer_channel_client_migration_work (channel_client_id, customer_id)
select clients.id, customers.id
from public.channel_clients clients
join public.customers customers on customers.email = clients.email
where clients.email is not null;

insert into public.customers (
  id, email, first_name, last_name, phone, business_name, contact_person,
  default_address, is_active, created_by_user_id, created_by_email, created_at, updated_at
)
select clients.id, clients.email, '', '', clients.phone, clients.name, clients.contact_person,
  clients.address, clients.is_active, clients.created_by_user_id, clients.created_by_email,
  clients.created_at, clients.updated_at
from public.channel_clients clients
where clients.email is null and not exists (
  select 1 from public.customer_channel_client_migration_work mapping where mapping.channel_client_id = clients.id
);

insert into public.customers (
  id, email, first_name, last_name, phone, business_name, contact_person,
  default_address, is_active, created_by_user_id, created_by_email, created_at, updated_at
)
select distinct on (clients.email)
  clients.id, clients.email, '', '', clients.phone, clients.name, clients.contact_person,
  clients.address, clients.is_active, clients.created_by_user_id, clients.created_by_email,
  clients.created_at, clients.updated_at
from public.channel_clients clients
where clients.email is not null and not exists (
  select 1 from public.customer_channel_client_migration_work mapping where mapping.channel_client_id = clients.id
)
order by clients.email, clients.created_at;

insert into public.customer_channel_client_migration_work (channel_client_id, customer_id)
select clients.id, customers.id
from public.channel_clients clients
join public.customers customers on customers.id = clients.id or customers.email = clients.email
where not exists (
  select 1 from public.customer_channel_client_migration_work mapping where mapping.channel_client_id = clients.id
);

insert into public.customer_sales_channels (customer_id, channel_code, is_active)
select mapping.customer_id, clients.channel_code, clients.is_active
from public.customer_channel_client_migration_work mapping
join public.channel_clients clients on clients.id = mapping.channel_client_id
on conflict (customer_id, channel_code) do update set is_active = excluded.is_active;

drop function if exists public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text);
alter table public.channel_sales_orders drop constraint if exists channel_sales_orders_client_id_fkey;

update public.channel_sales_orders orders
set client_id = mapping.customer_id
from public.customer_channel_client_migration_work mapping
where orders.client_id = mapping.channel_client_id;

alter table public.channel_sales_orders rename column client_id to customer_id;
alter table public.channel_sales_orders
  add constraint channel_sales_orders_customer_id_fkey foreign key (customer_id) references public.customers(id);

drop table public.customer_channel_client_migration_work;
drop table public.channel_clients;
drop sequence if exists public.channel_client_reference_sequence;

alter table public.customer_sales_channels enable row level security;
revoke all on public.customer_sales_channels from anon, authenticated;
grant select, insert, update on public.customers, public.customer_sales_channels to service_role;
grant usage, select on sequence public.customer_reference_sequence to service_role;

create function public.register_customer(
  customer_channel_code text,
  customer_name text,
  customer_address text,
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
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  if not exists (select 1 from public.sales_channels where code = customer_channel_code and is_active) then
    raise exception 'Sales channel not found' using errcode = 'P0002';
  end if;
  insert into public.customers (
    email, first_name, last_name, phone, business_name, contact_person,
    default_address, created_by_user_id, created_by_email
  ) values (
    nullif(lower(btrim(customer_email)), ''), '', '', customer_phone, customer_name,
    customer_contact_person, customer_address, performed_by_user_id, performed_by_email
  ) returning id into saved_customer_id;
  insert into public.customer_sales_channels (customer_id, channel_code)
  values (saved_customer_id, customer_channel_code);
  return saved_customer_id;
end;
$$;

create function public.create_baguio_sale(
  selected_customer_id uuid,
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
  selected_customer public.customers%rowtype;
begin
  if performed_by_user_id is null or jsonb_typeof(item_data) <> 'array' or jsonb_array_length(item_data) not between 1 and 50 then
    raise exception 'Invalid Baguio sale input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_locations where id = target_van_id and type = 'vehicle' and is_active) then
    raise exception 'Vehicle inventory location not found' using errcode = 'P0002';
  end if;
  select customers.* into selected_customer
  from public.customers customers
  join public.customer_sales_channels channels on channels.customer_id = customers.id
  where customers.id = selected_customer_id and customers.is_active
    and channels.channel_code = 'baguio' and channels.is_active;
  if not found then raise exception 'Baguio customer not found' using errcode = 'P0002'; end if;
  select sum((item->>'quantity')::integer * (item->>'unitPrice')::numeric)
  into calculated_total from jsonb_array_elements(item_data) item;

  insert into public.channel_sales_orders (
    channel_code, customer_id, client_name, client_address, client_phone, van_location_id,
    delivery_notes, total, created_by_user_id, created_by_email
  ) values (
    'baguio', selected_customer.id,
    coalesce(selected_customer.business_name, btrim(selected_customer.first_name || ' ' || selected_customer.last_name)),
    selected_customer.default_address, selected_customer.phone, target_van_id,
    order_notes, calculated_total, performed_by_user_id, performed_by_email
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

revoke execute on function public.register_customer(text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.register_customer(text, text, text, text, text, text, uuid, text) to service_role;
grant execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) to service_role;

notify pgrst, 'reload schema';
