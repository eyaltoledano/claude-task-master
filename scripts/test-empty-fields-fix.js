#!/usr/bin/env node
/**
 * Test script for the empty fields fix in custom provider fallback
 * 
 * This script tests the enhanced fallback mechanism that ensures
 * all required fields (title, description, testStrategy) are properly populated.
 * 
 * Usage:
 * node scripts/test-empty-fields-fix.js
 */

import { generateObjectService } from './modules/ai-services-unified.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { log } from './modules/utils.js';

// Enable debug logging
process.env.DEBUG = 'true';

// Load environment variables from .env file
dotenv.config();

// Define a schema for the task object with required fields
const TaskSchema = z.object({
  title: z.string().min(1).describe('Clear, concise title for the task'),
  description: z.string().min(1).describe('A one or two sentence description of the task'),
  details: z.string().describe('In-depth implementation details, considerations, and guidance'),
  testStrategy: z.string().describe('Detailed approach for verifying task completion')
});

// Test function
async function testEmptyFieldsFix() {
  console.log(chalk.blue.bold('Testing empty fields fix in custom provider fallback...'));
  
  // Check if required environment variables are set
  if (!process.env.CUSTOM_AI_API_KEY || !process.env.CUSTOM_AI_API_BASE_URL) {
    console.log(chalk.yellow('Setting test environment variables for custom provider...'));
    
    // Use OpenAI API key as a fallback if available
    if (process.env.OPENAI_API_KEY) {
      process.env.CUSTOM_AI_API_KEY = process.env.OPENAI_API_KEY;
      process.env.CUSTOM_AI_API_BASE_URL = 'https://api.openai.com/v1';
      process.env.CUSTOM_AI_MODEL = 'gpt-3.5-turbo';
    } else {
      console.error(chalk.red('ERROR: No API keys available for testing. Please set CUSTOM_AI_API_KEY and CUSTOM_AI_API_BASE_URL in your .env file.'));
      return;
    }
  }
  
  console.log(chalk.green('Using custom provider configuration:'));
  console.log(chalk.green('API Key:'), chalk.gray('****' + process.env.CUSTOM_AI_API_KEY.slice(-4)));
  console.log(chalk.green('Base URL:'), process.env.CUSTOM_AI_API_BASE_URL);
  console.log(chalk.green('Model:'), process.env.CUSTOM_AI_MODEL || 'default');
  
  try {
    console.log(chalk.blue('\nGenerating task object with custom provider...'));
    
    // Call the service with the custom provider
    const result = await generateObjectService({
      role: 'main',
      provider: 'custom',
      schema: TaskSchema,
      objectName: 'task',
      systemPrompt: "You are a helpful assistant that creates task objects based on the user's request.",
      prompt: "Create a task for implementing a fallback mechanism for custom providers when function calling is not supported."
    });
    
    console.log(chalk.green('\nSuccessfully generated task object:'));
    console.log(JSON.stringify(result, null, 2));
    
    // Check for empty fields
    const emptyFields = [];
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.trim() === '') {
        emptyFields.push(key);
      }
    }
    
    if (emptyFields.length > 0) {
      console.error(chalk.red(`\n❌ Found empty fields: ${emptyFields.join(', ')}`));
    } else {
      console.log(chalk.green('\n✅ No empty fields found!'));
    }
    
    // Validate the result against the schema
    try {
      TaskSchema.parse(result);
      console.log(chalk.green('\n✅ Object validation successful!'));
    } catch (validationError) {
      console.error(chalk.red('\n❌ Object validation failed:'), validationError.errors);
    }
    
    console.log(chalk.blue.bold('\nTest completed!'));
  } catch (error) {
    console.error(chalk.red('\nError testing empty fields fix:'), error);
    console.error(chalk.red('Stack trace:'), error.stack);
  }
}

// Run the test
testEmptyFieldsFix();
