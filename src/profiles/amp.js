// Amp profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

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
					log(
						'info',
						`[Amp] Added Task Master import to existing ${userAgentFile}`
					);
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

	// MCP transformation will be handled in onPostConvertRulesProfile
}

function onRemoveRulesProfile(targetDir) {
	// Clean up AGENT.md import (Amp uses AGENT.md, not AGENTS.md)
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

	// MCP Removal: Remove amp.mcpServers section
	const mcpConfigPath = path.join(targetDir, '.vscode', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		log('debug', '[Amp] No .vscode/settings.json found to clean up');
		return;
	}

	try {
		// Read the current config
		const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const config = JSON.parse(configContent);

		// Check if it has the amp.mcpServers section and task-master-ai server
		if (
			config['amp.mcpServers'] &&
			config['amp.mcpServers']['task-master-ai']
		) {
			// Remove task-master-ai server
			delete config['amp.mcpServers']['task-master-ai'];

			// Check if there are other MCP servers in amp.mcpServers
			const remainingServers = Object.keys(config['amp.mcpServers']);

			if (remainingServers.length === 0) {
				// No other servers, remove entire amp.mcpServers section
				delete config['amp.mcpServers'];
				log('debug', '[Amp] Removed empty amp.mcpServers section');
			}

			// Check if config is now empty
			const remainingKeys = Object.keys(config);

			if (remainingKeys.length === 0) {
				// Config is empty, remove entire file
				fs.rmSync(mcpConfigPath, { force: true });
				log('info', '[Amp] Removed empty settings.json file');

				// Check if .vscode directory is empty
				const vscodeDirPath = path.join(targetDir, '.vscode');
				if (fs.existsSync(vscodeDirPath)) {
					const remainingContents = fs.readdirSync(vscodeDirPath);
					if (remainingContents.length === 0) {
						fs.rmSync(vscodeDirPath, { recursive: true, force: true });
						log('debug', '[Amp] Removed empty .vscode directory');
					}
				}
			} else {
				// Write back the modified config
				fs.writeFileSync(
					mcpConfigPath,
					JSON.stringify(config, null, '\t') + '\n'
				);
				log(
					'info',
					'[Amp] Removed TaskMaster from settings.json, preserved other configurations'
				);
			}
		} else {
			log('debug', '[Amp] TaskMaster not found in amp.mcpServers');
		}
	} catch (error) {
		log('error', `[Amp] Failed to clean up settings.json: ${error.message}`);
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// Handle AGENT.md setup (same as onAddRulesProfile)
	onAddRulesProfile(targetDir, assetsDir);

	// Transform MCP config to Amp format
	const mcpConfigPath = path.join(targetDir, '.vscode', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		log('debug', '[Amp] No .vscode/settings.json found to transform');
		return;
	}

	try {
		// Read the generated standard MCP config
		const mcpConfigContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Check if it's already in Amp format (has amp.mcpServers)
		if (mcpConfig['amp.mcpServers']) {
			log(
				'info',
				'[Amp] settings.json already in Amp format, skipping transformation'
			);
			return;
		}

		// Transform to Amp format
		const ampConfig = transformToAmpFormat(mcpConfig);

		// Write back the transformed config with proper formatting
		fs.writeFileSync(
			mcpConfigPath,
			JSON.stringify(ampConfig, null, '\t') + '\n'
		);

		log('info', '[Amp] Transformed settings.json to Amp format');
		log('debug', '[Amp] Renamed mcpServers to amp.mcpServers');
	} catch (error) {
		log('error', `[Amp] Failed to transform settings.json: ${error.message}`);
	}
}

// Create and export amp profile using the base factory
export const ampProfile = createProfile({
	name: 'amp',
	displayName: 'Amp',
	url: 'ampcode.com',
	docsUrl: 'ampcode.com/manual',
	profileDir: '.vscode',
	rulesDir: '.',
	mcpConfig: true,
	mcpConfigName: 'settings.json',
	includeDefaultRules: false,
	fileMap: {
		'AGENTS.md': '.taskmaster/AGENT.md'
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
