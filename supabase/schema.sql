-- Run this entire file once in the Supabase SQL Editor (Project > SQL Editor > New query).

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text,
  photo_path text,
  ai_summary text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fields_user_id_idx on public.fields(user_id);
create index if not exists pages_field_id_idx on public.pages(field_id);
create index if not exists pages_user_id_idx on public.pages(user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

alter table public.fields enable row level security;
alter table public.pages enable row level security;

drop policy if exists "Users manage own fields" on public.fields;
create policy "Users manage own fields" on public.fields
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own pages" on public.pages;
create policy "Users manage own pages" on public.pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for journal photos
insert into storage.buckets (id, name, public)
values ('journal-photos', 'journal-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own photos" on storage.objects;
create policy "Users manage own photos" on storage.objects
  for all using (
    bucket_id = 'journal-photos' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'journal-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
