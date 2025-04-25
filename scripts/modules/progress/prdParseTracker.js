import EventEmitter from 'events';
import ora from 'ora';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import path from 'path';
import { log, LOG_LEVELS } from '../utils.js';
import { displayPRDParsingSummary } from '../ui.js'; // Keep for potential direct use if needed

// --- Constants for UI ---
const PRIORITY_DOTS = {
    high: chalk.red('●●●'),
    medium: chalk.keyword('orange')('●●'),
    low: chalk.yellow('●'),
};
const CHECKMARK = chalk.green('✔️');

class PrdParseTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = { // Default options
            logLevel: options.logLevel || 'info',
            stream: process.stdout,
            ...options,
        };
        this.spinner = null;
        this.progressBar = null;
        this.startTime = null;
        this.totalTasks = 0;
        this.completedTasks = 0;
        this.tokensIn = 0;
        this.tokensOut = 0;
        this.lastPrintedTaskLine = ''; // To prevent duplicate prints
        this.currentStatusText = ''; // Holds the latest status message
        
        // Terminal layout management
        this.useFixedHeader = this.options.stream.isTTY && !process.env.CI; // Only use fixed header in TTY
        this.headerHeight = 4; // Status line + progress bar + separator + empty line
        this.taskOutputStartLine = this.headerHeight + 1; // Line where task output starts

        this.stats = {
            taskCount: 0,
            prdPath: '',
            outputPath: '',
            startTime: null,
            endTime: null,
            taskCategories: { high: 0, medium: 0, low: 0 },
            recoveryMode: false,
            taskFilesGenerated: false,
            actionVerb: 'created',
            error: null,
        };

        // Log function specific to this tracker instance
        this.log = (level, message) => {
            if (LOG_LEVELS[level] >= LOG_LEVELS[this.options.logLevel]) {
                log(level, `[PrdParseTracker] ${message}`);
            }
        };

        this.log('debug', 'PrdParseTracker initialized.');
    }

    // --- Public Methods ---

    /**
     * Start the tracking process.
     * @param {number} totalTasks - The total number of tasks expected.
     * @param {object} initialStats - Initial stats like prdPath, outputPath etc.
     * @param {number} [initialTokensIn=0] - Initial input tokens.
     * @param {number} [initialTokensOut=0] - Initial output tokens.
     */
    start(totalTasks = 0, initialStats = {}, initialTokensIn = 0, initialTokensOut = 0) {
        this.startTime = Date.now();
        this.stats.startTime = this.startTime;
        this.totalTasks = totalTasks;
        this.completedTasks = 0;
        this.tokensIn = initialTokensIn;
        this.tokensOut = initialTokensOut;

        // Merge initial stats
        this.stats = { ...this.stats, ...initialStats }; // Collect prdPath, outputPath etc.
        this.stats.taskCount = totalTasks; // Store total task count in stats as well
        
        // Initialize terminal layout for fixed header if in TTY mode
        if (this.useFixedHeader) {
            this._initTerminalLayout();
        }

        // Initialize UI components
        this.currentStatusText = 'Initializing...'; // Initialize status text
        this.spinner = ora({ text: this.currentStatusText, stream: this.options.stream });
        if (!this.useFixedHeader) {
            this.spinner.start(); // Only start spinner visually if not using fixed header
        }

        this.progressBar = new cliProgress.SingleBar({
            format: ` ${chalk.cyan('{bar}')} | ${chalk.bold('{value}/{total}')} Tasks (${chalk.green('{percentage}%')})`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            clearOnComplete: false, // Keep bar visible
            stream: this.options.stream,
            barsize: 30, // Slightly smaller to accommodate the task counter
        }, cliProgress.Presets.shades_classic);

        this.progressBar.start(this.totalTasks || 10, 0);
        
        // Force initial UI draw with header and progress bar
        this._updateUI(true);

        this.log('info', `Started tracking PRD parsing. Expected tasks: ${totalTasks}`);
        this.emit('start', { totalTasks });
    }

    /**
     * Record a completed task and update progress.
     * @param {object} task - The task object { taskId, title, priority, description, ... }
     * @param {number} [deltaTokensIn=0] - Tokens consumed for this task.
     * @param {number} [deltaTokensOut=0] - Tokens produced for this task.
     */
    tick(task, deltaTokensIn = 0, deltaTokensOut = 0) {
        if (!this.startTime) {
            this.log('warn', 'Tracker ticked before start() was called. Ignoring.');
            return;
        }
        this.completedTasks++;
        this.tokensIn += deltaTokensIn;
        this.tokensOut += deltaTokensOut;

        // Update stats
        const priority = task.priority?.toLowerCase() || 'medium';
        if (this.stats.taskCategories[priority] !== undefined) {
            this.stats.taskCategories[priority]++;
        }

        this._updateUI();
        this._printTask(task);

        this.log('debug', `Task ${this.completedTasks}/${this.totalTasks} completed: ${task.title}`);
        this.emit('taskAdded', task); // For external listeners
        this.emit('progress', { // More detailed progress event
            completed: this.completedTasks,
            total: this.totalTasks,
            tokensIn: this.tokensIn,
            tokensOut: this.tokensOut,
            task
        });
    }

    /**
     * Update token counts.
     * @param {number} [deltaTokensIn=0] - Additional tokens consumed.
     * @param {number} [deltaTokensOut=0] - Additional tokens produced.
     */
    updateTokens(deltaTokensIn = 0, deltaTokensOut = 0) {
        if (!this.startTime) return; // Ignore if not started
        this.tokensIn += deltaTokensIn;
        this.tokensOut += deltaTokensOut;
        this._updateUI(); // Redraw status line
        this.emit('tokensUpdated', { tokensIn: this.tokensIn, tokensOut: this.tokensOut });
    }

    /**
     * Update the spinner text.
     * @param {string} text - New text for the spinner.
     */
    updateSpinnerText(text) {
        this.log('debug', `Updating status text: ${text}`);
        if (this.useFixedHeader) {
            this.currentStatusText = text;
            this._updateUI(); // Trigger UI update to show new text in the fixed header
        } else {
            if (this.spinner) {
                this.spinner.text = text; // Update ora spinner directly
            }
        }
    }

    /**
     * Finish the tracking process.
     * @param {boolean} success - Whether the process was successful.
     * @param {object} finalStats - Any final stats to merge (e.g., error message).
     * @param {function} [summaryCallback] - Optional callback to display summary.
     */
    finish(success = true, finalStats = {}, summaryCallback = null) {
        if (!this.startTime) {
            this.log('warn', 'finish() called before start(). Ignoring.');
            return;
        }

        this.stats.endTime = Date.now();
        // Merge final stats
        this.stats = { ...this.stats, ...finalStats };

        // If tasks completed, assume total matches completed unless specified
        if (this.completedTasks > 0 && this.totalTasks === 0) {
            this.totalTasks = this.completedTasks;
            this.stats.taskCount = this.completedTasks;
        }
        
        // Set final status text before final UI update
        const finishMessage = success ? 'PRD parsing complete!' : `PRD parsing failed: ${this.stats.error || 'Unknown error'}`;
        this.currentStatusText = finishMessage;
        
        // Reset terminal display to a clean state if needed
        if (this.useFixedHeader) {
            // Clear the screen and reposition
            process.stdout.write('\u001B[2J'); // Clear screen
            process.stdout.write('\u001B[H'); // Move to home position
        }

        // Complete progress bar
        if (this.progressBar) {
            this.progressBar.stop();
            this.progressBar = null;
        }

        // Render the final status line and clear progress bar line
        this._updateUI(true); // Force final UI draw with finish message

        // Stop spinner ONLY if it was visually running
        if (this.spinner && this.spinner.isSpinning) { // Check if spinner was actually started
            if (success) {
                this.spinner.succeed(finishMessage); // Use final message
            } else {
                this.spinner.fail(finishMessage); // Use final message
            }
        } else if (this.spinner && !this.useFixedHeader) {
            // If not fixed header, but spinner wasn't running? Stop it cleanly.
            this.spinner.stop();
        }
        this.spinner = null; // Clear spinner instance

        // Call the summary callback AFTER stopping spinner/bar
        if (summaryCallback && typeof summaryCallback === 'function') {
            this.log('debug', 'Calling summary callback.');
            summaryCallback({
                totalTasks: this.stats.taskCount || this.completedTasks, // Use actual completed if total wasn't accurate
                prdFilePath: this.stats.prdPath,
                outputPath: this.stats.outputPath || path.join('tasks', 'tasks.json'),
                elapsedTime: (this.stats.endTime - this.stats.startTime) / 1000, // Seconds
                taskCategories: this.stats.taskCategories,
                recoveryMode: this.stats.recoveryMode,
                taskFilesGenerated: this.stats.taskFilesGenerated,
                actionVerb: this.stats.actionVerb,
                tokensIn: this.tokensIn,
                tokensOut: this.tokensOut,
                error: success ? null : this.stats.error,
            });
        }

        this.log('info', `Finished tracking. Success: ${success}. Elapsed: ${((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2)}s`);
        this.emit('finish', { success, stats: this.stats });

        // Cleanup internal state
        this.startTime = null; // Prevent further updates
    }

    // --- Private Helper Methods ---

    _updateUI(forceStatusLineRedraw = false) { // Keep force flag for potential future use
        if (!this.startTime) return;

        const statusLineText = this._printStatusLine(); // Get the text to display

        if (this.useFixedHeader) {
            // Save cursor position
            process.stdout.write('\u001B[s');
            
            // Update status line (line 1)
            process.stdout.write('\u001B[1;0H');
            process.stdout.write('\u001B[2K'); // Clear line
            process.stdout.write(statusLineText); // Write the generated text
            
            // Update progress bar (line 2)
            if (this.progressBar) {
                process.stdout.write('\u001B[2;0H');
                process.stdout.write('\u001B[2K'); // Clear line
                this.progressBar.update(this.completedTasks);
            }
            
            // Restore cursor position
            process.stdout.write('\u001B[u');
        } else {
            // Standard mode - update spinner text
            if (this.spinner) {
                this.spinner.text = statusLineText.trim(); // Update spinner text
                // Spinner handles rendering implicitly or via its timer
            }
            // Progress bar update is handled separately below in standard mode
            if (this.progressBar) {
                this.progressBar.update(this.completedTasks);
            }
        }
    }

    _printStatusLine() { // No forceRedraw needed here
        if (!this.options.stream.isTTY) return ''; // Return empty if not TTY

        const elapsedTime = this._formatElapsedTime(this.startTime);
        const taskProgress = `Tasks: ${this.completedTasks}/${this.totalTasks || '?'}`;
        const tokenInfo = `Tokens(I/O): ${this.tokensIn}/${this.tokensOut}`;

        let statusText = '';
        if (this.useFixedHeader) {
            // Fixed header: Prepend status text, then other info
            const prefix = this.currentStatusText ? `${this.currentStatusText} | ` : '';
            statusText = `${prefix}${elapsedTime} | ${taskProgress} | ${tokenInfo}`;
            // Simple truncation if too long
            const maxWidth = (process.stdout.columns || 80) - 2; // Leave some padding
            if (statusText.length > maxWidth) {
                statusText = statusText.substring(0, maxWidth - 3) + '...';
            }
            statusText = ` ${statusText} `; // Add padding
        } else {
            // Standard mode: core info, spinner adds its own animation
            statusText = ` ${elapsedTime} | ${taskProgress} | ${tokenInfo} `;
        }
        return statusText;
    }

    _printTask(task) {
        if (!this.options.stream.isTTY) return; // Skip layout in non-TTY

        // Format the priority indicator
        const priority = task.priority?.toLowerCase() || 'medium';
        const dots = PRIORITY_DOTS[priority] || PRIORITY_DOTS.medium;

        // Format task line
        const taskPrefix = task.isPlaceholder ? chalk.cyan('\u22ef ') : CHECKMARK + ' ';
        const taskLine = `${taskPrefix}${dots} ${task.title}`;

        // Skip duplicate output
        if (taskLine === this.lastPrintedTaskLine) {
            this.log('debug', 'Skipping duplicate task output');
            return;
        }
        this.lastPrintedTaskLine = taskLine;

        // Position cursor for task output
        if (this.useFixedHeader) {
            // Save cursor position
            process.stdout.write('\u001B[s');
            
            // Move cursor to task output area (below fixed header)
            process.stdout.write(`\u001B[${this.taskOutputStartLine};0H`);
            
            // Write the task
            process.stdout.write(taskLine + '\n');
            
            // Restore cursor position
            process.stdout.write('\u001B[u');
        } else {
            // Standard mode - handle spinner/progress bar interference
            if (this.spinner) this.spinner.clear(); // Clear spinner before logging
            if (this.progressBar) {
                // Ensure task appears below progress bar
                this.options.stream.write('\n');
            }
            
            this.options.stream.write(taskLine + '\n');
            
            if (this.spinner) this.spinner.render(); // Redraw spinner
        }
        
        // Update progress UI after task output
        this._updateUI();
    }

    _formatElapsedTime(startTime) {
        const elapsedMs = Date.now() - startTime;
        const seconds = Math.floor(elapsedMs / 1000) % 60;
        const minutes = Math.floor(elapsedMs / (1000 * 60));
        return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    
    /**
     * Initialize the terminal layout for fixed header mode
     * Sets up the fixed header area at the top of the terminal
     */
    _initTerminalLayout() {
        if (!this.options.stream.isTTY) return;
        
        try {
            // Reset terminal display completely
            process.stdout.write('\u001B[2J'); // Clear entire screen 
            process.stdout.write('\u001B[0;0H'); // Move to absolute top left
            
            // Create space for header and progress bar (4 lines)
            // 1 for status line, 1 for progress bar, 1 for separator, 1 empty
            process.stdout.write('\n\n\n\n');
            
            // Draw separator line after header section
            const separator = '\u2500'.repeat(process.stdout.columns || 80);
            process.stdout.write('\u001B[3;0H'); // Go to line 3
            process.stdout.write(separator);
            
            // Move to line 5 (after separator and blank line) and save position
            // This is where task output will start
            process.stdout.write(`\u001B[${this.taskOutputStartLine};0H`);
            process.stdout.write('\u001B[s'); // Save cursor position for task output
        } catch (error) {
            this.log('error', `Error initializing terminal layout: ${error.message}`);
            // Fallback to non-fixed header
            this.useFixedHeader = false;
        }
    }

    /**
     * DEPRECATED: Use tick() instead for proper UI updates.
     * Track a task without necessarily incrementing the main progress bar.
     * Useful for tasks identified before the main processing loop.
     */
    trackTask(taskInfo) {
        this.log('warn', 'trackTask() is deprecated. Use tick() for UI updates.');
        const priority = taskInfo.priority?.toLowerCase() || 'medium';
        if (this.stats.taskCategories[priority] !== undefined) {
            this.stats.taskCategories[priority]++;
        }
        // Maybe update total task count if it wasn't known initially?
        if (taskInfo.taskCount && taskInfo.taskCount > this.totalTasks) {
            this.log('debug', `Adjusting total task count from ${this.totalTasks} to ${taskInfo.taskCount}`);
            this.totalTasks = taskInfo.taskCount;
            this.stats.taskCount = this.totalTasks;
            if (this.progressBar) {
                this.progressBar.setTotal(this.totalTasks);
            }
        }
        // Optionally print pre-identified tasks? Or just collect stats?
        // For now, just collect stats.
        this.emit('taskIdentified', taskInfo); // Different event
    }

    // --- Deprecated / Refactored Methods (Keep stubs or remove) ---
    createStreamingTracker() {
        this.log('warn', 'createStreamingTracker() is deprecated and internal.');
        // Return a minimal object or handle internally if needed
        return {
            update: (chunk) => { /* Maybe update tokens here? */ },
            incrementChunkCount: () => { /* No longer relevant for UI */ },
            setStatus: (status) => { this.updateSpinnerText(status); },
            setThinking: (isThinking) => { /* Spinner handles this implicitly */ },
            setError: (error) => { this.stats.error = error; },
            getStats: () => ({ /* Return relevant stats if needed */ }),
        };
    }

    // ... [Keep other methods like setStatus, setThinking if they are still used externally,
    //      otherwise remove or mark as deprecated] ...

    setStatus(status) {
        this.updateSpinnerText(status);
        this.emit('statusUpdate', status);
    }

    setThinking(isThinking) {
        // Update the core status text used by the fixed header
        this.currentStatusText = isThinking ? 'Generating tasks...' : 'Receiving response...';

        // Update spinner text for non-fixed-header mode
        if (this.spinner) {
             this.updateSpinnerText(this.currentStatusText);
        }

        // If using fixed header, immediately update the UI
        if (this.useFixedHeader) {
            this._updateUI();
        }

        // Emit event if needed (useful for potential external listeners)
        this.emit('thinking', isThinking);
    }

     // Getter for stats if needed externally
    getStats() {
        return {
            ...this.stats,
            elapsedTime: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
            completedTasks: this.completedTasks,
            totalTasks: this.totalTasks,
            tokensIn: this.tokensIn,
            tokensOut: this.tokensOut,
        };
    }
}

// Factory function remains the same
export function createPrdParseTracker(options) { 
    return new PrdParseTracker(options);
}

// Export the class directly as well
export { PrdParseTracker }; 
