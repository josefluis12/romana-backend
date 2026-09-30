do $$
begin
  if to_regclass('public.customers') is null then
    raise exception 'The shared customers table is missing.';
  end if;
  if to_regclass('public.customer_sales_channels') is null then
    raise exception 'The customer channel membership table is missing.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'channel_sales_orders'
      and column_name = 'customer_id'
  ) then
    raise exception 'Baguio orders have not been migrated to the shared customer directory.';
  end if;
end;
$$;

drop table if exists public.customer_channel_client_migration_work;

alter table public.customer_sales_channels enable row level security;
revoke all on public.customer_sales_channels from anon, authenticated;
grant select, insert, update on public.customers, public.customer_sales_channels to service_role;
grant usage, select on sequence public.customer_reference_sequence to service_role;

drop function if exists public.register_customer(text, text, text, text, text, text, uuid, text);
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

drop function if exists public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text);
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
