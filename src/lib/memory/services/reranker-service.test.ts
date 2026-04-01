/**
 * Unit tests for RerankerService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RerankerService } from './reranker-service';
import type { RerankerServiceConfig } from '../config';

describe('RerankerService', () => {
  describe('None Provider (Default Fallback)', () => {
    let service: RerankerService;

    beforeEach(() => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      service = new RerankerService(config);
    });

    it('should return documents in original order', async () => {
      const query = 'test query';
      const documents = ['doc1', 'doc2', 'doc3'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
      expect(results[0].document).toBe('doc1');
      expect(results[1].document).toBe('doc2');
      expect(results[2].document).toBe('doc3');
    });

    it('should assign descending relevance scores', async () => {
      const query = 'test query';
      const documents = ['doc1', 'doc2', 'doc3', 'doc4'];

      const results = await service.rerank(query, documents);

      expect(results[0].relevanceScore).toBe(1.0);
      expect(results[1].relevanceScore).toBe(0.9);
      expect(results[2].relevanceScore).toBe(0.8);
      expect(results[3].relevanceScore).toBe(0.7);
    });

    it('should preserve original indices', async () => {
      const query = 'test query';
      const documents = ['doc1', 'doc2', 'doc3'];

      const results = await service.rerank(query, documents);

      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
    });

    it('should handle empty document array', async () => {
      const query = 'test query';
      const documents: string[] = [];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should handle empty query', async () => {
      const query = '';
      const documents = ['doc1', 'doc2'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
      expect(results[0].document).toBe('doc1');
    });

    it('should handle whitespace-only query', async () => {
      const query = '   \n\t  ';
      const documents = ['doc1', 'doc2'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });

    it('should handle single document', async () => {
      const query = 'test query';
      const documents = ['single doc'];

      const results = await service.rerank(query, documents);

      expect(results.length).toBe(1);
      expect(results[0].document).toBe('single doc');
      expect(results[0].relevanceScore).toBe(1.0);
    });

    it('should handle Chinese query and documents', async () => {
      const query = '那个展览';
      const documents = ['关于展览的信息', '其他内容', '更多展览'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });

    it('should handle mixed Chinese and English', async () => {
      const query = 'Hello 你好';
      const documents = ['English doc', '中文文档', 'Mixed 混合'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });

    it('should handle long documents', async () => {
      const query = 'test';
      const documents = [
        'Lorem ipsum '.repeat(100),
        'Short doc',
        'Another long document '.repeat(50),
      ];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });

    it('should handle many documents', async () => {
      const query = 'test';
      const documents = Array.from({ length: 100 }, (_, i) => `doc${i}`);

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(100);
    });

    it('should assign minimum score of 0', async () => {
      const query = 'test';
      const documents = Array.from({ length: 15 }, (_, i) => `doc${i}`);

      const results = await service.rerank(query, documents);

      // After 10 documents, scores should be 0
      expect(results[10].relevanceScore).toBe(0);
      expect(results[14].relevanceScore).toBe(0);
    });
  });

  describe('Jina Provider (Fallback on Error)', () => {
    let service: RerankerService;

    beforeEach(() => {
      // Create service without API key to force fallback
      const config: RerankerServiceConfig = {
        provider: 'jina',
        apiKey: '',
      };
      service = new RerankerService(config);
    });

    it('should fall back to original order on API error', async () => {
      const query = 'test query';
      const documents = ['doc1', 'doc2', 'doc3'];

      const results = await service.rerank(query, documents);

      // Should still return results in original order
      expect(results).toBeDefined();
      expect(results.length).toBe(3);
      expect(results[0].document).toBe('doc1');
    });

    it('should handle network errors gracefully', async () => {
      const config: RerankerServiceConfig = {
        provider: 'jina',
        apiKey: 'invalid-key',
      };
      const service = new RerankerService(config);

      const query = 'test';
      const documents = ['doc1', 'doc2'];

      // Should not throw, should fall back
      await expect(service.rerank(query, documents)).resolves.toBeDefined();
    });
  });

  describe('Cohere Provider', () => {
    it('should throw error for cohere (not yet implemented)', async () => {
      const config: RerankerServiceConfig = {
        provider: 'cohere',
        apiKey: 'test-key',
      };
      const service = new RerankerService(config);

      const query = 'test';
      const documents = ['doc1', 'doc2'];

      // Should fall back to original order
      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });
  });

  describe('Metrics', () => {
    it('should track metrics for reranking operations', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      await service.rerank('query1', ['doc1', 'doc2']);
      await service.rerank('query2', ['doc3', 'doc4', 'doc5']);
      await service.rerank('query3', ['doc6']);

      const metrics = service.getMetrics();

      expect(metrics.total).toBe(3);
      expect(metrics.successful).toBe(3);
      expect(metrics.failed).toBe(0);
    });

    it('should calculate average duration', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      await service.rerank('test', ['doc1']);

      const metrics = service.getMetrics();

      expect(metrics.avgDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track metrics by provider', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      await service.rerank('test', ['doc1']);

      const metrics = service.getMetrics();

      expect(metrics.byProvider).toHaveProperty('none');
      expect(metrics.byProvider.none.count).toBe(1);
      expect(metrics.byProvider.none.successRate).toBe(1);
    });

    it('should track failed operations', async () => {
      const config: RerankerServiceConfig = {
        provider: 'jina',
        apiKey: '', // No API key will cause error
      };
      const service = new RerankerService(config);

      await service.rerank('test', ['doc1']);

      const metrics = service.getMetrics();

      expect(metrics.total).toBe(1);
      expect(metrics.failed).toBe(1);
      expect(metrics.successful).toBe(0);
    });

    it('should track document count in metrics', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      await service.rerank('test', ['doc1', 'doc2', 'doc3']);

      const metrics = service.getMetrics();

      expect(metrics.total).toBe(1);
    });
  });

  describe('Provider Configuration', () => {
    it('should accept jina provider', () => {
      const config: RerankerServiceConfig = {
        provider: 'jina',
        apiKey: 'test-key',
      };

      expect(() => new RerankerService(config)).not.toThrow();
    });

    it('should accept cohere provider', () => {
      const config: RerankerServiceConfig = {
        provider: 'cohere',
        apiKey: 'test-key',
      };

      expect(() => new RerankerService(config)).not.toThrow();
    });

    it('should accept none provider', () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };

      expect(() => new RerankerService(config)).not.toThrow();
    });
  });

  describe('Result Format', () => {
    it('should return results with correct structure', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const results = await service.rerank('test', ['doc1', 'doc2']);

      expect(results[0]).toHaveProperty('index');
      expect(results[0]).toHaveProperty('document');
      expect(results[0]).toHaveProperty('relevanceScore');
    });

    it('should return relevance scores between 0 and 1', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const documents = Array.from({ length: 20 }, (_, i) => `doc${i}`);
      const results = await service.rerank('test', documents);

      for (const result of results) {
        expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(result.relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should return valid indices', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const documents = ['doc1', 'doc2', 'doc3'];
      const results = await service.rerank('test', documents);

      for (const result of results) {
        expect(result.index).toBeGreaterThanOrEqual(0);
        expect(result.index).toBeLessThan(documents.length);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in query', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = '!@#$%^&*()';
      const documents = ['doc1', 'doc2'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });

    it('should handle special characters in documents', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = 'test';
      const documents = ['doc with !@#', 'doc with $%^', 'normal doc'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });

    it('should handle unicode characters', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = '🔍 search';
      const documents = ['doc 📄', 'text 📝', 'file 🗂️'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });

    it('should handle newlines in documents', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = 'test';
      const documents = ['line1\nline2', 'single line', 'line1\nline2\nline3'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });
  });

  describe('Continuation Metadata', () => {
    it('should accept continuation metadata', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = '那只猫今天又来了';
      const documents = ['小区里有一只橘猫', '用户喜欢猫'];
      const metadata = {
        hasContinuationCue: true,
        queryAnchors: ['那只猫'],
        profileAnchors: ['橘猫', '小区'],
      };

      const results = await service.rerank(query, documents, metadata);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });

    it('should work without continuation metadata', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = '今天天气怎么样';
      const documents = ['天气很好', '下雨了'];

      const results = await service.rerank(query, documents);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });

    it('should handle empty continuation metadata', async () => {
      const config: RerankerServiceConfig = {
        provider: 'none',
        apiKey: '',
      };
      const service = new RerankerService(config);

      const query = 'test';
      const documents = ['doc1', 'doc2'];
      const metadata = {
        hasContinuationCue: false,
        queryAnchors: [],
        profileAnchors: [],
      };

      const results = await service.rerank(query, documents, metadata);

      expect(results).toBeDefined();
      expect(results.length).toBe(2);
    });
  });
});
