import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@shared/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let _db: DB | undefined;

/** Returns the active Drizzle DB instance. Throws if initDb() has not been called. */
export function getDb(): DB {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

/** Returns the raw pg Pool. Throws if initDb() has not been called. */
export function getPool(): Pool {
  if (!pool) throw new Error('Database not initialized. Call initDb() first.');
  return pool;
}

/**
 * Initialises the connection pool, runs pending migrations, and validates connectivity.
 * Call once at startup before serving requests.
 *
 * Migrations are read from the `migrations/` directory at the project root.
 * Every schema change must go through `npm run db:generate` — never edit db.ts
 * to add tables or columns manually.
 */
export async function initDb(databaseUrl: string): Promise<void> {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Validate connectivity eagerly so startup fails fast on bad config.
  const client = await pool.connect();
  client.release();

  _db = drizzle(pool, { schema });

  // Run all pending migrations. Drizzle tracks applied migrations in the
  // __drizzle_migrations table and skips anything already applied — safe
  // to call on every startup.
  const migrationsFolder = path.resolve(process.cwd(), 'migrations');
  await migrate(_db, { migrationsFolder });

  console.log('[db] PostgreSQL connected, migrations applied');
}

/** Gracefully closes the pool. Call during shutdown. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    _db = undefined;
  }
}

function needsSsl(url: string): boolean {
  if (/sslmode=require/.test(url)) return true;
  if (/sslmode=disable/.test(url)) return false;
  // Common cloud Postgres hosts that require SSL
  return /railway\.app|neon\.tech|amazonaws\.com|supabase\.co/.test(url);
}
