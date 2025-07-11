import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { QualityInsightsFormatter } from '../../../../../hooks/quality/quality-insights-formatter.js';

describe('QualityInsightsFormatter', () => {
	let formatter;
	let mockOptions;

	beforeEach(() => {
		mockOptions = {
			colorize: true,
			includeDetails: true,
			format: 'detailed'
		};
		formatter = new QualityInsightsFormatter(mockOptions);
	});

	describe('constructor', () => {
		test('should initialize with default options', () => {
			const defaultFormatter = new QualityInsightsFormatter();
			expect(defaultFormatter).toBeDefined();
			expect(defaultFormatter.options).toBeDefined();
		});

		test('should accept custom options', () => {
			const customOptions = {
				colorize: false,
				includeDetails: false,
				format: 'summary'
			};
			const customFormatter = new QualityInsightsFormatter(customOptions);

			expect(customFormatter.options.colorize).toBe(false);
			expect(customFormatter.options.includeDetails).toBe(false);
			expect(customFormatter.options.format).toBe('summary');
		});
	});

	describe('formatAnalysisResults', () => {
		const mockAnalysisResults = {
			projectPath: '/test/project',
			files: [
				{
					filePath: 'src/utils.js',
					language: 'javascript',
					metrics: {
						complexity: 5,
						linesOfCode: 120,
						codeLines: 100,
						commentLines: 15,
						blankLines: 5
					},
					issues: [
						{
							type: 'complexity',
							severity: 'medium',
							message: 'Function has moderate complexity',
							line: 15,
							column: 10
						}
					]
				}
			],
			summary: {
				totalFiles: 1,
				totalLinesOfCode: 120,
				averageComplexity: 5,
				issueCount: 1,
				qualityScore: 78
			}
		};

		test('should format complete analysis results', () => {
			const formatted = formatter.formatAnalysisResults(mockAnalysisResults);

			expect(formatted).toBeDefined();
			expect(typeof formatted).toBe('string');
			expect(formatted).toContain('Quality Analysis Report');
			expect(formatted).toContain('/test/project');
			expect(formatted).toContain('src/utils.js');
		});

		test('should include summary statistics', () => {
			const formatted = formatter.formatAnalysisResults(mockAnalysisResults);

			expect(formatted).toContain('Total Files: 1');
			expect(formatted).toContain('Total Lines: 120');
			expect(formatted).toContain('Quality Score: 78');
			expect(formatted).toContain('Issues Found: 1');
		});

		test('should format file-specific details when includeDetails is true', () => {
			formatter.options.includeDetails = true;
			const formatted = formatter.formatAnalysisResults(mockAnalysisResults);

			expect(formatted).toContain('File Details');
			expect(formatted).toContain('Complexity: 5');
			expect(formatted).toContain('Lines of Code: 120');
		});

		test('should exclude file details when includeDetails is false', () => {
			formatter.options.includeDetails = false;
			const formatted = formatter.formatAnalysisResults(mockAnalysisResults);

			expect(formatted).not.toContain('File Details');
			expect(formatted).toContain('Quality Analysis Report'); // Summary should still be there
		});

		test('should handle empty analysis results', () => {
			const emptyResults = {
				projectPath: '/empty/project',
				files: [],
				summary: {
					totalFiles: 0,
					totalLinesOfCode: 0,
					averageComplexity: 0,
					issueCount: 0,
					qualityScore: 100
				}
			};

			const formatted = formatter.formatAnalysisResults(emptyResults);

			expect(formatted).toContain('No files analyzed');
			expect(formatted).toContain('Quality Score: 100');
		});
	});

	describe('formatSummary', () => {
		test('should format summary statistics', () => {
			const summary = {
				totalFiles: 25,
				totalLinesOfCode: 5000,
				averageComplexity: 4.5,
				issueCount: 12,
				qualityScore: 85
			};

			const formatted = formatter.formatSummary(summary);

			expect(formatted).toContain('25');
			expect(formatted).toContain('5000');
			expect(formatted).toContain('4.5');
			expect(formatted).toContain('12');
			expect(formatted).toContain('85');
		});

		test('should handle zero values gracefully', () => {
			const emptySummary = {
				totalFiles: 0,
				totalLinesOfCode: 0,
				averageComplexity: 0,
				issueCount: 0,
				qualityScore: 0
			};

			const formatted = formatter.formatSummary(emptySummary);

			expect(formatted).toBeDefined();
			expect(formatted).toContain('0');
		});

		test('should format large numbers with appropriate separators', () => {
			const largeSummary = {
				totalFiles: 1000,
				totalLinesOfCode: 1000000,
				averageComplexity: 3.14159,
				issueCount: 500,
				qualityScore: 92.5
			};

			const formatted = formatter.formatSummary(largeSummary);

			expect(formatted).toContain('1,000');
			expect(formatted).toContain('1,000,000');
			expect(formatted).toContain('3.1'); // Should round complexity
		});
	});

	describe('formatFileDetails', () => {
		const mockFile = {
			filePath: 'src/components/Button.jsx',
			language: 'javascript',
			metrics: {
				complexity: 8,
				linesOfCode: 200,
				codeLines: 180,
				commentLines: 15,
				blankLines: 5
			},
			issues: [
				{
					type: 'complexity',
					severity: 'high',
					message: 'Function complexity is too high',
					line: 45,
					column: 8,
					functionName: 'handleClick'
				},
				{
					type: 'style',
					severity: 'low',
					message: 'Missing semicolon',
					line: 67,
					column: 22
				}
			]
		};

		test('should format file details with metrics', () => {
			const formatted = formatter.formatFileDetails(mockFile);

			expect(formatted).toContain('Button.jsx');
			expect(formatted).toContain('Language: javascript');
			expect(formatted).toContain('Complexity: 8');
			expect(formatted).toContain('Lines: 200');
		});

		test('should format issues with proper severity indicators', () => {
			const formatted = formatter.formatFileDetails(mockFile);

			expect(formatted).toContain('Issues Found: 2');
			expect(formatted).toContain('handleClick');
			expect(formatted).toContain('line 45');
			expect(formatted).toContain('line 67');
		});

		test('should handle files with no issues', () => {
			const cleanFile = {
				...mockFile,
				issues: []
			};

			const formatted = formatter.formatFileDetails(cleanFile);

			expect(formatted).toContain('No issues found');
			expect(formatted).not.toContain('Issues Found:');
		});

		test('should colorize output when colorize option is enabled', () => {
			formatter.options.colorize = true;
			const formatted = formatter.formatFileDetails(mockFile);

			// Should contain ANSI color codes
			expect(formatted).toMatch(/\u001b\[\d+m/);
		});

		test('should not colorize output when colorize option is disabled', () => {
			formatter.options.colorize = false;
			const formatted = formatter.formatFileDetails(mockFile);

			// Should not contain ANSI color codes
			expect(formatted).not.toMatch(/\u001b\[\d+m/);
		});
	});

	describe('formatIssues', () => {
		const mockIssues = [
			{
				type: 'security',
				severity: 'critical',
				message: 'Potential SQL injection vulnerability',
				line: 125,
				column: 15,
				functionName: 'executeQuery'
			},
			{
				type: 'performance',
				severity: 'medium',
				message: 'Inefficient loop detected',
				line: 89,
				column: 4
			},
			{
				type: 'style',
				severity: 'low',
				message: 'Inconsistent indentation',
				line: 203,
				column: 1
			}
		];

		test('should format issues with severity grouping', () => {
			const formatted = formatter.formatIssues(mockIssues);

			expect(formatted).toContain('Critical Issues');
			expect(formatted).toContain('Medium Issues');
			expect(formatted).toContain('Low Issues');
		});

		test('should sort issues by severity', () => {
			const formatted = formatter.formatIssues(mockIssues);

			const criticalIndex = formatted.indexOf('Critical Issues');
			const mediumIndex = formatted.indexOf('Medium Issues');
			const lowIndex = formatted.indexOf('Low Issues');

			expect(criticalIndex).toBeLessThan(mediumIndex);
			expect(mediumIndex).toBeLessThan(lowIndex);
		});

		test('should include issue location information', () => {
			const formatted = formatter.formatIssues(mockIssues);

			expect(formatted).toContain('line 125');
			expect(formatted).toContain('line 89');
			expect(formatted).toContain('line 203');
		});

		test('should handle empty issues array', () => {
			const formatted = formatter.formatIssues([]);

			expect(formatted).toBe('No issues found.');
		});
	});

	describe('formatRecommendations', () => {
		const mockAnalysisResults = {
			files: [
				{
					metrics: { complexity: 15 },
					issues: [
						{ type: 'complexity', severity: 'high' },
						{ type: 'security', severity: 'critical' }
					]
				}
			],
			summary: {
				averageComplexity: 12,
				issueCount: 25,
				qualityScore: 45
			}
		};

		test('should generate recommendations based on analysis', () => {
			const recommendations =
				formatter.formatRecommendations(mockAnalysisResults);

			expect(recommendations).toBeDefined();
			expect(Array.isArray(recommendations)).toBe(true);
			expect(recommendations.length).toBeGreaterThan(0);
		});

		test('should recommend complexity reduction for high complexity', () => {
			const recommendations =
				formatter.formatRecommendations(mockAnalysisResults);

			expect(recommendations).toEqual(
				expect.arrayContaining([
					expect.stringMatching(/complexity|refactor|simplify/i)
				])
			);
		});

		test('should recommend security review for security issues', () => {
			const recommendations =
				formatter.formatRecommendations(mockAnalysisResults);

			expect(recommendations).toEqual(
				expect.arrayContaining([
					expect.stringMatching(/security|review|vulnerability/i)
				])
			);
		});

		test('should provide specific recommendations for low quality scores', () => {
			const lowQualityResults = {
				...mockAnalysisResults,
				summary: { ...mockAnalysisResults.summary, qualityScore: 25 }
			};

			const recommendations =
				formatter.formatRecommendations(lowQualityResults);

			expect(recommendations.length).toBeGreaterThanOrEqual(3);
		});

		test('should provide fewer recommendations for high quality scores', () => {
			const highQualityResults = {
				files: [{ metrics: { complexity: 2 }, issues: [] }],
				summary: { averageComplexity: 2, issueCount: 0, qualityScore: 95 }
			};

			const recommendations =
				formatter.formatRecommendations(highQualityResults);

			expect(recommendations.length).toBeLessThanOrEqual(2);
		});
	});

	describe('format types', () => {
		const mockResults = {
			projectPath: '/test',
			files: [
				{ filePath: 'test.js', language: 'javascript', metrics: {}, issues: [] }
			],
			summary: { totalFiles: 1, qualityScore: 80 }
		};

		test('should format detailed report when format is detailed', () => {
			formatter.options.format = 'detailed';
			const formatted = formatter.formatAnalysisResults(mockResults);

			expect(formatted).toContain('Quality Analysis Report');
			expect(formatted).toContain('Summary');
			expect(formatted).toContain('Recommendations');
		});

		test('should format summary only when format is summary', () => {
			formatter.options.format = 'summary';
			const formatted = formatter.formatAnalysisResults(mockResults);

			expect(formatted).toContain('Quality Score');
			expect(formatted).not.toContain('File Details');
			expect(formatted).not.toContain('Recommendations');
		});

		test('should format JSON when format is json', () => {
			formatter.options.format = 'json';
			const formatted = formatter.formatAnalysisResults(mockResults);

			expect(() => JSON.parse(formatted)).not.toThrow();

			const parsed = JSON.parse(formatted);
			expect(parsed.projectPath).toBe('/test');
			expect(parsed.summary.qualityScore).toBe(80);
		});

		test('should format CSV when format is csv', () => {
			formatter.options.format = 'csv';
			const formatted = formatter.formatAnalysisResults(mockResults);

			expect(formatted).toContain('File,Language,Complexity,Lines,Issues');
			expect(formatted).toContain('test.js,javascript');
		});
	});

	describe('utility methods', () => {
		test('should colorize text based on severity', () => {
			formatter.options.colorize = true;

			const critical = formatter._colorize('Critical issue', 'critical');
			const high = formatter._colorize('High issue', 'high');
			const medium = formatter._colorize('Medium issue', 'medium');
			const low = formatter._colorize('Low issue', 'low');

			expect(critical).toMatch(/\u001b\[\d+m.*\u001b\[0m/);
			expect(high).toMatch(/\u001b\[\d+m.*\u001b\[0m/);
			expect(medium).toMatch(/\u001b\[\d+m.*\u001b\[0m/);
			expect(low).toMatch(/\u001b\[\d+m.*\u001b\[0m/);
		});

		test('should not colorize when colorize is disabled', () => {
			formatter.options.colorize = false;

			const text = formatter._colorize('Test', 'critical');
			expect(text).toBe('Test');
		});

		test('should format numbers with appropriate precision', () => {
			expect(formatter._formatNumber(3.14159)).toBe('3.1');
			expect(formatter._formatNumber(1000)).toBe('1,000');
			expect(formatter._formatNumber(1000000)).toBe('1,000,000');
			expect(formatter._formatNumber(0)).toBe('0');
		});

		test('should get severity icon for different severities', () => {
			expect(formatter._getSeverityIcon('critical')).toBe('🚨');
			expect(formatter._getSeverityIcon('high')).toBe('⚠️');
			expect(formatter._getSeverityIcon('medium')).toBe('⚡');
			expect(formatter._getSeverityIcon('low')).toBe('ℹ️');
			expect(formatter._getSeverityIcon('unknown')).toBe('❓');
		});

		test('should generate progress bar for quality scores', () => {
			const highScore = formatter._generateProgressBar(90);
			const mediumScore = formatter._generateProgressBar(50);
			const lowScore = formatter._generateProgressBar(20);

			expect(highScore).toContain('█');
			expect(mediumScore).toContain('█');
			expect(lowScore).toContain('█');

			// High score should have more filled blocks
			const highFilled = (highScore.match(/█/g) || []).length;
			const lowFilled = (lowScore.match(/█/g) || []).length;
			expect(highFilled).toBeGreaterThan(lowFilled);
		});
	});

	describe('error handling', () => {
		test('should handle malformed analysis results gracefully', () => {
			const malformedResults = {
				// Missing required fields
				files: null,
				summary: undefined
			};

			expect(() => {
				formatter.formatAnalysisResults(malformedResults);
			}).not.toThrow();
		});

		test('should handle missing file metrics', () => {
			const resultsWithMissingMetrics = {
				projectPath: '/test',
				files: [
					{
						filePath: 'test.js',
						language: 'javascript',
						// metrics missing
						issues: []
					}
				],
				summary: { totalFiles: 1 }
			};

			expect(() => {
				formatter.formatAnalysisResults(resultsWithMissingMetrics);
			}).not.toThrow();
		});

		test('should handle invalid options gracefully', () => {
			const invalidOptions = {
				colorize: 'not a boolean',
				format: 'invalid-format',
				includeDetails: null
			};

			expect(() => {
				new QualityInsightsFormatter(invalidOptions);
			}).not.toThrow();
		});
	});

	describe('performance considerations', () => {
		test('should handle large result sets efficiently', () => {
			const largeResults = {
				projectPath: '/large/project',
				files: Array.from({ length: 1000 }, (_, i) => ({
					filePath: `file${i}.js`,
					language: 'javascript',
					metrics: { complexity: i % 10, linesOfCode: i * 10 },
					issues: []
				})),
				summary: { totalFiles: 1000, qualityScore: 75 }
			};

			const startTime = Date.now();
			const formatted = formatter.formatAnalysisResults(largeResults);
			const endTime = Date.now();

			expect(formatted).toBeDefined();
			expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
		});

		test('should handle deeply nested issue structures', () => {
			const complexIssues = Array.from({ length: 100 }, (_, i) => ({
				type: 'complexity',
				severity: i % 2 === 0 ? 'high' : 'medium',
				message: `Issue ${i}`,
				line: i + 1,
				column: 1,
				context: {
					functionName: `function${i}`,
					className: `Class${i}`,
					details: Array.from({ length: 10 }, (_, j) => `detail${j}`)
				}
			}));

			const results = {
				projectPath: '/test',
				files: [
					{
						filePath: 'complex.js',
						language: 'javascript',
						metrics: {},
						issues: complexIssues
					}
				],
				summary: { totalFiles: 1 }
			};

			expect(() => {
				formatter.formatAnalysisResults(results);
			}).not.toThrow();
		});
	});
});
