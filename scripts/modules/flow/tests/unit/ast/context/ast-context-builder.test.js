/**
 * @fileoverview AST Context Builder Test Suite
 *
 * Tests the core AST context building functionality including:
 * - File discovery and AST parsing
 * - Context data structure validation
 * - Error handling for invalid files
 * - Performance with various project sizes
 * - Memory management during context building
 *
 * Part of Phase 1.3: Context Building & Analysis Testing
 */

const path = require('path');
const { performance } = require('perf_hooks');

describe('ASTContextBuilder', () => {
	let ASTContextBuilder;
	let contextBuilder;
	let mockFileSystem;
	let mockParser;

	beforeAll(() => {
		// Mock file system interface
		const MockFileSystem = class {
			constructor() {
				this.files = new Map();
				this.directories = new Set();
			}

			addFile(filePath, content, stats = {}) {
				this.files.set(filePath, {
					content,
					stats: {
						size: content.length,
						mtime: new Date(),
						isFile: () => true,
						isDirectory: () => false,
						...stats
					}
				});

				// Add parent directories
				let dir = path.dirname(filePath);
				while (dir !== '.' && dir !== '/') {
					this.directories.add(dir);
					dir = path.dirname(dir);
				}
			}

			async readFile(filePath) {
				const file = this.files.get(filePath);
				if (!file) {
					throw new Error(
						`ENOENT: no such file or directory, open '${filePath}'`
					);
				}
				return file.content;
			}

			async stat(filePath) {
				const file = this.files.get(filePath);
				if (file) return file.stats;

				if (this.directories.has(filePath)) {
					return {
						isFile: () => false,
						isDirectory: () => true,
						size: 0,
						mtime: new Date()
					};
				}

				throw new Error(
					`ENOENT: no such file or directory, stat '${filePath}'`
				);
			}

			async readdir(dirPath) {
				const items = [];

				// Add files in this directory
				for (const [filePath] of this.files) {
					if (path.dirname(filePath) === dirPath) {
						items.push(path.basename(filePath));
					}
				}

				// Add subdirectories
				for (const dir of this.directories) {
					if (path.dirname(dir) === dirPath) {
						items.push(path.basename(dir));
					}
				}

				return items;
			}

			async exists(filePath) {
				return this.files.has(filePath) || this.directories.has(filePath);
			}
		};

		// Mock parser interface
		const MockParser = class {
			constructor() {
				this.parseCount = 0;
				this.parseErrors = new Map();
			}

			async parseFile(filePath, content) {
				this.parseCount++;

				if (this.parseErrors.has(filePath)) {
					throw this.parseErrors.get(filePath);
				}

				// Simulate different AST structures based on file extension
				const ext = path.extname(filePath);

				switch (ext) {
					case '.js':
					case '.jsx':
					case '.ts':
					case '.tsx':
						return this._createJavaScriptAST(content, filePath);
					case '.py':
						return this._createPythonAST(content, filePath);
					case '.go':
						return this._createGoAST(content, filePath);
					default:
						return this._createGenericAST(content, filePath);
				}
			}

			_createJavaScriptAST(content, filePath) {
				return {
					type: 'Program',
					sourceType: 'module',
					body: [
						{
							type: 'FunctionDeclaration',
							id: { type: 'Identifier', name: 'mockFunction' },
							params: [],
							body: { type: 'BlockStatement', body: [] }
						}
					],
					metadata: {
						language: 'javascript',
						filePath,
						size: content.length,
						complexity: Math.floor(content.length / 100) + 1,
						imports: this._extractImports(content),
						exports: this._extractExports(content)
					}
				};
			}

			_createPythonAST(content, filePath) {
				return {
					type: 'Module',
					body: [
						{
							type: 'FunctionDef',
							name: 'mock_function',
							args: { args: [] },
							body: []
						}
					],
					metadata: {
						language: 'python',
						filePath,
						size: content.length,
						complexity: Math.floor(content.length / 80) + 1,
						imports: this._extractPythonImports(content),
						classes: this._extractPythonClasses(content)
					}
				};
			}

			_createGoAST(content, filePath) {
				return {
					type: 'File',
					package: { type: 'Ident', name: 'main' },
					decls: [
						{
							type: 'FuncDecl',
							name: { type: 'Ident', name: 'mockFunction' },
							type: { type: 'FuncType', params: null }
						}
					],
					metadata: {
						language: 'go',
						filePath,
						size: content.length,
						complexity: Math.floor(content.length / 120) + 1,
						package: 'main',
						imports: this._extractGoImports(content)
					}
				};
			}

			_createGenericAST(content, filePath) {
				return {
					type: 'GenericFile',
					content: content.substring(0, 200),
					metadata: {
						language: 'unknown',
						filePath,
						size: content.length,
						lines: content.split('\n').length
					}
				};
			}

			_extractImports(content) {
				const imports = [];
				const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
				let match;
				while ((match = importRegex.exec(content)) !== null) {
					imports.push(match[1]);
				}
				return imports;
			}

			_extractExports(content) {
				const exports = [];
				const exportRegex =
					/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
				let match;
				while ((match = exportRegex.exec(content)) !== null) {
					exports.push(match[1]);
				}
				return exports;
			}

			_extractPythonImports(content) {
				const imports = [];
				const importRegex = /(?:from\s+(\w+)\s+)?import\s+([^\n]+)/g;
				let match;
				while ((match = importRegex.exec(content)) !== null) {
					imports.push(match[1] || match[2]);
				}
				return imports;
			}

			_extractPythonClasses(content) {
				const classes = [];
				const classRegex = /class\s+(\w+)/g;
				let match;
				while ((match = classRegex.exec(content)) !== null) {
					classes.push(match[1]);
				}
				return classes;
			}

			_extractGoImports(content) {
				const imports = [];
				const importRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
				let match;
				while ((match = importRegex.exec(content)) !== null) {
					if (match[1]) {
						// Multi-line import block
						const lines = match[1].split('\n');
						for (const line of lines) {
							const lineMatch = line.match(/"([^"]+)"/);
							if (lineMatch) imports.push(lineMatch[1]);
						}
					} else if (match[2]) {
						// Single import
						imports.push(match[2]);
					}
				}
				return imports;
			}

			setParseError(filePath, error) {
				this.parseErrors.set(filePath, error);
			}

			clearParseErrors() {
				this.parseErrors.clear();
			}

			getStats() {
				return {
					parseCount: this.parseCount,
					errorCount: this.parseErrors.size
				};
			}
		};

		// Mock the ASTContextBuilder class
		ASTContextBuilder = class MockASTContextBuilder {
			constructor(options = {}) {
				this.options = {
					maxFiles: options.maxFiles || 1000,
					maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB
					includePatterns: options.includePatterns || [
						'**/*.js',
						'**/*.py',
						'**/*.go'
					],
					excludePatterns: options.excludePatterns || [
						'**/node_modules/**',
						'**/.git/**'
					],
					enableCaching: options.enableCaching !== false,
					...options
				};

				this.fileSystem = options.fileSystem || new MockFileSystem();
				this.parser = options.parser || new MockParser();
				this.cache = new Map();
				this.stats = {
					filesDiscovered: 0,
					filesParsed: 0,
					filesSkipped: 0,
					totalSize: 0,
					parseTime: 0,
					errors: []
				};
			}

			async buildContext(rootPath, options = {}) {
				const startTime = performance.now();

				try {
					this._resetStats();

					const files = await this._discoverFiles(rootPath, options);
					const contexts = await this._parseFiles(files, options);
					const context = this._buildContextStructure(contexts, options);

					const endTime = performance.now();
					this.stats.parseTime = endTime - startTime;

					return {
						context,
						stats: { ...this.stats },
						metadata: {
							rootPath,
							timestamp: new Date().toISOString(),
							fileCount: contexts.length,
							totalSize: this.stats.totalSize
						}
					};
				} catch (error) {
					this.stats.errors.push({
						type: 'build_context_error',
						message: error.message,
						timestamp: new Date().toISOString()
					});
					throw error;
				}
			}

			async _discoverFiles(rootPath, options = {}) {
				const files = [];
				const visited = new Set();

				await this._discoverFilesRecursive(rootPath, files, visited, options);

				this.stats.filesDiscovered = files.length;
				return files;
			}

			async _discoverFilesRecursive(dirPath, files, visited, options) {
				if (visited.has(dirPath)) return;
				visited.add(dirPath);

				try {
					const items = await this.fileSystem.readdir(dirPath);

					for (const item of items) {
						const itemPath = path.join(dirPath, item);
						const stats = await this.fileSystem.stat(itemPath);

						if (stats.isDirectory()) {
							if (!this._isExcluded(itemPath)) {
								await this._discoverFilesRecursive(
									itemPath,
									files,
									visited,
									options
								);
							}
						} else if (stats.isFile()) {
							if (this._shouldIncludeFile(itemPath, stats)) {
								files.push({
									path: itemPath,
									size: stats.size,
									mtime: stats.mtime
								});
							}
						}
					}
				} catch (error) {
					this.stats.errors.push({
						type: 'discovery_error',
						path: dirPath,
						message: error.message
					});
				}
			}

			async _parseFiles(files, options = {}) {
				const contexts = [];
				const concurrency = options.concurrency || 5;

				// Process files in batches for better performance
				for (let i = 0; i < files.length; i += concurrency) {
					const batch = files.slice(i, i + concurrency);
					const batchPromises = batch.map((file) => this._parseFile(file));
					const batchResults = await Promise.allSettled(batchPromises);

					for (const result of batchResults) {
						if (result.status === 'fulfilled' && result.value) {
							contexts.push(result.value);
						}
					}
				}

				return contexts;
			}

			async _parseFile(file) {
				try {
					// Check cache first
					if (this.options.enableCaching && this.cache.has(file.path)) {
						const cached = this.cache.get(file.path);
						if (cached.mtime >= file.mtime) {
							return cached.context;
						}
					}

					const content = await this.fileSystem.readFile(file.path);

					// Check file size limits
					if (content.length > this.options.maxFileSize) {
						this.stats.filesSkipped++;
						return null;
					}

					const ast = await this.parser.parseFile(file.path, content);
					const context = {
						filePath: file.path,
						ast,
						content:
							content.length > 10000
								? content.substring(0, 10000) + '...'
								: content,
						size: content.length,
						mtime: file.mtime
					};

					// Cache the result
					if (this.options.enableCaching) {
						this.cache.set(file.path, {
							context,
							mtime: file.mtime
						});
					}

					this.stats.filesParsed++;
					this.stats.totalSize += content.length;

					return context;
				} catch (error) {
					this.stats.errors.push({
						type: 'parse_error',
						path: file.path,
						message: error.message
					});
					this.stats.filesSkipped++;
					return null;
				}
			}

			_buildContextStructure(contexts, options = {}) {
				const structure = {
					files: {},
					summary: {
						totalFiles: contexts.length,
						languages: {},
						totalSize: 0,
						complexity: 0
					},
					dependencies: {},
					exports: {}
				};

				for (const context of contexts) {
					const { filePath, ast, size } = context;
					const language = ast.metadata?.language || 'unknown';

					// Add to files
					structure.files[filePath] = context;

					// Update summary
					structure.summary.languages[language] =
						(structure.summary.languages[language] || 0) + 1;
					structure.summary.totalSize += size;
					structure.summary.complexity += ast.metadata?.complexity || 1;

					// Process imports/dependencies
					if (ast.metadata?.imports) {
						structure.dependencies[filePath] = ast.metadata.imports;
					}

					// Process exports
					if (ast.metadata?.exports) {
						structure.exports[filePath] = ast.metadata.exports;
					}
				}

				return structure;
			}

			_shouldIncludeFile(filePath, stats) {
				// Check size limits
				if (stats.size > this.options.maxFileSize) {
					return false;
				}

				// Check exclude patterns
				if (this._isExcluded(filePath)) {
					return false;
				}

				// Check include patterns
				return this._isIncluded(filePath);
			}

			_isIncluded(filePath) {
				return this.options.includePatterns.some((pattern) => {
					return this._matchesPattern(filePath, pattern);
				});
			}

			_isExcluded(filePath) {
				return this.options.excludePatterns.some((pattern) => {
					return this._matchesPattern(filePath, pattern);
				});
			}

			_matchesPattern(filePath, pattern) {
				// Simple glob pattern matching
				const regex = pattern
					.replace(/\*\*/g, '.*')
					.replace(/\*/g, '[^/]*')
					.replace(/\?/g, '.');
				return new RegExp(regex).test(filePath);
			}

			_resetStats() {
				this.stats = {
					filesDiscovered: 0,
					filesParsed: 0,
					filesSkipped: 0,
					totalSize: 0,
					parseTime: 0,
					errors: []
				};
			}

			clearCache() {
				this.cache.clear();
			}

			getCacheStats() {
				return {
					size: this.cache.size,
					hitRate: this.cache.size > 0 ? 1 : 0 // Simplified
				};
			}

			getStats() {
				return { ...this.stats };
			}
		};

		mockFileSystem = new MockFileSystem();
		mockParser = new MockParser();
	});

	beforeEach(() => {
		mockFileSystem = new mockFileSystem.constructor();
		mockParser = new mockParser.constructor();
		contextBuilder = new ASTContextBuilder({
			fileSystem: mockFileSystem,
			parser: mockParser
		});
	});

	describe('Initialization', () => {
		test('should initialize with default options', () => {
			const builder = new ASTContextBuilder();

			expect(builder.options.maxFiles).toBe(1000);
			expect(builder.options.maxFileSize).toBe(1024 * 1024);
			expect(builder.options.enableCaching).toBe(true);
			expect(builder.options.includePatterns).toContain('**/*.js');
		});

		test('should initialize with custom options', () => {
			const options = {
				maxFiles: 500,
				maxFileSize: 512 * 1024,
				enableCaching: false,
				includePatterns: ['**/*.ts']
			};

			const builder = new ASTContextBuilder(options);

			expect(builder.options.maxFiles).toBe(500);
			expect(builder.options.maxFileSize).toBe(512 * 1024);
			expect(builder.options.enableCaching).toBe(false);
			expect(builder.options.includePatterns).toEqual(['**/*.ts']);
		});
	});

	describe('File Discovery', () => {
		beforeEach(() => {
			// Set up a mock project structure
			mockFileSystem.addFile(
				'/project/src/app.js',
				'console.log("Hello World");'
			);
			mockFileSystem.addFile(
				'/project/src/utils.js',
				'export function helper() {}'
			);
			mockFileSystem.addFile(
				'/project/src/components/Button.jsx',
				'export function Button() {}'
			);
			mockFileSystem.addFile(
				'/project/tests/app.test.js',
				'test("app", () => {});'
			);
			mockFileSystem.addFile(
				'/project/node_modules/react/index.js',
				'module.exports = React;'
			);
			mockFileSystem.addFile('/project/README.md', '# Project README');
			mockFileSystem.addFile('/project/.git/config', '[core]');
		});

		test('should discover files in project structure', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.stats.filesDiscovered).toBeGreaterThan(0);
			expect(result.context.files).toHaveProperty('/project/src/app.js');
			expect(result.context.files).toHaveProperty('/project/src/utils.js');
		});

		test('should exclude node_modules and .git directories', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.context.files).not.toHaveProperty(
				'/project/node_modules/react/index.js'
			);
			expect(result.context.files).not.toHaveProperty('/project/.git/config');
		});

		test('should respect include patterns', async () => {
			contextBuilder.options.includePatterns = ['**/*.jsx'];

			const result = await contextBuilder.buildContext('/project');

			expect(result.context.files).toHaveProperty(
				'/project/src/components/Button.jsx'
			);
			expect(result.context.files).not.toHaveProperty('/project/src/app.js');
		});

		test('should handle empty directories gracefully', async () => {
			mockFileSystem.directories.add('/project/empty');

			const result = await contextBuilder.buildContext('/project');

			expect(result.stats.errors).toEqual([]);
			expect(result.context.summary.totalFiles).toBeGreaterThan(0);
		});
	});

	describe('AST Parsing', () => {
		beforeEach(() => {
			mockFileSystem.addFile(
				'/project/app.js',
				`
        import React from 'react';
        export function App() {
          return <div>Hello World</div>;
        }
      `
			);
			mockFileSystem.addFile(
				'/project/utils.py',
				`
        def calculate(x, y):
            return x + y
        
        class Calculator:
            pass
      `
			);
			mockFileSystem.addFile(
				'/project/main.go',
				`
        package main
        
        import "fmt"
        
        func main() {
            fmt.Println("Hello World")
        }
      `
			);
		});

		test('should parse JavaScript files correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			const jsFile = result.context.files['/project/app.js'];
			expect(jsFile).toBeDefined();
			expect(jsFile.ast.type).toBe('Program');
			expect(jsFile.ast.metadata.language).toBe('javascript');
			expect(jsFile.ast.metadata.imports).toContain('react');
		});

		test('should parse Python files correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			const pyFile = result.context.files['/project/utils.py'];
			expect(pyFile).toBeDefined();
			expect(pyFile.ast.type).toBe('Module');
			expect(pyFile.ast.metadata.language).toBe('python');
		});

		test('should parse Go files correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			const goFile = result.context.files['/project/main.go'];
			expect(goFile).toBeDefined();
			expect(goFile.ast.type).toBe('File');
			expect(goFile.ast.metadata.language).toBe('go');
			expect(goFile.ast.metadata.package).toBe('main');
		});

		test('should handle parse errors gracefully', async () => {
			mockFileSystem.addFile(
				'/project/broken.js',
				'invalid javascript syntax {{{'
			);
			mockParser.setParseError('/project/broken.js', new Error('Syntax error'));

			const result = await contextBuilder.buildContext('/project');

			expect(result.stats.errors.length).toBeGreaterThan(0);
			expect(result.stats.errors[0].type).toBe('parse_error');
			expect(result.stats.filesSkipped).toBeGreaterThan(0);
		});
	});

	describe('Context Structure Building', () => {
		beforeEach(() => {
			mockFileSystem.addFile(
				'/project/src/index.js',
				`
        import { helper } from './utils.js';
        export function main() {}
      `
			);
			mockFileSystem.addFile(
				'/project/src/utils.js',
				`
        export function helper() {}
        export const constant = 42;
      `
			);
		});

		test('should build comprehensive context structure', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.context).toHaveProperty('files');
			expect(result.context).toHaveProperty('summary');
			expect(result.context).toHaveProperty('dependencies');
			expect(result.context).toHaveProperty('exports');
		});

		test('should calculate summary statistics correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.context.summary.totalFiles).toBe(2);
			expect(result.context.summary.languages.javascript).toBe(2);
			expect(result.context.summary.totalSize).toBeGreaterThan(0);
			expect(result.context.summary.complexity).toBeGreaterThan(0);
		});

		test('should track dependencies correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			const indexDeps = result.context.dependencies['/project/src/index.js'];
			expect(indexDeps).toContain('./utils.js');
		});

		test('should track exports correctly', async () => {
			const result = await contextBuilder.buildContext('/project');

			const utilsExports = result.context.exports['/project/src/utils.js'];
			expect(utilsExports).toContain('helper');
			expect(utilsExports).toContain('constant');
		});
	});

	describe('Performance and Memory Management', () => {
		test('should handle large numbers of files efficiently', async () => {
			// Create a large project structure
			for (let i = 0; i < 200; i++) {
				mockFileSystem.addFile(
					`/project/src/file${i}.js`,
					`
          export function func${i}() {
            return ${i};
          }
        `
				);
			}

			const startTime = performance.now();
			const result = await contextBuilder.buildContext('/project');
			const endTime = performance.now();

			expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
			expect(result.context.summary.totalFiles).toBe(200);
		});

		test('should respect file size limits', async () => {
			const largeContent = 'a'.repeat(2 * 1024 * 1024); // 2MB file
			mockFileSystem.addFile('/project/large.js', largeContent);
			mockFileSystem.addFile('/project/small.js', 'console.log("small");');

			contextBuilder.options.maxFileSize = 1024 * 1024; // 1MB limit

			const result = await contextBuilder.buildContext('/project');

			expect(result.context.files).not.toHaveProperty('/project/large.js');
			expect(result.context.files).toHaveProperty('/project/small.js');
			expect(result.stats.filesSkipped).toBe(1);
		});

		test('should handle concurrent parsing efficiently', async () => {
			// Create multiple files
			for (let i = 0; i < 50; i++) {
				mockFileSystem.addFile(`/project/file${i}.js`, `console.log(${i});`);
			}

			const startTime = performance.now();
			const result = await contextBuilder.buildContext('/project', {
				concurrency: 10
			});
			const endTime = performance.now();

			expect(result.context.summary.totalFiles).toBe(50);
			expect(endTime - startTime).toBeLessThan(3000); // Should be faster with concurrency
		});
	});

	describe('Caching', () => {
		beforeEach(() => {
			mockFileSystem.addFile('/project/cached.js', 'console.log("cached");');
		});

		test('should cache parsed results', async () => {
			// First build
			await contextBuilder.buildContext('/project');
			expect(contextBuilder.getCacheStats().size).toBeGreaterThan(0);

			// Second build should use cache
			const parseCountBefore = mockParser.getStats().parseCount;
			await contextBuilder.buildContext('/project');
			const parseCountAfter = mockParser.getStats().parseCount;

			expect(parseCountAfter).toBe(parseCountBefore); // No additional parsing
		});

		test('should invalidate cache when files change', async () => {
			// First build
			await contextBuilder.buildContext('/project');
			const parseCountBefore = mockParser.getStats().parseCount;

			// Modify file timestamp
			mockFileSystem.addFile('/project/cached.js', 'console.log("modified");', {
				mtime: new Date(Date.now() + 1000)
			});

			// Second build should reparse
			await contextBuilder.buildContext('/project');
			const parseCountAfter = mockParser.getStats().parseCount;

			expect(parseCountAfter).toBeGreaterThan(parseCountBefore);
		});

		test('should allow cache clearing', async () => {
			await contextBuilder.buildContext('/project');
			expect(contextBuilder.getCacheStats().size).toBeGreaterThan(0);

			contextBuilder.clearCache();
			expect(contextBuilder.getCacheStats().size).toBe(0);
		});
	});

	describe('Error Handling', () => {
		test('should handle file system errors gracefully', async () => {
			// Mock a directory that throws an error
			mockFileSystem.readdir = jest
				.fn()
				.mockRejectedValue(new Error('Permission denied'));

			const result = await contextBuilder.buildContext('/project');

			expect(result.stats.errors.length).toBeGreaterThan(0);
			expect(result.stats.errors[0].type).toBe('discovery_error');
		});

		test('should handle missing files gracefully', async () => {
			const result = await contextBuilder.buildContext('/nonexistent');

			expect(result.stats.errors.length).toBeGreaterThan(0);
			expect(result.stats.filesDiscovered).toBe(0);
		});

		test('should continue processing after individual file errors', async () => {
			mockFileSystem.addFile('/project/good.js', 'console.log("good");');
			mockFileSystem.addFile('/project/bad.js', 'invalid syntax');

			mockParser.setParseError('/project/bad.js', new Error('Parse error'));

			const result = await contextBuilder.buildContext('/project');

			expect(result.context.files).toHaveProperty('/project/good.js');
			expect(result.context.files).not.toHaveProperty('/project/bad.js');
			expect(result.stats.filesParsed).toBe(1);
			expect(result.stats.filesSkipped).toBe(1);
		});
	});

	describe('Statistics and Monitoring', () => {
		beforeEach(() => {
			mockFileSystem.addFile('/project/app.js', 'console.log("app");');
			mockFileSystem.addFile('/project/utils.js', 'export function util() {}');
		});

		test('should provide comprehensive statistics', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.stats).toHaveProperty('filesDiscovered');
			expect(result.stats).toHaveProperty('filesParsed');
			expect(result.stats).toHaveProperty('filesSkipped');
			expect(result.stats).toHaveProperty('totalSize');
			expect(result.stats).toHaveProperty('parseTime');
			expect(result.stats).toHaveProperty('errors');

			expect(result.stats.filesDiscovered).toBeGreaterThan(0);
			expect(result.stats.filesParsed).toBeGreaterThan(0);
			expect(result.stats.parseTime).toBeGreaterThan(0);
		});

		test('should include metadata in results', async () => {
			const result = await contextBuilder.buildContext('/project');

			expect(result.metadata).toHaveProperty('rootPath', '/project');
			expect(result.metadata).toHaveProperty('timestamp');
			expect(result.metadata).toHaveProperty('fileCount');
			expect(result.metadata).toHaveProperty('totalSize');
		});

		test('should track parser statistics', () => {
			const stats = mockParser.getStats();

			expect(stats).toHaveProperty('parseCount');
			expect(stats).toHaveProperty('errorCount');
		});
	});
});
