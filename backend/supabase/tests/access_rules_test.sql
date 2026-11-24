\set ON_ERROR_STOP 0
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into public.agencies (id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','Test PD');
insert into public.agency_members (agency_id,user_id,role,responder_code,verified_at) values ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','responder','R-1001',now());
insert into public.devices (public_id,device_type,tier_id,claim_code_hash) values ('PEN1','pen','pen_find',encode(sha256('1234'),'hex')),('BR1','bracelet','bracelet_duty',encode(sha256('9999'),'hex'));
select count(*) as profiles_from_trigger from public.profiles;
-- user 1 (owner/officer)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.claim_device('PEN1','0000') as bad_claim;
select public.claim_device('PEN1','1234') is not null as pen_claimed; select public.claim_device('BR1','9999') is not null as br_claimed;
insert into public.business_cards (device_id,full_name,is_published) select id,'Owner One',true from public.devices where public_id='PEN1';
insert into public.emergency_profiles (device_id,full_name,blood_type,allergies,public_fields) select id,'Officer One','O+','penicillin','{blood_type}' from public.devices where public_id='BR1';
select count(*) as owner_sees_devices from public.devices;
-- anon tap
set role anon; select set_config('request.jwt.claim.sub','',false);
select public.get_tap('PEN1') as pen_tap; select public.get_tap('BR1') as bracelet_tap;
select count(*) as anon_reads_emergency from public.emergency_profiles;
select public.get_emergency_profile('BR1') as anon_full;
-- user 3: signed in, not a responder
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false); select set_config('request.jwt.claims','{"aal":"aal2"}',false);
select public.get_emergency_profile('BR1') as stranger_full; select count(*) as stranger_rows from public.emergency_profiles; select count(*) as stranger_devices from public.devices;
-- user 2: responder without second factor, then with
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false); select set_config('request.jwt.claims','{"aal":"aal1"}',false);
select public.get_emergency_profile('BR1') as responder_no_mfa;
select set_config('request.jwt.claims','{"aal":"aal2"}',false);
select public.get_emergency_profile('BR1') ->> 'blood_type' as responder_mfa_blood; select count(*) as responder_direct_rows from public.emergency_profiles;
insert into public.emergency_access_log (device_id,responder_id) select id,'00000000-0000-0000-0000-000000000002' from public.devices;
-- officer sees the log
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select count(*) as officer_sees_log_rows, max(responder_code) as by_code from public.emergency_access_log;
