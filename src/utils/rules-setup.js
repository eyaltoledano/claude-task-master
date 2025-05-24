import readline from 'readline';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { BRAND_PROFILES, BRAND_NAMES } from './rule-transformer.js';

// Dynamically generate availableBrandRules from BRAND_NAMES and brand profiles
const availableBrandRules = BRAND_NAMES.map((name) => {
	const displayName =
		BRAND_PROFILES[name]?.brandName ||
		name.charAt(0).toUpperCase() + name.slice(1);
	return {
		name: name === 'cursor' ? `${displayName} (default)` : displayName,
		value: name
	};
});

/**
 * Runs the interactive rules setup flow (brand rules selection only)
 * @returns {Promise<string[]>} The selected brand rules
 */
/**
 * Launches an interactive prompt for selecting which brand rules to include in your project.
 *
 * This function dynamically lists all available brands (from BRAND_PROFILES) and presents them as checkboxes.
 * The user must select at least one brand (default: cursor). The result is an array of selected brand names.
 *
 * Used by both project initialization (init) and the CLI 'task-master rules setup' command to ensure DRY, consistent UX.
 *
 * @returns {Promise<string[]>} Array of selected brand rule names (e.g., ['cursor', 'windsurf'])
 */
export async function runInteractiveRulesSetup() {
	console.log(
		chalk.cyan(
			'\nRules help enforce best practices and conventions for Task Master.'
		)
	);
	const brandRulesQuestion = {
		type: 'checkbox',
		name: 'brandRules',
		message: 'Which IDEs would you like rules included for?',
		choices: availableBrandRules,
		default: ['cursor'],
		validate: (input) => input.length > 0 || 'You must select at least one.'
	};
	const { brandRules } = await inquirer.prompt([brandRulesQuestion]);
	return brandRules;
} 