/**
 * Progress Indicator Module
 * 
 * Provides utilities for displaying progress indicators for long-running operations
 */

import ora from 'ora';
import displayUtils from './display-utils.js';

/**
 * Class representing a progress indicator
 */
export class ProgressIndicator {
  /**
   * Create a progress indicator
   * @param {object} options - Configuration options
   * @param {string} options.text - Initial spinner text
   * @param {string} options.spinnerType - Type of spinner (default: 'dots')
   * @param {boolean} options.hideCursor - Whether to hide the cursor during spinner operation
   */
  constructor(options = {}) {
    this.spinner = null;
    this.text = options.text || 'Processing...';
    this.spinnerType = options.spinnerType || 'dots';
    this.startTime = null;
    this.hideCursor = options.hideCursor !== false;
    this.updateInterval = null;
    this.totalSteps = options.totalSteps || 0;
    this.currentStep = 0;
    this.percent = 0;
  }
  
  /**
   * Start the progress indicator
   * @param {string} [text] - Optional text to display (defaults to constructor text)
   * @returns {ProgressIndicator} This instance for chaining
   */
  start(text) {
    if (this.spinner) {
      this.stop();
    }
    
    // Set the text if provided, otherwise use the default
    this.text = text || this.text;
    
    // Create and start the spinner
    this.spinner = ora({
      text: this.text,
      spinner: this.spinnerType,
      color: 'blue'
    }).start();
    
    // Record the start time
    this.startTime = Date.now();
    
    // Hide cursor if specified
    if (this.hideCursor) {
      displayUtils.hideCursor();
    }
    
    return this;
  }
  
  /**
   * Update the progress indicator text
   * @param {string} text - New text to display
   * @returns {ProgressIndicator} This instance for chaining
   */
  update(text) {
    if (this.spinner) {
      this.spinner.text = text;
    }
    return this;
  }
  
  /**
   * Start auto-updating elapsed time in the spinner text
   * @param {number} [interval=1000] - Update interval in milliseconds
   * @param {Function} [formatter] - Custom formatter function for the time display
   * @returns {ProgressIndicator} This instance for chaining
   */
  startTimeTracking(interval = 1000, formatter) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Format function for elapsed time
    const formatElapsed = formatter || ((elapsed) => {
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    });
    
    // Start interval to update the text
    this.updateInterval = setInterval(() => {
      if (!this.spinner) return;
      
      const elapsed = Date.now() - this.startTime;
      const timeText = formatElapsed(elapsed);
      
      // Don't lose the original text
      const baseText = this.text.split(' [elapsed:')[0];
      this.spinner.text = `${baseText} [elapsed: ${timeText}]`;
    }, interval);
    
    return this;
  }
  
  /**
   * Stop the progress indicator with a success message
   * @param {string} [text] - Success message to display
   * @returns {ProgressIndicator} This instance for chaining
   */
  succeed(text) {
    this.cleanup();
    
    if (this.spinner) {
      this.spinner.succeed(text || `${this.text} - Completed`);
      this.spinner = null;
    }
    
    return this;
  }
  
  /**
   * Stop the progress indicator with a failure message
   * @param {string} [text] - Failure message to display
   * @returns {ProgressIndicator} This instance for chaining
   */
  fail(text) {
    this.cleanup();
    
    if (this.spinner) {
      this.spinner.fail(text || `${this.text} - Failed`);
      this.spinner = null;
    }
    
    return this;
  }
  
  /**
   * Stop the progress indicator with a warning message
   * @param {string} [text] - Warning message to display
   * @returns {ProgressIndicator} This instance for chaining
   */
  warn(text) {
    this.cleanup();
    
    if (this.spinner) {
      this.spinner.warn(text || `${this.text} - Warning`);
      this.spinner = null;
    }
    
    return this;
  }
  
  /**
   * Stop the progress indicator with an info message
   * @param {string} [text] - Info message to display
   * @returns {ProgressIndicator} This instance for chaining
   */
  info(text) {
    this.cleanup();
    
    if (this.spinner) {
      this.spinner.info(text || this.text);
      this.spinner = null;
    }
    
    return this;
  }
  
  /**
   * Stop the progress indicator without any final message
   * @returns {ProgressIndicator} This instance for chaining
   */
  stop() {
    this.cleanup();
    
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    
    return this;
  }
  
  /**
   * Clean up resources used by the progress indicator
   * @private
   */
  cleanup() {
    // Stop the time tracking interval if it exists
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Show the cursor if it was hidden
    if (this.hideCursor) {
      displayUtils.showCursor();
    }
  }
  
  /**
   * Update progress for a stepped operation
   * @param {number} step - Current step
   * @param {number} [total] - Total number of steps (defaults to constructor value)
   * @param {string} [operationText] - Text describing the current operation
   * @returns {ProgressIndicator} This instance for chaining
   */
  updateProgress(step, total, operationText) {
    this.currentStep = step;
    this.totalSteps = total || this.totalSteps;
    
    if (this.totalSteps <= 0) return this;
    
    // Calculate percentage
    this.percent = Math.floor((this.currentStep / this.totalSteps) * 100);
    
    // Create the progress bar
    const progressBar = displayUtils.progressBar(this.percent, 20);
    
    // Format the text
    const stepText = `Step ${this.currentStep}/${this.totalSteps}`;
    const opText = operationText ? `: ${operationText}` : '';
    
    // Update the spinner text
    if (this.spinner) {
      this.spinner.text = `${stepText}${opText}\n${progressBar}`;
    }
    
    return this;
  }
  
  /**
   * Create a progress bar without a spinner
   * @param {number} percent - Percentage complete (0-100)
   * @param {number} [width=30] - Width of the progress bar
   * @param {string} [text] - Text to display above the progress bar
   * @returns {string} The formatted progress bar text
   */
  static progressBar(percent, width = 30, text) {
    const progressBar = displayUtils.progressBar(percent, width);
    return text ? `${text}\n${progressBar}` : progressBar;
  }
}

/**
 * Simple async operation wrapper with a progress indicator
 * @param {Function} asyncFn - Async function to execute
 * @param {object} options - Progress indicator options
 * @param {string} options.startText - Text to show when starting
 * @param {string} options.successText - Text to show on success
 * @param {string} options.errorText - Text to show on error
 * @returns {Promise<*>} Result from the async function
 */
export async function withProgress(asyncFn, options = {}) {
  const progress = new ProgressIndicator({ text: options.startText || 'Processing...' });
  
  try {
    // Start the progress indicator
    progress.start();
    
    // Execute the async function
    const result = await asyncFn(progress);
    
    // Show success and return the result
    progress.succeed(options.successText || 'Operation completed successfully');
    return result;
  } catch (error) {
    // Show error message
    progress.fail(options.errorText || `Error: ${error.message}`);
    throw error;
  }
}

/**
 * Export the functions and classes
 */
export default {
  ProgressIndicator,
  withProgress
}; 