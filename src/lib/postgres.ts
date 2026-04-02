import { Pool, type PoolConfig, type QueryResultRow } from "pg";

declare global {
   
  var __aiCompanionPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new Error(
      "缺少环境变量：DATABASE_URL（也兼容 POSTGRES_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING）",
    );
  }

  return databaseUrl;
}

function getPoolConfig(): PoolConfig {
  const sslMode = (process.env.POSTGRES_SSL ?? "require").toLowerCase();
  const connectionString = getDatabaseUrl();
  const configuredMax = Number(process.env.POSTGRES_POOL_MAX ?? 10);
  const isSupabasePooler = connectionString.includes("pooler.supabase.com");
  const safeMax = isSupabasePooler ? Math.min(configuredMax, 3) : configuredMax;

  return {
    connectionString,
    max: Math.max(1, safeMax),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS ?? 10_000),
    ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  };
}

export function getPostgresPool() {
  if (globalThis.__aiCompanionPgPool) {
    return globalThis.__aiCompanionPgPool;
  }

  globalThis.__aiCompanionPgPool = new Pool(getPoolConfig());
  return globalThis.__aiCompanionPgPool;
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPostgresPool().query<T>(text, params);
}

export async function checkPostgresConnection() {
  const result = await queryPostgres<{ now: string }>("select now()::text as now");
  return result.rows[0] ?? null;
}
