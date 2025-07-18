// Cursor profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cursor profile with comprehensive file mapping
const cursorProfile = ProfileBuilder.minimal('cursor')
	.display('Cursor')
	.profileDir('.cursor')
	.rulesDir('.cursor/rules')
	.includeDefaultRules(true)
	.fileMap({
		// Core rule files with .mdc extension
		'rules/cursor_rules.mdc': 'cursor_rules.mdc',
		'rules/dev_workflow.mdc': 'dev_workflow.mdc',
		'rules/self_improve.mdc': 'self_improve.mdc',
		'rules/taskmaster.mdc': 'taskmaster.mdc',
		// Additional files that might be present
		'rules/ai_providers.mdc': 'ai_providers.mdc',
		'rules/ai_services.mdc': 'ai_services.mdc',
		'rules/architecture.mdc': 'architecture.mdc',
		'rules/changeset.mdc': 'changeset.mdc',
		'rules/commands.mdc': 'commands.mdc',
		'rules/context_gathering.mdc': 'context_gathering.mdc',
		'rules/dependencies.mdc': 'dependencies.mdc',
		'rules/glossary.mdc': 'glossary.mdc',
		'rules/mcp.mdc': 'mcp.mdc',
		'rules/new_features.mdc': 'new_features.mdc',
		'rules/tasks.mdc': 'tasks.mdc',
		'rules/tests.mdc': 'tests.mdc',
		'rules/ui.mdc': 'ui.mdc',
		'rules/utilities.mdc': 'utilities.mdc',
		'rules/telemetry.mdc': 'telemetry.mdc'
	})
	.conversion({
		// Cursor profile uses default conversion (no changes needed)
		profileTerms: [],
		docUrls: [],
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.globalReplacements([])
	.build();

// Export only the new Profile instance
export { cursorProfile };
