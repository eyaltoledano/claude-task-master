/**
 * Proof of Concept - Interactive CLI with Inquirer.js
 * 
 * This script demonstrates the usage of the prompt-manager module
 * to create interactive CLI experiences. 
 * 
 * Run with: node scripts/modules/prompt-manager.test.js
 */

import chalk from 'chalk';
import {
  askQuestion,
  askConfirmation,
  askSelection,
  askMultipleSelection,
  askQuestionSequence,
  validators
} from './prompt-manager.js';

// Simple banner
console.log(chalk.blue('\n==================================='));
console.log(chalk.blue('  Inquirer.js Integration Test'));
console.log(chalk.blue('===================================\n'));

async function runDemo() {
  try {
    // Basic text question
    console.log(chalk.cyan('\n--- Text Question Demo ---'));
    const name = await askQuestion('What is your name?', 'User');
    console.log(chalk.green(`Hello, ${name}!\n`));
    
    // Confirmation question
    console.log(chalk.cyan('\n--- Confirmation Question Demo ---'));
    const likesInquirer = await askConfirmation('Do you like interactive CLIs?', true);
    console.log(chalk.green(`You ${likesInquirer ? 'like' : 'do not like'} interactive CLIs.\n`));
    
    // Selection from list
    console.log(chalk.cyan('\n--- Selection Demo ---'));
    const favoriteFeature = await askSelection('What\'s your favorite Inquirer.js feature?', [
      'Simple text prompts',
      'Selection lists',
      'Checkbox multi-select',
      'Confirmation prompts',
      'Password input'
    ]);
    console.log(chalk.green(`Your favorite feature is: ${favoriteFeature}\n`));
    
    // Multiple selection
    console.log(chalk.cyan('\n--- Multiple Selection Demo ---'));
    const selectedFeatures = await askMultipleSelection('Select all features you want to use:', [
      { name: 'Interactive command prompts', value: 'prompts' },
      { name: 'Validation for user input', value: 'validation' },
      { name: 'Custom question flows', value: 'flows' },
      { name: 'Error handling', value: 'errors' }
    ]);
    console.log(chalk.green('You selected the following features:'));
    selectedFeatures.forEach(feature => {
      console.log(chalk.green(` - ${feature}`));
    });
    
    // Question sequence
    console.log(chalk.cyan('\n--- Question Sequence Demo ---'));
    const projectAnswers = await askQuestionSequence([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: 'New Project',
        validate: validators.required
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        validate: validators.minLength(10)
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Priority level:',
        choices: ['low', 'medium', 'high'],
        default: 'medium'
      },
      {
        type: 'confirm',
        name: 'hasDeadline',
        message: 'Does it have a deadline?',
        default: false
      },
      {
        type: 'input',
        name: 'deadline',
        message: 'Enter deadline (YYYY-MM-DD):',
        when: (answers) => answers.hasDeadline,
        validate: validators.pattern(
          /^\d{4}-\d{2}-\d{2}$/,
          'Please enter a date in YYYY-MM-DD format'
        )
      }
    ]);
    
    console.log(chalk.green('\nProject information:'));
    console.log(chalk.green(` - Name: ${projectAnswers.projectName}`));
    console.log(chalk.green(` - Description: ${projectAnswers.description}`));
    console.log(chalk.green(` - Priority: ${projectAnswers.priority}`));
    
    if (projectAnswers.hasDeadline) {
      console.log(chalk.green(` - Deadline: ${projectAnswers.deadline}`));
    } else {
      console.log(chalk.green(` - No deadline set`));
    }
    
    // Summary
    console.log(chalk.cyan('\n--- Demo Complete ---'));
    console.log(chalk.green('Successfully tested all Inquirer.js integration features!'));
    console.log(chalk.yellow('Press Ctrl+C to exit'));
    
  } catch (error) {
    console.error(chalk.red(`\nError during demo: ${error.message}`));
    process.exit(1);
  }
}

// Run the demo
runDemo(); 