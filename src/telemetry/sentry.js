/**
 * Sentry initialization and configuration for Task Master
 * Provides error tracking and AI operation monitoring
 */
import * as Sentry from '@sentry/node';
import { getAnonymousTelemetryEnabled } from '../../scripts/modules/config-manager.js';
import { resolveEnvVariable } from '../../scripts/modules/utils.js';

let isInitialized = false;

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
				})
			],
			// Tracing must be enabled for AI monitoring to work
			tracesSampleRate: options.tracesSampleRate ?? 1.0,
			sendDefaultPii: options.sendDefaultPii ?? true
		});

		isInitialized = true;
	} catch (error) {
		console.error(`Failed to initialize telemetry: ${error.message}`);
	}
}

/**
 * Get the experimental telemetry configuration for AI SDK calls
 * Only returns telemetry config if Sentry is initialized
 * @returns {object|null} Telemetry configuration or null if Sentry not initialized
 */
export function getAITelemetryConfig() {
	if (!isInitialized) {
		return null;
	}

	return {
		isEnabled: true,
		recordInputs: true,
		recordOutputs: true
	};
}

/**
 * Check if Sentry is initialized
 * @returns {boolean} True if Sentry is initialized
 */
export function isSentryInitialized() {
	return isInitialized;
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
