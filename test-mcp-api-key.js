#!/usr/bin/env node

import { isApiKeySet } from './scripts/modules/config-manager.js';

console.log('Testing MCP provider API key handling:');
console.log('===========================================');

// Test MCP provider (should return true without API key)
const mcpResult = isApiKeySet('mcp');
console.log(`isApiKeySet('mcp'): ${mcpResult}`);

// Test MCP provider uppercase (should return true without API key)  
const mcpUpperResult = isApiKeySet('MCP');
console.log(`isApiKeySet('MCP'): ${mcpUpperResult}`);

// Test Ollama provider (should still work)
const ollamaResult = isApiKeySet('ollama');
console.log(`isApiKeySet('ollama'): ${ollamaResult}`);

// Test OpenAI provider (should require key)
const openaiResult = isApiKeySet('openai');
console.log(`isApiKeySet('openai'): ${openaiResult}`);

console.log('\nAll tests completed!');

// Verify expected results
const allTestsPass = mcpResult === true && mcpUpperResult === true && ollamaResult === true;
console.log(`Expected behavior: ${allTestsPass ? 'PASS' : 'FAIL'}`);
