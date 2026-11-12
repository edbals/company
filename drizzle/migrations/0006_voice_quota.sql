create table public.voice_quota (
  bucket text not null,
  window_start timestamptz not null,
  used integer not null default 0,
  primary key (bucket, window_start)
);
grant all on public.voice_quota to service_role;
alter table public.voice_quota enable row level security;
comment on table public.voice_quota is 'Shared counters for the public demo voice endpoints. Server only; no client access.';

create or replace function public.take_voice_quota(_bucket text, _window_seconds integer, _limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare _start timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds); _used integer;
begin
  insert into voice_quota(bucket, window_start, used) values (_bucket, _start, 1)
  on conflict (bucket, window_start) do update set used = voice_quota.used + 1
  returning used into _used;
  delete from voice_quota where window_start < now() - interval '2 days';
  return _used <= _limit;
end $$;
revoke execute on function public.take_voice_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_voice_quota(text, integer, integer) to service_role;
