/**
 * Embedding Service
 * 
 * Provides text embedding functionality with multiple provider support,
 * fallback mechanisms, retry logic, and performance tracking.
 * 
 * Supports:
 * - OpenAI text-embedding-3-large (1536 dimensions)
 * - NVIDIA nv-embedqa-e5-v5 (1024 dimensions)
 * - BGE-M3 (placeholder for future implementation)
 * - Hash-based fallback embedding
 */

import type { EmbeddingServiceConfig } from '../config';
import { memoryMetrics } from '../metrics';
import { memoryLogger } from '../memory-logger';

const OPENAI_VECTOR_SIZE = 1536;
const NVIDIA_VECTOR_SIZE = 1024;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT_MS = Number(process.env.EMBEDDING_REQUEST_TIMEOUT_MS || 8000);

/**
 * Performance metrics for embedding operations
 */
type EmbeddingMetrics = {
  provider: string;
  textLength: number;
  duration: number;
  success: boolean;
  error?: string;
};

/**
 * Embedding service for generating text embeddings
 */
export class EmbeddingService {
  private provider: 'openai' | 'nvidia' | 'bge-m3';
  private apiKey: string;
  private model: string;
  private baseUrl?: string;
  private metrics: EmbeddingMetrics[] = [];

  constructor(config: EmbeddingServiceConfig) {
    this.provider = config.provider as 'openai' | 'nvidia' | 'bge-m3';
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Get the expected vector size for the current provider
   */
  private getVectorSize(): number {
    switch (this.provider) {
      case 'openai':
        return OPENAI_VECTOR_SIZE;
      case 'nvidia':
        return NVIDIA_VECTOR_SIZE;
      case 'bge-m3':
        return NVIDIA_VECTOR_SIZE; // BGE-M3 also uses 1024
      default:
        return OPENAI_VECTOR_SIZE; // Default fallback
    }
  }

  /**
   * Generate embedding for text with automatic fallback
   * 
   * @param text - Text to embed
   * @returns Embedding vector (dimensions depend on provider)
   */
  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();
    const trimmedText = text.trim();

    // Handle empty text
    if (!trimmedText) {
      return new Array<number>(this.getVectorSize()).fill(0);
    }

    try {
      let embedding: number[];

      if (this.provider === 'openai') {
        embedding = await this.embedWithOpenAI(trimmedText);
      } else if (this.provider === 'nvidia') {
        embedding = await this.embedWithNVIDIA(trimmedText);
      } else if (this.provider === 'bge-m3') {
        embedding = await this.embedWithBGE();
      } else {
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
      }

      // Record success metrics
      const duration = Math.max(1, Date.now() - startTime);
      this.recordMetric({
        provider: this.provider,
        textLength: trimmedText.length,
        duration,
        success: true,
      });

      return embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(
        `[EmbeddingService] ${this.provider} embedding failed: ${errorMessage}. Falling back to hash-based embedding.`
      );

      // Record failure metrics
      const duration = Math.max(1, Date.now() - startTime);
      this.recordMetric({
        provider: this.provider,
        textLength: trimmedText.length,
        duration,
        success: false,
        error: errorMessage,
      });

      // Fallback to hash-based embedding
      return this.generateFallbackEmbedding(trimmedText);
    }
  }

  /**
   * Generate embedding using OpenAI API with retry logic
   * 
   * @param text - Text to embed
   * @returns Embedding vector
   * @throws Error if all retries fail
   */
  private async embedWithOpenAI(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(
            `OpenAI API failed with status ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid OpenAI response format: missing embedding data');
        }

        if (embedding.length !== OPENAI_VECTOR_SIZE) {
          throw new Error(
            `Vector size mismatch: expected ${OPENAI_VECTOR_SIZE}, got ${embedding.length}`
          );
        }

        return embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (
          lastError.message.includes('401') || // Authentication error
          lastError.message.includes('Invalid') // Invalid format
        ) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(
            `[EmbeddingService] OpenAI attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('OpenAI embedding failed after all retries');
  }

  /**
   * Generate embedding using BGE-M3 API (placeholder)
   * 
   * @param text - Text to embed
   * @returns Embedding vector
   * @throws Error - Not yet implemented
   */
  private async embedWithBGE(): Promise<number[]> {
    // TODO: Implement BGE-M3 embedding when API is available
    throw new Error(
      'BGE-M3 embedding is not yet implemented. Please use OpenAI or NVIDIA provider.'
    );
  }

  /**
   * Generate embedding using NVIDIA API with retry logic
   * 
   * @param text - Text to embed
   * @returns Embedding vector (1024 dimensions)
   * @throws Error if all retries fail
   */
  private async embedWithNVIDIA(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key is not configured');
    }

    const baseUrl = this.baseUrl || 'https://integrate.api.nvidia.com/v1';
    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
            input_type: 'query', // Required for asymmetric models
            encoding_format: 'float',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(
            `NVIDIA API failed with status ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid NVIDIA response format: missing embedding data');
        }

        if (embedding.length !== NVIDIA_VECTOR_SIZE) {
          throw new Error(
            `Vector size mismatch: expected ${NVIDIA_VECTOR_SIZE}, got ${embedding.length}`
          );
        }

        return embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (
          lastError.message.includes('401') || // Authentication error
          lastError.message.includes('Invalid') // Invalid format
        ) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(
            `[EmbeddingService] NVIDIA attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('NVIDIA embedding failed after all retries');
  }

  /**
   * Generate fallback hash-based embedding
   * 
   * This provides a deterministic embedding when API is unavailable.
   * Uses multiple hash functions to distribute tokens across the vector space.
   * 
   * @param text - Text to embed
   * @returns Normalized embedding vector
   */
  private generateFallbackEmbedding(text: string): number[] {
    const normalizedText = text.trim();
    const vectorSize = this.getVectorSize();
    const vector = new Array<number>(vectorSize).fill(0);

    // Tokenize text (split on whitespace and punctuation)
    const tokens = normalizedText
      .split(/[\s,.;!?，。！？、\n]+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return vector;
    }

    // Hash each token and its character n-grams to multiple positions in the
    // vector. This keeps the fallback deterministic while producing a denser,
    // more discriminative representation for Chinese and mixed-language text.
    for (const token of tokens) {
      let rollingHash = 2166136261 ^ token.length;

      for (let index = 0; index < token.length; index += 1) {
        const charCode = token.charCodeAt(index);
        const charWeight = ((charCode % 31) + 1) / 31;
        rollingHash = Math.imul(rollingHash ^ charCode, 16777619);

        const primaryIndex =
          Math.abs(rollingHash + (index + 1) * 17) % vectorSize;
        const secondaryIndex =
          Math.abs((rollingHash ^ (charCode << 5) ^ index) + 97) % vectorSize;

        vector[primaryIndex] += charWeight * (1 + index / Math.max(token.length, 1));
        vector[secondaryIndex] += (1 - charWeight / 2) * 0.65;

        if (index < token.length - 1) {
          const nextCode = token.charCodeAt(index + 1);
          const bigramWeight =
            0.35 + (((charCode + nextCode) % 19) + 1) / 40;
          const tertiaryIndex =
            Math.abs(Math.imul((charCode << 16) ^ nextCode ^ (index + 193), 16777619)) %
            vectorSize;
          vector[tertiaryIndex] += bigramWeight;
        }
      }
    }

    return this.normalizeVector(vector);
  }

  /**
   * Normalize a vector to unit length
   * 
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0)
    );

    if (!magnitude) {
      return vector;
    }

    return vector.map((value) => value / magnitude);
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Record performance metric
   * 
   * @param metric - Metric to record
   */
  private recordMetric(metric: EmbeddingMetrics): void {
    this.metrics.push(metric);
    memoryMetrics.record('embedding.duration', metric.duration);
    void memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "embedding.request",
      user_id: "system",
      duration: metric.duration,
      success: metric.success,
      error_message: metric.error ?? null,
      metadata: {
        provider: metric.provider,
        model: this.model,
        text_length: metric.textLength,
      },
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 5000) {
      console.warn(
        `[EmbeddingService] Slow embedding operation: ${metric.duration}ms for ${metric.textLength} chars using ${metric.provider}`
      );
    }
  }

  /**
   * Get performance metrics summary
   * 
   * @returns Metrics summary
   */
  getMetrics(): {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    byProvider: Record<string, { count: number; successRate: number }>;
  } {
    if (this.metrics.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        byProvider: {},
      };
    }

    const successful = this.metrics.filter((m) => m.success).length;
    const failed = this.metrics.length - successful;
    const avgDuration =
      this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;

    const byProvider: Record<string, { count: number; successRate: number }> = {};

    for (const metric of this.metrics) {
      if (!byProvider[metric.provider]) {
        byProvider[metric.provider] = { count: 0, successRate: 0 };
      }
      byProvider[metric.provider].count++;
    }

    for (const provider in byProvider) {
      const providerMetrics = this.metrics.filter((m) => m.provider === provider);
      const providerSuccessful = providerMetrics.filter((m) => m.success).length;
      byProvider[provider].successRate = providerSuccessful / providerMetrics.length;
    }

    return {
      total: this.metrics.length,
      successful,
      failed,
      avgDuration,
      byProvider,
    };
  }
}
