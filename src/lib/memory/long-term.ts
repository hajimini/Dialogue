/**
 * Long-term Memory Management
 * 
 * Refactored to use MemoryGateway abstraction layer.
 * All memory CRUD operations now delegate to the gateway.
 * 
 * Preserved utility functions:
 * - mergeUniqueStrings(): Merge unique strings from multiple lists
 * - createEmptyProfileData(): Create empty profile data structure
 */

import { getMemoryGateway } from './factory';
import type {
  MemoryRecord,
  MemoryType,
  UserProfilePerPersonaData,
  UserProfilePerPersonaRecord,
} from '@/lib/supabase/types';
import {
  getMemorySupabaseClient,
  resolveMemoryStorageUserId,
} from '@/lib/memory/storage';

/**
 * Memory draft type for batch operations
 */
type MemoryDraft = {
  memory_type: MemoryRecord['memory_type'];
  content: string;
  importance?: number;
};

/**
 * Create empty profile data structure
 * Preserved from original implementation
 */
export function createEmptyProfileData(): UserProfilePerPersonaData {
  return {
    summary: '',
    facts: [],
    preferences: [],
    relationship_notes: [],
    recent_topics: [],
    anchors: [],
  };
}

/**
 * Merge unique strings from multiple lists
 * Preserved from original implementation
 */
export function mergeUniqueStrings(
  limit: number,
  ...lists: Array<string[] | undefined>
) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const list of lists) {
    for (const item of list ?? []) {
      const normalized = item.trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);

      if (merged.length >= limit) {
        return merged;
      }
    }
  }

  return merged;
}

/**
 * List memories for a user (optionally filtered by persona)
 * Refactored to use MemoryGateway
 */
export async function listMemories(
  userId: string,
  personaId?: string,
  options?: {
    characterId?: string;
    memoryType?: MemoryType;
    limit?: number;
    offset?: number;
    query?: string;
  }
) {
  const supabase = getMemorySupabaseClient();
  const storageUserId = await resolveMemoryStorageUserId(userId);
  const limit = Math.max(1, Math.min(200, options?.limit ?? 1000));
  const offset = Math.max(0, options?.offset ?? 0);
  const queryText = options?.query?.trim();

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', storageUserId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) {
    query = query.eq('persona_id', personaId);
  }

  if (options?.characterId) {
    query = query.eq('character_id', options.characterId);
  }

  if (options?.memoryType) {
    query = query.eq('memory_type', options.memoryType);
  }

  if (queryText) {
    query = query.ilike('content', `%${queryText}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list memories: ${error.message}`);
  }

  return (data ?? []).map((memory) => ({
    ...memory,
    user_id: userId,
  })) as MemoryRecord[];
}

/**
 * Get user profile for a specific persona and character
 * Note: This function now uses Supabase directly via the gateway
 */
export async function getUserProfileForPersona(
  userId: string,
  personaId: string,
  characterId: string
) {
  const gateway = getMemoryGateway();
  return gateway.getUserProfile(userId, personaId, characterId);
}

/**
 * List user profiles (optionally filtered)
 * Note: This function now uses Supabase directly
 */
export async function listUserProfiles(filters?: {
  userId?: string;
  personaId?: string;
}) {
  const supabase = getMemorySupabaseClient();

  let query = supabase.from('user_profiles_per_persona').select('*');

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters?.personaId) {
    query = query.eq('persona_id', filters.personaId);
  }

  const { data, error } = await query.order('updated_at', {
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to list user profiles: ${error.message}`);
  }

  return data || [];
}

/**
 * Save session memories (batch operation)
 * Refactored to use MemoryGateway
 */
export async function saveSessionMemories(input: {
  userId: string;
  personaId: string;
  characterId: string;
  sessionId: string;
  topics: string[];
  summary: string;
  memories: MemoryDraft[];
  profile: Partial<UserProfilePerPersonaData> & {
    relationship_stage?: UserProfilePerPersonaRecord['relationship_stage'];
    total_messages?: number;
  };
}) {
  const gateway = getMemoryGateway();

  // Delegate to gateway's saveSessionMemories method
  const result = await gateway.saveSessionMemories({
    userId: input.userId,
    personaId: input.personaId,
    characterId: input.characterId,
    sessionId: input.sessionId,
    topics: input.topics,
    summary: input.summary,
    memories: input.memories,
    profile: input.profile,
  });

  // Convert MemoryResult back to MemoryRecord format for backward compatibility
  const memories = result.memories.map((memory) => ({
    id: memory.id,
    user_id: memory.userId,
    persona_id: memory.personaId,
    memory_type: memory.memoryType,
    content: memory.content,
    embedding: null, // Not returned by gateway
    importance: memory.importance,
    source_session_id: memory.sourceSessionId,
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
  }));

  return {
    memories,
    profile: result.profile,
  };
}

/**
 * Create a new memory
 * Refactored to use MemoryGateway
 */
export async function createMemory(input: {
  userId: string;
  personaId: string;
  characterId: string;
  memoryType: MemoryRecord['memory_type'];
  content: string;
  importance?: number;
  sourceSessionId?: string | null;
}) {
  const gateway = getMemoryGateway();

  const content = input.content.trim();

  if (!content) {
    throw new Error('Memory content is required.');
  }

  // Delegate to gateway's add method
  const result = await gateway.add({
    userId: input.userId,
    personaId: input.personaId,
    characterId: input.characterId,
    memoryType: input.memoryType,
    content,
    importance: input.importance ?? 0.5,
    sourceSessionId: input.sourceSessionId ?? null,
  });

  // Convert MemoryResult back to MemoryRecord format for backward compatibility
  return {
    id: result.id,
    user_id: result.userId,
    persona_id: result.personaId,
    memory_type: result.memoryType,
    content: result.content,
    embedding: null, // Not returned by gateway
    importance: result.importance,
    source_session_id: result.sourceSessionId,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
  };
}

/**
 * Update an existing memory
 * Refactored to use MemoryGateway
 */
export async function updateMemory(
  memoryId: string,
  updates: {
    memoryType?: MemoryRecord['memory_type'];
    content?: string;
    importance?: number;
    sourceSessionId?: string | null;
  }
) {
  const gateway = getMemoryGateway();

  // Validate content if provided
  if (typeof updates.content === 'string') {
    const trimmedContent = updates.content.trim();
    if (!trimmedContent) {
      throw new Error('Memory content is required.');
    }
    updates.content = trimmedContent;
  }

  // Delegate to gateway's update method
  const result = await gateway.update({
    memoryId,
    content: updates.content,
    importance: updates.importance,
    memoryType: updates.memoryType,
  });

  // Convert MemoryResult back to MemoryRecord format for backward compatibility
  return {
    id: result.id,
    user_id: result.userId,
    persona_id: result.personaId,
    memory_type: result.memoryType,
    content: result.content,
    embedding: null, // Not returned by gateway
    importance: result.importance,
    source_session_id: result.sourceSessionId,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
  };
}

/**
 * Delete a memory
 * Refactored to use MemoryGateway
 */
export async function deleteMemory(memoryId: string) {
  const gateway = getMemoryGateway();

  // Delegate to gateway's delete method
  await gateway.delete(memoryId);

  // Return a minimal deleted record for backward compatibility
  // Note: The actual deleted record is not available from the gateway
  return {
    id: memoryId,
    user_id: '',
    persona_id: '',
    memory_type: 'user_fact' as const,
    content: '',
    embedding: null,
    importance: 0,
    source_session_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
