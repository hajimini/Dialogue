-- Migration 016: repair orphaned character references left by historical deletes
-- Strategy:
-- 1. Ensure each affected user has an active default character
-- 2. Repoint orphaned sessions/memories/profiles to that default character

with affected_users as (
  select distinct user_id as owner_id
  from sessions s
  left join user_characters c on c.id = s.character_id
  where s.character_id is not null and c.id is null

  union

  select distinct user_id as owner_id
  from memories m
  left join user_characters c on c.id = m.character_id
  where m.character_id is not null and c.id is null

  union

  select distinct user_id as owner_id
  from user_profiles_per_persona p
  left join user_characters c on c.id = p.character_id
  where p.character_id is not null and c.id is null
)
insert into user_characters (owner_id, name, personality, is_active)
select owner_id, '默认角色', '系统默认角色', true
from affected_users u
where not exists (
  select 1
  from user_characters c
  where c.owner_id = u.owner_id and c.name = '默认角色' and c.is_active = true
);

update sessions s
set character_id = fallback.id
from lateral (
  select id
  from user_characters
  where owner_id = s.user_id and is_active = true
  order by case when name = '默认角色' then 0 else 1 end, created_at desc nulls last
  limit 1
) fallback
where s.character_id is not null
  and not exists (
    select 1
    from user_characters c
    where c.id = s.character_id
  );

update memories m
set character_id = fallback.id
from lateral (
  select id
  from user_characters
  where owner_id = m.user_id and is_active = true
  order by case when name = '默认角色' then 0 else 1 end, created_at desc nulls last
  limit 1
) fallback
where m.character_id is not null
  and not exists (
    select 1
    from user_characters c
    where c.id = m.character_id
  );

update user_profiles_per_persona p
set character_id = fallback.id
from lateral (
  select id
  from user_characters
  where owner_id = p.user_id and is_active = true
  order by case when name = '默认角色' then 0 else 1 end, created_at desc nulls last
  limit 1
) fallback
where p.character_id is not null
  and not exists (
    select 1
    from user_characters c
    where c.id = p.character_id
  );
