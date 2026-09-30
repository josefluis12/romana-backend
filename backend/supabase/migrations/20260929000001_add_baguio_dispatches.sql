create sequence if not exists public.baguio_dispatch_reference_sequence;

create table if not exists public.baguio_dispatches (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default ('DSP-' || lpad(nextval('public.baguio_dispatch_reference_sequence')::text, 6, '0')),
  van_location_id uuid not null references public.inventory_locations(id),
  status text not null default 'preparing' check (status in ('preparing', 'in_transit', 'completed', 'cancelled')),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by_user_id uuid not null,
  created_by_email text,
  created_at timestamptz not null default now(),
  departed_at timestamptz,
  completed_at timestamptz
);

alter table public.channel_sales_orders add column if not exists dispatch_id uuid;
update public.channel_sales_orders set dispatch_id = gen_random_uuid()
where channel_code = 'baguio' and dispatch_id is null;

insert into public.baguio_dispatches (
  id, van_location_id, status, created_by_user_id, created_by_email, created_at, departed_at, completed_at
)
select dispatch_id, van_location_id,
  case when status = 'cancelled' then 'cancelled' when status in ('successful', 'delivered') then 'completed' when status = 'in_transit' then 'in_transit' else 'preparing' end,
  created_by_user_id, created_by_email, created_at,
  case when status in ('in_transit', 'delivered', 'successful') then updated_at end,
  case when status in ('delivered', 'successful') then updated_at end
from public.channel_sales_orders
where channel_code = 'baguio'
on conflict (id) do nothing;

alter table public.channel_sales_orders
  add constraint channel_sales_orders_dispatch_id_fkey foreign key (dispatch_id) references public.baguio_dispatches(id);
alter table public.channel_sales_orders
  add constraint baguio_orders_require_dispatch check (channel_code <> 'baguio' or dispatch_id is not null);
alter table public.baguio_dispatches enable row level security;
revoke all on public.baguio_dispatches from anon, authenticated;
grant select, insert, update on public.baguio_dispatches to service_role;
grant usage, select on sequence public.baguio_dispatch_reference_sequence to service_role;

create or replace function public.create_baguio_dispatch(
  target_van_id uuid, dispatch_notes text, performed_by_user_id uuid, performed_by_email text
) returns uuid language plpgsql set search_path = public as $$
declare saved_dispatch_id uuid;
begin
  if performed_by_user_id is null then raise exception 'An authenticated actor is required' using errcode = '22004'; end if;
  if not exists (select 1 from public.inventory_locations where id = target_van_id and type = 'vehicle' and is_active) then
    raise exception 'Vehicle inventory location not found' using errcode = 'P0002';
  end if;
  insert into public.baguio_dispatches (van_location_id, notes, created_by_user_id, created_by_email)
  values (target_van_id, coalesce(dispatch_notes, ''), performed_by_user_id, performed_by_email)
  returning id into saved_dispatch_id;
  return saved_dispatch_id;
end; $$;

drop function if exists public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text);
create function public.create_baguio_sale(
  selected_customer_id uuid, selected_dispatch_id uuid, prepared_by_name text, order_notes text,
  item_data jsonb, performed_by_user_id uuid, performed_by_email text
) returns uuid language plpgsql set search_path = public as $$
declare saved_order_id uuid; calculated_total numeric(12,2); selected_customer public.customers%rowtype; selected_dispatch public.baguio_dispatches%rowtype;
begin
  if performed_by_user_id is null or jsonb_typeof(item_data) <> 'array' or jsonb_array_length(item_data) not between 1 and 50 then raise exception 'Invalid Baguio sale input' using errcode = '22023'; end if;
  select * into selected_dispatch from public.baguio_dispatches where id = selected_dispatch_id and status = 'preparing' for update;
  if not found then raise exception 'Open dispatch not found' using errcode = 'P0002'; end if;
  select customers.* into selected_customer from public.customers customers join public.customer_sales_channels channels on channels.customer_id = customers.id
  where customers.id = selected_customer_id and customers.is_active and channels.channel_code = 'baguio' and channels.is_active;
  if not found then raise exception 'Baguio customer not found' using errcode = 'P0002'; end if;
  select sum((item->>'quantity')::integer * (item->>'unitPrice')::numeric) into calculated_total from jsonb_array_elements(item_data) item;
  insert into public.channel_sales_orders (channel_code, customer_id, dispatch_id, client_name, client_address, client_phone, van_location_id, delivery_notes, total, created_by_user_id, created_by_email)
  values ('baguio', selected_customer.id, selected_dispatch.id, coalesce(selected_customer.business_name, btrim(selected_customer.first_name || ' ' || selected_customer.last_name)), selected_customer.default_address, selected_customer.phone, selected_dispatch.van_location_id, order_notes, calculated_total, performed_by_user_id, performed_by_email)
  returning id into saved_order_id;
  insert into public.channel_sale_items (order_id, product_variant_id, product_title, variant_label, quantity, unit_price)
  select saved_order_id, variant.id, product.title, variant.label, (item->>'quantity')::integer, (item->>'unitPrice')::numeric
  from jsonb_array_elements(item_data) item join public.product_variants variant on variant.id = (item->>'productVariantId')::uuid join public.products product on product.id = variant.product_id;
  if (select count(*) from public.channel_sale_items where order_id = saved_order_id) <> jsonb_array_length(item_data) then raise exception 'One or more product variants were not found' using errcode = 'P0002'; end if;
  insert into public.delivery_order_forms (order_id, prepared_by_name) values (saved_order_id, prepared_by_name);
  insert into public.delivery_receipts (order_id) values (saved_order_id);
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email) values (saved_order_id, 'draft', performed_by_user_id, performed_by_email);
  return saved_order_id;
end; $$;

create or replace function public.advance_baguio_sale(
  target_order_id uuid, requested_action text, performed_by_user_id uuid, performed_by_email text
) returns boolean language plpgsql set search_path = public as $$
declare current_status text; next_status text; factory_id uuid; transfer_id uuid;
begin
  if performed_by_user_id is null then raise exception 'An authenticated actor is required' using errcode = '22004'; end if;
  select status into current_status from public.channel_sales_orders where id = target_order_id and channel_code = 'baguio' for update;
  next_status := case
    when requested_action = 'submit' and current_status = 'draft' then 'pending_approval'
    when requested_action = 'approve' and current_status = 'pending_approval' then 'approved'
    when requested_action = 'load' and current_status = 'approved' then 'loaded'
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
    select id, factory_id, van_location_id, 'completed' from public.channel_sales_orders where id = target_order_id returning id into transfer_id;
    insert into public.inventory_transfer_items (transfer_id, product_variant_id, quantity)
    select transfer_id, product_variant_id, quantity from public.channel_sale_items where order_id = target_order_id;
  elsif requested_action = 'complete' then
    update public.delivery_receipts set status = 'issued', client_acknowledged_at = now(), issued_at = now() where order_id = target_order_id;
  end if;
  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  values (target_order_id, next_status, performed_by_user_id, performed_by_email);
  return true;
end; $$;

create or replace function public.advance_baguio_dispatch(
  target_dispatch_id uuid, requested_action text, performed_by_user_id uuid, performed_by_email text
) returns boolean language plpgsql set search_path = public as $$
declare current_status text; order_count integer; unready_count integer;
begin
  if performed_by_user_id is null then raise exception 'An authenticated actor is required' using errcode = '22004'; end if;
  select status into current_status from public.baguio_dispatches where id = target_dispatch_id for update;
  if requested_action = 'start' and current_status = 'preparing' then
    select count(*), count(*) filter (where status <> 'loaded') into order_count, unready_count from public.channel_sales_orders where dispatch_id = target_dispatch_id;
    if order_count = 0 or unready_count > 0 then return false; end if;
    update public.baguio_dispatches set status = 'in_transit', departed_at = now() where id = target_dispatch_id;
    update public.channel_sales_orders set status = 'in_transit', updated_at = now() where dispatch_id = target_dispatch_id;
    update public.delivery_order_forms forms set status = 'dispatched', dispatched_at = now() from public.channel_sales_orders orders where orders.dispatch_id = target_dispatch_id and forms.order_id = orders.id;
    insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
    select id, 'in_transit', performed_by_user_id, performed_by_email from public.channel_sales_orders where dispatch_id = target_dispatch_id;
    return true;
  end if;
  if requested_action = 'complete' and current_status = 'in_transit' and not exists (
    select 1 from public.channel_sales_orders where dispatch_id = target_dispatch_id and status not in ('delivered', 'successful')
  ) then
    update public.baguio_dispatches set status = 'completed', completed_at = now() where id = target_dispatch_id;
    return true;
  end if;
  return false;
end; $$;

revoke execute on function public.create_baguio_dispatch(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function public.advance_baguio_sale(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.advance_baguio_dispatch(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_baguio_dispatch(uuid, text, uuid, text) to service_role;
grant execute on function public.create_baguio_sale(uuid, uuid, text, text, jsonb, uuid, text) to service_role;
grant execute on function public.advance_baguio_sale(uuid, text, uuid, text) to service_role;
grant execute on function public.advance_baguio_dispatch(uuid, text, uuid, text) to service_role;
notify pgrst, 'reload schema';
