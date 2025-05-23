#!/usr/bin/env node

/**
 * test-claude-code.js
 * 
 * Simple test script to verify the Claude Code integration is working.
 */
import { generateTextService } from './scripts/modules/ai-services-unified.js';

async function main() {
  console.log('Testing Claude Code integration...');
  
  try {
    // Use a simple prompt
    const response = await generateTextService({
      role: 'main',
      prompt: 'What is 2+2?',
      systemPrompt: 'You are a helpful AI assistant.'
    });
    
    console.log('\nClaude Code response:');
    console.log('--------------------------');
    console.log(response);
    console.log('--------------------------');
    console.log('\nIntegration test completed successfully!');
  } catch (error) {
    console.error('\nError testing Claude Code integration:');
    console.error(error);
    process.exit(1);
  }
}

main();