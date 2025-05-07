#!/usr/bin/env node
/**
 * Test script for custom provider object generation with fallback
 * 
 * This script tests the custom provider's ability to generate structured objects
 * with fallback to JSON generation when function calling is not supported.
 * 
 * Usage:
 * node scripts/test-custom-provider-fallback.js
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

// Define a schema for the object we want to generate
const TaskSchema = z.object({
  title: z.string().min(1).describe('The title of the task'),
  description: z.string().min(1).describe('A detailed description of the task'),
  priority: z.enum(['low', 'medium', 'high']).describe('The priority level of the task'),
  estimatedHours: z.number().min(0).describe('Estimated hours to complete the task'),
  tags: z.array(z.string()).describe('Tags associated with the task')
});

// Test function
async function testCustomObjectGeneration() {
  console.log(chalk.blue.bold('Testing custom provider object generation with fallback...'));
  
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
    console.log(chalk.blue('\nGenerating object with custom provider...'));
    
    // Call the service with the custom provider
    const result = await generateObjectService({
      role: 'main',
      provider: 'custom',
      schema: TaskSchema,
      objectName: 'task',
      systemPrompt: "You are a helpful assistant that creates task objects based on the user's request.",
      prompt: "Create a task for implementing a fallback mechanism for custom providers when function calling is not supported."
    });
    
    console.log(chalk.green('\nSuccessfully generated object:'));
    console.log(JSON.stringify(result, null, 2));
    
    // Validate the result against the schema
    try {
      TaskSchema.parse(result);
      console.log(chalk.green('\n✓ Object validation successful!'));
    } catch (validationError) {
      console.error(chalk.red('\n✗ Object validation failed:'), validationError.errors);
    }
    
    console.log(chalk.blue.bold('\nTest completed successfully!'));
  } catch (error) {
    console.error(chalk.red('\nError testing custom provider object generation:'), error);
    console.error(chalk.red('Stack trace:'), error.stack);
  }
}

// Run the test
testCustomObjectGeneration();
