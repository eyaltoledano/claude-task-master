/**
 * tools/autopilot-abort.js
 * Tool to abort a running TDD workflow and clean up state
 */

import { z } from 'zod';
import { createErrorResponse, withNormalizedProjectRoot } from './utils.js';
import fs from 'fs-extra';
import path from 'path';

const STATE_FILE = '.taskmaster/workflow-state.json';

/**
 * Register the autopilot-abort tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotAbortTool(server) {
	server.addTool({
		name: 'autopilot_abort',
		description:
			'Abort the current TDD workflow and clean up workflow state. This will remove the workflow state file but will NOT delete the git branch or any code changes.',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe('Absolute path to the project root directory')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot } = args;

			try {
				log.info(`Aborting autopilot workflow in ${projectRoot}`);

				const statePath = path.join(projectRoot, STATE_FILE);
				const stateExists = await fs.pathExists(statePath);

				if (!stateExists) {
					log.warn('No active workflow to abort');
					return {
						success: true,
						message: 'No active workflow to abort',
						hadWorkflow: false
					};
				}

				// Read state before deleting for info
				let taskId, branchName;
				try {
					const state = await fs.readJSON(statePath);
					taskId = state.context?.taskId;
					branchName = state.context?.branchName;
				} catch (error) {
					log.warn(`Could not read state file: ${error.message}`);
				}

				// Delete state file
				await fs.remove(statePath);
				log.info('Workflow state deleted');

				return {
					success: true,
					message: 'Workflow aborted',
					hadWorkflow: true,
					taskId,
					branchName,
					note: 'Git branch and code changes were preserved. You can manually clean them up if needed.'
				};
			} catch (error) {
				log.error(`Error in autopilot-abort: ${error.message}\n${error.stack}`);
				return createErrorResponse(
					`Failed to abort workflow: ${error.message}`
				);
			}
		})
	});
}
