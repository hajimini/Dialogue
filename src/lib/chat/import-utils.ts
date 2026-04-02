// 导入进度跟踪和错误恢复工具
import { queryPostgres } from "@/lib/postgres";

type ImportProgress = {
  sessionId: string;
  totalMessages: number;
  importedMessages: number;
  status: "pending" | "importing" | "completed" | "failed";
  error?: string;
};

type ImportStats = {
  totalParsed: number;
  totalImported: number;
  failedMessages: number;
  memoryGenerated: boolean;
  profileUpdated: boolean;
};

/**
 * 验证导入文件格式
 */
export function validateImportFile(file: File): { valid: boolean; error?: string } {
  // 检查文件大小（最大10MB）
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  // 检查文件类型
  if (!file.name.endsWith('.txt')) {
    return {
      valid: false,
      error: "仅支持 .txt 格式文件"
    };
  }

  return { valid: true };
}

/**
 * 清理失败的导入会话
 */
export async function cleanupFailedImport(sessionId: string, userId: string) {
  try {
    // 删除会话（会级联删除消息和记忆）
    await queryPostgres(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
  } catch (error) {
    console.error('[cleanupFailedImport] Failed to cleanup:', error);
  }
}

/**
 * 验证导入后的数据完整性
 */
export async function verifyImportIntegrity(
  sessionId: string,
  expectedMessageCount: number
): Promise<{ valid: boolean; actualCount: number; error?: string }> {
  try {
    const result = await queryPostgres<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages WHERE session_id = $1`,
      [sessionId]
    );

    const actualCount = parseInt(result.rows[0]?.count || '0', 10);

    if (actualCount !== expectedMessageCount) {
      return {
        valid: false,
        actualCount,
        error: `消息数量不匹配：期望 ${expectedMessageCount}，实际 ${actualCount}`
      };
    }

    return { valid: true, actualCount };
  } catch (error) {
    return {
      valid: false,
      actualCount: 0,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}

/**
 * 获取导入统计信息
 */
export async function getImportStats(sessionId: string): Promise<ImportStats | null> {
  try {
    // 获取消息数量
    const messageResult = await queryPostgres<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages WHERE session_id = $1`,
      [sessionId]
    );
    const messageCount = parseInt(messageResult.rows[0]?.count || '0', 10);

    // 获取记忆数量
    const memoryResult = await queryPostgres<{ count: string }>(
      `SELECT COUNT(*) as count FROM memories WHERE source_session_id = $1`,
      [sessionId]
    );
    const memoryCount = parseInt(memoryResult.rows[0]?.count || '0', 10);

    // 获取会话信息
    const sessionResult = await queryPostgres<{ summary: string | null }>(
      `SELECT summary FROM sessions WHERE id = $1`,
      [sessionId]
    );
    const hasSummary = Boolean(sessionResult.rows[0]?.summary);

    return {
      totalParsed: messageCount,
      totalImported: messageCount,
      failedMessages: 0,
      memoryGenerated: memoryCount > 0 || hasSummary,
      profileUpdated: memoryCount > 0,
    };
  } catch (error) {
    console.error('[getImportStats] Failed:', error);
    return null;
  }
}
