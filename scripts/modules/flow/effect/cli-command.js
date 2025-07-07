/**
 * Task Master Flow - Effect CLI Command Integration
 * Phase 0-3: Foundation, Schema, Provider Abstraction & Execution Engine
 *
 * Provides CLI commands for testing and managing Effect integration.
 */

import { runFlowEffect } from './runtime.js';
import { healthCheck, extendedHealthCheck } from './effects/health.js';
import { runBasicIntegrationTest, runSmokeTest } from './test-integration.js';
import {
	EFFECT_MODULE_VERSION,
	EFFECT_FEATURES,
	isEffectAvailable
} from './index.js';

// Phase 2: Provider Abstraction imports
import { Effect, Runtime, Layer } from 'effect';
import {
	ProviderRegistryLive,
	ProviderRegistry
} from '../providers/registry.js';
import { getProviderFromConfig } from '../providers/registry.js';
import { SandboxProvider } from '../providers/provider.interface.js';

// Phase 3: Execution Engine imports
import {
	executeCommand,
	statusCommand,
	cancelCommand,
	streamCommand,
	executeTasks,
	validateTaskConfig,
	debugCommand
} from '../commands/execution.command.js';

// Phase 5: Agent Integration imports
import {
	listAgentsCommand,
	testAgentCommand,
	healthCheckCommand,
	generateCodeCommand,
	agentStatsCommand
} from '../commands/agent.command.js';

/**
 * Handle flow:health command
 *
 * @param {Object} options - Command options
 */
export async function handleFlowHealthCommand(options = {}) {
	try {
		console.log(
			`🌊 Task Master Flow Effect Health Check v${EFFECT_MODULE_VERSION}`
		);
		console.log('─'.repeat(50));

		// Check if Effect is available
		const effectAvailable = await isEffectAvailable();
		if (!effectAvailable) {
			console.error('❌ Effect is not available. Please check installation.');
			process.exit(1);
		}

		// Run appropriate health check
		const healthResult = options.extended
			? await runFlowEffect(extendedHealthCheck)
			: await runFlowEffect(healthCheck);

		// Display results
		console.log('✅ Health Check Results:');
		console.log(`   Status: ${healthResult.status}`);
		console.log(`   Module: ${healthResult.module}`);
		console.log(`   Version: ${healthResult.version}`);
		console.log(`   Phase: ${healthResult.phase}`);
		console.log(`   Timestamp: ${healthResult.timestamp}`);

		if (options.extended && healthResult.extended) {
			console.log('\n🔍 Extended Diagnostics:');
			console.log(
				`   Environment: ${JSON.stringify(healthResult.extended.environment, null, 2)}`
			);
			console.log(
				`   File System: ${JSON.stringify(healthResult.extended.fileSystem, null, 2)}`
			);
		}

		if (options.json) {
			console.log('\n📄 JSON Output:');
			console.log(JSON.stringify(healthResult, null, 2));
		}

		return healthResult;
	} catch (error) {
		console.error('❌ Health check failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:test command
 *
 * @param {Object} options - Command options
 */
export async function handleFlowTestCommand(options = {}) {
	try {
		console.log(
			`🧪 Task Master Flow Effect Integration Tests v${EFFECT_MODULE_VERSION}`
		);
		console.log('─'.repeat(60));

		if (options.smoke) {
			console.log('🚀 Running smoke test...');
			const passed = await runSmokeTest();
			console.log(passed ? '✅ Smoke test passed' : '❌ Smoke test failed');
			process.exit(passed ? 0 : 1);
		}

		// Run full integration test
		const results = await runBasicIntegrationTest();

		if (options.json) {
			console.log(JSON.stringify(results, null, 2));
		}

		const success = results.overall === 'passed';
		process.exit(success ? 0 : 1);
	} catch (error) {
		console.error('❌ Test command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:info command
 *
 * @param {Object} options - Command options
 */
export async function handleFlowInfoCommand(options = {}) {
	try {
		const info = {
			module: 'task-master-flow-effect',
			version: EFFECT_MODULE_VERSION,
			phase:
				'Phase 0-3: Foundation, Schema, Provider Abstraction & Execution Engine',
			features: {
				...EFFECT_FEATURES,
				providerAbstraction: true,
				mockProvider: true,
				providerRegistry: true,
				resourceManagement: true,
				executionEngine: true,
				taskOrchestration: true,
				streamingResults: true,
				cancellationSupport: true
			},
			effectAvailable: await isEffectAvailable(),
			environment: {
				nodejs: process.version,
				platform: process.platform,
				arch: process.arch
			},
			paths: {
				effectModule: 'scripts/modules/flow/effect',
				dataStorage: '.taskmaster/flow',
				providers: 'scripts/modules/flow/providers',
				schemas: 'scripts/modules/flow/schemas'
			}
		};

		if (options.json) {
			console.log(JSON.stringify(info, null, 2));
		} else {
			console.log(`🌊 Task Master Flow Effect Information`);
			console.log('─'.repeat(40));
			console.log(`Module: ${info.module}`);
			console.log(`Version: ${info.version}`);
			console.log(`Phase: ${info.phase}`);
			console.log(`Effect Available: ${info.effectAvailable ? '✅' : '❌'}`);
			console.log(`Node.js: ${info.environment.nodejs}`);
			console.log(`Platform: ${info.environment.platform}`);

			console.log('\n🚩 Features:');
			Object.entries(info.features).forEach(([feature, enabled]) => {
				const status = enabled ? '✅' : '⏸️';
				console.log(`   ${status} ${feature}`);
			});
		}

		return info;
	} catch (error) {
		console.error('❌ Info command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Create Flow runtime with provider registry for Phase 2 commands
 */
function createFlowRuntimeWithProviders() {
	try {
		// Use default runtime and provide the layer when running effects
		return Runtime.defaultRuntime;
	} catch (error) {
		console.error(
			'Failed to create Flow runtime with providers:',
			error.message
		);
		process.exit(1);
	}
}

/**
 * Run Effect with provider registry
 */
async function runEffectWithProviders(effect) {
	const runtime = createFlowRuntimeWithProviders();
	try {
		// Provide the ProviderRegistryLive layer to the effect
		const effectWithLayer = Effect.provide(effect, ProviderRegistryLive);
		return await Runtime.runPromise(runtime)(effectWithLayer);
	} catch (error) {
		console.error('Flow command failed:', error.message);
		if (process.env.DEBUG) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:providers command - Phase 2 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowProvidersCommand(options = {}) {
	try {
		console.log('🏗️  Task Master Flow Providers');
		console.log('─'.repeat(50));

		const providersEffect = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			if (options.health) {
				console.log('🔍 Checking provider health...');
				const healthResults = yield* registry.checkAllProvidersHealth();
				return { action: 'health', healthResults };
			}

			const providers = yield* registry.listProviders();
			return { action: 'list', providers };
		});

		const results = await runEffectWithProviders(providersEffect);

		if (results.action === 'health') {
			console.log('🏥 Provider Health Status:');
			for (const { key, health } of results.healthResults) {
				const statusIcon =
					health.status === 'healthy'
						? '✅'
						: health.status === 'degraded'
							? '⚠️'
							: '❌';
				console.log(`   ${statusIcon} ${key}: ${health.status}`);
				if (health.responseTime) {
					console.log(`      Response time: ${health.responseTime}ms`);
				}
				if (health.error) {
					console.log(`      Error: ${health.error}`);
				}
			}
		} else {
			console.log('📋 Registered Providers:');
			for (const provider of results.providers) {
				const loadedIcon = provider.isLoaded ? '🟢' : '⚪';
				console.log(`   ${loadedIcon} ${provider.key}`);
				console.log(`      Name: ${provider.name}`);
				console.log(`      Type: ${provider.type}`);
				console.log(`      Loaded: ${provider.isLoaded ? 'Yes' : 'No'}`);
				console.log(
					`      Features: ${provider.config?.features?.join(', ') || 'None'}`
				);
				console.log();
			}
		}

		if (options.json) {
			console.log('\n📄 JSON Output:');
			console.log(JSON.stringify(results, null, 2));
		}
	} catch (error) {
		console.error('❌ Providers command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:resources command - Phase 2 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowResourcesCommand(options = {}) {
	try {
		console.log('📦 Task Master Flow Resources');
		console.log('─'.repeat(50));

		const resourcesEffect = Effect.gen(function* () {
			const providerType = options.provider || 'mock';
			console.log(`🏗️  Using provider: ${providerType}`);

			const config = { provider: providerType, type: providerType };
			const provider = yield* getProviderFromConfig(config);

			if (options.create) {
				console.log('📦 Creating test resource...');
				const resource = yield* provider.createResource({
					type: 'test-container',
					resources: { cpu: 1, memory: 1024, storage: 5000 },
					tags: {
						test: 'cli-test',
						created: new Date().toISOString().split('T')[0]
					}
				});

				console.log(`✅ Resource created: ${resource.id}`);
				console.log(`   State: ${resource.state}`);
				console.log(`   Health: ${resource.health}`);

				return { action: 'created', resource };
			}

			if (options.list) {
				console.log('📋 Listing resources...');
				const resources = yield* provider.listResources();

				if (resources.length === 0) {
					console.log('   No resources found');
				} else {
					for (const resource of resources) {
						console.log(`   📦 ${resource.id}`);
						console.log(`      State: ${resource.state}`);
						console.log(`      Health: ${resource.health}`);
						console.log(`      Created: ${resource.createdAt}`);
						if (resource.tags) {
							console.log(
								`      Tags: ${Object.entries(resource.tags)
									.map(([k, v]) => `${k}=${v}`)
									.join(', ')}`
							);
						}
						console.log();
					}
				}

				return { action: 'listed', count: resources.length };
			}

			// Default: show capabilities
			const capabilities = yield* provider.getCapabilities();
			return { action: 'capabilities', capabilities };
		});

		const results = await runEffectWithProviders(resourcesEffect);

		if (results.action === 'capabilities') {
			console.log('🔧 Provider Capabilities:');
			const caps = results.capabilities;
			console.log(`   Name: ${caps.name}`);
			console.log(`   Supported Actions: ${caps.supportedActions.join(', ')}`);
			console.log(`   Max CPU: ${caps.maxCpu} cores`);
			console.log(`   Max Memory: ${caps.maxMemory} MB`);
			console.log(`   Max Storage: ${caps.maxStorage} MB`);
			console.log(
				`   Networking: External=${caps.networking.externalAccess}, IP Whitelist=${caps.networking.ipWhitelisting}`
			);
			console.log(
				`   Security: TLS=${caps.security.tlsSupport}, Secrets=${caps.security.secretsManagement}`
			);
			console.log(`   Regions: ${caps.regions.join(', ')}`);
			console.log(`   Features: ${caps.features?.join(', ') || 'None'}`);
		}

		if (options.json) {
			console.log('\n📄 JSON Output:');
			console.log(JSON.stringify(results, null, 2));
		}

		console.log(`\n✅ ${results.action} operation completed`);
	} catch (error) {
		console.error('❌ Resources command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:execute command - Phase 3 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowExecuteCommand(options = {}) {
	try {
		console.log('🚀 Task Master Flow Execute');
		console.log('─'.repeat(50));

		// Validate required options
		if (!options.taskId) {
			console.error('❌ Task ID is required. Use --task-id <id>');
			process.exit(1);
		}

		// Build task configuration
		const taskConfig = {
			taskId: options.taskId,
			provider: options.provider || 'mock',
			action: options.action || 'run',
			code: options.code || 'console.log("Hello from Flow execution!");',
			language: options.language || 'javascript',
			timeout: options.timeout ? parseInt(options.timeout) : 30000,
			environment: options.env ? JSON.parse(options.env) : {},
			secrets: options.secrets ? JSON.parse(options.secrets) : {}
		};

		// Validate configuration
		validateTaskConfig(taskConfig);

		console.log(`📋 Task Configuration:`);
		console.log(`   Task ID: ${taskConfig.taskId}`);
		console.log(`   Provider: ${taskConfig.provider}`);
		console.log(`   Action: ${taskConfig.action}`);
		console.log(`   Language: ${taskConfig.language}`);
		console.log(`   Timeout: ${taskConfig.timeout}ms`);
		console.log();

		// Execute the task
		const result = await executeCommand(taskConfig, {
			stream: options.stream,
			verbose: options.verbose,
			json: options.json
		});

		// Result display is handled by executeCommand

		return result;
	} catch (error) {
		console.error('❌ Execute command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:status command - Phase 3 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowStatusCommand(options = {}) {
	try {
		console.log('📊 Task Master Flow Status');
		console.log('─'.repeat(50));

		// Use the enhanced status command that handles both single and list operations
		await statusCommand(options.executionId, {
			status: options.status,
			verbose: options.verbose,
			json: options.json
		});
	} catch (error) {
		console.error('❌ Status command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:cancel command - Phase 3 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowCancelCommand(options = {}) {
	try {
		console.log('🛑 Task Master Flow Cancel');
		console.log('─'.repeat(50));

		if (!options.executionId) {
			console.error('❌ Execution ID is required. Use --execution-id <id>');
			process.exit(1);
		}

		const result = await cancelCommand(
			options.executionId,
			options.reason || 'User requested cancellation',
			{
				json: options.json,
				verbose: options.verbose
			}
		);

		// Result display is handled by cancelCommand

		return result;
	} catch (error) {
		console.error('❌ Cancel command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:stream command - Phase 3 functionality
 *
 * @param {Object} options - Command options
 */
export async function handleFlowStreamCommand(options = {}) {
	try {
		console.log('📡 Task Master Flow Stream');
		console.log('─'.repeat(50));

		if (!options.executionId) {
			console.error('❌ Execution ID is required. Use --execution-id <id>');
			process.exit(1);
		}

		// Set up Ctrl+C handler
		process.on('SIGINT', () => {
			console.log('\n📡 Streaming stopped by user');
			process.exit(0);
		});

		await streamCommand(options.executionId, {
			json: options.json,
			noColors: options.quiet,
			verbose: options.verbose
		});
	} catch (error) {
		console.error('❌ Stream command failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:debug command - Enhanced execution service test with streaming capabilities
 */
export async function handleFlowDebugCommand(options = {}) {
	try {
		// Use the enhanced debug command with Phase 4 streaming capabilities
		await debugCommand(options);
	} catch (error) {
		console.error('❌ Debug test failed:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:agent command with subcommands - Phase 5 Agent Integration
 */
export async function handleFlowAgentCommand(
	subcommand,
	provider = null,
	options = {}
) {
	try {
		switch (subcommand) {
			case 'list':
				await listAgentsCommand(options);
				break;

			case 'test':
				if (!provider) {
					throw new Error('Provider is required for test command');
				}
				await testAgentCommand(provider, options);
				break;

			case 'health':
				await healthCheckCommand(provider, options);
				break;

			case 'stats':
				await agentStatsCommand(options);
				break;

			default:
				console.error(`❌ Unknown agent subcommand: ${subcommand}`);
				console.log(
					'Available commands: list, test <provider>, health [provider], stats'
				);
				process.exit(1);
		}
	} catch (error) {
		console.error(`❌ Agent command failed: ${error.message}`);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Handle flow:generate command - Phase 5 AI Code Generation
 */
export async function handleFlowGenerateCommand(task, options = {}) {
	try {
		if (!task) {
			throw new Error('Task description is required for code generation');
		}

		await generateCodeCommand(task, options);
	} catch (error) {
		console.error(`❌ Code generation failed: ${error.message}`);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
		process.exit(1);
	}
}

/**
 * Register Effect commands with Task Master CLI
 *
 * @param {Object} program - Commander.js program instance
 */
export function registerEffectCommands(program) {
	// flow:health command
	program
		.command('flow:health')
		.description('Check Task Master Flow Effect integration health')
		.option('--extended', 'Run extended health check with diagnostics')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowHealthCommand);

	// flow:test command
	program
		.command('flow:test')
		.description('Run Task Master Flow Effect integration tests')
		.option('--smoke', 'Run only smoke test (quick)')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowTestCommand);

	// flow:info command
	program
		.command('flow:info')
		.description('Show Task Master Flow Effect module information')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed information')
		.action(handleFlowInfoCommand);

	// flow:providers command - Phase 2
	program
		.command('flow:providers')
		.description('List and manage sandbox providers')
		.option('--health', 'Check health of all providers')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowProvidersCommand);

	// flow:resources command - Phase 2
	program
		.command('flow:resources')
		.description('Test resource operations with providers')
		.option('--create', 'Create a test resource')
		.option('--list', 'List existing resources')
		.option(
			'--provider <type>',
			'Specify provider type (default: mock)',
			'mock'
		)
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowResourcesCommand);

	// flow:execute command - Phase 3
	program
		.command('flow:execute')
		.description('Execute tasks in sandbox environments')
		.requiredOption('--task-id <id>', 'Task ID to execute')
		.option(
			'--provider <type>',
			'Sandbox provider to use (default: mock)',
			'mock'
		)
		.option('--action <action>', 'Action to perform (default: run)', 'run')
		.option(
			'--code <code>',
			'Code to execute',
			'console.log("Hello from Flow execution!");'
		)
		.option(
			'--language <lang>',
			'Programming language (default: javascript)',
			'javascript'
		)
		.option('--timeout <ms>', 'Execution timeout in milliseconds', '30000')
		.option('--env <json>', 'Environment variables as JSON string')
		.option('--secrets <json>', 'Secrets as JSON string')
		.option('--stream', 'Stream execution updates in real-time')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowExecuteCommand);

	// flow:status command - Phase 3
	program
		.command('flow:status')
		.description('Check execution status or list executions')
		.option('--execution-id <id>', 'Get status for specific execution')
		.option(
			'--status <status>',
			'Filter by execution status (pending, running, completed, failed, cancelled)'
		)
		.option('--provider <type>', 'Filter by provider type')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed information')
		.action(handleFlowStatusCommand);

	// flow:cancel command - Phase 3
	program
		.command('flow:cancel')
		.description('Cancel running execution')
		.requiredOption('--execution-id <id>', 'Execution ID to cancel')
		.option('--reason <reason>', 'Cancellation reason')
		.option('--json', 'Output results in JSON format')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowCancelCommand);

	// flow:stream command - Phase 3
	program
		.command('flow:stream')
		.description('Stream execution updates in real-time')
		.requiredOption('--execution-id <id>', 'Execution ID to stream')
		.option('--json', 'Output updates in JSON format')
		.option('--quiet', 'Suppress non-essential output')
		.option('--verbose', 'Show detailed information')
		.action(handleFlowStreamCommand);

	// flow:debug command - Phase 3
	program
		.command('flow:debug')
		.description('Simple execution service test')
		.option('--verbose', 'Show detailed error information')
		.action(handleFlowDebugCommand);
}
