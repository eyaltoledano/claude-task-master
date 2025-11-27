/**
 * Quick test to verify the MCP provider uses v2 specification
 */

// Mock MCP session for testing
const mockSession = {
  clientCapabilities: {
    sampling: true
  },
  requestSampling: async (request, options) => {
    return {
      content: [{
        type: 'text',
        text: 'Test response'
      }],
      usage: {
        inputTokens: 10,
        outputTokens: 5
      },
      stopReason: 'endTurn'
    };
  }
};

// Test the import and basic functionality
async function testMCPProvider() {
  try {
    // Import the new package
    const { createMCPSampling } = await import('./packages/ai-sdk-provider-mcp-sampling/src/index.js');
    
    console.log('✅ Successfully imported createMCPSampling');
    
    // Create provider
    const provider = createMCPSampling({
      session: mockSession,
      defaultSettings: {
        temperature: 0.7,
        maxTokens: 1000
      }
    });
    
    console.log('✅ Successfully created MCP provider');
    
    // Create model
    const model = provider('test-model');
    
    console.log('✅ Successfully created language model');
    console.log(`✅ Specification version: ${model.specificationVersion}`);
    
    // Verify it's v2
    if (model.specificationVersion === 'v2') {
      console.log('🎉 SUCCESS: MCP provider now uses v2 specification!');
      return true;
    } else {
      console.log(`❌ FAIL: Expected v2, got ${model.specificationVersion}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

// Run the test
testMCPProvider().then(success => {
  process.exit(success ? 0 : 1);
});