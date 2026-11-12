
alter table public.profiles add column phone text check (phone is null or length(phone) <= 30);
alter table public.profiles add column declined_events uuid[] not null default '{}';
alter table public.profiles add column consecutive_declines integer not null default 0;
alter table public.profiles add column fewer_suggestions boolean not null default false;

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
revoke execute on function public.family_overview() from public, anon;
grant execute on function public.family_overview() to authenticated;
