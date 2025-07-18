// Gemini profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create gemini profile using the new ProfileBuilder
const geminiProfile = ProfileBuilder
	.minimal('gemini')
	.display('Gemini')
	.profileDir('.gemini') // Keep .gemini for settings.json
	.rulesDir('.') // Root directory for GEMINI.md
	.mcpConfig({
		configName: 'settings.json' // Override default 'mcp.json'
	})
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': 'GEMINI.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'codeassist.google' },
			{ from: /\[cursor\.so\]/g, to: '[codeassist.google]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://codeassist.google' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://codeassist.google' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Gemini' : 'gemini')
			},
			{ from: /Cursor/g, to: 'Gemini' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'github.com/google-gemini/gemini-cli' }
		],
		// Tool name mappings (standard - no custom tools)
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
export { geminiProfile };

// Legacy-compatible export for backward compatibility
export const geminiProfileLegacy = geminiProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default geminiProfileLegacy;
