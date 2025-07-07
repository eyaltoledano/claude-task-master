/**
 * Flow CLI Commands
 * Enhanced with VibeKit provider monitoring, health checking, and advanced error handling
 */

import { 
  executeTask, 
  generateCode, 
  listAgents, 
  switchProvider,
  showProviderHealth,
  runDiagnostics,
  resetProviderConfig
} from './commands/enhanced-execution.command.js';

export function registerFlowCommand(programInstance) {
  // Main flow command with enhanced subcommands
  programInstance
    .command('flow [subcommand]')
    .description('Enhanced VibeKit-powered task execution with health monitoring')
    .option('--agent <type>', 'Agent type: claude, codex, gemini, opencode') // Updated
    .option('--mode <mode>', 'Execution mode: code or ask')
    .option('--no-stream', 'Disable streaming output')
    .option('--verbose', 'Show detailed information')
    .option('--project-root <path>', 'Project root directory')
    .action(async (subcommand, options) => {
      if (!subcommand) {
        // Launch TUI by default
        const { run } = await import('./index.jsx');
        await run(options);
        return;
      }

      // Handle subcommands
      switch (subcommand) {
        case 'execute':
          console.log('💡 Use: task-master flow execute <taskId>');
          break;
        case 'generate':
          console.log('💡 Use: task-master flow generate "<prompt>"');
          break;
        case 'agents':
          return await listAgents(options);
        case 'health':
          return await showProviderHealth(options);
        case 'diagnostics':
          return await runDiagnostics(null, options);
        case 'switch':
          console.log('💡 Use: task-master flow switch <providerName>');
          break;
        case 'reset':
          return await resetProviderConfig(options);
        case 'info':
          // Inline info handler
          return await showSystemInfo(options);
        case 'test-vibekit':
          // Legacy command - redirect to diagnostics
          console.log('🔄 Redirecting to enhanced diagnostics...');
          return await runDiagnostics('vibekit', options);
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.log('');
          console.log('Available subcommands:');
          console.log('  execute <taskId>  - Execute a task');
          console.log('  generate "<prompt>" - Generate code');
          console.log('  agents           - List available agents');
          console.log('  health           - Show provider health');
          console.log('  diagnostics      - Run diagnostics');
          console.log('  switch <provider> - Switch provider');
          console.log('  reset            - Reset configuration');
          console.log('  info             - Show system information');
          process.exit(1);
      }
    });

  // Execute task subcommand
  programInstance
    .command('flow execute <taskId>')
    .description('Execute a task using Enhanced VibeKit with monitoring')
    .option('--agent <type>', 'Agent type: claude, codex, gemini, opencode', 'claude')
    .option('--branch <name>', 'Git branch to use')
    .option('--mode <mode>', 'Execution mode: code or ask', 'code')
    .option('--project-root <path>', 'Project root directory')
    .option('--verbose', 'Show detailed execution information')
    .action(async (taskId, options) => {
      try {
        await executeTask(taskId, options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Generate code subcommand
  programInstance
    .command('flow generate <prompt>')
    .description('Generate code using Enhanced VibeKit with monitoring')
    .option('--agent <type>', 'Agent type: claude, codex, gemini, opencode', 'claude')
    .option('--mode <mode>', 'Generation mode: code or ask', 'code')
    .option('--no-stream', 'Disable streaming output')
    .option('--verbose', 'Show provider status and detailed information')
    .action(async (prompt, options) => {
      try {
        await generateCode(prompt, options);
      } catch (error) {
        process.exit(1);
      }
    });

  // List agents subcommand
  programInstance
    .command('flow agents')
    .description('List available VibeKit agents with health information')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed agent configuration')
    .action(async (options) => {
      try {
        await listAgents(options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Provider health subcommand
  programInstance
    .command('flow health')
    .description('Show comprehensive provider health status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed configuration information')
    .action(async (options) => {
      try {
        await showProviderHealth(options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Provider diagnostics subcommand
  programInstance
    .command('flow diagnostics [provider]')
    .description('Run comprehensive provider diagnostics')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed diagnostic information')
    .action(async (provider, options) => {
      try {
        await runDiagnostics(provider, options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Switch provider subcommand
  programInstance
    .command('flow switch <providerName>')
    .description('Switch to a different provider')
    .option('--verbose', 'Show detailed provider status after switch')
    .action(async (providerName, options) => {
      try {
        await switchProvider(providerName, options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Reset configuration subcommand
  programInstance
    .command('flow reset')
    .description('Reset provider configuration to defaults')
    .option('--force', 'Skip confirmation and reset immediately')
    .action(async (options) => {
      try {
        await resetProviderConfig(options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Info subcommand - show comprehensive system information
  programInstance
    .command('flow info')
    .description('Show comprehensive Flow system information')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        console.log('ℹ️  Flow TUI System Information');
        console.log('==============================');
        console.log('');
        
        // Show health summary
        const healthReport = await import('./providers/enhanced-registry.js')
          .then(m => m.enhancedRegistry.generateHealthReport());
        
        if (options.json) {
          console.log(JSON.stringify({
            version: '2.0.0', // Phase 2 version
            timestamp: Date.now(),
            healthReport
          }, null, 2));
          return;
        }

        console.log('📊 System Status:');
        console.log(`   Version: 2.0.0 (Enhanced Provider Registry)`);
        console.log(`   Environment: ${healthReport.system.environment}`);
        console.log(`   Initialized: ${healthReport.system.initialized ? 'Yes' : 'No'}`);
        console.log(`   Active Provider: ${healthReport.system.activeProvider}`);
        console.log('');

        const summary = healthReport.healthReport.summary;
        console.log('🏥 Health Overview:');
        console.log(`   Total Providers: ${summary.totalProviders}`);
        console.log(`   Healthy: ${summary.healthyProviders} ✅`);
        console.log(`   Issues: ${summary.unhealthyProviders + summary.errorProviders} ⚠️`);
        console.log('');

        console.log('🚀 Available Commands:');
        console.log('   task-master flow execute <taskId>  - Execute tasks with monitoring');
        console.log('   task-master flow generate "<prompt>"  - Generate code with failover');
        console.log('   task-master flow health            - Show provider health');
        console.log('   task-master flow diagnostics       - Run comprehensive diagnostics');
        console.log('   task-master flow agents            - List agents with status');
        console.log('   task-master flow switch <provider> - Switch providers');
        console.log('   task-master flow                   - Launch interactive TUI');
        console.log('');

        if (summary.unhealthyProviders + summary.errorProviders > 0) {
          console.log('💡 For troubleshooting: task-master flow diagnostics');
        }

      } catch (error) {
        console.error(`❌ Failed to get system information: ${error.message}`);
        process.exit(1);
             }
     });
}

/**
 * Show comprehensive system information
 */
async function showSystemInfo(options) {
  try {
    console.log('ℹ️  Flow TUI System Information');
    console.log('==============================');
    console.log('');
    
    // Import enhanced registry
    const { enhancedRegistry } = await import('./providers/enhanced-registry.js');
    
    // Show health summary
    const healthReport = await enhancedRegistry.generateHealthReport();
    
    if (options.json) {
      console.log(JSON.stringify({
        version: '2.0.0', // Phase 2 version
        timestamp: Date.now(),
        healthReport
      }, null, 2));
      return;
    }

    console.log('📊 System Status:');
    console.log(`   Version: 2.0.0 (Enhanced Provider Registry)`);
    console.log(`   Environment: ${healthReport.system.environment}`);
    console.log(`   Initialized: ${healthReport.system.initialized ? 'Yes' : 'No'}`);
    console.log(`   Active Provider: ${healthReport.system.activeProvider}`);
    console.log('');

    const summary = healthReport.healthReport.summary;
    console.log('🏥 Health Overview:');
    console.log(`   Total Providers: ${summary.totalProviders}`);
    console.log(`   Healthy: ${summary.healthyProviders} ✅`);
    console.log(`   Issues: ${summary.unhealthyProviders + summary.errorProviders} ⚠️`);
    console.log('');

    console.log('🚀 Available Commands:');
    console.log('   task-master flow execute <taskId>  - Execute tasks with monitoring');
    console.log('   task-master flow generate "<prompt>"  - Generate code with failover');
    console.log('   task-master flow health            - Show provider health');
    console.log('   task-master flow diagnostics       - Run comprehensive diagnostics');
    console.log('   task-master flow agents            - List agents with status');
    console.log('   task-master flow switch <provider> - Switch providers');
    console.log('   task-master flow                   - Launch interactive TUI');
    console.log('');

    if (summary.unhealthyProviders + summary.errorProviders > 0) {
      console.log('💡 For troubleshooting: task-master flow diagnostics');
    }

  } catch (error) {
    console.error(`❌ Failed to get system information: ${error.message}`);
    process.exit(1);
  }
}
