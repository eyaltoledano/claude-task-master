/**
 * @fileoverview loop_presets MCP tool
 * List available loop presets
 */

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const LoopPresetsSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type LoopPresetsArgs = z.infer<typeof LoopPresetsSchema>;

/**
 * Register the loop_presets tool with the MCP server
 */
export function registerLoopPresetsTool(server: FastMCP) {
	server.addTool({
		name: 'loop_presets',
		description:
			'List available loop presets. Each preset provides a different focus for the loop iterations.',
		parameters: LoopPresetsSchema,
		annotations: {
			title: 'List Loop Presets',
			readOnlyHint: true
		},
		execute: withToolContext(
			'loop-presets',
			async (args: LoopPresetsArgs, { log, tmCore }: ToolContext) => {
				const { projectRoot } = args;

				try {
					log.info('Fetching available loop presets');

					const presets = tmCore.loop.getAvailablePresets();

					const presetDescriptions = {
						default: 'General purpose loop for completing pending tasks',
						'test-coverage': 'Focus on improving test coverage',
						linting: 'Focus on fixing linting issues and code style',
						duplication: 'Focus on reducing code duplication',
						entropy: 'Focus on reducing code complexity and entropy'
					};

					log.info(`Found ${presets.length} available presets`);

					return handleApiResult({
						result: {
							success: true,
							data: {
								presets: presets.map((preset) => ({
									name: preset,
									description:
										presetDescriptions[
											preset as keyof typeof presetDescriptions
										] || 'No description available'
								})),
								count: presets.length
							}
						},
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in loop-presets: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to get presets: ${error.message}` }
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
