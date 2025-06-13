/**
 * Unit tests for priority indicators UI module
 */
import { jest } from '@jest/globals';

// Mock chalk to avoid color codes in tests
const mockChalk = {
	red: jest.fn((text) => `red(${text})`),
	yellow: jest.fn((text) => `yellow(${text})`),
	white: jest.fn((text) => `white(${text})`),
	hex: jest.fn((color) => jest.fn((text) => `hex(${color})(${text})`))
};

jest.unstable_mockModule('chalk', () => ({ default: mockChalk }));

const {
	getMcpPriorityIndicators,
	getCliPriorityIndicators,
	getPriorityIndicators,
	getPriorityIndicator
} = await import('../../../src/ui/priority-indicators.js');

describe('Priority Indicators', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getMcpPriorityIndicators', () => {
		test('should return emoji indicators for MCP context', () => {
			const indicators = getMcpPriorityIndicators();

			expect(indicators).toEqual({
				high: '🔴',
				medium: '🟠',
				low: '🟢'
			});
		});
	});

	describe('getCliPriorityIndicators', () => {
		test('should return colored dot indicators for CLI context', () => {
			const indicators = getCliPriorityIndicators();

			expect(indicators).toHaveProperty('high');
			expect(indicators).toHaveProperty('medium');
			expect(indicators).toHaveProperty('low');

			// Verify that chalk functions are called for CLI indicators
			expect(typeof indicators.high).toBe('string');
			expect(typeof indicators.medium).toBe('string');
			expect(typeof indicators.low).toBe('string');
		});
	});

	describe('getPriorityIndicators', () => {
		test('should return MCP indicators when isMcp is true', () => {
			const indicators = getPriorityIndicators(true);
			const mcpIndicators = getMcpPriorityIndicators();

			expect(indicators).toEqual(mcpIndicators);
		});

		test('should return CLI indicators when isMcp is false', () => {
			const indicators = getPriorityIndicators(false);
			const cliIndicators = getCliPriorityIndicators();

			expect(indicators).toEqual(cliIndicators);
		});

		test('should default to CLI indicators when no parameter provided', () => {
			const indicators = getPriorityIndicators();
			const cliIndicators = getCliPriorityIndicators();

			expect(indicators).toEqual(cliIndicators);
		});
	});

	describe('getPriorityIndicator', () => {
		test('should return correct MCP indicator for valid priority', () => {
			const indicator = getPriorityIndicator('high', true);
			expect(indicator).toBe('🔴');
		});

		test('should return correct CLI indicator for valid priority', () => {
			const indicator = getPriorityIndicator('high', false);
			expect(typeof indicator).toBe('string');
			expect(indicator).toContain('red(●)');
		});

		test('should return medium indicator for invalid priority', () => {
			const indicator = getPriorityIndicator('invalid', true);
			expect(indicator).toBe('🟠'); // Should default to medium
		});

		test('should default to CLI context when isMcp not provided', () => {
			const indicator = getPriorityIndicator('low');
			expect(typeof indicator).toBe('string');
			expect(indicator).toContain('yellow(●)');
		});
	});
});
