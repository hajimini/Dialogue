/**
 * Unit tests for configuration management
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getMemoryGatewayConfig,
  validateMemoryGatewayConfig,
  getConfigSummary,
  ConfigurationError,
  type MemoryProvider,
  type EmbeddingProvider,
  type RerankerProvider,
} from './config';

describe('Memory Configuration', () => {
  // Store original env vars
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Reset to original env before each test
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });
  
  describe('getMemoryGatewayConfig', () => {
    it('should return default configuration with minimal env vars', () => {
      const testEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      };
      Object.assign(process.env, testEnv);

      const config = getMemoryGatewayConfig();

      expect(config.provider).toBe('mem0');
      expect(config.mem0.supabaseUrl).toBe('https://test.supabase.co');
      expect(config.mem0.supabaseKey).toBe('test-anon-key');
      expect(config.mem0.embeddingConfig.provider).toBe('openai');
      expect(config.mem0.embeddingConfig.model).toBe('text-embedding-3-large');
      expect(config.mem0.rerankerConfig.provider).toBe('jina');
      expect(config.mem0.retrievalLimit).toBe(5);
    });
    
    it('should use MEMORY_PROVIDER when set', () => {
      process.env.MEMORY_PROVIDER = 'letta';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.provider).toBe('letta');
    });
    
    it('should throw error for invalid MEMORY_PROVIDER', () => {
      process.env.MEMORY_PROVIDER = 'invalid' as MemoryProvider;
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/Invalid MEMORY_PROVIDER/);
    });
    
    it('should throw error when SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/SUPABASE_URL/);
    });
    
    it('should throw error when SUPABASE_KEY is missing', () => {
      const testEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: undefined,
        SUPABASE_ANON_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      };
      Object.assign(process.env, testEnv);

      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/SUPABASE_SERVICE_KEY/);
    });
    
    it('should prefer SUPABASE_SERVICE_KEY over ANON_KEY', () => {
      const testEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'service-key',
        SUPABASE_ANON_KEY: 'anon-key',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      };
      Object.assign(process.env, testEnv);

      const config = getMemoryGatewayConfig();

      expect(config.mem0.supabaseKey).toBe('service-key');
    });
    
    it('should use NEXT_PUBLIC_SUPABASE_URL as fallback', () => {
      delete process.env.SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.supabaseUrl).toBe('https://public.supabase.co');
    });
    
    it('should configure embedding provider correctly', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.EMBEDDING_PROVIDER = 'bge-m3';
      process.env.EMBEDDING_API_KEY = 'embedding-key';
      process.env.EMBEDDING_MODEL = 'custom-model';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.embeddingConfig.provider).toBe('bge-m3');
      expect(config.mem0.embeddingConfig.apiKey).toBe('embedding-key');
      expect(config.mem0.embeddingConfig.model).toBe('custom-model');
    });
    
    it('should throw error for invalid EMBEDDING_PROVIDER', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.EMBEDDING_PROVIDER = 'invalid' as EmbeddingProvider;
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/Invalid EMBEDDING_PROVIDER/);
    });
    
    it('should prefer EMBEDDING_API_KEY over OPENAI_API_KEY', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.EMBEDDING_API_KEY = 'embedding-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.embeddingConfig.apiKey).toBe('embedding-key');
    });
    
    it('should configure reranker provider correctly', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.RERANKER_PROVIDER = 'cohere';
      process.env.RERANKER_API_KEY = 'reranker-key';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.rerankerConfig.provider).toBe('cohere');
      expect(config.mem0.rerankerConfig.apiKey).toBe('reranker-key');
    });
    
    it('should allow reranker provider to be "none"', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.RERANKER_PROVIDER = 'none';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.rerankerConfig.provider).toBe('none');
    });
    
    it('should throw error for invalid RERANKER_PROVIDER', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.RERANKER_PROVIDER = 'invalid' as RerankerProvider;
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/Invalid RERANKER_PROVIDER/);
    });
    
    it('should parse MEMORY_RETRIEVAL_LIMIT correctly', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEMORY_RETRIEVAL_LIMIT = '10';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.retrievalLimit).toBe(10);
    });
    
    it('should throw error for invalid MEMORY_RETRIEVAL_LIMIT', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEMORY_RETRIEVAL_LIMIT = 'invalid';
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/Invalid MEMORY_RETRIEVAL_LIMIT/);
    });
    
    it('should throw error for negative MEMORY_RETRIEVAL_LIMIT', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEMORY_RETRIEVAL_LIMIT = '-1';
      
      expect(() => getMemoryGatewayConfig()).toThrow(ConfigurationError);
      expect(() => getMemoryGatewayConfig()).toThrow(/Invalid MEMORY_RETRIEVAL_LIMIT/);
    });
    
    it('should include MEM0_API_KEY when set', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEM0_API_KEY = 'mem0-key';
      
      const config = getMemoryGatewayConfig();
      
      expect(config.mem0.apiKey).toBe('mem0-key');
    });
  });
  
  describe('validateMemoryGatewayConfig', () => {
    it('should return valid for correct configuration', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEM0_API_KEY = 'mem0-key';
      process.env.EMBEDDING_API_KEY = 'embedding-key';
      process.env.RERANKER_API_KEY = 'reranker-key';
      
      const result = validateMemoryGatewayConfig();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should return warnings for missing optional keys', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      
      const result = validateMemoryGatewayConfig();
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('MEM0_API_KEY'))).toBe(true);
      expect(result.warnings.some(w => w.includes('EMBEDDING_API_KEY'))).toBe(true);
    });
    
    it('should return invalid for missing required keys', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      const result = validateMemoryGatewayConfig();
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should warn when reranker is enabled but key is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.RERANKER_PROVIDER = 'jina';
      delete process.env.RERANKER_API_KEY;
      
      const result = validateMemoryGatewayConfig();
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('RERANKER_API_KEY'))).toBe(true);
    });
  });
  
  describe('getConfigSummary', () => {
    it('should return readable summary for valid config', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      process.env.MEM0_API_KEY = 'mem0-key';
      process.env.EMBEDDING_PROVIDER = 'openai';
      process.env.RERANKER_PROVIDER = 'jina';
      
      const summary = getConfigSummary();
      
      expect(summary).toContain('Memory Provider: mem0');
      expect(summary).toContain('Embedding Provider: openai');
      expect(summary).toContain('Reranker Provider: jina');
      expect(summary).toContain('✓ Set');
      expect(summary).not.toContain('mem0-key'); // Should not expose actual keys
    });
    
    it('should return error message for invalid config', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      const summary = getConfigSummary();
      
      expect(summary).toContain('Configuration Error');
    });
    
    it('should show "Not set" for missing optional keys', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-key';
      delete process.env.MEM0_API_KEY;
      
      const summary = getConfigSummary();
      
      expect(summary).toContain('✗ Not set');
    });
  });
});
