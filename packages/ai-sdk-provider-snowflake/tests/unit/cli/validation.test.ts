import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import {
	getCortexCliVersion,
	validateCortexCli,
	type ValidationResult
} from '../../../src/cli/validation.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('CLI Validation Utilities', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		jest.clearAllMocks();
		originalEnv = { ...process.env };
		delete process.env.SKIP_CLI_VALIDATION;
	});

	afterEach(() => {
		jest.restoreAllMocks();
		process.env = originalEnv;
	});

	describe('getCortexCliVersion', () => {
		it('should return version string for available CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate successful version check
			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.2.3\n');
				mockChild.emit('exit', 0);
			}, 10);

			const version = await getCortexCliVersion();

			expect(version).toBe('1.2.3');
			expect(mockSpawn).toHaveBeenCalledWith(
				'cortex',
				['--version'],
				expect.objectContaining({
					stdio: ['ignore', 'pipe', 'pipe'],
					detached: false
				})
			);
		});

		it('should return null for unavailable CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate CLI not found
			setTimeout(() => {
				mockChild.emit('error', new Error('ENOENT'));
			}, 10);

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
		});

		it('should return null for CLI execution failure', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate non-zero exit code
			setTimeout(() => {
				mockChild.emit('exit', 1);
			}, 10);

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
		});

		it('should return null when no version found in output', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate output without version
			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI - no version\n');
				mockChild.emit('exit', 0);
			}, 10);

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
		});

		it('should respect SKIP_CLI_VALIDATION environment variable', async () => {
			process.env.SKIP_CLI_VALIDATION = 'true';

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('should properly clean up child process', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.2.3\n');
				mockChild.emit('exit', 0);
			}, 10);

			await getCortexCliVersion();

			expect(mockChild.stdout.destroy).toHaveBeenCalled();
			expect(mockChild.stderr.destroy).toHaveBeenCalled();
			expect(mockChild.unref).toHaveBeenCalled();
		});
	});

	describe('validateCortexCli', () => {
		it('should return valid result with version for available CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 2.0.5\n');
				mockChild.emit('exit', 0);
			}, 10);

			const result = await validateCortexCli();

			expect(result.valid).toBe(true);
			expect(result.cliVersion).toBe('2.0.5');
			expect(result.error).toBeUndefined();
		});

		it('should return invalid result with error for unavailable CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			setTimeout(() => {
				mockChild.emit('error', new Error('ENOENT'));
			}, 10);

			const result = await validateCortexCli();

			expect(result.valid).toBe(false);
			expect(result.error).toContain('Cortex Code CLI not found');
			expect(result.error).toContain('PATH');
			expect(result.cliVersion).toBeUndefined();
		});

		it('should skip validation when skipValidation is true', async () => {
			const result = await validateCortexCli({ skipValidation: true });

			expect(result.valid).toBe(true);
			expect(result.cliVersion).toBe('test-mode');
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('should skip validation when SKIP_CLI_VALIDATION env var is set', async () => {
			process.env.SKIP_CLI_VALIDATION = 'true';

			const result = await validateCortexCli();

			expect(result.valid).toBe(true);
			expect(result.cliVersion).toBe('test-mode');
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('should have correct type signature', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.0.0\n');
				mockChild.emit('exit', 0);
			}, 10);

			const result: ValidationResult = await validateCortexCli();

			// TypeScript compile-time check
			expect(typeof result.valid).toBe('boolean');
			if (result.error) {
				expect(typeof result.error).toBe('string');
			}
			if (result.cliVersion) {
				expect(typeof result.cliVersion).toBe('string');
			}
		});

		it('should work without parameters', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			setTimeout(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.0.0\n');
				mockChild.emit('exit', 0);
			}, 10);

			const result = await validateCortexCli();

			expect(result.valid).toBe(true);
			expect(result.cliVersion).toBe('1.0.0');
		});
	});

	describe('ValidationResult Type', () => {
		it('should match expected interface shape', () => {
			const validResult: ValidationResult = {
				valid: true,
				cliVersion: '1.2.3'
			};

			expect(validResult.valid).toBe(true);
			expect(validResult.cliVersion).toBe('1.2.3');

			const invalidResult: ValidationResult = {
				valid: false,
				error: 'CLI not found'
			};

			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.error).toBe('CLI not found');
		});
	});
});

/**
 * Create a mock ChildProcess with EventEmitter
 */
function createMockChildProcess() {
	const mockChild = new EventEmitter() as any;
	mockChild.stdout = new EventEmitter();
	mockChild.stderr = new EventEmitter();
	mockChild.stdout.destroy = jest.fn();
	mockChild.stderr.destroy = jest.fn();
	mockChild.unref = jest.fn();
	return mockChild;
}
