# 账号清理报告

生成时间：2026-03-30T11:55:29.481Z

## 一、清理目标

清理多余测试账号，只保留 2 个账号体系：
- 1 个管理员账号
- 1 个用户账号

## 二、保留账号

- **admin@ai-companion.local** (baa1cfc0-6125-49f6-967f-ef3d39e57259)
  - 创建时间: 2026-03-30T09:20:51.890767Z
  - 最近登录: 2026-03-30T09:37:11.335375Z
- **demo@ai-companion.local** (359acbd5-9490-4340-9a5d-01b94ef233b2)
  - 创建时间: 2026-03-30T09:20:45.268024Z
  - 最近登录: 从未登录

## 三、删除账号

- **codex-274074@example.com** (d8a8d70c-c362-468b-bce6-44f0adab6016)
  - 创建时间: 2026-03-30T09:37:08.507074Z
  - 最近登录: 从未登录
- **memory-rls-1774709400008@ai-companion.local** (27d81dcd-4fd6-48f3-9e34-a55df59fcb65)
  - 创建时间: 2026-03-28T14:52:33.501096Z
  - 最近登录: 2026-03-28T14:52:36.162954Z
- **memory-rls-1774709219945@ai-companion.local** (fd9fec9a-1c4f-4ecb-9a1e-e540d1dfcadc)
  - 创建时间: 2026-03-28T14:49:33.484973Z
  - 最近登录: 2026-03-28T14:49:35.970261Z
- **demo-user@ai-companion.local** (717f12f5-8b81-4272-9b8a-475a51026d19)
  - 创建时间: 2026-03-28T11:19:07.106492Z
  - 最近登录: 2026-03-28T15:25:43.36776Z

## 四、删除数据统计

| 数据表 | 删除数量 |
|---|---|
| auth.users | 4 |
| profiles | 2 |
| user_characters | 17 |
| sessions | 164 |
| messages | 0 |
| memories | 188 |
| user_profiles_per_persona | 3 |
| memory_feedback | 1 |

## 五、清理后数据统计

| 数据表 | 剩余数量 |
|---|---|
| auth.users | 2 |
| profiles | 2 |
| user_characters | 3 |
| sessions | 4 |
| messages | 8 |
| memories | 9 |

## 六、验证结果

✅ 账号清理完成
✅ 无孤儿数据残留
✅ 数据库状态正常

## 七、后续建议

1. 定期检查测试账号，避免再次积累
2. 测试时使用明确的命名规范（如 test-* 前缀）
3. 测试完成后及时清理
