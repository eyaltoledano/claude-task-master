// Amp profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';
import fs from 'fs';
import path from 'path';

// Helper function to transform standard MCP config to amp format
function transformToAmpFormat(mcpConfig) {
	const ampConfig = {};

	// Transform mcpServers to amp.mcpServers
	if (mcpConfig.mcpServers) {
		ampConfig['amp.mcpServers'] = mcpConfig.mcpServers;
	}

	// Preserve any other existing settings
	for (const [key, value] of Object.entries(mcpConfig)) {
		if (key !== 'mcpServers') {
			ampConfig[key] = value;
		}
	}

	return ampConfig;
}

// Lifecycle functions for amp profile
async function addAmpProfile(projectRoot) {
	// VS Code integration setup handled by base profile
	console.log('Amp profile added successfully');
}

async function removeAmpProfile(projectRoot) {
	// Cleanup handled by base profile
	console.log('Amp profile removed successfully');
}

async function postConvertAmpProfile(projectRoot) {
	// Transform MCP config to amp format
	const mcpConfigPath = path.join(projectRoot, '.vscode', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		console.log('No .vscode/settings.json found to transform');
		return;
	}

	try {
		// Read the generated standard MCP config
		const mcpConfigContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Check if it's already in amp format (has amp.mcpServers)
		if (mcpConfig['amp.mcpServers']) {
			console.log('settings.json already in amp format, skipping transformation');
			return;
		}

		// Transform to amp format
		const ampConfig = transformToAmpFormat(mcpConfig);

		// Write back the transformed config
		fs.writeFileSync(mcpConfigPath, JSON.stringify(ampConfig, null, 2));
		console.log('Transformed settings.json to amp format');
	} catch (error) {
		console.error(`Failed to transform settings.json: ${error.message}`);
	}
}

// Create amp profile using the new ProfileBuilder
const ampProfile = ProfileBuilder
	.minimal('amp')
	.display('Amp')
	.profileDir('.vscode')
	.rulesDir('.vscode/amp')
	.mcpConfig({
		configName: 'settings.json'
	})
	.includeDefaultRules(false) // Amp manages its own configuration
	.onAdd(addAmpProfile)
	.onRemove(removeAmpProfile)
	.onPost(postConvertAmpProfile)
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'amp.dev' },
			{ from: /\[cursor\.so\]/g, to: '[amp.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://amp.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://amp.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Amp' : 'amp')
			},
			{ from: /Cursor/g, to: 'Amp' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'amp.dev/docs' }
		],
		// Tool name mappings (standard - no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.globalReplacements([
		// Core amp directory structure changes
		{ from: /\.cursor\/rules/g, to: '.vscode/amp' },
		{ from: /\.cursor\/mcp\.json/g, to: '.vscode/settings.json' },

		// Essential markdown link transformations for amp structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.vscode/amp/$2.md)'
		},

		// Amp specific terminology
		{ from: /rules directory/g, to: 'amp directory' },
		{ from: /cursor rules/gi, to: 'Amp rules' }
	])
	.build();

// Export only the new Profile instance
export { ampProfile };
