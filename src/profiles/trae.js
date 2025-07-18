// Trae profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create trae profile using the new ProfileBuilder
const traeProfile = ProfileBuilder
	.minimal('trae')
	.display('Trae')
	.profileDir('.trae')
	.rulesDir('.trae/rules')
	.mcpConfig(false) // Trae doesn't use MCP config
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'trae.ai' },
			{ from: /\[cursor\.so\]/g, to: '[trae.ai]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://trae.ai' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://trae.ai' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Trae' : 'trae')
			},
			{ from: /Cursor/g, to: 'Trae' }
		],

		// Documentation URL replacements
		docUrls: [
			{
				from: /https:\/\/docs\.cursor\.com\/[^\s)'"]+/g,
				to: (match) => match.replace('docs.cursor.com', 'docs.trae.ai')
			},
			{
				from: /https:\/\/docs\.trae\.ai\//g,
				to: 'https://docs.trae.ai/'
			}
		],

		// Tool references
		toolNames: {
			search: 'search',
			read_file: 'read_file',
			edit_file: 'edit_file',
			create_file: 'create_file',
			run_command: 'run_command',
			terminal_command: 'terminal_command',
			use_mcp: 'use_mcp',
			switch_mode: 'switch_mode'
		},

		// File references in markdown links
		fileReferences: {
			pathPattern: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			replacement: (match, text, filePath) => {
				const baseName = filePath.split('/').pop().replace('.mdc', '');
				const newFileName = `${baseName}.md`;
				const newLinkText = newFileName;
				return `[${newLinkText}](.trae/rules/${newFileName})`;
			}
		}
	})
	.globalReplacements([
		// Handle URLs in any context
		{ from: /cursor\.so/gi, to: 'trae.ai' },
		{ from: /cursor\s*\.\s*so/gi, to: 'trae.ai' },
		{ from: /https?:\/\/cursor\.so/gi, to: 'https://trae.ai' },
		{ from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.trae.ai' },

		// Handle basic terms with proper case handling
		{
			from: /\bcursor\b/gi,
			to: (match) => match.charAt(0) === 'C' ? 'Trae' : 'trae'
		},
		{ from: /Cursor/g, to: 'Trae' },
		{ from: /CURSOR/g, to: 'TRAE' },

		// Handle file extensions
		{ from: /\.mdc(?!\])b/g, to: '.md' },

		// Handle documentation URLs
		{ from: /docs\.cursor\.com/gi, to: 'docs.trae.ai' }
	])
	.fileMap({
		'rules/cursor_rules.mdc': 'trae_rules.md',
		'rules/dev_workflow.mdc': 'dev_workflow.md',
		'rules/self_improve.mdc': 'self_improve.md',
		'rules/taskmaster.mdc': 'taskmaster.md'
	})
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { traeProfile };

// Export legacy-compatible version for backward compatibility
export const traeProfileLegacy = traeProfile.toLegacyFormat();

// Default export for legacy compatibility
export default traeProfileLegacy;
