create table if not exists public.channel_sale_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.channel_sales_orders(id) on delete cascade,
  previous_items jsonb not null,
  revised_items jsonb not null,
  previous_total numeric(12, 2) not null,
  revised_total numeric(12, 2) not null,
  actor_user_id uuid not null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists channel_sale_revisions_order_created_index
on public.channel_sale_revisions(order_id, created_at desc);

alter table public.channel_sale_revisions enable row level security;
revoke all on public.channel_sale_revisions from anon, authenticated;
grant select, insert on public.channel_sale_revisions to service_role;

create or replace function public.revise_baguio_sale(
  target_order_id uuid,
  order_notes text,
  item_data jsonb,
  performed_by_user_id uuid,
  performed_by_email text
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  current_status text;
  old_items jsonb;
  old_total numeric(12, 2);
  new_items jsonb;
  new_total numeric(12, 2);
  saved_transfer_id uuid;
begin
  if performed_by_user_id is null or jsonb_typeof(item_data) <> 'array'
    or jsonb_array_length(item_data) not between 1 and 50 then
    raise exception 'Invalid Baguio order revision' using errcode = '22023';
  end if;

  select status, total into current_status, old_total
  from public.channel_sales_orders
  where id = target_order_id and channel_code = 'baguio'
  for update;
  if current_status is null then raise exception 'Baguio order not found' using errcode = 'P0002'; end if;
  if current_status in ('delivered', 'successful', 'cancelled') then return false; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productVariantId', product_variant_id,
    'productTitle', product_title,
    'variantLabel', variant_label,
    'quantity', quantity,
    'unitPrice', unit_price
  ) order by product_title, variant_label), '[]'::jsonb)
  into old_items from public.channel_sale_items where order_id = target_order_id;

  delete from public.channel_sale_items where order_id = target_order_id;
  insert into public.channel_sale_items (
    order_id, product_variant_id, product_title, variant_label, quantity, unit_price
  )
  select target_order_id, variant.id, product.title, variant.label,
    (item->>'quantity')::integer, (item->>'unitPrice')::numeric
  from jsonb_array_elements(item_data) item
  join public.product_variants variant on variant.id = (item->>'productVariantId')::uuid
  join public.products product on product.id = variant.product_id;
  if (select count(*) from public.channel_sale_items where order_id = target_order_id) <> jsonb_array_length(item_data) then
    raise exception 'One or more product variants were not found' using errcode = 'P0002';
  end if;

  select sum(line_total), jsonb_agg(jsonb_build_object(
    'productVariantId', product_variant_id,
    'productTitle', product_title,
    'variantLabel', variant_label,
    'quantity', quantity,
    'unitPrice', unit_price
  ) order by product_title, variant_label)
  into new_total, new_items from public.channel_sale_items where order_id = target_order_id;

  update public.channel_sales_orders
  set total = new_total, delivery_notes = coalesce(order_notes, ''), updated_at = now()
  where id = target_order_id;

  select id into saved_transfer_id from public.inventory_transfers where order_id = target_order_id;
  if saved_transfer_id is not null then
    delete from public.inventory_transfer_items where transfer_id = saved_transfer_id;
    insert into public.inventory_transfer_items (transfer_id, product_variant_id, quantity)
    select saved_transfer_id, product_variant_id, quantity
    from public.channel_sale_items where order_id = target_order_id;
  end if;

  insert into public.channel_sale_revisions (
    order_id, previous_items, revised_items, previous_total, revised_total,
    actor_user_id, actor_email
  ) values (
    target_order_id, old_items, new_items, old_total, new_total,
    performed_by_user_id, performed_by_email
  );
  return true;
end;
$$;

revoke execute on function public.revise_baguio_sale(uuid, text, jsonb, uuid, text)
from public, anon, authenticated;
grant execute on function public.revise_baguio_sale(uuid, text, jsonb, uuid, text)
to service_role;

notify pgrst, 'reload schema';
