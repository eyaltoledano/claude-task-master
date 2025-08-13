#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

/**
 * Enhanced remote database reset script with safety warnings
 * Provides comprehensive information about what will be deleted
 * and requires explicit confirmation before proceeding
 */

const projectPath = process.env.PROJECT_ROOT || process.argv[2];

if (!projectPath) {
  console.error('Usage: node db-reset-remote.js <project-path>');
  console.error('   or: PROJECT_ROOT=<path> node db-reset-remote.js');
  process.exit(1);
}

const dbPath = path.join(projectPath, '.taskmaster/tasks/tasks.db');
const backupDir = path.join(projectPath, '.taskmaster/backups');

// Check for --force flag to skip confirmation
const forceMode = process.argv.includes('--force') || process.argv.includes('-f');
const quietMode = process.argv.includes('--quiet') || process.argv.includes('-q');

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function askConfirmation(message) {
  if (forceMode) return true;
  
  const rl = createInterface();
  
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim();
      resolve(confirmed === 'yes' || confirmed === 'y');
    });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / (k ** i)).toFixed(2)) + ' ' + sizes[i];
}

function createBackup() {
  if (!fs.existsSync(dbPath)) return null;
  
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `tasks-backup-before-reset-${timestamp}.db`);
    
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } catch (error) {
    console.error('⚠️  Failed to create backup:', error.message);
    return null;
  }
}

async function main() {
  if (!quietMode) {
    console.log('🗑️  Task Master Remote Database Reset');
    console.log('=====================================');
    console.log('📁 Project path:', projectPath);
    console.log('🗄️  Database path:', dbPath);
    console.log();
  }

  // Check if database exists and get stats before deletion
  if (!fs.existsSync(dbPath)) {
    if (!quietMode) {
      console.log('ℹ️  No database found to reset');
      console.log(`📁 Looking for: ${dbPath}`);
    }
    return;
  }

  let stats = null;
  try {
    const db = Database(dbPath, { readonly: true });
    
    // Get database info before deletion
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
    const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
    
    let totalRows = 0;
    const tableStats = [];
    const detailedStats = {};
    
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        totalRows += count.count;
        detailedStats[table.name] = count.count;
        if (count.count > 0) {
          tableStats.push(`${table.name}(${count.count})`);
        }
      } catch (e) {
        detailedStats[table.name] = 'Error reading';
      }
    }
    
    // Get tags if they exist
    let tags = [];
    try {
      tags = db.prepare("SELECT name, description FROM tags ORDER BY name").all();
    } catch (e) {
      // Tags table might not exist
    }

    // Get recent tasks for context
    let recentTasks = [];
    try {
      recentTasks = db.prepare(`
        SELECT id, title, status, updated_at 
        FROM tasks 
        ORDER BY updated_at DESC 
        LIMIT 5
      `).all();
    } catch (e) {
      // Tasks table might not exist
    }
    
    stats = {
      tables: tables.length,
      indexes: indexes.length,
      views: views.length,
      totalRows,
      tableStats,
      detailedStats,
      tags,
      recentTasks,
      fileSize: fs.statSync(dbPath).size
    };
    
    db.close();
  } catch (error) {
    if (!quietMode) {
      console.log('⚠️  Could not read database info before deletion:', error.message);
    }
  }

  if (stats && !quietMode) {
    console.log('🚨 DANGER: This will permanently delete ALL task data! 🚨');
    console.log();
    console.log('📊 Database to be deleted:');
    console.log(`   📁 Location: ${dbPath}`);
    console.log(`   💾 Size: ${formatBytes(stats.fileSize)}`);
    console.log(`   📋 Tables: ${stats.tables}`);
    console.log(`   🔍 Indexes: ${stats.indexes}`);
    console.log(`   👁️  Views: ${stats.views}`);
    console.log(`   📈 Total rows: ${stats.totalRows.toLocaleString()}`);
    
    if (stats.tableStats.length > 0) {
      console.log(`   📋 Data breakdown: ${stats.tableStats.join(', ')}`);
    }
    
    if (stats.tags.length > 0) {
      console.log(`   🏷️  Tags (${stats.tags.length}): ${stats.tags.map(t => t.name).join(', ')}`);
    }

    if (stats.recentTasks.length > 0) {
      console.log();
      console.log('📝 Recent tasks that will be lost:');
      stats.recentTasks.forEach(task => {
        const updatedAt = task.updated_at ? new Date(task.updated_at).toLocaleDateString() : 'Unknown';
        console.log(`   • #${task.id}: ${task.title} (${task.status}) - ${updatedAt}`);
      });
    }

    console.log();
    console.log('⚠️  THIS ACTION CANNOT BE UNDONE!');
    console.log('💡 A backup will be automatically created before deletion');
    console.log();
  }

  // Ask for confirmation
  const confirmed = await askConfirmation(
    '❓ Are you absolutely sure you want to delete the remote database? Type "yes" to confirm: '
  );

  if (!confirmed) {
    if (!quietMode) {
      console.log('✅ Operation cancelled - database preserved');
    }
    return;
  }

  // Create backup before deletion
  if (!quietMode) {
    console.log();
    console.log('💾 Creating backup before deletion...');
  }
  
  const backupPath = createBackup();
  if (backupPath && !quietMode) {
    console.log(`✅ Backup created: ${path.relative(projectPath, backupPath)}`);
  }

  // Delete the database
  try {
    fs.unlinkSync(dbPath);
    if (!quietMode) {
      console.log();
      console.log('✅ Database deleted successfully');
      console.log(`📁 Deleted: ${dbPath}`);
      
      if (backupPath) {
        console.log(`💾 Backup available at: ${path.relative(projectPath, backupPath)}`);
      }
      
      console.log();
      console.log('💡 To recreate the database schema, run:');
      console.log(`   npm run db:setup:remote ${projectPath}`);
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      if (!quietMode) {
        console.log('ℹ️  Database not found or already deleted');
      }
    } else {
      console.error('❌ Error deleting database:', e.message);
      process.exit(1);
    }
  }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n✅ Operation cancelled by user');
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Error during database reset:', error.message);
  process.exit(1);
}); 