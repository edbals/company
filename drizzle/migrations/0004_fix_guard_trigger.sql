create or replace function public.guard_household_row() returns trigger language plpgsql security definer set search_path = public as $$
declare _plan uuid;
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.household_id is distinct from old.household_id) then
    raise exception 'immutable_owner';
  end if;
  if not exists(select 1 from households h where h.id = new.household_id and h.elder_id = new.user_id) then
    raise exception 'household_mismatch';
  end if;
  if tg_table_name in ('alerts','updates') then
    _plan := (to_jsonb(new)->>'plan_id')::uuid;
    if _plan is not null and not exists(select 1 from plans p where p.id = _plan and p.user_id = new.user_id) then
      raise exception 'plan_mismatch';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_household_row() from public, anon, authenticated;
