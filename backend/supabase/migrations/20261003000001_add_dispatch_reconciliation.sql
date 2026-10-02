create table public.baguio_dispatch_reconciliations (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null unique references public.baguio_dispatches(id),
  driver_user_id uuid not null,
  driver_email text,
  total_collected numeric(12, 2) not null check (total_collected >= 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  submitted_at timestamptz not null default now()
);

create table public.baguio_dispatch_reconciliation_orders (
  reconciliation_id uuid not null references public.baguio_dispatch_reconciliations(id) on delete cascade,
  order_id uuid not null references public.channel_sales_orders(id),
  outcome text not null check (outcome in ('delivered', 'failed')),
  collected_amount numeric(12, 2) not null check (collected_amount >= 0),
  failure_reason text not null default '' check (char_length(failure_reason) <= 500),
  primary key (reconciliation_id, order_id),
  check (outcome = 'delivered' or (outcome = 'failed' and char_length(failure_reason) > 0))
);

create table public.baguio_dispatch_reconciliation_inventory (
  reconciliation_id uuid not null references public.baguio_dispatch_reconciliations(id) on delete cascade,
  product_variant_id uuid not null,
  product_title text not null,
  variant_label text not null,
  allocated_quantity integer not null check (allocated_quantity >= 0),
  delivered_quantity integer not null check (delivered_quantity >= 0),
  returned_quantity integer not null check (returned_quantity >= 0),
  damaged_quantity integer not null check (damaged_quantity >= 0),
  missing_quantity integer not null check (missing_quantity >= 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  notes text not null default '' check (char_length(notes) <= 500),
  primary key (reconciliation_id, product_variant_id)
);

alter table public.baguio_dispatch_reconciliations enable row level security;
alter table public.baguio_dispatch_reconciliation_orders enable row level security;
alter table public.baguio_dispatch_reconciliation_inventory enable row level security;
revoke all on public.baguio_dispatch_reconciliations from anon, authenticated;
revoke all on public.baguio_dispatch_reconciliation_orders from anon, authenticated;
revoke all on public.baguio_dispatch_reconciliation_inventory from anon, authenticated;
grant select, insert on public.baguio_dispatch_reconciliations to service_role;
grant select, insert on public.baguio_dispatch_reconciliation_orders to service_role;
grant select, insert on public.baguio_dispatch_reconciliation_inventory to service_role;

create function public.reconcile_driver_dispatch(
  target_dispatch_id uuid,
  driver_user_id uuid,
  driver_email text,
  order_results jsonb,
  inventory_exceptions jsonb,
  reconciliation_notes text
) returns boolean language plpgsql set search_path = public as $$
declare
  assigned_driver_id uuid;
  current_status text;
  dispatch_order_count integer;
  result_count integer;
  saved_reconciliation_id uuid;
begin
  if driver_user_id is null or jsonb_typeof(order_results) <> 'array'
    or jsonb_typeof(inventory_exceptions) <> 'array' then
    raise exception 'Invalid reconciliation input' using errcode = '22023';
  end if;

  select dispatches.driver_user_id, dispatches.status
    into assigned_driver_id, current_status
  from public.baguio_dispatches dispatches
  where dispatches.id = target_dispatch_id
  for update;

  if not found or assigned_driver_id is distinct from driver_user_id then return false; end if;
  if current_status = 'completed' then
    return exists (select 1 from public.baguio_dispatch_reconciliations where dispatch_id = target_dispatch_id);
  end if;
  if current_status <> 'in_transit' then return false; end if;

  select count(*) into dispatch_order_count
  from public.channel_sales_orders where dispatch_id = target_dispatch_id;
  select count(*) into result_count from jsonb_array_elements(order_results);
  if dispatch_order_count = 0 or result_count <> dispatch_order_count then return false; end if;
  if (select count(distinct item->>'orderId') from jsonb_array_elements(order_results) item) <> result_count then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(order_results) item
    left join public.channel_sales_orders orders
      on orders.id = (item->>'orderId')::uuid and orders.dispatch_id = target_dispatch_id
    where orders.id is null
      or item->>'outcome' not in ('delivered', 'failed')
      or (item->>'collectedAmount')::numeric < 0
      or (item->>'outcome' = 'delivered' and orders.status not in ('delivered', 'successful'))
      or (item->>'outcome' = 'failed' and orders.status <> 'in_transit')
      or (item->>'outcome' = 'failed' and char_length(btrim(item->>'failureReason')) = 0)
  ) then return false; end if;

  if exists (
    with returned as (
      select items.product_variant_id, sum(items.quantity)::integer quantity
      from jsonb_array_elements(order_results) result
      join public.channel_sales_orders orders on orders.id = (result->>'orderId')::uuid
      join public.channel_sale_items items on items.order_id = orders.id
      where result->>'outcome' = 'failed'
      group by items.product_variant_id
    ), exceptions as (
      select (item->>'productVariantId')::uuid product_variant_id,
        (item->>'damagedQuantity')::integer damaged,
        (item->>'missingQuantity')::integer missing
      from jsonb_array_elements(inventory_exceptions) item
    )
    select 1 from exceptions
    left join returned using (product_variant_id)
    where returned.product_variant_id is null or exceptions.damaged < 0 or exceptions.missing < 0
      or exceptions.damaged + exceptions.missing > returned.quantity
  ) then return false; end if;

  insert into public.baguio_dispatch_reconciliations (
    dispatch_id, driver_user_id, driver_email, total_collected, notes
  ) select target_dispatch_id, driver_user_id, driver_email,
    coalesce(sum((item->>'collectedAmount')::numeric), 0), coalesce(btrim(reconciliation_notes), '')
  from jsonb_array_elements(order_results) item
  returning id into saved_reconciliation_id;

  insert into public.baguio_dispatch_reconciliation_orders (
    reconciliation_id, order_id, outcome, collected_amount, failure_reason
  ) select saved_reconciliation_id, (item->>'orderId')::uuid, item->>'outcome',
    (item->>'collectedAmount')::numeric, coalesce(btrim(item->>'failureReason'), '')
  from jsonb_array_elements(order_results) item;

  insert into public.baguio_dispatch_reconciliation_inventory (
    reconciliation_id, product_variant_id, product_title, variant_label,
    allocated_quantity, delivered_quantity, returned_quantity,
    damaged_quantity, missing_quantity, remaining_quantity, notes
  )
  with allocation as (
    select items.product_variant_id, max(items.product_title) product_title,
      max(items.variant_label) variant_label, sum(items.quantity)::integer allocated,
      sum(items.quantity) filter (where result->>'outcome' = 'delivered')::integer delivered
    from jsonb_array_elements(order_results) result
    join public.channel_sales_orders orders on orders.id = (result->>'orderId')::uuid
    join public.channel_sale_items items on items.order_id = orders.id
    group by items.product_variant_id
  ), exceptions as (
    select (item->>'productVariantId')::uuid product_variant_id,
      (item->>'damagedQuantity')::integer damaged,
      (item->>'missingQuantity')::integer missing,
      coalesce(btrim(item->>'notes'), '') notes
    from jsonb_array_elements(inventory_exceptions) item
  )
  select saved_reconciliation_id, allocation.product_variant_id, allocation.product_title,
    allocation.variant_label, allocation.allocated, coalesce(allocation.delivered, 0),
    allocation.allocated - coalesce(allocation.delivered, 0),
    coalesce(exceptions.damaged, 0), coalesce(exceptions.missing, 0),
    allocation.allocated - coalesce(allocation.delivered, 0)
      - coalesce(exceptions.damaged, 0) - coalesce(exceptions.missing, 0),
    coalesce(exceptions.notes, '')
  from allocation left join exceptions using (product_variant_id);

  update public.channel_sales_orders orders
  set status = case when results.outcome = 'delivered' then 'successful' else 'cancelled' end,
    updated_at = now()
  from public.baguio_dispatch_reconciliation_orders results
  where results.reconciliation_id = saved_reconciliation_id and orders.id = results.order_id;

  update public.delivery_receipts receipts
  set status = case when results.outcome = 'delivered' then 'issued' else 'cancelled' end,
    issued_at = case when results.outcome = 'delivered' then coalesce(receipts.issued_at, now()) end
  from public.baguio_dispatch_reconciliation_orders results
  where results.reconciliation_id = saved_reconciliation_id and receipts.order_id = results.order_id;

  insert into public.channel_sale_events (order_id, status, actor_user_id, actor_email)
  select order_id, case when outcome = 'delivered' then 'successful' else 'cancelled' end,
    driver_user_id, driver_email
  from public.baguio_dispatch_reconciliation_orders where reconciliation_id = saved_reconciliation_id;

  update public.baguio_dispatches set status = 'completed', completed_at = now()
  where id = target_dispatch_id;
  return true;
end; $$;

revoke execute on function public.complete_driver_dispatch(uuid, uuid, text) from service_role;
revoke execute on function public.reconcile_driver_dispatch(uuid, uuid, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_driver_dispatch(uuid, uuid, text, jsonb, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';
