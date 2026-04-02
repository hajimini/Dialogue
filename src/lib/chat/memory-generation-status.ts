// 导入后记忆生成状态检查工具
import { queryPostgres } from "@/lib/postgres";

type MemoryGenerationStatus = {
  sessionId: string;
  messageCount: number;
  memoryCount: number;
  hasSummary: boolean;
  hasProfile: boolean;
  isComplete: boolean;
  estimatedTimeRemaining: number; // 秒
};

/**
 * 检查导入会话的记忆生成状态
 */
export async function checkMemoryGenerationStatus(
  sessionId: string
): Promise<MemoryGenerationStatus> {
  // 获取会话信息
  const sessionResult = await queryPostgres<{
    id: string;
    user_id: string;
    persona_id: string;
    character_id: string | null;
    summary: string | null;
  }>(
    `SELECT id, user_id, persona_id, character_id, summary FROM sessions WHERE id = $1`,
    [sessionId]
  );

  const session = sessionResult.rows[0];
  if (!session) {
    throw new Error("Session not found");
  }

  // 获取消息数量
  const messageResult = await queryPostgres<{ count: string }>(
    `SELECT COUNT(*) as count FROM messages WHERE session_id = $1`,
    [sessionId]
  );
  const messageCount = parseInt(messageResult.rows[0]?.count || "0", 10);

  // 获取记忆数量
  const memoryResult = await queryPostgres<{ count: string }>(
    `SELECT COUNT(*) as count FROM memories WHERE source_session_id = $1`,
    [sessionId]
  );
  const memoryCount = parseInt(memoryResult.rows[0]?.count || "0", 10);

  // 检查用户画像
  const profileResult = await queryPostgres<{ id: string }>(
    `SELECT id FROM user_profiles_per_persona
     WHERE user_id = $1 AND persona_id = $2 AND character_id = $3`,
    [session.user_id, session.persona_id, session.character_id]
  );
  const hasProfile = profileResult.rows.length > 0;

  const hasSummary = Boolean(session.summary);

  // 判断是否完成
  // 完成条件：有摘要 或 有记忆 或 有用户画像
  const isComplete = hasSummary || memoryCount > 0 || hasProfile;

  // 估算剩余时间（基于经验值）
  // 通常记忆生成需要 10-30 秒
  let estimatedTimeRemaining = 0;
  if (!isComplete) {
    estimatedTimeRemaining = 20; // 默认20秒
  }

  return {
    sessionId,
    messageCount,
    memoryCount,
    hasSummary,
    hasProfile,
    isComplete,
    estimatedTimeRemaining,
  };
}

/**
 * 轮询等待记忆生成完成
 */
export async function waitForMemoryGeneration(
  sessionId: string,
  options: {
    maxWaitTime?: number; // 最大等待时间（毫秒）
    pollInterval?: number; // 轮询间隔（毫秒）
    onProgress?: (status: MemoryGenerationStatus) => void;
  } = {}
): Promise<MemoryGenerationStatus> {
  const maxWaitTime = options.maxWaitTime || 60000; // 默认60秒
  const pollInterval = options.pollInterval || 2000; // 默认2秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkMemoryGenerationStatus(sessionId);

    if (options.onProgress) {
      options.onProgress(status);
    }

    if (status.isComplete) {
      return status;
    }

    // 等待后再次检查
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // 超时，返回当前状态
  return checkMemoryGenerationStatus(sessionId);
}
