// Cursor profile using new ProfileBuilder system
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cursor profile with comprehensive file mapping
const cursorProfile = ProfileBuilder.minimal('cursor')
	.display('Cursor')
	.profileDir('.cursor')
	.rulesDir('.cursor/rules')
	.includeDefaultRules(false) // Cursor explicitly defines its own fileMap
	.fileMap({
		// Core rule files with .mdc extension (same as other profiles)
		'rules/cursor_rules.mdc': 'cursor_rules.mdc',
		'rules/dev_workflow.mdc': 'dev_workflow.mdc',
		'rules/self_improve.mdc': 'self_improve.mdc',
		'rules/taskmaster.mdc': 'taskmaster.mdc'
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
