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
 * Helper function to count markdown files recursively
 * @param {string} dir - Directory path to count markdown files in
 * @returns {number} Total count of markdown files
 */
function countMarkdownFiles(dir) {
	let total = 0;
	const stats = fs.statSync(dir);
	if (stats.isDirectory()) {
		for (const entry of fs.readdirSync(dir)) {
			total += countMarkdownFiles(path.join(dir, entry));
		}
	} else if (path.extname(dir) === '.md') {
		total += 1;
	}
	return total;
}

/**
 * Hook: onAddRulesProfile
 * Copies Task Master slash commands from assets to .cursor/commands with syntax transformation
 * @param {string} projectRoot - The root directory of the project
 * @param {string} assetsDir - The assets directory containing source files
 * @returns {{processed: number, skipped: number, fileCount: number, success: number, failed: number}} Count of processed/skipped operations and total files
 */
const onAdd = (projectRoot, assetsDir) => {
	const sourceDir = path.join(assetsDir, 'claude', 'commands');
	const targetDir = path.join(projectRoot, '.cursor', 'commands');

	if (!fs.existsSync(sourceDir)) {
		log('warn', `Source commands not found: ${sourceDir}`);
		return {
			processed: 0,
			skipped: 0,
			fileCount: 0,
			success: 0,
			failed: 1
		};
	}

	// Transform function for Claude -> Cursor syntax
	const transform = (content) => {
		// Only transform if legacy Claude patterns are detected
		const hasLegacyPatterns =
			/\/project:tm\//.test(content) || content.includes("Type '/project:tm/'");

		if (!hasLegacyPatterns) {
			return content;
		}

		return content
			.replace(/\/project:tm\//g, 'tm/')
			.replace(
				/Type '\/project:tm\/' and use tab completion/g,
				"Type 'tm/' and use tab completion"
			);
	};

	log('info', 'Adding Task Master slash commands to .cursor/commands');
	const fileCount = countMarkdownFiles(sourceDir);
	const processed = copyRecursiveWithTransform(sourceDir, targetDir, transform);
	log(
		'success',
		`Processed ${processed} of ${fileCount} Task Master slash command files`
	);
	return {
		processed: processed,
		skipped: fileCount - processed,
		fileCount: fileCount,
		success: processed,
		failed: fileCount - processed
	};
};

/**
 * Hook: onRemoveRulesProfile
 * Removes Task Master slash commands from .cursor/commands directory
 * @param {string} projectRoot - The root directory of the project
 * @param {string} assetsDir - The assets directory containing source files
 * @returns {{processed: number, skipped: number, fileCount: number, success: number, failed: number}} Count of successful/failed removal operations and total files targeted for removal
 */
const onRemove = (projectRoot, assetsDir) => {
	if (!assetsDir) {
		log('warn', 'assetsDir not provided to onRemove');
		return {
			success: 0,
			failed: 1,
			fileCount: 0
		};
	}

	const sourceDir = path.join(assetsDir, 'claude', 'commands');
	const targetDir = path.join(projectRoot, '.cursor', 'commands');

	if (!fs.existsSync(targetDir)) {
		log('info', 'No Task Master commands found to remove');
		return {
			processed: 0,
			skipped: 0,
			fileCount: 0,
			success: 0,
			failed: 0
		};
	}

	if (!fs.existsSync(sourceDir)) {
		log('warn', `Source commands not found: ${sourceDir}`);
		return {
			processed: 0,
			skipped: 0,
			fileCount: 0,
			success: 0,
			failed: 1
		};
	}

	try {
		// Get all markdown files that should be removed by mirroring source structure
		const filesToRemove = [];

		const collectSourceFiles = (srcDir, relativePath = '') => {
			fs.readdirSync(srcDir).forEach((item) => {
				const fullPath = path.join(srcDir, item);
				const relativeItemPath = path.join(relativePath, item);

				if (fs.statSync(fullPath).isDirectory()) {
					collectSourceFiles(fullPath, relativeItemPath);
				} else if (item.endsWith('.md')) {
					const targetFilePath = path.join(targetDir, relativeItemPath);
					if (fs.existsSync(targetFilePath)) {
						filesToRemove.push(targetFilePath);
					}
				}
			});
		};

		collectSourceFiles(sourceDir);

		log('info', `Removing ${filesToRemove.length} Task Master slash commands`);

		// Remove the collected files
		let successCount = 0;
		let failedCount = 0;
		filesToRemove.forEach((filePath) => {
			try {
				fs.rmSync(filePath, { force: true });
				successCount++;
			} catch (err) {
				log('warn', `Failed to remove ${filePath}: ${err.message}`);
				failedCount++;
			}
		});

		// Remove empty directories
		const removeEmptyDirs = (dir) => {
			if (!fs.existsSync(dir)) return;

			try {
				const items = fs.readdirSync(dir);

				// Recursively process subdirectories first
				items.forEach((item) => {
					const fullPath = path.join(dir, item);
					if (fs.statSync(fullPath).isDirectory()) {
						removeEmptyDirs(fullPath);
					}
				});

				// Check if directory is now empty and remove if so
				const remainingItems = fs.readdirSync(dir);
				if (remainingItems.length === 0 && dir !== targetDir) {
					fs.rmdirSync(dir);
				}
			} catch (err) {
				// Ignore errors when cleaning up directories
			}
		};

		removeEmptyDirs(targetDir);

		log(
			'success',
			`Removed ${successCount} Task Master slash commands from Cursor IDE`
		);
		return {
			processed: successCount,
			skipped: 0,
			fileCount: filesToRemove.length,
			success: successCount,
			failed: failedCount
		};
	} catch (error) {
		log('warn', `Failed to remove commands: ${error.message}`);
		return {
			processed: 0,
			skipped: 0,
			fileCount: 0,
			success: 0,
			failed: 1
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
