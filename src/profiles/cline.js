// Cline profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cline profile using the new ProfileBuilder
const clineProfile = ProfileBuilder
	.minimal('cline')
	.display('Cline')
	.profileDir('.clinerules')
	.rulesDir('.clinerules')
	.mcpConfig(false)
	.includeDefaultRules(true)
	.fileMap({
		// Default mappings with .md extension
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
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
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'docs.cline.bot' }
		],
		// Standard tool mappings (no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { clineProfile };

// Legacy-compatible export for backward compatibility
export const clineProfileLegacy = clineProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default clineProfileLegacy;
