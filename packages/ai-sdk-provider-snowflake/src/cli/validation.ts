/**
 * Validation utilities for Cortex Code CLI
 *
 * Provides enhanced validation capabilities beyond the basic isCortexCliAvailable() check,
 * including version detection and rich validation results.
 */

import { spawn } from 'child_process';

/**
 * Result of CLI validation with detailed information
 */
export interface ValidationResult {
	/** Whether the CLI is available and working */
	valid: boolean;
	/** Error message if validation failed */
	error?: string;
	/** Detected CLI version if available */
	cliVersion?: string;
}

/**
 * Get the installed Cortex CLI version
 *
 * @returns The version string (e.g., "1.2.3") or null if CLI not available
 *
 * @example
 * ```typescript
 * const version = await getCortexCliVersion();
 * if (version) {
 *   console.log(`Cortex CLI version: ${version}`);
 * }
 * ```
 */
export async function getCortexCliVersion(): Promise<string | null> {
	// Check for test environment skip flag
	if (process.env.SKIP_CLI_VALIDATION === 'true') {
		return null;
	}

	return new Promise((resolve) => {
		const child = spawn('cortex', ['--version'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: false
		});

		let stdout = '';

		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		child.on('error', () => {
			// Clean up streams
			if (child.stdout) child.stdout.destroy();
			if (child.stderr) child.stderr.destroy();
			child.unref();
			resolve(null);
		});

		child.on('exit', (code) => {
			// Clean up streams
			if (child.stdout) child.stdout.destroy();
			if (child.stderr) child.stderr.destroy();
			child.unref();

			if (code === 0) {
				// Extract version using same regex as LanguageModel
				const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
				resolve(versionMatch?.[1] || null);
			} else {
				resolve(null);
			}
		});
	});
}

/**
 * Validate Cortex Code CLI with detailed results
 *
 * This provides richer validation information than `isCortexCliAvailable()`,
 * including error messages and version detection.
 *
 * @param params - Validation parameters
 * @param params.skipValidation - Skip validation (for test environments)
 * @returns Detailed validation result
 *
 * @example
 * ```typescript
 * const result = await validateCortexCli();
 * if (!result.valid) {
 *   console.error(result.error);
 * } else {
 *   console.log(`CLI version: ${result.cliVersion}`);
 * }
 * ```
 */
export async function validateCortexCli(params?: {
	skipValidation?: boolean;
}): Promise<ValidationResult> {
	// Skip validation if requested or in test environment
	if (params?.skipValidation || process.env.SKIP_CLI_VALIDATION === 'true') {
		return {
			valid: true,
			cliVersion: 'test-mode'
		};
	}

	const version = await getCortexCliVersion();

	if (version) {
		return {
			valid: true,
			cliVersion: version
		};
	} else {
		return {
			valid: false,
			error:
				'Cortex Code CLI not found. Please ensure it is installed and available in PATH.'
		};
	}
}
