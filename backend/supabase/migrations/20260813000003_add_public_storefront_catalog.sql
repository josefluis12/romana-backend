grant usage on schema public to anon;
grant select on public.products to anon;
grant select on public.product_variants to anon;

create policy "Public can read active products"
on public.products for select to anon
using (is_active = true);

create policy "Public can read variants of active products"
on public.product_variants for select to anon
using (
  exists (
    select 1
    from public.products
    where products.id = product_variants.product_id
      and products.is_active = true
  )
);

notify pgrst, 'reload schema';
