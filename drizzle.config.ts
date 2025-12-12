import { defineConfig } from 'drizzle-kit';


require('dotenv').config({path: ['.env.local', '.env']})

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schemas',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DB_PATH! },
});
