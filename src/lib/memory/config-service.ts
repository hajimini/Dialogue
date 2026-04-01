import {
  getCurrentMemoryConfigSnapshot,
  setMemoryRuntimeConfigOverrides,
  type RuntimeMemoryConfigOverrides,
  getMemoryGatewayConfig,
} from "@/lib/memory/config";
import { resetMemoryGateway } from "@/lib/memory/factory";
import { EmbeddingService } from "@/lib/memory/services/embedding-service";
import { RerankerService } from "@/lib/memory/services/reranker-service";
import { getMemorySupabaseClient } from "@/lib/memory/storage";

export type EditableMemoryConfig = Partial<{
  MEMORY_PROVIDER: "mem0" | "letta";
  EMBEDDING_PROVIDER: "openai" | "nvidia" | "bge-m3";
  EMBEDDING_MODEL: string;
  RERANKER_PROVIDER: "jina" | "cohere" | "none";
  MEMORY_RETRIEVAL_LIMIT: string;
  MEMORY_CONTEXT_CACHE_ENABLED: string;
}>;

export class ConfigService {
  getCurrentConfig() {
    return getCurrentMemoryConfigSnapshot();
  }

  async updateConfig(config: EditableMemoryConfig, changedBy: string) {
    const nextConfig = setMemoryRuntimeConfigOverrides(
      config as RuntimeMemoryConfigOverrides,
    );

    resetMemoryGateway();

    try {
      const supabase = getMemorySupabaseClient();
      await supabase.from("memory_config_history").insert({
        config: {
          ...getCurrentMemoryConfigSnapshot(),
          ...nextConfig,
        },
        changed_by: changedBy,
      });
    } catch (error) {
      console.warn(
        "[ConfigService] Failed to write config history:",
        error instanceof Error ? error.message : String(error),
      );
    }

    return {
      config: getCurrentMemoryConfigSnapshot(),
      requiresRestart: true,
    };
  }

  async getConfigHistory(limit = 10) {
    try {
      const supabase = getMemorySupabaseClient();
      const { data, error } = await supabase
        .from("memory_config_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data ?? [];
    } catch (error) {
      console.warn(
        "[ConfigService] Failed to read config history:",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  async testConnection(
    provider: "embedding" | "reranker",
    config: EditableMemoryConfig = {},
  ) {
    const runtimeConfig = {
      ...getCurrentMemoryConfigSnapshot(),
      ...config,
    };
    const gatewayConfig = getMemoryGatewayConfig();

    if (provider === "embedding") {
      const service = new EmbeddingService({
        provider: runtimeConfig.EMBEDDING_PROVIDER ?? gatewayConfig.mem0.embeddingConfig.provider,
        apiKey: gatewayConfig.mem0.embeddingConfig.apiKey,
        model: runtimeConfig.EMBEDDING_MODEL ?? gatewayConfig.mem0.embeddingConfig.model,
        baseUrl: gatewayConfig.mem0.embeddingConfig.baseUrl,
      });

      await service.embed("连接测试");

      return {
        isValid: true,
        message: "Embedding 服务连接正常。",
      };
    }

    const service = new RerankerService({
      provider:
        runtimeConfig.RERANKER_PROVIDER ?? gatewayConfig.mem0.rerankerConfig.provider,
      apiKey: gatewayConfig.mem0.rerankerConfig.apiKey,
    });

    await service.rerank("连接测试", ["第一条测试文本", "第二条测试文本"]);

    return {
      isValid: true,
      message: "Reranker 服务连接正常。",
    };
  }
}

export const configService = new ConfigService();
