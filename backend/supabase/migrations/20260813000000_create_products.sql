create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (char_length(category) between 1 and 80),
  best_seller boolean not null default false,
  is_active boolean not null default true,
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  allergens jsonb not null default '[]'::jsonb check (jsonb_typeof(allergens) = 'array'),
  short text not null check (char_length(short) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  price numeric(10, 2) not null check (price > 0),
  image text not null check (char_length(image) between 1 and 500),
  sort_order integer not null check (sort_order >= 0),
  unique (product_id, label)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;

grant usage on schema public to authenticated;
grant select, insert on public.products to authenticated;
grant select, insert on public.product_variants to authenticated;

create policy "Authenticated administrators can read products"
on public.products for select to authenticated using (auth.uid() is not null);

create policy "Authenticated administrators can create products"
on public.products for insert to authenticated with check (auth.uid() is not null);

create policy "Authenticated administrators can read product variants"
on public.product_variants for select to authenticated using (auth.uid() is not null);

create policy "Authenticated administrators can create product variants"
on public.product_variants for insert to authenticated with check (auth.uid() is not null);

create policy "Administrators can upload their product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create function public.create_product_with_variants(
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
declare
  new_product_id uuid;
begin
  if jsonb_typeof(product_variant_data) <> 'array'
    or jsonb_array_length(product_variant_data) not between 1 and 20 then
    raise exception 'A product requires between 1 and 20 variants' using errcode = '23514';
  end if;

  insert into public.products (slug, title, category, best_seller, ingredients, allergens, short)
  values (product_slug, product_title, product_category, product_best_seller, product_ingredients, product_allergens, product_short)
  returning id into new_product_id;

  insert into public.product_variants (product_id, label, price, image, sort_order)
  select new_product_id, variant->>'label', (variant->>'price')::numeric, variant->>'image', ordinality - 1
  from jsonb_array_elements(product_variant_data) with ordinality as item(variant, ordinality);

  return new_product_id;
end;
$$;

revoke execute on function public.create_product_with_variants(text, text, text, boolean, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.create_product_with_variants(text, text, text, boolean, jsonb, jsonb, text, jsonb) to authenticated;
