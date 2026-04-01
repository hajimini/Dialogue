/**
 * Unit tests for EmbeddingService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EmbeddingService } from './embedding-service';
import type { EmbeddingServiceConfig } from '../config';

describe('EmbeddingService', () => {
  describe('Fallback Embedding', () => {
    let service: EmbeddingService;

    beforeEach(() => {
      // Create service without API key to force fallback
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: '',
        model: 'text-embedding-3-large',
      };
      service = new EmbeddingService(config);
    });

    it('should generate embedding for non-empty text', async () => {
      const text = 'Hello world';
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('should return zero vector for empty text', async () => {
      const embedding = await service.embed('');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
      expect(embedding.every((v) => v === 0)).toBe(true);
    });

    it('should return zero vector for whitespace-only text', async () => {
      const embedding = await service.embed('   \n\t  ');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
      expect(embedding.every((v) => v === 0)).toBe(true);
    });

    it('should generate normalized vectors', async () => {
      const text = 'This is a test';
      const embedding = await service.embed(text);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );

      // Normalized vector should have magnitude close to 1
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should generate deterministic embeddings', async () => {
      const text = 'Consistent text';
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'First text';
      const text2 = 'Second text';

      const embedding1 = await service.embed(text1);
      const embedding2 = await service.embed(text2);

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should handle Chinese text', async () => {
      const text = '你好世界';
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);

      // Should not be all zeros
      const hasNonZero = embedding.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should handle mixed Chinese and English text', async () => {
      const text = 'Hello 你好 World 世界';
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);

      const hasNonZero = embedding.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should handle text with punctuation', async () => {
      const text = 'Hello, world! How are you?';
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);

      const hasNonZero = embedding.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should handle long text', async () => {
      const text = 'Lorem ipsum '.repeat(100);
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });
  });

  describe('Metrics', () => {
    it('should track metrics for embedding operations', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: '',
        model: 'text-embedding-3-large',
      };
      const service = new EmbeddingService(config);

      await service.embed('Test 1');
      await service.embed('Test 2');
      await service.embed('Test 3');

      const metrics = service.getMetrics();

      expect(metrics.total).toBe(3);
      expect(metrics.failed).toBe(3); // All should fail without API key
      expect(metrics.successful).toBe(0);
    });

    it('should calculate average duration', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: '',
        model: 'text-embedding-3-large',
      };
      const service = new EmbeddingService(config);

      await service.embed('Test');

      const metrics = service.getMetrics();

      expect(metrics.avgDuration).toBeGreaterThan(0);
    });

    it('should track metrics by provider', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: '',
        model: 'text-embedding-3-large',
      };
      const service = new EmbeddingService(config);

      await service.embed('Test');

      const metrics = service.getMetrics();

      expect(metrics.byProvider).toHaveProperty('openai');
      expect(metrics.byProvider.openai.count).toBe(1);
    });
  });

  describe('Provider Configuration', () => {
    it('should accept openai provider', () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'text-embedding-3-large',
      };

      expect(() => new EmbeddingService(config)).not.toThrow();
    });

    it('should accept bge-m3 provider', () => {
      const config: EmbeddingServiceConfig = {
        provider: 'bge-m3',
        apiKey: 'test-key',
        model: 'BAAI/bge-m3',
      };

      expect(() => new EmbeddingService(config)).not.toThrow();
    });

    it('should fall back to a 1024-dim vector for bge-m3 until the provider is implemented', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'bge-m3',
        apiKey: 'test-key',
        model: 'BAAI/bge-m3',
      };
      const service = new EmbeddingService(config);

      // Should fall back to hash-based embedding
      const embedding = await service.embed('Test');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1024);
    });
  });

  describe('Error Handling', () => {
    it('should fall back to hash-based embedding on API error', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: '', // No API key will cause error
        model: 'text-embedding-3-large',
      };
      const service = new EmbeddingService(config);

      const embedding = await service.embed('Test text');

      // Should still return valid embedding
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });

    it('should handle network errors gracefully', async () => {
      const config: EmbeddingServiceConfig = {
        provider: 'openai',
        apiKey: 'invalid-key',
        model: 'text-embedding-3-large',
      };
      const service = new EmbeddingService(config);

      // Should not throw, should fall back
      await expect(service.embed('Test')).resolves.toBeDefined();
    });
  });
});
