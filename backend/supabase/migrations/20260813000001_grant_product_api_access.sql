-- The project does not auto-expose new tables to PostgREST roles. RLS policies
-- filter rows, while these grants allow authenticated administrators to reach them.
grant usage on schema public to authenticated;
grant select, insert on public.products to authenticated;
grant select, insert on public.product_variants to authenticated;

notify pgrst, 'reload schema';
