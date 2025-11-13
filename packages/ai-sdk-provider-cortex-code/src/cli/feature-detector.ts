/**
 * Cortex Code CLI feature detection utilities
 * 
 * Minimal feature detection for integration testing.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Available CLI features
 */
export interface CortexCodeFeatures {
	/** Whether planning mode (--plan) is available */
	planningMode: boolean;
	/** Whether MCP control (--no-mcp) is available */
	mcpControl: boolean;
	/** Whether skills support is available */
	skillsSupport: boolean;
	/** CLI version if detected */
	cliVersion: string | null;
}

// Cache for detected features
let _detectedFeatures: CortexCodeFeatures | null = null;

/**
 * Detect which advanced features are available in the installed CLI
 * Results are cached after first detection.
 * 
 * @returns Available features with boolean flags
 */
export function detectAvailableFeatures(): CortexCodeFeatures {
	// Return cached result if available
	if (_detectedFeatures) {
		return _detectedFeatures;
	}

	try {
		const features: CortexCodeFeatures = {
			planningMode: false,
			mcpControl: false,
			skillsSupport: false,
			cliVersion: null
		};

		// Check CLI help for features
		try {
			const helpOutput = execSync('cortex --help', {
				encoding: 'utf-8',
				timeout: 3000,
				stdio: 'pipe'
			});

			features.planningMode = helpOutput.includes('--plan');
			features.mcpControl = helpOutput.includes('--no-mcp');
		} catch (error) {
			console.debug('Could not detect CLI features from --help');
		}

		// Check for skills support
		try {
			const skillsPath = path.join(os.homedir(), '.snova', 'skills.json');
			features.skillsSupport = fs.existsSync(skillsPath);
		} catch (error) {
			console.debug('Could not check for skills support');
		}

		// Try to detect version
		try {
			const versionOutput = execSync('cortex --version', {
				encoding: 'utf-8',
				timeout: 1000,
				stdio: 'pipe'
			});
			const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
			if (versionMatch) {
				features.cliVersion = versionMatch[1];
			}
		} catch (error) {
			console.debug('Could not detect CLI version');
		}

		// Cache the result
		_detectedFeatures = features;
		return features;
	} catch (error) {
		console.warn(
			`Feature detection failed: ${error instanceof Error ? error.message : String(error)}`
		);
		return {
			planningMode: false,
			mcpControl: false,
			skillsSupport: false,
			cliVersion: null
		};
	}
}

