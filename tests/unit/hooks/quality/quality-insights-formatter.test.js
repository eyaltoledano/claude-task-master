import { jest } from '@jest/globals';

// Import the formatter functions to test
const {
	formatForTaskUpdate,
	formatForPRDescription,
	formatForConsole,
	generateSummary,
	generateDetailedReport
} = await import('../../../../scripts/modules/flow/hooks/quality/quality-insights-formatter.js');

describe('Quality Insights Formatter', () => {
	let mockQualityMetrics;
	let mockQualityMetricsWithIssues;
	let mockQualityMetricsError;
	let mockQualityMetricsNoChanges;

	beforeEach(() => {
		// High quality metrics sample
		mockQualityMetrics = {
			hasChanges: true,
			fileCount: 3,
			totalLines: 150,
			analysisTime: 250,
			timestamp: '2024-01-15T10:30:00.000Z',
			overallScore: 8.5,
			files: [
				{
					path: 'src/components/TodoList.jsx',
					status: 'M',
					metrics: {
						linesOfCode: 80,
						complexity: {
							cyclomaticComplexity: 6,
							complexityLevel: 'medium'
						}
					},
					jsMetrics: {
						functionCount: 4,
						classCount: 1,
						importCount: 3,
						todoComments: 1,
						consoleUsage: 0
					},
					issues: []
				},
				{
					path: 'src/utils/helpers.js',
					status: 'A',
					metrics: {
						linesOfCode: 50,
						complexity: {
							cyclomaticComplexity: 3,
							complexityLevel: 'low'
						}
					},
					jsMetrics: {
						functionCount: 3,
						classCount: 0,
						importCount: 0,
						todoComments: 0,
						consoleUsage: 1
					},
					issues: []
				},
				{
					path: 'src/styles/main.css',
					status: 'M',
					metrics: {
						linesOfCode: 20,
						complexity: null
					},
					jsMetrics: null,
					issues: []
				}
			],
			aggregateMetrics: {
				averageComplexity: 4.5,
				averageCommentRatio: 0.15,
				totalLinesOfCode: 150,
				totalFunctions: 7,
				filesAnalyzed: 3,
				complexityDistribution: {
					low: 1,
					medium: 1,
					high: 0,
					'very-high': 0
				}
			},
			lintResults: {
				available: true,
				filesChecked: 2,
				issues: [],
				errorCount: 0,
				warningCount: 0
			},
			taskAlignment: {
				keywordCoverage: 0.75,
				foundKeywords: ['todo', 'component', 'react', 'filtering'],
				missedKeywords: ['toggle'],
				relevantFileRatio: 0.67,
				implementationScope: 'medium'
			}
		};

		// Quality metrics with issues
		mockQualityMetricsWithIssues = {
			...mockQualityMetrics,
			overallScore: 5.5,
			lintResults: {
				available: true,
				filesChecked: 2,
				issues: [
					{
						severity: 'error',
						message: 'Missing semicolon at end of statement',
						file: 'src/components/TodoList.jsx',
						line: 15
					},
					{
						severity: 'warning',
						message: 'Prefer const over let for variables that are never reassigned',
						file: 'src/utils/helpers.js',
						line: 8
					},
					{
						severity: 'warning',
						message: 'Unused variable detected',
						file: 'src/utils/helpers.js',
						line: 20
					}
				],
				errorCount: 1,
				warningCount: 2
			},
			taskAlignment: {
				...mockQualityMetrics.taskAlignment,
				keywordCoverage: 0.25
			}
		};

		// Error case
		mockQualityMetricsError = {
			error: 'Analysis failed due to git command timeout',
			analysisTime: 5000,
			timestamp: '2024-01-15T10:30:00.000Z'
		};

		// No changes case
		mockQualityMetricsNoChanges = {
			hasChanges: false,
			message: 'Session completed without file changes',
			timestamp: '2024-01-15T10:30:00.000Z'
		};
	});

	describe('formatForTaskUpdate', () => {
		test('should format high quality metrics correctly', () => {
			const result = formatForTaskUpdate(mockQualityMetrics);

			expect(result.summary).toContain('✅ Quality Score: 8.5/10');
			expect(result.summary).toContain('excellent');
			expect(result.summary).toContain('3 files');
			expect(result.summary).toContain('150 lines');

			expect(result.details).toContain('## Quality Analysis Summary');
			expect(result.details).toContain('Overall Score:** 8.5/10');
			expect(result.details).toContain('Files Analyzed:** 3');
			expect(result.details).toContain('Total Lines:** 150');
			expect(result.details).toContain('Analysis Time:** 250ms');
			expect(result.details).toContain('## Code Metrics');
			expect(result.details).toContain('Average Complexity:** 4.5');
			expect(result.details).toContain('Comment Ratio:** 15.0%');
			expect(result.details).toContain('## Linting Results');
			expect(result.details).toContain('✅ No linting issues found');
			expect(result.details).toContain('## Task Alignment');
			expect(result.details).toContain('Keyword Coverage:** 75.0%');
		});

		test('should format metrics with issues correctly', () => {
			const result = formatForTaskUpdate(mockQualityMetricsWithIssues);

			expect(result.summary).toContain('🔧 Quality Score: 5.5/10');
			expect(result.summary).toContain('needs improvement');

			expect(result.details).toContain('Errors:** 1');
			expect(result.details).toContain('Warnings:** 2');
			expect(result.details).toContain('error: Missing semicolon');
			expect(result.details).toContain('warning: Prefer const over let');
			expect(result.details).toContain('Keyword Coverage:** 25.0%');
		});

		test('should handle error metrics', () => {
			const result = formatForTaskUpdate(mockQualityMetricsError);

			expect(result.summary).toBe('Quality analysis unavailable');
			expect(result.details).toBe('Analysis failed due to git command timeout');
		});

		test('should handle no changes', () => {
			const result = formatForTaskUpdate(mockQualityMetricsNoChanges);

			expect(result.summary).toBe('No code changes detected');
			expect(result.details).toBe('Session completed without file changes');
		});

		test('should handle null/undefined input', () => {
			const result = formatForTaskUpdate(null);

			expect(result.summary).toBe('Quality analysis unavailable');
			expect(result.details).toBe('No quality metrics available');
		});
	});

	describe('generateSummary', () => {
		test('should generate excellent quality summary', () => {
			const summary = generateSummary(mockQualityMetrics);

			expect(summary).toContain('✅');
			expect(summary).toContain('8.5/10');
			expect(summary).toContain('excellent');
			expect(summary).toContain('3 files');
			expect(summary).toContain('150 lines');
		});

		test('should generate acceptable quality summary', () => {
			const mediumQualityMetrics = {
				...mockQualityMetrics,
				overallScore: 7.2
			};

			const summary = generateSummary(mediumQualityMetrics);

			expect(summary).toContain('⚠️');
			expect(summary).toContain('7.2/10');
			expect(summary).toContain('acceptable');
		});

		test('should generate needs improvement summary', () => {
			const lowQualityMetrics = {
				...mockQualityMetrics,
				overallScore: 4.5
			};

			const summary = generateSummary(lowQualityMetrics);

			expect(summary).toContain('🔧');
			expect(summary).toContain('4.5/10');
			expect(summary).toContain('needs improvement');
		});
	});

	describe('generateDetailedReport', () => {
		test('should generate comprehensive detailed report', () => {
			const report = generateDetailedReport(mockQualityMetrics);

			// Check main sections are present
			expect(report).toContain('## Quality Analysis Summary');
			expect(report).toContain('## Code Metrics');
			expect(report).toContain('## Linting Results');
			expect(report).toContain('## Task Alignment');
			expect(report).toContain('## File Analysis');

			// Check specific content
			expect(report).toContain('Overall Score:** 8.5/10');
			expect(report).toContain('Average Complexity:** 4.5');
			expect(report).toContain('Complexity Distribution:** Low: 1, Medium: 1, High: 0, Very High: 0');
			expect(report).toContain('✅ No linting issues found');
			expect(report).toContain('Found Keywords:** todo, component, react, filtering');
			expect(report).toContain('Missed Keywords:** toggle');

			// Check file breakdown
			expect(report).toContain('**src/components/TodoList.jsx** (M)');
			expect(report).toContain('Lines: 80, Complexity: 6 (medium)');
			expect(report).toContain('Functions: 4, Classes: 1, Imports: 3');
			expect(report).toContain('TODO comments: 1');
		});

		test('should handle report with linting issues', () => {
			const report = generateDetailedReport(mockQualityMetricsWithIssues);

			expect(report).toContain('Errors:** 1');
			expect(report).toContain('Warnings:** 2');
			expect(report).toContain('error: Missing semicolon');
			expect(report).toContain('warning: Prefer const over let');
			expect(report).toContain('warning: Unused variable detected');
		});

		test('should handle unavailable linting', () => {
			const metricsWithoutLinting = {
				...mockQualityMetrics,
				lintResults: {
					available: false,
					reason: 'No biome.json found'
				}
			};

			const report = generateDetailedReport(metricsWithoutLinting);

			expect(report).toContain('⚠️ Linting unavailable: No biome.json found');
		});

		test('should handle files without JavaScript metrics', () => {
			const cssOnlyMetrics = {
				...mockQualityMetrics,
				files: [
					{
						path: 'src/styles/main.css',
						status: 'M',
						metrics: {
							linesOfCode: 20,
							complexity: null
						},
						jsMetrics: null,
						issues: ['CSS parsing warning']
					}
				]
			};

			const report = generateDetailedReport(cssOnlyMetrics);

			expect(report).toContain('**src/styles/main.css** (M)');
			expect(report).toContain('Lines: 20, Complexity: null (unknown)');
			expect(report).toContain('Issues: CSS parsing warning');
		});
	});

	describe('formatForPRDescription', () => {
		test('should format high quality PR description', () => {
			const description = formatForPRDescription(mockQualityMetrics);

			expect(description).toContain('## 🔍 Code Quality Analysis');
			expect(description).toContain('**Overall Score:** 8.5/10');
			expect(description).toContain('**Complexity:** 4.5 avg');
			expect(description).toContain('**Documentation:** 15.0% comments');
			expect(description).toContain('**Linting:** ✅ Clean');
			expect(description).toContain('**Task Alignment:** 75% keyword coverage');
		});

		test('should format PR description with linting issues', () => {
			const description = formatForPRDescription(mockQualityMetricsWithIssues);

			expect(description).toContain('**Overall Score:** 5.5/10');
			expect(description).toContain('**Linting:** 1 errors, 2 warnings');
		});

		test('should return empty string for error cases', () => {
			expect(formatForPRDescription(mockQualityMetricsError)).toBe('');
			expect(formatForPRDescription(mockQualityMetricsNoChanges)).toBe('');
			expect(formatForPRDescription(null)).toBe('');
			expect(formatForPRDescription(undefined)).toBe('');
		});

		test('should handle missing optional metrics', () => {
			const minimalMetrics = {
				hasChanges: true,
				overallScore: 7.0
			};

			const description = formatForPRDescription(minimalMetrics);

			expect(description).toContain('**Overall Score:** 7/10');
			expect(description).not.toContain('**Complexity:**');
			expect(description).not.toContain('**Linting:**');
			expect(description).not.toContain('**Task Alignment:**');
		});
	});

	describe('formatForConsole', () => {
		test('should format high quality console output', () => {
			const output = formatForConsole(mockQualityMetrics);

			expect(output).toContain('🔍 Code Quality Analysis (250ms)');
			expect(output).toContain('─'.repeat(50)); // Separator line
			expect(output).toContain('✅ Overall Score: 8.5/10');
			expect(output).toContain('📁 Files: 3 (150 lines)');
			expect(output).toContain('🔄 Avg Complexity: 4.5');
			expect(output).toContain('📝 Comment Ratio: 15.0%');
			expect(output).toContain('✅ Linting: Clean');
			expect(output).toContain('✅ Task Alignment: 75%');
		});

		test('should format console output with issues', () => {
			const output = formatForConsole(mockQualityMetricsWithIssues);

			expect(output).toContain('🔧 Overall Score: 5.5/10');
			expect(output).toContain('🔧 Linting: 1 errors, 2 warnings');
			expect(output).toContain('❌ Task Alignment: 25%');
		});

		test('should handle error cases', () => {
			const errorOutput = formatForConsole(mockQualityMetricsError);

			expect(errorOutput).toBe('❌ Quality analysis failed: Analysis failed due to git command timeout');
		});

		test('should handle no changes', () => {
			const noChangesOutput = formatForConsole(mockQualityMetricsNoChanges);

			expect(noChangesOutput).toBe('📝 No code changes detected in session');
		});

		test('should handle null input', () => {
			const nullOutput = formatForConsole(null);

			expect(nullOutput).toBe('❌ Quality analysis failed: Unknown error');
		});

		test('should use correct emojis for different task alignment scores', () => {
			// High alignment (≥70%)
			const highAlignment = {
				...mockQualityMetrics,
				taskAlignment: { keywordCoverage: 0.80 }
			};
			expect(formatForConsole(highAlignment)).toContain('✅ Task Alignment: 80%');

			// Medium alignment (≥50%, <70%)
			const mediumAlignment = {
				...mockQualityMetrics,
				taskAlignment: { keywordCoverage: 0.60 }
			};
			expect(formatForConsole(mediumAlignment)).toContain('⚠️ Task Alignment: 60%');

			// Low alignment (<50%)
			const lowAlignment = {
				...mockQualityMetrics,
				taskAlignment: { keywordCoverage: 0.30 }
			};
			expect(formatForConsole(lowAlignment)).toContain('❌ Task Alignment: 30%');
		});

		test('should handle missing aggregate metrics', () => {
			const metricsWithoutAggregate = {
				...mockQualityMetrics,
				aggregateMetrics: undefined
			};

			const output = formatForConsole(metricsWithoutAggregate);

			expect(output).toContain('✅ Overall Score: 8.5/10');
			expect(output).not.toContain('🔄 Avg Complexity:');
			expect(output).not.toContain('📝 Comment Ratio:');
		});

		test('should handle unavailable linting', () => {
			const metricsWithoutLinting = {
				...mockQualityMetrics,
				lintResults: {
					available: false
				}
			};

			const output = formatForConsole(metricsWithoutLinting);

			expect(output).not.toContain('Linting:');
		});
	});

	describe('edge cases and error handling', () => {
		test('should handle metrics with missing file data', () => {
			const metricsWithoutFiles = {
				...mockQualityMetrics,
				files: undefined
			};

			const taskUpdate = formatForTaskUpdate(metricsWithoutFiles);
			const prDescription = formatForPRDescription(metricsWithoutFiles);
			const consoleOutput = formatForConsole(metricsWithoutFiles);

			expect(taskUpdate.details).not.toContain('## File Analysis');
			expect(prDescription).toContain('**Overall Score:**');
			expect(consoleOutput).toContain('Overall Score:');
		});

		test('should handle metrics with empty arrays', () => {
			const metricsWithEmptyArrays = {
				...mockQualityMetrics,
				files: [],
				lintResults: {
					available: true,
					issues: []
				}
			};

			const result = formatForTaskUpdate(metricsWithEmptyArrays);

			expect(result.details).toContain('✅ No linting issues found');
			expect(result.details).not.toContain('## File Analysis');
		});

		test('should handle very long issue lists', () => {
			const manyIssues = Array.from({ length: 10 }, (_, i) => ({
				severity: i % 2 === 0 ? 'error' : 'warning',
				message: `Issue number ${i + 1}`,
				file: 'test.js',
				line: i + 1
			}));

			const metricsWithManyIssues = {
				...mockQualityMetrics,
				lintResults: {
					available: true,
					issues: manyIssues,
					errorCount: 5,
					warningCount: 5
				}
			};

			const report = generateDetailedReport(metricsWithManyIssues);

			// Should limit to top 3 issues
			const issueMatches = report.match(/Issue number \d+/g);
			expect(issueMatches).toHaveLength(3);
			expect(report).toContain('Issue number 1');
			expect(report).toContain('Issue number 2');
			expect(report).toContain('Issue number 3');
		});
	});
}); 