alter table public.channel_sales_orders
add column if not exists added_after_departure boolean not null default false;

create table if not exists public.baguio_dispatch_allocation_snapshots (
  dispatch_id uuid not null references public.baguio_dispatches(id) on delete cascade,
  order_id uuid not null references public.channel_sales_orders(id) on delete cascade,
  order_reference_number text not null,
  client_name text not null,
  product_variant_id uuid not null,
  product_title text not null,
  variant_label text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  primary key (dispatch_id, order_id, product_variant_id)
);

alter table public.baguio_dispatch_allocation_snapshots enable row level security;
revoke all on public.baguio_dispatch_allocation_snapshots from anon, authenticated;
grant select, insert on public.baguio_dispatch_allocation_snapshots to service_role;

drop function if exists public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text);
create function public.create_baguio_sale(
  selected_customer_id uuid, selected_dispatch_id uuid, prepared_by_name text,
  order_notes text, item_data jsonb, performed_by_user_id uuid, performed_by_email text
) returns uuid language plpgsql set search_path = public as $$
declare
  saved_order_id uuid;
  calculated_total numeric(12, 2);
  initial_status text;
  selected_customer public.customers%rowtype;
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
  select sum((item->>'quantity')::integer * (item->>'unitPrice')::numeric)
  into calculated_total from jsonb_array_elements(item_data) item;
  initial_status := case when selected_dispatch.status = 'in_transit' then 'in_transit' else 'draft' end;

  insert into public.channel_sales_orders (
    channel_code, customer_id, dispatch_id, client_name, client_address, client_phone,
    van_location_id, delivery_notes, total, status, added_after_departure,
    created_by_user_id, created_by_email
  ) values (
    'baguio', selected_customer.id, selected_dispatch.id,
    coalesce(selected_customer.business_name, btrim(selected_customer.first_name || ' ' || selected_customer.last_name)),
    selected_customer.default_address, selected_customer.phone, selected_dispatch.van_location_id,
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

create or replace function public.advance_baguio_dispatch(
  target_dispatch_id uuid, requested_action text,
  performed_by_user_id uuid, performed_by_email text
) returns boolean language plpgsql set search_path = public as $$
declare current_status text; order_count integer; unready_count integer;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  select status into current_status from public.baguio_dispatches
  where id = target_dispatch_id for update;
  if requested_action = 'start' and current_status = 'preparing' then
    select count(*), count(*) filter (where status <> 'loaded')
    into order_count, unready_count from public.channel_sales_orders
    where dispatch_id = target_dispatch_id;
    if order_count = 0 or unready_count > 0 then return false; end if;
    insert into public.baguio_dispatch_allocation_snapshots (
      dispatch_id, order_id, order_reference_number, client_name,
      product_variant_id, product_title, variant_label, quantity
    )
    select target_dispatch_id, orders.id, orders.reference_number, orders.client_name,
      items.product_variant_id, items.product_title, items.variant_label, items.quantity
    from public.channel_sales_orders orders
    join public.channel_sale_items items on items.order_id = orders.id
    where orders.dispatch_id = target_dispatch_id
    on conflict (dispatch_id, order_id, product_variant_id) do nothing;
    update public.baguio_dispatches set status = 'in_transit', departed_at = now()
    where id = target_dispatch_id;
    update public.channel_sales_orders set status = 'in_transit', updated_at = now()
    where dispatch_id = target_dispatch_id;
    update public.delivery_order_forms forms
    set status = 'dispatched', dispatched_at = now()
    from public.channel_sales_orders orders
    where orders.dispatch_id = target_dispatch_id and forms.order_id = orders.id;
    insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
    select id, 'in_transit', performed_by_user_id, performed_by_email
    from public.channel_sales_orders where dispatch_id = target_dispatch_id;
    return true;
  end if;
  if requested_action = 'complete' and current_status = 'in_transit' and not exists (
    select 1 from public.channel_sales_orders
    where dispatch_id = target_dispatch_id and status not in ('delivered', 'successful')
  ) then
    update public.baguio_dispatches set status = 'completed', completed_at = now()
    where id = target_dispatch_id;
    return true;
  end if;
  return false;
end; $$;

revoke execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text)
from public, anon, authenticated;
revoke execute on function public.advance_baguio_dispatch(uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text)
to service_role;
grant execute on function public.advance_baguio_dispatch(uuid, text, uuid, text)
to service_role;

notify pgrst, 'reload schema';
