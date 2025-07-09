/**
 * create-tag-from-branch.js
 * Direct function implementation for creating tags from git branches
 */

import { createTagFromBranch } from '../../../../scripts/modules/task-manager/tag-management.js';
import {
	getCurrentBranch,
	isGitRepository
} from '../../../../scripts/modules/utils/git-utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for creating tags from git branches with error handling.
 *
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Command arguments
 * @param {string} taskMaster.getTasksPath() - Path to the tasks.json file (resolved by tool)
 * @param {string} [args.branchName] - Git branch name (optional, uses current branch if not provided)
 * @param {boolean} [args.copyFromCurrent] - Copy tasks from current tag
 * @param {string} [args.copyFromTag] - Copy tasks from specific tag
 * @param {string} [args.description] - Custom description for the tag
 * @param {boolean} [args.autoSwitch] - Automatically switch to the new tag * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function createTagFromBranchDirect(
	taskMaster,
	args,
	log,
	context = {}
) {
	// Destructure expected args
	const { branchName, copyFromCurrent, copyFromTag, description, autoSwitch } =
		args;
	const { session } = context;

	// Enable silent mode to prevent console logs from interfering with JSON response
	enableSilentMode();

	// Create logger wrapper using the utility
	const mcpLog = createLogWrapper(log);

	try {
		// Check if we're in a git repository
		if (!(await isGitRepository(taskMaster.getProjectRoot()))) {
			log.error('Not in a git repository');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'NOT_GIT_REPOSITORY',
					message: 'Not in a git repository. Cannot create tag from branch.'
				}
			};
		}

		// Determine branch name
		let targetBranch = branchName;
		if (!targetBranch) {
			targetBranch = await getCurrentBranch(taskMaster.getProjectRoot());
			if (!targetBranch) {
				log.error('Could not determine current git branch');
				disableSilentMode();
				return {
					success: false,
					error: {
						code: 'NO_CURRENT_BRANCH',
						message: 'Could not determine current git branch'
					}
				};
			}
		}

		log.info(`Creating tag from git branch: ${targetBranch}`);

		// Prepare options
		const options = {
			copyFromCurrent: copyFromCurrent || false,
			copyFromTag,
			description:
				description || `Tag created from git branch "${targetBranch}"`,
			autoSwitch: autoSwitch || false
		};

		// Call the createTagFromBranch function
		const result = await createTagFromBranch(
			taskMaster.getTasksPath(),
			targetBranch,
			options,
			{
				session,
				mcpLog,
				projectRoot: taskMaster.getProjectRoot()
			},
			'json' // outputFormat - use 'json' to suppress CLI UI
		);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				branchName: result.branchName,
				tagName: result.tagName,
				created: result.created,
				mappingUpdated: result.mappingUpdated,
				autoSwitched: result.autoSwitched,
				message: `Successfully created tag "${result.tagName}" from branch "${result.branchName}"`
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in createTagFromBranchDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'CREATE_TAG_FROM_BRANCH_ERROR',
				message: error.message
			}
		};
	}
}
