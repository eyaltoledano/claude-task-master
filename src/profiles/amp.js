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
async function addAmpProfile(projectRoot, assetsDir) {
	try {
		// Ensure .taskmaster directory exists
		const taskMasterDir = path.join(projectRoot, '.taskmaster');
		if (!fs.existsSync(taskMasterDir)) {
			fs.mkdirSync(taskMasterDir, { recursive: true });
		}

		// Copy AGENTS.md to .taskmaster/AGENT.md if it exists
		if (assetsDir && fs.existsSync(path.join(assetsDir, 'AGENTS.md'))) {
			const sourceFile = path.join(assetsDir, 'AGENTS.md');
			const destFile = path.join(taskMasterDir, 'AGENT.md');
			fs.copyFileSync(sourceFile, destFile);
		} else {
			// Create default .taskmaster/AGENT.md
			const agentContent = `# Task Master AI Instructions

This file contains instructions for Task Master AI integration.
`;
			fs.writeFileSync(path.join(taskMasterDir, 'AGENT.md'), agentContent);
		}

		// Create or update AGENT.md in project root with import
		const rootAgentFile = path.join(projectRoot, 'AGENT.md');
		let content = '';

		if (fs.existsSync(rootAgentFile)) {
			// Read existing content
			content = fs.readFileSync(rootAgentFile, 'utf8');

			// Check if import already exists
			if (!content.includes('@./.taskmaster/AGENT.md')) {
				// Add import section
				content += `

## Task Master AI Instructions

@./.taskmaster/AGENT.md
`;
			}
		} else {
			// Create new AGENT.md with import
			content = `# Amp Instructions

## Task Master AI Instructions

@./.taskmaster/AGENT.md
`;
		}

		fs.writeFileSync(rootAgentFile, content);
		console.log('Amp profile added successfully');
	} catch (error) {
		console.error(`Failed to add Amp profile: ${error.message}`);
	}
}

async function removeAmpProfile(projectRoot) {
	try {
		// Remove .taskmaster/AGENT.md
		const taskMasterAgent = path.join(projectRoot, '.taskmaster', 'AGENT.md');
		if (fs.existsSync(taskMasterAgent)) {
			fs.unlinkSync(taskMasterAgent);
		}

		// Clean up AGENT.md import or remove file if it only contained import
		const rootAgentFile = path.join(projectRoot, 'AGENT.md');
		if (fs.existsSync(rootAgentFile)) {
			let content = fs.readFileSync(rootAgentFile, 'utf8');

			// Remove Task Master section - handle multi-line content
			// This removes from "## Task Master AI Instructions" to the end of the import
			content = content.replace(
				/\n*## Task Master AI Instructions[\s\S]*?@\.\/.taskmaster\/AGENT\.md\n*/g,
				''
			);

			// If file is now empty or only contains amp header, remove it
			const cleanContent = content.trim();
			if (cleanContent === '' || cleanContent === '# Amp Instructions') {
				fs.unlinkSync(rootAgentFile);
			} else {
				fs.writeFileSync(rootAgentFile, content);
			}
		}

		// Clean up MCP configuration
		const mcpConfigPath = path.join(projectRoot, '.vscode', 'settings.json');
		if (fs.existsSync(mcpConfigPath)) {
			const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
			const config = JSON.parse(configContent);

			// Remove amp.mcpServers
			if (config['amp.mcpServers']) {
				delete config['amp.mcpServers'];

				// Check if settings.json is now empty or only has other non-MCP settings
				const remainingKeys = Object.keys(config);
				const hasMeaningfulContent = remainingKeys.some(
					(key) => !key.startsWith('amp.') && key !== 'mcpServers'
				);

				if (!hasMeaningfulContent && remainingKeys.length === 0) {
					// Remove empty settings.json and .vscode directory if empty
					fs.unlinkSync(mcpConfigPath);
					const vscodeDirPath = path.join(projectRoot, '.vscode');
					if (
						fs.existsSync(vscodeDirPath) &&
						fs.readdirSync(vscodeDirPath).length === 0
					) {
						fs.rmdirSync(vscodeDirPath);
					}
				} else {
					// Write back the modified config
					fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
				}
			}
		}

		console.log('Amp profile removed successfully');
	} catch (error) {
		console.error(`Failed to remove Amp profile: ${error.message}`);
	}
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
			console.log(
				'settings.json already in amp format, skipping transformation'
			);
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
const ampProfile = ProfileBuilder.minimal('amp')
	.display('Amp')
	.profileDir('.vscode')
	.rulesDir('.') // Root directory for rules as expected by tests
	.mcpConfig({
		configName: 'settings.json' // Custom name for Amp
	})
	.includeDefaultRules(false) // Amp manages its own configuration
	.fileMap({
		'AGENTS.md': '.taskmaster/AGENT.md' // Expected mapping for tests
	})
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
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'amp.dev/docs' }],
		// Tool name mappings (amp uses standard tool names)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (amp uses standard contexts)
		toolContexts: [],

		// Tool group mappings (amp uses standard groups)
		toolGroups: [],

		// File reference mappings (amp uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'amp.dev/docs' }]
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
