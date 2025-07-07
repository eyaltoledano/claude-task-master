/**
 * @fileoverview AST-Claude Integration Test Suite
 * Tests the core integration between AST system components and Claude Code services
 *
 * Phase 3.1: AST-Claude Integration Testing
 * @author Claude (Task Master Flow Testing)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock implementations for AST and Claude components
const mockLanguageDetector = {
	detectLanguage: jest.fn(),
	getSupportedLanguages: jest.fn(() => [
		'javascript',
		'python',
		'go',
		'typescript'
	])
};

const mockASTParser = {
	parseFile: jest.fn(),
	generateAST: jest.fn(),
	validateAST: jest.fn()
};

const mockCacheManager = {
	get: jest.fn(),
	set: jest.fn(),
	invalidate: jest.fn(),
	clear: jest.fn(),
	getStats: jest.fn(() => ({ hits: 0, misses: 0, size: 0 }))
};

const mockContextBuilder = {
	buildContext: jest.fn(),
	formatForClaude: jest.fn(),
	calculateRelevance: jest.fn()
};

const mockBackgroundService = new EventEmitter();
Object.assign(mockBackgroundService, {
	startSession: jest.fn(),
	endSession: jest.fn(),
	processQueue: jest.fn(),
	getStatus: jest.fn(() => 'running')
});

const mockHookExecutor = {
	executeHook: jest.fn(),
	registerHook: jest.fn(),
	validateHook: jest.fn()
};

describe('AST-Claude Integration Suite', () => {
	let integrationManager;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Setup integration manager mock
		integrationManager = {
			astComponents: {
				languageDetector: mockLanguageDetector,
				parser: mockASTParser,
				cacheManager: mockCacheManager,
				contextBuilder: mockContextBuilder
			},
			claudeComponents: {
				backgroundService: mockBackgroundService,
				hookExecutor: mockHookExecutor
			},
			state: {
				activeSessions: new Map(),
				processedFiles: new Set(),
				contextCache: new Map()
			}
		};

		// Setup default mock implementations
		mockLanguageDetector.detectLanguage.mockResolvedValue('javascript');
		mockASTParser.parseFile.mockResolvedValue({
			type: 'Program',
			body: [],
			metadata: { lineCount: 10, complexity: 3 }
		});
		mockCacheManager.get.mockResolvedValue(null);
		mockCacheManager.set.mockResolvedValue(true);
		mockContextBuilder.buildContext.mockResolvedValue({
			files: [],
			totalLines: 0,
			relevanceScore: 0.8
		});
		mockContextBuilder.formatForClaude.mockResolvedValue({
			formattedContext: 'Test context',
			tokenCount: 100
		});
		mockBackgroundService.startSession.mockResolvedValue('session-123');
		mockHookExecutor.executeHook.mockResolvedValue({ success: true });
	});

	describe('Core AST-Claude Data Flow', () => {
		test('should successfully process file through complete AST-Claude pipeline', async () => {
			const testFile = '/test/sample.js';
			const sessionId = 'session-123';

			// Simulate complete pipeline
			const result = await processFileThroughPipeline(testFile, sessionId);

			expect(result).toMatchObject({
				success: true,
				sessionId,
				astData: expect.any(Object),
				contextData: expect.any(Object),
				cached: false
			});

			// Verify AST processing
			expect(mockLanguageDetector.detectLanguage).toHaveBeenCalledWith(
				testFile
			);
			expect(mockASTParser.parseFile).toHaveBeenCalledWith(
				testFile,
				'javascript'
			);

			// Verify Claude integration
			expect(mockBackgroundService.startSession).toHaveBeenCalled();
			expect(mockContextBuilder.formatForClaude).toHaveBeenCalled();
		});

		test('should handle cached AST data efficiently', async () => {
			const testFile = '/test/cached.js';
			const cachedAST = {
				type: 'Program',
				body: [{ type: 'ExpressionStatement' }],
				metadata: { cached: true }
			};

			mockCacheManager.get.mockResolvedValueOnce(cachedAST);

			const result = await processFileThroughPipeline(testFile, 'session-456');

			expect(result.cached).toBe(true);
			expect(mockASTParser.parseFile).not.toHaveBeenCalled();
			expect(mockCacheManager.get).toHaveBeenCalledWith(
				expect.stringContaining(testFile)
			);
		});

		test('should propagate errors correctly through pipeline', async () => {
			const testFile = '/test/error.js';
			const error = new Error('AST parsing failed');

			mockASTParser.parseFile.mockRejectedValueOnce(error);

			await expect(
				processFileThroughPipeline(testFile, 'session-error')
			).rejects.toThrow('AST parsing failed');

			expect(mockContextBuilder.buildContext).not.toHaveBeenCalled();
		});

		test('should handle multiple file processing concurrently', async () => {
			const testFiles = ['/test/file1.js', '/test/file2.py', '/test/file3.go'];

			mockLanguageDetector.detectLanguage
				.mockResolvedValueOnce('javascript')
				.mockResolvedValueOnce('python')
				.mockResolvedValueOnce('go');

			const promises = testFiles.map((file, index) =>
				processFileThroughPipeline(file, `session-${index}`)
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(3);
			expect(results.every((r) => r.success)).toBe(true);
			expect(mockLanguageDetector.detectLanguage).toHaveBeenCalledTimes(3);
			expect(mockASTParser.parseFile).toHaveBeenCalledTimes(3);
		});
	});

	describe('Session Management Integration', () => {
		test('should create and manage Claude session with AST context', async () => {
			const sessionConfig = {
				projectPath: '/test/project',
				files: ['/test/file1.js', '/test/file2.js'],
				taskContext: 'Implement user authentication'
			};

			const session = await createClaudeSessionWithAST(sessionConfig);

			expect(session).toMatchObject({
				id: expect.any(String),
				astContext: expect.any(Object),
				claudeSession: expect.any(String),
				status: 'active'
			});

			expect(mockBackgroundService.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					context: expect.any(Object)
				})
			);
		});

		test('should handle session cleanup on completion', async () => {
			const sessionId = 'session-cleanup-test';
			integrationManager.state.activeSessions.set(sessionId, {
				astData: {},
				startTime: Date.now()
			});

			await cleanupSession(sessionId);

			expect(integrationManager.state.activeSessions.has(sessionId)).toBe(
				false
			);
			expect(mockBackgroundService.endSession).toHaveBeenCalledWith(sessionId);
		});

		test('should handle session timeout gracefully', async () => {
			const sessionId = 'session-timeout';
			const sessionData = {
				astData: {},
				startTime: Date.now() - 30000, // 30 seconds ago
				timeout: 20000 // 20 second timeout
			};

			integrationManager.state.activeSessions.set(sessionId, sessionData);

			const result = await checkSessionTimeout(sessionId);

			expect(result.timedOut).toBe(true);
			expect(mockBackgroundService.endSession).toHaveBeenCalled();
		});

		test('should provide session status and metrics', async () => {
			const sessionId = 'session-metrics';
			integrationManager.state.activeSessions.set(sessionId, {
				astData: { fileCount: 5, totalLines: 500 },
				startTime: Date.now() - 5000,
				processedFiles: 3
			});

			const metrics = await getSessionMetrics(sessionId);

			expect(metrics).toMatchObject({
				sessionId,
				duration: expect.any(Number),
				filesProcessed: 3,
				totalFiles: 5,
				linesProcessed: 500,
				status: 'active'
			});
		});
	});

	describe('AST Context Building for Claude', () => {
		test('should build comprehensive context for Claude consumption', async () => {
			const files = [
				{ path: '/test/component.js', relevance: 0.9 },
				{ path: '/test/utils.js', relevance: 0.7 },
				{ path: '/test/config.js', relevance: 0.5 }
			];

			mockContextBuilder.buildContext.mockResolvedValueOnce({
				files: files.map((f) => ({ ...f, ast: {} })),
				totalLines: 300,
				relevanceScore: 0.8,
				complexity: { average: 4, max: 8 }
			});

			const context = await buildClaudeContext(files, 'Implement new feature');

			expect(context).toMatchObject({
				taskDescription: 'Implement new feature',
				relevantFiles: expect.arrayContaining([
					expect.objectContaining({ relevance: expect.any(Number) })
				]),
				projectMetrics: expect.objectContaining({
					totalLines: 300,
					complexity: expect.any(Object)
				}),
				claudeFormatted: expect.any(Object)
			});

			expect(mockContextBuilder.formatForClaude).toHaveBeenCalledWith(
				expect.objectContaining({
					files: expect.any(Array),
					task: 'Implement new feature'
				})
			);
		});

		test('should optimize context for Claude token limits', async () => {
			const largeContext = {
				files: new Array(50).fill(null).map((_, i) => ({
					path: `/test/file${i}.js`,
					content: 'a'.repeat(1000), // Large content
					relevance: Math.random()
				}))
			};

			mockContextBuilder.formatForClaude.mockImplementationOnce(
				async (context) => {
					// Simulate token optimization
					const optimized = {
						formattedContext: context.files.slice(0, 10), // Limit files
						tokenCount: 8000, // Under typical limits
						optimizations: ['file-limit', 'content-truncation']
					};
					return optimized;
				}
			);

			const result = await buildClaudeContext(
				largeContext.files,
				'Large project task'
			);

			expect(result.claudeFormatted.tokenCount).toBeLessThan(10000);
			expect(result.claudeFormatted.optimizations).toContain('file-limit');
		});

		test('should include relevant AST metadata in context', async () => {
			const testFile = '/test/complex.js';
			const astWithMetadata = {
				type: 'Program',
				body: [],
				metadata: {
					functions: ['getUserData', 'processData'],
					classes: ['UserManager'],
					imports: ['axios', 'lodash'],
					complexity: 6,
					testCoverage: 85
				}
			};

			mockASTParser.parseFile.mockResolvedValueOnce(astWithMetadata);

			const context = await buildFileContext(testFile);

			expect(context.metadata).toMatchObject({
				functions: expect.arrayContaining(['getUserData', 'processData']),
				classes: expect.arrayContaining(['UserManager']),
				imports: expect.arrayContaining(['axios', 'lodash']),
				complexity: 6
			});
		});
	});

	describe('Hook Integration with AST Processing', () => {
		test('should execute pre-processing hooks correctly', async () => {
			const hookConfig = {
				name: 'pre-ast-processing',
				timing: 'before',
				target: 'ast-parsing'
			};

			await executeASTProcessingWithHooks('/test/file.js', [hookConfig]);

			expect(mockHookExecutor.executeHook).toHaveBeenCalledWith(
				'pre-ast-processing',
				expect.objectContaining({
					filePath: '/test/file.js',
					stage: 'before-parsing'
				})
			);
		});

		test('should execute post-processing hooks with AST data', async () => {
			const astData = {
				type: 'Program',
				body: [],
				metadata: { lineCount: 20 }
			};

			mockASTParser.parseFile.mockResolvedValueOnce(astData);

			const hookConfig = {
				name: 'post-ast-processing',
				timing: 'after',
				target: 'ast-parsing'
			};

			await executeASTProcessingWithHooks('/test/file.js', [hookConfig]);

			expect(mockHookExecutor.executeHook).toHaveBeenCalledWith(
				'post-ast-processing',
				expect.objectContaining({
					filePath: '/test/file.js',
					astData,
					stage: 'after-parsing'
				})
			);
		});

		test('should handle hook failures gracefully', async () => {
			const error = new Error('Hook execution failed');
			mockHookExecutor.executeHook.mockRejectedValueOnce(error);

			const hookConfig = {
				name: 'failing-hook',
				timing: 'before',
				target: 'ast-parsing',
				required: false
			};

			// Should not throw for non-required hooks
			const result = await executeASTProcessingWithHooks('/test/file.js', [
				hookConfig
			]);

			expect(result.success).toBe(true);
			expect(result.hookErrors).toHaveLength(1);
			expect(mockASTParser.parseFile).toHaveBeenCalled();
		});

		test('should abort processing for required hook failures', async () => {
			const error = new Error('Critical hook failed');
			mockHookExecutor.executeHook.mockRejectedValueOnce(error);

			const hookConfig = {
				name: 'critical-hook',
				timing: 'before',
				target: 'ast-parsing',
				required: true
			};

			await expect(
				executeASTProcessingWithHooks('/test/file.js', [hookConfig])
			).rejects.toThrow('Critical hook failed');

			expect(mockASTParser.parseFile).not.toHaveBeenCalled();
		});
	});

	describe('Error Handling and Recovery', () => {
		test('should handle AST parsing errors gracefully', async () => {
			const syntaxError = new Error('Syntax error at line 10');
			syntaxError.code = 'SYNTAX_ERROR';
			syntaxError.line = 10;
			syntaxError.column = 5;

			mockASTParser.parseFile.mockRejectedValueOnce(syntaxError);

			const result = await processFileWithErrorHandling('/test/invalid.js');

			expect(result).toMatchObject({
				success: false,
				error: expect.objectContaining({
					code: 'SYNTAX_ERROR',
					line: 10,
					column: 5
				}),
				fallbackProcessing: true
			});
		});

		test('should implement retry logic for transient failures', async () => {
			mockASTParser.parseFile
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockRejectedValueOnce(new Error('Network timeout'))
				.mockResolvedValueOnce({ type: 'Program', body: [] });

			const result = await processFileWithRetry('/test/network-issue.js', {
				maxRetries: 3
			});

			expect(result.success).toBe(true);
			expect(result.attempts).toBe(3);
			expect(mockASTParser.parseFile).toHaveBeenCalledTimes(3);
		});

		test('should recover from cache corruption', async () => {
			const corruptData = 'invalid-json-data';
			mockCacheManager.get.mockResolvedValueOnce(corruptData);

			const result = await processFileWithCacheRecovery(
				'/test/cached-corrupt.js'
			);

			expect(result.success).toBe(true);
			expect(result.cacheRecovered).toBe(true);
			expect(mockASTParser.parseFile).toHaveBeenCalled(); // Fallback to parsing
		});

		test('should handle Claude service unavailability', async () => {
			mockBackgroundService.startSession.mockRejectedValueOnce(
				new Error('Claude service unavailable')
			);

			const result = await processFileWithServiceFallback(
				'/test/service-down.js'
			);

			expect(result).toMatchObject({
				success: true,
				astProcessed: true,
				claudeProcessed: false,
				fallbackMode: true
			});
		});
	});

	describe('Performance and Load Testing', () => {
		test('should handle high-volume file processing efficiently', async () => {
			const startTime = Date.now();
			const fileCount = 100;
			const files = Array.from(
				{ length: fileCount },
				(_, i) => `/test/file${i}.js`
			);

			// Mock fast processing
			mockASTParser.parseFile.mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
				return { type: 'Program', body: [] };
			});

			const results = await Promise.all(
				files.map((file) => processFileThroughPipeline(file, `session-${file}`))
			);

			const duration = Date.now() - startTime;

			expect(results.every((r) => r.success)).toBe(true);
			expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
			expect(mockASTParser.parseFile).toHaveBeenCalledTimes(fileCount);
		});

		test('should manage memory usage during large context building', async () => {
			const largeFiles = Array.from({ length: 50 }, (_, i) => ({
				path: `/test/large${i}.js`,
				content: 'x'.repeat(10000), // 10KB per file
				ast: { type: 'Program', body: new Array(100).fill({}) }
			}));

			const memBefore = process.memoryUsage().heapUsed;

			const context = await buildLargeProjectContext(largeFiles);

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			expect(context.files).toHaveLength(largeFiles.length);
			expect(memIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
		});

		test('should throttle concurrent AST processing', async () => {
			const concurrentLimit = 5;
			const totalFiles = 20;
			const files = Array.from(
				{ length: totalFiles },
				(_, i) => `/test/concurrent${i}.js`
			);

			let concurrentCount = 0;
			let maxConcurrent = 0;

			mockASTParser.parseFile.mockImplementation(async () => {
				concurrentCount++;
				maxConcurrent = Math.max(maxConcurrent, concurrentCount);

				await new Promise((resolve) => setTimeout(resolve, 100));

				concurrentCount--;
				return { type: 'Program', body: [] };
			});

			await processFilesWithThrottling(files, concurrentLimit);

			expect(maxConcurrent).toBeLessThanOrEqual(concurrentLimit);
			expect(mockASTParser.parseFile).toHaveBeenCalledTimes(totalFiles);
		});
	});

	// Helper functions for testing
	async function processFileThroughPipeline(filePath, sessionId) {
		try {
			// Step 1: Language detection
			const language =
				await integrationManager.astComponents.languageDetector.detectLanguage(
					filePath
				);

			// Step 2: Check cache
			const cacheKey = `ast:${filePath}:${language}`;
			let astData =
				await integrationManager.astComponents.cacheManager.get(cacheKey);
			let cached = false;

			if (!astData) {
				// Step 3: Parse AST
				astData = await integrationManager.astComponents.parser.parseFile(
					filePath,
					language
				);
				await integrationManager.astComponents.cacheManager.set(
					cacheKey,
					astData
				);
			} else {
				cached = true;
			}

			// Step 4: Build context
			const contextData =
				await integrationManager.astComponents.contextBuilder.buildContext([
					{
						path: filePath,
						ast: astData,
						language
					}
				]);

			// Step 5: Start Claude session if needed
			if (!integrationManager.state.activeSessions.has(sessionId)) {
				const claudeSession =
					await integrationManager.claudeComponents.backgroundService.startSession(
						{
							id: sessionId,
							context: contextData
						}
					);
				integrationManager.state.activeSessions.set(sessionId, claudeSession);
			}

			return {
				success: true,
				sessionId,
				astData,
				contextData,
				cached,
				language
			};
		} catch (error) {
			throw error;
		}
	}

	async function createClaudeSessionWithAST(config) {
		const astContexts = [];

		for (const file of config.files) {
			const result = await processFileThroughPipeline(
				file,
				`temp-${Date.now()}`
			);
			astContexts.push(result);
		}

		const combinedContext =
			await integrationManager.astComponents.contextBuilder.buildContext(
				astContexts.map((ctx) => ({
					path: ctx.astData.path || 'unknown',
					ast: ctx.astData,
					language: ctx.language
				}))
			);

		const claudeSession =
			await integrationManager.claudeComponents.backgroundService.startSession({
				context: combinedContext,
				task: config.taskContext
			});

		const sessionId = `session-${Date.now()}`;
		integrationManager.state.activeSessions.set(sessionId, {
			astContext: combinedContext,
			claudeSession,
			startTime: Date.now()
		});

		return {
			id: sessionId,
			astContext: combinedContext,
			claudeSession,
			status: 'active'
		};
	}

	async function cleanupSession(sessionId) {
		const session = integrationManager.state.activeSessions.get(sessionId);
		if (session) {
			await integrationManager.claudeComponents.backgroundService.endSession(
				sessionId
			);
			integrationManager.state.activeSessions.delete(sessionId);
		}
	}

	async function checkSessionTimeout(sessionId) {
		const session = integrationManager.state.activeSessions.get(sessionId);
		if (!session) {
			return { timedOut: false, notFound: true };
		}

		const elapsed = Date.now() - session.startTime;
		const timedOut = elapsed > session.timeout;

		if (timedOut) {
			await cleanupSession(sessionId);
		}

		return { timedOut, elapsed };
	}

	async function getSessionMetrics(sessionId) {
		const session = integrationManager.state.activeSessions.get(sessionId);
		if (!session) {
			throw new Error('Session not found');
		}

		return {
			sessionId,
			duration: Date.now() - session.startTime,
			filesProcessed: session.processedFiles || 0,
			totalFiles: session.astData?.fileCount || 0,
			linesProcessed: session.astData?.totalLines || 0,
			status: 'active'
		};
	}

	async function buildClaudeContext(files, taskDescription) {
		const contextData =
			await integrationManager.astComponents.contextBuilder.buildContext(files);
		const claudeFormatted =
			await integrationManager.astComponents.contextBuilder.formatForClaude({
				files: contextData.files,
				task: taskDescription
			});

		return {
			taskDescription,
			relevantFiles: contextData.files,
			projectMetrics: {
				totalLines: contextData.totalLines,
				complexity: contextData.complexity
			},
			claudeFormatted
		};
	}

	async function buildFileContext(filePath) {
		const result = await processFileThroughPipeline(
			filePath,
			'context-session'
		);
		return {
			path: filePath,
			ast: result.astData,
			metadata: result.astData.metadata,
			language: result.language
		};
	}

	async function executeASTProcessingWithHooks(filePath, hooks) {
		const result = { success: true, hookErrors: [] };

		// Execute pre-processing hooks
		for (const hook of hooks.filter((h) => h.timing === 'before')) {
			try {
				await integrationManager.claudeComponents.hookExecutor.executeHook(
					hook.name,
					{
						filePath,
						stage: 'before-parsing'
					}
				);
			} catch (error) {
				if (hook.required) {
					throw error;
				}
				result.hookErrors.push(error);
			}
		}

		// Process AST
		const astData = await integrationManager.astComponents.parser.parseFile(
			filePath,
			'javascript'
		);

		// Execute post-processing hooks
		for (const hook of hooks.filter((h) => h.timing === 'after')) {
			try {
				await integrationManager.claudeComponents.hookExecutor.executeHook(
					hook.name,
					{
						filePath,
						astData,
						stage: 'after-parsing'
					}
				);
			} catch (error) {
				if (hook.required) {
					throw error;
				}
				result.hookErrors.push(error);
			}
		}

		result.astData = astData;
		return result;
	}

	async function processFileWithErrorHandling(filePath) {
		try {
			const result = await processFileThroughPipeline(
				filePath,
				'error-session'
			);
			return { success: true, ...result };
		} catch (error) {
			return {
				success: false,
				error: {
					message: error.message,
					code: error.code,
					line: error.line,
					column: error.column
				},
				fallbackProcessing: true
			};
		}
	}

	async function processFileWithRetry(filePath, options = {}) {
		const { maxRetries = 3, delay = 100 } = options;
		let attempts = 0;

		while (attempts < maxRetries) {
			attempts++;
			try {
				const result = await processFileThroughPipeline(
					filePath,
					`retry-session-${attempts}`
				);
				return { success: true, attempts, ...result };
			} catch (error) {
				if (attempts === maxRetries) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, delay * attempts));
			}
		}
	}

	async function processFileWithCacheRecovery(filePath) {
		try {
			const result = await processFileThroughPipeline(
				filePath,
				'cache-recovery-session'
			);
			return { success: true, cacheRecovered: false, ...result };
		} catch (error) {
			if (error.message.includes('cache')) {
				// Clear corrupted cache and retry
				await integrationManager.astComponents.cacheManager.clear();
				const result = await processFileThroughPipeline(
					filePath,
					'cache-recovery-retry'
				);
				return { success: true, cacheRecovered: true, ...result };
			}
			throw error;
		}
	}

	async function processFileWithServiceFallback(filePath) {
		try {
			const result = await processFileThroughPipeline(
				filePath,
				'service-fallback-session'
			);
			return {
				success: true,
				astProcessed: true,
				claudeProcessed: true,
				fallbackMode: false,
				...result
			};
		} catch (error) {
			if (error.message.includes('service unavailable')) {
				// Process AST only, skip Claude integration
				const astData = await integrationManager.astComponents.parser.parseFile(
					filePath,
					'javascript'
				);
				return {
					success: true,
					astProcessed: true,
					claudeProcessed: false,
					fallbackMode: true,
					astData
				};
			}
			throw error;
		}
	}

	async function buildLargeProjectContext(files) {
		// Simulate memory-efficient processing
		const processedFiles = [];

		for (const file of files) {
			// Process in chunks to manage memory
			const processed = {
				path: file.path,
				summary: {
					lineCount: file.content.length / 50, // Approximate
					complexity: Math.floor(Math.random() * 10)
				}
			};
			processedFiles.push(processed);

			// Simulate garbage collection
			if (processedFiles.length % 10 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}

		return {
			files: processedFiles,
			totalFiles: files.length,
			memoryOptimized: true
		};
	}

	async function processFilesWithThrottling(files, concurrentLimit) {
		const results = [];
		const queue = [...files];
		const active = new Set();

		while (queue.length > 0 || active.size > 0) {
			// Start new tasks up to the limit
			while (active.size < concurrentLimit && queue.length > 0) {
				const file = queue.shift();
				const promise = integrationManager.astComponents.parser
					.parseFile(file, 'javascript')
					.then((result) => {
						active.delete(promise);
						return { file, result };
					})
					.catch((error) => {
						active.delete(promise);
						return { file, error };
					});

				active.add(promise);
			}

			// Wait for at least one to complete
			if (active.size > 0) {
				const completed = await Promise.race(active);
				results.push(completed);
			}
		}

		return results;
	}
});
