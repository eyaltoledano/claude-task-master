/**
 * State Manager Module
 * 
 * Provides functionality for persisting and recovering command state
 * to enable workflow recovery after interruptions.
 */

import fs from 'fs';
import path from 'path';
import { log } from './logger.js';
import { errorHandler, ERROR_CATEGORY } from './error-handler.js';

// Default directory for state files
const STATE_DIR = '.task-master/state';

/**
 * State manager class for persisting and recovering command state
 */
export class StateManager {
  /**
   * Create a new StateManager
   * @param {Object} options - Configuration options
   * @param {string} options.stateDir - Directory to store state files
   */
  constructor(options = {}) {
    this.stateDir = options.stateDir || STATE_DIR;
    this.ensureStateDirectory();
  }
  
  /**
   * Ensure the state directory exists
   * @private
   */
  ensureStateDirectory() {
    try {
      // Create state directory if it doesn't exist
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
        log('info', `Created state directory: ${this.stateDir}`);
      }
    } catch (error) {
      errorHandler.handle(error, {
        message: `Failed to create state directory: ${this.stateDir}`,
        category: ERROR_CATEGORY.FILE_SYSTEM,
        code: 'STATE_DIR_CREATE_ERROR',
        context: { stateDir: this.stateDir },
        suggestion: 'Check file system permissions or specify an alternative directory'
      });
    }
  }
  
  /**
   * Generate a state file path for a command
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {string} Path to state file
   */
  getStateFilePath(commandName, id) {
    const filename = id 
      ? `${commandName}-${id}.json`
      : `${commandName}.json`;
      
    return path.join(this.stateDir, filename);
  }
  
  /**
   * Save command state to a file
   * @param {string} commandName - Command name
   * @param {Object} state - Command state to save
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<boolean>} True if successful
   */
  async saveState(commandName, state, id) {
    const filePath = this.getStateFilePath(commandName, id);
    
    try {
      // Add metadata to state
      const stateWithMeta = {
        ...state,
        _meta: {
          commandName,
          id,
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      };
      
      // Write state to file
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(stateWithMeta, null, 2),
        'utf8'
      );
      
      log('info', `State saved for command: ${commandName}${id ? ` (${id})` : ''}`);
      return true;
    } catch (error) {
      errorHandler.handle(error, {
        message: `Failed to save state for command: ${commandName}`,
        category: ERROR_CATEGORY.STATE,
        code: 'STATE_SAVE_ERROR',
        context: { commandName, id, filePath },
        suggestion: 'Check file system permissions and available disk space'
      });
      return false;
    }
  }
  
  /**
   * Load command state from a file
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<Object|null>} Command state or null if not found
   */
  async loadState(commandName, id) {
    const filePath = this.getStateFilePath(commandName, id);
    
    try {
      // Check if state file exists
      if (!fs.existsSync(filePath)) {
        log('info', `No state file found for command: ${commandName}${id ? ` (${id})` : ''}`);
        return null;
      }
      
      // Read and parse state
      const stateJson = await fs.promises.readFile(filePath, 'utf8');
      const state = JSON.parse(stateJson);
      
      log('info', `State loaded for command: ${commandName}${id ? ` (${id})` : ''}`);
      return state;
    } catch (error) {
      errorHandler.handle(error, {
        message: `Failed to load state for command: ${commandName}`,
        category: ERROR_CATEGORY.STATE,
        code: 'STATE_LOAD_ERROR',
        context: { commandName, id, filePath },
        suggestion: 'The state file may be corrupted or inaccessible'
      });
      return null;
    }
  }
  
  /**
   * Delete command state file
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<boolean>} True if successful
   */
  async clearState(commandName, id) {
    const filePath = this.getStateFilePath(commandName, id);
    
    try {
      // Check if state file exists
      if (!fs.existsSync(filePath)) {
        return true;
      }
      
      // Delete state file
      await fs.promises.unlink(filePath);
      
      log('info', `State cleared for command: ${commandName}${id ? ` (${id})` : ''}`);
      return true;
    } catch (error) {
      errorHandler.handle(error, {
        message: `Failed to clear state for command: ${commandName}`,
        category: ERROR_CATEGORY.STATE,
        code: 'STATE_CLEAR_ERROR',
        context: { commandName, id, filePath },
        suggestion: 'Check file system permissions'
      });
      return false;
    }
  }
  
  /**
   * List all saved states
   * @returns {Promise<Array>} List of available state files with metadata
   */
  async listStates() {
    try {
      // Ensure state directory exists
      this.ensureStateDirectory();
      
      // Get list of state files
      const files = await fs.promises.readdir(this.stateDir);
      const stateFiles = files.filter(f => f.endsWith('.json'));
      
      // Read metadata from each file
      const statesPromises = stateFiles.map(async (filename) => {
        try {
          const filePath = path.join(this.stateDir, filename);
          const stateJson = await fs.promises.readFile(filePath, 'utf8');
          const state = JSON.parse(stateJson);
          
          return {
            filename,
            path: filePath,
            commandName: state._meta?.commandName || 'unknown',
            id: state._meta?.id || null,
            timestamp: state._meta?.timestamp || null
          };
        } catch (error) {
          log('warn', `Failed to read state file: ${filename}`);
          return {
            filename,
            path: path.join(this.stateDir, filename),
            commandName: 'unknown',
            id: null,
            timestamp: null,
            error: error.message
          };
        }
      });
      
      const states = await Promise.all(statesPromises);
      return states;
    } catch (error) {
      errorHandler.handle(error, {
        message: 'Failed to list saved states',
        category: ERROR_CATEGORY.STATE,
        code: 'STATE_LIST_ERROR',
        context: { stateDir: this.stateDir },
        suggestion: 'Check if the state directory exists and is accessible'
      });
      return [];
    }
  }
  
  /**
   * Check if a state file exists for a command
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<boolean>} True if state file exists
   */
  async hasState(commandName, id) {
    const filePath = this.getStateFilePath(commandName, id);
    
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      log('warn', `Error checking state file existence: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check for interrupted commands that can be recovered
   * @returns {Promise<Array>} List of recoverable commands
   */
  async getRecoverableCommands() {
    const states = await this.listStates();
    
    // Sort by timestamp (newest first)
    return states
      .filter(state => state.timestamp && !state.error)
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
  }
}

/**
 * Create a singleton instance for the application to use
 */
export const stateManager = new StateManager();

/**
 * Command recoverer class to handle restoring command execution state
 */
export class CommandRecoverer {
  /**
   * Create a new CommandRecoverer
   * @param {StateManager} stateManager - StateManager instance
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
  }
  
  /**
   * Check if a command has a recoverable state
   * @param {string} commandName - Command name to check
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<boolean>} True if command can be recovered
   */
  async isRecoverable(commandName, id) {
    return this.stateManager.hasState(commandName, id);
  }
  
  /**
   * Get state for a recoverable command
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<Object|null>} Command state or null if not found
   */
  async getRecoverableState(commandName, id) {
    return this.stateManager.loadState(commandName, id);
  }
  
  /**
   * List all recoverable commands
   * @returns {Promise<Array>} List of recoverable commands
   */
  async listRecoverableCommands() {
    return this.stateManager.getRecoverableCommands();
  }
  
  /**
   * Clear a recoverable command state
   * @param {string} commandName - Command name
   * @param {string} [id] - Optional unique identifier
   * @returns {Promise<boolean>} True if successful
   */
  async clearRecoverableState(commandName, id) {
    return this.stateManager.clearState(commandName, id);
  }
}

/**
 * Create a singleton instance for the application to use
 */
export const commandRecoverer = new CommandRecoverer(stateManager); 