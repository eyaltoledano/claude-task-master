// Cursor conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import fs from 'fs';
import path from 'path';

// Define lifecycle hooks as functions
const onAdd = (projectRoot, assetsDir) => {
	// Create .cursor/commands directory if it doesn't exist
	const commandsDir = path.join(projectRoot, '.cursor', 'commands');
	if (!fs.existsSync(commandsDir)) {
		fs.mkdirSync(commandsDir, { recursive: true });
	}

	// Copy all command files from assets/cursor/commands to .cursor/commands
	const sourceCommandsDir = path.join(assetsDir, 'cursor', 'commands');
	if (fs.existsSync(sourceCommandsDir)) {
		try {
			const commandFiles = fs
				.readdirSync(sourceCommandsDir)
				.filter((file) => file.endsWith('.md'));
			console.log(
				`[INFO] Adding ${commandFiles.length} custom slash commands (/tm-*) to .cursor/commands`
			);
			let successCount = 0;
			commandFiles.forEach((commandFile) => {
				try {
					const sourcePath = path.join(sourceCommandsDir, commandFile);
					const targetPath = path.join(commandsDir, commandFile);
					const content = fs.readFileSync(sourcePath, 'utf8');
					fs.writeFileSync(targetPath, content, 'utf8');
					successCount++;
				} catch (error) {
					console.warn(
						`Failed to copy cursor command ${commandFile}: ${error.message}`
					);
				}
			});
			console.log(
				`[SUCCESS] Added ${successCount} Task Master slash commands to Cursor IDE`
			);
			return {
				success: successCount,
				failed: commandFiles.length - successCount
			};
		} catch (error) {
			console.warn(
				`Failed to read cursor commands directory: ${error.message}`
			);
			return { success: 0, failed: 1 };
		}
	} else {
		console.warn(
			`Cursor commands source directory not found: ${sourceCommandsDir}`
		);
		return { success: 0, failed: 1 };
	}
};

const onRemove = (projectRoot) => {
	// Remove Task Master command files only (preserve other commands)
	const commandsDir = path.join(projectRoot, '.cursor', 'commands');
	if (fs.existsSync(commandsDir)) {
		try {
			// Find and remove all tm-*.md files (Task Master commands)
			const commandFiles = fs
				.readdirSync(commandsDir)
				.filter((file) => file.startsWith('tm-') && file.endsWith('.md'));
			if (commandFiles.length > 0) {
				console.log(
					`[INFO] Removing ${commandFiles.length} Task Master slash commands (/tm-*) from .cursor/commands`
				);
				let removeCount = 0;
				commandFiles.forEach((commandFile) => {
					const filePath = path.join(commandsDir, commandFile);
					try {
						fs.unlinkSync(filePath);
						removeCount++;
					} catch (error) {
						console.warn(
							`Could not remove command file ${commandFile}: ${error.message}`
						);
					}
				});
				console.log(
					`[SUCCESS] Removed ${removeCount} Task Master slash commands from Cursor IDE`
				);
				return {
					success: removeCount,
					failed: commandFiles.length - removeCount
				};
			}
		} catch (error) {
			console.warn(
				`Failed to read commands directory during cleanup: ${error.message}`
			);
			return { success: 0, failed: 1 };
		}
	}
	return { success: 0, failed: 0 };
};

// Create and export cursor profile using the base factory
export const cursorProfile = createProfile({
	name: 'cursor',
	displayName: 'Cursor',
	url: 'cursor.so',
	docsUrl: 'docs.cursor.com',
	targetExtension: '.mdc', // Cursor keeps .mdc extension
	supportsRulesSubdirectories: true,

	// Don't include command files in fileMap - they'll be handled by lifecycle hook
	fileMap: {},

	// Override profile directory to include commands directory
	profileDir: '.cursor',
	rulesDir: '.cursor/rules',

	// Lifecycle hooks
	onAdd,
	onRemove
});
