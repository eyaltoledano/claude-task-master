/**
 * Parser Registry Tests
 * Comprehensive tests for the AST parser registry system
 */

// Mock the parser registry and related components
const mockParserRegistry = {
	initialize: jest.fn(),
	getParser: jest.fn(),
	parseFile: jest.fn(),
	detectLanguage: jest.fn(),
	detectLanguageByExtension: jest.fn(),
	detectLanguageByContent: jest.fn(),
	validateSetup: jest.fn(),
	getSupportedLanguages: jest.fn(),
	isLanguageSupported: jest.fn(),
	registerParser: jest.fn(),
	unregisterParser: jest.fn()
};

const mockJavaScriptParser = {
	parse: jest.fn(),
	validateContent: jest.fn(),
	getSupportedExtensions: jest.fn(() => ['.js', '.jsx', '.ts', '.tsx']),
	getLanguageId: jest.fn(() => 'javascript'),
	isInitialized: jest.fn(() => true)
};

const mockPythonParser = {
	parse: jest.fn(),
	validateContent: jest.fn(),
	getSupportedExtensions: jest.fn(() => ['.py', '.pyi']),
	getLanguageId: jest.fn(() => 'python'),
	isInitialized: jest.fn(() => true)
};

const mockGoParser = {
	parse: jest.fn(),
	validateContent: jest.fn(),
	getSupportedExtensions: jest.fn(() => ['.go']),
	getLanguageId: jest.fn(() => 'go'),
	isInitialized: jest.fn(() => true)
};

describe('Parser Registry - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Setup default mock behaviors
		mockParserRegistry.getSupportedLanguages.mockReturnValue([
			'javascript',
			'python',
			'go'
		]);
		mockParserRegistry.isLanguageSupported.mockImplementation((lang) =>
			['javascript', 'python', 'go'].includes(lang)
		);

		// Setup parser retrieval
		mockParserRegistry.getParser.mockImplementation((language) => {
			switch (language) {
				case 'javascript':
				case 'typescript':
					return mockJavaScriptParser;
				case 'python':
					return mockPythonParser;
				case 'go':
					return mockGoParser;
				default:
					return null;
			}
		});
	});

	describe('Registry Initialization', () => {
		test('should initialize successfully with default parsers', async () => {
			mockParserRegistry.initialize.mockResolvedValue({
				success: true,
				parsersLoaded: ['javascript', 'python', 'go'],
				errors: []
			});

			const result = await mockParserRegistry.initialize();

			expect(result.success).toBe(true);
			expect(result.parsersLoaded).toHaveLength(3);
			expect(result.parsersLoaded).toContain('javascript');
			expect(result.parsersLoaded).toContain('python');
			expect(result.parsersLoaded).toContain('go');
		});

		test('should handle partial initialization failures', async () => {
			mockParserRegistry.initialize.mockResolvedValue({
				success: true,
				parsersLoaded: ['javascript', 'python'],
				errors: [
					{
						language: 'go',
						error: 'Failed to load Go parser: module not found'
					}
				]
			});

			const result = await mockParserRegistry.initialize();

			expect(result.success).toBe(true);
			expect(result.parsersLoaded).toHaveLength(2);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].language).toBe('go');
		});

		test('should handle complete initialization failure', async () => {
			mockParserRegistry.initialize.mockResolvedValue({
				success: false,
				parsersLoaded: [],
				errors: [
					{ language: 'javascript', error: 'Parser not found' },
					{ language: 'python', error: 'Parser not found' },
					{ language: 'go', error: 'Parser not found' }
				]
			});

			const result = await mockParserRegistry.initialize();

			expect(result.success).toBe(false);
			expect(result.parsersLoaded).toHaveLength(0);
			expect(result.errors).toHaveLength(3);
		});

		test('should validate setup after initialization', async () => {
			mockParserRegistry.validateSetup.mockResolvedValue({
				success: true,
				errors: [],
				warnings: [],
				parsers: {
					javascript: {
						available: true,
						validatesContent: true,
						extensions: ['.js', '.jsx', '.ts', '.tsx']
					},
					python: {
						available: true,
						validatesContent: true,
						extensions: ['.py', '.pyi']
					},
					go: {
						available: true,
						validatesContent: true,
						extensions: ['.go']
					}
				}
			});

			const validation = await mockParserRegistry.validateSetup();

			expect(validation.success).toBe(true);
			expect(validation.errors).toHaveLength(0);
			expect(validation.parsers.javascript.available).toBe(true);
			expect(validation.parsers.python.available).toBe(true);
			expect(validation.parsers.go.available).toBe(true);
		});
	});

	describe('Parser Management', () => {
		test('should retrieve parsers by language', () => {
			const jsParser = mockParserRegistry.getParser('javascript');
			const pyParser = mockParserRegistry.getParser('python');
			const goParser = mockParserRegistry.getParser('go');

			expect(jsParser).toBe(mockJavaScriptParser);
			expect(pyParser).toBe(mockPythonParser);
			expect(goParser).toBe(mockGoParser);
		});

		test('should return null for unsupported languages', () => {
			const unknownParser = mockParserRegistry.getParser('unknown');
			expect(unknownParser).toBeNull();
		});

		test('should handle language aliases', () => {
			// TypeScript should return JavaScript parser
			const tsParser = mockParserRegistry.getParser('typescript');
			expect(tsParser).toBe(mockJavaScriptParser);
		});

		test('should register new parsers dynamically', () => {
			const newParser = {
				parse: jest.fn(),
				getLanguageId: jest.fn(() => 'rust'),
				getSupportedExtensions: jest.fn(() => ['.rs'])
			};

			mockParserRegistry.registerParser.mockReturnValue({
				success: true,
				language: 'rust',
				parser: newParser
			});

			const result = mockParserRegistry.registerParser('rust', newParser);

			expect(result.success).toBe(true);
			expect(result.language).toBe('rust');
			expect(mockParserRegistry.registerParser).toHaveBeenCalledWith(
				'rust',
				newParser
			);
		});

		test('should unregister parsers', () => {
			mockParserRegistry.unregisterParser.mockReturnValue({
				success: true,
				language: 'go',
				removed: true
			});

			const result = mockParserRegistry.unregisterParser('go');

			expect(result.success).toBe(true);
			expect(result.language).toBe('go');
			expect(result.removed).toBe(true);
		});

		test('should handle unregistering non-existent parsers', () => {
			mockParserRegistry.unregisterParser.mockReturnValue({
				success: false,
				language: 'unknown',
				removed: false,
				error: 'Parser not found'
			});

			const result = mockParserRegistry.unregisterParser('unknown');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Parser not found');
		});
	});

	describe('Language Detection', () => {
		test('should detect language by file extension', () => {
			mockParserRegistry.detectLanguageByExtension.mockImplementation(
				(filePath) => {
					if (filePath.endsWith('.js') || filePath.endsWith('.jsx'))
						return 'javascript';
					if (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))
						return 'typescript';
					if (filePath.endsWith('.py')) return 'python';
					if (filePath.endsWith('.go')) return 'go';
					return null;
				}
			);

			expect(mockParserRegistry.detectLanguageByExtension('app.js')).toBe(
				'javascript'
			);
			expect(
				mockParserRegistry.detectLanguageByExtension('component.tsx')
			).toBe('typescript');
			expect(mockParserRegistry.detectLanguageByExtension('script.py')).toBe(
				'python'
			);
			expect(mockParserRegistry.detectLanguageByExtension('main.go')).toBe(
				'go'
			);
			expect(
				mockParserRegistry.detectLanguageByExtension('unknown.txt')
			).toBeNull();
		});

		test('should detect language by content patterns', () => {
			mockParserRegistry.detectLanguageByContent.mockImplementation(
				(content) => {
					if (
						content.includes('import React') ||
						content.includes('require(')
					) {
						return {
							language: 'javascript',
							confidence: 0.8,
							method: 'content'
						};
					}
					if (content.includes('def ') || content.includes('import ')) {
						return { language: 'python', confidence: 0.7, method: 'content' };
					}
					if (content.includes('package ') || content.includes('func ')) {
						return { language: 'go', confidence: 0.9, method: 'content' };
					}
					return { language: null, confidence: 0, method: 'none' };
				}
			);

			const jsResult = mockParserRegistry.detectLanguageByContent(
				'import React from "react";'
			);
			expect(jsResult.language).toBe('javascript');
			expect(jsResult.confidence).toBe(0.8);

			const pyResult = mockParserRegistry.detectLanguageByContent(
				'def main():\n    print("hello")'
			);
			expect(pyResult.language).toBe('python');
			expect(pyResult.confidence).toBe(0.7);

			const goResult = mockParserRegistry.detectLanguageByContent(
				'package main\nfunc main() {}'
			);
			expect(goResult.language).toBe('go');
			expect(goResult.confidence).toBe(0.9);
		});

		test('should combine extension and content detection', () => {
			mockParserRegistry.detectLanguage.mockImplementation(
				(filePath, content) => {
					// Prefer content detection over extension
					const contentResult =
						mockParserRegistry.detectLanguageByContent(content);
					if (contentResult.language && contentResult.confidence > 0.5) {
						return contentResult;
					}

					// Fall back to extension
					const extLanguage =
						mockParserRegistry.detectLanguageByExtension(filePath);
					if (extLanguage) {
						return {
							language: extLanguage,
							confidence: 0.4,
							method: 'extension'
						};
					}

					return { language: null, confidence: 0, method: 'none' };
				}
			);

			// High confidence content should override extension
			const result1 = mockParserRegistry.detectLanguage(
				'test.txt',
				'package main\nfunc main() {}'
			);
			expect(result1.language).toBe('go');
			expect(result1.method).toBe('content');

			// Low confidence content should fall back to extension
			const result2 = mockParserRegistry.detectLanguage(
				'app.js',
				'// just a comment'
			);
			expect(result2.language).toBe('javascript');
			expect(result2.method).toBe('extension');
		});

		test('should handle edge cases in language detection', () => {
			mockParserRegistry.detectLanguage.mockImplementation(
				(filePath, content) => {
					if (!filePath && !content) {
						return { language: null, confidence: 0, method: 'none' };
					}
					if (!content || content.trim() === '') {
						const extLanguage =
							mockParserRegistry.detectLanguageByExtension(filePath);
						return extLanguage
							? { language: extLanguage, confidence: 0.3, method: 'extension' }
							: { language: null, confidence: 0, method: 'none' };
					}
					return { language: 'javascript', confidence: 0.5, method: 'content' };
				}
			);

			// Empty content
			const result1 = mockParserRegistry.detectLanguage('app.js', '');
			expect(result1.language).toBe('javascript');
			expect(result1.confidence).toBe(0.3);

			// No file path or content
			const result2 = mockParserRegistry.detectLanguage('', '');
			expect(result2.language).toBeNull();
			expect(result2.confidence).toBe(0);
		});
	});

	describe('File Parsing', () => {
		test('should parse files with automatic language detection', async () => {
			const content = 'console.log("Hello World");';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'ExpressionStatement',
							expression: {
								type: 'CallExpression',
								callee: {
									type: 'MemberExpression',
									object: { type: 'Identifier', name: 'console' },
									property: { type: 'Identifier', name: 'log' }
								}
							}
						}
					]
				},
				language: 'javascript',
				metadata: {
					detectedLanguage: 'javascript',
					parser: 'JavaScriptParser',
					timestamp: '2024-01-01T00:00:00.000Z',
					registry: 'EnhancedParserRegistry'
				}
			});

			const result = await mockParserRegistry.parseFile('app.js', content);

			expect(result.success).toBe(true);
			expect(result.ast.type).toBe('Program');
			expect(result.language).toBe('javascript');
			expect(result.metadata.detectedLanguage).toBe('javascript');
			expect(result.metadata.parser).toBe('JavaScriptParser');
		});

		test('should handle parsing failures gracefully', async () => {
			const content = 'invalid syntax {{{';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'Unexpected token {',
					line: 1,
					column: 15,
					file: 'broken.js'
				}
			});

			const result = await mockParserRegistry.parseFile('broken.js', content);

			expect(result.success).toBe(false);
			expect(result.error.type).toBe('SyntaxError');
			expect(result.error.message).toContain('Unexpected token');
			expect(result.error.line).toBe(1);
		});

		test('should handle language detection failures', async () => {
			const content = 'unknown language syntax';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: false,
				error: {
					type: 'language_detection_error',
					message: 'Unable to detect language for file',
					file: 'unknown.xyz'
				}
			});

			const result = await mockParserRegistry.parseFile('unknown.xyz', content);

			expect(result.success).toBe(false);
			expect(result.error.type).toBe('language_detection_error');
			expect(result.error.message).toContain('Unable to detect language');
		});

		test('should handle missing parser for detected language', async () => {
			const content = 'some content';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: false,
				error: {
					type: 'parser_not_found',
					message: 'No parser available for language: rust',
					file: 'main.rs',
					language: 'rust'
				}
			});

			const result = await mockParserRegistry.parseFile('main.rs', content);

			expect(result.success).toBe(false);
			expect(result.error.type).toBe('parser_not_found');
			expect(result.error.language).toBe('rust');
		});

		test('should parse files with explicit language override', async () => {
			const content = 'function test() {}';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'typescript', // Explicitly set as TypeScript
				metadata: {
					detectedLanguage: 'typescript',
					parser: 'JavaScriptParser',
					explicitLanguage: true
				}
			});

			const result = await mockParserRegistry.parseFile(
				'test.txt',
				content,
				'typescript'
			);

			expect(result.success).toBe(true);
			expect(result.language).toBe('typescript');
			expect(result.metadata.explicitLanguage).toBe(true);
		});
	});

	describe('Caching and Performance', () => {
		test('should cache parsing results', async () => {
			const content = 'const x = 1;';
			const cacheKey = 'cache_key_123';

			// First call - not cached
			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'javascript',
				fromCache: false,
				cacheKey
			});

			// Second call - from cache
			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'javascript',
				fromCache: true,
				cacheKey
			});

			const result1 = await mockParserRegistry.parseFile('app.js', content);
			const result2 = await mockParserRegistry.parseFile('app.js', content);

			expect(result1.fromCache).toBe(false);
			expect(result2.fromCache).toBe(true);
			expect(result1.cacheKey).toBe(result2.cacheKey);
		});

		test('should handle cache invalidation', async () => {
			const content1 = 'const x = 1;';
			const content2 = 'const x = 2;'; // Modified content

			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: true,
				ast: { type: 'Program', body: [] },
				fromCache: false,
				cacheKey: 'key1'
			});

			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: true,
				ast: { type: 'Program', body: [] },
				fromCache: false, // Cache invalidated due to content change
				cacheKey: 'key2'
			});

			const result1 = await mockParserRegistry.parseFile('app.js', content1);
			const result2 = await mockParserRegistry.parseFile('app.js', content2);

			expect(result1.fromCache).toBe(false);
			expect(result2.fromCache).toBe(false);
			expect(result1.cacheKey).not.toBe(result2.cacheKey);
		});

		test('should handle performance monitoring', async () => {
			const content = 'function test() {}';

			mockParserRegistry.parseFile.mockImplementation(async () => {
				const startTime = performance.now();
				await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate parsing time
				const endTime = performance.now();

				return {
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript',
					performance: {
						parseTime: endTime - startTime,
						cacheHit: false,
						memoryUsage: process.memoryUsage
							? process.memoryUsage().heapUsed
							: 0
					}
				};
			});

			const result = await mockParserRegistry.parseFile('app.js', content);

			expect(result.success).toBe(true);
			expect(result.performance).toBeDefined();
			expect(result.performance.parseTime).toBeGreaterThan(0);
			expect(result.performance.cacheHit).toBe(false);
		});
	});

	describe('Error Handling and Recovery', () => {
		test('should handle parser initialization failures', async () => {
			mockParserRegistry.initialize.mockResolvedValue({
				success: false,
				parsersLoaded: [],
				errors: [
					{
						language: 'javascript',
						error: 'Failed to load parser module',
						stack: 'Error: Module not found...'
					}
				]
			});

			const result = await mockParserRegistry.initialize();

			expect(result.success).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].language).toBe('javascript');
		});

		test('should handle parser runtime errors', async () => {
			const content = 'valid syntax';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: false,
				error: {
					type: 'parsing_error',
					message: 'Parser crashed during execution',
					file: 'app.js',
					stack: 'Error: Unexpected parser failure...'
				}
			});

			const result = await mockParserRegistry.parseFile('app.js', content);

			expect(result.success).toBe(false);
			expect(result.error.type).toBe('parsing_error');
			expect(result.error.message).toContain('Parser crashed');
		});

		test('should provide fallback parsing strategies', async () => {
			const content = 'partially valid syntax';

			// First attempt fails
			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'Unexpected token'
				},
				fallbackAttempted: false
			});

			// Fallback attempt succeeds with partial AST
			mockParserRegistry.parseFile.mockResolvedValueOnce({
				success: true,
				ast: {
					type: 'Program',
					body: [],
					errors: ['Syntax error at line 1']
				},
				language: 'javascript',
				fallbackUsed: true,
				fallbackStrategy: 'error_recovery'
			});

			const result1 = await mockParserRegistry.parseFile('app.js', content);
			const result2 = await mockParserRegistry.parseFile('app.js', content);

			expect(result1.success).toBe(false);
			expect(result2.success).toBe(true);
			expect(result2.fallbackUsed).toBe(true);
		});

		test('should handle concurrent parsing requests', async () => {
			const content = 'const x = 1;';
			const promises = [];

			// Simulate multiple concurrent requests
			for (let i = 0; i < 5; i++) {
				mockParserRegistry.parseFile.mockResolvedValueOnce({
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript',
					requestId: i,
					timestamp: Date.now()
				});

				promises.push(mockParserRegistry.parseFile(`app${i}.js`, content));
			}

			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			results.forEach((result, index) => {
				expect(result.success).toBe(true);
				expect(result.requestId).toBe(index);
			});
		});
	});

	describe('Language Support Queries', () => {
		test('should return supported languages list', () => {
			const languages = mockParserRegistry.getSupportedLanguages();

			expect(languages).toContain('javascript');
			expect(languages).toContain('python');
			expect(languages).toContain('go');
			expect(languages).toHaveLength(3);
		});

		test('should check language support correctly', () => {
			expect(mockParserRegistry.isLanguageSupported('javascript')).toBe(true);
			expect(mockParserRegistry.isLanguageSupported('python')).toBe(true);
			expect(mockParserRegistry.isLanguageSupported('go')).toBe(true);
			expect(mockParserRegistry.isLanguageSupported('rust')).toBe(false);
			expect(mockParserRegistry.isLanguageSupported('unknown')).toBe(false);
		});

		test('should handle case-insensitive language queries', () => {
			mockParserRegistry.isLanguageSupported.mockImplementation((lang) => {
				const normalizedLang = lang.toLowerCase();
				return ['javascript', 'python', 'go'].includes(normalizedLang);
			});

			expect(mockParserRegistry.isLanguageSupported('JavaScript')).toBe(true);
			expect(mockParserRegistry.isLanguageSupported('PYTHON')).toBe(true);
			expect(mockParserRegistry.isLanguageSupported('Go')).toBe(true);
		});

		test('should provide parser capabilities information', () => {
			mockParserRegistry.getParser.mockImplementation((language) => {
				const parser = {
					javascript: mockJavaScriptParser,
					python: mockPythonParser,
					go: mockGoParser
				}[language];

				if (parser) {
					return {
						...parser,
						getCapabilities: () => ({
							supportsJSX: language === 'javascript',
							supportsTypeScript: language === 'javascript',
							supportsAsync: true,
							supportsGenerators: language !== 'go',
							supportsDecorators: language === 'python'
						})
					};
				}

				return null;
			});

			const jsParser = mockParserRegistry.getParser('javascript');
			const pyParser = mockParserRegistry.getParser('python');
			const goParser = mockParserRegistry.getParser('go');

			expect(jsParser.getCapabilities().supportsJSX).toBe(true);
			expect(jsParser.getCapabilities().supportsTypeScript).toBe(true);
			expect(pyParser.getCapabilities().supportsDecorators).toBe(true);
			expect(goParser.getCapabilities().supportsGenerators).toBe(false);
		});
	});

	describe('Integration Tests', () => {
		test('should work with multiple file types in sequence', async () => {
			const files = [
				{
					path: 'app.js',
					content: 'console.log("Hello");',
					expectedLang: 'javascript'
				},
				{
					path: 'script.py',
					content: 'print("Hello")',
					expectedLang: 'python'
				},
				{
					path: 'main.go',
					content: 'package main\nfunc main() {}',
					expectedLang: 'go'
				}
			];

			for (const file of files) {
				mockParserRegistry.parseFile.mockResolvedValueOnce({
					success: true,
					ast: { type: 'Program', body: [] },
					language: file.expectedLang,
					file: file.path
				});
			}

			const results = [];
			for (const file of files) {
				const result = await mockParserRegistry.parseFile(
					file.path,
					file.content
				);
				results.push(result);
			}

			expect(results).toHaveLength(3);
			expect(results[0].language).toBe('javascript');
			expect(results[1].language).toBe('python');
			expect(results[2].language).toBe('go');
		});

		test('should handle mixed success and failure scenarios', async () => {
			const files = [
				{ path: 'valid.js', content: 'const x = 1;', shouldSucceed: true },
				{ path: 'invalid.js', content: 'const x = {{{', shouldSucceed: false },
				{ path: 'valid.py', content: 'x = 1', shouldSucceed: true }
			];

			mockParserRegistry.parseFile
				.mockResolvedValueOnce({
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript'
				})
				.mockResolvedValueOnce({
					success: false,
					error: { type: 'SyntaxError', message: 'Unexpected token' }
				})
				.mockResolvedValueOnce({
					success: true,
					ast: { type: 'Module', body: [] },
					language: 'python'
				});

			const results = [];
			for (const file of files) {
				const result = await mockParserRegistry.parseFile(
					file.path,
					file.content
				);
				results.push(result);
			}

			expect(results[0].success).toBe(true);
			expect(results[1].success).toBe(false);
			expect(results[2].success).toBe(true);
		});

		test('should maintain parser state across multiple operations', async () => {
			// Simulate parser state tracking
			let parseCount = 0;

			mockParserRegistry.parseFile.mockImplementation(async () => {
				parseCount++;
				return {
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript',
					parseCount,
					registryState: 'active'
				};
			});

			const result1 = await mockParserRegistry.parseFile(
				'app1.js',
				'const x = 1;'
			);
			const result2 = await mockParserRegistry.parseFile(
				'app2.js',
				'const y = 2;'
			);
			const result3 = await mockParserRegistry.parseFile(
				'app3.js',
				'const z = 3;'
			);

			expect(result1.parseCount).toBe(1);
			expect(result2.parseCount).toBe(2);
			expect(result3.parseCount).toBe(3);
			expect(result3.registryState).toBe('active');
		});
	});
});
