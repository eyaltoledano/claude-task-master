/**
 * Centralized Test Utilities for Snowflake Provider Tests
 *
 * This module provides:
 * - Environment detection (credentials, CLI availability)
 * - Skip helpers for conditional test execution
 * - Shared mock helpers for child process testing
 * - Response factories for API mocking
 *
 * Environment checks are performed ONCE at module load time (synchronously)
 * to avoid race conditions and ensure consistent behavior across all tests.
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { EventEmitter } from 'events';

// ============================================================================
// Environment State (populated synchronously at module load)
// ============================================================================

export interface TestEnvironment {
	/** Whether Snowflake credentials are available */
	hasCredentials: boolean;
	/** Credential method being used (for logging) */
	credentialMethod: string | null;
	/** Whether Cortex CLI is installed and working */
	hasCliAvailable: boolean;
	/** Cortex CLI version string if available */
	cliVersion: string | null;
	/** Whether environment has been initialized */
	initialized: boolean;
}

// Global state - populated synchronously at module load
const environment: TestEnvironment = {
	hasCredentials: false,
	credentialMethod: null,
	hasCliAvailable: false,
	cliVersion: null,
	initialized: false
};

// Track if status has been logged (to avoid duplicate logs across workers)
let statusLogged = false;

// ============================================================================
// Credential Detection (Synchronous)
// ============================================================================

function detectCredentials(): {
	hasCredentials: boolean;
	method: string | null;
} {
	const account = process.env.SNOWFLAKE_ACCOUNT || process.env.CORTEX_ACCOUNT;
	const connectionName = process.env.SNOWFLAKE_CONNECTION_NAME;

	// Method 1: Connection name with connections.toml
	if (connectionName) {
		try {
			const homeDir = process.env.HOME || process.env.USERPROFILE || '';
			const connectionsPath = resolve(
				homeDir,
				'.snowflake',
				'connections.toml'
			);
			if (existsSync(connectionsPath)) {
				const content = readFileSync(connectionsPath, 'utf-8');
				if (
					content.includes(`[${connectionName}]`) ||
					content.includes(`[connections.${connectionName}]`)
				) {
					return {
						hasCredentials: true,
						method: `connection: ${connectionName}`
					};
				}
			}
		} catch {
			// Fall through to other checks
		}
	}

	// Method 2: Direct API key authentication
	const apiKey = process.env.SNOWFLAKE_API_KEY || process.env.CORTEX_API_KEY;
	const baseUrl = process.env.SNOWFLAKE_BASE_URL || process.env.CORTEX_BASE_URL;
	if (apiKey && (baseUrl || account)) {
		return {
			hasCredentials: true,
			method: baseUrl ? `API key + base URL` : `API key + account`
		};
	}

	// Method 3 & 4: Key pair or password authentication
	const user = process.env.SNOWFLAKE_USER || process.env.CORTEX_USER;
	if (account && user) {
		const hasPrivateKey = !!(
			process.env.SNOWFLAKE_PRIVATE_KEY ||
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH ||
			process.env.SNOWFLAKE_PRIVATE_KEY_FILE
		);
		if (hasPrivateKey) {
			return { hasCredentials: true, method: 'key pair' };
		}
		if (process.env.SNOWFLAKE_PASSWORD) {
			return { hasCredentials: true, method: 'password' };
		}
	}

	return { hasCredentials: false, method: null };
}

// ============================================================================
// CLI Detection (Synchronous)
// ============================================================================

function detectCli(): { available: boolean; version: string | null } {
	try {
		const output = execSync('cortex --version', {
			encoding: 'utf-8',
			timeout: 5000,
			stdio: ['ignore', 'pipe', 'ignore']
		});

		// Extract version (e.g., "cortex 0.25.1202+193053.088081bf" or "1.2.3")
		const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
		if (versionMatch) {
			return { available: true, version: versionMatch[1] };
		}

		// Check alternative pattern
		if (/cortex\s+\d+\.\d+/.test(output)) {
			const altMatch = output.match(/cortex\s+(\d+\.\d+[^\s]*)/);
			return { available: true, version: altMatch?.[1] || 'unknown' };
		}

		return { available: false, version: null };
	} catch {
		return { available: false, version: null };
	}
}

// ============================================================================
// Initialize Environment (runs once at module load)
// ============================================================================

function initializeEnvironment(): void {
	if (environment.initialized) return;

	// Check credentials
	const credResult = detectCredentials();
	environment.hasCredentials = credResult.hasCredentials;
	environment.credentialMethod = credResult.method;

	// Check CLI
	const cliResult = detectCli();
	environment.hasCliAvailable = cliResult.available;
	environment.cliVersion = cliResult.version;

	environment.initialized = true;
}

// Initialize immediately on module load
initializeEnvironment();

// ============================================================================
// Public API - Environment Access
// ============================================================================

/**
 * Get the current test environment state
 */
export function getTestEnvironment(): Readonly<TestEnvironment> {
	return environment;
}

/**
 * Check if credentials are available
 */
export function hasCredentials(): boolean {
	return environment.hasCredentials;
}

/**
 * Check if CLI is available
 */
export function hasCliAvailable(): boolean {
	return environment.hasCliAvailable;
}

/**
 * Log the test environment status (call once at test startup)
 * Only logs once per process to avoid duplicate output in Jest workers
 */
export function logEnvironmentStatus(): void {
	// Only log once per process (Jest runs setup in each worker)
	if (statusLogged) return;
	statusLogged = true;

	// Skip logging in worker processes to reduce noise (main process logs)
	const workerId = process.env.JEST_WORKER_ID;
	if (workerId && workerId !== '1') return;

	console.log('\n📋 Test Environment Status:');

	if (environment.hasCredentials) {
		console.log(`   ✅ Credentials: ${environment.credentialMethod}`);
	} else {
		console.warn(
			'   ⚠️  No credentials found - integration tests will be skipped'
		);
	}

	if (environment.hasCliAvailable) {
		console.log(`   ✅ Cortex CLI: v${environment.cliVersion}`);
	} else {
		console.warn(
			'   ⚠️  Cortex CLI not installed - CLI tests will be skipped'
		);
	}

	console.log('');
}

// ============================================================================
// Skip Helpers for Conditional Test Execution
// ============================================================================

/**
 * Skip helper for credential-dependent test suites
 *
 * @example
 * ```typescript
 * import { describeWithCredentials } from '../test-utils';
 *
 * describeWithCredentials('My Integration Tests', () => {
 *   // Tests that require credentials
 * });
 * ```
 */
export function describeWithCredentials(
	suiteName: string,
	testFn: () => void
): void {
	if (environment.hasCredentials) {
		describe(suiteName, testFn);
	} else {
		describe.skip(suiteName, testFn);
	}
}

/**
 * Skip helper for CLI-dependent test suites
 *
 * @example
 * ```typescript
 * import { describeWithCli } from '../test-utils';
 *
 * describeWithCli('CLI Integration Tests', () => {
 *   // Tests that require CLI
 * });
 * ```
 */
export function describeWithCli(suiteName: string, testFn: () => void): void {
	if (environment.hasCliAvailable) {
		describe(suiteName, testFn);
	} else {
		describe.skip(suiteName, testFn);
	}
}

/**
 * Skip helper for tests requiring both credentials AND CLI
 *
 * @example
 * ```typescript
 * import { describeWithCredentialsAndCli } from '../test-utils';
 *
 * describeWithCredentialsAndCli('Full Integration Tests', () => {
 *   // Tests that require both
 * });
 * ```
 */
export function describeWithCredentialsAndCli(
	suiteName: string,
	testFn: () => void
): void {
	if (environment.hasCredentials && environment.hasCliAvailable) {
		describe(suiteName, testFn);
	} else {
		describe.skip(suiteName, testFn);
	}
}

// ============================================================================
// Shared Mock Helpers
// ============================================================================

/**
 * Mock ChildProcess type for CLI tests
 */
export interface MockChildProcess extends EventEmitter {
	stdout: EventEmitter & { destroy: jest.Mock };
	stderr: EventEmitter & { destroy: jest.Mock };
	unref: jest.Mock;
	kill: jest.Mock;
}

// Track all created mock child processes for cleanup
const trackedMockChildProcesses: MockChildProcess[] = [];

/**
 * Create a mock ChildProcess with EventEmitter
 * Use this in CLI-based tests that need to mock child_process.spawn
 *
 * IMPORTANT: Call cleanupMockChildProcesses() in afterEach to prevent
 * Jest worker hang due to lingering event listeners.
 *
 * @example
 * ```typescript
 * import { createMockChildProcess, cleanupMockChildProcesses } from '../test-utils';
 *
 * afterEach(() => {
 *   cleanupMockChildProcesses();
 * });
 *
 * const mockChild = createMockChildProcess();
 * mockSpawn.mockReturnValue(mockChild as any);
 *
 * // Simulate successful output
 * setImmediate(() => {
 *   mockChild.stdout.emit('data', 'output data');
 *   mockChild.emit('exit', 0);
 * });
 * ```
 */
export function createMockChildProcess(): MockChildProcess {
	const mockChild = new EventEmitter() as MockChildProcess;
	mockChild.stdout = Object.assign(new EventEmitter(), {
		destroy: jest.fn()
	});
	mockChild.stderr = Object.assign(new EventEmitter(), {
		destroy: jest.fn()
	});
	mockChild.unref = jest.fn();
	mockChild.kill = jest.fn();
	// Track for cleanup
	trackedMockChildProcesses.push(mockChild);
	return mockChild;
}

/**
 * Clean up all mock child processes created by createMockChildProcess
 *
 * Call this in afterEach to prevent Jest worker hang due to lingering
 * event listeners on EventEmitter instances.
 */
export function cleanupMockChildProcesses(): void {
	while (trackedMockChildProcesses.length > 0) {
		const mockChild = trackedMockChildProcesses.pop();
		if (mockChild) {
			mockChild.removeAllListeners();
			mockChild.stdout?.removeAllListeners();
			mockChild.stderr?.removeAllListeners();
		}
	}
}

// ============================================================================
// Mock Response Helpers
// ============================================================================

/**
 * Options for creating mock responses
 */
export interface MockResponseOptions {
	/** HTTP status code (default: 200) */
	status?: number;
	/** Response headers */
	headers?: Record<string, string>;
	/** Whether this is a streaming response */
	isStream?: boolean;
}

/**
 * Create a mock Response object for REST API tests
 *
 * @example
 * ```typescript
 * import { createMockResponse } from '../test-utils';
 *
 * mockFetch.mockResolvedValueOnce(createMockResponse({
 *   choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
 *   usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
 * }));
 * ```
 */
export function createMockResponse(
	body: object | string,
	options: MockResponseOptions = {}
): Response {
	const { status = 200, headers = {}, isStream = false } = options;
	const responseBody = typeof body === 'string' ? body : JSON.stringify(body);

	const responseHeaders = new Headers({
		'content-type': isStream ? 'text/event-stream' : 'application/json',
		'x-request-id': 'test-request-id',
		...headers
	});

	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? 'OK' : 'Error',
		headers: responseHeaders,
		json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
		text: async () => responseBody,
		blob: async () => new Blob([responseBody]),
		arrayBuffer: async () => new ArrayBuffer(0),
		formData: async () => new FormData(),
		clone: () => createMockResponse(body, options),
		body: null,
		bodyUsed: false,
		redirected: false,
		type: 'basic' as ResponseType,
		url: 'https://test.snowflakecomputing.com/api/v2/cortex/inference:complete'
	} as Response;
}

/**
 * Create a streaming mock response for SSE (Server-Sent Events) testing
 *
 * @example
 * ```typescript
 * import { createStreamingResponse } from '../test-utils';
 *
 * mockFetch.mockResolvedValueOnce(createStreamingResponse([
 *   'data: {"choices":[{"delta":{"content":"Hello"}}]}',
 *   'data: {"choices":[{"delta":{"content":" world"}}]}',
 *   'data: {"choices":[{"finish_reason":"stop"}]}'
 * ]));
 * ```
 */
export function createStreamingResponse(events: string[]): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			events.forEach((event) => {
				controller.enqueue(encoder.encode(event + '\n'));
			});
			controller.close();
		}
	});

	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		headers: new Headers({ 'content-type': 'text/event-stream' }),
		body: stream,
		json: async () => ({}),
		text: async () => '',
		blob: async () => new Blob(),
		arrayBuffer: async () => new ArrayBuffer(0),
		formData: async () => new FormData(),
		clone: () => createStreamingResponse(events),
		bodyUsed: false,
		redirected: false,
		type: 'basic' as ResponseType,
		url: 'https://test.snowflakecomputing.com/api/v2/cortex/inference:complete'
	} as Response;
}

/**
 * Create a mock error response
 *
 * @example
 * ```typescript
 * import { createErrorResponse } from '../test-utils';
 *
 * mockFetch.mockResolvedValueOnce(createErrorResponse(429, 'Rate limit exceeded'));
 * ```
 */
export function createErrorResponse(status: number, message: string): Response {
	return createMockResponse({ error: { message, code: status } }, { status });
}

// ============================================================================
// Cortex Response Helpers
// ============================================================================

/**
 * Standard success response body for Cortex API
 */
export interface CortexResponseBody {
	choices: Array<{
		message: { content: string; tool_calls?: any[] };
		finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
	thinking?: string;
	structured_output?: Array<{ raw_message: unknown }>;
}

/**
 * Create a standard Cortex success response
 *
 * @example
 * ```typescript
 * import { createCortexResponse } from '../test-utils';
 *
 * mockFetch.mockResolvedValueOnce(createCortexResponse('Hello, world!'));
 * mockFetch.mockResolvedValueOnce(createCortexResponse('Done', { thinking: 'Let me think...' }));
 * ```
 */
export function createCortexResponse(
	content: string,
	extras: Partial<Omit<CortexResponseBody, 'choices'>> = {}
): Response {
	const body: CortexResponseBody = {
		choices: [
			{
				message: { content },
				finish_reason: 'stop'
			}
		],
		usage: {
			prompt_tokens: 10,
			completion_tokens: 5,
			total_tokens: 15,
			...extras.usage
		},
		...extras
	};
	return createMockResponse(body);
}

// ============================================================================
// Matrix Test Helpers (for integration/matrix tests)
// ============================================================================

/**
 * Model test result tracking
 */
export interface ModelTestResult {
	modelId: string;
	mode: 'rest' | 'cli';
	category: 'claude' | 'openai' | 'other';
	success: boolean;
	error?: string;
	responseText?: string;
	durationMs: number;
	requestDetails?: any;
}

export const testResults: ModelTestResult[] = [];

/**
 * Test model generation with error handling and result tracking
 */
export async function testModelGeneration(
	modelId: string,
	mode: 'rest' | 'cli',
	category: 'claude' | 'openai' | 'other',
	generateFn: () => Promise<{ text: string }>
): Promise<void> {
	const startTime = Date.now();
	try {
		const result = await generateFn();
		const durationMs = Date.now() - startTime;

		testResults.push({
			modelId,
			mode,
			category,
			success: true,
			responseText: result.text.substring(0, 100),
			durationMs
		});

		expect(result.text).toBeTruthy();
		expect(result.text.length).toBeGreaterThan(0);
	} catch (error: any) {
		const durationMs = Date.now() - startTime;

		testResults.push({
			modelId,
			mode,
			category,
			success: false,
			error: error.message,
			durationMs
		});

		// Re-throw for Jest to handle
		throw error;
	}
}

/**
 * Test model structured output with error handling and result tracking
 */
export async function testModelStructuredOutput<T>(
	modelId: string,
	mode: 'rest' | 'cli',
	category: 'claude' | 'openai' | 'other',
	generateFn: () => Promise<{ object: T }>
): Promise<void> {
	const startTime = Date.now();
	try {
		const result = await generateFn();
		const durationMs = Date.now() - startTime;

		testResults.push({
			modelId,
			mode,
			category,
			success: true,
			responseText: JSON.stringify(result.object).substring(0, 100),
			durationMs
		});

		expect(result.object).toBeTruthy();
	} catch (error: any) {
		const durationMs = Date.now() - startTime;

		testResults.push({
			modelId,
			mode,
			category,
			success: false,
			error: error.message,
			durationMs
		});

		// Re-throw for Jest to handle
		throw error;
	}
}
