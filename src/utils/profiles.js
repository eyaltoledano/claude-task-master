/**
 * Profiles Utility
 * Consolidated utilities for profile detection, setup, and summary generation
 */
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { log } from '../../scripts/modules/utils.js';
import { getRulesProfile } from './rule-transformer.js';
import { RULE_PROFILES } from '../constants/profiles.js';

// =============================================================================
// PROFILE DETECTION
// =============================================================================

/**
 * Get the display name for a profile
 * @param {string} profileName - The profile name
 * @returns {string} - The display name
 */
export function getProfileDisplayName(profileName) {
	try {
		const profile = getRulesProfile(profileName);
		return profile.displayName || profileName;
	} catch (error) {
		return profileName;
	}
}

/**
 * Get installed profiles in the project directory
 * @param {string} projectRoot - Project directory path
 * @returns {string[]} - Array of installed profile names
 */
export function getInstalledProfiles(projectRoot) {
	const installedProfiles = [];

	for (const profileName of RULE_PROFILES) {
		try {
			const profile = getRulesProfile(profileName);
			const profileDir = path.join(projectRoot, profile.profileDir);

			// Check if profile directory exists (skip root directory check)
			if (profile.profileDir === '.' || fs.existsSync(profileDir)) {
				// Check if any files from the profile's fileMap exist
				const rulesDir = path.join(projectRoot, profile.rulesDir);
				if (fs.existsSync(rulesDir)) {
					const ruleFiles = Object.values(profile.fileMap);
					const hasRuleFiles = ruleFiles.some((ruleFile) =>
						fs.existsSync(path.join(rulesDir, ruleFile))
					);
					if (hasRuleFiles) {
						installedProfiles.push(profileName);
					}
				}
			}
		} catch (error) {
			// Skip profiles that can't be loaded
		}
	}

	return installedProfiles;
}

/**
 * Check if removing specified profiles would leave no profiles installed
 * @param {string} projectRoot - Project root directory
 * @param {string[]} profilesToRemove - Array of profile names to remove
 * @returns {boolean} - True if removal would leave no profiles
 */
export function wouldRemovalLeaveNoProfiles(projectRoot, profilesToRemove) {
	const installedProfiles = getInstalledProfiles(projectRoot);

	// If no profiles are currently installed, removal cannot leave no profiles
	if (installedProfiles.length === 0) {
		return false;
	}

	const remainingProfiles = installedProfiles.filter(
		(profile) => !profilesToRemove.includes(profile)
	);
	return remainingProfiles.length === 0;
}

// =============================================================================
// PROFILE SETUP
// =============================================================================

// Note: Profile choices are now generated dynamically within runInteractiveProfilesSetup()
// to ensure proper alphabetical sorting and pagination configuration

/**
 * Launches an interactive prompt for selecting which rule profiles to include in your project.
 *
 * This function dynamically lists all available profiles (from RULE_PROFILES) and presents them as checkboxes.
 * The user must select at least one profile (no defaults are pre-selected). The result is an array of selected profile names.
 *
 * Used by both project initialization (init) and the CLI 'task-master rules setup' command.
 *
 * @returns {Promise<string[]>} Array of selected profile names (e.g., ['cursor', 'windsurf'])
 */
export async function runInteractiveProfilesSetup() {
	// Generate the profile list dynamically with proper display names, alphabetized
	const profileDescriptions = RULE_PROFILES.map((profileName) => {
		const displayName = getProfileDisplayName(profileName);
		const profile = getRulesProfile(profileName);

		// Determine description based on profile capabilities
		let description;
		const hasRules = Object.keys(profile.fileMap).length > 0;
		const hasMcpConfig = profile.mcpConfig === true;

		if (!profile.includeDefaultRules) {
			// Integration guide profiles (claude, codex, gemini, opencode, zed, amp) - don't include standard coding rules
			if (profileName === 'claude') {
				description = 'Integration guide with Task Master slash commands';
			} else if (profileName === 'codex') {
				description = 'Comprehensive Task Master integration guide';
			} else if (hasMcpConfig) {
				description = 'Integration guide and MCP config';
			} else {
				description = 'Integration guide';
			}
		} else if (hasRules && hasMcpConfig) {
			// Full rule profiles with MCP config
			if (profileName === 'roo') {
				description = 'Rule profile, MCP config, and agent modes';
			} else {
				description = 'Rule profile and MCP config';
			}
		} else if (hasRules) {
			// Rule profiles without MCP config
			description = 'Rule profile';
		}

		return {
			profileName,
			displayName,
			description
		};
	}).sort((a, b) => a.displayName.localeCompare(b.displayName));

	const profileListText = profileDescriptions
		.map(
			({ displayName, description }) =>
				`${chalk.white('• ')}${chalk.yellow(displayName)}${chalk.white(` - ${description}`)}`
		)
		.join('\n');

	console.log(
		boxen(
			`${chalk.white.bold('Rule Profiles Setup')}\n\n${chalk.white(
				'Rule profiles help enforce best practices and conventions for Task Master.\n' +
					'Each profile provides coding guidelines tailored for specific AI coding environments.\n\n'
			)}${chalk.cyan('Available Profiles:')}\n${profileListText}`,
			{
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			}
		)
	);

	// Generate choices in the same order as the display text above
	const sortedChoices = profileDescriptions.map(
		({ profileName, displayName }) => ({
			name: displayName,
			value: profileName
		})
	);

	const ruleProfilesQuestion = {
		type: 'checkbox',
		name: 'ruleProfiles',
		message: 'Which rule profiles would you like to add to your project?',
		choices: sortedChoices,
		pageSize: sortedChoices.length, // Show all options without pagination
		loop: false, // Disable loop scrolling
		validate: (input) => input.length > 0 || 'You must select at least one.'
	};
	const { ruleProfiles } = await inquirer.prompt([ruleProfilesQuestion]);
	return ruleProfiles;
}

// =============================================================================
// PROFILE SUMMARY
// =============================================================================

/**
 * Generate appropriate summary message for a profile based on its type
 * @param {string} profileName - Name of the profile
 * @param {Object} addResult - Result object with success/failed counts
 * @returns {string} Formatted summary message
 */
export function generateProfileSummary(profileName, addResult) {
	const profileConfig = getRulesProfile(profileName);

	if (!profileConfig.includeDefaultRules) {
		// Integration guide profiles (claude, codex, gemini, amp)
		return `Summary for ${profileName}: Integration guide installed.`;
	} else {
		// Rule profiles with coding guidelines
		return `Summary for ${profileName}: ${addResult.success} files processed, ${addResult.failed} failed.`;
	}
}

/**
 * Generate appropriate summary message for profile removal
 * @param {string} profileName - Name of the profile
 * @param {Object} removeResult - Result object from removal operation
 * @returns {string} Formatted summary message
 */
export function generateProfileRemovalSummary(profileName, removeResult) {
	if (removeResult.skipped) {
		return `Summary for ${profileName}: Skipped (default or protected files)`;
	}

	if (removeResult.error && !removeResult.success) {
		return `Summary for ${profileName}: Failed to remove - ${removeResult.error}`;
	}

	const profileConfig = getRulesProfile(profileName);

	if (!profileConfig.includeDefaultRules) {
		// Integration guide profiles (claude, codex, gemini, amp)
		const baseMessage = `Summary for ${profileName}: Integration guide removed`;
		if (removeResult.notice) {
			return `${baseMessage} (${removeResult.notice})`;
		}
		return baseMessage;
	} else {
		// Rule profiles with coding guidelines
		const baseMessage = `Summary for ${profileName}: Rule profile removed`;
		if (removeResult.notice) {
			return `${baseMessage} (${removeResult.notice})`;
		}
		return baseMessage;
	}
}

/**
 * Categorize profiles and generate final summary statistics
 * @param {Array} addResults - Array of add result objects
 * @returns {Object} Object with categorized profiles and totals
 */
export function categorizeProfileResults(addResults) {
	const successfulProfiles = [];
	let totalSuccess = 0;
	let totalFailed = 0;

	addResults.forEach((r) => {
		totalSuccess += r.success;
		totalFailed += r.failed;

		// All profiles are considered successful if they completed without major errors
		if (r.success > 0 || r.failed === 0) {
			successfulProfiles.push(r.profileName);
		}
	});

	return {
		successfulProfiles,
		allSuccessfulProfiles: successfulProfiles,
		totalSuccess,
		totalFailed
	};
}

/**
 * Categorize removal results and generate final summary statistics
 * @param {Array} removalResults - Array of removal result objects
 * @returns {Object} Object with categorized removal results
 */
export function categorizeRemovalResults(removalResults) {
	const successfulRemovals = [];
	const skippedRemovals = [];
	const failedRemovals = [];
	const removalsWithNotices = [];

	removalResults.forEach((result) => {
		if (result.success) {
			successfulRemovals.push(result.profileName);
		} else if (result.skipped) {
			skippedRemovals.push(result.profileName);
		} else if (result.error) {
			failedRemovals.push(result);
		}

		if (result.notice) {
			removalsWithNotices.push(result);
		}
	});

	return {
		successfulRemovals,
		skippedRemovals,
		failedRemovals,
		removalsWithNotices
	};
}
