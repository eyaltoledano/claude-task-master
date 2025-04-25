/**
 * ai-tracker.js
 * Provides a generic implementation for AI streaming progress tracking.
 */

import { log } from './utils.js';

/**
 * Interface for a streaming tracker (Conceptual)
 * A streaming tracker should implement the following methods:
 * 
 * update(chunk: any): void - Process a streaming chunk.
 * incrementChunkCount(): void - Increment the count of received chunks.
 * setStatus(status: string): void - Set the current status message.
 * setThinking(isThinking: boolean): void - Indicate if the AI is processing.
 * setError(error: string | Error): void - Report an error.
 * getStats(): object - Retrieve current tracker statistics.
 */

/**
 * Creates a generic streaming progress tracker suitable for CLI or basic MCP logging.
 * It does NOT depend on PrdParseTracker or specific UI elements like progress bars.
 * 
 * @param {Object} options - Options for the tracker.
 * @param {Object} options.mcpLog - Optional MCP logger object.
 * @param {Function} options.reportProgress - Optional progress reporting function for MCP.
 * @returns {Object} - An object implementing the conceptual StreamingTracker interface.
 */
export function createGenericStreamingTracker(options = {}) {
    const { mcpLog, reportProgress } = options;
    let status = 'Initializing...';
    let isThinking = false;
    let chunkCount = 0;
    let error = null;
    
    const logMessage = (message, level = 'info') => {
        if (mcpLog) {
            mcpLog[level](message);
        } else {
            // Basic console logging for CLI or non-MCP environments
            log(level, `[Tracker] ${message}`);
        }
    };
    
    return {
        /** @param {any} chunk - The received data chunk (content ignored by default) */
        update: (chunk) => {
            // Default tracker doesn't process chunk content, just increments count.
            // Report progress if a function is provided.
            if (reportProgress) {
                // Simple heuristic for progress - can be refined if needed.
                const progressPercent = Math.min(95, chunkCount * 2); 
                reportProgress({
                    status: 'processing',
                    message: status,
                    progress: progressPercent 
                });
            }
        },
        
        incrementChunkCount: () => {
            chunkCount++;
        },
        
        /** @param {string} newStatus - The new status message */
        setStatus: (newStatus) => {
            status = newStatus;
            logMessage(`Status: ${newStatus}`);
            
            if (reportProgress) {
                reportProgress({
                    status: 'processing',
                    message: newStatus
                    // Keep existing progress if any
                });
            }
        },
        
        /** @param {boolean} thinking - True if the AI is thinking */
        setThinking: (thinking) => {
            isThinking = thinking;
            const currentStatus = thinking ? 'Thinking...' : status;
            logMessage(currentStatus);
            
            if (reportProgress) {
                reportProgress({
                    status: thinking ? 'thinking' : 'processing',
                    message: currentStatus
                });
            }
        },
        
        /** @param {string | Error} err - The error encountered */
        setError: (err) => {
            const errorMessage = err instanceof Error ? err.message : err;
            error = errorMessage;
            logMessage(`Error: ${errorMessage}`, 'error');
            
            if (reportProgress) {
                reportProgress({
                    status: 'error',
                    message: `Error: ${errorMessage}`
                });
            }
        },
        
        /** @returns {object} Current statistics */
        getStats: () => ({
            status,
            isThinking,
            chunkCount,
            error
        })
    };
}
