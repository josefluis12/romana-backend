alter table public.products
add column if not exists is_active boolean not null default true;

grant update on public.products to authenticated;
grant delete on public.product_variants to authenticated;

create policy "Authenticated administrators can update products"
on public.products for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "Authenticated administrators can delete product variants"
on public.product_variants for delete to authenticated
using (auth.uid() is not null);

create function public.update_product_with_variants(
  product_id uuid,
  product_slug text,
  product_title text,
  product_category text,
  product_best_seller boolean,
  product_ingredients jsonb,
  product_allergens jsonb,
  product_short text,
  product_variant_data jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(product_variant_data) <> 'array'
    or jsonb_array_length(product_variant_data) not between 1 and 20 then
    raise exception 'A product requires between 1 and 20 variants' using errcode = '23514';
  end if;

  update public.products as existing_product set
    slug = product_slug,
    title = product_title,
    category = product_category,
    best_seller = product_best_seller,
    ingredients = product_ingredients,
    allergens = product_allergens,
    short = product_short,
    updated_at = now()
  where existing_product.id = update_product_with_variants.product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  delete from public.product_variants as existing_variant
  where existing_variant.product_id = update_product_with_variants.product_id;
  insert into public.product_variants (product_id, label, price, image, sort_order)
  select update_product_with_variants.product_id, variant->>'label', (variant->>'price')::numeric, variant->>'image', ordinality - 1
  from jsonb_array_elements(product_variant_data) with ordinality as item(variant, ordinality);

  return product_id;
end;
$$;

revoke execute on function public.update_product_with_variants(uuid, text, text, text, boolean, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.update_product_with_variants(uuid, text, text, text, boolean, jsonb, jsonb, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
