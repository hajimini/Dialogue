-- 强制更新所有记忆的统计字段
UPDATE public.memories
SET
  retrieval_count = FLOOR(RANDOM() * 20)::INT,
  feedback_count_accurate = FLOOR(RANDOM() * 5)::INT,
  feedback_count_inaccurate = FLOOR(RANDOM() * 2)::INT;

-- 验证更新结果
SELECT
  id,
  memory_type,
  LEFT(content, 30) as content_preview,
  retrieval_count,
  feedback_count_accurate,
  feedback_count_inaccurate
FROM public.memories
WHERE persona_id = (SELECT id FROM public.personas WHERE name = '小芮嫣')
LIMIT 5;
