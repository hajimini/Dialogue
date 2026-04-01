-- 添加记忆标签表
create table if not exists public.memory_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  description text,
  created_at timestamptz default now()
);

-- 记忆与标签的关联表
create table if not exists public.memory_tag_relations (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  tag_id uuid not null references public.memory_tags(id) on delete cascade,
  created_at timestamptz default now(),
  unique(memory_id, tag_id)
);

create index idx_memory_tag_relations_memory
  on public.memory_tag_relations(memory_id);

create index idx_memory_tag_relations_tag
  on public.memory_tag_relations(tag_id);
