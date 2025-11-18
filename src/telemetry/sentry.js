import { createHash } from 'crypto';
/**
 * Sentry initialization and configuration for Task Master
 * Provides error tracking and AI operation monitoring
 */
import * as Sentry from '@sentry/node';
import { getAnonymousTelemetryEnabled } from '../../scripts/modules/config-manager.js';
import { resolveEnvVariable } from '../../scripts/modules/utils.js';

let isInitialized = false;

/**
 * Create a privacy-safe hash of a project root path
 * Uses SHA256 and truncates to 8 characters for grouping without exposing full paths
 * @param {string} projectRoot - The project root path
 * @returns {string|undefined} Short hash of the project root, or undefined if no path provided
 */
export function hashProjectRoot(projectRoot) {
	if (!projectRoot) return undefined;

	// Create SHA256 hash and take first 8 characters for grouping
	return createHash('sha256').update(projectRoot).digest('hex').substring(0, 8);
}

/**
 * Initialize Sentry with AI telemetry integration
 * @param {object} options - Initialization options
 * @param {string} [options.dsn] - Sentry DSN (defaults to env var SENTRY_DSN)
 * @param {string} [options.environment] - Environment name (development, production, etc.)
 * @param {number} [options.tracesSampleRate] - Traces sample rate (0.0 to 1.0)
 * @param {boolean} [options.sendDefaultPii] - Whether to send PII data
 * @param {object} [options.session] - MCP session for env resolution
 * @param {string} [options.projectRoot] - Project root for .env file resolution
 */
export function initializeSentry(options = {}) {
	// Avoid double initialization
	if (isInitialized) {
		return;
	}

	// Check if user has opted out of anonymous telemetry
	// This applies to local storage users only
	// Hamster users don't use local config (API storage), so this check doesn't affect them
	try {
		const telemetryEnabled = getAnonymousTelemetryEnabled(options.projectRoot);

		if (!telemetryEnabled) {
			console.log(
				'✓ Anonymous telemetry disabled per user preference. ' +
					'Set anonymousTelemetry: true in .taskmaster/config.json to re-enable.'
			);
			return;
		}
	} catch (error) {
		// If there's an error checking telemetry preferences (e.g., config not available yet),
		// default to enabled. This ensures telemetry works during initialization.
	}

	// Use internal Sentry DSN for Task Master telemetry
	// This is a public client-side DSN and is safe to hardcode
	const dsn =
		options.dsn ||
		'https://ce8c03ca1dd0da5b9837c6ba1b3a0f9d@o4510099843776512.ingest.us.sentry.io/4510381945585664';

	// DSN is always available, but check if user has opted out
	if (!dsn) {
		return;
	}

	try {
		Sentry.init({
			dsn,
			environment: options.environment || process.env.NODE_ENV || 'production',
			integrations: [
				// Add the Vercel AI SDK integration for automatic AI operation tracking
				Sentry.vercelAIIntegration({
					recordInputs: true,
					recordOutputs: true
				}),
				// Add Zod error tracking for better validation error reporting
				Sentry.zodErrorsIntegration()
			],
			// Tracing must be enabled for AI monitoring to work
			tracesSampleRate: options.tracesSampleRate ?? 1.0,
			sendDefaultPii: options.sendDefaultPii ?? true,
			// Enable debug mode with SENTRY_DEBUG=true env var
			debug: process.env.SENTRY_DEBUG === 'true'
		});

		isInitialized = true;
		if (process.env.SENTRY_DEBUG === 'true') {
			console.log(`  DSN: ${dsn.substring(0, 40)}...`);
			console.log(
				`  Environment: ${options.environment || process.env.NODE_ENV || 'production'}`
			);
			console.log(`  Traces Sample Rate: ${options.tracesSampleRate ?? 1.0}`);
		}
	} catch (error) {
		console.error(`Failed to initialize telemetry: ${error.message}`);
	}
}

/**
 * Get the experimental telemetry configuration for AI SDK calls
 * Only returns telemetry config if Sentry is initialized
 * @param {string} [functionId] - Optional function identifier to help correlate spans with function calls
 * @param {object} [metadata] - Optional metadata to include in telemetry spans
 * @param {string} [metadata.command] - Command name (e.g., 'add-task', 'update-task')
 * @param {string} [metadata.outputType] - Output type: 'cli' or 'mcp'
 * @param {string} [metadata.tag] - Task tag being operated on
 * @param {string} [metadata.taskId] - Specific task ID if applicable
 * @param {string} [metadata.userId] - Hamster user ID if authenticated
 * @param {string} [metadata.briefId] - Hamster brief ID if connected
 * @param {string} [metadata.projectHash] - Privacy-safe hash of project root
 * @returns {object|null} Telemetry configuration or null if Sentry not initialized
 */
export function getAITelemetryConfig(functionId, metadata = {}) {
	if (!isInitialized) {
		if (process.env.SENTRY_DEBUG === 'true') {
			console.log('⚠️  Sentry not initialized, telemetry config not available');
		}
		return null;
	}

	const config = {
		isEnabled: true,
		recordInputs: true,
		recordOutputs: true
	};

	// Add functionId if provided - helps correlate captured spans with function calls
	if (functionId) {
		config.functionId = functionId;
	}

	// Add custom metadata for better filtering and grouping in Sentry
	// Only include defined metadata fields to avoid clutter
	if (Object.keys(metadata).length > 0) {
		config.metadata = {};

		if (metadata.command) config.metadata.command = metadata.command;
		if (metadata.outputType) config.metadata.outputType = metadata.outputType;
		if (metadata.tag) config.metadata.tag = metadata.tag;
		if (metadata.taskId) config.metadata.taskId = metadata.taskId;
		if (metadata.userId) config.metadata.userId = metadata.userId;
		if (metadata.briefId) config.metadata.briefId = metadata.briefId;
		if (metadata.projectHash)
			config.metadata.projectHash = metadata.projectHash;
	}

	if (process.env.SENTRY_DEBUG === 'true') {
		console.log(
			'📊 Sentry telemetry config created:',
			JSON.stringify(config, null, 2)
		);
	}

	return config;
}

/**
 * Check if Sentry is initialized
 * @returns {boolean} True if Sentry is initialized
 */
export function isSentryInitialized() {
	return isInitialized;
}

/**
 * Flush all pending Sentry events
 * Critical for short-lived processes like CLI commands
 * @param {number} [timeout=2000] - Maximum time to wait for events to flush (ms)
 * @returns {Promise<boolean>} True if flush was successful
 */
export async function flushSentry(timeout = 2000) {
	if (!isInitialized) {
		return false;
	}

	try {
		if (process.env.SENTRY_DEBUG === 'true') {
			console.log('🔄 Flushing Sentry events...');
		}
		await Sentry.flush(timeout);
		if (process.env.SENTRY_DEBUG === 'true') {
			console.log('✓ Sentry events flushed successfully');
		}
		return true;
	} catch (error) {
		console.error(`Failed to flush Sentry events: ${error.message}`);
		return false;
	}
}

/**
 * Capture an exception with Sentry
 * @param {Error} error - The error to capture
 * @param {object} [context] - Additional context data
 */
export function captureException(error, context = {}) {
	if (!isInitialized) {
		return;
	}

	Sentry.captureException(error, {
		extra: context
	});
}

/**
 * Capture a message with Sentry
 * @param {string} message - The message to capture
 * @param {string} [level] - Severity level (fatal, error, warning, log, info, debug)
 * @param {object} [context] - Additional context data
 */
export function captureMessage(message, level = 'info', context = {}) {
	if (!isInitialized) {
		return;
	}

	Sentry.captureMessage(message, {
		level,
		extra: context
	});
}

/**
 * Set user context for Sentry events
 * @param {object} user - User information
 * @param {string} [user.id] - User ID
 * @param {string} [user.email] - User email
 * @param {string} [user.username] - Username
 */
export function setUser(user) {
	if (!isInitialized) {
		return;
	}

	Sentry.setUser(user);
}

/**
 * Add tags to Sentry events
 * @param {object} tags - Tags to add
 */
export function setTags(tags) {
	if (!isInitialized) {
		return;
	}

	Sentry.setTags(tags);
}

/**
 * Reset Sentry initialization state (useful for testing)
 * @private
 */
export function _resetSentry() {
	isInitialized = false;
}
