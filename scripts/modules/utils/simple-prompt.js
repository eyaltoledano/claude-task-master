/**
 * simple-prompt.js
 * A lightweight alternative to inquirer for basic CLI prompts
 */

import readline from 'readline';
import { createInterface } from 'readline';

/**
 * Creates a simplified version of inquirer's prompt functionality
 * @param {Array} questions - Array of question objects 
 * @returns {Promise<Object>} - Answers object
 */
export async function prompt(questions) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Add a question mark method to our readline interface
  rl.question = (query) => new Promise((resolve) => {
    rl._questionCallback = resolve;
    rl.write(query);
  });

  const answers = {};

  try {
    for (const question of questions) {
      let isValid = false;
      let answer;

      while (!isValid) {
        switch(question.type) {
          case 'input':
            answer = await askInput(rl, question);
            break;
          case 'confirm':
            answer = await askConfirm(rl, question);
            break;
          case 'list':
            answer = await askList(rl, question);
            break;
          default:
            answer = await askInput(rl, question);
        }

        // Run validation if provided
        if (question.validate) {
          const validationResult = question.validate(answer);
          
          if (validationResult === true || validationResult === undefined) {
            isValid = true;
          } else {
            console.log(`\x1b[31m${validationResult}\x1b[0m`); // Show error in red
          }
        } else {
          isValid = true;
        }
      }

      answers[question.name] = answer;
    }
  } finally {
    rl.close();
  }

  return answers;
}

/**
 * Ask an input question
 * @param {readline.Interface} rl - Readline interface
 * @param {Object} question - Question object
 * @returns {Promise<string>} - User's answer
 */
async function askInput(rl, question) {
  const message = `${question.message} ${question.default ? `(${question.default}) ` : ''}`;
  
  return new Promise((resolve) => {
    rl.question(`${message}: `, (answer) => {
      // Use default if answer is empty
      resolve(answer.trim() || question.default || '');
    });
  });
}

/**
 * Ask a confirm question
 * @param {readline.Interface} rl - Readline interface
 * @param {Object} question - Question object
 * @returns {Promise<boolean>} - User's answer as boolean
 */
async function askConfirm(rl, question) {
  const defaultText = question.default === false ? 'n' : 'Y';
  const message = `${question.message} (Y/n) ${defaultText === 'n' ? '[n]' : '[Y]'}`;
  
  return new Promise((resolve) => {
    rl.question(`${message}: `, (answer) => {
      if (answer.trim() === '') {
        return resolve(question.default !== false); // Default to true unless explicitly false
      }
      
      const normalizedAnswer = answer.toLowerCase().trim();
      return resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
}

/**
 * Ask a list question
 * @param {readline.Interface} rl - Readline interface
 * @param {Object} question - Question object
 * @returns {Promise<string>} - User's selected choice
 */
async function askList(rl, question) {
  const { choices, default: defaultChoice } = question;
  
  // Display choices
  console.log(`${question.message}`);
  
  choices.forEach((choice, index) => {
    const choiceValue = typeof choice === 'object' ? choice.name : choice;
    const isDefault = defaultChoice === index || 
                     (typeof defaultChoice === 'string' && 
                      ((typeof choice === 'object' && choice.value === defaultChoice) || 
                       choice === defaultChoice));
    
    console.log(`${index + 1}. ${choiceValue}${isDefault ? ' (default)' : ''}`);
  });
  
  return new Promise((resolve) => {
    rl.question('Enter number: ', (answer) => {
      const index = parseInt(answer, 10) - 1;
      
      // Handle invalid input or empty input (use default)
      if (isNaN(index) || index < 0 || index >= choices.length) {
        // If they didn't enter anything and there's a default, use that
        if (answer.trim() === '' && defaultChoice !== undefined) {
          const defaultIndex = typeof defaultChoice === 'number' 
            ? defaultChoice 
            : choices.findIndex(c => (typeof c === 'object' ? c.value : c) === defaultChoice);
          
          const selected = choices[defaultIndex];
          return resolve(typeof selected === 'object' ? selected.value : selected);
        }
        
        // Otherwise, just use the first item
        const selected = choices[0];
        return resolve(typeof selected === 'object' ? selected.value : selected);
      }
      
      // Return the selected choice (handling object/string choices)
      const selected = choices[index];
      return resolve(typeof selected === 'object' ? selected.value : selected);
    });
  });
}

// Export a mock inquirer interface
export default {
  prompt
}; 