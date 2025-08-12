#!/usr/bin/env node

/**
 * Direct integration test for Claude Code AI SDK integration
 * Tests both generateText and streamText functionality
 */

import { generateText, streamText } from 'ai';
import { createClaudeCode } from 'ai-sdk-provider-claude-code';

console.log('🧪 Testing Claude Code AI SDK Integration...\n');

async function testClaudeCodeIntegration() {
  try {
    // Create Claude Code provider
    console.log('📦 Creating Claude Code provider...');
    const claudeCode = createClaudeCode();
    console.log('✅ Provider created successfully');

    // Test generateText
    console.log('\n🤖 Testing generateText...');
    const generateResult = await generateText({
      model: claudeCode('sonnet'),
      messages: [
        { role: 'user', content: 'Say hello and confirm you are Claude via Claude Code CLI!' }
      ],
      maxTokens: 50
    });

    console.log('✅ generateText response:', generateResult.text);
    console.log('📊 Usage:', generateResult.usage);

    // Test streamText
    console.log('\n🌊 Testing streamText...');
    const streamResult = await streamText({
      model: claudeCode('sonnet'),
      messages: [
        { role: 'user', content: 'Count from 1 to 5, one number per chunk.' }
      ],
      maxTokens: 30
    });

    console.log('📨 Streaming chunks:');
    let fullResponse = '';
    for await (const chunk of streamResult.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log('\n✅ Streaming completed');
    console.log('📊 Final usage:', await streamResult.usage);

    console.log('\n🎉 All tests passed! Claude Code integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error('Error message:', error.message);
    
    if (error.message.includes('Claude Code CLI')) {
      console.error('\n💡 Troubleshooting suggestions:');
      console.error('1. Ensure Claude Code CLI is installed');
      console.error('2. Run: claude setup-token');
      console.error('3. Verify CLI works: claude --help');
    }
    
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testClaudeCodeIntegration().catch(console.error);
}

export default testClaudeCodeIntegration;