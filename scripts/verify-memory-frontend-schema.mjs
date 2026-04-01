import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: path.join(process.cwd(), ".env.local"), quiet: true });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or POSTGRES_URL.");
  process.exit(1);
}

const { Client } = pg;

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function checkTable(client, table) {
  const result = await client.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as ok
    `,
    [table],
  );

  return {
    label: `table:${table}`,
    ok: Boolean(result.rows[0]?.ok),
    notes: result.rows[0]?.ok ? "present" : "missing",
  };
}

async function checkColumns(client, table, columns) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
    `,
    [table],
  );

  const existing = new Set(result.rows.map((row) => row.column_name));
  const missing = columns.filter((column) => !existing.has(column));

  return {
    label: `columns:${table}`,
    ok: missing.length === 0,
    notes: missing.length === 0 ? columns.join(", ") : `missing: ${missing.join(", ")}`,
  };
}

async function checkIndexes(client, table, indexes) {
  const result = await client.query(
    `
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = $1
    `,
    [table],
  );

  const existing = new Set(result.rows.map((row) => row.indexname));
  const missing = indexes.filter((index) => !existing.has(index));

  return {
    label: `indexes:${table}`,
    ok: missing.length === 0,
    notes: missing.length === 0 ? indexes.join(", ") : `missing: ${missing.join(", ")}`,
  };
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const checks = [
      await checkTable(client, "memories"),
      await checkColumns(client, "memories", [
        "id",
        "user_id",
        "persona_id",
        "feedback_count_accurate",
        "feedback_count_inaccurate",
        "retrieval_count",
      ]),
      await checkTable(client, "memory_feedback"),
      await checkColumns(client, "memory_feedback", [
        "id",
        "user_id",
        "memory_id",
        "feedback_type",
      ]),
      await checkTable(client, "memory_config_history"),
      await checkColumns(client, "memory_config_history", [
        "id",
        "config",
        "changed_by",
        "changed_at",
      ]),
      await checkTable(client, "memory_operation_logs"),
      await checkColumns(client, "memory_operation_logs", [
        "id",
        "timestamp",
        "operation",
        "user_id",
        "character_id",
      ]),
      await checkIndexes(client, "memory_operation_logs", [
        "idx_memory_operation_logs_character_id",
        "idx_memory_operation_logs_character_operation",
      ]),
    ];

    const outputDir = path.join(process.cwd(), "docs", "validation-reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `schema-verification-${timestamp()}.md`);

    const lines = [
      "# Memory Frontend Schema Verification",
      "",
      `- Generated at: ${new Date().toISOString()}`,
      "",
      "| Check | Result | Notes |",
      "| --- | --- | --- |",
      ...checks.map(
        (item) => `| ${item.label} | ${item.ok ? "PASS" : "FAIL"} | ${item.notes} |`,
      ),
      "",
    ];

    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

    console.log(
      `Schema verification report written to ${path.relative(process.cwd(), outputPath)}`,
    );
    for (const item of checks) {
      console.log(`- ${item.label}: ${item.ok ? "PASS" : "FAIL"} - ${item.notes}`);
    }

    if (checks.some((item) => !item.ok)) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
