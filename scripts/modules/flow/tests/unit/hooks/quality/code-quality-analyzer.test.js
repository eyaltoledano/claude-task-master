import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CodeQualityAnalyzer } from '../../../../../hooks/quality/code-quality-analyzer.js';

describe('CodeQualityAnalyzer', () => {
	let analyzer;
	let mockLogger;

	beforeEach(() => {
		mockLogger = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		};
		analyzer = new CodeQualityAnalyzer({ logger: mockLogger });
	});

	describe('constructor', () => {
		test('should initialize with default configuration', () => {
			const defaultAnalyzer = new CodeQualityAnalyzer();
			expect(defaultAnalyzer).toBeDefined();
			expect(defaultAnalyzer.config).toBeDefined();
		});

		test('should accept custom configuration', () => {
			const customConfig = {
				maxComplexity: 15,
				minCoverage: 90,
				enableLinting: false
			};
			const customAnalyzer = new CodeQualityAnalyzer({ config: customConfig });
			expect(customAnalyzer.config.maxComplexity).toBe(15);
			expect(customAnalyzer.config.minCoverage).toBe(90);
			expect(customAnalyzer.config.enableLinting).toBe(false);
		});
	});

	describe('analyzeFile', () => {
		test('should analyze JavaScript file successfully', async () => {
			const filePath = 'test.js';
			const fileContent = `
        function calculateSum(a, b) {
          if (a > 0 && b > 0) {
            return a + b;
          }
          return 0;
        }
      `;

			const result = await analyzer.analyzeFile(filePath, fileContent);

			expect(result).toBeDefined();
			expect(result.filePath).toBe(filePath);
			expect(result.language).toBe('javascript');
			expect(result.metrics).toBeDefined();
			expect(result.issues).toBeDefined();
		});

		test('should handle TypeScript files', async () => {
			const filePath = 'test.ts';
			const fileContent = `
        interface User {
          id: number;
          name: string;
        }
        
        function getUser(id: number): User | null {
          if (id > 0) {
            return { id, name: 'Test User' };
          }
          return null;
        }
      `;

			const result = await analyzer.analyzeFile(filePath, fileContent);

			expect(result.language).toBe('typescript');
			expect(result.metrics).toBeDefined();
		});

		test('should detect high complexity functions', async () => {
			const filePath = 'complex.js';
			const fileContent = `
        function complexFunction(x) {
          if (x > 0) {
            if (x < 10) {
              for (let i = 0; i < x; i++) {
                if (i % 2 === 0) {
                  if (i > 5) {
                    return i * 2;
                  }
                }
              }
            }
          }
          return 0;
        }
      `;

			const result = await analyzer.analyzeFile(filePath, fileContent);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'complexity',
						severity: expect.stringMatching(/high|critical/)
					})
				])
			);
		});

		test('should handle unsupported file types gracefully', async () => {
			const filePath = 'test.xyz';
			const fileContent = 'some content';

			const result = await analyzer.analyzeFile(filePath, fileContent);

			expect(result.language).toBe('unknown');
			expect(result.metrics.linesOfCode).toBeGreaterThan(0);
		});

		test('should handle empty files', async () => {
			const filePath = 'empty.js';
			const fileContent = '';

			const result = await analyzer.analyzeFile(filePath, fileContent);

			expect(result.metrics.linesOfCode).toBe(0);
			expect(result.issues).toHaveLength(0);
		});
	});

	describe('analyzeProject', () => {
		test('should analyze multiple files in a project', async () => {
			const projectPath = '/test/project';
			const files = [
				{ path: 'src/index.js', content: 'console.log("hello");' },
				{
					path: 'src/utils.js',
					content: 'function add(a, b) { return a + b; }'
				}
			];

			// Mock file system operations
			jest.spyOn(analyzer, '_getProjectFiles').mockResolvedValue(files);

			const result = await analyzer.analyzeProject(projectPath);

			expect(result).toBeDefined();
			expect(result.projectPath).toBe(projectPath);
			expect(result.files).toHaveLength(2);
			expect(result.summary).toBeDefined();
			expect(result.summary.totalFiles).toBe(2);
		});

		test('should calculate project-level metrics', async () => {
			const projectPath = '/test/project';
			const files = [
				{ path: 'src/simple.js', content: 'const x = 1;' },
				{
					path: 'src/complex.js',
					content: `
          function complex(a, b, c) {
            if (a > 0) {
              if (b > 0) {
                if (c > 0) {
                  return a + b + c;
                }
              }
            }
            return 0;
          }
        `
				}
			];

			jest.spyOn(analyzer, '_getProjectFiles').mockResolvedValue(files);

			const result = await analyzer.analyzeProject(projectPath);

			expect(result.summary.averageComplexity).toBeGreaterThan(0);
			expect(result.summary.totalLinesOfCode).toBeGreaterThan(0);
			expect(result.summary.issueCount).toBeDefined();
		});

		test('should handle project analysis errors gracefully', async () => {
			const projectPath = '/nonexistent/project';

			jest
				.spyOn(analyzer, '_getProjectFiles')
				.mockRejectedValue(new Error('Project not found'));

			await expect(analyzer.analyzeProject(projectPath)).rejects.toThrow(
				'Project not found'
			);
			expect(mockLogger.error).toHaveBeenCalled();
		});
	});

	describe('getQualityScore', () => {
		test('should calculate quality score based on metrics', () => {
			const metrics = {
				complexity: 5,
				linesOfCode: 100,
				coverage: 85,
				issueCount: 2
			};

			const score = analyzer.getQualityScore(metrics);

			expect(score).toBeGreaterThanOrEqual(0);
			expect(score).toBeLessThanOrEqual(100);
		});

		test('should return lower score for high complexity', () => {
			const highComplexityMetrics = {
				complexity: 20,
				linesOfCode: 100,
				coverage: 50,
				issueCount: 10
			};

			const lowComplexityMetrics = {
				complexity: 3,
				linesOfCode: 100,
				coverage: 95,
				issueCount: 1
			};

			const highScore = analyzer.getQualityScore(highComplexityMetrics);
			const lowScore = analyzer.getQualityScore(lowComplexityMetrics);

			expect(lowScore).toBeGreaterThan(highScore);
		});

		test('should handle edge cases in score calculation', () => {
			const edgeCaseMetrics = {
				complexity: 0,
				linesOfCode: 0,
				coverage: 0,
				issueCount: 0
			};

			const score = analyzer.getQualityScore(edgeCaseMetrics);

			expect(score).toBeGreaterThanOrEqual(0);
			expect(score).toBeLessThanOrEqual(100);
		});
	});

	describe('generateReport', () => {
		test('should generate detailed analysis report', async () => {
			const analysisResult = {
				projectPath: '/test/project',
				files: [
					{
						filePath: 'test.js',
						language: 'javascript',
						metrics: { complexity: 3, linesOfCode: 50 },
						issues: []
					}
				],
				summary: {
					totalFiles: 1,
					totalLinesOfCode: 50,
					averageComplexity: 3,
					issueCount: 0
				}
			};

			const report = analyzer.generateReport(analysisResult);

			expect(report).toBeDefined();
			expect(report.overview).toBeDefined();
			expect(report.fileDetails).toBeDefined();
			expect(report.recommendations).toBeDefined();
			expect(report.qualityScore).toBeGreaterThanOrEqual(0);
		});

		test('should include recommendations for improvement', async () => {
			const analysisResult = {
				projectPath: '/test/project',
				files: [
					{
						filePath: 'complex.js',
						language: 'javascript',
						metrics: { complexity: 15, linesOfCode: 200 },
						issues: [
							{
								type: 'complexity',
								severity: 'high',
								message: 'High complexity detected'
							}
						]
					}
				],
				summary: {
					totalFiles: 1,
					totalLinesOfCode: 200,
					averageComplexity: 15,
					issueCount: 1
				}
			};

			const report = analyzer.generateReport(analysisResult);

			expect(report.recommendations).toEqual(
				expect.arrayContaining([
					expect.stringMatching(/complexity|refactor|simplify/i)
				])
			);
		});
	});

	describe('configuration validation', () => {
		test('should validate configuration parameters', () => {
			const validConfig = {
				maxComplexity: 10,
				minCoverage: 80,
				enableLinting: true
			};

			expect(
				() => new CodeQualityAnalyzer({ config: validConfig })
			).not.toThrow();
		});

		test('should handle invalid configuration gracefully', () => {
			const invalidConfig = {
				maxComplexity: -1,
				minCoverage: 150,
				enableLinting: 'not a boolean'
			};

			const analyzer = new CodeQualityAnalyzer({ config: invalidConfig });

			// Should use defaults for invalid values
			expect(analyzer.config.maxComplexity).toBeGreaterThan(0);
			expect(analyzer.config.minCoverage).toBeLessThanOrEqual(100);
			expect(typeof analyzer.config.enableLinting).toBe('boolean');
		});
	});

	describe('language detection', () => {
		test('should detect language from file extension', () => {
			expect(analyzer._detectLanguage('test.js')).toBe('javascript');
			expect(analyzer._detectLanguage('test.ts')).toBe('typescript');
			expect(analyzer._detectLanguage('test.py')).toBe('python');
			expect(analyzer._detectLanguage('test.java')).toBe('java');
			expect(analyzer._detectLanguage('test.cpp')).toBe('cpp');
			expect(analyzer._detectLanguage('test.unknown')).toBe('unknown');
		});

		test('should handle files without extension', () => {
			expect(analyzer._detectLanguage('Dockerfile')).toBe('unknown');
			expect(analyzer._detectLanguage('README')).toBe('unknown');
		});
	});

	describe('metrics calculation', () => {
		test('should calculate cyclomatic complexity correctly', () => {
			const simpleFunction = 'function simple() { return true; }';
			const complexFunction = `
        function complex(x) {
          if (x > 0) {
            if (x < 10) {
              return x * 2;
            } else {
              return x * 3;
            }
          }
          return 0;
        }
      `;

			const simpleMetrics = analyzer._calculateMetrics(
				simpleFunction,
				'javascript'
			);
			const complexMetrics = analyzer._calculateMetrics(
				complexFunction,
				'javascript'
			);

			expect(complexMetrics.complexity).toBeGreaterThan(
				simpleMetrics.complexity
			);
		});

		test('should count lines of code accurately', () => {
			const code = `
        // This is a comment
        function test() {
          const x = 1;
          
          return x;
        }
      `;

			const metrics = analyzer._calculateMetrics(code, 'javascript');

			expect(metrics.linesOfCode).toBeGreaterThan(0);
			expect(metrics.codeLines).toBeLessThanOrEqual(metrics.linesOfCode);
		});
	});

	describe('issue detection', () => {
		test('should detect potential security issues', async () => {
			const securityIssueCode = `
        function unsafeEval(userInput) {
          return eval(userInput);
        }
      `;

			const result = await analyzer.analyzeFile(
				'security.js',
				securityIssueCode
			);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'security',
						severity: expect.stringMatching(/high|critical/)
					})
				])
			);
		});

		test('should detect code style issues', async () => {
			const styleIssueCode = `
        function badStyle( x,y ) {
          var result=x+y
          return result
        }
      `;

			const result = await analyzer.analyzeFile('style.js', styleIssueCode);

			expect(result.issues.length).toBeGreaterThan(0);
		});

		test('should detect duplicate code patterns', async () => {
			const duplicateCode = `
        function processDataA(data) {
          if (!data) return null;
          data = data.trim();
          return data.toUpperCase();
        }
        
        function processDataB(data) {
          if (!data) return null;
          data = data.trim();
          return data.toUpperCase();
        }
      `;

			const result = await analyzer.analyzeFile('duplicate.js', duplicateCode);

			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: expect.stringMatching(/duplicate|repetition/)
					})
				])
			);
		});
	});

	describe('error handling', () => {
		test('should handle malformed code gracefully', async () => {
			const malformedCode = 'function broken( { return; }';

			const result = await analyzer.analyzeFile('broken.js', malformedCode);

			expect(result).toBeDefined();
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: 'syntax',
						severity: 'critical'
					})
				])
			);
		});

		test('should handle very large files', async () => {
			const largeCode = 'const x = 1;\n'.repeat(10000);

			const result = await analyzer.analyzeFile('large.js', largeCode);

			expect(result).toBeDefined();
			expect(result.metrics.linesOfCode).toBe(10000);
		});

		test('should timeout on extremely large files', async () => {
			const extremelyLargeCode = 'const x = 1;\n'.repeat(1000000);

			// Mock timeout behavior
			jest
				.spyOn(analyzer, '_analyzeWithTimeout')
				.mockRejectedValue(new Error('Analysis timeout'));

			await expect(
				analyzer.analyzeFile('extreme.js', extremelyLargeCode)
			).rejects.toThrow('Analysis timeout');
		});
	});

	describe('performance optimization', () => {
		test('should cache analysis results for identical content', async () => {
			const code = 'function test() { return true; }';

			const result1 = await analyzer.analyzeFile('test1.js', code);
			const result2 = await analyzer.analyzeFile('test2.js', code);

			// Results should be equivalent but for different files
			expect(result1.metrics).toEqual(result2.metrics);
			expect(result1.issues).toEqual(result2.issues);
		});

		test('should handle concurrent analysis requests', async () => {
			const files = Array.from({ length: 5 }, (_, i) => ({
				path: `test${i}.js`,
				content: `function test${i}() { return ${i}; }`
			}));

			const promises = files.map((file) =>
				analyzer.analyzeFile(file.path, file.content)
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			results.forEach((result, index) => {
				expect(result.filePath).toBe(`test${index}.js`);
			});
		});
	});
});
