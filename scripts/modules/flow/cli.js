/**
 * @fileoverview Flow CLI Module - Command Registration
 * 
 * Handles registration of the Flow command and all its subcommands.
 * Keeps Flow functionality contained within the flow directory.
 */

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { findProjectRoot } from '../utils.js';

/**
 * Register the Flow command and all its subcommands
 * @param {Object} programInstance - Commander program instance
 */
export function registerFlowCommand(programInstance) {
	// flow command - Interactive TUI with Effect integration subcommands
	programInstance
		.command('flow [subcommand]')
		.description('Launch interactive TUI for task management or run Effect integration commands')
		.option(
			'--backend <type>',
			'Backend type: direct, cli, or mcp (default: direct)'
		)
		.option(
			'--mcp-server <id>',
			'MCP server ID to use with mcp backend (default: uses default server)'
		)
		.option(
			'--project-root <path>',
			'Specify the project directory to manage tasks for (default: auto-detect)'
		)
		.option('--extended', 'Extended health check with diagnostics (for health subcommand)')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.option('--smoke', 'Run only smoke test (for test subcommand)')
		.option('--health', 'Check health of all providers (for providers subcommand)')
		.option('--create', 'Create a test resource (for resources subcommand)')
		.option('--list', 'List existing resources (for resources subcommand)')
		.option('--provider <type>', 'Specify provider type (for resources subcommand)')
		.option('--task-id <id>', 'Task ID for execution (for execute subcommand)')
		.option('--code <code>', 'Code to execute (for execute subcommand)')
		.option('--language <lang>', 'Programming language (for execute subcommand)', 'javascript')
		.option('--timeout <ms>', 'Execution timeout in milliseconds (for execute subcommand)', '30000')
		.option('--execution-id <id>', 'Execution ID (for status/cancel/stream subcommands)')
		.option('--filter <status>', 'Filter executions by status (for status subcommand)')
		.option('--follow', 'Follow execution updates in real-time (for stream subcommand)')
		.addHelpText('after', `
Effect Integration Subcommands:
  health      Check Effect integration health and status
  test        Run Effect integration tests
  info        Display Effect module information
  providers   List and manage sandbox providers (Phase 2)
  resources   Test resource operations with providers (Phase 2)
  execute     Execute tasks in sandbox environments (Phase 3)
  status      Check execution status or list executions (Phase 3)
  cancel      Cancel running execution (Phase 3)
  stream      Stream execution updates in real-time (Phase 3)
  agent       Manage AI agents (Phase 5)
  generate    Generate code using AI agents (Phase 5)

Examples:
  task-master flow                                    # Launch interactive TUI
  task-master flow health                             # Check Effect integration
  task-master flow test                               # Run Effect tests
  task-master flow info                               # Show Effect info
  task-master flow providers --health                 # Check provider health
  task-master flow resources --create                 # Create test resource
  task-master flow execute --task-id test1 --code "console.log('Hello')"
  task-master flow status --execution-id exec123      # Check execution status
  task-master flow cancel --execution-id exec123      # Cancel execution
  task-master flow stream --execution-id exec123      # Stream execution updates
  task-master flow agent list                         # List available AI agents
  task-master flow agent test mock                    # Test mock agent connectivity
  task-master flow agent health                       # Check all agent health
  task-master flow generate "create a REST API"       # Generate code using AI`)
		.action(async (subcommand, options) => {
			try {
				// Handle Effect integration subcommands
				if (['health', 'test', 'info', 'providers', 'resources', 'execute', 'status', 'cancel', 'stream', 'debug', 'agent', 'generate'].includes(subcommand)) {
					try {
						const { 
							handleFlowHealthCommand, 
							handleFlowTestCommand, 
							handleFlowInfoCommand,
							handleFlowProvidersCommand,
							handleFlowResourcesCommand,
							handleFlowExecuteCommand,
							handleFlowStatusCommand,
							handleFlowCancelCommand,
							handleFlowStreamCommand,
							handleFlowDebugCommand,
							handleFlowAgentCommand,
							handleFlowGenerateCommand
						} = await import('./effect/cli-command.js');
						
						switch (subcommand) {
							case 'health':
								await handleFlowHealthCommand(options);
								break;
							case 'test':
								await handleFlowTestCommand(options);
								break;
							case 'info':
								await handleFlowInfoCommand(options);
								break;
							case 'providers':
								await handleFlowProvidersCommand(options);
								break;
							case 'resources':
								await handleFlowResourcesCommand(options);
								break;
							case 'execute':
								await handleFlowExecuteCommand(options);
								break;
							case 'status':
								await handleFlowStatusCommand(options);
								break;
							case 'cancel':
								await handleFlowCancelCommand(options);
								break;
							case 'stream':
								await handleFlowStreamCommand(options);
								break;
							case 'debug':
								await handleFlowDebugCommand(options);
								break;
							case 'agent': {
								const agentSubcommand = process.argv[4]; // Get the subcommand after 'flow agent'
								// Only treat the next argument as provider if it doesn't start with --
								const nextArg = process.argv[5];
								const agentProvider = (nextArg && !nextArg.startsWith('--')) ? nextArg : null;
								await handleFlowAgentCommand(agentSubcommand, agentProvider, options);
								break;
							}
							case 'generate': {
								const generateTask = process.argv[4]; // Get the task description after 'flow generate'
								await handleFlowGenerateCommand(generateTask, options);
								break;
							}
						}
						return;
					} catch (error) {
						console.error(chalk.red(`Effect integration not available: ${error.message}`));
						process.exit(1);
					}
				}
				
				// If no subcommand or unknown subcommand, launch the TUI
				if (subcommand && !['health', 'test', 'info', 'providers', 'resources', 'execute', 'status', 'cancel', 'stream', 'debug', 'agent', 'generate'].includes(subcommand)) {
					console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
					console.log(chalk.yellow('Available subcommands: health, test, info, providers, resources, execute, status, cancel, stream, debug, agent, generate'));
					console.log(chalk.yellow('Or run without subcommand to launch interactive TUI'));
					process.exit(1);
				}

				// Use specified project directory or auto-detect
				let projectRoot;
				if (options.projectRoot) {
					projectRoot = path.resolve(options.projectRoot);
					// Verify the specified directory exists
					if (!fs.existsSync(projectRoot)) {
						console.error(chalk.red(`Error: Specified project directory does not exist: ${projectRoot}`));
						process.exit(1);
					}
				} else {
					projectRoot = findProjectRoot();
					if (!projectRoot) {
						console.error(chalk.red('Error: Could not find project root.'));
						console.error(chalk.yellow('Hint: Use --project-root <path> to specify the project directory, or run from within a project directory.'));
						process.exit(1);
					}
				}

				// Import and launch the flow TUI
				// Note: Flow UI handles missing tasks.json gracefully
				try {
					const { launchFlow } = await import('./cli-wrapper.js');
					await launchFlow({
						backend: options.backend,
						mcpServerId: options.mcpServer,
						projectRoot
					});
				} catch (error) {
					console.error(chalk.red(`Error launching Flow TUI: ${error.message}`));
					process.exit(1);
				}
			} catch (error) {
				console.error(chalk.red(`Error in flow command: ${error.message}`));
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			process.exit(1);
		});
} 