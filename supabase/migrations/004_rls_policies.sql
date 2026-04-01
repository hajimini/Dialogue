-- ============================================================
-- Phase 1: RLS 策略（数据隔离安全）
-- ============================================================

alter table public.messages enable row level security;
alter table public.sessions enable row level security;
alter table public.memories enable row level security;
alter table public.user_profiles_per_persona enable row level security;

-- 用户只能看自己的会话
create policy "Users see own sessions" on public.sessions
for select
using (auth.uid() = user_id);

-- 用户只能看自己的消息
create policy "Users see own messages" on public.messages
for select
using (
  session_id in (
    select id from public.sessions where user_id = auth.uid()
  )
);

-- 用户只能看自己的记忆片段
create policy "Users see own memories" on public.memories
for select
using (auth.uid() = user_id);

-- 用户只能看自己的画像
create policy "Users see own user profiles" on public.user_profiles_per_persona
for select
using (auth.uid() = user_id);

-- 管理员可以看所有（通过 profiles.role = 'admin' 判断）
create policy "Admins see all sessions" on public.sessions
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Admins see all messages" on public.messages
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Admins see all memories" on public.memories
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Admins see all user profiles" on public.user_profiles_per_persona
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

