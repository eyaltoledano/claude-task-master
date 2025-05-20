import { z } from 'zod';
import { handleApiResult, withNormalizedProjectRoot } from './utils.js';
import { analyzeDocumentComplexityDirect } from '../core/direct-functions/analyze-document-complexity.js';

/**
 * Registers the analyze_document_complexity tool with the MCP server
 * @param {Object} server - The MCP server instance
 */
export function registerAnalyzeDocumentComplexityTool(server) {
    server.addTool({
        name: 'analyze_document_complexity',
        description: 'Analyze the complexity of a document and generate an assessment report.',
        parameters: z.object({
            file: z.string().describe('Path to the document file to analyze'),
            output: z.string().optional().describe('Path to save the complexity report (default: reports/document-complexity-report.json)'),
            research: z.boolean().optional().describe('Use research role for more accurate analysis (requires API key)'),
            projectRoot: z.string().optional().describe('Root directory of the project (typically derived from session)')
        }),
        execute: withNormalizedProjectRoot(async (args, { log, session }) => {
            const { file, output, research, projectRoot } = args;
            log.info(`Executing analyze_document_complexity with file: ${file}`);
            
            try {
                const result = await analyzeDocumentComplexityDirect(
                    { file, output, research, projectRoot },
                    log,
                    { session }
                );
                return handleApiResult(result, log);
            } catch (error) {
                log.error(`Error in analyze_document_complexity: ${error.message}`);
                return {
                    success: false,
                    error: {
                        code: 'ANALYZE_DOCUMENT_COMPLEXITY_TOOL_ERROR',
                        message: error.message
                    }
                };
            }
        })
    });
}
