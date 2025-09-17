// Cursor conversion profile for rule-transformer
import { createProfile } from './base-profile.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { log } from '../../scripts/modules/utils.js';

// Helper function to copy and transform files (similar to claude.js)
function copyRecursiveWithTransform(src, dest, transformFn) {
	let count = 0;
	try {
		const stats = fs.statSync(src);
		if (stats.isDirectory()) {
			fs.mkdirSync(dest, { recursive: true });
			fs.readdirSync(src).forEach((item) => {
				count += copyRecursiveWithTransform(
					path.join(src, item),
					path.join(dest, item),
					transformFn
				);
			});
		} else {
			const isMarkdown = path.extname(src) === '.md';
			// Preserve existing user files; do not overwrite
			if (!fs.existsSync(dest)) {
				if (transformFn && isMarkdown) {
					const content = fs.readFileSync(src, 'utf8');
					const transformed = transformFn(content);
					fs.writeFileSync(dest, transformed, { encoding: 'utf8', flag: 'wx' });
				} else {
					fs.copyFileSync(src, dest);
				}
			}
			if (isMarkdown) count++;
		}
	} catch (error) {
		log('warn', `Failed to process ${src}: ${error.message}`);
	}
	return count;
}

/**
 * Hook: onAddRulesProfile
 * Copies Task Master slash commands from assets to .cursor/commands with syntax transformation
 * @param {string} projectRoot - The root directory of the project
 * @param {string} assetsDir - The assets directory containing source files
 * @returns {{success: number, failed: number, fileCount: number}} Count of successful/failed operations and total files processed
 */
const onAdd = (projectRoot, assetsDir) => {
	const sourceDir = path.join(assetsDir, 'claude', 'commands');
	const targetDir = path.join(projectRoot, '.cursor', 'commands');

	if (!fs.existsSync(sourceDir)) {
		log('warn', `Source commands not found: ${sourceDir}`);
		return {
			success: 0,
			failed: 1,
			fileCount: 0
		};
	}

	// Transform function for Claude -> Cursor syntax
	const transform = (content) =>
		content
			.replace(/\/project:tm\//g, 'tm/')
			.replace(
				/Type '\/project:tm\/' and use tab completion/g,
				"Type 'tm/' and use tab completion"
			);

	log('info', 'Adding Task Master slash commands to .cursor/commands');
	const count = copyRecursiveWithTransform(sourceDir, targetDir, transform);
	log('success', `Added ${count} Task Master slash commands to Cursor IDE`);
	return {
		success: count,
		failed: 0,
		fileCount: count
	};
};

/**
 * Hook: onRemoveRulesProfile  
 * Removes Task Master slash commands from .cursor/commands directory
 * @param {string} projectRoot - The root directory of the project
 * @returns {{success: number, failed: number, fileCount: number}} Count of successful/failed operations and total files processed
 */
const onRemove = (projectRoot) => {
	const commandsDir = path.join(projectRoot, '.cursor', 'commands');

	if (!fs.existsSync(commandsDir)) {
		log('info', 'No Task Master commands found to remove');
		return {
			success: 0,
			failed: 0,
			fileCount: 0
		};
	}

	try {
		// Count Task Master .md files recursively (files starting with 'tm-')
		let count = 0;
		const countFiles = (dir) => {
			fs.readdirSync(dir).forEach((item) => {
				const fullPath = path.join(dir, item);
				if (fs.statSync(fullPath).isDirectory()) {
					countFiles(fullPath);
				} else if (item.startsWith('tm-') && item.endsWith('.md')) {
					count++;
				}
			});
		};
		countFiles(commandsDir);

		log('info', `Removing ${count} Task Master slash commands`);
		
		// Remove individual Task Master files
		const removeFiles = (dir) => {
			fs.readdirSync(dir).forEach((item) => {
				const fullPath = path.join(dir, item);
				if (fs.statSync(fullPath).isDirectory()) {
					removeFiles(fullPath);
				} else if (item.startsWith('tm-') && item.endsWith('.md')) {
					fs.rmSync(fullPath);
				}
			});
		};
		removeFiles(commandsDir);
		log('success', `Removed ${count} Task Master slash commands from Cursor IDE`);
		return {
			success: count,
			failed: 0,
			fileCount: count
		};
	} catch (error) {
		log('warn', `Failed to remove commands: ${error.message}`);
		return {
			success: 0,
			failed: 1,
			fileCount: 0
		};
	}
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
