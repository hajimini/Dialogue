-- 修复所有引用 sessions 的外键约束
-- 当删除 session 时，级联删除所有相关数据

-- 1. 修复 memories.source_session_id 外键
alter table public.memories
  drop constraint if exists memories_source_session_id_fkey;

alter table public.memories
  add constraint memories_source_session_id_fkey
  foreign key (source_session_id)
  references public.sessions(id)
  on delete cascade;

-- 2. 修复 evaluation_logs.session_id 外键
alter table public.evaluation_logs
  drop constraint if exists evaluation_logs_session_id_fkey;

alter table public.evaluation_logs
  add constraint evaluation_logs_session_id_fkey
  foreign key (session_id)
  references public.sessions(id)
  on delete cascade;

-- 3. 修复 evaluation_logs.message_id 外键
alter table public.evaluation_logs
  drop constraint if exists evaluation_logs_message_id_fkey;

alter table public.evaluation_logs
  add constraint evaluation_logs_message_id_fkey
  foreign key (message_id)
  references public.messages(id)
  on delete cascade;
