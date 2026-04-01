/**
 * Reranker Service
 * 
 * Provides document reranking functionality with multiple provider support,
 * fallback mechanisms, retry logic, and performance tracking.
 * 
 * Supports:
 * - Jina Reranker v2 (multilingual, good for Chinese + English)
 * - Cohere Rerank (placeholder for future implementation)
 * - None (returns original order)
 */

import type { RerankerServiceConfig } from '../config';
import { memoryMetrics } from '../metrics';
import { memoryLogger } from '../memory-logger';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT_MS = Number(process.env.RERANKER_REQUEST_TIMEOUT_MS || 8000);

/**
 * Rerank result with relevance score
 */
export type RerankResult = {
  index: number;        // Original index in input array
  document: string;     // The document text
  relevanceScore: number; // Score from 0-1 (higher = more relevant)
};

/**
 * Continuation metadata for enhanced reranking
 */
export type ContinuationMetadata = {
  hasContinuationCue: boolean;
  queryAnchors: string[];
  profileAnchors: string[];
};

/**
 * Performance metrics for reranking operations
 */
type RerankerMetrics = {
  provider: string;
  documentCount: number;
  duration: number;
  success: boolean;
  error?: string;
};

type JinaRerankRequest = {
  model: string;
  query: string;
  documents: string[];
  metadata?: {
    continuation_cue: boolean;
    query_anchors: string[];
    profile_anchors: string[];
  };
};

type JinaRerankApiResult = {
  index: number;
  relevance_score: number;
};

type JinaRerankResponse = {
  results?: JinaRerankApiResult[];
};

/**
 * Reranker service for improving search result relevance
 */
export class RerankerService {
  private provider: 'jina' | 'cohere' | 'none';
  private apiKey: string;
  private metrics: RerankerMetrics[] = [];

  constructor(config: RerankerServiceConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
  }

  /**
   * Rerank documents by relevance to query
   * 
   * @param query - Search query
   * @param documents - Documents to rerank
   * @param metadata - Optional continuation metadata for enhanced reranking
   * @returns Reranked results with relevance scores
   */
  async rerank(
    query: string,
    documents: string[],
    metadata?: ContinuationMetadata
  ): Promise<RerankResult[]> {
    const startTime = Date.now();

    // Handle empty inputs
    if (!query.trim() || documents.length === 0) {
      return this.createDefaultResults(documents);
    }

    // If provider is 'none', return original order
    if (this.provider === 'none') {
      this.recordMetric({
        provider: 'none',
        documentCount: documents.length,
        duration: Date.now() - startTime,
        success: true,
      });
      return this.createDefaultResults(documents);
    }

    try {
      let results: RerankResult[];

      if (this.provider === 'jina') {
        results = await this.rerankWithJina(query, documents, metadata);
      } else if (this.provider === 'cohere') {
        results = await this.rerankWithCohere(query, documents, metadata);
      } else {
        throw new Error(`Unsupported reranker provider: ${this.provider}`);
      }

      // Record success metrics
      this.recordMetric({
        provider: this.provider,
        documentCount: documents.length,
        duration: Date.now() - startTime,
        success: true,
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(
        `[RerankerService] ${this.provider} reranking failed: ${errorMessage}. Using original order.`
      );

      // Record failure metrics
      this.recordMetric({
        provider: this.provider,
        documentCount: documents.length,
        duration: Date.now() - startTime,
        success: false,
        error: errorMessage,
      });

      // Fallback to original order with default scores
      return this.createDefaultResults(documents);
    }
  }

  /**
   * Rerank documents using Jina Reranker API with retry logic
   * 
   * @param query - Search query
   * @param documents - Documents to rerank
   * @param metadata - Optional continuation metadata for enhanced reranking
   * @returns Reranked results
   * @throws Error if all retries fail
   */
  private async rerankWithJina(
    query: string,
    documents: string[],
    metadata?: ContinuationMetadata
  ): Promise<RerankResult[]> {
    if (!this.apiKey) {
      throw new Error('Jina API key is not configured');
    }

    let lastError: Error | null = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Build request body with optional metadata
        const requestBody: JinaRerankRequest = {
          model: 'jina-reranker-v2-base-multilingual',
          query,
          documents,
        };

        // Add continuation metadata if provided
        // Note: Jina API may not directly support these fields,
        // but we include them for potential future use or custom processing
        if (metadata?.hasContinuationCue) {
          requestBody.metadata = {
            continuation_cue: true,
            query_anchors: metadata.queryAnchors,
            profile_anchors: metadata.profileAnchors,
          };
        }

        const response = await fetch('https://api.jina.ai/v1/rerank', {
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(
            `Jina API failed with status ${response.status}: ${errorText}`
          );
        }

        const data = (await response.json()) as JinaRerankResponse;
        const results = data.results;

        if (!results || !Array.isArray(results)) {
          throw new Error('Invalid Jina response format: missing results array');
        }

        // Map Jina results to RerankResult format
        return results.map((result) => ({
          index: result.index,
          document: documents[result.index],
          relevanceScore: result.relevance_score,
        }));
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
            `[RerankerService] Jina attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Jina reranking failed after all retries');
  }

  /**
   * Rerank documents using Cohere Rerank API (placeholder)
   * 
   * @param query - Search query
   * @param documents - Documents to rerank
   * @param metadata - Optional continuation metadata for enhanced reranking
   * @returns Reranked results
   * @throws Error - Not yet implemented
   */
  private async rerankWithCohere(
    _query: string,
    _documents: string[],
    _metadata?: ContinuationMetadata
  ): Promise<RerankResult[]> {
    void _query;
    void _documents;
    void _metadata;

    // TODO: Implement Cohere reranking when needed
    throw new Error(
      'Cohere reranking is not yet implemented. Please use Jina provider or set provider to "none".'
    );
  }

  /**
   * Create default results with descending scores (1.0, 0.9, 0.8, ...)
   * 
   * @param documents - Documents in original order
   * @returns Results with default scores
   */
  private createDefaultResults(documents: string[]): RerankResult[] {
    return documents.map((document, index) => ({
      index,
      document,
      relevanceScore: Math.max(0, 1.0 - index * 0.1),
    }));
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
  private recordMetric(metric: RerankerMetrics): void {
    this.metrics.push(metric);
    memoryMetrics.record('reranker.duration', metric.duration);
    void memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "reranker.request",
      user_id: "system",
      duration: metric.duration,
      success: metric.success,
      error_message: metric.error ?? null,
      metadata: {
        provider: metric.provider,
        document_count: metric.documentCount,
      },
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 3000) {
      console.warn(
        `[RerankerService] Slow reranking operation: ${metric.duration}ms for ${metric.documentCount} documents using ${metric.provider}`
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
