#!/usr/bin/env node

import path from 'path';
import { spawn } from 'child_process';

const projectPath = process.env.PROJECT_ROOT || process.argv[2];

if (!projectPath) {
  console.error('Usage: node db-generate-remote.js <project-path>');
  console.error('   or: PROJECT_ROOT=<path> node db-generate-remote.js');
  process.exit(1);
}

const dbPath = path.join(projectPath, '.taskmaster/tasks/tasks.db');
const configPath = path.resolve('./scripts/modules/flow/drizzle.config.ts');

console.log('🚀 Generating migrations for database at:', dbPath);

// Set the environment variable for the dynamic config
const env = { ...process.env, DB_PATH: dbPath };

// Spawn drizzle-kit generate with the updated config
const generate = spawn('npx', ['drizzle-kit', 'generate', '--config=' + configPath], {
  stdio: 'inherit',
  env: env
});

generate.on('error', (err) => {
  console.error('❌ Failed to generate migrations:', err.message);
  process.exit(1);
});

generate.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Migration generation completed successfully!');
  } else {
    console.error(`❌ Migration generation failed with code ${code}`);
    process.exit(code);
  }
}); 