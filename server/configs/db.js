import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') }); 

import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: './.env' });
}

const sql = neon(process.env.DATABASE_URL);
export default sql;