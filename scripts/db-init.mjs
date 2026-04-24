#!/usr/bin/env node
/**
 * Async Copilot — database initializer.
 *
 * Runs all SQL files in:
 *   supabase/migrations/*.sql   (schema, idempotent)
 *   supabase/seeds/*.sql        (sample data, idempotent)
 *
 * Uses SUPABASE_DB_URL from .env.local. Bypasses Supabase CLI —
 * direct Postgres connection via `pg` driver.
 *
 * Usage:
 *   npm run db:init      # runs migrations then seeds
 *   npm run db:migrate   # migrations only
 *   npm run db:seed      # seeds only
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

// Load .env.local manually (no dotenv dep to keep things lean)
function loadEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env.local");
  try {
    const text = readFileSync(envPath, "utf-8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Fine: env might be provided by the shell (CI, Vercel, etc.)
  }
  return root;
}

function listSqlFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

async function runFiles(client, files, label) {
  if (files.length === 0) {
    console.log(`  (no ${label} files)`);
    return;
  }
  for (const file of files) {
    const rel = file.split(/[\\/]/).slice(-2).join("/");
    const sql = readFileSync(file, "utf-8");
    const start = Date.now();
    try {
      await client.query(sql);
      console.log(`  ✓ ${rel} (${Date.now() - start}ms)`);
    } catch (e) {
      console.error(`  ✗ ${rel} — ${e.message}`);
      throw e;
    }
  }
}

async function summary(client) {
  const tables = [
    "profiles",
    "workspaces",
    "workspace_memberships",
    "samples",
    "cases",
    "runs",
    "run_stages",
    "response_packs",
    "run_events",
  ];
  console.log("\nRow counts:");
  for (const t of tables) {
    const { rows } = await client.query(
      `select count(*)::int as c from public.${t}`,
    );
    console.log(`  ${t.padEnd(18)} ${rows[0].c}`);
  }
}

async function main() {
  const mode = process.argv[2] ?? "all"; // "migrate" | "seed" | "all"
  const root = loadEnv();

  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is missing. Set it in .env.local.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    // Supabase requires SSL; pooler may negotiate transparently, but this
    // is defensive for direct-connection URIs.
    ssl: { rejectUnauthorized: false },
  });
  console.log("Connecting to Supabase Postgres…");
  await client.connect();
  const { rows: v } = await client.query("select version() as v");
  console.log(`  ✓ ${v[0].v.split(" on ")[0]}`);

  try {
    if (mode === "migrate" || mode === "all") {
      console.log("\nRunning migrations:");
      await runFiles(
        client,
        listSqlFiles(join(root, "supabase", "migrations")),
        "migration",
      );
    }
    if (mode === "seed" || mode === "all") {
      console.log("\nRunning seeds:");
      await runFiles(
        client,
        listSqlFiles(join(root, "supabase", "seeds")),
        "seed",
      );
    }
    await summary(client);
    console.log("\n✓ done");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("\n✗ db-init failed:", e.message);
  process.exit(1);
});
