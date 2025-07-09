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
	// Copy .claude directory recursively
	const claudeSourceDir = path.join(assetsDir, 'claude');
	const claudeDestDir = path.join(targetDir, '.claude');
	const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
	const importLine = '@./.claude/TM_COMMANDS_GUIDE.md';
	const importSection = `\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**\n${importLine}`;

	if (fs.existsSync(claudeSourceDir)) {
		try {
			// Copy Task Master instructions to .claude/
			copyRecursiveSync(claudeSourceDir, claudeDestDir);
			log('debug', `[Claude] Copied .claude directory to ${claudeDestDir}`);

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
	// Remove .claude directory recursively
	const claudeDir = path.join(targetDir, '.claude');
	const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
	const importLine = '@./.claude/TM_COMMANDS_GUIDE.md';

	try {
		// Remove .claude directory
		if (removeDirectoryRecursive(claudeDir)) {
			log('debug', `[Claude] Removed .claude directory from ${claudeDir}`);
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

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// For Claude, post-convert is the same as add since we don't transform rules
	onAddRulesProfile(targetDir, assetsDir);
}

// Create and export claude profile using the base factory
export const claudeProfile = createProfile({
	name: 'claude',
	displayName: 'Claude Code',
	url: 'claude.ai',
	docsUrl: 'docs.anthropic.com/en/docs/claude-code',
	profileDir: '.', // Root directory
	rulesDir: '.', // No specific rules directory needed
	mcpConfig: false,
	mcpConfigName: null,
	includeDefaultRules: false,
	fileMap: {
		'claude/TM_COMMANDS_GUIDE.md': '.claude/TM_COMMANDS_GUIDE.md'
	},
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };