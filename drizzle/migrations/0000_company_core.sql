
create extension if not exists pgcrypto with schema extensions;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('elder','family')),
  display_name text not null default '',
  timezone text not null default 'UTC',
  interests text[] not null default '{}',
  ride_limit integer not null default 25 check (ride_limit between 0 and 500),
  share_plans boolean not null default true,
  share_errands boolean not null default true,
  share_outings boolean not null default true,
  escalate_no_reply boolean not null default false,
  help_contact_consent boolean not null default false,
  read_aloud boolean not null default true,
  onboarded boolean not null default false,
  last_confirmed date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- HOUSEHOLDS
create table public.households (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null unique,
  created_at timestamptz not null default now()
);
grant select on public.households to authenticated;
grant all on public.households to service_role;
alter table public.households enable row level security;
create policy "elder reads household" on public.households for select to authenticated using (elder_id = auth.uid());

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  pace text not null default 'now' check (pace in ('now','daily','weekly')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
grant select on public.household_members to authenticated;
grant all on public.household_members to service_role;
alter table public.household_members enable row level security;
create policy "member reads own membership" on public.household_members for select to authenticated using (user_id = auth.uid());

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

create or replace function public.my_household() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.households where elder_id = auth.uid()
$$;
create or replace function public.is_active_member(_hh uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.household_members where household_id = _hh and user_id = auth.uid() and status = 'active')
$$;

-- ELDER-OWNED DATA
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  title text not null check (length(title) between 1 and 120),
  place text not null default '',
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cost numeric(8,2) not null default 0 check (cost >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "read catalog or own" on public.events for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "insert own" on public.events for insert to authenticated with check (owner_id = auth.uid());
create policy "update own" on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own" on public.events for delete to authenticated using (owner_id = auth.uid());

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  place text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cost numeric(8,2) not null default 0,
  status text not null default 'planning' check (status in ('planning','going','skipped','done')),
  ride_status text not null default 'none' check (ride_status in ('none','not_needed','waiting_family','covered_family','own_way','not_covered')),
  ride_quote numeric(8,2) not null default 0,
  pickup_at timestamptz,
  share_override boolean,
  friend_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.errands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item text not null check (length(item) between 1 and 60),
  need_by date,
  status text not null default 'waiting_elder' check (status in ('waiting_elder','waiting_family','covered_family','own_way','skipped','done')),
  created_at timestamptz not null default now()
);
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null check (length(label) between 1 and 80),
  at_time time not null,
  moved_from time,
  created_at timestamptz not null default now()
);
create table public.memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('person','like','routine','limit')),
  text text not null check (length(text) between 1 and 160),
  source text not null default 'You said',
  corrected_from text,
  created_at timestamptz not null default now()
);
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  turns jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('plan_ride','errand','recover')),
  target_id uuid not null,
  option_id text not null,
  quote_cost numeric(8,2) not null default 0,
  payload jsonb not null default '{}',
  undo_until timestamptz not null,
  status text not null default 'pending' check (status in ('pending','committed','cancelled','rejected')),
  result text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_id uuid,
  agent text not null default 'coordinator',
  text text not null,
  is_ai boolean not null default false,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['plans','errands','reminders','memory_facts','checkins','decisions','activity'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- HOUSEHOLD-FACING DATA (family reads only through functions)
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('ride','errand')),
  target_id uuid not null,
  text text not null,
  status text not null default 'sent' check (status in ('sent','accepted','declined','withdrawn')),
  responder_id uuid,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.updates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  category text not null check (category in ('plans','errands','outings')),
  plan_id uuid,
  text text not null,
  created_at timestamptz not null default now()
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('help','no_reply')),
  plan_id uuid,
  message text not null,
  ack_at timestamptz,
  ack_by uuid,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['requests','updates','alerts'] loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "elder reads own" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "elder writes own" on public.%I for insert to authenticated with check (user_id = auth.uid() and household_id = public.my_household())', t);
    execute format('create policy "elder updates own" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create index on public.plans(user_id, starts_at);
create index on public.updates(household_id, created_at);
create index on public.requests(household_id, status);
create index on public.alerts(household_id, created_at);
create index on public.activity(user_id, created_at);

-- INVITATIONS
create or replace function public.create_invitation() returns text language plpgsql security definer set search_path = public, extensions as $$
declare _hh uuid; _code text;
begin
  if not exists(select 1 from profiles where id = auth.uid() and role = 'elder') then raise exception 'not_allowed'; end if;
  insert into households(elder_id) values (auth.uid()) on conflict (elder_id) do nothing;
  select id into _hh from households where elder_id = auth.uid();
  _code := translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_');
  insert into invitations(household_id, code_hash, expires_at) values (_hh, encode(digest(_code, 'sha256'), 'hex'), now() + interval '72 hours');
  return _code;
end $$;

create or replace function public.accept_invitation(_code text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare _inv invitations;
begin
  if not exists(select 1 from profiles where id = auth.uid() and role = 'family') then raise exception 'family_account_required'; end if;
  select * into _inv from invitations where code_hash = encode(digest(_code, 'sha256'), 'hex') for update;
  if _inv.id is null or _inv.used_at is not null or _inv.revoked or _inv.expires_at < now() then raise exception 'invalid_or_expired'; end if;
  update invitations set used_at = now(), used_by = auth.uid() where id = _inv.id;
  insert into household_members(household_id, user_id, status) values (_inv.household_id, auth.uid(), 'pending')
  on conflict (household_id, user_id) do update set status = case when household_members.status = 'active' then 'active' else 'pending' end;
  return _inv.household_id;
end $$;

create or replace function public.set_member_status(_member uuid, _status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if _status not in ('active','revoked') then raise exception 'bad_status'; end if;
  update household_members set status = _status where user_id = _member and household_id = my_household();
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.revoke_invitations() returns void language sql security definer set search_path = public as $$
  update invitations set revoked = true where household_id = my_household() and used_at is null;
$$;

create or replace function public.elder_household() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'household_id', h.id,
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.display_name, 'status', m.status, 'joined_at', m.joined_at) order by m.joined_at)
       from household_members m left join profiles p on p.id = m.user_id where m.household_id = h.id and m.status <> 'revoked'), '[]'),
    'open_invites', (select count(*) from invitations i where i.household_id = h.id and i.used_at is null and not i.revoked and i.expires_at > now())
  ) from households h where h.elder_id = auth.uid()
$$;

-- ESCALATION (opt-in only)
create or replace function public.check_escalations(_hh uuid) returns void language plpgsql security definer set search_path = public as $$
declare _p record;
begin
  for _p in select pl.id, pl.user_id, pl.title, pr.display_name from plans pl join households h on h.elder_id = pl.user_id join profiles pr on pr.id = pl.user_id
    where h.id = _hh and pr.escalate_no_reply and pl.status = 'going' and pl.ride_status in ('not_covered','waiting_family')
      and pl.starts_at between now() and now() + interval '90 minutes'
      and not exists(select 1 from alerts a where a.plan_id = pl.id and a.kind = 'no_reply') loop
    insert into alerts(household_id, user_id, kind, plan_id, message)
    values (_hh, _p.user_id, 'no_reply', _p.id, coalesce(nullif(_p.display_name,''),'Your family member') || '''s ride to ' || _p.title || ' fell through and no other way has been picked yet.');
  end loop;
end $$;

-- FAMILY VIEW: only shared, delivered items; never chats, memory or reminders
create or replace function public.family_overview() returns jsonb language plpgsql security definer set search_path = public as $$
declare _out jsonb := '[]'; _m record; _cut timestamptz; _tz text;
begin
  for _m in select m.household_id, m.pace, h.elder_id, p.display_name, p.timezone, p.share_plans, p.share_errands, p.share_outings
    from household_members m join households h on h.id = m.household_id join profiles p on p.id = h.elder_id
    where m.user_id = auth.uid() and m.status = 'active' loop
    perform check_escalations(_m.household_id);
    _tz := _m.timezone;
    _cut := case _m.pace when 'now' then now() + interval '1 second'
      when 'daily' then (date_trunc('day', now() at time zone _tz)) at time zone _tz
      else (date_trunc('week', now() at time zone _tz)) at time zone _tz end;
    _out := _out || jsonb_build_object(
      'household_id', _m.household_id, 'elder_name', _m.display_name, 'timezone', _tz, 'pace', _m.pace,
      'alerts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'message', a.message, 'created_at', a.created_at, 'ack_at', a.ack_at) order by a.created_at desc)
          from alerts a where a.household_id = _m.household_id and a.created_at > now() - interval '7 days'), '[]'),
      'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'text', r.text, 'status', r.status, 'created_at', r.created_at, 'mine', r.responder_id = auth.uid()) order by r.created_at desc)
          from requests r where r.household_id = _m.household_id and r.created_at > now() - interval '30 days'), '[]'),
      'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'category', u.category, 'text', u.text, 'created_at', u.created_at,
            'period', case _m.pace when 'daily' then to_char(u.created_at at time zone _tz, 'Dy DD Mon') when 'weekly' then 'Week of ' || to_char(date_trunc('week', u.created_at at time zone _tz), 'DD Mon') else null end) order by u.created_at desc)
          from updates u left join plans pl on pl.id = u.plan_id
          where u.household_id = _m.household_id and u.created_at < _cut and u.created_at > now() - interval '60 days'
            and ((u.category = 'plans' and _m.share_plans) or (u.category = 'errands' and _m.share_errands) or (u.category = 'outings' and _m.share_outings))
            and (u.plan_id is null or coalesce(pl.share_override, true))), '[]'),
      'queued', (select count(*) from updates u left join plans pl on pl.id = u.plan_id
          where u.household_id = _m.household_id and u.created_at >= _cut
            and ((u.category = 'plans' and _m.share_plans) or (u.category = 'errands' and _m.share_errands) or (u.category = 'outings' and _m.share_outings))
            and (u.plan_id is null or coalesce(pl.share_override, true)))
    );
  end loop;
  return _out;
end $$;

create or replace function public.set_family_pace(_hh uuid, _pace text) returns void language plpgsql security definer set search_path = public as $$
begin
  if _pace not in ('now','daily','weekly') then raise exception 'bad_pace'; end if;
  update household_members set pace = _pace where household_id = _hh and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'not_member'; end if;
end $$;

create or replace function public.leave_household(_hh uuid) returns void language sql security definer set search_path = public as $$
  update household_members set status = 'revoked' where household_id = _hh and user_id = auth.uid();
$$;

create or replace function public.ack_alert(_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update alerts set ack_at = coalesce(ack_at, now()), ack_by = coalesce(ack_by, auth.uid()) where id = _id and is_active_member(household_id);
  if not found then raise exception 'not_found'; end if;
  insert into activity(user_id, entity_id, agent, text) select a.user_id, a.id, 'family', coalesce(nullif(p.display_name,''),'Your family member') || ' saw your help alert.' from alerts a left join profiles p on p.id = auth.uid() where a.id = _id;
end $$;

create or replace function public.respond_request(_id uuid, _accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare _r requests; _name text; _item text;
begin
  select * into _r from requests where id = _id for update;
  if _r.id is null or not is_active_member(_r.household_id) then raise exception 'not_found'; end if;
  if _r.status <> 'sent' then return _r.status; end if;
  update requests set status = case when _accept then 'accepted' else 'declined' end, responder_id = auth.uid(), responded_at = now() where id = _id;
  select coalesce(nullif(display_name,''),'Your family member') into _name from profiles where id = auth.uid();
  if _r.kind = 'ride' then
    update plans set ride_status = case when _accept then 'covered_family' else 'not_covered' end, updated_at = now() where id = _r.target_id and user_id = _r.user_id and ride_status = 'waiting_family';
    insert into activity(user_id, entity_id, agent, text) values (_r.user_id, _r.target_id, 'family', case when _accept then _name || ' said yes: they''ll drive you.' else _name || ' can''t this time.' end);
  else
    update errands set status = case when _accept then 'covered_family' else 'waiting_elder' end where id = _r.target_id and user_id = _r.user_id and status = 'waiting_family';
    select item into _item from errands where id = _r.target_id;
    insert into activity(user_id, entity_id, agent, text) values (_r.user_id, _r.target_id, 'family', case when _accept then _name || ' will bring the ' || _item || '.' else _name || ' can''t bring the ' || _item || ' this time.' end);
  end if;
  return case when _accept then 'accepted' else 'declined' end;
end $$;

-- CONFIRMED DECISIONS: atomic, idempotent, quote re-checked
create or replace function public.commit_decision(_id uuid, _send_now boolean) returns text language plpgsql security definer set search_path = public as $$
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
    if _d.option_id in ('own_way','taxi_self') and _pl.ride_quote <> _d.quote_cost then
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
      elsif _d.option_id in ('own_way','taxi_self') then
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
      if _d.payload ? 'reminder_id' then
        update reminders set moved_from = at_time, at_time = (_d.payload->>'reminder_to')::time where id = (_d.payload->>'reminder_id')::uuid and user_id = auth.uid();
        insert into activity(user_id, entity_id, text) values (auth.uid(), _pl.id, 'Moved a reminder to ' || (_d.payload->>'reminder_to') || ' so it doesn''t clash.');
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

create or replace function public.purge_my_data() returns void language plpgsql security definer set search_path = public as $$
declare _hh uuid;
begin
  select id into _hh from households where elder_id = auth.uid();
  delete from household_members where user_id = auth.uid();
  if _hh is not null then delete from households where id = _hh; end if;
  delete from plans where user_id = auth.uid();
  delete from errands where user_id = auth.uid();
  delete from reminders where user_id = auth.uid();
  delete from memory_facts where user_id = auth.uid();
  delete from checkins where user_id = auth.uid();
  delete from decisions where user_id = auth.uid();
  delete from activity where user_id = auth.uid();
  delete from events where owner_id = auth.uid();
  delete from requests where user_id = auth.uid();
  delete from updates where user_id = auth.uid();
  delete from alerts where user_id = auth.uid();
end $$;

revoke execute on function public.check_escalations(uuid) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['create_invitation()','accept_invitation(text)','set_member_status(uuid,text)','revoke_invitations()','elder_household()','family_overview()','set_family_pace(uuid,text)','leave_household(uuid)','ack_alert(uuid)','respond_request(uuid,boolean)','commit_decision(uuid,boolean)','purge_my_data()','my_household()','is_active_member(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Starter community catalog (synthetic, relative to today)
insert into public.events(title, place, description, starts_at, ends_at, cost, tags) values
 ('Afternoon jazz trio', 'Community Centre, Hall B', 'A local trio plays standards. Seats near the front; step-free entrance.', date_trunc('day', now()) + interval '3 days 14 hours', date_trunc('day', now()) + interval '3 days 16 hours', 0, '{jazz,music,live music,trio,concert,band}'),
 ('Garden market', 'Riverside Square', 'Fresh flowers, bread and local food stalls.', date_trunc('day', now()) + interval '5 days 9 hours', date_trunc('day', now()) + interval '5 days 12 hours', 0, '{market,flowers,garden,food}'),
 ('Morning walking group', 'Elm Park main gate', 'A gentle 45-minute loop. Benches along the way.', date_trunc('day', now()) + interval '1 days 10 hours', date_trunc('day', now()) + interval '1 days 11 hours', 0, '{walk,walking,park,outdoors}'),
 ('Community choir drop-in', 'St. Mary''s Hall', 'No auditions. Sheet music provided.', date_trunc('day', now()) + interval '2 days 18 hours', date_trunc('day', now()) + interval '2 days 19 hours 30 minutes', 0, '{choir,singing,music}'),
 ('Classic film afternoon', 'Library screening room', 'A 1950s comedy with tea afterwards.', date_trunc('day', now()) + interval '4 days 13 hours', date_trunc('day', now()) + interval '4 days 15 hours 30 minutes', 3, '{film,movie,cinema}'),
 ('Woodworking open shop', 'Makers'' Shed, Oak Lane', 'Bring a small project or help with the benches.', date_trunc('day', now()) + interval '6 days 10 hours', date_trunc('day', now()) + interval '6 days 12 hours', 5, '{woodworking,craft,making}'),
 ('Chess and coffee', 'Corner Café', 'Friendly games, all levels.', date_trunc('day', now()) + interval '2 days 15 hours', date_trunc('day', now()) + interval '2 days 17 hours', 0, '{chess,games,coffee}'),
 ('Big-band dance social', 'Legion Hall', 'Live big band; seating for listeners too.', date_trunc('day', now()) + interval '8 days 19 hours', date_trunc('day', now()) + interval '8 days 21 hours', 8, '{dance,music,big band,swing,jazz}');
