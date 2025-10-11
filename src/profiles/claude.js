// Claude Code profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

// Helper function to recursively copy directory (adopted from Roo profile)
function copyRecursiveSync(src, dest) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
		fs.readdirSync(src).forEach((childItemName) => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName)
			);
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

// Helper function to recursively remove directory
function removeDirectoryRecursive(dirPath) {
	if (fs.existsSync(dirPath)) {
		try {
			fs.rmSync(dirPath, { recursive: true, force: true });
			return true;
		} catch (err) {
			log('error', `Failed to remove directory ${dirPath}: ${err.message}`);
			return false;
		}
	}
	return true;
}

// Lifecycle functions for Claude Code profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Note: Commands and agents are now distributed via Claude Code plugin
	// Legacy .claude directory copying has been deprecated
	log(
		'info',
		'[Claude] Commands and agents are now available via the Task Master plugin'
	);
	log('info', '[Claude] Install with: /plugin marketplace add taskmaster');
	log('info', '[Claude] Then: /plugin install taskmaster@taskmaster');

	// Handle CLAUDE.md import for non-destructive integration
	const sourceFile = path.join(assetsDir, 'AGENTS.md');
	const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
	const taskMasterClaudeFile = path.join(targetDir, '.taskmaster', 'CLAUDE.md');
	const importLine = '@./.taskmaster/CLAUDE.md';
	const importSection = `\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**\n${importLine}`;

	if (fs.existsSync(sourceFile)) {
		try {
			// Ensure .taskmaster directory exists
			const taskMasterDir = path.join(targetDir, '.taskmaster');
			if (!fs.existsSync(taskMasterDir)) {
				fs.mkdirSync(taskMasterDir, { recursive: true });
			}

			// Copy Task Master instructions to .taskmaster/CLAUDE.md
			fs.copyFileSync(sourceFile, taskMasterClaudeFile);
			log(
				'debug',
				`[Claude] Created Task Master instructions at ${taskMasterClaudeFile}`
			);

			// Handle user's CLAUDE.md
			if (fs.existsSync(userClaudeFile)) {
				// Check if import already exists
				const content = fs.readFileSync(userClaudeFile, 'utf8');
				if (!content.includes(importLine)) {
					// Append import section at the end
					const updatedContent = content.trim() + '\n' + importSection + '\n';
					fs.writeFileSync(userClaudeFile, updatedContent);
					log(
						'info',
						`[Claude] Added Task Master import to existing ${userClaudeFile}`
					);
				} else {
					log(
						'info',
						`[Claude] Task Master import already present in ${userClaudeFile}`
					);
				}
			} else {
				// Create minimal CLAUDE.md with the import section
				const minimalContent = `# Claude Code Instructions\n${importSection}\n`;
				fs.writeFileSync(userClaudeFile, minimalContent);
				log(
					'info',
					`[Claude] Created ${userClaudeFile} with Task Master import`
				);
			}
		} catch (err) {
			log(
				'error',
				`[Claude] Failed to set up Claude instructions: ${err.message}`
			);
		}
	}
}

function onRemoveRulesProfile(targetDir) {
	// Note: .claude directory (commands/agents) are now managed by Claude Code plugin
	// We no longer remove them here - users should uninstall the plugin separately
	log(
		'info',
		'[Claude] To remove Task Master commands/agents, uninstall the plugin with: /plugin uninstall taskmaster'
	);

	// Clean up CLAUDE.md import
	const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
	const taskMasterClaudeFile = path.join(targetDir, '.taskmaster', 'CLAUDE.md');
	const importLine = '@./.taskmaster/CLAUDE.md';

	try {
		// Remove Task Master CLAUDE.md from .taskmaster
		if (fs.existsSync(taskMasterClaudeFile)) {
			fs.rmSync(taskMasterClaudeFile, { force: true });
			log('debug', `[Claude] Removed ${taskMasterClaudeFile}`);
		}

		// Clean up import from user's CLAUDE.md
		if (fs.existsSync(userClaudeFile)) {
			const content = fs.readFileSync(userClaudeFile, 'utf8');
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
			if (
				updatedContent === '# Claude Code Instructions' ||
				updatedContent === ''
			) {
				// File only contained our import, remove it
				fs.rmSync(userClaudeFile, { force: true });
				log('debug', `[Claude] Removed empty ${userClaudeFile}`);
			} else {
				// Write back without the import
				fs.writeFileSync(userClaudeFile, updatedContent + '\n');
				log(
					'debug',
					`[Claude] Removed Task Master import from ${userClaudeFile}`
				);
			}
		}
	} catch (err) {
		log(
			'error',
			`[Claude] Failed to remove Claude instructions: ${err.message}`
		);
	}
}

/**
 * Transform standard MCP config format to Claude format
 * @param {Object} mcpConfig - Standard MCP configuration object
 * @returns {Object} - Transformed Claude configuration object
 */
function transformToClaudeFormat(mcpConfig) {
	const claudeConfig = {};

	// Transform mcpServers to servers (keeping the same structure but adding type)
	if (mcpConfig.mcpServers) {
		claudeConfig.mcpServers = {};

		for (const [serverName, serverConfig] of Object.entries(
			mcpConfig.mcpServers
		)) {
			// Transform server configuration with type as first key
			const reorderedServer = {};

			// Add type: "stdio" as the first key
			reorderedServer.type = 'stdio';

			// Then add the rest of the properties in order
			if (serverConfig.command) reorderedServer.command = serverConfig.command;
			if (serverConfig.args) reorderedServer.args = serverConfig.args;
			if (serverConfig.env) reorderedServer.env = serverConfig.env;

			// Add any other properties that might exist
			Object.keys(serverConfig).forEach((key) => {
				if (!['command', 'args', 'env', 'type'].includes(key)) {
					reorderedServer[key] = serverConfig[key];
				}
			});

			claudeConfig.mcpServers[serverName] = reorderedServer;
		}
	}

	return claudeConfig;
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// For Claude, post-convert is the same as add since we don't transform rules
	onAddRulesProfile(targetDir, assetsDir);

	// Transform MCP configuration to Claude format
	const mcpConfigPath = path.join(targetDir, '.mcp.json');
	if (fs.existsSync(mcpConfigPath)) {
		try {
			const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
			const claudeConfig = transformToClaudeFormat(mcpConfig);

			// Write back the transformed configuration
			fs.writeFileSync(
				mcpConfigPath,
				JSON.stringify(claudeConfig, null, '\t') + '\n'
			);
			log(
				'debug',
				`[Claude] Transformed MCP configuration to Claude format at ${mcpConfigPath}`
			);
		} catch (err) {
			log(
				'error',
				`[Claude] Failed to transform MCP configuration: ${err.message}`
			);
		}
	}
}

// Create and export claude profile using the base factory
export const claudeProfile = createProfile({
	name: 'claude',
	displayName: 'Claude Code',
	url: 'claude.ai',
	docsUrl: 'docs.anthropic.com/en/docs/claude-code',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfigName: '.mcp.json', // Place MCP config in project root
	includeDefaultRules: false,
	fileMap: {
		'AGENTS.md': '.taskmaster/CLAUDE.md'
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
