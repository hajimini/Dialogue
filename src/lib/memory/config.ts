/**
 * Configuration Management for Memory Gateway
 * 
 * Reads and validates environment variables for memory provider selection,
 * embedding configuration, reranker configuration, and Supabase connection.
 */

/**
 * Memory provider type
 */
export type MemoryProvider = 'mem0' | 'letta';

/**
 * Embedding provider type
 */
export type EmbeddingProvider = 'openai' | 'nvidia' | 'bge-m3';

/**
 * Reranker provider type
 */
export type RerankerProvider = 'jina' | 'cohere' | 'none';

/**
 * Relationship stage type
 */
export type RelationshipStage = 'new' | 'warming' | 'close';

/**
 * Embedding service configuration
 */
export type EmbeddingServiceConfig = {
  provider: EmbeddingProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // Optional base URL for custom endpoints
};

/**
 * Reranker service configuration
 */
export type RerankerServiceConfig = {
  provider: RerankerProvider;
  apiKey: string;
};

/**
 * Mem0 adapter configuration
 */
export type Mem0AdapterConfig = {
  apiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  embeddingConfig: EmbeddingServiceConfig;
  rerankerConfig: RerankerServiceConfig;
  retrievalLimit: number;
};

/**
 * Memory gateway configuration
 */
export type MemoryGatewayConfig = {
  provider: MemoryProvider;
  mem0: Mem0AdapterConfig;
};

export type RuntimeMemoryConfigOverrides = Partial<{
  MEMORY_PROVIDER: MemoryProvider;
  EMBEDDING_PROVIDER: EmbeddingProvider;
  EMBEDDING_MODEL: string;
  RERANKER_PROVIDER: RerankerProvider;
  MEMORY_RETRIEVAL_LIMIT: string;
  MEMORY_CONTEXT_CACHE_ENABLED: string;
}>;

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

let runtimeOverrides: RuntimeMemoryConfigOverrides = {};

function readValue<K extends keyof RuntimeMemoryConfigOverrides>(
  key: K,
): RuntimeMemoryConfigOverrides[K] | string | undefined {
  return runtimeOverrides[key] ?? process.env[key];
}

export function getMemoryRuntimeConfigOverrides(): RuntimeMemoryConfigOverrides {
  return { ...runtimeOverrides };
}

export function setMemoryRuntimeConfigOverrides(
  overrides: RuntimeMemoryConfigOverrides,
): RuntimeMemoryConfigOverrides {
  runtimeOverrides = {
    ...runtimeOverrides,
    ...overrides,
  };

  return getMemoryRuntimeConfigOverrides();
}

export function clearMemoryRuntimeConfigOverrides() {
  runtimeOverrides = {};
}

export function isMemoryContextCacheEnabled() {
  const value = String(readValue("MEMORY_CONTEXT_CACHE_ENABLED") ?? "true").trim();
  return value !== "false" && value !== "0" && value.toLowerCase() !== "off";
}

/**
 * Get memory gateway configuration from environment variables
 * 
 * @throws {ConfigurationError} If required environment variables are missing
 * @returns {MemoryGatewayConfig} Validated configuration object
 */
export function getMemoryGatewayConfig(): MemoryGatewayConfig {
  // Memory provider (default: 'mem0')
  const provider = (readValue("MEMORY_PROVIDER") as MemoryProvider) ?? 'mem0';
  
  // Validate provider
  if (provider !== 'mem0' && provider !== 'letta') {
    throw new ConfigurationError(
      `Invalid MEMORY_PROVIDER: ${provider}. Must be 'mem0' or 'letta'.`
    );
  }
  
  // Supabase configuration
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ?? 
    process.env.SUPABASE_ANON_KEY ?? 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 
    '';
  
  if (!supabaseUrl) {
    throw new ConfigurationError(
      'Missing required environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL'
    );
  }
  
  if (!supabaseKey) {
    throw new ConfigurationError(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY'
    );
  }
  
  // Mem0 API key (optional for now, but will be required when using Mem0)
  const mem0ApiKey = process.env.MEM0_API_KEY ?? '';
  
  // Embedding configuration
  const embeddingProvider = (readValue("EMBEDDING_PROVIDER") as EmbeddingProvider) ?? 'openai';
  
  // Validate embedding provider
  if (embeddingProvider !== 'openai' && embeddingProvider !== 'nvidia' && embeddingProvider !== 'bge-m3') {
    throw new ConfigurationError(
      `Invalid EMBEDDING_PROVIDER: ${embeddingProvider}. Must be 'openai', 'nvidia', or 'bge-m3'.`
    );
  }
  
  const embeddingApiKey = 
    process.env.EMBEDDING_API_KEY ?? 
    process.env.NVIDIA_API_KEY ??
    process.env.OPENAI_API_KEY ?? 
    '';
  
  const embeddingModel = String(readValue("EMBEDDING_MODEL") ?? 'text-embedding-3-large');
  const embeddingBaseUrl = process.env.NVIDIA_BASE_URL ?? process.env.EMBEDDING_BASE_URL;
  
  // Reranker configuration
  const rerankerProvider = (readValue("RERANKER_PROVIDER") as RerankerProvider) ?? 'jina';
  
  // Validate reranker provider
  if (rerankerProvider !== 'jina' && rerankerProvider !== 'cohere' && rerankerProvider !== 'none') {
    throw new ConfigurationError(
      `Invalid RERANKER_PROVIDER: ${rerankerProvider}. Must be 'jina', 'cohere', or 'none'.`
    );
  }
  
  const rerankerApiKey = process.env.RERANKER_API_KEY ?? '';
  
  // Memory retrieval limit (default: 5)
  const retrievalLimitStr = String(readValue("MEMORY_RETRIEVAL_LIMIT") ?? '5');
  const retrievalLimit = parseInt(retrievalLimitStr, 10);
  
  if (isNaN(retrievalLimit) || retrievalLimit < 1) {
    throw new ConfigurationError(
      `Invalid MEMORY_RETRIEVAL_LIMIT: ${retrievalLimitStr}. Must be a positive integer.`
    );
  }
  
  return {
    provider,
    mem0: {
      apiKey: mem0ApiKey,
      supabaseUrl,
      supabaseKey,
      embeddingConfig: {
        provider: embeddingProvider,
        apiKey: embeddingApiKey,
        model: embeddingModel,
        baseUrl: embeddingBaseUrl,
      },
      rerankerConfig: {
        provider: rerankerProvider,
        apiKey: rerankerApiKey,
      },
      retrievalLimit,
    },
  };
}

export function getCurrentMemoryConfigSnapshot() {
  const gatewayConfig = getMemoryGatewayConfig();

  return {
    MEMORY_PROVIDER: gatewayConfig.provider,
    EMBEDDING_PROVIDER: gatewayConfig.mem0.embeddingConfig.provider,
    EMBEDDING_MODEL: gatewayConfig.mem0.embeddingConfig.model,
    RERANKER_PROVIDER: gatewayConfig.mem0.rerankerConfig.provider,
    MEMORY_RETRIEVAL_LIMIT: String(gatewayConfig.mem0.retrievalLimit),
    MEMORY_CONTEXT_CACHE_ENABLED: String(isMemoryContextCacheEnabled()),
  };
}

/**
 * Validate configuration without throwing errors
 * 
 * @returns {Object} Validation result with isValid flag and error messages
 */
export function validateMemoryGatewayConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const config = getMemoryGatewayConfig();
    
    // Check for optional but recommended configurations
    if (!config.mem0.apiKey) {
      warnings.push('MEM0_API_KEY is not set. Mem0 features will be limited.');
    }
    
    if (!config.mem0.embeddingConfig.apiKey) {
      warnings.push(
        'EMBEDDING_API_KEY is not set. Falling back to hash-based embeddings.'
      );
    }
    
    if (config.mem0.rerankerConfig.provider !== 'none' && !config.mem0.rerankerConfig.apiKey) {
      warnings.push(
        `RERANKER_API_KEY is not set but RERANKER_PROVIDER is '${config.mem0.rerankerConfig.provider}'. Reranking will be disabled.`
      );
    }
    
    return {
      isValid: true,
      errors,
      warnings,
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      errors.push(error.message);
    } else {
      errors.push(`Unexpected configuration error: ${error}`);
    }
    
    return {
      isValid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Get a human-readable configuration summary
 * 
 * @returns {string} Configuration summary (safe for logging, no sensitive data)
 */
export function getConfigSummary(): string {
  try {
    const config = getMemoryGatewayConfig();
    
    return [
      `Memory Provider: ${config.provider}`,
      `Embedding Provider: ${config.mem0.embeddingConfig.provider}`,
      `Embedding Model: ${config.mem0.embeddingConfig.model}`,
      `Reranker Provider: ${config.mem0.rerankerConfig.provider}`,
      `Retrieval Limit: ${config.mem0.retrievalLimit}`,
      `Supabase URL: ${config.mem0.supabaseUrl}`,
      `Mem0 API Key: ${config.mem0.apiKey ? '✓ Set' : '✗ Not set'}`,
      `Embedding API Key: ${config.mem0.embeddingConfig.apiKey ? '✓ Set' : '✗ Not set'}`,
      `Reranker API Key: ${config.mem0.rerankerConfig.apiKey ? '✓ Set' : '✗ Not set'}`,
    ].join('\n');
  } catch (error) {
    return `Configuration Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
