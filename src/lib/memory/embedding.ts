/**
 * Embedding Module (Legacy)
 * 
 * @deprecated This module is deprecated. Use EmbeddingService from services/embedding-service.ts instead.
 * 
 * This file is maintained for backward compatibility only.
 * All embedding functionality has been migrated to the new EmbeddingService
 * which is accessed through the MemoryGateway abstraction layer.
 * 
 * Migration path:
 * - Old: import { embedText } from '@/lib/memory/embedding'
 * - New: Use MemoryGateway which internally uses EmbeddingService
 */

import { getMemoryGateway } from './factory';
import type { Mem0Adapter } from './adapters/mem0-adapter';

/**
 * Generate embedding for text
 * 
 * @deprecated Use MemoryGateway's internal EmbeddingService instead.
 * This function is maintained for backward compatibility only.
 * 
 * @param input - Text to embed
 * @returns Embedding vector (1536 dimensions)
 * 
 * @example
 * // Old usage (deprecated)
 * const embedding = await embedText("Hello world");
 * 
 * // New usage (recommended)
 * const gateway = getMemoryGateway();
 * // Embedding is handled automatically by gateway operations
 */
export async function embedText(input: string): Promise<number[]> {
  try {
    const gateway = getMemoryGateway() as Mem0Adapter;
    
    // Delegate to EmbeddingService through the adapter
    // @ts-expect-error - Accessing internal embeddingService for backward compatibility
    return await gateway.embeddingService.embed(input);
  } catch (error) {
    console.warn(
      '[Embedding] Failed to use EmbeddingService, falling back to local embedding:',
      error instanceof Error ? error.message : String(error)
    );
    
    // Fallback to local hash-based embedding
    return generateFallbackEmbedding(input);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * This utility function is preserved as it's useful for testing and debugging.
 * 
 * @param left - First vector
 * @param right - Second vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(left: number[] | null, right: number[] | null): number {
  if (!left || !right || left.length === 0 || right.length === 0) {
    return 0;
  }

  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

// ============================================================
// Internal fallback implementation (preserved for safety)
// ============================================================

const VECTOR_SIZE = 1536;

/**
 * Generate fallback hash-based embedding
 * 
 * This provides a deterministic embedding when API is unavailable.
 * Uses multiple hash functions to distribute tokens across the vector space.
 * 
 * @internal
 */
function generateFallbackEmbedding(input: string): number[] {
  const text = input.trim().toLowerCase();
  const vector = new Array<number>(VECTOR_SIZE).fill(0);

  if (!text) {
    return vector;
  }

  const tokens = text.split(/[\s,.;!?，。！？、\n]+/).filter(Boolean);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const primaryIndex = hashTokenToIndex(token, 17);
    const secondaryIndex = hashTokenToIndex(token, 97);
    const tertiaryIndex = hashTokenToIndex(token, 193);
    vector[primaryIndex] += 1.2;
    vector[secondaryIndex] += 0.8;
    vector[tertiaryIndex] += 0.4;
  }

  return normalizeVector(vector);
}

/**
 * Hash a token to a vector index using FNV-1a algorithm
 * @internal
 */
function hashTokenToIndex(token: string, seed: number): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_SIZE;
}

/**
 * Normalize a vector to unit length
 * @internal
 */
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}
