// AI Generated code <PURPOSE>: configure Drizzle migrations for PostgreSQL
import { defineConfig } from 'drizzle-kit'

import { dbEnv } from './src/config/env.js'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbEnv.DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
