create function public.complete_driver_dispatch(
  target_dispatch_id uuid,
  driver_user_id uuid,
  driver_email text
) returns boolean language plpgsql set search_path = public as $$
declare
  assigned_driver_id uuid;
  current_status text;
begin
  if driver_user_id is null then
    raise exception 'An authenticated driver is required' using errcode = '22004';
  end if;

  select dispatches.driver_user_id, dispatches.status
    into assigned_driver_id, current_status
  from public.baguio_dispatches dispatches
  where dispatches.id = target_dispatch_id
  for update;

  if not found or assigned_driver_id is distinct from driver_user_id then
    return false;
  end if;
  if current_status = 'completed' then
    return true;
  end if;

  return public.advance_baguio_dispatch(
    target_dispatch_id,
    'complete',
    driver_user_id,
    driver_email
  );
end; $$;

revoke execute on function public.complete_driver_dispatch(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_driver_dispatch(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
