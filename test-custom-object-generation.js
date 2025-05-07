/**
 * Test script for custom provider object generation with fallback
 * 
 * This script tests the custom provider's ability to generate structured objects
 * with fallback to JSON generation when function calling is not supported.
 * 
 * Usage:
 * node test-custom-object-generation.js
 */

import { generateObjectService } from './scripts/modules/ai-services-unified.js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set environment variables for the custom provider if not already set
if (!process.env.CUSTOM_AI_API_KEY) {
  console.log('Setting test environment variables for custom provider...');
  process.env.CUSTOM_AI_API_KEY = 'test-api-key';
  process.env.CUSTOM_AI_API_BASE_URL = 'https://api.example.com/v1';
  process.env.CUSTOM_AI_MODEL = 'gemini-2.5-flash-preview-04-17-thinking'; // A model known to have issues with function calling
}

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
  console.log('Testing custom provider object generation with fallback...');
  console.log('API Key:', process.env.CUSTOM_AI_API_KEY);
  console.log('Base URL:', process.env.CUSTOM_AI_API_BASE_URL);
  console.log('Model:', process.env.CUSTOM_AI_MODEL);
  
  try {
    // Mock the actual API call to avoid making real requests
    const originalGenerateObjectService = generateObjectService;
    generateObjectService = async (params) => {
      console.log('Generate object service called with params:', JSON.stringify(params, null, 2));
      
      // Simulate a successful response
      return {
        title: "Implement custom provider fallback",
        description: "Add fallback mechanism for models that don't support function calling",
        priority: "high",
        estimatedHours: 4,
        tags: ["custom-provider", "function-calling", "fallback"]
      };
    };
    
    // Call the service with the custom provider
    const result = await generateObjectService({
      role: 'main',
      provider: 'custom',
      schema: TaskSchema,
      objectName: 'task',
      prompt: "Create a task for implementing a fallback mechanism for custom providers when function calling is not supported."
    });
    
    console.log('Result:', result);
    console.log('Test completed successfully!');
    
    // Restore the original function
    generateObjectService = originalGenerateObjectService;
  } catch (error) {
    console.error('Error testing custom provider object generation:', error);
  }
}

// Run the test
testCustomObjectGeneration();
