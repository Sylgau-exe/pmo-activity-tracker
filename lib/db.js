import { neon } from '@neondatabase/serverless';

// Handle case where DATABASE_URL might not be available at build time
// The connection is created lazily when first used at runtime
let sql = null;

export function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// For backwards compatibility - will be null during build
export { sql };
