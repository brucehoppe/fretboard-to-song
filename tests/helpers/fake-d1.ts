// Loaded at runtime so the jsdom test project (bundled for the "browser") can use them too.
const { readFileSync, readdirSync } = process.getBuiltinModule('node:fs') as typeof import('node:fs');
const { join } = process.getBuiltinModule('node:path') as typeof import('node:path');
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

/**
 * A minimal D1 implementation on top of Node's built-in SQLite, so the real API
 * route runs real SQL against a schema built from the real migration files.
 */
export function createFakeD1(options: { migrations?: boolean } = {}) {
  const db = new DatabaseSync(':memory:');
  if (options.migrations !== false) {
    const dir = join(process.cwd(), 'drizzle');
    for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      for (const stmt of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
        if (stmt.trim()) db.exec(stmt);
      }
    }
  }
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    async all<T>() { return { results: db.prepare(sql).all(...(args as never[])) as T[], success: true, meta: {} }; },
    async first<T>() { return (db.prepare(sql).get(...(args as never[])) ?? null) as T | null; },
    async run() { const r = db.prepare(sql).run(...(args as never[])); return { success: true, results: [], meta: { changes: Number(r.changes) } }; },
  });
  const d1 = { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
  return { d1, sqlite: db };
}
