/**
 * @fileoverview Flow System Integration - Configuration & Error Handling
 *
 * Unified initialization and integration of configuration management,
 * error handling, and logging systems for the Flow module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { flowConfig, initializeFlowConfig } from '../config/flow-config.js';
import {
	initializeErrorHandling,
	errorRecoveryManager
} from '../errors/flow-errors.js';
import { initializeLogging, flowLogger } from '../logging/flow-logger.js';

/**
 * Flow System initialization result
 */
export class FlowSystemInitResult {
	constructor(config, errorManager, logger) {
		this.config = config;
		this.errorManager = errorManager;
		this.logger = logger;
		this.timestamp = new Date().toISOString();
	}

	/**
	 * Get initialization summary
	 */
	getSummary() {
		return {
			phase: 6,
			name: 'Configuration & Error Handling',
			status: 'initialized',
			timestamp: this.timestamp,
			components: {
				configuration: {
					initialized: true,
					configFile: this.config._configFile,
					level: this.config.get('logLevel'),
					provider: this.config.get('defaultProvider'),
					agent: this.config.get('defaultAgent')
				},
				errorHandling: {
					initialized: true,
					circuitBreakers: this.errorManager.circuitBreakers.size,
					retryHandlers: this.errorManager.retryHandlers.size,
					recoveryStrategies: this.errorManager.recoveryStrategies.size
				},
				logging: {
					initialized: true,
					level: this.logger.level,
					transports: this.logger.transports.size,
					enabled: this.logger.enabled
				}
			}
		};
	}
}

/**
 * Initialize Flow System: Configuration & Error Handling
 */
export async function initializeFlowSystem(options = {}) {
	const {
		projectRoot = process.cwd(),
		configFile = '.taskmaster/flow/config.json',
		validate = true,
		environment = process.env.NODE_ENV || 'development'
	} = options;

	try {
		// Step 1: Initialize Configuration
		const configResult = await initializeFlowConfig({
			configFile,
			projectRoot,
			validate
		});

		const config = flowConfig.getAll();

		// Step 2: Initialize Error Handling
		const errorManager = initializeErrorHandling({
			maxRetries: config.agentMaxRetries,
			retryBaseDelay: 1000,
			retryMaxDelay: config.retryMaxDelay,
			retryBackoffFactor: config.retryBackoffFactor,
			circuitBreakerThreshold: config.circuitBreakerThreshold
		});

		// Step 3: Initialize Logging
		const logger = initializeLogging({
			level: config.logLevel,
			format: config.logFormat,
			logToFile: config.logToFile,
			logFilePath: config.logFilePath,
			enableMemoryTransport: config.debugMode
		});

		// Step 4: Setup error recovery strategies
		setupRecoveryStrategies(errorManager, logger);

		// Step 5: Setup logging for error handling events
		setupErrorHandlingLogging(errorManager, logger);

		// Save initialization state
		const stateFile = path.join(
			projectRoot,
			'.taskmaster/flow/state/initialized.json'
		);
		const stateDir = path.dirname(stateFile);
		if (!fs.existsSync(stateDir)) {
			fs.mkdirSync(stateDir, { recursive: true });
		}
		fs.writeFileSync(
			stateFile,
			JSON.stringify(
				{
					initialized: true,
					timestamp: new Date().toISOString(),
					environment,
					version: '1.0.0'
				},
				null,
				2
			)
		);

		// Log successful initialization
		await logger.info('Flow System initialized successfully', {
			category: 'initialization',
			system: 'flow',
			environment,
			config: {
				provider: config.defaultProvider,
				agent: config.defaultAgent,
				retries: config.enableRetries,
				circuitBreaker: config.enableCircuitBreaker
			}
		});

		return new FlowSystemInitResult(flowConfig, errorManager, logger);
	} catch (error) {
		// Use basic console logging if logger initialization failed
		console.error('Flow System initialization failed:', error.message);
		throw error;
	}
}

/**
 * Setup recovery strategies for common error scenarios
 */
function setupRecoveryStrategies(errorManager, logger) {
	// Provider fallback strategy
	errorManager.registerRecoveryStrategy(
		'ProviderError',
		async (error, options) => {
			await logger.warn('Attempting provider fallback', {
				category: 'recovery',
				error: error.code,
				provider: error.provider
			});

			// Could implement actual provider switching logic here
			return null; // For now, let the fallback chain handle it
		}
	);

	// Agent fallback strategy
	errorManager.registerRecoveryStrategy(
		'AgentError',
		async (error, options) => {
			await logger.warn('Attempting agent fallback', {
				category: 'recovery',
				error: error.code,
				agentType: error.agentType
			});

			// Could implement actual agent switching logic here
			return null; // For now, let the retry mechanism handle it
		}
	);

	// Network error retry strategy
	errorManager.registerRecoveryStrategy(
		'NetworkError',
		async (error, options) => {
			await logger.info('Network error detected, will retry', {
				category: 'recovery',
				error: error.code,
				statusCode: error.statusCode,
				endpoint: error.endpoint
			});

			return null; // Let retry handler manage this
		}
	);
}

/**
 * Setup logging for error handling events
 */
function setupErrorHandlingLogging(errorManager, logger) {
	// Circuit breaker state changes
	errorManager.on('circuit_breaker_state_change', async (event) => {
		await logger.warn('Circuit breaker state changed', {
			category: 'circuit_breaker',
			breaker: event.name,
			state: event.state,
			context: event
		});
	});

	// Recovery attempts
	errorManager.on('recovery_attempt', async (event) => {
		await logger.info('Attempting error recovery', {
			category: 'recovery',
			error: event.error.code,
			strategy: event.strategy
		});
	});

	// Recovery success
	errorManager.on('recovery_success', async (event) => {
		await logger.info('Error recovery successful', {
			category: 'recovery',
			error: event.error.code
		});
	});

	// Recovery failure
	errorManager.on('recovery_failed', async (event) => {
		await logger.warn('Error recovery failed', {
			category: 'recovery',
			error: event.error.code,
			recoveryError: event.recoveryError.message
		});
	});
}

/**
 * Check if Flow System is initialized by looking for state file
 */
function isFlowSystemInitialized() {
	const stateFile = path.join(
		process.cwd(),
		'.taskmaster/flow/state/initialized.json'
	);
	return fs.existsSync(stateFile);
}

/**
 * Auto-initialize Flow System if not already initialized
 */
async function ensureFlowSystemInitialized() {
	if (!flowConfig._config && isFlowSystemInitialized()) {
		// Config not loaded but state file exists - load config
		try {
			await flowConfig.initialize();
			initializeErrorHandling();
			initializeLogging();
		} catch (error) {
			// If initialization fails, fall back to auto-init
			await initializeFlowSystem();
		}
	} else if (!flowConfig._config) {
		// Not initialized at all - auto-initialize with defaults
		await initializeFlowSystem();
	}
}

/**
 * Get Flow System configuration
 */
export async function getFlowSystemConfig() {
	await ensureFlowSystemInitialized();

	return {
		config: flowConfig,
		errorManager: errorRecoveryManager,
		logger: flowLogger
	};
}

/**
 * Create configured operation wrapper with full Flow System integration
 */
export async function createOperation(name, options = {}) {
	const { config, errorManager, logger } = await getFlowSystemConfig();

	const operationLogger = logger.child({
		operationType: name,
		operationId: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	});

	return {
		logger: operationLogger,

		async execute(fn, executionOptions = {}) {
			const {
				retryHandler = 'default',
				circuitBreaker = null,
				recovery = true,
				logStart = true,
				logEnd = true
			} = { ...options, ...executionOptions };

			if (logStart) {
				await operationLogger.info(`Operation ${name} started`);
			}

			try {
				const result = await errorManager.executeWithRecovery(fn, {
					retryHandler,
					circuitBreaker,
					recovery
				});

				if (logEnd) {
					await operationLogger.info(
						`Operation ${name} completed successfully`
					);
				}

				return result;
			} catch (error) {
				await operationLogger.logError(error, { operation: name });
				throw error;
			}
		},

		async withTimeout(fn, timeout = null) {
			const actualTimeout = timeout || config.get('executionTimeout');

			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(
						new Error(`Operation ${name} timed out after ${actualTimeout}ms`)
					);
				}, actualTimeout);

				this.execute(fn).then(
					(result) => {
						clearTimeout(timer);
						resolve(result);
					},
					(error) => {
						clearTimeout(timer);
						reject(error);
					}
				);
			});
		},

		getConfig(key, defaultValue) {
			return config.get(key, defaultValue);
		}
	};
}

/**
 * Environment-specific configuration templates
 */
export const ENVIRONMENT_CONFIGS = {
	development: {
		logLevel: 'debug',
		debugMode: true,
		verboseLogging: true,
		enableRetries: true,
		enableCircuitBreaker: false, // Disable in dev for easier debugging
		mockDelays: true
	},

	test: {
		logLevel: 'error',
		debugMode: false,
		verboseLogging: false,
		enableRetries: false, // Fast failures in tests
		enableCircuitBreaker: false,
		mockDelays: false,
		healthCheckInterval: 300000 // 5 minutes
	},

	production: {
		logLevel: 'info',
		logToFile: true,
		debugMode: false,
		verboseLogging: false,
		enableRetries: true,
		enableCircuitBreaker: true,
		mockDelays: false,
		cleanupOnExit: true,
		enableTelemetry: true
	}
};

/**
 * Apply environment-specific configuration
 */
export async function applyEnvironmentConfig(environment = 'development') {
	const envConfig = ENVIRONMENT_CONFIGS[environment];
	if (!envConfig) {
		throw new Error(`Unknown environment: ${environment}`);
	}

	const { config } = await getFlowSystemConfig();

	for (const [key, value] of Object.entries(envConfig)) {
		config.set(key, value);
	}

	// Re-initialize logging with new config
	const newConfig = config.getAll();
	initializeLogging({
		level: newConfig.logLevel,
		format: newConfig.logFormat,
		logToFile: newConfig.logToFile,
		logFilePath: newConfig.logFilePath,
		enableMemoryTransport: newConfig.debugMode
	});

	await flowLogger.info(`Applied ${environment} configuration`, {
		category: 'configuration',
		environment,
		changes: Object.keys(envConfig)
	});
}

/**
 * Export key components for external use
 */
export { flowConfig, errorRecoveryManager, flowLogger };
