import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING).");
  process.exit(1);
}

const sslMode = (process.env.POSTGRES_SSL ?? "require").toLowerCase();

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.POSTGRES_POOL_MAX ?? 3),
  idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS ?? 10000),
  ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
});

try {
  const versionResult = await pool.query("select version() as version");
  const nowResult = await pool.query("select now() as now");

  console.log("✅ Postgres connection OK");
  console.log(`now: ${nowResult.rows[0]?.now ?? "unknown"}`);
  console.log(`version: ${versionResult.rows[0]?.version ?? "unknown"}`);
} catch (error) {
  console.error("❌ Postgres connection failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
