/**
 * Tests for the stripAnsiCodes utility function
 */
import { jest } from '@jest/globals';

// Import the module under test
const { stripAnsiCodes } = await import('../../scripts/modules/utils.js');

describe('stripAnsiCodes', () => {
	test('should remove ANSI color codes from text', () => {
		const textWithColors = '\x1b[31mRed text\x1b[0m \x1b[32mGreen text\x1b[0m';
		const result = stripAnsiCodes(textWithColors);
		expect(result).toBe('Red text Green text');
	});

	test('should handle text without ANSI codes', () => {
		const plainText = 'This is plain text';
		const result = stripAnsiCodes(plainText);
		expect(result).toBe('This is plain text');
	});

	test('should handle empty string', () => {
		const result = stripAnsiCodes('');
		expect(result).toBe('');
	});

	test('should handle complex ANSI sequences', () => {
		// Test with various ANSI escape sequences
		const complexText =
			'\x1b[1;31mBold red\x1b[0m \x1b[4;32mUnderlined green\x1b[0m \x1b[33;46mYellow on cyan\x1b[0m';
		const result = stripAnsiCodes(complexText);
		expect(result).toBe('Bold red Underlined green Yellow on cyan');
	});

	test('should handle non-string input gracefully', () => {
		expect(stripAnsiCodes(null)).toBe(null);
		expect(stripAnsiCodes(undefined)).toBe(undefined);
		expect(stripAnsiCodes(123)).toBe(123);
		expect(stripAnsiCodes({})).toEqual({});
	});

	test('should handle real chalk output patterns', () => {
		// Test patterns similar to what chalk produces
		const chalkLikeText =
			'1 \x1b[32m✓ done\x1b[39m Setup Project \x1b[31m(high)\x1b[39m';
		const result = stripAnsiCodes(chalkLikeText);
		expect(result).toBe('1 ✓ done Setup Project (high)');
	});

	test('should handle multiline text with ANSI codes', () => {
		const multilineText =
			'\x1b[31mLine 1\x1b[0m\n\x1b[32mLine 2\x1b[0m\n\x1b[33mLine 3\x1b[0m';
		const result = stripAnsiCodes(multilineText);
		expect(result).toBe('Line 1\nLine 2\nLine 3');
	});
});
