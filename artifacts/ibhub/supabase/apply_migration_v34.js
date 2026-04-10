/**
 * Migration v34: Apply RLS policies for stories and cvs storage buckets
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" \
 *   node apply_migration_v34.js
 *
 * Or with direct connection (if IPv6 is supported):
 *   SUPABASE_DB_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
 *   node apply_migration_v34.js
 *
 * The DB password can be found in the Supabase Dashboard under:
 *   Project Settings → Database → Connection string
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "ERROR: SUPABASE_DB_URL environment variable is required.\n" +
      "Get the connection string from your Supabase Dashboard > Project Settings > Database."
  );
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, "migrations_v34_storage_rls.sql"),
  "utf8"
);

const statements = sql
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter((s) => s.length > 0);

const IDEMPOTENT_ERRORS = ["already exists", "does not exist"];

async function run() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected!\n");

    for (const stmt of statements) {
      const preview = stmt.substring(0, 80).replace(/\s+/g, " ");
      try {
        await client.query(stmt);
        console.log(`  ✓ ${preview}`);
      } catch (e) {
        const isIdempotent = IDEMPOTENT_ERRORS.some((msg) =>
          e.message.includes(msg)
        );
        if (isIdempotent) {
          console.log(`  ~ ${preview} (skipped: ${e.message.trim()})`);
        } else {
          console.error(`  ✗ ${preview}`);
          console.error(`    Error: ${e.message}`);
          process.exit(1);
        }
      }
    }

    console.log("\nMigration v34 applied successfully.");
  } catch (e) {
    console.error("Connection failed:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
