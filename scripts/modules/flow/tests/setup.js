// Global test setup for Flow & AST tests

// Mock terminal components for testing
// Note: jest functions are available in test files but not in setup files
// We'll create simple mock functions here
const createMockFn = () => {
	const fn = (...args) => fn.returnValue;
	fn.calls = [];
	fn.mockImplementation = (impl) => {
		fn.impl = impl;
		return fn;
	};
	fn.mockReturnValue = (value) => {
		fn.returnValue = value;
		return fn;
	};
	fn.mockClear = () => {
		fn.calls = [];
		return fn;
	};
	return fn;
};

global.mockTerminal = {
	screen: { render: createMockFn(), destroy: createMockFn() },
	box: createMockFn(() => ({
		setContent: createMockFn(),
		focus: createMockFn()
	})),
	list: createMockFn(() => ({
		setItems: createMockFn(),
		select: createMockFn()
	}))
};

// Setup test environment
global.beforeEach(() => {
	// Clear mocks if jest is available
	if (typeof jest !== 'undefined') {
		jest.clearAllMocks();
	}
});

global.afterEach(() => {
	// Cleanup test artifacts
});
