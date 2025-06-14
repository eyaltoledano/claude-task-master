import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Confirm removing profile rules (destructive operation)
 * @param {string[]} profiles - Array of profile names to remove
 * @returns {Promise<boolean>} - Promise resolving to true if user confirms, false otherwise
 */
async function confirmProfilesRemove(profiles) {
	const profileList = profiles
		.map((b) => b.charAt(0).toUpperCase() + b.slice(1))
		.join(', ');
	console.log(
		boxen(
			chalk.yellow(
				`WARNING: This will selectively remove Task Master components for: ${profileList}.

What will be removed:
• Task Master specific rule files (e.g., cursor_rules.mdc, taskmaster.mdc, etc.)
• Task Master MCP server configuration (if no other MCP servers exist)

What will be preserved:
• Your existing custom rule files
• Other MCP server configurations
• The profile directory itself (unless completely empty after removal)

The .[profile] directory will only be removed if ALL of the following are true:
• All rules in the directory were Task Master rules (no custom rules)
• No other files or folders exist in the profile directory
• The MCP configuration was completely removed (no other servers)

Are you sure you want to proceed?`
			),
			{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
		)
	);
	const inquirer = await import('inquirer');
	const { confirm } = await inquirer.default.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message: 'Type y to confirm selective removal, or n to abort:',
			default: false
		}
	]);
	return confirm;
}

/**
 * Confirm removing ALL remaining profile rules (extremely critical operation)
 * @param {string[]} profiles - Array of profile names to remove
 * @param {string[]} remainingProfiles - Array of profiles that would be left after removal
 * @returns {Promise<boolean>} - Promise resolving to true if user confirms, false otherwise
 */
async function confirmRemoveAllRemainingProfiles(profiles, remainingProfiles) {
	const profileList = profiles
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(', ');

	console.log(
		boxen(
			chalk.red.bold(
				`⚠️  CRITICAL WARNING: REMOVING ALL TASK MASTER RULE PROFILES ⚠️\n\n` +
					`You are about to remove Task Master components for: ${profileList}\n` +
					`This will leave your project with NO Task Master rule profiles remaining!\n\n` +
					`What will be removed:\n` +
					`• All Task Master specific rule files\n` +
					`• Task Master MCP server configurations\n` +
					`• Profile directories (only if completely empty after removal)\n\n` +
					`What will be preserved:\n` +
					`• Your existing custom rule files\n` +
					`• Other MCP server configurations\n` +
					`• Profile directories with custom content\n\n` +
					`This could impact Task Master functionality but will preserve your custom configurations.\n\n` +
					`Are you absolutely sure you want to proceed?`
			),
			{
				padding: 1,
				borderColor: 'red',
				borderStyle: 'double',
				title: '🚨 CRITICAL OPERATION',
				titleAlignment: 'center'
			}
		)
	);

	const inquirer = await import('inquirer');
	const { confirm } = await inquirer.default.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message:
				'Type y to confirm removing ALL Task Master rule profiles, or n to abort:',
			default: false
		}
	]);
	return confirm;
}

export { confirmProfilesRemove, confirmRemoveAllRemainingProfiles };
