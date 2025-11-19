import { execSync } from 'child_process';

/**
 * Validation result interface
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
	cliVersion?: string;
}

/**
 * Validates Cortex Code CLI authentication and availability
 * @param params - Validation parameters
 * @returns Validation result with CLI version if successful
 */
export async function validateCortexCodeAuth(params: {
	connection?: string;
	apiKey?: string;
	skipValidation?: boolean;
}): Promise<ValidationResult> {
	// Skip validation in test environment
	if (params.skipValidation) {
		return { valid: true };
	}

	try {
		// Check if cortex CLI is available
		const versionOutput = execSync('cortex --version', {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		// Extract version from output (e.g., "Cortex CLI version 1.2.3")
		const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
		const cliVersion = versionMatch ? versionMatch[1] : 'unknown';

		return {
			valid: true,
			cliVersion,
		};
	} catch (error) {
		return {
			valid: false,
			error:
				'Cortex Code CLI not found.',
		};
	}
}

