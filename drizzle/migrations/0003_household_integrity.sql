-- 1. Owner/household correspondence on elder-written household rows
create or replace function public.guard_household_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.household_id is distinct from old.household_id) then
    raise exception 'immutable_owner';
  end if;
  if not exists(select 1 from households h where h.id = new.household_id and h.elder_id = new.user_id) then
    raise exception 'household_mismatch';
  end if;
  if tg_table_name in ('alerts','updates') and new.plan_id is not null
     and not exists(select 1 from plans p where p.id = new.plan_id and p.user_id = new.user_id) then
    raise exception 'plan_mismatch';
  end if;
  return new;
end $$;
revoke execute on function public.guard_household_row() from public, anon, authenticated;

drop trigger if exists guard_alerts on public.alerts;
create trigger guard_alerts before insert or update on public.alerts for each row execute function public.guard_household_row();
drop trigger if exists guard_requests on public.requests;
create trigger guard_requests before insert or update on public.requests for each row execute function public.guard_household_row();
drop trigger if exists guard_updates on public.updates;
create trigger guard_updates before insert or update on public.updates for each row execute function public.guard_household_row();

drop policy if exists "elder updates own" on public.alerts;
create policy "elder updates own" on public.alerts for update to authenticated
  using (user_id = auth.uid() and household_id = my_household()) with check (user_id = auth.uid() and household_id = my_household());
drop policy if exists "elder updates own" on public.requests;
create policy "elder updates own" on public.requests for update to authenticated
  using (user_id = auth.uid() and household_id = my_household()) with check (user_id = auth.uid() and household_id = my_household());
drop policy if exists "elder updates own" on public.updates;
create policy "elder updates own" on public.updates for update to authenticated
  using (user_id = auth.uid() and household_id = my_household()) with check (user_id = auth.uid() and household_id = my_household());

-- 5. Plan deletion removes its updates/alerts links
delete from public.updates u where u.plan_id is not null and not exists(select 1 from public.plans p where p.id = u.plan_id);
update public.alerts a set plan_id = null where a.plan_id is not null and not exists(select 1 from public.plans p where p.id = a.plan_id);
alter table public.updates add constraint updates_plan_fk foreign key (plan_id) references public.plans(id) on delete cascade;
alter table public.alerts add constraint alerts_plan_fk foreign key (plan_id) references public.plans(id) on delete set null;

-- 2. Escalation check is internal only and guarded
create or replace function public.check_escalations(_hh uuid) returns void language plpgsql security definer set search_path = public as $$
declare _p record;
begin
  if auth.uid() is null or not (is_active_member(_hh) or exists(select 1 from households where id = _hh and elder_id = auth.uid())) then
    raise exception 'not_allowed';
  end if;
  for _p in select pl.id, pl.user_id, pl.title, pr.display_name from plans pl join households h on h.elder_id = pl.user_id join profiles pr on pr.id = pl.user_id
    where h.id = _hh and pr.escalate_no_reply and pl.status = 'going' and pl.ride_status in ('not_covered','waiting_family')
      and pl.starts_at between now() and now() + interval '90 minutes'
      and not exists(select 1 from alerts a where a.plan_id = pl.id and a.kind = 'no_reply') loop
    insert into alerts(household_id, user_id, kind, plan_id, message)
    values (_hh, _p.user_id, 'no_reply', _p.id, coalesce(nullif(_p.display_name,''),'Your family member') || '''s ride to ' || _p.title || ' fell through and no other way has been picked yet.');
  end loop;
end $$;
revoke execute on function public.check_escalations(uuid) from public, anon, authenticated;

-- 3. Idempotent acknowledgement
create or replace function public.ack_alert(_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare _a alerts;
begin
  select * into _a from alerts where id = _id for update;
  if _a.id is null or not is_active_member(_a.household_id)
     or not exists(select 1 from households h where h.id = _a.household_id and h.elder_id = _a.user_id) then
    raise exception 'not_found';
  end if;
  if _a.ack_at is not null then return; end if;
  update alerts set ack_at = now(), ack_by = auth.uid() where id = _id;
  insert into activity(user_id, entity_id, agent, text)
    select _a.user_id, _a.id, 'family', coalesce(nullif(p.display_name,''),'Your family member') || ' saw your help alert.' from profiles p where p.id = auth.uid();
end $$;

-- respond_request: also require request owner is the household elder
create or replace function public.respond_request(_id uuid, _accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare _r requests; _name text; _item text;
begin
  select * into _r from requests where id = _id for update;
  if _r.id is null or not is_active_member(_r.household_id)
     or not exists(select 1 from households h where h.id = _r.household_id and h.elder_id = _r.user_id) then raise exception 'not_found'; end if;
  if _r.status <> 'sent' then return _r.status; end if;
  update requests set status = case when _accept then 'accepted' else 'declined' end, responder_id = auth.uid(), responded_at = now() where id = _id;
  select coalesce(nullif(display_name,''),'Your family member') into _name from profiles where id = auth.uid();
  if _r.kind = 'ride' then
    update plans set ride_status = case when _accept then 'covered_family' else 'not_covered' end, updated_at = now() where id = _r.target_id and user_id = _r.user_id and ride_status = 'waiting_family';
    insert into activity(user_id, entity_id, agent, text) values (_r.user_id, _r.target_id, 'family', case when _accept then _name || ' said yes: they''ll drive you.' else _name || ' can''t this time.' end);
  else
    update errands set status = case when _accept then 'covered_family' else 'waiting_elder' end where id = _r.target_id and user_id = _r.user_id and status = 'waiting_family';
    select item into _item from errands where id = _r.target_id and user_id = _r.user_id;
    insert into activity(user_id, entity_id, agent, text) values (_r.user_id, _r.target_id, 'family', case when _accept then _name || ' will bring the ' || coalesce(_item,'item') || '.' else _name || ' can''t bring the ' || coalesce(_item,'item') || ' this time.' end);
  end if;
  return case when _accept then 'accepted' else 'declined' end;
end $$;

-- 4. Decision allowlist + target state validation (wraps the existing commit logic)
alter function public.commit_decision(uuid, boolean) rename to commit_decision_core;
revoke execute on function public.commit_decision_core(uuid, boolean) from public, anon, authenticated;
create or replace function public.commit_decision(_id uuid, _send_now boolean) returns text language plpgsql security definer set search_path = public as $$
declare _d decisions; _ok boolean;
begin
  select * into _d from decisions where id = _id and user_id = auth.uid() for update;
  if _d.id is null then raise exception 'not_found'; end if;
  if _d.status <> 'pending' then return _d.status; end if;
  _ok := case _d.kind
    when 'plan_ride' then _d.option_id in ('family','own_way','taxi_self','none','skip')
      and exists(select 1 from plans where id = _d.target_id and user_id = auth.uid() and status in ('planning','going'))
    when 'recover' then _d.option_id in ('family','own_way','taxi_self','skip')
      and exists(select 1 from plans where id = _d.target_id and user_id = auth.uid() and status = 'going' and ride_status in ('not_covered','waiting_family'))
    when 'errand' then _d.option_id in ('family','own_way','skip')
      and exists(select 1 from errands where id = _d.target_id and user_id = auth.uid() and status in ('waiting_elder','waiting_family'))
    else false end;
  if not _ok then
    update decisions set status = 'rejected', result = 'invalid' where id = _id;
    return 'rejected';
  end if;
  return commit_decision_core(_id, _send_now);
end $$;
grant execute on function public.commit_decision(uuid, boolean) to authenticated;
revoke execute on function public.commit_decision(uuid, boolean) from anon;

-- 1 & 5. Family view: defensive owner/plan filters
create or replace function public.family_overview() returns jsonb language plpgsql security definer set search_path = public as $$
declare _out jsonb := '[]'; _m record; _cut timestamptz; _tz text;
begin
  for _m in select m.household_id, m.pace, h.elder_id, p.display_name, p.timezone, p.share_plans, p.share_errands, p.share_outings, p.help_contact_consent, p.phone
    from household_members m join households h on h.id = m.household_id join profiles p on p.id = h.elder_id
    where m.user_id = auth.uid() and m.status = 'active' loop
    perform check_escalations(_m.household_id);
    _tz := _m.timezone;
    _cut := case _m.pace when 'now' then now() + interval '1 second'
      when 'daily' then (date_trunc('day', now() at time zone _tz)) at time zone _tz
      else (date_trunc('week', now() at time zone _tz)) at time zone _tz end;
    _out := _out || jsonb_build_object(
      'household_id', _m.household_id, 'elder_name', _m.display_name, 'timezone', _tz, 'pace', _m.pace,
      'phone', case when _m.help_contact_consent then _m.phone else null end,
      'alerts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'message', a.message, 'created_at', a.created_at, 'ack_at', a.ack_at) order by a.created_at desc)
          from alerts a where a.household_id = _m.household_id and a.user_id = _m.elder_id and a.created_at > now() - interval '7 days'), '[]'),
      'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'text', r.text, 'status', r.status, 'created_at', r.created_at, 'mine', r.responder_id = auth.uid()) order by r.created_at desc)
          from requests r where r.household_id = _m.household_id and r.user_id = _m.elder_id and r.created_at > now() - interval '30 days'), '[]'),
      'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'category', u.category, 'text', u.text, 'created_at', u.created_at,
            'period', case _m.pace when 'daily' then to_char(u.created_at at time zone _tz, 'Dy DD Mon') when 'weekly' then 'Week of ' || to_char(date_trunc('week', u.created_at at time zone _tz), 'DD Mon') else null end) order by u.created_at desc)
          from updates u left join plans pl on pl.id = u.plan_id and pl.user_id = _m.elder_id
          where u.household_id = _m.household_id and u.user_id = _m.elder_id and u.created_at < _cut and u.created_at > now() - interval '60 days'
            and ((u.category = 'plans' and _m.share_plans) or (u.category = 'errands' and _m.share_errands) or (u.category = 'outings' and _m.share_outings))
            and (u.plan_id is null or (pl.id is not null and pl.share_override is distinct from false))), '[]'),
      'queued', (select count(*) from updates u left join plans pl on pl.id = u.plan_id and pl.user_id = _m.elder_id
          where u.household_id = _m.household_id and u.user_id = _m.elder_id and u.created_at >= _cut
            and ((u.category = 'plans' and _m.share_plans) or (u.category = 'errands' and _m.share_errands) or (u.category = 'outings' and _m.share_outings))
            and (u.plan_id is null or (pl.id is not null and pl.share_override is distinct from false)))
    );
  end loop;
  return _out;
end $$;
revoke execute on function public.family_overview() from anon;
