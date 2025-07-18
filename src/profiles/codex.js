// Codex profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create codex profile using the new ProfileBuilder
const codexProfile = ProfileBuilder
	.minimal('codex')
	.display('Codex')
	.profileDir('.') // Root directory
	.rulesDir('.') // No specific rules directory needed
	.mcpConfig(false)
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': 'AGENTS.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'codex.ai' },
			{ from: /\[cursor\.so\]/g, to: '[codex.ai]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://codex.ai' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://codex.ai' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Codex' : 'codex')
			},
			{ from: /Cursor/g, to: 'Codex' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'platform.openai.com/docs/codex' }
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
export { codexProfile };

// Legacy-compatible export for backward compatibility
export const codexProfileLegacy = codexProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default codexProfileLegacy;
