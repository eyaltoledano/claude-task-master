// Cursor profile using ProfileBuilder
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

// Create cursor profile with comprehensive file mapping
const cursorProfile = ProfileBuilder.minimal('cursor')
	.display('Cursor')
	.profileDir('.cursor')
	.rulesDir('.cursor/rules')
	.supportsSubdirectories(true) // Cursor uses taskmaster subdirectory
	.includeDefaultRules(false) // Cursor explicitly defines its own fileMap
	.fileMap({
		// Core rule files with .mdc extension in taskmaster subdirectory
		'rules/cursor_rules.mdc': 'taskmaster/cursor_rules.mdc',
		'rules/dev_workflow.mdc': 'taskmaster/dev_workflow.mdc',
		'rules/self_improve.mdc': 'taskmaster/self_improve.mdc',
		'rules/taskmaster.mdc': 'taskmaster/taskmaster.mdc'
	})
	.conversion({
		// Cursor profile uses default conversion (no changes needed)
		profileTerms: [],
		docUrls: [],
		// Tool name mappings (no tool renaming)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (cursor uses standard contexts)
		toolContexts: [],

		// Tool group mappings (cursor uses standard groups)
		toolGroups: [],

		// File reference mappings (cursor uses standard file references)
		fileReferences: []
	})
	.globalReplacements([
		// Cursor-specific path transformations - add taskmaster subdirectory
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](mdc:.cursor/rules/taskmaster/$2.mdc)'
		}
	])
	.build();

// Export the cursor profile
export { cursorProfile };
