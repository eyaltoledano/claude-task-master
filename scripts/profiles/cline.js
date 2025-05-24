// Cline conversion profile for rule-transformer
import path from 'path';

const brandName = 'Cline';
const brandDir = '.clinerules';
const rulesDir = '.clinerules';
const mcpConfig = false;
const mcpConfigName = 'cline_mcp_settings.json';

// File name mapping (specific files with naming changes)
const fileMap = {
	'cursor_rules.mdc': 'cline_rules.md',
	'dev_workflow.mdc': 'dev_workflow.md',
	'self_improve.mdc': 'self_improve.md',
	'taskmaster.mdc': 'taskmaster.md'
	// Add other mappings as needed
};

const globalReplacements = [
	// 1. Handle cursor.so in any possible context
	{ from: /cursor\.so/gi, to: 'cline.bot' },
	// Edge case: URL with different formatting
	{ from: /cursor\s*\.\s*so/gi, to: 'cline.bot' },
	{ from: /https?:\/\/cursor\.so/gi, to: 'https://cline.bot' },
	{ from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.cline.bot' },
	// 2. Handle tool references - even partial ones
	// NOTE: Cline might have different tool names, adjust as needed
	{ from: /\bedit_file\b/gi, to: 'apply_diff' }, // Example, assuming same as Windsurf for now
	{ from: /\bsearch tool\b/gi, to: 'search_files tool' }, // Example
	{ from: /\bSearch Tool\b/g, to: 'Search_Files Tool' }, // Example
	// 3. Handle basic terms (with case handling)
	{
		from: /\bcursor\b/gi,
		to: (match) => (match.charAt(0) === 'C' ? 'Cline' : 'cline')
	},
	{ from: /Cursor/g, to: 'Cline' },
	{ from: /CURSOR/g, to: 'CLINE' },
	// 4. Handle file extensions
	{ from: /\.mdc\b/g, to: '.md' },
	// 5. Handle any missed URL patterns
	{ from: /docs\.cursor\.com/gi, to: 'docs.cline.bot' },
	{ from: /docs\.cline\.com/gi, to: 'docs.cline.bot' } // Keep if Cline also uses docs.cline.bot
];

const conversionConfig = {
	// Product and brand name replacements
	brandTerms: [
		{ from: /cursor\.so/g, to: 'cline.bot' },
		{ from: /\[cursor\.so\]/g, to: '[cline.bot]' },
		{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://cline.bot' },
		{ from: /\(https:\/\/cursor\.so/g, to: '(https://cline.bot' },
		{
			from: /\bcursor\b/gi,
			to: (match) => (match === 'Cursor' ? 'Cline' : 'cline')
		},
		{ from: /Cursor/g, to: 'Cline' }
	],

	// File extension replacements
	fileExtensions: [{ from: /\.mdc\b/g, to: '.md' }],

	// Documentation URL replacements
	docUrls: [
		{
			from: /https:\/\/docs\.cursor\.com\/[\^\s)\'"\\]+/g,
			to: (match) => match.replace('docs.cursor.com', 'docs.cline.bot')
		},
		{
			from: /https:\/\/docs\.cline\.com\//g, // Adjusted for Cline
			to: 'https://docs.cline.bot/'
		}
	],

	// Tool references - direct replacements
	// NOTE: These might need to be updated for Cline's specific toolset
	toolNames: {
		search: 'search_files', // Example, assuming same as Windsurf for now
		read_file: 'read_file',
		edit_file: 'apply_diff',
		create_file: 'write_to_file',
		run_command: 'execute_command',
		terminal_command: 'execute_command',
		use_mcp: 'use_mcp_tool',
		switch_mode: 'switch_mode'
	},

	// Tool references in context - more specific replacements
	// NOTE: Adjust these based on Cline's tool names and usage
	toolContexts: [
		{ from: /\bsearch tool\b/g, to: 'search_files tool' },
		{ from: /\bedit_file tool\b/g, to: 'apply_diff tool' },
		{ from: /\buse the search\b/g, to: 'use the search_files' },
		{ from: /\bThe edit_file\b/g, to: 'The apply_diff' },
		{ from: /\brun_command executes\b/g, to: 'execute_command executes' },
		{ from: /\buse_mcp connects\b/g, to: 'use_mcp_tool connects' },
		{ from: /\bCursor search\b/g, to: 'Cline search_files' },
		{ from: /\bCursor edit\b/g, to: 'Cline apply_diff' },
		{ from: /\bCursor create\b/g, to: 'Cline write_to_file' },
		{ from: /\bCursor run\b/g, to: 'Cline execute_command' }
	],

	// Tool group and category names
	// NOTE: Adjust these if Cline has different group names
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
			const newFileName = fileMap[`${baseName}.mdc`] || `${baseName}.md`; // Uses 'cline_rules.md' for cursor_rules.mdc
			// Return the updated link
			return `[${text}](mdc:.clinerules/${newFileName})`; // Adjusted rulesDir
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
	brandDir,
	rulesDir,
	getTargetRuleFilename,
	mcpConfig,
	mcpConfigName
};
