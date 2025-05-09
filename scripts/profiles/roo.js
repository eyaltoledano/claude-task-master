// Roo Code conversion profile for rule-transformer
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const brandName = 'Roo';
const rulesDir = '.roo/rules';

// File name mapping (specific files with naming changes)
const fileMap = {
	'cursor_rules.mdc': 'roo_rules.md',
	'dev_workflow.mdc': 'dev_workflow.md',
	'self_improve.mdc': 'self_improve.md',
	'taskmaster.mdc': 'taskmaster.md'
	// Add other mappings as needed
};

const globalReplacements = [
	// 1. Handle cursor.so in any possible context
	{ from: /cursor\.so/gi, to: 'roocode.com' },
	// Edge case: URL with different formatting
	{ from: /cursor\s*\.\s*so/gi, to: 'roocode.com' },
	{ from: /https?:\/\/cursor\.so/gi, to: 'https://roocode.com' },
	{ from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.roocode.com' },
	// 2. Handle tool references - even partial ones
	{ from: /\bedit_file\b/gi, to: 'apply_diff' },
	{ from: /\bsearch tool\b/gi, to: 'search_files tool' },
	{ from: /\bSearch Tool\b/g, to: 'Search_Files Tool' },
	// 3. Handle basic terms (with case handling)
	{
		from: /\bcursor\b/gi,
		to: (match) => (match.charAt(0) === 'C' ? 'Roo Code' : 'roo')
	},
	{ from: /Cursor/g, to: 'Roo Code' },
	{ from: /CURSOR/g, to: 'ROO CODE' },
	// 4. Handle file extensions
	{ from: /\.mdc\b/g, to: '.md' },
	// 5. Handle any missed URL patterns
	{ from: /docs\.cursor\.com/gi, to: 'docs.roocode.com' },
	{ from: /docs\.roo\.com/gi, to: 'docs.roocode.com' }
];

const conversionConfig = {
	// Product and brand name replacements
	brandTerms: [
		{ from: /cursor\.so/g, to: 'roocode.com' },
		{ from: /\[cursor\.so\]/g, to: '[roocode.com]' },
		{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://roocode.com' },
		{ from: /\(https:\/\/cursor\.so/g, to: '(https://roocode.com' },
		{
			from: /\bcursor\b/gi,
			to: (match) => (match === 'Cursor' ? 'Roo Code' : 'roo')
		},
		{ from: /Cursor/g, to: 'Roo Code' }
	],

	// File extension replacements
	fileExtensions: [{ from: /\.mdc\b/g, to: '.md' }],

	// Documentation URL replacements
	docUrls: [
		{
			from: /https:\/\/docs\.cursor\.com\/[^\s)'\"]+/g,
			to: (match) => match.replace('docs.cursor.com', 'docs.roocode.com')
		},
		{ from: /https:\/\/docs\.roo\.com\//g, to: 'https://docs.roocode.com/' }
	],

	// Tool references - direct replacements
	toolNames: {
		search: 'search_files',
		read_file: 'read_file',
		edit_file: 'apply_diff',
		create_file: 'write_to_file',
		run_command: 'execute_command',
		terminal_command: 'execute_command',
		use_mcp: 'use_mcp_tool',
		switch_mode: 'switch_mode'
	},

	// Tool references in context - more specific replacements
	toolContexts: [
		{ from: /\bsearch tool\b/g, to: 'search_files tool' },
		{ from: /\bedit_file tool\b/g, to: 'apply_diff tool' },
		{ from: /\buse the search\b/g, to: 'use the search_files' },
		{ from: /\bThe edit_file\b/g, to: 'The apply_diff' },
		{ from: /\brun_command executes\b/g, to: 'execute_command executes' },
		{ from: /\buse_mcp connects\b/g, to: 'use_mcp_tool connects' },
		{ from: /\bCursor search\b/g, to: 'Roo Code search_files' },
		{ from: /\bCursor edit\b/g, to: 'Roo Code apply_diff' },
		{ from: /\bCursor create\b/g, to: 'Roo Code write_to_file' },
		{ from: /\bCursor run\b/g, to: 'Roo Code execute_command' }
	],

	// Tool group and category names
	toolGroups: [
		{ from: /\bSearch tools\b/g, to: 'Read Group tools' },
		{ from: /\bEdit tools\b/g, to: 'Edit Group tools' },
		{ from: /\bRun tools\b/g, to: 'Command Group tools' },
		{ from: /\bMCP servers\b/g, to: 'MCP Group tools' },
		{ from: /\bSearch Group\b/g, to: 'Read Group' },
		{ from: /\bEdit Group\b/g, to: 'Edit Group' },
		{ from: /\bRun Group\b/g, to: 'Command Group' }
	],

	// File references in markdown links
	fileReferences: {
		pathPattern: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
		replacement: (match, text, filePath) => {
			// Get the base filename
			const baseName = path.basename(filePath, '.mdc');
			// Get the new filename (either from mapping or by replacing extension)
			const newFileName = fileMap[`${baseName}.mdc`] || `${baseName}.md`;
			// Return the updated link
			return `[${text}](mdc:.roo/rules/${newFileName})`;
		}
	}
};

// Recursively copy everything from assets/roocode to the project root

export function onAddBrandRules(targetDir) {
	const sourceDir = path.resolve(__dirname, '../../assets/roocode');
	copyRecursiveSync(sourceDir, targetDir);

	// Enhanced error checking and logging for .roomodes and rules-*mode* files
	const rooModesDir = path.join(sourceDir, '.roo');
	const rooModes = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];

	// Copy .roomodes to project root
	const roomodesSrc = path.join(sourceDir, '.roomodes');
	const roomodesDest = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesSrc)) {
		try {
			fs.copyFileSync(roomodesSrc, roomodesDest);
			console.log(`[Roo] Copied .roomodes to ${roomodesDest}`);
		} catch (err) {
			console.warn(`[Roo] Failed to copy .roomodes: ${err.message}`);
		}
	} else {
		console.warn(`[Roo] .roomodes not found at ${roomodesSrc}`);
	}

	// Copy each <mode>-rules file into the corresponding .roo/rules-<mode>/ folder
	for (const mode of rooModes) {
		const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				// Ensure destination directory exists
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(src, dest);
				console.log(`[Roo] Copied ${src} to ${dest}`);
			} catch (err) {
				console.warn(`[Roo] Failed to copy ${src} to ${dest}: ${err.message}`);
			}
		} else {
			console.warn(`[Roo] Roo rule file not found for mode '${mode}': ${src}`);
		}
	}
}


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

export function onRemoveBrandRules(targetDir) {
	const sourceDir = path.resolve(__dirname, '../../assets/roocode');
	// Remove all files/folders that exist in assets/roocode from the project root
	removeRecursiveSync(sourceDir, targetDir);

	// After removing, check if .roo exists and is empty; if so, remove it
	const rooDir = path.join(targetDir, '.roo');
	if (fs.existsSync(rooDir) && isDirectoryEmpty(rooDir)) {
		fs.rmSync(rooDir, { recursive: true, force: true });
	}
}

function removeRecursiveSync(src, destRoot) {
	if (!fs.existsSync(src)) return;
	const stats = fs.statSync(src);
	if (stats.isDirectory()) {
		const destDir = path.join(destRoot, path.basename(src));
		if (fs.existsSync(destDir)) {
			fs.rmSync(destDir, { recursive: true, force: true });
		}
		// Also walk subfolders in src to remove nested structure
		fs.readdirSync(src).forEach((child) => {
			removeRecursiveSync(path.join(src, child), destRoot);
		});
	} else {
		const destFile = path.join(destRoot, path.basename(src));
		if (fs.existsSync(destFile)) {
			fs.rmSync(destFile, { force: true });
		}
	}
}

function isDirectoryEmpty(dirPath) {
	return fs.readdirSync(dirPath).length === 0;
}

function onPostConvertBrandRules(targetDir) {
	onAddBrandRules(targetDir);
}

export { conversionConfig, fileMap, globalReplacements, brandName, rulesDir, onPostConvertBrandRules };


