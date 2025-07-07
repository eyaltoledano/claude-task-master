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
	// flow command - Interactive TUI with sandbox provider management
	programInstance
		.command('flow [subcommand]')
		.description('Launch interactive TUI for task management or manage sandbox providers')
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
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.option('--provider <type>', 'Specify provider type')
		.addHelpText('after', `
Available Subcommands:
  provider    Manage sandbox providers (VibeKit integration)
  config      Manage Flow configuration and provider selection

Provider Management:
  task-master flow provider list                      # List all available providers
  task-master flow provider list --verbose            # Show detailed provider information
  task-master flow provider test <name>               # Test provider connectivity
  task-master flow provider capabilities <name>       # Show provider capabilities
  task-master flow provider set <name>                # Set default provider
  task-master flow provider switch <name>             # Switch to provider temporarily

Configuration Management:
  task-master flow config show                        # Show current configuration
  task-master flow config show --verbose              # Show detailed configuration
  task-master flow config set <key> <value>           # Set configuration value
  task-master flow config env <environment>           # Apply environment preset

Available Providers:
  mock        Mock provider for testing and development
  e2b         E2B AI-focused sandbox platform
  daytona     Daytona cloud-based development environments
  modal       Modal Labs serverless compute with GPU support
  fly         Fly.io global edge compute platform

Examples:
  task-master flow                                     # Launch interactive TUI
  task-master flow provider list                      # List all providers
  task-master flow provider set e2b                   # Set E2B as default provider
  task-master flow config show                        # Show current configuration
  task-master flow config set defaultProvider modal   # Set Modal as default provider`)
		.action(async (subcommand, options) => {
			try {
				// Handle provider subcommand
				if (subcommand === 'provider') {
					// Import provider commands from execution.command.js
					const { executionCommands } = await import('./commands/execution.command.js');
					
					const providerAction = process.argv[4] || 'list'; // Get action after 'flow provider'
					const providerName = process.argv[5]; // Get provider name if specified
					
					const providerOptions = {
						...options,
						action: providerAction,
						provider: providerName
					};
					
					await executionCommands.provider(providerOptions);
					return;
				}

				// Handle config subcommand
				if (subcommand === 'config') {
					// Import config commands from config.command.js
					const { 
						configShowCommand, 
						configSetCommand, 
						configEnvCommand 
					} = await import('./commands/config.command.js');
					
					const configAction = process.argv[4] || 'show'; // Get action after 'flow config'
					const configKey = process.argv[5]; // Get config key if specified
					const configValue = process.argv[6]; // Get config value if specified
					
					switch (configAction) {
						case 'show':
							await configShowCommand({ 
								verbose: options.verbose, 
								json: options.json 
							});
							break;
						case 'set':
							if (!configKey || !configValue) {
								console.error(chalk.red('Config key and value required for set command'));
								console.log(chalk.yellow('Usage: task-master flow config set <key> <value>'));
								process.exit(1);
							}
							await configSetCommand(configKey, configValue, { 
								verbose: options.verbose 
							});
							break;
						case 'env':
							if (!configKey) {
								console.error(chalk.red('Environment required for env command'));
								console.log(chalk.yellow('Usage: task-master flow config env <environment>'));
								console.log(chalk.yellow('Available: development, production, test'));
								process.exit(1);
							}
							await configEnvCommand(configKey, { 
								verbose: options.verbose 
							});
							break;
						default:
							console.error(chalk.red(`Unknown config action: ${configAction}`));
							console.log(chalk.yellow('Available actions: show, set, env'));
							process.exit(1);
					}
					return;
				}
				
				// Handle unknown subcommands
				if (subcommand && subcommand !== 'provider' && subcommand !== 'config') {
					console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
					console.log(chalk.yellow('Available subcommands: provider, config'));
					console.log(chalk.yellow('Run without subcommand to launch interactive TUI'));
					console.log(chalk.yellow(''));
					console.log(chalk.yellow('Provider commands:'));
					console.log(chalk.yellow('  task-master flow provider list                 # List all providers'));
					console.log(chalk.yellow('  task-master flow provider set <name>          # Set default provider'));
					console.log(chalk.yellow('  task-master flow provider test <name>         # Test provider health'));
					console.log(chalk.yellow(''));
					console.log(chalk.yellow('Config commands:'));
					console.log(chalk.yellow('  task-master flow config show                  # Show configuration'));
					console.log(chalk.yellow('  task-master flow config set <key> <value>     # Set config value'));
					console.log(chalk.yellow(''));
					console.log(chalk.yellow('Available providers: mock, e2b, daytona, modal, fly'));
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