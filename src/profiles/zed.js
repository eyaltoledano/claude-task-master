// Zed profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';
import path from 'path';
import fs from 'fs';

// Helper function to manage Zed's context servers configuration
async function addZedContextServers(projectRoot) {
	const configPath = path.join(projectRoot, '.zed/context_servers.json');
	const settingsDir = path.dirname(configPath);

	// Ensure .zed directory exists
	if (!fs.existsSync(settingsDir)) {
		fs.mkdirSync(settingsDir, { recursive: true });
	}

	// Define context servers configuration
	const contextServers = {
		taskmaster: {
			command: 'npx',
			args: ['task-master-ai', 'mcp-server'],
			description: 'Task Master MCP Server for intelligent task management'
		}
	};

	// Read existing configuration or create new
	let existingConfig = {};
	if (fs.existsSync(configPath)) {
		try {
			const content = fs.readFileSync(configPath, 'utf8');
			existingConfig = JSON.parse(content);
		} catch (error) {
			console.warn(
				`Warning: Could not parse existing ${configPath}:`,
				error.message
			);
		}
	}

	// Merge configurations
	const mergedConfig = { ...existingConfig, ...contextServers };

	// Write updated configuration
	fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
	console.log(`Zed context servers configuration updated: ${configPath}`);
}

async function removeZedContextServers(projectRoot) {
	const configPath = path.join(projectRoot, '.zed/context_servers.json');

	if (fs.existsSync(configPath)) {
		try {
			const content = fs.readFileSync(configPath, 'utf8');
			const config = JSON.parse(content);

			// Remove taskmaster entry
			delete config.taskmaster;

			// Write back the updated config
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
			console.log(
				`Taskmaster context server removed from Zed configuration: ${configPath}`
			);
		} catch (error) {
			console.warn(`Warning: Could not update ${configPath}:`, error.message);
		}
	}
}

// Create zed profile using the new ProfileBuilder
const zedProfile = ProfileBuilder.minimal('zed')
	.display('Zed')
	.profileDir('.zed')
	.rulesDir('.zed/rules')
	.mcpConfig({
		configName: 'settings.json' // Use settings.json as expected by tests
	})
	.includeDefaultRules(false) // Zed has its own complex rules management
	.fileMap({
		'AGENTS.md': '.rules' // Zed-specific file mapping
	})
	.onAdd(addZedContextServers)
	.onRemove(removeZedContextServers)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'zed.dev' },
			{ from: /\[cursor\.so\]/g, to: '[zed.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://zed.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://zed.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Zed' : 'zed')
			},
			{ from: /Cursor/g, to: 'Zed' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'zed.dev/docs' }],
		// File extension mappings (.mdc to .md)
		fileExtensions: [{ from: /\.mdc/g, to: '.md' }],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (zed uses standard contexts)
		toolContexts: [],

		// Tool group mappings (zed uses standard groups)
		toolGroups: [],

		// File reference mappings (zed uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'zed.dev/docs' }]
	})
	.globalReplacements([
		// Core Zed directory structure changes
		{ from: /\.cursor\/rules/g, to: '.zed/rules' },
		{ from: /\.cursor\/mcp\.json/g, to: '.zed/context_servers.json' },

		// Essential markdown link transformations for Zed structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.zed/rules/$2.md)'
		},

		// Zed specific terminology
		{ from: /rules directory/g, to: 'zed rules directory' },
		{ from: /cursor rules/gi, to: 'Zed rules' }
	])
	.build();

// Export only the new Profile instance
export { zedProfile };
