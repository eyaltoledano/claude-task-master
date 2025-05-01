/**
 * Rule Transformer Module
 * Handles conversion of Cursor rules to Roo rules
 *
 * This module procedurally generates .roo/rules files from .cursor/rules files,
 * eliminating the need to maintain both sets of files manually.
 */
import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

// Configuration for term conversions - centralized for easier future updates
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
			from: /https:\/\/docs\.cursor\.com\/[^\s)'"]+/g,
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
		// Additional contextual patterns for flexibility
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

// File name mapping (specific files with naming changes)
const fileMap = {
	'cursor_rules.mdc': 'roo_rules.md',
	'dev_workflow.mdc': 'dev_workflow.md',
	'self_improve.mdc': 'self_improve.md',
	'taskmaster.mdc': 'taskmaster.md'
	// Add other mappings as needed
};

/**
 * Replace basic Cursor terms with Roo equivalents
 */
function replaceBasicTerms(content) {
	let result = content;

	// Apply brand term replacements
	conversionConfig.brandTerms.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	// Apply file extension replacements
	conversionConfig.fileExtensions.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Replace Cursor tool references with Roo tool equivalents
 */
function replaceToolReferences(content) {
	let result = content;

	// Basic pattern for direct tool name replacements
	const toolNames = conversionConfig.toolNames;
	const toolReferencePattern = new RegExp(
		`\\b(${Object.keys(toolNames).join('|')})\\b`,
		'g'
	);

	// Apply direct tool name replacements
	result = result.replace(toolReferencePattern, (match, toolName) => {
		return toolNames[toolName] || toolName;
	});

	// Apply contextual tool replacements
	conversionConfig.toolContexts.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	// Apply tool group replacements
	conversionConfig.toolGroups.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Update documentation URLs to point to Roo documentation
 */
function updateDocReferences(content) {
	let result = content;

	// Apply documentation URL replacements
	conversionConfig.docUrls.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	return result;
}

/**
 * Update file references in markdown links
 */
function updateFileReferences(content) {
	const { pathPattern, replacement } = conversionConfig.fileReferences;
	return content.replace(pathPattern, replacement);
}

/**
 * Main transformation function that applies all conversions
 */
function transformCursorToRooRules(content) {
	// Apply all transformations in appropriate order
	let result = content;
	result = replaceBasicTerms(result);
	result = replaceToolReferences(result);
	result = updateDocReferences(result);
	result = updateFileReferences(result);

	// Super aggressive failsafe pass to catch any variations we might have missed
	// This ensures critical transformations are applied even in contexts we didn't anticipate

	// 1. Handle cursor.so in any possible context
	result = result.replace(/cursor\.so/gi, 'roocode.com');
	// Edge case: URL with different formatting
	result = result.replace(/cursor\s*\.\s*so/gi, 'roocode.com');
	result = result.replace(/https?:\/\/cursor\.so/gi, 'https://roocode.com');
	result = result.replace(
		/https?:\/\/www\.cursor\.so/gi,
		'https://www.roocode.com'
	);

	// 2. Handle tool references - even partial ones
	result = result.replace(/\bedit_file\b/gi, 'apply_diff');
	result = result.replace(/\bsearch tool\b/gi, 'search_files tool');
	result = result.replace(/\bSearch Tool\b/g, 'Search_Files Tool');

	// 3. Handle basic terms (with case handling)
	result = result.replace(/\bcursor\b/gi, (match) =>
		match.charAt(0) === 'C' ? 'Roo Code' : 'roo'
	);
	result = result.replace(/Cursor/g, 'Roo Code');
	result = result.replace(/CURSOR/g, 'ROO CODE');

	// 4. Handle file extensions
	result = result.replace(/\.mdc\b/g, '.md');

	// 5. Handle any missed URL patterns
	result = result.replace(/docs\.cursor\.com/gi, 'docs.roocode.com');
	result = result.replace(/docs\.roo\.com/gi, 'docs.roocode.com');

	return result;
}

/**
 * Convert a single Cursor rule file to Roo rule format
 */
function convertCursorRuleToRooRule(sourcePath, targetPath) {
	try {
		log(
			'info',
			`Converting Cursor rule ${path.basename(sourcePath)} to Roo rule ${path.basename(targetPath)}`
		);

		// Read source content
		const content = fs.readFileSync(sourcePath, 'utf8');

		// Transform content
		const transformedContent = transformCursorToRooRules(content);

		// Ensure target directory exists
		const targetDir = path.dirname(targetPath);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Write transformed content
		fs.writeFileSync(targetPath, transformedContent);
		log(
			'success',
			`Successfully converted ${path.basename(sourcePath)} to ${path.basename(targetPath)}`
		);

		return true;
	} catch (error) {
		log(
			'error',
			`Failed to convert rule file ${path.basename(sourcePath)}: ${error.message}`
		);
		return false;
	}
}

/**
 * Process all Cursor rules and convert to Roo rules
 */
function convertAllCursorRulesToRooRules(projectDir) {
	const cursorRulesDir = path.join(projectDir, '.cursor', 'rules');
	const rooRulesDir = path.join(projectDir, '.roo', 'rules');

	if (!fs.existsSync(cursorRulesDir)) {
		log('warn', `Cursor rules directory not found: ${cursorRulesDir}`);
		return { success: 0, failed: 0 };
	}

	// Ensure Roo rules directory exists
	if (!fs.existsSync(rooRulesDir)) {
		fs.mkdirSync(rooRulesDir, { recursive: true });
		log('info', `Created Roo rules directory: ${rooRulesDir}`);
	}

	// Count successful and failed conversions
	let success = 0;
	let failed = 0;

	// Process each file in the Cursor rules directory
	fs.readdirSync(cursorRulesDir).forEach((file) => {
		if (file.endsWith('.mdc')) {
			const sourcePath = path.join(cursorRulesDir, file);

			// Determine target file name (either from mapping or by replacing extension)
			const targetFilename = fileMap[file] || file.replace('.mdc', '.md');
			const targetPath = path.join(rooRulesDir, targetFilename);

			// Convert the file
			if (convertCursorRuleToRooRule(sourcePath, targetPath)) {
				success++;
			} else {
				failed++;
			}
		}
	});

	log(
		'info',
		`Rule conversion complete: ${success} successful, ${failed} failed`
	);
	return { success, failed };
}

export { convertAllCursorRulesToRooRules, convertCursorRuleToRooRule };
