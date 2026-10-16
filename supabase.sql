create table messages (
  id bigint generated always as identity primary key,
  room text not null,
  sender text not null,
  kind text not null default 'text' check (kind in ('text','image','video')),
  body text,
  media_url text,
  created_at timestamptz default now()
);
create index on messages (room, created_at);

-- Уншихыг бүгдэд нээнэ, бичихийг зөвхөн backend (service role) хийнэ
alter table messages enable row level security;
create policy "read" on messages for select using (true);

alter publication supabase_realtime add table messages;

-- Зураг/видеоны сан (50MB хүртэл файл)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;
