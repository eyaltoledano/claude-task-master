/**
 * CLI wrapper for the Flow TUI
 * This wrapper uses tsx to handle JSX transpilation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSyncCommand } from './commands/sync-command.js';
import { SyncTriggers } from '../shared/services/sync-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch the Flow TUI using tsx
 * @param {Object} options - Command options
 */
export async function launchFlow(options = {}) {
	return new Promise((resolve, reject) => {
		// Path to the main flow app
		const flowAppPath = path.join(__dirname, 'index-root.jsx');

		// Prepare environment variables
		const env = { ...process.env };
		if (options.backend) {
			env.TASKMASTER_BACKEND = options.backend;
		}
		if (options.mcpServerId) {
			env.TASKMASTER_MCP_SERVER_ID = options.mcpServerId;
		}
		if (options.projectRoot) {
			env.TASKMASTER_PROJECT_ROOT = options.projectRoot;
		}

		// Ensure terminal is interactive
		env.FORCE_COLOR = '1';

		// Use shell command string instead of pre-split arguments
		const command = `npx tsx "${flowAppPath}"`;

		const proc = spawn(command, {
			stdio: 'inherit',
			env,
			cwd: process.cwd(),
			shell: true
		});

		proc.on('error', (error) => {
			reject(new Error(`Failed to launch Flow TUI: ${error.message}`));
		});

		proc.on('exit', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Flow TUI exited with code ${code}`));
			}
		});
	});
}

/**
 * Add sync functionality to the Flow CLI wrapper
 */
export function addSyncCommands(program, projectRoot) {
  // Main sync command
  program
    .command('sync')
    .description('Synchronize tasks.json with SQLite database')
    .option('-d, --direction <direction>', 'Sync direction: auto, json-to-db, db-to-json, force-json, force-db', 'auto')
    .option('--dry-run', 'Show what would happen without making changes')
    .option('--no-backup', 'Skip creating backup before sync')
    .option('--abort-on-conflicts', 'Abort sync if conflicts are detected')
    .option('--silent', 'Run in silent mode with minimal output')
    .option('--log-level <level>', 'Set log level: debug, info, warn, error', 'info')
    .action(async (options) => {
      const syncCmd = createSyncCommand(projectRoot, {
        autoBackup: !options.noBackup,
        logLevel: options.silent ? 'error' : options.logLevel
      });

      try {
        if (options.dryRun) {
          console.log('🔍 Dry run - showing what would happen...\n');
          const result = await syncCmd.dryRun(options.direction);
          
          if (result.error) {
            console.error('❌ Error during dry run:', result.error);
            process.exit(1);
          }
          
          console.log(`📋 Sync direction: ${result.direction}`);
          console.log(`🔥 Conflicts detected: ${result.conflictsCount}`);
          console.log(`📦 Would create backup: ${result.wouldCreateBackup}`);
          
          if (result.conflicts.length > 0) {
            console.log('\n⚠️  Conflicts:');
            result.conflicts.forEach((conflict, index) => {
              console.log(`  ${index + 1}. ${conflict.type}: ${conflict.message || 'Data mismatch'}`);
            });
          }
          
          const { changes } = result;
          if (changes.tagsAffected || changes.tasksAffected || changes.dependenciesAffected) {
            console.log('\n📊 Estimated changes:');
            if (changes.tagsAffected) console.log(`  • Tags affected: ${changes.tagsAffected}`);
            if (changes.tasksAffected) console.log(`  • Tasks affected: ${changes.tasksAffected}`);
            if (changes.dependenciesAffected) console.log(`  • Dependencies affected: ${changes.dependenciesAffected}`);
          }
          
          return;
        }

        const result = await syncCmd.execute(options.direction, {
          abortOnConflicts: options.abortOnConflicts
        });

        if (result.success) {
          console.log('✅ Sync completed successfully');
          if (result.conflicts.length > 0) {
            console.log(`⚠️  ${result.conflicts.length} conflicts were resolved`);
          }
        } else {
          console.error('❌ Sync failed:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Sync error:', error.message);
        process.exit(1);
      }
    });

  // Sync status command
  program
    .command('sync:status')
    .description('Show sync status and conflicts')
    .option('--detailed', 'Show detailed conflict information')
    .action(async (options) => {
      const syncCmd = createSyncCommand(projectRoot);
      
      try {
        const status = await syncCmd.getStatus();
        
        if (status.error) {
          console.error('❌ Error getting sync status:', status.error);
          process.exit(1);
        }
        
        console.log('📊 Sync Status\n');
        console.log(`Database exists: ${status.dbExists ? '✅' : '❌'}`);
        console.log(`Tasks.json exists: ${status.jsonExists ? '✅' : '❌'}`);
        console.log(`Last sync: ${status.lastSync || 'Never'}`);
        console.log(`Recommended direction: ${status.recommendedDirection}`);
        console.log(`Conflicts detected: ${status.conflictsCount}`);
        
        if (status.conflicts.length > 0) {
          console.log('\n⚠️  Recent conflicts:');
          const conflictsToShow = options.detailed ? status.conflicts : status.conflicts.slice(0, 3);
          
          conflictsToShow.forEach((conflict, index) => {
            console.log(`  ${index + 1}. ${conflict.type}`);
            if (conflict.message) {
              console.log(`     ${conflict.message}`);
            }
          });
          
          if (!options.detailed && status.conflicts.length > 3) {
            console.log(`     ... and ${status.conflicts.length - 3} more (use --detailed to see all)`);
          }
        }
        
      } catch (error) {
        console.error('❌ Status error:', error.message);
        process.exit(1);
      }
    });

  // Force sync command
  program
    .command('sync:force <direction>')
    .description('Force sync in a specific direction (json or db)')
    .option('--no-backup', 'Skip creating backup before sync')
    .option('--silent', 'Run in silent mode with minimal output')
    .action(async (direction, options) => {
      if (!['json', 'db'].includes(direction)) {
        console.error('❌ Direction must be "json" or "db"');
        process.exit(1);
      }
      
      const syncCmd = createSyncCommand(projectRoot, {
        autoBackup: !options.noBackup,
        logLevel: options.silent ? 'error' : 'info'
      });
      
      try {
        console.log(`🔄 Force syncing from ${direction === 'json' ? 'JSON to DB' : 'DB to JSON'}...`);
        
        const result = await syncCmd.force(direction);
        
        if (result.success) {
          console.log('✅ Force sync completed successfully');
        } else {
          console.error('❌ Force sync failed:', result.error);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('❌ Force sync error:', error.message);
        process.exit(1);
      }
    });

  // Auto-sync trigger commands
  program
    .command('sync:trigger <operation>')
    .description('Trigger auto-sync after an operation')
    .option('--task-id <id>', 'Task ID for task operations')
    .option('--tag <tag>', 'Tag name for the operation')
    .option('--count <count>', 'Count for bulk operations', parseInt)
    .option('--file <path>', 'File path for file operations')
    .action(async (operation, options) => {
      try {
        let result;
        
        if (options.taskId) {
          result = await SyncTriggers.afterTaskOperation(projectRoot, operation, {
            id: options.taskId,
            tag: options.tag || 'master'
          });
        } else if (options.count) {
          result = await SyncTriggers.afterBulkOperation(projectRoot, operation, options.count);
        } else if (options.file) {
          result = await SyncTriggers.afterFileOperation(projectRoot, operation, options.file);
        } else {
          result = await SyncTriggers.manual(projectRoot, 'auto');
        }
        
        if (result.success !== false) {
          console.log('✅ Auto-sync triggered successfully');
          if (result.queued) {
            console.log(`📝 Sync request queued (ID: ${result.id})`);
          }
        } else {
          console.error('❌ Auto-sync failed:', result.error);
        }
        
      } catch (error) {
        console.error('❌ Trigger error:', error.message);
        process.exit(1);
      }
    });
}

/**
 * Helper function to check if sync commands are available
 */
export function isSyncEnabled(projectRoot) {
  try {
    const syncCmd = createSyncCommand(projectRoot);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get sync status for CLI display
 */
export async function getQuickSyncStatus(projectRoot) {
  try {
    const syncCmd = createSyncCommand(projectRoot);
    const status = await syncCmd.getStatus();
    
    return {
      available: true,
      dbExists: status.dbExists,
      jsonExists: status.jsonExists,
      conflictsCount: status.conflictsCount,
      lastSync: status.lastSync,
      recommendedDirection: status.recommendedDirection
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}
