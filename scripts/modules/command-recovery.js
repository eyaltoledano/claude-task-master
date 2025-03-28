/**
 * Command Recovery Module
 * 
 * Integrates error handling, state persistence, and retry mechanisms for commands.
 * Provides a unified interface for command recovery and resilience.
 */

import { errorHandler, ERROR_CATEGORY, ERROR_SEVERITY } from './error-handler.js';
import { StateManager, CommandRecoverer } from './state-manager.js';
import { retryManager, BACKOFF_STRATEGY } from './retry-manager.js';
import { log } from './utils.js';
import chalk from 'chalk';

// Create instances of the managers
const stateManager = new StateManager();
const commandRecoverer = new CommandRecoverer(stateManager);

/**
 * Default options for resilient command execution
 */
const DEFAULT_COMMAND_OPTIONS = {
  // State persistence options
  enableStatePersistence: true,
  stateId: null, // Will be auto-generated if null
  
  // Error handling options
  errorCategory: ERROR_CATEGORY.COMMAND,
  showErrors: true,
  
  // Retry options
  enableRetry: false,
  maxAttempts: 3,
  retryDelay: 1000,
  backoffStrategy: BACKOFF_STRATEGY.EXPONENTIAL_JITTER,
  retryableErrors: [],
  
  // Circuit breaker options
  enableCircuitBreaker: false,
  circuitName: null, // Will use command name if null
  maxFailures: 5,
  resetTimeout: 60000, // 1 minute
};

/**
 * Execute a command function with resilience features
 * @param {string} commandName - Name of the command
 * @param {Function} commandFn - Command function to execute
 * @param {Object} commandArgs - Arguments to pass to the command function
 * @param {Object} options - Command resilience options
 * @returns {Promise<any>} Command result
 */
export async function executeResilientCommand(
  commandName,
  commandFn,
  commandArgs = {},
  options = {}
) {
  // Merge default options with provided options
  const config = { ...DEFAULT_COMMAND_OPTIONS, ...options };
  const stateId = config.stateId || `${commandName}-${Date.now()}`;
  
  try {
    log('info', `Executing command: ${commandName}`);
    
    // Check if this command has a saved state to recover from
    if (config.enableStatePersistence && commandRecoverer.hasRecoverableState(commandName)) {
      const savedState = await commandRecoverer.getRecoverableState(commandName);
      
      if (savedState) {
        log('info', `Found saved state for command ${commandName}`);
        console.log(chalk.blue(`Found a previous interrupted execution of '${commandName}'.`));
        
        // Ask user if they want to recover
        const readline = (await import('readline')).default.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question(chalk.yellow('Would you like to resume from where you left off? (y/n) '), resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          log('info', `Recovering command ${commandName} with saved state`);
          console.log(chalk.green('Resuming previous execution...'));
          
          // Merge saved arguments with current arguments
          // Current args take precedence over saved args
          commandArgs = { ...savedState.commandArgs, ...commandArgs };
        } else {
          log('info', `User declined to recover command ${commandName}`);
          console.log(chalk.yellow('Starting new execution...'));
          
          // Clear the saved state
          await commandRecoverer.clearRecoverableState(commandName);
        }
      }
    }
    
    // Save initial state if state persistence is enabled
    if (config.enableStatePersistence) {
      await stateManager.saveState(commandName, stateId, {
        commandName,
        commandArgs,
        timestamp: Date.now(),
        status: 'started'
      });
      
      log('debug', `Saved initial state for command ${commandName}`);
    }
    
    // Execute the command with appropriate resilience features
    let result;
    
    // Wrap the command function to handle state persistence
    const wrappedCommand = async () => {
      try {
        // Execute the actual command
        const cmdResult = await commandFn(commandArgs);
        
        // If successful and state persistence is enabled, clean up the state
        if (config.enableStatePersistence) {
          await stateManager.clearState(commandName, stateId);
          log('debug', `Cleared state for successfully completed command ${commandName}`);
        }
        
        return cmdResult;
      } catch (error) {
        // If state persistence is enabled, update state with error information
        if (config.enableStatePersistence) {
          const errorState = {
            commandName,
            commandArgs,
            timestamp: Date.now(),
            status: 'error',
            error: {
              message: error.message,
              code: error.code || 'UNKNOWN',
              stack: error.stack
            }
          };
          
          await stateManager.saveState(commandName, stateId, errorState);
          log('debug', `Saved error state for command ${commandName}`);
        }
        
        throw error;
      }
    };
    
    // Apply circuit breaker if enabled
    if (config.enableCircuitBreaker) {
      const circuitName = config.circuitName || `circuit-${commandName}`;
      
      result = await retryManager.executeWithCircuitBreaker(
        circuitName,
        async () => {
          // Apply retry if enabled
          if (config.enableRetry) {
            return await retryManager.execute(wrappedCommand, {
              maxAttempts: config.maxAttempts,
              delay: config.retryDelay,
              backoffStrategy: config.backoffStrategy,
              retryableErrors: config.retryableErrors,
              onRetry: (error, attempt, delay) => {
                log('warn', `Command ${commandName} failed (attempt ${attempt}). Retrying in ${Math.round(delay/1000)}s...`);
                if (config.showErrors) {
                  console.log(chalk.yellow(`Command failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${Math.round(delay/1000)}s...`));
                }
              }
            });
          } else {
            // No retry, just execute the wrapped command
            return await wrappedCommand();
          }
        },
        {
          maxFailures: config.maxFailures,
          resetTimeout: config.resetTimeout,
          onStateChange: (name, oldState, newState) => {
            log('info', `Circuit ${name} state changed from ${oldState} to ${newState}`);
            if (newState === 'open' && config.showErrors) {
              console.log(chalk.red(`Circuit opened for ${commandName} command due to multiple failures. Try again later.`));
            }
          }
        }
      );
    } else if (config.enableRetry) {
      // Apply retry without circuit breaker
      result = await retryManager.execute(wrappedCommand, {
        maxAttempts: config.maxAttempts,
        delay: config.retryDelay,
        backoffStrategy: config.backoffStrategy,
        retryableErrors: config.retryableErrors,
        onRetry: (error, attempt, delay) => {
          log('warn', `Command ${commandName} failed (attempt ${attempt}). Retrying in ${Math.round(delay/1000)}s...`);
          if (config.showErrors) {
            console.log(chalk.yellow(`Command failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${Math.round(delay/1000)}s...`));
          }
        }
      });
    } else {
      // Just execute the wrapped command
      result = await wrappedCommand();
    }
    
    return result;
  } catch (error) {
    // Handle error with error handler
    const enhancedError = errorHandler.handle(error, {
      message: `Command ${commandName} failed`,
      category: config.errorCategory,
      code: `${commandName.toUpperCase()}_COMMAND_ERROR`,
      context: { commandName, commandArgs },
      display: config.showErrors
    });
    
    // If state persistence is enabled, make sure the final error state is saved
    if (config.enableStatePersistence) {
      const errorState = {
        commandName,
        commandArgs,
        timestamp: Date.now(),
        status: 'error',
        error: {
          message: enhancedError.message,
          code: enhancedError.code || 'UNKNOWN',
          stack: enhancedError.stack
        }
      };
      
      await stateManager.saveState(commandName, stateId, errorState);
      log('debug', `Saved final error state for command ${commandName}`);
    }
    
    throw enhancedError;
  }
}

/**
 * Get a list of recoverable commands
 * @returns {Promise<Array>} List of recoverable commands with their states
 */
export async function getRecoverableCommands() {
  return await commandRecoverer.getRecoverableCommands();
}

/**
 * Clear a recoverable command state
 * @param {string} commandName - Name of the command to clear
 * @returns {Promise<boolean>} True if successful
 */
export async function clearRecoverableCommand(commandName) {
  return await commandRecoverer.clearRecoverableState(commandName);
}

/**
 * List all recoverable commands
 * @returns {Promise<void>}
 */
export async function listRecoverableCommands() {
  const commands = await commandRecoverer.getRecoverableCommands();
  
  if (commands.length === 0) {
    console.log(chalk.blue('No recoverable commands found.'));
    return;
  }
  
  console.log(chalk.blue('\nRecoverable Commands:'));
  commands.forEach((cmd, index) => {
    const timestamp = new Date(cmd.state.timestamp).toLocaleString();
    console.log(chalk.green(`${index + 1}. ${cmd.commandName}`));
    console.log(`   Status: ${cmd.state.status}`);
    console.log(`   Last updated: ${timestamp}`);
    if (cmd.state.error) {
      console.log(`   Error: ${cmd.state.error.message}`);
    }
  });
}

export {
  stateManager,
  commandRecoverer,
  errorHandler, 
  ERROR_CATEGORY,
  ERROR_SEVERITY,
  retryManager,
  BACKOFF_STRATEGY
}; 