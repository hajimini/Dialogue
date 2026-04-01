-- Migration 016: Repair orphaned character references
-- Rebind sessions / memories / user profiles whose character_id no longer
-- points to a real character row.

with owners_needing_character as (
  select distinct s.user_id as owner_id
  from sessions s
  left join user_characters uc on uc.id = s.character_id
  where s.character_id is not null and uc.id is null

  union

  select distinct m.user_id as owner_id
  from memories m
  left join user_characters uc on uc.id = m.character_id
  where m.character_id is not null and uc.id is null

  union

  select distinct p.user_id as owner_id
  from user_profiles_per_persona p
  left join user_characters uc on uc.id = p.character_id
  where p.character_id is not null and uc.id is null
)
insert into user_characters (owner_id, name, personality, is_active)
select o.owner_id, '默认角色', '系统默认角色', true
from owners_needing_character o
where not exists (
  select 1
  from user_characters existing
  where existing.owner_id = o.owner_id
    and existing.is_active = true
);

update sessions s
set character_id = coalesce(
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = s.user_id
      and uc.is_active = true
      and uc.name = '默认角色'
    order by uc.created_at desc nulls last
    limit 1
  ),
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = s.user_id
      and uc.is_active = true
    order by uc.created_at desc nulls last
    limit 1
  )
)
where s.character_id is not null
  and not exists (
    select 1
    from user_characters uc
    where uc.id = s.character_id
  );

update memories m
set character_id = coalesce(
  (
    select s.character_id
    from sessions s
    where s.id = m.source_session_id
      and s.character_id is not null
    limit 1
  ),
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = m.user_id
      and uc.is_active = true
      and uc.name = '默认角色'
    order by uc.created_at desc nulls last
    limit 1
  ),
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = m.user_id
      and uc.is_active = true
    order by uc.created_at desc nulls last
    limit 1
  )
)
where m.character_id is not null
  and not exists (
    select 1
    from user_characters uc
    where uc.id = m.character_id
  );

update user_profiles_per_persona p
set character_id = coalesce(
  (
    select s.character_id
    from sessions s
    where s.user_id = p.user_id
      and s.persona_id = p.persona_id
      and s.character_id is not null
    order by s.last_message_at desc nulls last
    limit 1
  ),
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = p.user_id
      and uc.is_active = true
      and uc.name = '默认角色'
    order by uc.created_at desc nulls last
    limit 1
  ),
  (
    select uc.id
    from user_characters uc
    where uc.owner_id = p.user_id
      and uc.is_active = true
    order by uc.created_at desc nulls last
    limit 1
  )
)
where p.character_id is not null
  and not exists (
    select 1
    from user_characters uc
    where uc.id = p.character_id
  );

do $$
declare
  orphan_sessions int;
  orphan_memories int;
  orphan_profiles int;
begin
  select count(*) into orphan_sessions
  from sessions s
  left join user_characters uc on uc.id = s.character_id
  where s.character_id is not null and uc.id is null;

  select count(*) into orphan_memories
  from memories m
  left join user_characters uc on uc.id = m.character_id
  where m.character_id is not null and uc.id is null;

  select count(*) into orphan_profiles
  from user_profiles_per_persona p
  left join user_characters uc on uc.id = p.character_id
  where p.character_id is not null and uc.id is null;

  if orphan_sessions > 0 or orphan_memories > 0 or orphan_profiles > 0 then
    raise exception
      'Migration 016 failed: orphan character refs remain (sessions: %, memories: %, profiles: %)',
      orphan_sessions, orphan_memories, orphan_profiles;
  end if;
end $$;
