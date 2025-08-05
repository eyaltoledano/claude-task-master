import fs from 'fs';
// Claude profile using ProfileBuilder
import path from 'path';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

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
	// Copy .claude directory recursively
	const claudeSourceDir = path.join(assetsDir, 'claude');
	const claudeDestDir = path.join(targetDir, '.claude');

	if (!fs.existsSync(claudeSourceDir)) {
		log(
			'error',
			`[Claude] Source directory does not exist: ${claudeSourceDir}`
		);
		return;
	}

	// Copy the entire .claude directory structure
	try {
		copyRecursiveSync(claudeSourceDir, claudeDestDir);
		log('debug', `[Claude] Copied .claude directory to ${claudeDestDir}`);
	} catch (err) {
		log(
			'error',
			`[Claude] Failed to copy .claude directory: ${err.message}`
		);
		// Continue with other operations even if this fails
	}

	// Ensure .taskmaster directory exists
	const taskMasterDir = path.join(targetDir, '.taskmaster');
	try {
		if (!fs.existsSync(taskMasterDir)) {
			fs.mkdirSync(taskMasterDir, { recursive: true });
			log('debug', `[Claude] Created .taskmaster directory`);
		}
	} catch (err) {
		log(
			'error',
			`[Claude] Failed to create .taskmaster directory: ${err.message}`
		);
		return; // Cannot continue without this directory
	}

	// Copy AGENTS.md to .taskmaster/CLAUDE.md
	try {
		const sourceFile = path.join(assetsDir, 'AGENTS.md');
		const taskMasterClaudeFile = path.join(taskMasterDir, 'CLAUDE.md');

		if (fs.existsSync(sourceFile)) {
			fs.copyFileSync(sourceFile, taskMasterClaudeFile);
			log(
				'debug',
				`[Claude] Created Task Master instructions at ${taskMasterClaudeFile}`
			);
		} else {
			log(
				'warn',
				`[Claude] Source file AGENTS.md not found at ${sourceFile}`
			);
		}
	} catch (err) {
		log(
			'error',
			`[Claude] Failed to copy AGENTS.md to .taskmaster: ${err.message}`
		);
		// Continue with other operations even if this fails
	}

	// Setup CLAUDE.md import system
	try {
		const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
		const importLine = '@./.taskmaster/CLAUDE.md';

		// Define import section with improved formatting
		const importSection = `
## Task Master AI Instructions

**Task Master Integration**: The instructions below are automatically managed by Task Master.

${importLine}
`.trim();

		// Check if user already has a CLAUDE.md file
		if (fs.existsSync(userClaudeFile)) {
			try {
				const content = fs.readFileSync(userClaudeFile, 'utf8');
				if (!content.includes(importLine)) {
					// Add our import section to the beginning
					const updatedContent = `${content.trim()}\n\n${importSection}\n`;
					fs.writeFileSync(userClaudeFile, updatedContent);
					log(
						'info',
						`[Claude] Added Task Master import to existing ${userClaudeFile}`
					);
				} else {
					log(
						'debug',
						`[Claude] Task Master import already present in ${userClaudeFile}`
					);
				}
			} catch (err) {
				log(
					'error',
					`[Claude] Failed to update existing CLAUDE.md: ${err.message}`
				);
			}
		} else {
			try {
				// Create minimal CLAUDE.md with the import section
				const minimalContent = `# Claude Code Instructions\n${importSection}\n`;
				fs.writeFileSync(userClaudeFile, minimalContent);
				log('info', `[Claude] Created ${userClaudeFile} with Task Master import`);
			} catch (err) {
				log(
					'error',
					`[Claude] Failed to create new CLAUDE.md: ${err.message}`
				);
			}
		}
	} catch (err) {
		log(
			'error',
			`[Claude] Unexpected error setting up CLAUDE.md: ${err.message}`
		);
	}
}

function onRemoveRulesProfile(targetDir) {
	// Remove .claude directory recursively
	const claudeDir = path.join(targetDir, '.claude');
	if (removeDirectoryRecursive(claudeDir)) {
		log('debug', `[Claude] Removed .claude directory from ${claudeDir}`);
	}

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
			const updatedContent = filteredLines
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

// Create claude profile using ProfileBuilder
const claudeProfile = ProfileBuilder.minimal('claude')
	.display('Claude Code')
	.profileDir('.') // Root directory
	.rulesDir('.') // No specific rules directory needed
	.mcpConfig({
		configName: '.mcp.json' // Place MCP config in project root
	})
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': '.taskmaster/CLAUDE.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'claude.ai' },
			{ from: /\[cursor\.so\]/g, to: '[claude.ai]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://claude.ai' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://claude.ai' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Claude Code' : 'claude')
			},
			{ from: /Cursor/g, to: 'Claude Code' }
		],
		// Tool name mappings (claude uses standard tool names)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (claude uses standard contexts)
		toolContexts: [],

		// Tool group mappings (claude uses standard groups)
		toolGroups: [],

		// File reference mappings (claude uses standard file references)
		fileReferences: [],

		// Documentation URL mappings
		docUrls: [
			{
				from: /docs\.cursor\.so/g,
				to: 'docs.anthropic.com/en/docs/claude-code'
			}
		]
	})
	.onAdd(onAddRulesProfile)
	.onRemove(onRemoveRulesProfile)
	.onPost(onPostConvertRulesProfile)
	.build();

// Export the claude profile
export { claudeProfile };
