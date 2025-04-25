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

        // Initialize UI components
        this.spinner = ora({ text: 'Parsing PRD...', stream: this.options.stream }).start();
        this.progressBar = new cliProgress.SingleBar({
            format: ` ${chalk.cyan('{bar}')} | ${chalk.bold('{percentage}%')}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            clearOnComplete: false, // Keep bar visible
            stream: this.options.stream,
            barsize: 40, // Adjust width as needed
        }, cliProgress.Presets.shades_classic);

        this.progressBar.start(this.totalTasks, 0); // Start bar
        this._updateUI(); // Initial UI draw

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
        if (this.spinner) {
            this.spinner.text = text;
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
            this.log('warn', 'Tracker finish() called before start().');
            // Attempt graceful cleanup if possible
            if (this.spinner) this.spinner.stop();
            if (this.progressBar) this.progressBar.stop();
            return;
        }

        this.stats.endTime = Date.now();
        this.stats = { ...this.stats, ...finalStats }; // Merge final stats

        if (this.progressBar) {
            // Ensure bar shows 100% if successful and tasks match
            if (success && this.completedTasks >= this.totalTasks) {
                 this.progressBar.update(this.totalTasks);
            }
            this.progressBar.stop();
        }

        // Persist the last status line before stopping spinner
        this._updateUI(true); // Force redraw status line one last time

        if (this.spinner) {
            if (success) {
                this.spinner.succeed(chalk.green('PRD parsing complete!'));
            } else {
                this.spinner.fail(chalk.red(`PRD parsing failed: ${this.stats.error || 'Unknown error'}`));
            }
        }

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

    _updateUI(forceStatusLineRedraw = false) {
        if (!this.startTime) return;

        this._printStatusLine(forceStatusLineRedraw);
        if (this.progressBar) {
            this.progressBar.update(this.completedTasks);
        }
    }

    _printStatusLine(forceRedraw = false) {
        if (!this.options.stream.isTTY) return; // Skip if not a TTY

        const elapsedTime = this._formatElapsedTime(this.startTime);
        const taskProgress = `Tasks: ${this.completedTasks}/${this.totalTasks}`;
        const tokenInfo = `Tokens(I/O): ${this.tokensIn}/${this.tokensOut}`;
        const statusText = ` ${elapsedTime} | ${taskProgress} | ${tokenInfo} `; // Add padding

        // Avoid unnecessary redraws if spinner/bar handle cursor movement
        // However, force redraw if requested (e.g., before spinner stop)
        if (forceRedraw) {
            this.options.stream.clearLine(0); // Clear current line
            this.options.stream.cursorTo(0);
            this.options.stream.write(statusText + '\n'); // Write status and move to next line for bar
        } else {
            // Rely on ora/cli-progress to manage cursor, maybe update spinner text
             if (this.spinner) {
                 this.spinner.text = statusText; // Update spinner text instead of direct write
             }
        }
    }

     _printTask(task) {
        if (!this.options.stream.isTTY) return; // Skip if not a TTY

        const priority = task.priority?.toLowerCase() || 'medium';
        const dots = PRIORITY_DOTS[priority] || PRIORITY_DOTS.medium;
        const taskLine = ` ${CHECKMARK} ${dots} ${chalk.bold(`Task ${task.taskId || this.completedTasks}:`)} ${task.title}`;

        // Simple check to avoid printing the exact same line consecutively if events fire rapidly
        if (taskLine === this.lastPrintedTaskLine) return;
        this.lastPrintedTaskLine = taskLine;

        // Ensure spinner and progress bar don't interfere
        if (this.spinner) this.spinner.clear(); // Clear spinner before logging
        if (this.progressBar) {
            // No direct 'clear' for cli-progress bar, rely on stream position
            // A newline before printing ensures it's below the bar
            this.options.stream.write('\n');
        }

        this.options.stream.write(taskLine + '\n');

        if (this.spinner) this.spinner.render(); // Redraw spinner
        // ProgressBar redraw is handled by _updateUI -> progressBar.update()
    }

    _formatElapsedTime(startTime) {
        const elapsedMs = Date.now() - startTime;
        const seconds = Math.floor(elapsedMs / 1000) % 60;
        const minutes = Math.floor(elapsedMs / (1000 * 60));
        return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
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
        // Spinner handles visual state. Emit event if needed.
        if (isThinking) {
             this.updateSpinnerText('Thinking...');
        } else {
             // Revert to previous or default text - requires storing state
             // Or maybe just let the next status update handle it.
        }
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
