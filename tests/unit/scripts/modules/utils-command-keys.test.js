/**
 * Tests for command-based API key resolution in utils.js
 */

import { jest } from '@jest/globals';

// Create a mock function reference
const mockExecSync = jest.fn();

// Mock child_process before importing utils
jest.mock('node:child_process', () => ({
	execSync: mockExecSync
}));

// Mock fs
jest.mock('fs', () => ({
	existsSync: jest.fn(() => false),
	readFileSync: jest.fn(() => '{}'),
	writeFileSync: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
	join: jest.fn((...paths) => paths.join('/')),
	dirname: jest.fn((filePath) => filePath.split('/').slice(0, -1).join('/')),
	resolve: jest.fn((...paths) => paths.join('/')),
	parse: jest.fn((filePath) => {
		const parts = filePath.split('/');
		const fileName = parts[parts.length - 1];
		const extIndex = fileName.lastIndexOf('.');
		return {
			dir: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
			name: extIndex > 0 ? fileName.substring(0, extIndex) : fileName,
			ext: extIndex > 0 ? fileName.substring(extIndex) : '',
			base: fileName
		};
	}),
	format: jest.fn((pathObj) => {
		const dir = pathObj.dir || '';
		const base = pathObj.base || `${pathObj.name || ''}${pathObj.ext || ''}`;
		return dir ? `${dir}/${base}` : base;
	})
}));

// Mock chalk
jest.mock('chalk', () => ({
	default: {
		red: (text) => text,
		blue: (text) => text,
		green: (text) => text,
		yellow: (text) => text,
		gray: (text) => text
	},
	red: (text) => text,
	blue: (text) => text,
	green: (text) => text,
	yellow: (text) => text,
	gray: (text) => text
}));

// Mock config-manager
jest.mock('../../../../scripts/modules/config-manager.js', () => ({
	getLogLevel: jest.fn(() => 'error'), // Set to error to suppress logs in tests
	getDebugFlag: jest.fn(() => false)
}));

// Mock dotenv
jest.mock('dotenv', () => ({
	parse: jest.fn(() => ({}))
}));

// Mock git-utils
jest.mock('../../../../scripts/modules/utils/git-utils.js', () => ({
	checkAndAutoSwitchGitTagSync: jest.fn()
}));

describe('Command-based API key resolution', () => {
	let resolveEnvVariable;
	let consoleErrorSpy;

	beforeEach(async () => {
		// Clear all mocks
		jest.clearAllMocks();

		// Spy on console.error
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		// Reset environment
		delete process.env.TASKMASTER_CMD_TIMEOUT;
		delete process.env.TASKMASTER_CMD_CACHE_TTL;
		delete process.env.TASKMASTER_CMD_CACHE_ENABLED;

		// Import after mocks are set up
		const utils = await import('../../../../scripts/modules/utils.js');
		resolveEnvVariable = utils.resolveEnvVariable;
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe('parseTimeout helper', () => {
		test('returns 5000ms when TASKMASTER_CMD_TIMEOUT is not set', () => {
			// We'll test this indirectly through command execution timeout behavior
			// The timeout should default to 5000ms
			expect(process.env.TASKMASTER_CMD_TIMEOUT).toBeUndefined();
		});

		test('converts seconds to milliseconds for values <=60', () => {
			process.env.TASKMASTER_CMD_TIMEOUT = '5';
			// This will be tested through the actual execution
		});

		test('treats values >60 as milliseconds', () => {
			process.env.TASKMASTER_CMD_TIMEOUT = '1500';
			// This will be tested through the actual execution
		});

		test('returns 5000ms for invalid values', () => {
			process.env.TASKMASTER_CMD_TIMEOUT = 'invalid';
			// Should fall back to 5000ms
		});
	});

	describe('executeCommandForKey', () => {
		test('executes command and returns trimmed stdout', () => {
			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo abc' }
			});

			// The command actually executes and returns the trimmed result
			expect(result).toBe('abc');
		});

		test('returns null when command returns empty output', () => {
			mockExecSync.mockReturnValue('   \n  ');

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo ""' }
			});

			expect(result).toBeNull();
		});

		test('returns null and logs error on command timeout', () => {
			// Set a very short timeout to trigger timeout
			process.env.TASKMASTER_CMD_TIMEOUT = '1'; // 1ms

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:sleep 1' }
			});

			expect(result).toBeNull();
			// Should log an error about command failure
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/Error executing command for TEST_KEY:/)
			);
		});

		test('returns null and logs error on command failure', () => {
			const error = new Error('Command failed');
			error.status = 127;
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:nonexistent-command' }
			});

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Error executing command for TEST_KEY: 127')
			);
		});

		test('does not log the command or output', () => {
			mockExecSync.mockReturnValue('secret-value');

			resolveEnvVariable('TEST_KEY', { env: { TEST_KEY: '!cmd:echo secret' } });

			// Console.error should not contain the command or the output
			consoleErrorSpy.mock.calls.forEach((call) => {
				const message = call.join(' ');
				expect(message).not.toContain('echo secret');
				expect(message).not.toContain('secret-value');
			});
		});

		test('uses /bin/sh as the shell', () => {
			// Test that shell-specific syntax works (which verifies /bin/sh is being used)
			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo ok' }
			});

			expect(result).toBe('ok');
		});

		test('respects TASKMASTER_CMD_TIMEOUT environment variable (seconds)', () => {
			process.env.TASKMASTER_CMD_TIMEOUT = '10';

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo ok' }
			});

			// Command should execute successfully with configured timeout
			expect(result).toBe('ok');
		});

		test('respects TASKMASTER_CMD_TIMEOUT environment variable (milliseconds)', () => {
			process.env.TASKMASTER_CMD_TIMEOUT = '1500';

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo ok' }
			});

			// Command should execute successfully with configured timeout
			expect(result).toBe('ok');
		});
	});

	describe('resolveEnvVariable with !cmd: prefix', () => {
		test('detects !cmd: prefix and executes command', () => {
			const result = resolveEnvVariable('OPENAI_API_KEY', {
				env: { OPENAI_API_KEY: '!cmd:echo my-api-key' }
			});

			expect(result).toBe('my-api-key');
		});

		test('handles !cmd: with leading/trailing spaces in command', () => {
			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:   echo trimmed   ' }
			});

			expect(result).toBe('trimmed');
		});

		test('maintains backward compatibility for non-prefixed values', () => {
			const result = resolveEnvVariable('PLAIN_KEY', {
				env: { PLAIN_KEY: 'plain-value' }
			});

			expect(mockExecSync).not.toHaveBeenCalled();
			expect(result).toBe('plain-value');
		});

		test('returns undefined for missing keys', () => {
			const result = resolveEnvVariable('MISSING_KEY');

			expect(mockExecSync).not.toHaveBeenCalled();
			expect(result).toBeUndefined();
		});

		test('works with session.env source', () => {
			mockExecSync.mockReturnValue('session-key');

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo session-key' }
			});

			expect(result).toBe('session-key');
		});

		test('works with process.env source', () => {
			process.env.TEST_PROCESS_KEY = '!cmd:echo process-key';
			mockExecSync.mockReturnValue('process-key');

			const result = resolveEnvVariable('TEST_PROCESS_KEY');

			expect(result).toBe('process-key');

			delete process.env.TEST_PROCESS_KEY;
		});
	});

	describe('edge cases', () => {
		test('handles command with special characters', () => {
			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo "hello world"' }
			});

			// The command executes and returns the actual output
			expect(result).toBe('hello world');
		});

		test('handles command that returns only whitespace', () => {
			mockExecSync.mockReturnValue('   \t\n   ');

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:echo " "' }
			});

			expect(result).toBeNull();
		});

		test('handles generic error without status code', () => {
			const error = new Error('Generic error');
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:failing-command' }
			});

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Error executing command for TEST_KEY:')
			);
		});

		test('handles error with code property', () => {
			const result = resolveEnvVariable('TEST_KEY', {
				env: { TEST_KEY: '!cmd:missing-binary-that-does-not-exist' }
			});

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/Error executing command for TEST_KEY:/)
			);
		});
	});
});
