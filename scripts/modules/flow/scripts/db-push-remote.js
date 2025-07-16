#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';

const projectPath = process.env.PROJECT_ROOT || process.argv[2];

if (!projectPath) {
  console.error('Usage: node db-push-remote.js <project-path>');
  console.error('   or: PROJECT_ROOT=<path> node db-push-remote.js');
  process.exit(1);
}

const dbPath = path.join(projectPath, '.taskmaster/tasks/tasks.db');
const configPath = path.resolve('./scripts/modules/flow/drizzle.config.ts');

console.log('🚀 Starting database push');
console.log('📁 Project path:', projectPath);
console.log('🗄️  Database path:', dbPath);

// Check if database exists and get pre-push stats
const prePushStats = { exists: false, tables: 0, totalRows: 0 };
if (fs.existsSync(dbPath)) {
  try {
    const db = Database(dbPath, { readonly: true });
    prePushStats.exists = true;
    
    // Get table count
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    prePushStats.tables = tables.length;
    
    // Get total row count across all tables
    let totalRows = 0;
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        totalRows += count.count;
      } catch (e) {
        // Skip if table doesn't exist or has issues
      }
    }
    prePushStats.totalRows = totalRows;
    
    db.close();
    console.log(`📊 Pre-push state: ${prePushStats.tables} tables, ${prePushStats.totalRows} total rows`);
  } catch (error) {
    console.log('⚠️  Could not read pre-push stats:', error.message);
  }
} else {
  console.log('📝 Database does not exist - will be created during push');
}

// Set the environment variable for the dynamic config
const env = { ...process.env, DB_PATH: dbPath };

// Spawn drizzle-kit push with the updated config
const push = spawn('npx', ['drizzle-kit', 'push', '--config=' + configPath], {
  stdio: 'inherit',
  env: env
});

push.on('error', (err) => {
  console.error('❌ Failed to start push:', err.message);
  process.exit(1);
});

push.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Database push completed successfully!');
    
    // Get post-push stats
    try {
      const db = Database(dbPath, { readonly: true });
      
      // Get table information
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
      const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
      
      console.log('\n📊 Post-push database structure:');
      console.log(`   📋 Tables: ${tables.length}`);
      console.log(`   🔍 Indexes: ${indexes.length}`);
      console.log(`   👁️  Views: ${views.length}`);
      
      // Show table details
      let totalRows = 0;
      console.log('\n📋 Table details:');
      for (const table of tables) {
        try {
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
          totalRows += count.count;
          console.log(`   • ${table.name}: ${count.count} rows`);
        } catch (e) {
          console.log(`   • ${table.name}: unable to count rows`);
        }
      }
      
      console.log(`\n📈 Total data: ${totalRows} rows across all tables`);
      
      if (prePushStats.exists) {
        const tablesDiff = tables.length - prePushStats.tables;
        const rowsDiff = totalRows - prePushStats.totalRows;
        console.log(`📊 Changes: ${tablesDiff >= 0 ? '+' : ''}${tablesDiff} tables, ${rowsDiff >= 0 ? '+' : ''}${rowsDiff} rows`);
      }
      
      db.close();
    } catch (error) {
      console.log('⚠️  Could not read post-push stats:', error.message);
    }
  } else {
    console.error(`❌ Database push failed with code ${code}`);
    process.exit(code);
  }
}); 