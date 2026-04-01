-- 添加记忆版本历史表
create table if not exists public.memory_versions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,

  -- 版本内容
  content text not null,
  importance float not null,
  memory_type text not null,

  -- 变更信息
  change_type text not null check (change_type in ('created', 'updated', 'deleted')),
  changed_by text,
  change_reason text,

  -- 时间戳
  version_timestamp timestamptz default now(),

  -- 版本号（自动递增）
  version_number int not null
);

create index idx_memory_versions_memory_id
  on public.memory_versions(memory_id, version_timestamp desc);

-- 添加记忆反馈字段（如果不存在）
alter table public.memories
  add column if not exists retrieval_count int default 0,
  add column if not exists feedback_count_accurate int default 0,
  add column if not exists feedback_count_inaccurate int default 0;
