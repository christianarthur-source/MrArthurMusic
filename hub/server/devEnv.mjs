/**
 * Worker env for `npm run dev`: a local SQLite file standing in for the HUB_DB D1 database, plus
 * secrets from the shell (MASTER_TEACHER_PIN defaults to "dev-master-pin" locally).
 * Needs Node 22.5+ for node:sqlite. Never used by the deployed Worker.
 */
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function d1(sqlite) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => {
      const row = sqlite.prepare(sql).get(...args);
      if (!row) return null;
      return col ? row[col] : { ...row };
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...args).map((r) => ({ ...r })), success: true, meta: {} }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (stmts) => {
      sqlite.exec('BEGIN');
      try {
        const res = [];
        for (const s of stmts) res.push(await s.run());
        sqlite.exec('COMMIT');
        return res;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export function createDevEnv(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  return {
    HUB_DB: d1(new DatabaseSync(`${dataDir}/hub.sqlite`)),
    MASTER_TEACHER_PIN: process.env.MASTER_TEACHER_PIN || 'dev-master-pin',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  };
}
