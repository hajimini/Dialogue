import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMemoryGatewayConfig } from "@/lib/memory/config";

let cachedClient: SupabaseClient | null = null;

export function getMemorySupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getMemoryGatewayConfig();
  cachedClient = createClient(config.mem0.supabaseUrl, config.mem0.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export function stringToMemoryUuid(input: string) {
  const normalized = input.trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(normalized)) {
    return normalized;
  }

  const hash = createHash("sha256").update(normalized).digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    `5${hash.substring(13, 16)}`,
    `${((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.substring(18, 20)}`,
    hash.substring(20, 32),
  ].join("-");
}

export async function resolveMemoryStorageUserId(userId: string) {
  return stringToMemoryUuid(userId);
}
