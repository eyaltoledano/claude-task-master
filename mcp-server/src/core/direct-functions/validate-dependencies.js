/**
 * validate-dependencies.js
 * Direct function implementation for validating task dependencies using appropriate provider.
 */

// Corrected import path for task-provider-factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
// Removed config loader import

/**
 * Direct function wrapper for validateDependencies via configured provider.
 *
 * @param {Object} args - Command arguments (file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function validateDependenciesDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, file } = args; // Added file

	try {
		log.info(`Validating dependencies with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('validateDependenciesDirect called without projectRoot.');
		}
		// --- End Argument Validation ---

		// Provider type determined within getTaskProvider
		const providerType = process.env.TASK_PROVIDER || 'local';

		log.info(`Requesting ${providerType} provider to validate dependencies.`);

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		enableSilentMode();
		try {
			const provider = await getTaskProvider();
			const providerOptions = {
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's validateDependencies method
			// Assuming signature: validateDependencies(options)
			const validationResult = await provider.validateDependencies(providerOptions);

			disableSilentMode();

			// Check provider result
			if (validationResult && validationResult.success) {
				const issues = validationResult.data?.issues || [];
				if (issues.length > 0) {
					log.warn(`Provider found ${issues.length} dependency issues.`);
					// Return success but include issues in data
					return {
						success: true,
						data: {
							message: `Validation complete. Found ${issues.length} issues.`,
							issues: issues
						},
						fromCache: false // State modification (or checking)
					};
				} else {
					log.info('Provider validation complete. No dependency issues found.');
					return {
						success: true,
						data: {
							message: 'Validation complete. No issues found.',
							issues: []
						},
						fromCache: false // State checking
					};
				}
			} else {
				const errorMsg = validationResult?.error?.message || 'Provider failed to validate dependencies.';
				const errorCode = validationResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error validating dependencies: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: validationResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error calling provider validateDependencies: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_VALIDATE_DEPENDENCIES_ERROR',
					message: error.message || 'Failed to validate dependencies'
				},
				fromCache: false
			};
		} finally {
			if (isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in validateDependenciesDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
}
