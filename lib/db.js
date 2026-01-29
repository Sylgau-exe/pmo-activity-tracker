import { neon } from '@neondatabase/serverless';

// Create a SQL query function using the Neon serverless driver
// DATABASE_URL is automatically injected by Vercel when you connect Neon
export const sql = neon(process.env.DATABASE_URL);

// Helper to run queries with error handling
export async function query(queryText, params = []) {
  try {
    const result = await sql(queryText, params);
    return { data: result, error: null };
  } catch (error) {
    console.error('Database query error:', error);
    return { data: null, error: error.message };
  }
}
