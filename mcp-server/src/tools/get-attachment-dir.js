/**
 * mcp-server/src/tools/taskmaster-get-attachment-dir.js
 * Tool definition for determining Jira attachment download directory.
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
// Import the corresponding direct function
import { getAttachmentDirDirect } from '../core/task-master-core.js';

export const registerGetAttachmentDirTool = (server) => {
    server.addTool({
        name: 'get_attachment_dir',
        description: 'Determines the absolute path to use for downloading Jira attachments, creating a subdirectory named after the issue_key. Checks args.target_dir (for base path), then ATTACHMENT_DIR env var, then OS temp dir.',
        parameters: z.object({
            issue_key: z.string().describe('The Jira issue key (e.g., PROJ-123). Used to create a subdirectory for attachments.'),
            target_dir: z.string().optional().describe('Optional specific BASE directory path. If provided, issue_key subdirectory will be created inside this. If omitted, uses ATTACHMENT_DIR env var or OS temp dir as base.'),
            projectRoot: z.string().optional().describe('Optional project root context.')
        }),
        execute: async (args, { log }) => {
            try {
                log.info(`Executing get_attachment_dir with args: ${JSON.stringify(args)}`);

                // Call the direct function, passing all args
                const result = await getAttachmentDirDirect(args, log);

                return handleApiResult(result, log);

            } catch (error) {
                log.error(`Error in get_attachment_dir tool execute: ${error.message}`);
                return createErrorResponse(error.message, 'TOOL_EXECUTION_ERROR');
            }
        }
    });
}; 