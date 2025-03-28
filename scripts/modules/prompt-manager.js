/**
 * Prompt Manager Module
 * 
 * This module provides reusable patterns for interactive CLI prompts
 * using Inquirer.js. It includes common question types, validation
 * helpers, and error handling for interactive CLI experiences.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { log } from './utils.js';

/**
 * Ask a simple text question
 * @param {string} message - The question to ask
 * @param {string} defaultValue - Default value if user doesn't provide input
 * @param {Function} validate - Validation function (optional)
 * @returns {Promise<string>} User's answer
 */
export async function askQuestion(message, defaultValue = '', validate = null) {
  try {
    const question = {
      type: 'input',
      name: 'answer',
      message: chalk.white(message),
      default: defaultValue
    };
    
    if (validate) {
      question.validate = validate;
    }
    
    const { answer } = await inquirer.prompt([question]);
    return answer;
  } catch (error) {
    if (error.isTtyError) {
      // Handle case where prompt couldn't be rendered in current environment
      log('warn', 'Interactive prompt not available in current environment');
      console.warn(chalk.yellow('Interactive prompts not available. Using default value.'));
      return defaultValue;
    }
    
    // If user cancels (Ctrl+C), we should handle it gracefully
    if (error.message.includes('canceled')) {
      log('info', 'User cancelled the prompt');
      console.log(chalk.yellow('\nPrompt cancelled by user.'));
      process.exit(0); // Exit gracefully
    }
    
    // For other errors, throw
    throw error;
  }
}

/**
 * Ask a yes/no confirmation question
 * @param {string} message - The question to ask
 * @param {boolean} defaultValue - Default value if user doesn't provide input
 * @returns {Promise<boolean>} User's answer (true for yes, false for no)
 */
export async function askConfirmation(message, defaultValue = false) {
  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.white(message),
        default: defaultValue
      }
    ]);
    
    return confirmed;
  } catch (error) {
    if (error.isTtyError) {
      log('warn', 'Interactive prompt not available in current environment');
      console.warn(chalk.yellow('Interactive prompts not available. Using default value.'));
      return defaultValue;
    }
    
    if (error.message.includes('canceled')) {
      log('info', 'User cancelled the prompt');
      console.log(chalk.yellow('\nPrompt cancelled by user.'));
      process.exit(0);
    }
    
    throw error;
  }
}

/**
 * Ask for a selection from a list of choices
 * @param {string} message - The question to ask
 * @param {Array<string|Object>} choices - Array of choices (strings or objects with name/value)
 * @param {string|number} defaultValue - Default selected value
 * @returns {Promise<string>} User's selected choice
 */
export async function askSelection(message, choices, defaultValue = null) {
  try {
    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: chalk.white(message),
        choices: choices,
        default: defaultValue
      }
    ]);
    
    return selection;
  } catch (error) {
    if (error.isTtyError) {
      log('warn', 'Interactive prompt not available in current environment');
      console.warn(chalk.yellow('Interactive prompts not available. Using default value.'));
      return defaultValue || (choices.length > 0 ? choices[0] : null);
    }
    
    if (error.message.includes('canceled')) {
      log('info', 'User cancelled the prompt');
      console.log(chalk.yellow('\nPrompt cancelled by user.'));
      process.exit(0);
    }
    
    throw error;
  }
}

/**
 * Ask for multiple selections from a list of choices
 * @param {string} message - The question to ask
 * @param {Array<string|Object>} choices - Array of choices (strings or objects with name/value)
 * @returns {Promise<Array<string>>} User's selected choices
 */
export async function askMultipleSelection(message, choices) {
  try {
    const { selections } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selections',
        message: chalk.white(message),
        choices: choices
      }
    ]);
    
    return selections;
  } catch (error) {
    if (error.isTtyError) {
      log('warn', 'Interactive prompt not available in current environment');
      console.warn(chalk.yellow('Interactive prompts not available. Using empty array as default.'));
      return [];
    }
    
    if (error.message.includes('canceled')) {
      log('info', 'User cancelled the prompt');
      console.log(chalk.yellow('\nPrompt cancelled by user.'));
      process.exit(0);
    }
    
    throw error;
  }
}

/**
 * Ask a series of questions defined in a sequence
 * @param {Array<Object>} questions - Array of question objects for Inquirer
 * @returns {Promise<Object>} Object containing all answers
 */
export async function askQuestionSequence(questions) {
  try {
    const answers = await inquirer.prompt(questions);
    return answers;
  } catch (error) {
    if (error.isTtyError) {
      log('warn', 'Interactive prompt not available in current environment');
      console.warn(chalk.yellow('Interactive prompts not available. Using default values.'));
      
      // Return empty object or default values if provided in questions
      const defaultAnswers = {};
      questions.forEach(q => {
        defaultAnswers[q.name] = q.default !== undefined ? q.default : '';
      });
      
      return defaultAnswers;
    }
    
    if (error.message.includes('canceled')) {
      log('info', 'User cancelled the prompt');
      console.log(chalk.yellow('\nPrompt cancelled by user.'));
      process.exit(0);
    }
    
    throw error;
  }
}

/**
 * Common validation functions
 */
export const validators = {
  /**
   * Validates that input is not empty
   * @param {string} input - User input to validate
   * @returns {boolean|string} True if valid, error message if invalid
   */
  required: (input) => {
    return input && input.trim().length > 0 
      ? true 
      : 'This field is required';
  },
  
  /**
   * Validates that input is a valid file path
   * @param {string} input - User input to validate
   * @returns {boolean|string} True if valid, error message if invalid
   */
  filePath: (input) => {
    return input && input.trim().length > 0 && !input.includes('?') && !input.includes('*')
      ? true 
      : 'Please enter a valid file path';
  },
  
  /**
   * Creates a validator for minimum length
   * @param {number} min - Minimum length required
   * @returns {Function} Validator function
   */
  minLength: (min) => {
    return (input) => {
      return input && input.trim().length >= min
        ? true
        : `Input must be at least ${min} characters`;
    };
  },
  
  /**
   * Creates a validator that checks if input matches a pattern
   * @param {RegExp} pattern - Regular expression pattern
   * @param {string} message - Error message if pattern doesn't match
   * @returns {Function} Validator function
   */
  pattern: (pattern, message) => {
    return (input) => {
      return pattern.test(input)
        ? true
        : message || 'Input format is invalid';
    };
  }
}; 