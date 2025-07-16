import type { Config } from 'drizzle-kit';

// Support dynamic database path for remote operations
const dbPath = process.env.DB_PATH || './.taskmaster/tasks/tasks.db';

export default {
  schema: './scripts/modules/flow/infra/database/schema.js',
  out: './scripts/modules/flow/infra/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath
  },
  verbose: true,
  strict: true,
} satisfies Config; 