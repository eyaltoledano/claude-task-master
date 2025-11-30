/**
 * @fileoverview generate MCP tool
 * Generates individual task files from tasks.json
 */

import path from 'node:path';
import { z } from 'zod';
import { handleApiResult, withToolContext } from '../../shared/utils.js';
import type { ToolContext } from '../../shared/types.js';
import type { FastMCP } from 'fastmcp';

const GenerateSchema = z.object({
	output: z
		.string()
		.optional()
		.describe(
			'Output directory for generated files (default: same directory as tasks file)'
		),
	projectRoot: z
		.string()
		.describe('The directory of the project. Must be an absolute path.'),
	tag: z.string().optional().describe('Tag context to operate on')
});

type GenerateArgs = z.infer<typeof GenerateSchema>;

/**
 * Register the generate tool with the MCP server
 */
export function registerGenerateTool(server: FastMCP) {
	server.addTool({
		name: 'generate',
		description:
			'Generates individual task files in tasks/ directory based on tasks.json. Only works with local file storage.',
		parameters: GenerateSchema,
		execute: withToolContext(
			'generate',
			async (args: GenerateArgs, { log, tmCore }: ToolContext) => {
				const { projectRoot, tag, output } = args;

				try {
					log.info(`Generating task files with args: ${JSON.stringify(args)}`);

					// Resolve output directory
					const outputDir = output
						? path.resolve(projectRoot, output)
						: undefined;

					// Call tm-core to generate task files
					const result = await tmCore.tasks.generateTaskFiles({
						tag,
						outputDir
					});

					if (result.success) {
						log.info(
							`Successfully generated ${result.count} task files in ${result.directory}`
						);
						if (result.orphanedFilesRemoved > 0) {
							log.info(
								`Removed ${result.orphanedFilesRemoved} orphaned task files`
							);
						}
					} else {
						log.error(
							`Failed to generate task files: ${result.error || 'Unknown error'}`
						);
					}

					return handleApiResult({
						result: {
							success: result.success,
							data: result.success
								? {
										message: `Successfully generated ${result.count} task file(s)`,
										count: result.count,
										directory: result.directory,
										orphanedFilesRemoved: result.orphanedFilesRemoved
									}
								: undefined,
							error: result.success ? undefined : { message: result.error || 'Unknown error' }
						},
						log,
						projectRoot,
						tag
					});
				} catch (error: any) {
					log.error(`Error in generate tool: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to generate task files: ${error.message}`
							}
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
