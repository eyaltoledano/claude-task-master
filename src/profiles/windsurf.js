// Windsurf profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create windsurf profile using the new ProfileBuilder
const windsurfProfile = ProfileBuilder
	.minimal('windsurf')
	.display('Windsurf')
	.profileDir('.windsurf')
	.rulesDir('.windsurf/rules')
	.mcpConfig(true)
	.conversion({
		// Profile name replacements
		profileTerms: [
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

		// Documentation URL replacements
		docUrls: [
			{
				from: /https:\/\/docs\.cursor\.com\/[^\s)'"]+/g,
				to: (match) => match.replace('docs.cursor.com', 'docs.windsurf.com')
			},
			{
				from: /https:\/\/docs\.windsurf\.com\//g,
				to: 'https://docs.windsurf.com/'
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
				return `[${newLinkText}](.windsurf/rules/${newFileName})`;
			}
		}
	})
	.globalReplacements([
		// Handle URLs in any context
		{ from: /cursor\.so/gi, to: 'windsurf.com' },
		{ from: /cursor\s*\.\s*so/gi, to: 'windsurf.com' },
		{ from: /https?:\/\/cursor\.so/gi, to: 'https://windsurf.com' },
		{ from: /https?:\/\/www\.cursor\.so/gi, to: 'https://www.windsurf.com' },

		// Handle basic terms with proper case handling
		{
			from: /\bcursor\b/gi,
			to: (match) => match.charAt(0) === 'C' ? 'Windsurf' : 'windsurf'
		},
		{ from: /Cursor/g, to: 'Windsurf' },
		{ from: /CURSOR/g, to: 'WINDSURF' },

		// Handle file extensions
		{ from: /\.mdc(?!\])b/g, to: '.md' },

		// Handle documentation URLs
		{ from: /docs\.cursor\.com/gi, to: 'docs.windsurf.com' }
	])
	.fileMap({
		'rules/cursor_rules.mdc': 'windsurf_rules.md',
		'rules/dev_workflow.mdc': 'dev_workflow.md',
		'rules/self_improve.mdc': 'self_improve.md',
		'rules/taskmaster.mdc': 'taskmaster.md'
	})
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { windsurfProfile };

// Export legacy-compatible version for backward compatibility
export const windsurfProfileLegacy = windsurfProfile.toLegacyFormat();

// Default export for legacy compatibility
export default windsurfProfileLegacy;
