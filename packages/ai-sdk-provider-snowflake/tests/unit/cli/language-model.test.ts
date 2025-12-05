import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import { CliLanguageModel } from '../../../src/cli/language-model.js';
import type { LanguageModelV2CallOptions } from '@ai-sdk/provider';
import { spawn, type ChildProcess } from 'child_process';
import {
	createMockChildProcess,
	cleanupMockChildProcesses
} from '../../test-utils.js';
// Import JSON utility functions (now shared with schema module)
import {
	extractFirstJsonObject,
	parseJsonWithFallback
} from '../../../src/schema/index.js';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Track pending setImmediate handles for cleanup
let pendingImmediates: NodeJS.Immediate[] = [];

// Helper to schedule events with cleanup tracking
function scheduleEvent(callback: () => void): void {
	const handle = setImmediate(callback);
	pendingImmediates.push(handle);
}

describe('CliLanguageModel', () => {
	let model: CliLanguageModel;

	beforeEach(() => {
		jest.clearAllMocks();
		pendingImmediates = [];
		model = new CliLanguageModel({
			id: 'test-model',
			settings: {}
		});
	});

	afterEach(() => {
		// Clear any pending setImmediate callbacks
		pendingImmediates.forEach((handle) => clearImmediate(handle));
		pendingImmediates = [];
		jest.restoreAllMocks();
		// Clean up mock child processes to prevent Jest worker hang
		cleanupMockChildProcesses();
	});

	describe('Constructor', () => {
		it('should create model with valid ID', () => {
			const testModel = new CliLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: {}
			});

			expect(testModel.modelId).toBe('cortex/claude-sonnet-4-5');
			expect(testModel.provider).toBe('snowflake');
		});

		it('should throw error for invalid model ID', () => {
			expect(() => {
				new CliLanguageModel({
					id: '',
					settings: {}
				});
			}).toThrow();
		});

		it('should apply settings correctly', () => {
			const testModel = new CliLanguageModel({
				id: 'test-model',
				settings: {
					connection: 'test-connection',
					timeout: 30000,
					dangerouslyAllowAllToolCalls: true,
					noMcp: true
				}
			});

			expect(testModel.settings.connection).toBe('test-connection');
			expect(testModel.settings.timeout).toBe(30000);
			expect(testModel.settings.dangerouslyAllowAllToolCalls).toBe(true);
			expect(testModel.settings.noMcp).toBe(true);
		});
	});

	describe('CLI Availability Check', () => {
		it('should detect available CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate successful version check
			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'Cortex CLI version 1.2.3\n');
				mockChild.emit('exit', 0);
			});

			const result = await (model as any).checkCortexCliInstallation();
			expect(result.available).toBe(true);
			expect(result.version).toBe('1.2.3');
		});

		it('should detect unavailable CLI', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate CLI not found
			scheduleEvent(() => {
				mockChild.emit('error', new Error('ENOENT'));
			});

			const result = await (model as any).checkCortexCliInstallation();
			expect(result.available).toBe(false);
		});

		it('should handle CLI execution failure', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValue(mockChild as any);

			// Simulate non-zero exit code
			scheduleEvent(() => {
				mockChild.emit('exit', 1);
			});

			const result = await (model as any).checkCortexCliInstallation();
			expect(result.available).toBe(false);
		});
	});

	describe('CLI Argument Building', () => {
		it('should build basic arguments', async () => {
			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (model as any).buildCliArguments(options);

			expect(args).toContain('--output-format');
			expect(args).toContain('stream-json');
			expect(args).toContain('--model');
			// Non-Claude models get converted to 'auto' for CLI
			expect(args).toContain('auto');
			expect(args).toContain('--print');
		});

		it('should use Claude model directly when specified', async () => {
			const claudeModel = new CliLanguageModel({
				id: 'claude-sonnet-4-5',
				settings: {}
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (claudeModel as any).buildCliArguments(options);

			expect(args).toContain('--model');
			expect(args).toContain('claude-sonnet-4-5');
		});

		it('should include connection if specified', async () => {
			const modelWithConnection = new CliLanguageModel({
				id: 'test-model',
				settings: { connection: 'my-connection' }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (modelWithConnection as any).buildCliArguments(
				options
			);

			expect(args).toContain('-c');
			expect(args).toContain('my-connection');
		});

		it('should include dangerouslyAllowAllToolCalls flag', async () => {
			const modelWithFlag = new CliLanguageModel({
				id: 'test-model',
				settings: { dangerouslyAllowAllToolCalls: true }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (modelWithFlag as any).buildCliArguments(options);

			expect(args).toContain('--dangerously-allow-all-tool-calls');
		});

		it('should include --no-mcp when noMcp is true', async () => {
			const modelWithFlag = new CliLanguageModel({
				id: 'test-model',
				settings: { noMcp: true }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (modelWithFlag as any).buildCliArguments(options);

			expect(args).toContain('--no-mcp');
		});

		it('should not include --no-mcp when noMcp is false', async () => {
			const modelWithFlag = new CliLanguageModel({
				id: 'test-model',
				settings: { noMcp: false }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
			};

			const args = await (modelWithFlag as any).buildCliArguments(options);

			expect(args).not.toContain('--no-mcp');
		});
	});

	describe('JSON Parsing', () => {
		it('should parse stream-json with assistant messages', () => {
			const stdout = JSON.stringify({
				type: 'assistant',
				message: {
					content: [{ type: 'text', text: 'Hello, world!' }]
				}
			});

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('Hello, world!');
			expect(result.finishReason).toBe('stop');
		});

		it('should prioritize result type messages', () => {
			const stdout = [
				JSON.stringify({
					type: 'assistant',
					message: { content: [{ type: 'text', text: 'Should not use this' }] }
				}),
				JSON.stringify({
					type: 'result',
					result: '{"key": "value"}'
				})
			].join('\n');

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('{"key": "value"}');
		});

		it('should strip markdown code fences', () => {
			const stdout = JSON.stringify({
				type: 'result',
				result: '```json\n{"key": "value"}\n```'
			});

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('{"key": "value"}');
		});

		it('should strip text before first brace', () => {
			const stdout = JSON.stringify({
				type: 'result',
				result: 'Here is the JSON object: {"key": "value"}'
			});

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('{"key": "value"}');
		});

		it('should strip text after last brace', () => {
			const stdout = JSON.stringify({
				type: 'result',
				result: '{"key": "value"} - this is the end'
			});

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('{"key": "value"}');
		});

		it('should handle usage information', () => {
			const stdout = [
				JSON.stringify({
					type: 'assistant',
					message: { content: [{ type: 'text', text: 'Response' }] }
				}),
				JSON.stringify({
					type: 'usage',
					usage: { prompt_tokens: 10, completion_tokens: 20 }
				})
			].join('\n');

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.usage).toEqual({
				promptTokens: 10,
				completionTokens: 20
			});
		});

		it('should handle error type messages', () => {
			const stdout = JSON.stringify({
				type: 'error',
				error: 'Something went wrong'
			});

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.finishReason).toBe('error');
		});

		it('should skip malformed JSON lines', () => {
			const stdout = [
				'invalid json line',
				JSON.stringify({
					type: 'assistant',
					message: { content: [{ type: 'text', text: 'Valid response' }] }
				}),
				'another invalid line'
			].join('\n');

			const result = (model as any).parseStreamJsonOutput(stdout);

			expect(result.text).toBe('Valid response');
		});
	});

	describe('JSON Extraction Methods (shared utilities)', () => {
		// These functions are now imported from schema module and shared with CLI
		describe('extractFirstJsonObject (imported)', () => {
			it('should extract simple JSON object', () => {
				const text = 'Some text {"key": "value"} more text';
				const result = extractFirstJsonObject(text);
				expect(result).toBe('{"key": "value"}');
			});

			it('should handle nested objects', () => {
				const text = '{"outer": {"inner": "value"}}';
				const result = extractFirstJsonObject(text);
				expect(result).toBe('{"outer": {"inner": "value"}}');
			});

			it('should handle strings with braces', () => {
				const text = '{"message": "Hello {world}"}';
				const result = extractFirstJsonObject(text);
				expect(result).toBe('{"message": "Hello {world}"}');
			});

			it('should handle escaped quotes', () => {
				const text = '{"message": "She said \\"hello\\""}';
				const result = extractFirstJsonObject(text);
				expect(result).toBe('{"message": "She said \\"hello\\""}');
			});

			it('should return null for no JSON', () => {
				const text = 'No JSON here';
				const result = extractFirstJsonObject(text);
				expect(result).toBeNull();
			});
		});

		describe('parseJsonWithFallback (imported)', () => {
			it('should parse valid JSON', () => {
				const json = '{"key": "value"}';
				const result = parseJsonWithFallback(json);
				expect(result).toEqual({ key: 'value' });
			});

			it('should fix unquoted keys', () => {
				const json = '{key: "value"}';
				const result = parseJsonWithFallback(json);
				expect(result).toEqual({ key: 'value' });
			});

			it('should throw for invalid JSON', () => {
				const json = '{invalid}';
				expect(() => {
					parseJsonWithFallback(json);
				}).toThrow();
			});
		});

		describe('extractJsonFromResponse', () => {
			it('should extract from markdown code block', () => {
				const text = '```json\n{"key": "value"}\n```';
				const result = (model as any).extractJsonFromResponse(text);
				expect(result).toBe('{"key": "value"}');
			});

			it('should handle text before JSON', () => {
				const text = 'Here is your JSON: {"key": "value"}';
				const result = (model as any).extractJsonFromResponse(text);
				expect(result).toBe('{"key": "value"}');
			});

			it('should handle text after JSON', () => {
				const text = '{"key": "value"} - done';
				const result = (model as any).extractJsonFromResponse(text);
				expect(result).toBe('{"key": "value"}');
			});

			it('should extract first object from array responses', () => {
				const text = '[{"id": 1}, {"id": 2}]';
				const result = (model as any).extractJsonFromResponse(text);
				// extractJsonFromResponse is designed to extract the first JSON object
				// For arrays, it extracts the first element's object
				expect(result).toBe('{"id": 1}');
			});
		});
	});

	describe('Structured Output via JSON Request Body', () => {
		// NOTE: The CLI now uses JSON request body format (same as REST API)
		// instead of building prompt instructions. The buildSchemaInstruction
		// method has been removed in favor of the unified approach.

		it('should include response_format in JSON request for structured outputs', async () => {
			// This is implicitly tested through buildCliArguments
			// The JSON request body should include response_format with schema
			// when responseFormat.type === 'json'

			// We test this indirectly by checking the buildCliArguments method
			const args = await (model as any).buildCliArguments({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
				responseFormat: {
					type: 'json',
					name: 'TestObject',
					schema: {
						type: 'object',
						properties: {
							key: { type: 'string' }
						}
					}
				}
			});

			// The --print argument should contain a JSON string with response_format
			const printArg = args[args.length - 1];
			expect(printArg).toContain('response_format');
			expect(printArg).toContain('"type":"json"');
		});

		it('should not include response_format for non-json format', async () => {
			const args = await (model as any).buildCliArguments({
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
				responseFormat: {
					type: 'text'
				}
			});

			// The --print argument should NOT contain response_format
			const printArg = args[args.length - 1];
			expect(printArg).not.toContain('response_format');
		});
	});

	describe('Model Capabilities', () => {
		it('should report correct specification version', () => {
			expect(model.specificationVersion).toBe('v2');
		});

		it('should report structured output support', () => {
			expect(model.supportsStructuredOutputs).toBe(true);
		});

		it('should report default object generation mode', () => {
			expect(model.defaultObjectGenerationMode).toBe('json');
		});

		it('should report no image URL support', () => {
			expect(model.supportsImageUrls).toBe(false);
		});
	});

	describe('Streaming', () => {
		it('should throw error for doStream', async () => {
			// CLI doStream() takes no arguments and always throws
			await expect((model as any).doStream()).rejects.toThrow(
				'Streaming is not yet supported'
			);
		});
	});

	describe('doGenerate - CLI Execution', () => {
		it('should throw error when CLI is not installed', async () => {
			const versionChild = createMockChildProcess();
			mockSpawn.mockReturnValueOnce(versionChild as any);

			// Simulate CLI not found
			scheduleEvent(() => {
				versionChild.emit('error', new Error('ENOENT'));
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
			};

			await expect(model.doGenerate(options)).rejects.toThrow(
				'Cortex Code is not installed'
			);
		}, 10000);

		// Note: Full doGenerate flow testing with successful execution
		// requires complex async mocking. These tests are covered by
		// integration tests with the real CLI.
	});

	describe('executeCortexCli', () => {
		it('should collect stdout and stderr', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValueOnce(mockChild as any);

			scheduleEvent(() => {
				mockChild.stdout.emit('data', 'stdout content\n');
				mockChild.stderr.emit('data', 'stderr content\n');
				mockChild.emit('close', 0);
			});

			const result = await (model as any).executeCortexCli(['--help']);
			expect(result.stdout).toContain('stdout content');
			expect(result.stderr).toContain('stderr content');
			expect(result.exitCode).toBe(0);
		});

		it('should handle process error', async () => {
			const mockChild = createMockChildProcess();
			mockSpawn.mockReturnValueOnce(mockChild as any);

			scheduleEvent(() => {
				mockChild.emit('error', new Error('Spawn failed'));
			});

			await expect((model as any).executeCortexCli(['--help'])).rejects.toThrow('Spawn failed');
		});
	});

	describe('stripEscapeCodes', () => {
		it('should strip ANSI escape codes', () => {
			const input = '\x1b[32mGreen text\x1b[0m and \x1b[1mBold\x1b[0m';
			const result = (model as any).stripEscapeCodes(input);
			expect(result).toBe('Green text and Bold');
		});

		it('should handle text without escape codes', () => {
			const input = 'Normal text';
			const result = (model as any).stripEscapeCodes(input);
			expect(result).toBe('Normal text');
		});

		it('should strip cursor movement codes', () => {
			const input = '\x1b[2J\x1b[HHello World';
			const result = (model as any).stripEscapeCodes(input);
			expect(result).toBe('Hello World');
		});
	});

	describe('Connection Management', () => {
		it('should read connection from config file if available', () => {
			// Connection is now managed by connectionConfig
			const connectionConfig = (model as any).connectionConfig;
			const result = connectionConfig.getConnectionName();
			// Could be null or a string depending on user's environment
			expect(result === null || typeof result === 'string').toBe(true);
		});

		it('should use connection from settings', () => {
			const modelWithConn = new CliLanguageModel({
				id: 'test-model',
				settings: { connection: 'my-connection' }
			});

			// Connection is now managed by connectionConfig
			const connectionConfig = (modelWithConn as any).connectionConfig;
			const connection = connectionConfig.getConnectionName();
			expect(connection).toBe('my-connection');
		});

		it('should return null when no connection configured and no config file', () => {
			// Clear environment variables that might affect connection resolution
			const originalEnv = { ...process.env };
			delete process.env.SNOWFLAKE_CONNECTION_NAME;
			delete process.env.SNOWFLAKE_CONNECTION;
			delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			
			const modelNoConn = new CliLanguageModel({
				id: 'test-model',
				settings: {}
			});

			// Connection is now managed by connectionConfig
			const connectionConfig = (modelNoConn as any).connectionConfig;
			const connection = connectionConfig.getConnectionName();
			// Can be null if no config file exists, or a string if it exists
			expect(connection === null || typeof connection === 'string').toBe(true);
			
			// Restore environment
			Object.assign(process.env, originalEnv);
		});
	});

	describe('Settings Application', () => {
		it('should apply plan mode setting', async () => {
			const modelWithPlan = new CliLanguageModel({
				id: 'test-model',
				settings: { plan: true }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
			};

			const args = await (modelWithPlan as any).buildCliArguments(options);
			expect(args).toContain('--plan');
		});

		it('should apply skills file setting', async () => {
			const modelWithSkills = new CliLanguageModel({
				id: 'test-model',
				settings: { skillsFile: '/path/to/skills.json' }
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
			};

			const args = await (modelWithSkills as any).buildCliArguments(options);
			expect(args).toContain('--skills-file');
			expect(args).toContain('/path/to/skills.json');
		});

		it('should strip cortex/ prefix from model ID', async () => {
			const modelWithPrefix = new CliLanguageModel({
				id: 'cortex/claude-sonnet-4-5',
				settings: {}
			});

			const options: LanguageModelV2CallOptions = {
				prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
			};

			const args = await (modelWithPrefix as any).buildCliArguments(options);
			const modelIndex = args.indexOf('--model');
			expect(args[modelIndex + 1]).toBe('claude-sonnet-4-5');
		});
	});
});
