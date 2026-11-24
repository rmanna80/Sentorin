-- Smart pen / emergency bracelet platform: initial schema
-- One registry for every device; product tier decides features; emergency data is only
-- reachable through audited functions.

create type public.device_type as enum ('pen', 'bracelet');
create type public.device_status as enum ('unclaimed', 'active', 'lost', 'disabled');
create type public.agency_role as enum ('admin', 'responder', 'officer');

-- ---------------------------------------------------------------- people
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------- products
create table public.product_tiers (
  id text primary key,                       -- e.g. 'pen_basic'
  device_type public.device_type not null,
  name text not null,
  features text[] not null default '{}'      -- e.g. {business_card, ble_find, last_seen}
);

insert into public.product_tiers (id, device_type, name, features) values
  ('pen_card',      'pen',      'Pen - business card',          '{business_card}'),
  ('pen_find',      'pen',      'Pen - card + finder',          '{business_card,ble_find,last_seen}'),
  ('bracelet_duty', 'bracelet', 'Emergency bracelet',           '{emergency_profile}');

-- ---------------------------------------------------------------- devices
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,            -- the value in the NFC link
  device_type public.device_type not null,
  tier_id text not null references public.product_tiers (id),
  owner_id uuid references auth.users (id) on delete set null,
  claim_code_hash text,                      -- sha256 of the code printed in the box
  ble_identity_key text,                     -- set at provisioning (firmware stage)
  status public.device_status not null default 'unclaimed',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index devices_owner_idx on public.devices (owner_id);

create table public.business_cards (
  device_id uuid primary key references public.devices (id) on delete cascade,
  full_name text, title text, company text, phone text, email text, website text, bio text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.pen_locations (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  lat double precision not null, lng double precision not null, accuracy_m real,
  seen_at timestamptz not null default now(),
  reported_by uuid not null default auth.uid() references auth.users (id) on delete cascade
);
create index pen_locations_device_idx on public.pen_locations (device_id, seen_at desc);

-- ---------------------------------------------------------------- agencies
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.agency_role not null,
  responder_code text unique,                -- the unique ID the agency issues
  badge_number text,
  verified_at timestamptz,                   -- set by an agency admin after an identity check
  active boolean not null default true,
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);

create table public.emergency_profiles (
  device_id uuid primary key references public.devices (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  full_name text, blood_type text, allergies text, medications text, conditions text,
  emergency_contact_name text, emergency_contact_phone text, notes text,
  public_fields text[] not null default '{}',   -- fields the officer allows without sign-in
  updated_at timestamptz not null default now()
);

create table public.emergency_access_log (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  responder_id uuid not null references auth.users (id),
  responder_agency_id uuid references public.agencies (id),
  responder_code text,
  accessed_at timestamptz not null default now()
);
create index emergency_access_log_device_idx on public.emergency_access_log (device_id, accessed_at desc);

-- ---------------------------------------------------------------- helpers
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

create function public.is_agency_admin(p_agency uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agency_members m
                 where m.agency_id = p_agency and m.user_id = (select auth.uid())
                   and m.role = 'admin' and m.active);
$$;

create function public.owns_device(p_device uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.id = p_device and d.owner_id = (select auth.uid()));
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.product_tiers enable row level security;
alter table public.devices enable row level security;
alter table public.business_cards enable row level security;
alter table public.pen_locations enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.emergency_profiles enable row level security;
alter table public.emergency_access_log enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy platform_admins_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

create policy tiers_read on public.product_tiers for select to authenticated using (true);
create policy tiers_admin on public.product_tiers for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy devices_owner_select on public.devices for select to authenticated using (owner_id = (select auth.uid()) or public.is_platform_admin());
create policy devices_admin_all on public.devices for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
-- owners change status (e.g. mark lost) through set_device_status(); no direct update policy.

create policy cards_owner_all on public.business_cards for all to authenticated
  using (public.owns_device(device_id)) with check (public.owns_device(device_id));

create policy locations_owner_select on public.pen_locations for select to authenticated using (public.owns_device(device_id));
create policy locations_owner_insert on public.pen_locations for insert to authenticated
  with check (public.owns_device(device_id) and reported_by = (select auth.uid()));

create policy agencies_member_select on public.agencies for select to authenticated
  using (public.is_platform_admin() or exists (select 1 from public.agency_members m where m.agency_id = id and m.user_id = (select auth.uid())));
create policy agencies_admin_all on public.agencies for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy members_self_select on public.agency_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_agency_admin(agency_id) or public.is_platform_admin());
create policy members_admin_write on public.agency_members for all to authenticated
  using (public.is_agency_admin(agency_id) or public.is_platform_admin())
  with check (public.is_agency_admin(agency_id) or public.is_platform_admin());

-- officers manage their own emergency profile; responders never read this table directly
create policy emergency_owner_all on public.emergency_profiles for all to authenticated
  using (public.owns_device(device_id)) with check (public.owns_device(device_id));

create policy access_log_read on public.emergency_access_log for select to authenticated
  using (public.owns_device(device_id) or public.is_platform_admin()
         or exists (select 1 from public.emergency_profiles e where e.device_id = emergency_access_log.device_id and public.is_agency_admin(e.agency_id)));
-- no insert/update/delete policy: rows are written only by get_emergency_profile()

-- ---------------------------------------------------------------- functions the apps call
-- Claim a device with the code from the box.
create function public.claim_device(p_public_id text, p_claim_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'sign in required'; end if;
  update public.devices d
     set owner_id = (select auth.uid()), status = 'active', claimed_at = now(), claim_code_hash = null
   where d.public_id = p_public_id and d.owner_id is null and d.status = 'unclaimed'
     and d.claim_code_hash = encode(sha256(convert_to(p_claim_code, 'UTF8')), 'hex')
  returning d.id into v_id;
  if v_id is null then raise exception 'invalid device or claim code'; end if;
  return v_id;
end $$;

create function public.set_device_status(p_device uuid, p_status public.device_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('active', 'lost') then raise exception 'status not allowed'; end if;
  update public.devices d set status = p_status where d.id = p_device and d.owner_id = (select auth.uid());
  if not found then raise exception 'not your device'; end if;
end $$;

-- What a phone sees when it taps a tag, before any sign-in.
create function public.get_tap(p_public_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.devices; t public.product_tiers; c public.business_cards; e public.emergency_profiles; pub jsonb := '{}'::jsonb; f text;
begin
  select * into d from public.devices where public_id = p_public_id;
  if not found or d.status in ('unclaimed', 'disabled') then return jsonb_build_object('kind', 'unknown'); end if;
  select * into t from public.product_tiers where id = d.tier_id;
  if d.device_type = 'pen' then
    select * into c from public.business_cards where device_id = d.id;
    if not found or not c.is_published or not ('business_card' = any (t.features)) then
      return jsonb_build_object('kind', 'pen', 'card', null, 'lost', d.status = 'lost');
    end if;
    return jsonb_build_object('kind', 'pen', 'lost', d.status = 'lost', 'card', jsonb_build_object(
      'full_name', c.full_name, 'title', c.title, 'company', c.company, 'phone', c.phone,
      'email', c.email, 'website', c.website, 'bio', c.bio));
  end if;
  select * into e from public.emergency_profiles where device_id = d.id;
  if found then
    foreach f in array e.public_fields loop
      if f in ('blood_type', 'allergies', 'medications', 'conditions', 'emergency_contact_name', 'emergency_contact_phone') then
        pub := pub || jsonb_build_object(f, to_jsonb(e) -> f);
      end if;
    end loop;
  end if;
  return jsonb_build_object('kind', 'bracelet', 'public', pub, 'sign_in_required', true);
end $$;

-- Full emergency profile: verified, active responder with a second factor only. Always logged.
create function public.get_emergency_profile(p_public_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.devices; e public.emergency_profiles; m public.agency_members;
begin
  if (select auth.uid()) is null then raise exception 'sign in required'; end if;
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then raise exception 'second factor required'; end if;
  select * into m from public.agency_members
   where user_id = (select auth.uid()) and role in ('responder', 'admin') and active and verified_at is not null
   order by verified_at limit 1;
  if not found then raise exception 'not an authorized responder'; end if;
  select * into d from public.devices where public_id = p_public_id and device_type = 'bracelet' and status in ('active', 'lost');
  if not found then raise exception 'unknown bracelet'; end if;
  select * into e from public.emergency_profiles where device_id = d.id;
  if not found then raise exception 'no emergency profile'; end if;
  insert into public.emergency_access_log (device_id, responder_id, responder_agency_id, responder_code)
  values (d.id, (select auth.uid()), m.agency_id, m.responder_code);
  return to_jsonb(e) - 'device_id' - 'public_fields';
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_tap(text) to anon, authenticated;
grant execute on function public.claim_device(text, text), public.set_device_status(uuid, public.device_status),
  public.get_emergency_profile(text), public.is_platform_admin(), public.is_agency_admin(uuid), public.owns_device(uuid) to authenticated;
