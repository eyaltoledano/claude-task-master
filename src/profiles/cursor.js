// Cursor conversion profile for rule-transformer
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import fs from 'fs';
import path from 'path';

// Helper function to copy and transform files (similar to claude.js)
function copyRecursiveWithTransform(src, dest, transformFn) {
	let count = 0;
	try {
		const stats = fs.statSync(src);
		if (stats.isDirectory()) {
			if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
			fs.readdirSync(src).forEach((item) => {
				count += copyRecursiveWithTransform(
					path.join(src, item),
					path.join(dest, item),
					transformFn
				);
			});
		} else {
			const content = fs.readFileSync(src, 'utf8');
			const transformed = transformFn ? transformFn(content) : content;
			fs.writeFileSync(dest, transformed, 'utf8');
			count++;
		}
	} catch (error) {
		console.warn(`Failed to process ${src}: ${error.message}`);
	}
	return count;
}

// Lifecycle hooks
const onAdd = (projectRoot, assetsDir) => {
	const sourceDir = path.join(assetsDir, 'claude', 'commands');
	const targetDir = path.join(projectRoot, '.cursor', 'commands');

	if (!fs.existsSync(sourceDir)) {
		console.warn(`Source commands not found: ${sourceDir}`);
		return { success: 0, failed: 1 };
	}

	// Transform function for Claude -> Cursor syntax
	const transform = (content) =>
		content
			.replace(/\/project:tm\//g, 'tm/')
			.replace(
				/Type '\/project:tm\/' and use tab completion/g,
				"Type 'tm/' and use tab completion"
			);

	console.log(`[INFO] Adding Task Master slash commands to .cursor/commands`);
	const count = copyRecursiveWithTransform(sourceDir, targetDir, transform);
	console.log(
		`[SUCCESS] Added ${count} Task Master slash commands to Cursor IDE`
	);
	return { success: count, failed: 0 };
};

const onRemove = (projectRoot) => {
	const tmDir = path.join(projectRoot, '.cursor', 'commands', 'tm');

	if (!fs.existsSync(tmDir)) {
		console.log(`[INFO] No Task Master commands found to remove`);
		return { success: 0, failed: 0 };
	}

	try {
		// Count .md files recursively
		let count = 0;
		const countFiles = (dir) => {
			fs.readdirSync(dir).forEach((item) => {
				const fullPath = path.join(dir, item);
				if (fs.statSync(fullPath).isDirectory()) {
					countFiles(fullPath);
				} else if (item.endsWith('.md')) {
					count++;
				}
			});
		};
		countFiles(tmDir);

		console.log(`[INFO] Removing ${count} Task Master slash commands`);
		fs.rmSync(tmDir, { recursive: true, force: true });
		console.log(
			`[SUCCESS] Removed ${count} Task Master slash commands from Cursor IDE`
		);
		return { success: count, failed: 0 };
	} catch (error) {
		console.warn(`Failed to remove commands: ${error.message}`);
		return { success: 0, failed: 1 };
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
