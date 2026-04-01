-- Migration 011: Move app state off local files and into Supabase

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  instructions text not null,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_prompt_versions_single_active
  on public.prompt_versions (is_active)
  where is_active = true;

insert into public.prompt_versions (label, instructions, notes, is_active)
select
  'v1 Baseline',
  'Keep the reply grounded in the persona. Prefer short, natural, emotionally aware sentences and avoid assistant-style structure.',
  'Seeded baseline version for prompt management.',
  true
where not exists (
  select 1 from public.prompt_versions
);

alter table public.evaluation_logs
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists persona_id uuid references public.personas(id) on delete set null,
  add column if not exists feedback_type text check (feedback_type in ('up', 'down')),
  add column if not exists feedback_reason text,
  add column if not exists source text check (source in ('admin-panel', 'chat-feedback', 'quick-test', 'batch-test', 'auto'));

create index if not exists idx_evaluation_logs_user_created
  on public.evaluation_logs(user_id, created_at desc);

create index if not exists idx_evaluation_logs_persona_created
  on public.evaluation_logs(persona_id, created_at desc);
