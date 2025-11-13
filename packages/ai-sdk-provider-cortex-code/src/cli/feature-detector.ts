/**
 * Cortex Code CLI feature detection utilities
 * 
 * This module provides utilities for detecting available features and capabilities
 * of the Cortex Code CLI installation, including version detection, feature flags,
 * and skills support.
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

/**
 * Cortex Code skill definition
 */
export interface CortexCodeSkill {
	name: string;
	description?: string;
	[key: string]: any;
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

/**
 * Clear the feature detection cache
 * Useful for testing or when CLI has been updated
 */
export function clearFeatureCache(): void {
	_detectedFeatures = null;
}

/**
 * Detect available Cortex Code skills from ~/.snova/skills.json
 * 
 * @returns List of available skills, or empty array if none found
 */
export function detectAvailableSkills(): CortexCodeSkill[] {
	try {
		const skillsPath = path.join(os.homedir(), '.snova', 'skills.json');

		if (fs.existsSync(skillsPath)) {
			const skillsData = fs.readFileSync(skillsPath, 'utf-8');
			const skills = JSON.parse(skillsData);

			if (Array.isArray(skills) && skills.length > 0) {
				console.info(`Detected ${skills.length} Cortex Code skills`);
				return skills;
			}
		}

		return [];
	} catch (error) {
		console.debug(
			`Failed to load skills: ${error instanceof Error ? error.message : String(error)}`
		);
		return [];
	}
}

/**
 * Check if a specific feature is available
 * 
 * @param featureName - Name of the feature to check
 * @returns True if feature is available
 */
export function hasFeature(featureName: keyof CortexCodeFeatures): boolean {
	const features = detectAvailableFeatures();
	const value = features[featureName];
	return typeof value === 'boolean' ? value : value !== null;
}

/**
 * Get list of available feature names
 * 
 * @returns Array of available feature names
 */
export function getAvailableFeatureNames(): string[] {
	const features = detectAvailableFeatures();
	const available: string[] = [];

	if (features.planningMode) available.push('planning mode');
	if (features.mcpControl) available.push('MCP control');
	if (features.skillsSupport) available.push('skills support');
	if (features.cliVersion) available.push(`version ${features.cliVersion}`);

	return available;
}

