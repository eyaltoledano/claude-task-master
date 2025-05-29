// Base profile factory for rule-transformer
import path from 'path';

/**
 * Creates a standardized profile configuration for different editors
 * @param {Object} editorConfig - Editor-specific configuration
 * @returns {Object} - Complete profile configuration
 */
export function createProfile(editorConfig) {
	const {
		name,
		displayName = name,
		url,
		docsUrl,
		profileDir,
		rulesDir = `${profileDir}/rules`,
		mcpConfig = true,
		mcpConfigName = 'mcp.json',
		fileExtension = '.mdc',
		targetExtension = '.md',
		toolMappings = {},
		customReplacements = [],
		customFileMap = {},
		onAdd,
		onRemove,
		onPostConvert
	} = editorConfig;

	const mcpConfigPath = `${profileDir}/${mcpConfigName}`;

	// Standard file mapping with custom overrides
	const defaultFileMap = {
		'cursor_rules.mdc': `${name.toLowerCase()}_rules${targetExtension}`,
		'dev_workflow.mdc': `dev_workflow${targetExtension}`,
		'self_improve.mdc': `self_improve${targetExtension}`,
		'taskmaster.mdc': `taskmaster${targetExtension}`
	};

	const fileMap = { ...defaultFileMap, ...customFileMap };

	// Base global replacements that work for all editors
	const baseGlobalReplacements = [
		// Handle URLs in any context
		{ from: /cursor\.so/gi, to: url },
		{ from: /cursor\s*\.\s*so/gi, to: url },
		{ from: /https?:\/\/cursor\.so/gi, to: `https://${url}` },
		{ from: /https?:\/\/www\.cursor\.so/gi, to: `https://www.${url}` },

		// Handle tool references
		{ from: /\bedit_file\b/gi, to: toolMappings.edit_file || 'edit_file' },
		{
			from: /\bsearch tool\b/gi,
			to: `${toolMappings.search || 'search'} tool`
		},
		{ from: /\bSearch Tool\b/g, to: `${toolMappings.search || 'Search'} Tool` },

		// Handle basic terms with proper case handling
		{
			from: /\bcursor\b/gi,
			to: (match) =>
				match.charAt(0) === 'C' ? displayName : name.toLowerCase()
		},
		{ from: /Cursor/g, to: displayName },
		{ from: /CURSOR/g, to: displayName.toUpperCase() },

		// Handle file extensions if different
		...(targetExtension !== fileExtension
			? [
					{
						from: new RegExp(`\\${fileExtension}(?!\\])\\b`, 'g'),
						to: targetExtension
					}
				]
			: []),

		// Handle documentation URLs
		{ from: /docs\.cursor\.com/gi, to: docsUrl },

		// Custom editor-specific replacements
		...customReplacements
	];

	// Standard tool mappings
	const defaultToolMappings = {
		search: 'search',
		read_file: 'read_file',
		edit_file: 'edit_file',
		create_file: 'create_file',
		run_command: 'run_command',
		terminal_command: 'terminal_command',
		use_mcp: 'use_mcp',
		switch_mode: 'switch_mode',
		...toolMappings
	};

	// Create conversion config
	const conversionConfig = {
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: url },
			{ from: /\[cursor\.so\]/g, to: `[${url}]` },
			{ from: /href="https:\/\/cursor\.so/g, to: `href="https://${url}` },
			{ from: /\(https:\/\/cursor\.so/g, to: `(https://${url}` },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? displayName : name.toLowerCase())
			},
			{ from: /Cursor/g, to: displayName }
		],

		// File extension replacements
		fileExtensions:
			targetExtension !== fileExtension
				? [
						{
							from: new RegExp(`\\${fileExtension}\\b`, 'g'),
							to: targetExtension
						}
					]
				: [],

		// Documentation URL replacements
		docUrls: [
			{
				from: new RegExp(`https:\\/\\/docs\\.cursor\\.com\\/[^\\s)'\"]+`, 'g'),
				to: (match) => match.replace('docs.cursor.com', docsUrl)
			},
			{
				from: new RegExp(`https:\\/\\/${docsUrl}\\/`, 'g'),
				to: `https://${docsUrl}/`
			}
		],

		// Tool references - direct replacements
		toolNames: defaultToolMappings,

		// Tool references in context - more specific replacements
		toolContexts: Object.entries(defaultToolMappings).flatMap(
			([original, mapped]) => [
				{
					from: new RegExp(`\\b${original} tool\\b`, 'g'),
					to: `${mapped} tool`
				},
				{ from: new RegExp(`\\bthe ${original}\\b`, 'g'), to: `the ${mapped}` },
				{ from: new RegExp(`\\bThe ${original}\\b`, 'g'), to: `The ${mapped}` },
				{
					from: new RegExp(`\\bCursor ${original}\\b`, 'g'),
					to: `${displayName} ${mapped}`
				}
			]
		),

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
				const baseName = path.basename(filePath, '.mdc');
				const newFileName =
					fileMap[`${baseName}.mdc`] || `${baseName}${targetExtension}`;
				// Update the link text to match the new filename
				const newLinkText = newFileName;
				// For Cursor, keep the mdc: protocol; for others, use standard relative paths
				if (name.toLowerCase() === 'cursor') {
					return `[${newLinkText}](mdc:${rulesDir}/${newFileName})`;
				} else {
					return `[${newLinkText}](${rulesDir}/${newFileName})`;
				}
			}
		}
	};

	function getTargetRuleFilename(sourceFilename) {
		if (fileMap[sourceFilename]) {
			return fileMap[sourceFilename];
		}
		return targetExtension !== fileExtension
			? sourceFilename.replace(
					new RegExp(`\\${fileExtension}$`),
					targetExtension
				)
			: sourceFilename;
	}

	return {
		profileName: name, // Use name for programmatic access (tests expect this)
		displayName: displayName, // Keep displayName for UI purposes
		profileDir,
		rulesDir,
		mcpConfig,
		mcpConfigName,
		mcpConfigPath,
		fileMap,
		globalReplacements: baseGlobalReplacements,
		conversionConfig,
		getTargetRuleFilename,
		// Optional lifecycle hooks
		...(onAdd && { onAddRulesProfile: onAdd }),
		...(onRemove && { onRemoveRulesProfile: onRemove }),
		...(onPostConvert && { onPostConvertRulesProfile: onPostConvert })
	};
}

// Common tool mappings for editors that share similar tool sets
export const COMMON_TOOL_MAPPINGS = {
	// Most editors (Cursor, Cline, Windsurf) keep original tool names
	STANDARD: {},

	// Roo Code uses different tool names
	ROO_STYLE: {
		edit_file: 'apply_diff',
		search: 'search_files',
		create_file: 'write_to_file',
		run_command: 'execute_command',
		terminal_command: 'execute_command',
		use_mcp: 'use_mcp_tool'
	}
};
