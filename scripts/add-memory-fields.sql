-- 添加记忆反馈和检索字段（如果不存在）
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS retrieval_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_count_accurate INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_count_inaccurate INT DEFAULT 0;

-- 为测试数据添加一些模拟的检索和反馈数据
UPDATE public.memories
SET 
  retrieval_count = FLOOR(RANDOM() * 20)::INT,
  feedback_count_accurate = FLOOR(RANDOM() * 5)::INT,
  feedback_count_inaccurate = FLOOR(RANDOM() * 2)::INT
WHERE retrieval_count = 0;
