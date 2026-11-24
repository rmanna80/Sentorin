-- Postal address on the business card (traditional card layout).
alter table public.business_cards add column address text;

create or replace function public.get_tap(p_public_id text) returns jsonb
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
      'email', c.email, 'website', c.website, 'address', c.address, 'bio', c.bio));
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
