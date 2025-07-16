#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createServer } from 'net';

// Function to find an available port
function findAvailablePort(startPort = 4983) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

const projectPath = process.env.PROJECT_ROOT || process.argv[2];

if (!projectPath) {
  console.error('Usage: node db-studio-remote.js <project-path>');
  console.error('   or: PROJECT_ROOT=<path> node db-studio-remote.js');
  process.exit(1);
}

const dbPath = path.join(projectPath, '.taskmaster/tasks/tasks.db');
const configPath = path.resolve('./scripts/modules/flow/drizzle.config.ts');

console.log('🎯 Starting Drizzle Studio');
console.log('📁 Project path:', projectPath);
console.log('🗄️  Database path:', dbPath);

// Check if database exists and show basic info
if (fs.existsSync(dbPath)) {
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = Database(dbPath, { readonly: true });
    
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    let totalRows = 0;
    
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        totalRows += count.count;
      } catch (e) {
        // Skip if table has issues
      }
    }
    
    console.log(`📊 Database stats: ${tables.length} tables, ${totalRows} total rows`);
    
    // Show tags if they exist
    try {
      const tags = db.prepare("SELECT name FROM tags").all();
      if (tags.length > 0) {
        console.log(`🏷️  Available tags: ${tags.map(t => t.name).join(', ')}`);
      }
    } catch (e) {
      // Tags table might not exist
    }
    
    db.close();
  } catch (error) {
    console.log('⚠️  Could not read database stats:', error.message);
  }
} else {
  console.log('⚠️  Database file does not exist - Studio will show empty schema');
}

// Find an available port
findAvailablePort().then((port) => {
  console.log(`🌐 Using port: ${port}`);
  
  // Set the environment variable for the dynamic config
  const env = { ...process.env, DB_PATH: dbPath, DRIZZLE_STUDIO_PORT: port.toString() };

  // Spawn drizzle-kit studio with the updated config and custom port
  const studio = spawn('npx', ['drizzle-kit', 'studio', '--config=' + configPath, '--port=' + port.toString()], {
    stdio: 'inherit',
    env: env
  });

  studio.on('error', (err) => {
    console.error('❌ Failed to start studio:', err.message);
    process.exit(1);
  });

  studio.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Drizzle Studio closed normally');
    } else {
      console.error(`❌ Studio exited with code ${code}`);
      process.exit(code);
    }
  });
}).catch((err) => {
  console.error('❌ Failed to find available port:', err.message);
  process.exit(1);
}); 