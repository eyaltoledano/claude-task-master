// Global test setup for Flow & AST tests

// Mock terminal components for testing
global.mockTerminal = {
	screen: { render: jest.fn(), destroy: jest.fn() },
	box: jest.fn(() => ({ setContent: jest.fn(), focus: jest.fn() })),
	list: jest.fn(() => ({ setItems: jest.fn(), select: jest.fn() }))
};

// Setup test environment
beforeEach(() => {
	jest.clearAllMocks();
});

afterEach(() => {
	// Cleanup test artifacts
});
