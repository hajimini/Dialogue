-- 创建虚拟角色表
create table if not exists public.user_characters (
  id uuid primary key default gen_random_uuid(),

  -- 所属的真实用户
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- 角色信息
  name text not null,
  personality text,
  avatar_url text,
  bio text,

  -- 状态
  is_active boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_user_characters_owner
  on public.user_characters(owner_id, created_at desc);

-- 修改 sessions 表，添加 character_id
alter table public.sessions
  add column if not exists character_id uuid references public.user_characters(id) on delete cascade;

create index idx_sessions_character
  on public.sessions(character_id, last_message_at desc);

-- 修改 memories 表，添加 character_id
alter table public.memories
  add column if not exists character_id uuid references public.user_characters(id) on delete cascade;

create index idx_memories_character_persona
  on public.memories(character_id, persona_id, memory_type);

-- 为现有数据创建默认角色
-- 注意：这个脚本需要根据实际情况调整
