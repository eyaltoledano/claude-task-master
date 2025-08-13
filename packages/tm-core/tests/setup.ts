/**
 * Jest setup file for tm-core package
 * This file is executed before running tests and can be used to configure
 * testing utilities, global mocks, and test environment setup.
 */

// Configure test environment
process.env.NODE_ENV = 'test';

// Global test utilities can be added here
// Custom matchers and global types can be defined here in the future

// Set up any global mocks or configurations here
beforeEach(() => {
	// Reset any global state before each test
	jest.clearAllMocks();
});

afterEach(() => {
	// Clean up after each test
	jest.restoreAllMocks();
});
