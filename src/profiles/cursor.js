// Cursor profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cursor profile using the new ProfileBuilder
const cursorProfile = ProfileBuilder
	.minimal('cursor')
	.display('Cursor')
	.profileDir('.cursor')
	.rulesDir('.cursor/rules')
	.mcpConfig(true)
	.includeDefaultRules(true)
	.supportsSubdirectories(true)
	.fileMap({
		// Cursor uses .mdc extension and keeps original names
		'rules/cursor_rules.mdc': 'cursor_rules.mdc',
		'rules/dev_workflow.mdc': 'dev_workflow.mdc',
		'rules/self_improve.mdc': 'self_improve.mdc',
		'rules/taskmaster.mdc': 'taskmaster.mdc',
		'rules/glossary.mdc': 'glossary.mdc',
		'rules/changeset.mdc': 'changeset.mdc',
		'rules/architecture.mdc': 'architecture.mdc',
		'rules/commands.mdc': 'commands.mdc',
		'rules/dependencies.mdc': 'dependencies.mdc',
		'rules/mcp.mdc': 'mcp.mdc',
		'rules/new_features.mdc': 'new_features.mdc',
		'rules/tasks.mdc': 'tasks.mdc',
		'rules/tests.mdc': 'tests.mdc',
		'rules/ui.mdc': 'ui.mdc',
		'rules/utilities.mdc': 'utilities.mdc',
		'rules/telemetry.mdc': 'telemetry.mdc',
		'AGENTS.md': 'AGENTS.md'
	})
	.conversion({
		// No profile term replacements for cursor (it's the source)
		profileTerms: [],
		// No doc URL replacements for cursor  
		docUrls: [],
		// Standard tool mappings (no custom tools for cursor)
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
export { cursorProfile };

// Legacy-compatible export for backward compatibility
export const cursorProfileLegacy = cursorProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default cursorProfileLegacy;
