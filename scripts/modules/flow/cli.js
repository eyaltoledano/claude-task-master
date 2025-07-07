/**
 * Flow CLI Commands
 * Simplified VibeKit-powered task execution and code generation
 */

import { 
  executeTask, 
  generateCode, 
  listAgents,
  executeTasks
} from './commands/execution.command.js';

export function registerFlowCommand(programInstance) {
  // Main flow command with simplified subcommands
  programInstance
    .command('flow [subcommand]')
    .description('VibeKit-powered task execution and code generation')
    .option('--agent <type>', 'Agent type: claude-code, codex, gemini-cli, opencode')
    .option('--mode <mode>', 'Execution mode: code or ask')
    .option('--no-stream', 'Disable streaming output')
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
        case 'batch':
          console.log('💡 Use: task-master flow batch <taskId1> <taskId2> ...');
          break;
        case 'config':
          console.log('💡 Use: task-master flow config --show');
          break;
        default:
          console.error(`Unknown subcommand: ${subcommand}`);
          console.log('');
          console.log('Available subcommands:');
          console.log('  execute <taskId>     - Execute a single task');
          console.log('  generate "<prompt>"  - Generate code from prompt');
          console.log('  agents              - List available agents and their status');
          console.log('  batch <taskIds...>  - Execute multiple tasks in sequence');
          console.log('  config              - Manage VibeKit configuration');
          console.log('');
          console.log('For interactive mode, just run: task-master flow');
          process.exit(1);
      }
    });

  // Execute task subcommand
  programInstance
    .command('flow execute <taskId>')
    .description('Execute a task using VibeKit')
    .option('--agent <type>', 'Agent type: claude-code, codex, gemini-cli, opencode', 'claude-code')
    .option('--branch <name>', 'Git branch to use')
    .option('--mode <mode>', 'Execution mode: code or ask', 'code')
    .option('--project-root <path>', 'Project root directory')
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
    .description('Generate code using VibeKit')
    .option('--agent <type>', 'Agent type: claude-code, codex, gemini-cli, opencode', 'claude-code')
    .option('--mode <mode>', 'Generation mode: code or ask', 'code')
    .option('--no-stream', 'Disable streaming output')
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
    .description('List available VibeKit agents')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await listAgents(options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Batch execute subcommand
  programInstance
    .command('flow batch <taskIds...>')
    .description('Execute multiple tasks in sequence')
    .option('--agent <type>', 'Agent type: claude-code, codex, gemini-cli, opencode', 'claude-code')
    .option('--mode <mode>', 'Execution mode: code or ask', 'code')
    .option('--project-root <path>', 'Project root directory')
    .option('--stop-on-error', 'Stop execution if any task fails')
    .action(async (taskIds, options) => {
      try {
        await executeTasks(taskIds, options);
      } catch (error) {
        process.exit(1);
      }
    });

  // Configuration subcommand
  programInstance
    .command('flow config')
    .description('Manage VibeKit Flow configuration')
    .option('--show', 'Show current configuration')
    .option('--validate', 'Validate configuration and environment')
    .option('--init', 'Initialize configuration with defaults')
    .option('--set <path> <value>', 'Set configuration value (use dot notation)')
    .option('--json', 'Output in JSON format')
    .option('--force', 'Force overwrite existing config (with --init)')
    .option('--project-root <path>', 'Project root directory')
    .action(async (options) => {
      try {
        if (options.show) {
          const { showConfig } = await import('./commands/config.command.js');
          await showConfig(options);
        } else if (options.validate) {
          const { validateConfig } = await import('./commands/config.command.js');
          await validateConfig(options);
        } else if (options.init) {
          const { initConfig } = await import('./commands/config.command.js');
          await initConfig(options);
        } else if (options.set) {
          const [path, value] = options.set.split(' ');
          const { setConfigValue } = await import('./commands/config.command.js');
          await setConfigValue(path, value, options);
        } else {
          console.log('VibeKit Flow Configuration Commands:');
          console.log('  --show      Show current configuration');
          console.log('  --validate  Validate configuration and environment');
          console.log('  --init      Initialize configuration with defaults');
          console.log('  --set <path> <value>  Set configuration value');
          console.log('');
          console.log('Examples:');
          console.log('  task-master flow config --show');
          console.log('  task-master flow config --validate');
          console.log('  task-master flow config --init');
          console.log('  task-master flow config --set vibekit.defaultAgent claude-code');
        }
      } catch (error) {
        console.error('❌ Configuration command failed:', error.message);
        process.exit(1);
      }
    });
}
