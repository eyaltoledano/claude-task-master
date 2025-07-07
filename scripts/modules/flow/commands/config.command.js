/**
 * @fileoverview Flow System CLI Commands - Configuration & Error Handling
 *
 * CLI commands for managing Flow configuration, error handling, and logging.
 */

import {
	initializeFlowSystem,
	getFlowSystemConfig,
	applyEnvironmentConfig,
	ENVIRONMENT_CONFIGS
} from '../services/flow-system-integration.js';
import { LOG_LEVELS } from '../logging/flow-logger.js';
import chalk from 'chalk';
import { FlowConfig, ConfigurationError } from '../config/flow-config.js';

/**
 * Initialize Flow System command
 */
export async function initCommand(options = {}) {
	const {
		verbose = false,
		environment = 'development',
		configFile,
		validate = true
	} = options;

	try {
		console.log(
			'🚀 Initializing Flow System: Configuration & Error Handling...'
		);

		const result = await initializeFlowSystem({
			environment,
			configFile,
			validate
		});

		const summary = result.getSummary();

		if (verbose) {
			console.log('\n📋 Initialization Summary:');
			console.log(JSON.stringify(summary, null, 2));
		} else {
			console.log('✅ Flow System initialized successfully');
			console.log(`   Environment: ${environment}`);
			console.log(
				`   Configuration: ${summary.components.configuration.configFile || 'default'}`
			);
			console.log(`   Log Level: ${summary.components.configuration.level}`);
			console.log(`   Provider: ${summary.components.configuration.provider}`);
			console.log(`   Agent: ${summary.components.configuration.agent}`);
		}

		return { success: true, summary };
	} catch (error) {
		console.error('❌ Flow System initialization failed:', error.message);
		if (verbose) {
			console.error(error.stack);
		}
		return { success: false, error: error.message };
	}
}

/**
 * Show configuration command
 */
export async function configShowCommand(options = {}) {
	const { verbose = false, json = false } = options;

	try {
		// Initialize config if not already done
		const flowConfig = new FlowConfig();
		const result = await flowConfig.initialize({ validate: false });

		if (json) {
			console.log(
				JSON.stringify(
					{
						config: flowConfig.getAll(),
						sources: result.sources
					},
					null,
					2
				)
			);
			return;
		}

		console.log(chalk.cyan('🔧 Flow Configuration'));
		console.log(chalk.gray('─'.repeat(50)));

		const config = flowConfig.getAll();

		// Core Configuration
		console.log(chalk.yellow('\n📦 Core Settings:'));
		console.log(`   Environment: ${chalk.green(config.nodeEnv)}`);
		console.log(`   Default Provider: ${chalk.green(config.defaultProvider)}`);
		console.log(`   Default Agent: ${chalk.green(config.defaultAgent)}`);
		console.log(
			`   Debug Mode: ${config.debugMode ? chalk.green('enabled') : chalk.red('disabled')}`
		);

		// Provider Configuration
		console.log(chalk.yellow('\n🌐 Provider Settings:'));
		console.log(`   Provider Timeout: ${chalk.cyan(config.providerTimeout)}ms`);
		console.log(`   Agent Timeout: ${chalk.cyan(config.agentTimeout)}ms`);
		console.log(`   Agent Max Retries: ${chalk.cyan(config.agentMaxRetries)}`);

		// Execution Configuration
		console.log(chalk.yellow('\n⚡ Execution Settings:'));
		console.log(
			`   Execution Timeout: ${chalk.cyan(config.executionTimeout)}ms`
		);
		console.log(
			`   Max Concurrent: ${chalk.cyan(config.maxConcurrentExecutions)}`
		);
		console.log(
			`   Cleanup on Exit: ${config.cleanupOnExit ? chalk.green('enabled') : chalk.red('disabled')}`
		);

		// Streaming Configuration
		console.log(chalk.yellow('\n📡 Streaming Settings:'));
		console.log(
			`   Streaming Enabled: ${config.streamingEnabled ? chalk.green('enabled') : chalk.red('disabled')}`
		);
		console.log(`   Batch Size: ${chalk.cyan(config.streamingBatchSize)}`);
		console.log(
			`   Flush Interval: ${chalk.cyan(config.streamingFlushInterval)}ms`
		);

		if (verbose) {
			// Logging Configuration
			console.log(chalk.yellow('\n📝 Logging Settings:'));
			console.log(`   Log Level: ${chalk.cyan(config.logLevel)}`);
			console.log(`   Log Format: ${chalk.cyan(config.logFormat)}`);
			console.log(
				`   Log to File: ${config.logToFile ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			if (config.logToFile) {
				console.log(`   Log File Path: ${chalk.gray(config.logFilePath)}`);
			}

			// Error Handling Configuration
			console.log(chalk.yellow('\n🛡️  Error Handling:'));
			console.log(
				`   Retries Enabled: ${config.enableRetries ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			console.log(
				`   Retry Backoff Factor: ${chalk.cyan(config.retryBackoffFactor)}`
			);
			console.log(`   Retry Max Delay: ${chalk.cyan(config.retryMaxDelay)}ms`);
			console.log(
				`   Circuit Breaker: ${config.enableCircuitBreaker ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			console.log(
				`   Circuit Breaker Threshold: ${chalk.cyan(config.circuitBreakerThreshold)}`
			);

			// Health Monitoring
			console.log(chalk.yellow('\n💚 Health Monitoring:'));
			console.log(
				`   Health Check Interval: ${chalk.cyan(config.healthCheckInterval)}ms`
			);
			console.log(
				`   Health Check Timeout: ${chalk.cyan(config.healthCheckTimeout)}ms`
			);

			// Storage Configuration
			console.log(chalk.yellow('\n💾 Storage Settings:'));
			console.log(`   Data Directory: ${chalk.gray(config.dataDirectory)}`);
			console.log(`   State Directory: ${chalk.gray(config.stateDirectory)}`);
			console.log(
				`   Cache Enabled: ${config.cacheEnabled ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			console.log(`   Cache TTL: ${chalk.cyan(config.cacheTtl)}s`);

			// Security & Development
			console.log(chalk.yellow('\n🔒 Security & Development:'));
			console.log(
				`   Telemetry: ${config.enableTelemetry ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			if (config.telemetryEndpoint) {
				console.log(
					`   Telemetry Endpoint: ${chalk.gray(config.telemetryEndpoint)}`
				);
			}
			console.log(
				`   Verbose Logging: ${config.verboseLogging ? chalk.green('enabled') : chalk.red('disabled')}`
			);
			console.log(
				`   Mock Delays: ${config.mockDelays ? chalk.green('enabled') : chalk.red('disabled')}`
			);

			// Configuration Sources
			console.log(chalk.yellow('\n📋 Configuration Sources:'));
			console.log(
				`   Default Values: ${chalk.cyan(result.sources.defaults)} settings`
			);
			console.log(
				`   Configuration File: ${chalk.cyan(result.sources.file)} settings`
			);
			console.log(
				`   Environment Variables: ${chalk.cyan(result.sources.environment)} settings`
			);
		}

		console.log(chalk.gray('\n💡 Use --verbose for detailed configuration'));
		console.log(
			chalk.gray('💡 Use "flow config set <key> <value>" to change settings')
		);
		console.log(
			chalk.gray('💡 Use "flow provider set <name>" to change default provider')
		);
	} catch (error) {
		if (json) {
			console.log(
				JSON.stringify({ success: false, error: error.message }, null, 2)
			);
			return;
		}

		console.error(
			chalk.red(`❌ Failed to show configuration: ${error.message}`)
		);
		if (verbose) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

/**
 * Set configuration value command
 */
export async function configSetCommand(key, value, options = {}) {
	const { verbose = false } = options;

	try {
		// Initialize config
		const flowConfig = new FlowConfig();
		await flowConfig.initialize();

		const oldValue = flowConfig.get(key);

		// Parse value based on type
		let parsedValue = value;
		if (value === 'true') parsedValue = true;
		else if (value === 'false') parsedValue = false;
		else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
		else if (/^\d*\.\d+$/.test(value)) parsedValue = parseFloat(value);

		// Set the value
		flowConfig.set(key, parsedValue);

		// Validate the updated configuration
		try {
			flowConfig.validate();
		} catch (validationError) {
			throw new ConfigurationError(
				`Invalid value for ${key}: ${validationError.message}`
			);
		}

		// Save to file
		await flowConfig.save();

		console.log(chalk.green(`✅ Configuration updated`));
		console.log(`   Key: ${chalk.cyan(key)}`);
		console.log(`   Old Value: ${chalk.gray(oldValue)}`);
		console.log(`   New Value: ${chalk.green(parsedValue)}`);

		if (verbose) {
			console.log(`   Type: ${chalk.yellow(typeof parsedValue)}`);
		}

		console.log(
			chalk.gray('\n💡 Use "flow config show" to view current configuration')
		);
	} catch (error) {
		console.error(
			chalk.red(`❌ Failed to set configuration: ${error.message}`)
		);
		if (verbose) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

/**
 * Apply environment configuration command
 */
export async function configEnvCommand(environment, options = {}) {
	const { verbose = false } = options;

	try {
		// Validate environment
		if (!['development', 'production', 'test'].includes(environment)) {
			throw new ConfigurationError(
				`Invalid environment: ${environment}. Available: development, production, test`
			);
		}

		// Initialize config
		const flowConfig = new FlowConfig();
		await flowConfig.initialize();

		// Get environment template
		const template = FlowConfig.getTemplate(environment);

		console.log(
			chalk.cyan(`🔧 Applying ${environment} environment configuration...`)
		);
		console.log(chalk.gray('─'.repeat(50)));

		// Apply each template setting
		const changes = [];
		for (const [key, value] of Object.entries(template)) {
			const oldValue = flowConfig.get(key);
			if (oldValue !== value) {
				flowConfig.set(key, value);
				changes.push({ key, oldValue, newValue: value });
			}
		}

		if (changes.length === 0) {
			console.log(
				chalk.yellow(
					`⚠️  No changes needed - configuration already matches ${environment} environment`
				)
			);
			return;
		}

		// Validate the updated configuration
		flowConfig.validate();

		// Save to file
		await flowConfig.save();

		console.log(
			chalk.green(`✅ Applied ${environment} environment configuration`)
		);
		console.log(`   Changes: ${chalk.cyan(changes.length)} settings updated`);

		if (verbose) {
			console.log(chalk.yellow('\n📋 Changes Applied:'));
			changes.forEach(({ key, oldValue, newValue }) => {
				console.log(
					`   ${chalk.cyan(key)}: ${chalk.gray(oldValue)} → ${chalk.green(newValue)}`
				);
			});
		}

		console.log(
			chalk.gray('\n💡 Use "flow config show" to view updated configuration')
		);
	} catch (error) {
		console.error(
			chalk.red(
				`❌ Failed to apply environment configuration: ${error.message}`
			)
		);
		if (verbose) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

/**
 * Show error handling status command
 */
export async function errorStatusCommand(options = {}) {
	const { verbose = false } = options;

	try {
		const { errorManager } = await getFlowSystemConfig();
		const status = errorManager.getStatus();

		console.log('🛡️ Error Handling Status:');
		console.log('');

		// Circuit breakers
		console.log('⚡ Circuit Breakers:');
		if (status.circuitBreakers.length === 0) {
			console.log('   No circuit breakers registered');
		} else {
			for (const breaker of status.circuitBreakers) {
				const stateIcon =
					breaker.state === 'CLOSED'
						? '🟢'
						: breaker.state === 'OPEN'
							? '🔴'
							: '🟡';
				console.log(`   ${stateIcon} ${breaker.name}: ${breaker.state}`);
				if (verbose) {
					console.log(
						`      Failures: ${breaker.failureCount}/${breaker.threshold}`
					);
					if (breaker.lastFailureTime) {
						console.log(
							`      Last Failure: ${new Date(breaker.lastFailureTime).toLocaleString()}`
						);
					}
				}
			}
		}
		console.log('');

		// Retry handlers
		console.log('🔄 Retry Handlers:');
		if (status.retryHandlers.length === 0) {
			console.log('   No retry handlers registered');
		} else {
			for (const handler of status.retryHandlers) {
				console.log(`   📋 ${handler}`);
			}
		}
		console.log('');

		// Recovery strategies
		console.log('🔧 Recovery Strategies:');
		if (status.recoveryStrategies.length === 0) {
			console.log('   No recovery strategies registered');
		} else {
			for (const strategy of status.recoveryStrategies) {
				console.log(`   🎯 ${strategy}`);
			}
		}

		return { success: true, status };
	} catch (error) {
		console.error('❌ Failed to show error handling status:', error.message);
		return { success: false, error: error.message };
	}
}

/**
 * Reset circuit breaker command
 */
export async function errorResetCommand(breakerName, options = {}) {
	try {
		const { errorManager, logger } = await getFlowSystemConfig();
		const breaker = errorManager.getCircuitBreaker(breakerName);

		if (!breaker) {
			throw new Error(`Circuit breaker '${breakerName}' not found`);
		}

		breaker.reset();

		await logger.info('Circuit breaker reset', {
			category: 'circuit_breaker',
			breaker: breakerName
		});

		console.log(`✅ Reset circuit breaker: ${breakerName}`);
		return { success: true, breaker: breakerName };
	} catch (error) {
		console.error('❌ Failed to reset circuit breaker:', error.message);
		return { success: false, error: error.message };
	}
}

/**
 * Show logging status command
 */
export async function loggingStatusCommand(options = {}) {
	const { verbose = false } = options;

	try {
		const { logger } = await getFlowSystemConfig();

		console.log('📝 Logging Status:');
		console.log('');
		console.log(`   Level: ${logger.level}`);
		console.log(`   Enabled: ${logger.enabled}`);
		console.log(`   Transports: ${logger.transports.size}`);
		console.log('');

		console.log('🚀 Available Transports:');
		for (const [name, transport] of logger.transports.entries()) {
			const enabledIcon = transport.enabled ? '✅' : '❌';
			console.log(
				`   ${enabledIcon} ${name} (${transport.format}, level: ${transport.level})`
			);

			if (verbose && transport.filename) {
				console.log(`      File: ${transport.filename}`);
			}
		}

		// Get memory transport logs if available
		const memoryTransport = logger.getTransport('memory');
		if (memoryTransport && verbose) {
			const logs = memoryTransport.getLogs();
			console.log('');
			console.log(`📊 Memory Transport: ${logs.length} logs stored`);

			const logsByLevel = {};
			for (const log of logs) {
				logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
			}

			for (const [level, count] of Object.entries(logsByLevel)) {
				console.log(`   ${level}: ${count}`);
			}
		}

		return {
			success: true,
			status: {
				level: logger.level,
				enabled: logger.enabled,
				transports: logger.transports.size
			}
		};
	} catch (error) {
		console.error('❌ Failed to show logging status:', error.message);
		return { success: false, error: error.message };
	}
}

/**
 * Set log level command
 */
export async function loggingSetLevelCommand(level, options = {}) {
	try {
		if (!(level in LOG_LEVELS)) {
			throw new Error(
				`Invalid log level: ${level}. Available: ${Object.keys(LOG_LEVELS).join(', ')}`
			);
		}

		const { logger } = await getFlowSystemConfig();
		const oldLevel = logger.level;

		logger.setLevel(level);

		await logger.info('Log level changed', {
			category: 'logging',
			oldLevel,
			newLevel: level
		});

		console.log(`✅ Log level changed from ${oldLevel} to ${level}`);
		return { success: true, oldLevel, newLevel: level };
	} catch (error) {
		console.error('❌ Failed to set log level:', error.message);
		return { success: false, error: error.message };
	}
}

/**
 * Test error handling command
 */
export async function errorTestCommand(
	errorType = 'NetworkError',
	options = {}
) {
	const { withRetry = false, withCircuitBreaker = false } = options;

	try {
		const { errorManager, logger } = await getFlowSystemConfig();

		await logger.info('Starting error handling test', {
			category: 'test',
			errorType,
			withRetry,
			withCircuitBreaker
		});

		// Create a test function that always fails
		const testFn = async () => {
			throw new Error(`Test ${errorType} error`);
		};

		const executeOptions = {};
		if (withRetry) {
			executeOptions.retryHandler = 'default';
		}
		if (withCircuitBreaker) {
			executeOptions.circuitBreaker = 'provider';
		}

		try {
			await errorManager.executeWithRecovery(testFn, executeOptions);
		} catch (error) {
			console.log('✅ Error handling test completed');
			console.log(`   Error Type: ${errorType}`);
			console.log(`   With Retry: ${withRetry}`);
			console.log(`   With Circuit Breaker: ${withCircuitBreaker}`);
			console.log(`   Final Error: ${error.message}`);
		}

		return { success: true, errorType, withRetry, withCircuitBreaker };
	} catch (error) {
		console.error('❌ Error handling test failed:', error.message);
		return { success: false, error: error.message };
	}
}
