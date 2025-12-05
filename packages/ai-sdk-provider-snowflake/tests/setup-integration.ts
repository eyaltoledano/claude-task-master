/**
 * Jest setup file for integration tests
 *
 * Sets longer timeout for API calls and other integration-specific config
 */

// Set longer timeout for integration tests (2 minutes)
// This is needed because API calls can take time, especially with rate limiting
jest.setTimeout(120000);

console.log('🔧 Integration test setup - timeout set to 120s');

