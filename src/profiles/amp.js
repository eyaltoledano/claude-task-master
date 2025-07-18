// Amp profile using new ProfileBuilder system
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

/**
 * Transform standard MCP config format to Amp format
 * @param {Object} mcpConfig - Standard MCP configuration object
 * @returns {Object} - Transformed Amp configuration object
 */
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

// Lifecycle functions for Amp profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Handle AGENT.md import for non-destructive integration (Amp uses AGENT.md, copies from AGENTS.md)
	const sourceFile = path.join(assetsDir, 'AGENTS.md');
	const userAgentFile = path.join(targetDir, 'AGENT.md');
	const taskMasterAgentFile = path.join(targetDir, '.taskmaster', 'AGENT.md');
	const importLine = '@./.taskmaster/AGENT.md';
	const importSection = `\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main AGENT.md file.**\n${importLine}`;

	if (fs.existsSync(sourceFile)) {
		try {
			// Ensure .taskmaster directory exists
			const taskMasterDir = path.join(targetDir, '.taskmaster');
			if (!fs.existsSync(taskMasterDir)) {
				fs.mkdirSync(taskMasterDir, { recursive: true });
			}

			// Copy Task Master instructions to .taskmaster/AGENT.md
			fs.copyFileSync(sourceFile, taskMasterAgentFile);
			log(
				'debug',
				`[Amp] Created Task Master instructions at ${taskMasterAgentFile}`
			);

			// Handle user's AGENT.md
			if (fs.existsSync(userAgentFile)) {
				// Check if import already exists
				const content = fs.readFileSync(userAgentFile, 'utf8');
				if (!content.includes(importLine)) {
					// Append import section at the end
					const updatedContent = content.trim() + '\n' + importSection + '\n';
					fs.writeFileSync(userAgentFile, updatedContent);
					log('info', `[Amp] Added Task Master import to existing ${userAgentFile}`);
				} else {
					log(
						'info',
						`[Amp] Task Master import already present in ${userAgentFile}`
					);
				}
			} else {
				// Create minimal AGENT.md with the import section
				const minimalContent = `# Amp Instructions\n${importSection}\n`;
				fs.writeFileSync(userAgentFile, minimalContent);
				log('info', `[Amp] Created ${userAgentFile} with Task Master import`);
			}
		} catch (err) {
			log('error', `[Amp] Failed to set up Amp instructions: ${err.message}`);
		}
	}
}

function onRemoveRulesProfile(targetDir) {
	// Clean up AGENT.md import
	const userAgentFile = path.join(targetDir, 'AGENT.md');
	const taskMasterAgentFile = path.join(targetDir, '.taskmaster', 'AGENT.md');
	const importLine = '@./.taskmaster/AGENT.md';

	try {
		// Remove Task Master AGENT.md from .taskmaster
		if (fs.existsSync(taskMasterAgentFile)) {
			fs.rmSync(taskMasterAgentFile, { force: true });
			log('debug', `[Amp] Removed ${taskMasterAgentFile}`);
		}

		// Clean up import from user's AGENT.md
		if (fs.existsSync(userAgentFile)) {
			const content = fs.readFileSync(userAgentFile, 'utf8');
			const lines = content.split('\n');
			const filteredLines = [];
			let skipNextLines = 0;

			// Remove the Task Master section
			for (let i = 0; i < lines.length; i++) {
				if (skipNextLines > 0) {
					skipNextLines--;
					continue;
				}

				// Check if this is the start of our Task Master section
				if (lines[i].includes('## Task Master AI Instructions')) {
					// Skip this line and the next two lines (bold text and import)
					skipNextLines = 2;
					continue;
				}

				// Also remove standalone import lines (for backward compatibility)
				if (lines[i].trim() === importLine) {
					continue;
				}

				filteredLines.push(lines[i]);
			}

			// Join back and clean up excessive newlines
			let updatedContent = filteredLines
				.join('\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim();

			// Check if file only contained our minimal template
			if (updatedContent === '# Amp Instructions' || updatedContent === '') {
				// File only contained our import, remove it
				fs.rmSync(userAgentFile, { force: true });
				log('debug', `[Amp] Removed empty ${userAgentFile}`);
			} else {
				// Write back without the import
				fs.writeFileSync(userAgentFile, updatedContent + '\n');
				log('debug', `[Amp] Removed Task Master import from ${userAgentFile}`);
			}
		}
	} catch (err) {
		log('error', `[Amp] Failed to remove Amp instructions: ${err.message}`);
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// For Amp, post-convert is the same as add since we don't transform rules
	onAddRulesProfile(targetDir, assetsDir);

	// Transform MCP configuration to Amp format
	const mcpConfigPath = path.join(targetDir, '.vscode', 'settings.json');
	try {
		let settingsObject = {};

		// Read existing settings.json if it exists
		if (fs.existsSync(mcpConfigPath)) {
			const settingsContent = fs.readFileSync(mcpConfigPath, 'utf8');
			if (settingsContent.trim()) {
				settingsObject = JSON.parse(settingsContent);
			}
		}

		// Transform any mcpServers to amp.mcpServers format
		if (settingsObject.mcpServers) {
			settingsObject['amp.mcpServers'] = settingsObject.mcpServers;
			delete settingsObject.mcpServers;

			// Write back the transformed configuration
			const updatedSettings = JSON.stringify(settingsObject, null, '\t');
			fs.writeFileSync(mcpConfigPath, updatedSettings + '\n');
		}

		log('info', '[Amp] Transformed settings.json to Amp format');
		log('debug', '[Amp] Renamed mcpServers to amp.mcpServers');
	} catch (error) {
		log('error', `[Amp] Failed to transform settings.json: ${error.message}`);
	}
}

// Create amp profile using the new ProfileBuilder
const ampProfile = ProfileBuilder
	.minimal('amp')
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
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'ampcode.com' },
			{ from: /\[cursor\.so\]/g, to: '[ampcode.com]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://ampcode.com' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://ampcode.com' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Amp' : 'amp')
			},
			{ from: /Cursor/g, to: 'Amp' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'ampcode.com/manual' }
		],
		// Standard tool mappings (no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.onAdd(onAddRulesProfile)
	.onRemove(onRemoveRulesProfile)
	.onPost(onPostConvertRulesProfile)
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { ampProfile };

// Legacy-compatible export for backward compatibility
export const ampProfileLegacy = ampProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default ampProfileLegacy;

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
