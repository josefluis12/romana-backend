-- Upload the five referenced files to the product-images/samples Storage folder,
-- then replace YOUR_PROJECT_REF below before running this seed.
do $$
declare
  image_base_url constant text :=
    'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/product-images/samples/';
begin
  insert into public.products (
    slug,
    title,
    category,
    best_seller,
    ingredients,
    allergens,
    short
  ) values
    (
      'cashew-butter',
      'Cashew Butter',
      'Spreads',
      true,
      '["Roasted cashews", "Sugar", "Salt"]'::jsonb,
      '["Contains cashews", "Processed in a facility that may handle peanuts and other tree nuts"]'::jsonb,
      'Creamy cashew butter made from roasted cashews. Perfect for spreading or adding to your favorite recipes.'
    ),
    (
      'rosemary-garlic-bits',
      'Rosemary Garlic Bits',
      'Savory Snacks',
      true,
      '["Garlic", "Vegetable oil", "Rosemary", "Salt", "Seasoning"]'::jsonb,
      '["Processed in a facility that may handle peanuts, cashews, and other tree nuts"]'::jsonb,
      'Crispy and flavorful garlic bits infused with aromatic rosemary. Perfect for snacking or as a savory topping.'
    ),
    (
      'romana-peanut-brittle',
      'Peanut Brittle',
      'Sweet Classics',
      false,
      '["Peanuts", "Sugar", "Glucose syrup", "Butter", "Salt"]'::jsonb,
      '["Contains peanuts", "Contains milk", "Processed in a facility that may handle cashews and other tree nuts"]'::jsonb,
      'A Baguio classic, crispy peanut brittle with a perfect balance of sweetness and crunch. Available in multiple sizes.'
    )
  on conflict (slug) do update set
    title = excluded.title,
    category = excluded.category,
    best_seller = excluded.best_seller,
    ingredients = excluded.ingredients,
    allergens = excluded.allergens,
    short = excluded.short,
    updated_at = now();

  insert into public.product_variants (
    product_id,
    label,
    price,
    image,
    sort_order
  ) values
    (
      (select id from public.products where slug = 'cashew-butter'),
      'Standard',
      320.00,
      image_base_url || 'cashew-butter.png',
      0
    ),
    (
      (select id from public.products where slug = 'rosemary-garlic-bits'),
      'Standard',
      280.00,
      image_base_url || 'rosemary-garlic-bits.png',
      0
    ),
    (
      (select id from public.products where slug = 'romana-peanut-brittle'),
      '140g',
      140.00,
      image_base_url || 'peanut-brittle-140g.png',
      0
    ),
    (
      (select id from public.products where slug = 'romana-peanut-brittle'),
      '460g',
      460.00,
      image_base_url || 'peanut-brittle-460g.png',
      1
    ),
    (
      (select id from public.products where slug = 'romana-peanut-brittle'),
      '800g',
      800.00,
      image_base_url || 'peanut-brittle-800g.png',
      2
    )
  on conflict (product_id, label) do update set
    price = excluded.price,
    image = excluded.image,
    sort_order = excluded.sort_order;
end
$$;
