import 'dotenv/config'; 
import { neon } from '@neondatabase/serverless';

console.log("Checking DATABASE_URL:", process.env.DATABASE_URL ? "FOUND ✅" : "NOT FOUND ❌");

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is missing! Make sure your .env file is in the same folder.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function test() {
  try {
    const result = await sql`SELECT now()`;
    console.log("🚀 Connection Success! DB Time:", result[0].now);
  } catch (err) {
    console.error("❌ Database connection failed:", err);
  }
}

test();