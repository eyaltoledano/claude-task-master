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
 * Detect which profiles are currently installed in the project
 * @param {string} projectRoot - Project root directory
 * @returns {string[]} Array of installed profile names
 */
export function getInstalledProfiles(projectRoot) {
	const installedProfiles = [];

	for (const profileName of RULE_PROFILES) {
		const profileConfig = getRulesProfile(profileName);
		if (!profileConfig) continue;

		// Check if the profile directory exists
		const profileDir = path.join(projectRoot, profileConfig.profileDir);
		const rulesDir = path.join(projectRoot, profileConfig.rulesDir);

		// A profile is considered installed if either the profile dir or rules dir exists
		if (fs.existsSync(profileDir) || fs.existsSync(rulesDir)) {
			installedProfiles.push(profileName);
		}
	}

	return installedProfiles;
}

/**
 * Check if removing the specified profiles would result in no profiles remaining
 * @param {string} projectRoot - Project root directory
 * @param {string[]} profilesToRemove - Array of profile names to remove
 * @returns {boolean} True if removal would result in no profiles remaining
 */
export function wouldRemovalLeaveNoProfiles(projectRoot, profilesToRemove) {
	const installedProfiles = getInstalledProfiles(projectRoot);
	const remainingProfiles = installedProfiles.filter(
		(profile) => !profilesToRemove.includes(profile)
	);

	return remainingProfiles.length === 0 && installedProfiles.length > 0;
}

// =============================================================================
// PROFILE SETUP
// =============================================================================

/**
 * Get the display name for a profile
 */
function getProfileDisplayName(name) {
	const profile = getRulesProfile(name);
	return profile?.displayName || name.charAt(0).toUpperCase() + name.slice(1);
}

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

		// Determine description based on profile type
		let description;
		if (Object.keys(profile.fileMap).length === 0) {
			// Simple profiles (Claude, Codex) - specify the target file
			const targetFileName =
				profileName === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
			description = `Integration guide (${targetFileName})`;
		} else {
			// Full profiles with rules - check if they have MCP config
			const hasMcpConfig = profile.mcpConfig === true;
			if (hasMcpConfig) {
				// Special case for Roo to mention agent modes
				if (profileName === 'roo') {
					description = 'Rule profile, MCP config, and agent modes';
				} else {
					description = 'Rule profile and MCP config';
				}
			} else {
				description = 'Rule profile';
			}
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
	const isSimpleProfile = Object.keys(profileConfig.fileMap).length === 0;

	if (isSimpleProfile) {
		// Simple profiles like Claude and Codex only copy AGENTS.md
		const targetFileName = profileName === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
		return `Summary for ${profileName}: Integration guide copied to ${targetFileName}`;
	} else {
		return `Summary for ${profileName}: ${addResult.success} rules added, ${addResult.failed} failed.`;
	}
}

/**
 * Generate appropriate summary message for profile removal
 * @param {string} profileName - Name of the profile
 * @param {Object} removeResult - Result object from removal operation
 * @returns {string} Formatted summary message
 */
export function generateProfileRemovalSummary(profileName, removeResult) {
	const profileConfig = getRulesProfile(profileName);
	const isSimpleProfile = Object.keys(profileConfig.fileMap).length === 0;

	if (removeResult.skipped) {
		return `Summary for ${profileName}: Skipped (default or protected files)`;
	}

	if (removeResult.error && !removeResult.success) {
		return `Summary for ${profileName}: Failed to remove - ${removeResult.error}`;
	}

	if (isSimpleProfile) {
		// Simple profiles like Claude and Codex only have an integration guide
		const targetFileName = profileName === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
		return `Summary for ${profileName}: Integration guide (${targetFileName}) removed`;
	} else {
		// Full profiles have rules directories and potentially MCP configs
		const baseMessage = `Summary for ${profileName}: Rules directory removed`;
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
	const simpleProfiles = [];
	let totalSuccess = 0;
	let totalFailed = 0;

	addResults.forEach((r) => {
		totalSuccess += r.success;
		totalFailed += r.failed;

		const profileConfig = getRulesProfile(r.profileName);
		const isSimpleProfile = Object.keys(profileConfig.fileMap).length === 0;

		if (isSimpleProfile) {
			// Simple profiles are successful if they completed without error
			simpleProfiles.push(r.profileName);
		} else if (r.success > 0) {
			// Full profiles are successful if they added rules
			successfulProfiles.push(r.profileName);
		}
	});

	return {
		successfulProfiles,
		simpleProfiles,
		allSuccessfulProfiles: [...successfulProfiles, ...simpleProfiles],
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
