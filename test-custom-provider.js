/**
 * Test script for the custom OpenAI-compatible provider
 * 
 * This script tests the custom provider implementation by:
 * 1. Setting environment variables for the custom provider
 * 2. Calling the generateText function with the custom provider
 * 
 * Usage:
 * node test-custom-provider.js
 */

import { generateTextService } from './scripts/modules/ai-services-unified.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set environment variables for the custom provider if not already set
if (!process.env.CUSTOM_AI_API_KEY) {
  console.log('Setting test environment variables for custom provider...');
  process.env.CUSTOM_AI_API_KEY = 'test-api-key';
  process.env.CUSTOM_AI_API_BASE_URL = 'https://api.example.com/v1';
  process.env.CUSTOM_AI_MODEL = 'test-model';
  process.env.CUSTOM_AI_HEADERS = JSON.stringify({
    'X-Custom-Header': 'test-value'
  });
}

// Test function
async function testCustomProvider() {
  console.log('Testing custom OpenAI-compatible provider...');
  console.log('API Key:', process.env.CUSTOM_AI_API_KEY);
  console.log('Base URL:', process.env.CUSTOM_AI_API_BASE_URL);
  console.log('Model:', process.env.CUSTOM_AI_MODEL);
  console.log('Headers:', process.env.CUSTOM_AI_HEADERS);
  
  try {
    // Mock the actual API call to avoid making real requests
    const originalGenerateTextService = generateTextService;
    generateTextService = async (params) => {
      console.log('Generate text service called with params:', JSON.stringify(params, null, 2));
      return 'This is a mock response from the custom provider';
    };
    
    // Call the service with the custom provider
    const result = await generateTextService({
      provider: 'custom',
      prompt: 'Test prompt',
      role: 'main'
    });
    
    console.log('Result:', result);
    console.log('Test completed successfully!');
    
    // Restore the original function
    generateTextService = originalGenerateTextService;
  } catch (error) {
    console.error('Error testing custom provider:', error);
  }
}

// Run the test
testCustomProvider();
