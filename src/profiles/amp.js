import fs from 'fs';
import path from 'path';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Helper function to transform standard MCP config to amp format
function transformToAmpFormat(mcpConfig) {
	const ampConfig = {};

	if (mcpConfig.mcpServers) {
		ampConfig['amp.mcpServers'] = mcpConfig.mcpServers;
	}

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
		const taskMasterDir = path.join(projectRoot, '.taskmaster');

		if (assetsDir && fs.existsSync(path.join(assetsDir, 'AGENTS.md'))) {
			const sourceFile = path.join(assetsDir, 'AGENTS.md');
			const destFile = path.join(taskMasterDir, 'AGENT.md');
			fs.copyFileSync(sourceFile, destFile);
		} else {
			const agentContent = `# Task Master AI Instructions\n\nThis file contains instructions for Task Master AI integration.`;
			fs.writeFileSync(path.join(taskMasterDir, 'AGENT.md'), agentContent);
		}

		const rootAgentFile = path.join(projectRoot, 'AGENT.md');
		let content = '';

		if (fs.existsSync(rootAgentFile)) {
			content = fs.readFileSync(rootAgentFile, 'utf8');
			if (!content.includes('@./.taskmaster/AGENT.md')) {
				content += `\n\n## Task Master AI Instructions\n\n@./.taskmaster/AGENT.md`;
			}
		} else {
			content = `# Amp Instructions\n\n## Task Master AI Instructions\n\n@./.taskmaster/AGENT.md`;
		}

		fs.writeFileSync(rootAgentFile, content);
		console.log('Amp profile added successfully');
	} catch (error) {
		console.error(`Failed to add Amp profile: ${error.message}`);
	}
}

async function removeAmpProfile(projectRoot) {
	try {
		const taskMasterAgent = path.join(projectRoot, '.taskmaster', 'AGENT.md');
		if (fs.existsSync(taskMasterAgent)) {
			fs.unlinkSync(taskMasterAgent);
		}

		const rootAgentFile = path.join(projectRoot, 'AGENT.md');
		if (fs.existsSync(rootAgentFile)) {
			let content = fs.readFileSync(rootAgentFile, 'utf8');

			content = content.replace(
				/\n*## Task Master AI Instructions[\s\S]*?@\.\/.taskmaster\/AGENT\.md\n*/g,
				''
			);

			const cleanContent = content.trim();
			if (cleanContent === '' || cleanContent === '# Amp Instructions') {
				fs.unlinkSync(rootAgentFile);
			} else {
				fs.writeFileSync(rootAgentFile, content);
			}
		}

		const mcpConfigPath = path.join(projectRoot, '.vscode', 'settings.json');
		if (fs.existsSync(mcpConfigPath)) {
			const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
			const config = JSON.parse(configContent);

			if (config['amp.mcpServers']) {
				config['amp.mcpServers'] = undefined;

				const remainingKeys = Object.keys(config);
				const hasMeaningfulContent = remainingKeys.some(
					(key) => !key.startsWith('amp.') && key !== 'mcpServers'
				);

				if (!hasMeaningfulContent && remainingKeys.length === 0) {
					fs.unlinkSync(mcpConfigPath);
					const vscodeDirPath = path.join(projectRoot, '.vscode');
					if (
						fs.existsSync(vscodeDirPath) &&
						fs.readdirSync(vscodeDirPath).length === 0
					) {
						fs.rmdirSync(vscodeDirPath);
					}
				} else {
					fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
				}
			}
		}

		console.log('Amp profile removed successfully');
	} catch (error) {
		console.error(`Failed to remove Amp profile: ${error.message}`);
	}
}

async function postConvertAmpProfile(projectRoot, assetsDir) {
	// First, do the same setup as onAddRulesProfile
	await addAmpProfile(projectRoot, assetsDir);

	// Handle MCP config transformation
	const mcpConfigPath = path.join(projectRoot, '.vscode', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		console.log('No .vscode/settings.json found to transform');
		return;
	}

	try {
		const mcpConfigContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		if (mcpConfig['amp.mcpServers']) {
			console.log(
				'settings.json already in amp format, skipping transformation'
			);
			return;
		}

		const ampConfig = transformToAmpFormat(mcpConfig);

		fs.writeFileSync(mcpConfigPath, JSON.stringify(ampConfig, null, 2));
		console.log('Transformed settings.json to amp format');
	} catch (error) {
		console.error(`Failed to transform settings.json: ${error.message}`);
	}
}

const ampProfile = ProfileBuilder.minimal('amp')
	.display('Amp')
	.profileDir('.vscode')
	.rulesDir('.')
	.mcpConfig({
		configName: 'settings.json'
	})
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': '.taskmaster/AGENT.md'
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
		fileReferences: []
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

export { ampProfile };
