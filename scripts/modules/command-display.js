/**
 * Command Display Integration Module
 * 
 * Integrates the display system with command handlers to provide consistent 
 * output formatting across the CLI.
 */

import displayUtils from './display-utils.js';
import displayTemplates from './display-templates.js';
import { ProgressIndicator, withProgress } from './progress-indicator.js';
import { getConceptResponse, saveConceptResponse } from './json-storage.js';

/**
 * Class to manage command output display in a consistent manner
 */
export class CommandDisplay {
  /**
   * Create a new command display manager
   * @param {object} options - Display options
   */
  constructor(options = {}) {
    this.options = {
      useColor: options.useColor !== false,
      showTimings: options.showTimings !== false,
      verbosity: options.verbosity || 'normal',
      ...options
    };
  }
  
  /**
   * Display a concept summary
   * @param {string} conceptId - Concept ID to display
   * @param {object} [conceptData] - Optional concept data (will load from storage if not provided)
   * @returns {Promise<void>}
   */
  async displayConcept(conceptId, conceptData) {
    let concept = conceptData;
    
    // If no concept data provided, try to load from storage
    if (!concept) {
      concept = await getConceptResponse(conceptId);
      
      if (!concept) {
        this.displayError({
          title: 'Concept Not Found',
          message: `No concept found with ID: ${conceptId}`
        });
        return;
      }
    }
    
    // Display the concept
    const formatted = displayTemplates.conceptSummary(concept);
    console.log(formatted);
  }
  
  /**
   * Display a command help message
   * @param {object} command - Command information
   */
  displayHelp(command) {
    const formatted = displayTemplates.commandHelp(command);
    console.log(formatted);
  }
  
  /**
   * Display an error message
   * @param {object|Error} error - Error object or information
   */
  displayError(error) {
    const formatted = displayTemplates.errorMessage(error);
    console.log(formatted);
  }
  
  /**
   * Display a success message
   * @param {object} data - Success data
   */
  displaySuccess(data) {
    const formatted = displayTemplates.successMessage(data);
    console.log(formatted);
  }
  
  /**
   * Display task details
   * @param {object} task - Task object
   */
  displayTask(task) {
    const formatted = displayTemplates.taskDetails(task);
    console.log(formatted);
  }
  
  /**
   * Display JSON data
   * @param {object} data - Data to display
   * @param {string} [title] - Optional title
   */
  displayJSON(data, title) {
    const formatted = displayTemplates.jsonDisplay(data, title);
    console.log(formatted);
  }
  
  /**
   * Create a progress indicator for long-running operations
   * @param {object} options - Progress indicator options
   * @returns {ProgressIndicator} - Progress indicator instance
   */
  createProgress(options = {}) {
    return new ProgressIndicator(options);
  }
  
  /**
   * Execute a function with progress indication
   * @param {Function} asyncFn - Async function to execute
   * @param {object} options - Progress options
   * @returns {Promise<*>} - Result from the function
   */
  withProgress(asyncFn, options = {}) {
    return withProgress(asyncFn, options);
  }
  
  /**
   * Log a message with appropriate formatting
   * @param {string} level - Log level: 'info', 'warn', 'error', 'success'
   * @param {string} message - Message to log
   */
  log(level, message) {
    switch (level) {
      case 'info':
        displayUtils.info(message);
        break;
      case 'warn':
        displayUtils.warning(message);
        break;
      case 'error':
        displayUtils.error(message);
        break;
      case 'success':
        displayUtils.success(message);
        break;
      default:
        console.log(message);
    }
  }
  
  /**
   * Create a section header
   * @param {string} title - Section title
   * @returns {string} Formatted section header
   */
  sectionHeader(title) {
    return displayUtils.sectionHeader(title);
  }
  
  /**
   * Format a list of items
   * @param {string[]} items - List items
   * @param {object} options - Format options
   * @returns {string} Formatted list
   */
  formatList(items, options) {
    return displayUtils.formatList(items, options);
  }
  
  /**
   * Display a divider line
   * @param {number} [length] - Line length
   */
  divider(length) {
    displayUtils.divider(length);
  }
}

/**
 * Helper function to wrap a command action with standard display integration
 * @param {Function} actionFn - The command action function
 * @param {object} options - Display options
 * @returns {Function} Wrapped command action
 */
export function withDisplay(actionFn, options = {}) {
  return async (...args) => {
    const display = new CommandDisplay(options);
    
    try {
      // Extract options from last argument (Commander passes them as last arg)
      const cmdOptions = args[args.length - 1] || {};
      
      // Add the display manager to the options so the action can use it
      cmdOptions.display = display;
      
      // Execute the actual command action
      return await actionFn(...args);
    } catch (error) {
      // Display any errors that occur
      display.displayError(error);
      
      // Exit with error code unless specifically asked not to
      if (!options.noExit) {
        process.exit(1);
      }
      
      throw error;
    }
  };
}

/**
 * Export the display manager and helpers
 */
export default {
  CommandDisplay,
  withDisplay
}; 