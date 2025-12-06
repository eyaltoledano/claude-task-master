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
import { cleanupMockChildProcesses } from '../../test-utils.js';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Track mock child processes for cleanup
let mockChildProcesses: EventEmitter[] = [];

// Track pending immediates for cleanup
let pendingImmediates: NodeJS.Immediate[] = [];

/**
 * Schedule an event emission with cleanup tracking
 * This prevents Jest worker hang by ensuring all scheduled callbacks are cleared
 */
function scheduleEvent(callback: () => void): void {
	const handle = setImmediate(callback);
	pendingImmediates.push(handle);
}

describe('CLI Validation Utilities', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		jest.clearAllMocks();
		pendingImmediates = [];
		mockChildProcesses = [];
		originalEnv = { ...process.env };
		delete process.env.SKIP_CLI_VALIDATION;
	});

	afterEach(() => {
		// Clear any pending scheduled events
		pendingImmediates.forEach((handle) => clearImmediate(handle));
		pendingImmediates = [];
		jest.restoreAllMocks();
		process.env = originalEnv;
		// Clean up all event listeners
		mockChildProcesses.forEach((child) => {
			child.removeAllListeners();
			(child as any).stdout?.removeAllListeners();
			(child as any).stderr?.removeAllListeners();
		});
		mockChildProcesses = [];
		cleanupMockChildProcesses();
	});

	describe('getCortexCliVersion', () => {
		it('should return version string for available CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.2.3\n');
				mockChild.emit('exit', 0);
			});

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

			scheduleEvent(() => {
				mockChild.emit('error', new Error('ENOENT'));
			});

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
		});

		it('should return null for CLI execution failure', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			scheduleEvent(() => {
				mockChild.emit('exit', 1);
			});

			const version = await getCortexCliVersion();

			expect(version).toBeNull();
		});

		it('should return null when no version found in output', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI - no version\n');
				mockChild.emit('exit', 0);
			});

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

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.2.3\n');
				mockChild.emit('exit', 0);
			});

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

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 2.0.5\n');
				mockChild.emit('exit', 0);
			});

			const result = await validateCortexCli();

			expect(result.valid).toBe(true);
			expect(result.cliVersion).toBe('2.0.5');
			expect(result.error).toBeUndefined();
		});

		it('should return invalid result with error for unavailable CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			scheduleEvent(() => {
				mockChild.emit('error', new Error('ENOENT'));
			});

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

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.0.0\n');
				mockChild.emit('exit', 0);
			});

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

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.0.0\n');
				mockChild.emit('exit', 0);
			});

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
	// Track for cleanup
	mockChildProcesses.push(mockChild);
	return mockChild;
}
