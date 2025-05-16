// Windsurf conversion profile for rule-transformer
import path from 'path';

const brandName = 'Windsurf';
const rulesDir = '.windsurf/rules';

// File name mapping (specific files with naming changes)
const fileMap = {
	'cursor_rules.mdc': 'windsurf_rules.md',
	'dev_workflow.mdc': 'dev_workflow.md',
	'self_improve.mdc': 'self_improve.md',
	'taskmaster.mdc': 'taskmaster.md'
	// Add other mappings as needed
};

const globalReplacements = [
	// 1. Handle cursor.so in any possible context
	{ from: /cursor\.so/gi, to: 'windsurf.com' },
	// Edge case: URL with different formatting
	{ from: /cursor\s*\.\s*so/gi, to: 'windsurf.com' },
	{ from: /https?:\/\/cursor\.so/gi, to: 'https://windsurf.com' },
	{ from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.windsurf.com' },
	// 2. Handle tool references - even partial ones
	{ from: /\bedit_file\b/gi, to: 'apply_diff' },
	{ from: /\bsearch tool\b/gi, to: 'search_files tool' },
	{ from: /\bSearch Tool\b/g, to: 'Search_Files Tool' },
	// 3. Handle basic terms (with case handling)
	{
		from: /\bcursor\b/gi,
		to: (match) => (match.charAt(0) === 'C' ? 'Windsurf' : 'windsurf')
	},
	{ from: /Cursor/g, to: 'Windsurf' },
	{ from: /CURSOR/g, to: 'WINDSURF' },
	// 4. Handle file extensions
	{ from: /\.mdc\b/g, to: '.md' },
	// 5. Handle any missed URL patterns
	{ from: /docs\.cursor\.com/gi, to: 'docs.windsurf.com' },
	{ from: /docs\.windsurf\.com/gi, to: 'docs.windsurf.com' }
];

const conversionConfig = {
	// Product and brand name replacements
	brandTerms: [
		{ from: /cursor\.so/g, to: 'windsurf.com' },
		{ from: /\[cursor\.so\]/g, to: '[windsurf.com]' },
		{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://windsurf.com' },
		{ from: /\(https:\/\/cursor\.so/g, to: '(https://windsurf.com' },
		{
			from: /\bcursor\b/gi,
			to: (match) => (match === 'Cursor' ? 'Windsurf' : 'windsurf')
		},
		{ from: /Cursor/g, to: 'Windsurf' }
	],

	// File extension replacements
	fileExtensions: [{ from: /\.mdc\b/g, to: '.md' }],

	// Documentation URL replacements
	docUrls: [
		{
			from: /https:\/\/docs\.cursor\.com\/[\^\s)\'"\\]+/g,
			to: (match) => match.replace('docs.cursor.com', 'docs.windsurf.com')
		},
		{
			from: /https:\/\/docs\.windsurf\.com\//g,
			to: 'https://docs.windsurf.com/'
		}
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
		{ from: /\bCursor search\b/g, to: 'Windsurf search_files' },
		{ from: /\bCursor edit\b/g, to: 'Windsurf apply_diff' },
		{ from: /\bCursor create\b/g, to: 'Windsurf write_to_file' },
		{ from: /\bCursor run\b/g, to: 'Windsurf execute_command' }
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
			return `[${text}](mdc:.windsurf/rules/${newFileName})`;
		}
	}
};

function getTargetRuleFilename(sourceFilename) {
	if (fileMap[sourceFilename]) {
		return fileMap[sourceFilename];
	}
	return sourceFilename.replace(/\.mdc$/, '.md');
}

export {
	conversionConfig,
	fileMap,
	globalReplacements,
	brandName,
	rulesDir,
	getTargetRuleFilename
};
