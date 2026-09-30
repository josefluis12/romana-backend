alter table public.baguio_dispatches
  add column if not exists driver_user_id uuid references auth.users(id),
  add column if not exists driver_name text,
  add column if not exists driver_email text;

create index if not exists baguio_dispatches_driver_user_id_idx
  on public.baguio_dispatches(driver_user_id, created_at desc);

drop function if exists public.create_baguio_dispatch(uuid, text, uuid, text);
create function public.create_baguio_dispatch(
  target_van_id uuid,
  assigned_driver_user_id uuid,
  assigned_driver_name text,
  assigned_driver_email text,
  dispatch_notes text,
  performed_by_user_id uuid,
  performed_by_email text
) returns uuid language plpgsql set search_path = public as $$
declare saved_dispatch_id uuid;
begin
  if performed_by_user_id is null then
    raise exception 'An authenticated actor is required' using errcode = '22004';
  end if;
  if assigned_driver_user_id is null or nullif(btrim(assigned_driver_name), '') is null or nullif(btrim(assigned_driver_email), '') is null then
    raise exception 'A driver account is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_locations where id = target_van_id and type = 'vehicle' and is_active) then
    raise exception 'Vehicle inventory location not found' using errcode = 'P0002';
  end if;
  insert into public.baguio_dispatches (
    van_location_id, driver_user_id, driver_name, driver_email, notes,
    created_by_user_id, created_by_email
  ) values (
    target_van_id, assigned_driver_user_id, btrim(assigned_driver_name), lower(btrim(assigned_driver_email)),
    coalesce(dispatch_notes, ''), performed_by_user_id, performed_by_email
  ) returning id into saved_dispatch_id;
  return saved_dispatch_id;
end; $$;

revoke execute on function public.create_baguio_dispatch(uuid, uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_baguio_dispatch(uuid, uuid, text, text, text, uuid, text)
  to service_role;
