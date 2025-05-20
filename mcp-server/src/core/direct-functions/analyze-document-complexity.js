import analyzeDocumentComplexity from '../../../../scripts/modules/task-manager/analyze-document-complexity.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { enableSilentMode, disableSilentMode } from '../../../../scripts/modules/utils.js';

/**
 * Direct function to analyze document complexity
 * @param {Object} args - Arguments passed from the MCP tool
 * @param {Object} log - Logger object from FastMCP
 * @param {Object} context - Context object containing session information
 * @returns {Promise<Object>} Result object with success status and data or error
 */
export async function analyzeDocumentComplexityDirect(args, log, context = {}) {
    const { session } = context;
    const projectRoot = args.projectRoot;
    const documentPath = args.file;
    const outputPath = args.output;
    const useResearch = args.research === true;

    try {
        // Enable silent mode to prevent console logs from interfering with MCP JSON responses
        enableSilentMode();
        try {
            const result = await analyzeDocumentComplexity(
                documentPath,
                {
                    useResearch: useResearch,
                    context: {
                        projectRoot: projectRoot,
                        session: session,
                        mcpLog: log
                    }
                }
            );
            return { success: true, data: result, fromCache: false };
        } finally {
            // Always disable silent mode after operation
            disableSilentMode();
        }
    } catch (error) {
        log.error(`Error in analyzeDocumentComplexityDirect: ${error.message}`);
        return {
            success: false,
            error: {
                code: 'ANALYZE_DOCUMENT_COMPLEXITY_ERROR',
                message: error.message
            },
            fromCache: false
        };
    }
}
