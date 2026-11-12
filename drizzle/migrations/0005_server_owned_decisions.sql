-- lovable-cron-fallback-reviewed: time-based Undo expiry, opt-in no-reply escalation and check-in purge need a clock; consolidated into one 5-minute job
create table public.reminder_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  on_date date not null,
  at_time time not null,
  created_at timestamptz not null default now(),
  unique (reminder_id, on_date)
);
grant select on public.reminder_overrides to authenticated;
grant all on public.reminder_overrides to service_role;
alter table public.reminder_overrides enable row level security;
create policy "own overrides read" on public.reminder_overrides for select to authenticated using (user_id = auth.uid());

alter table public.checkins add column expires_at timestamptz not null default (now() + interval '2 hours');
comment on column public.checkins.turns is 'Active conversation only; purged at expires_at by run_scheduled().';

drop policy if exists "own rows" on public.decisions;
revoke insert, update, delete on public.decisions from authenticated;
create policy "own decisions read" on public.decisions for select to authenticated using (user_id = auth.uid());

create or replace function public.guard_owner_progress() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    if tg_table_name = 'plans' then new.status := 'planning'; new.ride_status := 'none';
    else new.status := 'waiting_elder'; end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id then raise exception 'immutable_owner'; end if;
  if tg_table_name = 'plans' then
    if new.status is distinct from old.status and not (new.status = 'skipped' or (new.status = 'done' and old.status = 'going')) then
      raise exception 'status_server_only';
    end if;
    if new.ride_status is distinct from old.ride_status and not (new.ride_status = 'not_covered' and old.status = 'going') then
      raise exception 'ride_status_server_only';
    end if;
  else
    if new.status is distinct from old.status and new.status not in ('done','skipped') then raise exception 'status_server_only'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_owner_progress() from public, anon, authenticated;
create trigger guard_plans_progress before insert or update on public.plans for each row execute function public.guard_owner_progress();
create trigger guard_errands_progress before insert or update on public.errands for each row execute function public.guard_owner_progress();

create or replace function public.create_decision(_kind text, _target uuid, _option text, _shown_cost numeric, _payload jsonb, _key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _d decisions; _pl plans; _ok boolean; _quote numeric := 0; _p jsonb := '{}'; _tz text;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  if length(coalesce(_key,'')) < 8 or length(_key) > 80 then raise exception 'bad_key'; end if;
  select * into _d from decisions where idempotency_key = _key and user_id = auth.uid();
  if _d.id is not null then return to_jsonb(_d); end if;
  _ok := case _kind
    when 'plan_ride' then _option in ('family','own_way','none','skip') and exists(select 1 from plans where id = _target and user_id = auth.uid() and status in ('planning','going'))
    when 'recover' then _option in ('family','own_way','skip') and exists(select 1 from plans where id = _target and user_id = auth.uid() and status = 'going' and ride_status in ('not_covered','waiting_family'))
    when 'errand' then _option in ('family','own_way','skip') and exists(select 1 from errands where id = _target and user_id = auth.uid() and status in ('waiting_elder','waiting_family'))
    else false end;
  if not _ok then raise exception 'invalid_choice'; end if;
  if _kind <> 'errand' then
    select * into _pl from plans where id = _target;
    if _option = 'own_way' then _quote := _pl.ride_quote; end if;
    select timezone into _tz from profiles where id = auth.uid();
    if _payload ? 'friend' and length(trim(_payload->>'friend')) between 1 and 40 then _p := _p || jsonb_build_object('friend', trim(_payload->>'friend')); end if;
    if _kind = 'plan_ride' and _option <> 'skip' and _payload ? 'reminder_id' then
      if not exists(select 1 from reminders where id = (_payload->>'reminder_id')::uuid and user_id = auth.uid()) or coalesce(_payload->>'reminder_to','') !~ '^\d{2}:\d{2}$' then
        raise exception 'invalid_reminder';
      end if;
      _p := _p || jsonb_build_object('reminder_id', _payload->>'reminder_id', 'reminder_to', _payload->>'reminder_to',
        'reminder_date', to_char((coalesce(_pl.pickup_at, _pl.starts_at - interval '30 minutes') at time zone _tz)::date, 'YYYY-MM-DD'));
    end if;
  end if;
  if coalesce(_shown_cost, -1) <> _quote then raise exception 'quote_changed'; end if;
  update decisions set status = 'cancelled' where target_id = _target and user_id = auth.uid() and status = 'pending';
  insert into decisions(user_id, kind, target_id, option_id, quote_cost, payload, undo_until, idempotency_key)
    values (auth.uid(), _kind, _target, _option, _quote, _p, now() + interval '10 seconds', _key) returning * into _d;
  return to_jsonb(_d);
end $$;
grant execute on function public.create_decision(text, uuid, text, numeric, jsonb, text) to authenticated;
revoke execute on function public.create_decision(text, uuid, text, numeric, jsonb, text) from anon;

create or replace function public.cancel_decision(_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare _d decisions;
begin
  select * into _d from decisions where id = _id and user_id = auth.uid() for update;
  if _d.id is null then raise exception 'not_found'; end if;
  if _d.status <> 'pending' then return _d.status; end if;
  update decisions set status = 'cancelled' where id = _id;
  return 'cancelled';
end $$;
grant execute on function public.cancel_decision(uuid) to authenticated;
revoke execute on function public.cancel_decision(uuid) from anon;

create or replace function public.commit_decision_core(_id uuid, _send_now boolean) returns text language plpgsql security definer set search_path = public as $$
declare _d decisions; _pl plans; _er errands; _hh uuid; _name text; _tz text; _has_family boolean; _when text;
begin
  select * into _d from decisions where id = _id and user_id = auth.uid() for update;
  if _d.id is null then raise exception 'not_found'; end if;
  if _d.status <> 'pending' then return _d.status; end if;
  if not _send_now and now() < _d.undo_until then return 'too_early'; end if;
  select id into _hh from households where elder_id = auth.uid();
  _has_family := _hh is not null and exists(select 1 from household_members where household_id = _hh and status = 'active');
  select coalesce(nullif(display_name,''),'They'), timezone into _name, _tz from profiles where id = auth.uid();

  if _d.kind in ('plan_ride','recover') then
    select * into _pl from plans where id = _d.target_id and user_id = auth.uid() for update;
    if _pl.id is null then update decisions set status='rejected', result='missing' where id=_id; return 'rejected'; end if;
    if _d.option_id = 'own_way' and _pl.ride_quote <> _d.quote_cost then
      update decisions set status = 'rejected', result = 'quote_changed' where id = _id; return 'quote_changed';
    end if;
    _when := to_char(_pl.starts_at at time zone _tz, 'FMDay') || ' at ' || lower(to_char(_pl.starts_at at time zone _tz, 'FMHH12:MI am'));
    if _d.option_id = 'skip' then
      update plans set status = 'skipped', ride_status = 'none', updated_at = now() where id = _pl.id;
      insert into activity(user_id, entity_id, text) values (auth.uid(), _pl.id, 'Skipped ' || _pl.title || '.');
      if _hh is not null and _pl.status = 'going' then insert into updates(household_id, user_id, category, plan_id, text) values (_hh, auth.uid(), 'plans', _pl.id, _name || ' is skipping ' || _pl.title || '.'); end if;
    else
      if _d.option_id = 'family' then
        if not _has_family then update decisions set status='rejected', result='no_family' where id=_id; return 'no_family'; end if;
        update requests set status = 'withdrawn' where target_id = _pl.id and status = 'sent';
        insert into requests(household_id, user_id, kind, target_id, text)
          values (_hh, auth.uid(), 'ride', _pl.id, _name || ' is asking if you can drive them to ' || _pl.title || ', ' || _when || coalesce(' (pickup ' || lower(to_char(_pl.pickup_at at time zone _tz, 'FMHH12:MI am')) || ')', '') || '. ' || coalesce(nullif(_pl.place,''), ''));
        update plans set status = 'going', ride_status = 'waiting_family', updated_at = now() where id = _pl.id;
        insert into activity(user_id, entity_id, agent, text) values (auth.uid(), _pl.id, 'family', 'Asked your family for a ride. Waiting for an answer.');
      elsif _d.option_id = 'own_way' then
        update plans set status = 'going', ride_status = 'own_way', updated_at = now() where id = _pl.id;
        insert into activity(user_id, entity_id, text) values (auth.uid(), _pl.id, case when _d.quote_cost > 0 then 'You''ll make your own way (about $' || _d.quote_cost || ').' else 'You''ll make your own way.' end);
      else
        update plans set status = 'going', ride_status = 'not_needed', updated_at = now() where id = _pl.id;
        insert into activity(user_id, entity_id, text) values (auth.uid(), _pl.id, 'Added to your week. No ride needed.');
      end if;
      if _d.payload ? 'friend' then
        update plans set friend_name = left(_d.payload->>'friend', 40) where id = _pl.id;
        insert into activity(user_id, entity_id, agent, text) values (auth.uid(), _pl.id, 'outings', 'Noted that you''ll invite ' || left(_d.payload->>'friend', 40) || '. Company doesn''t message friends yet.');
      end if;
      if _d.payload ? 'reminder_id' and _d.payload ? 'reminder_date' then
        insert into reminder_overrides(user_id, reminder_id, on_date, at_time)
          select auth.uid(), r.id, (_d.payload->>'reminder_date')::date, (_d.payload->>'reminder_to')::time from reminders r where r.id = (_d.payload->>'reminder_id')::uuid and r.user_id = auth.uid()
          on conflict (reminder_id, on_date) do update set at_time = excluded.at_time;
        insert into activity(user_id, entity_id, text) values (auth.uid(), _pl.id, 'Moved a reminder to ' || (_d.payload->>'reminder_to') || ' on ' || to_char((_d.payload->>'reminder_date')::date, 'FMDay DD Mon') || ' only.');
      end if;
      if _hh is not null and _pl.status <> 'going' then
        insert into updates(household_id, user_id, category, plan_id, text) values (_hh, auth.uid(), 'plans', _pl.id, _name || ' is going to ' || _pl.title || ', ' || _when || '.');
      end if;
    end if;
  elsif _d.kind = 'errand' then
    select * into _er from errands where id = _d.target_id and user_id = auth.uid() for update;
    if _er.id is null then update decisions set status='rejected', result='missing' where id=_id; return 'rejected'; end if;
    if _d.option_id = 'family' then
      if not _has_family then update decisions set status='rejected', result='no_family' where id=_id; return 'no_family'; end if;
      insert into requests(household_id, user_id, kind, target_id, text) values (_hh, auth.uid(), 'errand', _er.id, _name || ' asks: could you bring ' || _er.item || coalesce(' by ' || to_char(_er.need_by, 'FMDay'), '') || '?');
      update errands set status = 'waiting_family' where id = _er.id;
      insert into activity(user_id, entity_id, agent, text) values (auth.uid(), _er.id, 'family', 'Asked your family to bring the ' || _er.item || '.');
    elsif _d.option_id = 'own_way' then
      update errands set status = 'own_way' where id = _er.id;
      insert into activity(user_id, entity_id, text) values (auth.uid(), _er.id, 'You''ll get the ' || _er.item || ' yourself.');
    else
      update errands set status = 'skipped' where id = _er.id;
    end if;
    if _hh is not null and _d.option_id <> 'skip' then
      insert into updates(household_id, user_id, category, text) values (_hh, auth.uid(), 'errands', _name || ' needs ' || _er.item || '.');
    end if;
  end if;
  update decisions set status = 'committed', result = 'ok' where id = _id;
  return 'committed';
end $$;
revoke execute on function public.commit_decision_core(uuid, boolean) from public, anon, authenticated;

update public.activity set text = 'Memory: saved one thing you agreed to.' where agent = 'memory' and text like 'Memory: saved "%';
update public.activity set text = 'Memory: corrected one thing.' where agent = 'memory' and text like 'Memory: corrected to "%';
update public.checkins set expires_at = now() where created_at < now() - interval '2 hours';

create or replace function public.run_scheduled() returns jsonb language plpgsql security definer set search_path = public as $$
declare _r record; _n int := 0; _e int := 0; _p int;
begin
  for _r in select id, user_id from decisions where status = 'pending' and undo_until < now() order by undo_until limit 200 loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', _r.user_id, 'role', 'authenticated')::text, true);
    begin perform commit_decision(_r.id, false); _n := _n + 1; exception when others then null; end;
  end loop;
  for _r in select h.id, h.elder_id from households h join profiles p on p.id = h.elder_id where p.escalate_no_reply loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', _r.elder_id, 'role', 'authenticated')::text, true);
    begin perform check_escalations(_r.id); _e := _e + 1; exception when others then null; end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  delete from checkins where expires_at < now();
  get diagnostics _p = row_count;
  return jsonb_build_object('committed', _n, 'escalation_checks', _e, 'purged_checkins', _p);
end $$;
revoke execute on function public.run_scheduled() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('company-every-5-min', '*/5 * * * *', 'select public.run_scheduled()');
