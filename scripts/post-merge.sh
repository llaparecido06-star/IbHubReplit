#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Pre-apply schema changes that drizzle-kit push would prompt about interactively.
# Runs inside lib/db so the pg module is always available.
node --require lib/db/node_modules/pg -e "
const { Pool } = require('lib/db/node_modules/pg');
" 2>/dev/null || true

cd lib/db && node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stmts = [
  'ALTER TABLE bi_importadores ADD COLUMN IF NOT EXISTS exportador text',
  \"ALTER TABLE bi_exportadores ADD COLUMN IF NOT EXISTS origem_exportador text NOT NULL DEFAULT ''\",
  'ALTER TABLE bi_exportadores ADD COLUMN IF NOT EXISTS distribuidor text',
  \`CREATE TABLE IF NOT EXISTS wine_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    marca_completa text, marca_relatorio text, pais_de_origem text,
    distribuidor text, exportador text, importador text,
    created_at timestamptz NOT NULL DEFAULT now()
  )\`,
  \`CREATE TABLE IF NOT EXISTS bi_exportadores_financeiro (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE, fob_usd numeric(15,2), cx9l numeric(12,2),
    usd_por_cx9l numeric(10,2), periodo text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )\`,
  \`CREATE TABLE IF NOT EXISTS bi_reveal_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    credits_remaining integer NOT NULL DEFAULT 0,
    credits_total integer NOT NULL DEFAULT 0,
    period_start date NOT NULL,
    updated_at timestamptz DEFAULT now()
  )\`,
];
(async () => {
  for (const sql of stmts) {
    try { await pool.query(sql); console.log('OK:', sql.slice(0,60).replace(/\n/g,' ')); }
    catch (e) { console.warn('SKIP:', e.message); }
  }
  await pool.end();
})();
" 2>&1 || true
cd /home/runner/workspace

pnpm --filter @workspace/db run push-force
