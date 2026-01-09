/**
 * @fileoverview loop_start MCP tool
 * Start a Task Master loop to work through tasks automatically
 */

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const LoopStartSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory'),
	iterations: z
		.number()
		.optional()
		.default(10)
		.describe('Number of iterations to run (default: 10)'),
	prompt: z
		.string()
		.optional()
		.default('default')
		.describe(
			'Preset name (default, test-coverage, linting, duplication, entropy) or path to custom prompt file'
		),
	progressFile: z
		.string()
		.optional()
		.describe(
			'Path to the progress file (default: .taskmaster/loop-progress.txt)'
		),
	sleepSeconds: z
		.number()
		.optional()
		.default(5)
		.describe('Seconds to sleep between iterations (default: 5)'),
	tag: z.string().optional().describe('Tag context to operate on'),
	status: z
		.string()
		.optional()
		.default('pending')
		.describe('Task status filter (default: pending)')
});

type LoopStartArgs = z.infer<typeof LoopStartSchema>;

/**
 * Register the loop_start tool with the MCP server
 */
export function registerLoopStartTool(server: FastMCP) {
	server.addTool({
		name: 'loop_start',
		description:
			'Start a Task Master loop to work through tasks automatically. Runs Claude iteratively with a prompt preset to complete tasks.',
		parameters: LoopStartSchema,
		annotations: {
			title: 'Start Loop',
			destructiveHint: true
		},
		execute: withToolContext(
			'loop-start',
			async (args: LoopStartArgs, { log, tmCore }: ToolContext) => {
				const {
					projectRoot,
					iterations,
					prompt,
					progressFile,
					sleepSeconds,
					tag,
					status
				} = args;

				try {
					log.info(
						`Starting loop with preset: ${prompt}, iterations: ${iterations}`
					);

					const result = await tmCore.loop.run({
						iterations,
						prompt,
						progressFile,
						sleepSeconds,
						tag,
						status
					});

					log.info(
						`Loop completed: ${result.totalIterations} iterations, ${result.tasksCompleted} tasks completed, status: ${result.finalStatus}`
					);

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: `Loop completed with ${result.totalIterations} iterations`,
								totalIterations: result.totalIterations,
								tasksCompleted: result.tasksCompleted,
								finalStatus: result.finalStatus,
								iterations: result.iterations
							}
						},
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in loop-start: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to start loop: ${error.message}` }
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
