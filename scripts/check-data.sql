-- 检查记忆表是否有数据
SELECT COUNT(*) as total_memories FROM public.memories;

-- 检查字段是否存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'memories'
AND column_name IN ('retrieval_count', 'feedback_count_accurate', 'feedback_count_inaccurate');

-- 查看前5条记忆数据
SELECT
  id,
  user_id,
  persona_id,
  memory_type,
  LEFT(content, 50) as content_preview,
  retrieval_count,
  feedback_count_accurate,
  feedback_count_inaccurate,
  created_at
FROM public.memories
LIMIT 5;

-- 检查有多少记忆属于小芮嫣
SELECT
  p.name as persona_name,
  COUNT(m.id) as memory_count
FROM public.personas p
LEFT JOIN public.memories m ON m.persona_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name;
