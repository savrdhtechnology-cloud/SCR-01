-- Savrdh customer mobile app: additive CRM bridge. Existing web UI is untouched.

alter table public.scr01_profiles
  add column if not exists crm_customer_id text,
  add column if not exists crm_lead_id uuid references public.crm_leads(id),
  add column if not exists assigned_advisor text;

create unique index if not exists scr01_profiles_crm_customer_id_key
  on public.scr01_profiles (crm_customer_id) where crm_customer_id is not null;

alter table public.scr01_requests
  add column if not exists crm_case_id text,
  add column if not exists crm_lead_id uuid references public.crm_leads(id),
  add column if not exists assigned_advisor text,
  add column if not exists impact_points integer default 0;

create table if not exists public.scr01_credit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bureau_name text not null default 'CIBIL',
  score integer check (score between 300 and 900),
  total_accounts integer not null default 0,
  open_accounts integer not null default 0,
  closed_accounts integer not null default 0,
  enquiries integer not null default 0,
  utilization_percent numeric not null default 0,
  factors jsonb not null default '[]'::jsonb,
  report_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.scr01_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.scr01_requests(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'uploaded' check (status in ('uploaded','verified','rejected')),
  created_at timestamptz not null default now()
);

alter table public.scr01_credit_reports enable row level security;
alter table public.scr01_documents enable row level security;

drop policy if exists "users_read_own_scr01_credit_reports" on public.scr01_credit_reports;
create policy "users_read_own_scr01_credit_reports" on public.scr01_credit_reports
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users_manage_own_scr01_documents" on public.scr01_documents;
create policy "users_manage_own_scr01_documents" on public.scr01_documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.scr01_credit_reports to authenticated;
grant select, insert, update, delete on public.scr01_documents to authenticated;
grant select, insert, update on public.scr01_profiles to authenticated;
grant select, insert, update on public.scr01_requests to authenticated;

-- Customer-scoped access to the shared CRM tables used by the current website/CRM.
drop policy if exists "mobile_users_read_own_messages" on public.website_messages;
create policy "mobile_users_read_own_messages" on public.website_messages
  for select to authenticated using (user_id = (select auth.uid())::text);
drop policy if exists "mobile_users_send_own_messages" on public.website_messages;
create policy "mobile_users_send_own_messages" on public.website_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())::text and sender_id = (select auth.uid())::text
  );

drop policy if exists "mobile_users_read_own_notifications" on public.website_notifications;
create policy "mobile_users_read_own_notifications" on public.website_notifications
  for select to authenticated using (user_id = (select auth.uid())::text);
drop policy if exists "mobile_users_update_own_notifications" on public.website_notifications;
create policy "mobile_users_update_own_notifications" on public.website_notifications
  for update to authenticated using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

drop policy if exists "mobile_users_read_own_cases" on public.website_cases;
create policy "mobile_users_read_own_cases" on public.website_cases
  for select to authenticated using (customer_id = 'APP-' || (select auth.uid())::text);

drop policy if exists "mobile_users_read_own_payments" on public.website_payments;
create policy "mobile_users_read_own_payments" on public.website_payments
  for select to authenticated using (customer_id = 'APP-' || (select auth.uid())::text);

grant select, insert on public.website_messages to authenticated;
grant select, update on public.website_notifications to authenticated;
grant select on public.website_cases, public.website_payments to authenticated;

drop policy if exists "mobile_users_create_own_customer" on public.website_customers;
create policy "mobile_users_create_own_customer" on public.website_customers
  for insert to authenticated with check (id = 'APP-' || (select auth.uid())::text and user_id = (select auth.uid())::text);
drop policy if exists "mobile_users_update_own_customer" on public.website_customers;
create policy "mobile_users_update_own_customer" on public.website_customers
  for update to authenticated using (id = 'APP-' || (select auth.uid())::text)
  with check (id = 'APP-' || (select auth.uid())::text and user_id = (select auth.uid())::text);
drop policy if exists "mobile_users_create_own_case" on public.website_cases;
create policy "mobile_users_create_own_case" on public.website_cases
  for insert to authenticated with check (customer_id = 'APP-' || (select auth.uid())::text);
drop policy if exists "mobile_users_update_own_case" on public.website_cases;
create policy "mobile_users_update_own_case" on public.website_cases
  for update to authenticated using (customer_id = 'APP-' || (select auth.uid())::text)
  with check (customer_id = 'APP-' || (select auth.uid())::text);
drop policy if exists "mobile_users_create_own_document" on public.website_documents;
create policy "mobile_users_create_own_document" on public.website_documents
  for insert to authenticated with check (customer_id = 'APP-' || (select auth.uid())::text);
drop policy if exists "mobile_users_update_own_document" on public.website_documents;
create policy "mobile_users_update_own_document" on public.website_documents
  for update to authenticated using (customer_id = 'APP-' || (select auth.uid())::text)
  with check (customer_id = 'APP-' || (select auth.uid())::text);

grant insert, update on public.website_customers, public.website_cases, public.website_documents to authenticated;

-- Private document vault. Object paths must start with the authenticated user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scr01-documents', 'scr01-documents', false, 10485760,
  array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mobile_users_read_own_document_objects" on storage.objects;
create policy "mobile_users_read_own_document_objects" on storage.objects
  for select to authenticated using (
    bucket_id = 'scr01-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "mobile_users_upload_own_document_objects" on storage.objects;
create policy "mobile_users_upload_own_document_objects" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'scr01-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "mobile_users_update_own_document_objects" on storage.objects;
create policy "mobile_users_update_own_document_objects" on storage.objects
  for update to authenticated using (
    bucket_id = 'scr01-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'scr01-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "mobile_users_delete_own_document_objects" on storage.objects;
create policy "mobile_users_delete_own_document_objects" on storage.objects
  for delete to authenticated using (
    bucket_id = 'scr01-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Keep mobile profiles and requests visible in the existing CRM tables.
create or replace function public.sync_scr01_profile_to_crm()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare customer_key text := 'APP-' || new.user_id::text;
begin
  insert into public.website_customers
    (id, user_id, name, email, phone, cibil, cases, ltv, tier, joined, status, crm_lead_id, raw_data)
  values
    (customer_key, new.user_id::text, coalesce(new.full_name, 'Mobile Customer'),
     null, new.mobile, 0, 0, '₹ 0', 'silver',
     current_date, 'active', new.crm_lead_id, jsonb_build_object('source','CUSTOMER_APP','kyc_status',new.kyc_status))
  on conflict (id) do update set
    name = excluded.name, email = excluded.email, phone = excluded.phone,
    crm_lead_id = excluded.crm_lead_id, raw_data = public.website_customers.raw_data || excluded.raw_data,
    updated_at = now();
  new.crm_customer_id := customer_key;
  return new;
end; $$;

drop trigger if exists sync_scr01_profile_to_crm_trigger on public.scr01_profiles;
create trigger sync_scr01_profile_to_crm_trigger
before insert or update on public.scr01_profiles for each row execute function public.sync_scr01_profile_to_crm();

create or replace function public.sync_scr01_request_to_crm()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare customer_key text := 'APP-' || new.user_id::text;
begin
  insert into public.website_cases
    (id, customer_id, title, service, status, priority, notes, crm_lead_id, raw_data)
  values
    (new.request_number, customer_key, new.issue_type, 'credit_resolution', new.status,
     new.priority, new.description, new.crm_lead_id,
     jsonb_build_object('source','CUSTOMER_APP','request_id',new.id,'account_last4',new.account_last4,'lender',new.lender_name))
  on conflict (id) do update set
    title = excluded.title, status = excluded.status, priority = excluded.priority,
    notes = excluded.notes, crm_lead_id = excluded.crm_lead_id,
    raw_data = public.website_cases.raw_data || excluded.raw_data, updated_at = now();
  new.crm_case_id := new.request_number;
  return new;
end; $$;

drop trigger if exists sync_scr01_request_to_crm_trigger on public.scr01_requests;
create trigger sync_scr01_request_to_crm_trigger
before insert or update on public.scr01_requests for each row execute function public.sync_scr01_request_to_crm();

create or replace function public.sync_scr01_document_to_crm()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare case_key text;
begin
  select request_number into case_key from public.scr01_requests where id = new.request_id;
  insert into public.website_documents (id, customer_id, case_id, name, type, url, status, raw_data)
  values (new.id::text, 'APP-' || new.user_id::text, case_key, new.name, new.mime_type,
    new.storage_path, new.status, jsonb_build_object('source','CUSTOMER_APP','storage_bucket','scr01-documents'))
  on conflict (id) do update set status = excluded.status, url = excluded.url, raw_data = excluded.raw_data;
  return new;
end; $$;

drop trigger if exists sync_scr01_document_to_crm_trigger on public.scr01_documents;
create trigger sync_scr01_document_to_crm_trigger
after insert or update on public.scr01_documents for each row execute function public.sync_scr01_document_to_crm();

-- Realtime subscriptions used by request tracking, CRM chat and notifications.
do $$ begin
  alter publication supabase_realtime add table public.scr01_requests;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.website_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.website_notifications;
exception when duplicate_object then null; end $$;
