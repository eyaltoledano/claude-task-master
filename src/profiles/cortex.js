/**
 * Cortex Code CLI profile
 *
 * Generates SKILL.md files in .cortex/skills/taskmaster/ directory structure
 * for Snowflake Cortex Code CLI integration.
 *
 * Unlike most profiles, Cortex Code CLI:
 * - Uses Skills instead of rules (.cortex/skills/ directory)
 * - Requires manual MCP setup via `cortex mcp add` command
 */

import { createProfile } from './base-profile.js';
import { log } from '../../scripts/modules/utils.js';

/**
 * Lifecycle hook called after rules are added
 * Displays MCP setup instructions for Cortex Code CLI
 */
function onAddRulesProfile(targetDir, assetsDir) {
	log('info', '[Cortex] Task Master skills installed!');
	log('info', '[Cortex] To add MCP server, run:\n'
		+ '  cortex mcp add task-master-ai npx --args="-y,task-master-ai" --env="CORTEX_EXECUTION_MODE=cli,CORTEX_CONNECTION_NAME=your_connection_name"');
	log('info', '[Cortex] Verify with /mcp-status during a Cortex Code CLI session.');
}

export const cortexProfile = createProfile({
	name: 'cortex',
	displayName: 'Cortex Code CLI',
	url: 'snowflake.com',
	docsUrl: 'docs.snowflake.com',
	profileDir: '.cortex',
	rulesDir: '.cortex/skills/taskmaster',
	mcpConfig: false, // No auto-generated config - uses cortex mcp add command
	targetExtension: '.md',
	includeDefaultRules: false, // Use custom fileMap for skills only
	fileMap: {
		// Two consolidated skills for Cortex Code
		'cortex-skills/taskmaster-workflow/SKILL.md': 'taskmaster-workflow/SKILL.md',
		'cortex-skills/taskmaster-commands/SKILL.md': 'taskmaster-commands/SKILL.md'
	},
	onAdd: onAddRulesProfile
});

export { onAddRulesProfile }
