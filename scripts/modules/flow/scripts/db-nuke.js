#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Nuclear database removal script
 * Removes the ENTIRE .taskmaster directory including:
 * - Database files
 * - Backups
 * - Configuration
 * - Logs
 * - ALL project data
 * 
 * This is the most destructive option - use with EXTREME caution!
 */

const projectRoot = process.env.PROJECT_ROOT || process.argv[2] || process.cwd();
const taskmasterDir = path.join(projectRoot, '.taskmaster');

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

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  if (!fs.existsSync(dirPath)) return 0;
  
  try {
    const stats = fs.statSync(dirPath);
    if (stats.isFile()) {
      return stats.size;
    }
    
    if (stats.isDirectory()) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        totalSize += getDirectorySize(filePath);
      }
    }
  } catch (error) {
    // Skip files/directories we can't access
  }
  
  return totalSize;
}

function analyzeTaskmasterDirectory() {
  if (!fs.existsSync(taskmasterDir)) {
    return null;
  }

  const analysis = {
    totalSize: getDirectorySize(taskmasterDir),
    directories: [],
    files: [],
    backupCount: 0,
    configFiles: [],
    logFiles: []
  };

  try {
    const items = fs.readdirSync(taskmasterDir, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(taskmasterDir, item.name);
      
      if (item.isDirectory()) {
        const dirSize = getDirectorySize(itemPath);
        analysis.directories.push({
          name: item.name,
          size: dirSize,
          path: itemPath
        });
        
        if (item.name === 'backups') {
          try {
            const backupFiles = fs.readdirSync(itemPath);
            analysis.backupCount = backupFiles.filter(f => f.endsWith('.db')).length;
          } catch (e) {
            // Ignore
          }
        }
      } else if (item.isFile()) {
        const stats = fs.statSync(itemPath);
        const fileInfo = {
          name: item.name,
          size: stats.size,
          path: itemPath
        };
        
        analysis.files.push(fileInfo);
        
        if (item.name.endsWith('.json')) {
          analysis.configFiles.push(fileInfo);
        } else if (item.name.endsWith('.log')) {
          analysis.logFiles.push(fileInfo);
        }
      }
    }
  } catch (error) {
    analysis.error = error.message;
  }

  return analysis;
}

function removeDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  const stats = fs.statSync(dirPath);
  
  if (stats.isFile()) {
    fs.unlinkSync(dirPath);
    return;
  }
  
  if (stats.isDirectory()) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      removeDirectory(filePath);
    }
    fs.rmdirSync(dirPath);
  }
}

async function main() {
  if (!quietMode) {
    console.log('💥 Task Master NUCLEAR Database Removal');
    console.log('=======================================');
    console.log('📁 Project path:', projectRoot);
    console.log('🎯 Target directory:', taskmasterDir);
    console.log();
  }

  const analysis = analyzeTaskmasterDirectory();
  
  if (!analysis) {
    if (!quietMode) {
      console.log('ℹ️  No .taskmaster directory found');
      console.log(`📁 Looking for: ${taskmasterDir}`);
    }
    return;
  }

  if (!quietMode) {
    console.log('🚨🚨🚨 EXTREME DANGER WARNING 🚨🚨🚨');
    console.log();
    console.log('This will PERMANENTLY DELETE the ENTIRE .taskmaster directory!');
    console.log('This includes:');
    console.log('  💾 ALL databases and task data');
    console.log('  📁 ALL backups (no recovery possible)');
    console.log('  ⚙️  ALL configuration files');
    console.log('  📋 ALL logs and history');
    console.log('  🏷️  ALL tags and metadata');
    console.log();
    
    console.log('📊 What will be deleted:');
    console.log(`   📁 Total size: ${formatBytes(analysis.totalSize)}`);
    console.log(`   📂 Directories: ${analysis.directories.length}`);
    console.log(`   📄 Files: ${analysis.files.length}`);
    
    if (analysis.backupCount > 0) {
      console.log(`   💾 Database backups: ${analysis.backupCount} (ALL WILL BE LOST!)`);
    }
    
    if (analysis.configFiles.length > 0) {
      console.log(`   ⚙️  Config files: ${analysis.configFiles.length}`);
    }
    
    if (analysis.logFiles.length > 0) {
      console.log(`   📋 Log files: ${analysis.logFiles.length}`);
    }

    console.log();
    analysis.directories.forEach(dir => {
      console.log(`   📂 ${dir.name}/  (${formatBytes(dir.size)})`);
    });
    
    if (analysis.files.length > 0) {
      console.log();
      analysis.files.forEach(file => {
        console.log(`   📄 ${file.name}  (${formatBytes(file.size)})`);
      });
    }

    console.log();
    console.log('⚠️⚠️⚠️  THIS ACTION CANNOT BE UNDONE! ⚠️⚠️⚠️');
    console.log('❌ NO BACKUPS WILL BE CREATED!');
    console.log('❌ ALL DATA WILL BE PERMANENTLY LOST!');
    console.log('❌ THIS WILL RESET YOUR PROJECT TO FACTORY STATE!');
    console.log();
  }

  // First confirmation
  const firstConfirm = await askConfirmation(
    '❓ Do you understand that this will delete EVERYTHING? Type "yes" to continue: '
  );

  if (!firstConfirm) {
    if (!quietMode) {
      console.log('✅ Operation cancelled - .taskmaster directory preserved');
    }
    return;
  }

  // Second confirmation with typing the full path
  const secondConfirm = await askConfirmation(
    `❓ Type the full path to confirm: "${taskmasterDir}": `
  );

  if (secondConfirm !== taskmasterDir) {
    if (!quietMode) {
      console.log('✅ Path mismatch - operation cancelled for safety');
    }
    return;
  }

  // Final confirmation
  const finalConfirm = await askConfirmation(
    '❓ FINAL WARNING: Type "DELETE EVERYTHING" to proceed: '
  );

  if (finalConfirm !== 'DELETE EVERYTHING') {
    if (!quietMode) {
      console.log('✅ Operation cancelled - .taskmaster directory preserved');
    }
    return;
  }

  // Perform the nuclear deletion
  if (!quietMode) {
    console.log();
    console.log('💥 Initiating nuclear deletion...');
    console.log('⚠️  NO BACKUPS ARE BEING CREATED!');
  }

  try {
    removeDirectory(taskmasterDir);
    
    if (!quietMode) {
      console.log();
      console.log('✅ Nuclear deletion completed');
      console.log(`💥 Deleted: ${taskmasterDir}`);
      console.log('📁 Your project has been reset to factory state');
      console.log();
      console.log('💡 To reinitialize Task Master:');
      console.log('   task-master init');
      console.log('   task-master models --setup');
    }
  } catch (error) {
    console.error('❌ Error during nuclear deletion:', error.message);
    process.exit(1);
  }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n✅ Operation cancelled by user');
  process.exit(0);
});

// Display help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Task Master Nuclear Database Removal');
  console.log('');
  console.log('Usage:');
  console.log('  npm run db:nuke              # Remove local .taskmaster directory');
  console.log('  npm run db:nuke:remote <path> # Remove remote .taskmaster directory');
  console.log('');
  console.log('Options:');
  console.log('  --force, -f    Skip all confirmation prompts (DANGEROUS!)');
  console.log('  --quiet, -q    Suppress output except errors');
  console.log('  --help, -h     Show this help');
  console.log('');
  console.log('⚠️  WARNING: This is the most destructive operation possible!');
  console.log('   It removes ALL Task Master data with NO possibility of recovery.');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error during nuclear deletion:', error.message);
  process.exit(1);
}); 