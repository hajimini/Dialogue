/**
 * MemoryGateway - 记忆系统抽象接口层
 * 
 * 隔离具体记忆引擎实现（Mem0/Letta），支持未来切换而不影响业务代码
 */

import type {
  MemoryType,
  UserProfilePerPersonaRecord,
  UserProfilePerPersonaData,
  SessionRecord,
  Persona,
} from '@/lib/supabase/types';

/**
 * 记忆网关接口
 */
export interface MemoryGateway {
  /**
   * 添加单条记忆
   */
  add(params: AddMemoryParams): Promise<MemoryResult>;

  /**
   * 搜索记忆
   */
  search(params: SearchMemoryParams): Promise<MemorySearchResult>;

  /**
   * 更新记忆
   */
  update(params: UpdateMemoryParams): Promise<MemoryResult>;

  /**
   * 删除记忆
   */
  delete(memoryId: string): Promise<void>;

  /**
   * 批量保存会话记忆（包含profile更新）
   */
  saveSessionMemories(
    params: SaveSessionMemoriesParams
  ): Promise<SaveSessionMemoriesResult>;

  /**
   * 获取记忆上下文（用于prompt构建）
   */
  getMemoryContext(params: GetMemoryContextParams): Promise<MemoryContext>;
  getUserProfile(
    userId: string,
    personaId: string,
    characterId: string
  ): Promise<UserProfilePerPersonaRecord | null>;
}

/**
 * 添加记忆参数
 */
export type AddMemoryParams = {
  userId: string;
  personaId: string;
  characterId: string;  // Required for character isolation
  memoryType: MemoryType;
  content: string;
  importance?: number;
  sourceSessionId?: string | null;
};

/**
 * 搜索记忆参数
 */
export type SearchMemoryParams = {
  userId: string;
  personaId: string;
  characterId: string;  // Required for character isolation
  query: string;
  limit?: number;
  memoryTypes?: MemoryType[];
};

/**
 * 更新记忆参数
 */
export type UpdateMemoryParams = {
  memoryId: string;
  content?: string;
  importance?: number;
  memoryType?: MemoryType;
};

/**
 * 记忆结果（标准化格式）
 */
export type MemoryResult = {
  id: string;
  userId: string;
  personaId: string;
  memoryType: MemoryType;
  content: string;
  importance: number;
  sourceSessionId: string | null;
  embedding?: number[] | null;
  similarityScore?: number;
  rerankerScore?: number;
  finalRank?: number;
  createdAt: string;
  updatedAt: string;
};

export type ScoredMemoryResult = {
  memory: MemoryResult;
  similarityScore: number;
  rerankerScore?: number;
  finalRank: number;
};

/**
 * 记忆搜索结果
 */
export type MemorySearchResult = {
  memories: MemoryResult[];
  totalCount: number;
  embeddingTime?: number;
  searchTime?: number;
  rerankTime?: number;
  totalTime?: number;
  scoredMemories?: ScoredMemoryResult[];
};

/**
 * 批量保存会话记忆参数
 */
export type SaveSessionMemoriesParams = {
  userId: string;
  personaId: string;
  characterId: string;  // Required for character isolation
  sessionId: string;
  topics: string[];
  summary: string;
  memories: Array<{
    memory_type: MemoryType;
    content: string;
    importance?: number;
  }>;
  profile: Partial<UserProfilePerPersonaData> & {
    relationship_stage?: UserProfilePerPersonaRecord['relationship_stage'];
    total_messages?: number;
  };
};

/**
 * 批量保存会话记忆结果
 */
export type SaveSessionMemoriesResult = {
  memories: MemoryResult[];
  profile: UserProfilePerPersonaRecord;
};

/**
 * 获取记忆上下文参数
 */
export type GetMemoryContextParams = {
  userId: string;
  personaId: string;
  characterId: string;  // Required for character isolation
  persona: Persona;
  query: string;
  limit?: number;
  sessionId?: string;
  messageCount?: number;
};

/**
 * 记忆上下文（用于prompt构建）
 */
export type MemoryContext = {
  userProfile: UserProfilePerPersonaRecord | null;
  recentSummaries: SessionRecord[];
  relevantMemories: MemoryResult[];
};
