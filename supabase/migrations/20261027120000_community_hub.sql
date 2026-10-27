-- Community hub: profiles, events with RSVPs and invite links, posts with photos/videos,
-- reports and blocks, and opt-in notifications about new events nearby.
-- Every table has row level security; clients only ever use the public anon key.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- New accounts get a neutral name (never derived from the email) that they can change.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, 'Member ' || substr(new.id::text, 1, 4));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "users update their own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Events --------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  activity text not null check (char_length(activity) between 2 and 40),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 10 and 600),
  place_name text not null check (char_length(place_name) between 2 and 120),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  capacity int check (capacity is null or capacity between 2 and 500),
  visibility text not null default 'public' check (visibility in ('public', 'invite')),
  invite_code text not null default encode(extensions.gen_random_bytes(6), 'hex'),
  cancelled boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index events_location_idx on public.events using gist (location);
create index events_starts_at_idx on public.events (starts_at);

create table public.event_members (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Bypasses RLS so the events and members policies can reference each other without recursion.
create function public.can_see_event(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (
      e.visibility = 'public' or e.owner_id = (select auth.uid())
      or exists (select 1 from public.event_members m where m.event_id = eid and m.user_id = (select auth.uid()))
    )
  );
$$;

alter table public.events enable row level security;
create policy "visible events" on public.events for select to authenticated using (public.can_see_event(id));
create policy "create own events" on public.events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owners edit events" on public.events for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners delete events" on public.events for delete to authenticated using (owner_id = (select auth.uid()));

-- Owners can't touch the invite code or the "already promoted" marker.
revoke insert, update on public.events from anon, authenticated;
grant insert (title, activity, description, starts_at, duration_min, place_name, lat, lng, capacity, visibility)
  on public.events to authenticated;
grant update (title, activity, description, starts_at, duration_min, place_name, lat, lng, capacity, visibility, cancelled)
  on public.events to authenticated;

alter table public.event_members enable row level security;
create policy "members of visible events" on public.event_members for select to authenticated using (public.can_see_event(event_id));
create policy "join public events" on public.event_members for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.events e where e.id = event_id and e.visibility = 'public' and not e.cancelled)
);
create policy "leave, or owner removes" on public.event_members for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
);

-- The organizer is always going; full events refuse new members.
create function public.add_owner_as_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_members (event_id, user_id) values (new.id, new.owner_id) on conflict do nothing;
  return new;
end $$;
create trigger events_add_owner after insert on public.events for each row execute function public.add_owner_as_member();

create function public.enforce_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int;
begin
  select capacity into cap from public.events where id = new.event_id;
  if cap is not null and (select count(*) from public.event_members where event_id = new.event_id) >= cap then
    raise exception 'This event is full';
  end if;
  return new;
end $$;
create trigger event_members_capacity before insert on public.event_members for each row execute function public.enforce_capacity();

-- Invite links: preview and join invite-only events with the event's code.
create function public.preview_invite(eid uuid, code text)
returns table (title text, activity text, starts_at timestamptz, place_name text, owner_name text)
language sql stable security definer set search_path = '' as $$
  select e.title, e.activity, e.starts_at, e.place_name, p.display_name
  from public.events e join public.profiles p on p.id = e.owner_id
  where e.id = eid and e.invite_code = code and not e.cancelled;
$$;

create function public.join_event_with_code(eid uuid, code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in to join'; end if;
  if not exists (select 1 from public.events where id = eid and invite_code = code and not cancelled) then
    raise exception 'This invite link is not valid';
  end if;
  insert into public.event_members (event_id, user_id) values (eid, (select auth.uid())) on conflict do nothing;
end $$;
revoke execute on function public.preview_invite(uuid, text) from anon;
revoke execute on function public.join_event_with_code(uuid, text) from anon;

-- Event cards: what the app lists, with organizer name, head count and whether you're going.
create view public.event_cards with (security_invoker = on) as
select
  e.id, e.owner_id, p.display_name as owner_name, e.title, e.activity, e.description, e.starts_at, e.duration_min,
  e.place_name, e.lat, e.lng, e.capacity, e.visibility, e.invite_code, e.cancelled, e.notified_at, e.created_at,
  (select count(*)::int from public.event_members m where m.event_id = e.id) as going,
  exists (select 1 from public.event_members m where m.event_id = e.id and m.user_id = (select auth.uid())) as joined
from public.events e join public.profiles p on p.id = e.owner_id;

-- Upcoming events, optionally within a radius of a point, soonest first.
create function public.events_near(p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default 50)
returns setof public.event_cards
language sql stable security invoker set search_path = '' as $$
  select c.* from public.event_cards c join public.events e on e.id = c.id
  where c.starts_at > now() - interval '3 hours' and not c.cancelled
    and (p_lat is null or extensions.st_dwithin(
      e.location, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_radius_km * 1000))
  order by c.starts_at
  limit 200;
$$;

-- Posts with photos and videos --------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  event_id uuid references public.events on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  media_path text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  check (body <> '' or media_path is not null),
  check ((media_path is null) = (media_type is null))
);
create index posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
create policy "posts in visible places" on public.posts for select to authenticated
  using (event_id is null or public.can_see_event(event_id));
create policy "post as yourself, media from your folder" on public.posts for insert to authenticated with check (
  author_id = (select auth.uid())
  and (event_id is null or public.can_see_event(event_id))
  and (media_path is null or media_path like (select auth.uid())::text || '/%')
);
create policy "authors and event owners delete posts" on public.posts for delete to authenticated using (
  author_id = (select auth.uid())
  or exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
);

-- Reports and blocks ------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles on delete cascade,
  post_id uuid references public.posts on delete cascade,
  event_id uuid references public.events on delete cascade,
  reason text not null check (char_length(reason) between 2 and 300),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (event_id is null)),
  unique (reporter_id, post_id),
  unique (reporter_id, event_id)
);
alter table public.reports enable row level security;
create policy "file reports as yourself" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
-- No select policy: reports are reviewed in the Supabase dashboard.

create function public.post_report_count(pid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.reports where post_id = pid;
$$;

-- Posts reported by 3 or more people are hidden until reviewed.
create view public.post_cards with (security_invoker = on) as
select p.id, p.author_id, pr.display_name as author_name, p.event_id, e.title as event_title,
  p.body, p.media_path, p.media_type, p.created_at
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join public.events e on e.id = p.event_id
where public.post_report_count(p.id) < 3;

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "manage your own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- Media storage: public read by URL, upload only into your own folder, 50 MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "upload media to your own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete your own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner = (select auth.uid()));

-- Nearby-event notifications --------------------------------------------

create table public.notify_prefs (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  enabled boolean not null default true,
  -- Rounded to about 1 km by the app; never shown to anyone.
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  radius_km int not null default 25 check (radius_km in (5, 10, 25, 50)),
  updated_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
create policy "manage your own notification settings" on public.notify_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "manage your own devices" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Who to notify about an event: opted in, within their chosen radius, not the organizer,
-- and not someone who blocked the organizer. Only the notify-nearby function may call it.
create function public.users_to_notify(eid uuid) returns table (user_id uuid)
language sql stable security definer set search_path = '' as $$
  select n.user_id from public.notify_prefs n join public.events e on e.id = eid
  where n.enabled and n.user_id <> e.owner_id
    and extensions.st_dwithin(n.location, e.location, n.radius_km * 1000)
    and not exists (select 1 from public.blocks b where b.blocker_id = n.user_id and b.blocked_id = e.owner_id);
$$;
revoke execute on function public.users_to_notify(uuid) from public, anon, authenticated;
