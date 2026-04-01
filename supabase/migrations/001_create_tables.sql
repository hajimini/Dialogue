-- ============================================================
-- Phase 1: 基础表结构
-- ============================================================

-- 向量与模糊匹配扩展（后续 RAG / 检索会用到）
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- 1. 用户补充表（auth.users 之外的资料）
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 2. 人设表
create table public.personas (
  id uuid primary key default gen_random_uuid(),

  -- 基础信息
  name text not null,
  avatar_url text,
  gender text,
  age int,
  occupation text,
  city text,

  -- 核心设定
  personality text not null,
  speaking_style text not null,
  background_story text,
  hobbies text,
  daily_habits text,
  family_info text,

  -- 关系默认设定
  default_relationship text,

  -- 行为规则
  forbidden_patterns text,
  example_dialogues text,

  -- 高级设定
  emotional_traits text,
  quirks text,

  -- 状态
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 会话表
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,

  status text default 'active' check (status in ('active', 'ended', 'archived')),

  -- 会话摘要（会话结束后生成）
  summary text,
  topics text[],

  -- 时间
  started_at timestamptz default now(),
  last_message_at timestamptz default now(),
  ended_at timestamptz
);

create index idx_sessions_user_persona
  on public.sessions(user_id, persona_id, last_message_at desc);

-- 4. 消息表
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,

  role text not null check (role in ('user', 'assistant')),
  content text not null,

  -- 情绪标记（后台分析用）
  emotion_label text,

  created_at timestamptz default now()
);

create index idx_messages_session
  on public.messages(session_id, created_at asc);

-- 5. 长期记忆表（RAG 检索）
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,

  memory_type text not null check (
    memory_type in (
      'user_fact',
      'persona_fact',
      'shared_event',
      'relationship',
      'session_summary'
    )
  ),

  content text not null,
  embedding vector(1536),

  importance float default 0.5,
  source_session_id uuid references public.sessions(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_memories_embedding
  on public.memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index idx_memories_user_persona
  on public.memories(user_id, persona_id, memory_type);

-- 6. 用户画像表（每个用户+人设一个画像）
create table public.user_profiles_per_persona (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,

  profile_data jsonb default '{}'::jsonb,

  relationship_stage text default 'new',
  total_messages int default 0,

  updated_at timestamptz default now(),

  unique(user_id, persona_id)
);

-- 7. 评估记录表（用于测试打磨阶段）
create table public.evaluation_logs (
  id uuid primary key default gen_random_uuid(),

  session_id uuid references public.sessions(id),
  message_id uuid references public.messages(id),
  prompt_version text,

  role_adherence int check (role_adherence between 1 and 5),
  naturalness int check (naturalness between 1 and 5),
  emotional_accuracy int check (emotional_accuracy between 1 and 5),
  memory_accuracy int check (memory_accuracy between 1 and 5),
  anti_ai_score int check (anti_ai_score between 1 and 5),
  length_appropriate int check (length_appropriate between 1 and 5),

  evaluator text,
  notes text,

  created_at timestamptz default now()
);

