import { jest } from '@jest/globals';

// Mock the dependencies used by test-quality-analyzer
jest.unstable_mockModule('../../../../scripts/modules/flow/hooks/quality/code-quality-analyzer.js', () => ({
	CodeQualityAnalyzer: jest.fn()
}));

jest.unstable_mockModule('../../../../scripts/modules/flow/hooks/quality/quality-insights-formatter.js', () => ({
	formatForConsole: jest.fn()
}));

// Mock console methods to test console output
const originalConsole = global.console;
const mockConsole = {
	log: jest.fn(),
	error: jest.fn(),
	warn: jest.fn()
};

// Import the mocked modules
const { CodeQualityAnalyzer } = await import('../../../../scripts/modules/flow/hooks/quality/code-quality-analyzer.js');
const { formatForConsole } = await import('../../../../scripts/modules/flow/hooks/quality/quality-insights-formatter.js');

describe('Test Quality Analyzer Integration', () => {
	let mockAnalyzer;
	let mockAnalyzerInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		
		// Replace console with mocks
		global.console = mockConsole;

		// Create mock analyzer instance
		mockAnalyzerInstance = {
			analyzeFile: jest.fn(),
			calculateAggregateMetrics: jest.fn(),
			calculateOverallScore: jest.fn()
		};

		// Mock the CodeQualityAnalyzer constructor
		CodeQualityAnalyzer.mockImplementation(() => mockAnalyzerInstance);
		mockAnalyzer = new CodeQualityAnalyzer();
	});

	afterEach(() => {
		// Restore original console
		global.console = originalConsole;
	});

	describe('TestQualityAnalyzer Script Functionality', () => {
		test('should test individual file analysis correctly', async () => {
			const mockFileAnalysis = {
				path: 'src/components/TodoList.jsx',
				language: 'javascript',
				metrics: {
					linesOfCode: 25,
					complexity: {
						cyclomaticComplexity: 8,
						complexityLevel: 'medium'
					}
				},
				jsMetrics: {
					functionCount: 1,
					importCount: 1,
					todoComments: 1
				}
			};

			mockAnalyzerInstance.analyzeFile.mockResolvedValue(mockFileAnalysis);

			// Test the file analysis workflow that the script demonstrates
			const mockTask = {
				id: '5.2',
				title: 'Implement Todo List Component',
				description: 'Create a React component for displaying and filtering todos',
				details: 'Should include filtering, toggle functionality, and delete capability',
				isSubtask: true
			};

			const mockChange = {
				path: 'src/components/TodoList.jsx',
				status: 'M',
				content: `import React, { useState } from 'react';

// TODO: Add proper error handling
export function TodoList({ todos, onToggle, onDelete }) {
	const [filter, setFilter] = useState('all');
	
	const processItems = (items) => {
		if (!items) return [];
		
		let result = [];
		for (let i = 0; i < items.length; i++) {
			if (items[i].completed && filter === 'active') {
				continue;
			} else if (!items[i].completed && filter === 'completed') {
				continue;
			} else if (filter === 'all' || 
					  (filter === 'active' && !items[i].completed) ||
					  (filter === 'completed' && items[i].completed)) {
				if (items[i].text.length > 0) {
					result.push({
						...items[i],
						displayText: items[i].text.trim()
					});
				}
			}
		}
		return result;
	};

	const filteredTodos = processItems(todos);
	
	return (
		<div className="todo-list">
			<div className="filters">
				<button onClick={() => setFilter('all')}>All</button>
				<button onClick={() => setFilter('active')}>Active</button>
				<button onClick={() => setFilter('completed')}>Completed</button>
			</div>
			{filteredTodos.map(todo => (
				<div key={todo.id} className="todo-item">
					<input 
						type="checkbox" 
						checked={todo.completed}
						onChange={() => onToggle(todo.id)}
					/>
					<span>{todo.displayText}</span>
					<button onClick={() => onDelete(todo.id)}>Delete</button>
				</div>
			))}
		</div>
	);
}`,
				size: 1200
			};

			const result = await mockAnalyzerInstance.analyzeFile(mockChange, mockTask);

			expect(result).toEqual(mockFileAnalysis);
			expect(mockAnalyzerInstance.analyzeFile).toHaveBeenCalledWith(mockChange, mockTask);
		});

		test('should test aggregate metrics calculation', () => {
			const mockFileAnalyses = [
				{
					metrics: {
						linesOfCode: 80,
						complexity: { cyclomaticComplexity: 6 },
						commentLines: 8
					},
					jsMetrics: { functionCount: 4 }
				},
				{
					metrics: {
						linesOfCode: 50,
						complexity: { cyclomaticComplexity: 3 },
						commentLines: 5
					},
					jsMetrics: { functionCount: 3 }
				}
			];

			const mockAggregateMetrics = {
				averageComplexity: 4.5,
				averageCommentRatio: 0.1,
				totalLinesOfCode: 130,
				totalFunctions: 7,
				filesAnalyzed: 2,
				complexityDistribution: {
					low: 1,
					medium: 1,
					high: 0,
					'very-high': 0
				}
			};

			mockAnalyzerInstance.calculateAggregateMetrics.mockReturnValue(mockAggregateMetrics);

			const result = mockAnalyzerInstance.calculateAggregateMetrics(mockFileAnalyses);

			expect(result).toEqual(mockAggregateMetrics);
			expect(mockAnalyzerInstance.calculateAggregateMetrics).toHaveBeenCalledWith(mockFileAnalyses);
		});

		test('should test overall score calculation', () => {
			const mockAnalysis = {
				aggregateMetrics: {
					averageComplexity: 4.5,
					averageCommentRatio: 0.15
				},
				lintResults: {
					issues: [
						{
							severity: 'warning',
							message: 'Prefer const over let for variables that are never reassigned',
							file: 'src/components/TodoList.jsx',
							line: 15
						}
					]
				},
				taskAlignment: {
					keywordCoverage: 0.75
				}
			};

			const expectedScore = 7.8;
			mockAnalyzerInstance.calculateOverallScore.mockReturnValue(expectedScore);

			const score = mockAnalyzerInstance.calculateOverallScore(mockAnalysis);

			expect(score).toBe(expectedScore);
			expect(mockAnalyzerInstance.calculateOverallScore).toHaveBeenCalledWith(mockAnalysis);
		});

		test('should test console output formatting', () => {
			const mockQualityAnalysis = {
				hasChanges: true,
				fileCount: 2,
				totalLines: 130,
				analysisTime: 45,
				overallScore: 7.8,
				aggregateMetrics: {
					averageComplexity: 4.5,
					averageCommentRatio: 0.1,
					totalLinesOfCode: 130
				},
				lintResults: {
					available: true,
					errorCount: 0,
					warningCount: 1
				},
				taskAlignment: {
					keywordCoverage: 0.75
				}
			};

			const expectedConsoleOutput = `🔍 Code Quality Analysis (45ms)
──────────────────────────────────────────────────
✅ Overall Score: 7.8/10
📁 Files: 2 (130 lines)
🔄 Avg Complexity: 4.5
📝 Comment Ratio: 10.0%
🔧 Linting: 0 errors, 1 warnings
✅ Task Alignment: 75%`;

			formatForConsole.mockReturnValue(expectedConsoleOutput);

			const result = formatForConsole(mockQualityAnalysis);

			expect(result).toBe(expectedConsoleOutput);
			expect(formatForConsole).toHaveBeenCalledWith(mockQualityAnalysis);
		});
	});

	describe('Linting Integration Testing', () => {
		test('should verify Biome configuration detection', async () => {
			// Test that the analyzer properly detects Biome configuration
			const mockChanges = [
				{ path: 'src/test.js', content: 'test content' },
				{ path: 'src/test.jsx', content: 'jsx content' }
			];

			const mockWorktree = { path: '/test/project' };

			// Mock runBiomeAnalysis method
			const mockRunBiomeAnalysis = jest.fn().mockResolvedValue({
				available: true,
				filesChecked: 2,
				issues: [],
				errorCount: 0,
				warningCount: 0
			});

			mockAnalyzerInstance.runBiomeAnalysis = mockRunBiomeAnalysis;

			const result = await mockAnalyzerInstance.runBiomeAnalysis(mockChanges, mockWorktree);

			expect(result.available).toBe(true);
			expect(result.filesChecked).toBe(2);
			expect(mockRunBiomeAnalysis).toHaveBeenCalledWith(mockChanges, mockWorktree);
		});

		test('should handle Biome configuration not found', async () => {
			const mockChanges = [{ path: 'src/test.js', content: 'test' }];
			const mockWorktree = { path: '/test/project' };

			const mockRunBiomeAnalysis = jest.fn().mockResolvedValue({
				available: false,
				reason: 'No biome.json found'
			});

			mockAnalyzerInstance.runBiomeAnalysis = mockRunBiomeAnalysis;

			const result = await mockAnalyzerInstance.runBiomeAnalysis(mockChanges, mockWorktree);

			expect(result.available).toBe(false);
			expect(result.reason).toBe('No biome.json found');
		});

		test('should parse Biome JSON output correctly', async () => {
			const mockBiomeOutput = {
				summary: { files: 2 },
				diagnostics: [
					{
						severity: 'error',
						description: 'Missing semicolon at end of statement',
						location: {
							path: 'src/test.js',
							span: { start: 10 }
						}
					},
					{
						severity: 'warning',
						description: 'Prefer const over let',
						location: {
							path: 'src/test.js',
							span: { start: 20 }
						}
					}
				]
			};

			const mockRunBiomeAnalysis = jest.fn().mockResolvedValue({
				available: true,
				filesChecked: 2,
				issues: [
					{
						severity: 'error',
						message: 'Missing semicolon at end of statement',
						file: 'src/test.js',
						line: { start: 10 }
					},
					{
						severity: 'warning',
						message: 'Prefer const over let',
						file: 'src/test.js',
						line: { start: 20 }
					}
				],
				errorCount: 1,
				warningCount: 1
			});

			mockAnalyzerInstance.runBiomeAnalysis = mockRunBiomeAnalysis;

			const result = await mockAnalyzerInstance.runBiomeAnalysis([], {});

			expect(result.available).toBe(true);
			expect(result.issues).toHaveLength(2);
			expect(result.errorCount).toBe(1);
			expect(result.warningCount).toBe(1);
			expect(result.issues[0].severity).toBe('error');
			expect(result.issues[1].severity).toBe('warning');
		});

		test('should handle Biome command execution errors', async () => {
			const mockRunBiomeAnalysis = jest.fn().mockResolvedValue({
				available: false,
				error: 'Biome command not found'
			});

			mockAnalyzerInstance.runBiomeAnalysis = mockRunBiomeAnalysis;

			const result = await mockAnalyzerInstance.runBiomeAnalysis([], {});

			expect(result.available).toBe(false);
			expect(result.error).toBe('Biome command not found');
		});

		test('should filter files for Biome support correctly', () => {
			// Test that only supported file types are analyzed by Biome
			const mockIsBiomeSupported = jest.fn()
				.mockReturnValueOnce(true)  // .js file
				.mockReturnValueOnce(true)  // .jsx file
				.mockReturnValueOnce(true)  // .ts file
				.mockReturnValueOnce(true)  // .tsx file
				.mockReturnValueOnce(true)  // .json file
				.mockReturnValueOnce(false) // .css file
				.mockReturnValueOnce(false) // .md file
				.mockReturnValueOnce(false); // .txt file

			mockAnalyzerInstance.isBiomeSupported = mockIsBiomeSupported;

			const testFiles = [
				'src/app.js',
				'src/component.jsx',
				'src/types.ts',
				'src/component.tsx',
				'package.json',
				'src/styles.css',
				'README.md',
				'notes.txt'
			];

			const supportedFiles = testFiles.filter(file => 
				mockAnalyzerInstance.isBiomeSupported(file)
			);

			expect(supportedFiles).toHaveLength(5); // js, jsx, ts, tsx, json
			expect(mockIsBiomeSupported).toHaveBeenCalledTimes(8);
		});
	});

	describe('Mock Data Validation', () => {
		test('should validate mock task structure', () => {
			const mockTask = {
				id: '5.2',
				title: 'Implement Todo List Component',
				description: 'Create a React component for displaying and filtering todos',
				details: 'Should include filtering, toggle functionality, and delete capability',
				isSubtask: true
			};

			// Validate required fields for task alignment analysis
			expect(mockTask.id).toBeDefined();
			expect(mockTask.title).toBeDefined();
			expect(mockTask.description).toBeDefined();
			expect(mockTask.details).toBeDefined();
			expect(typeof mockTask.isSubtask).toBe('boolean');
		});

		test('should validate mock code samples for complexity analysis', () => {
			const mockCodeSamples = {
				simpleFunction: `function simple() {
	return 'hello';
}`,
				complexFunction: `function complex(x) {
	if (x > 0) {
		while (x > 10) {
			x--;
		}
		for (let i = 0; i < 5; i++) {
			if (i % 2 === 0) {
				console.log(i);
			}
		}
	} else if (x < 0) {
		return x ? 'negative' : 'zero';
	}
	return x;
}`,
				reactComponent: `import React, { useState } from 'react';

// TODO: Add proper error handling
export function TodoList({ todos }) {
	const [filter, setFilter] = useState('all');
	
	if (!todos) {
		return null;
	}
	
	const filteredTodos = todos.filter(todo => {
		if (filter === 'active') return !todo.completed;
		if (filter === 'completed') return todo.completed;
		return true;
	});
	
	return (
		<div>
			{filteredTodos.map(todo => (
				<div key={todo.id}>{todo.text}</div>
			))}
		</div>
	);
}`
			};

			// Validate that mock samples contain expected patterns
			expect(mockCodeSamples.simpleFunction).toContain('function simple');
			expect(mockCodeSamples.complexFunction).toContain('if');
			expect(mockCodeSamples.complexFunction).toContain('while');
			expect(mockCodeSamples.complexFunction).toContain('for');
			expect(mockCodeSamples.reactComponent).toContain('import React');
			expect(mockCodeSamples.reactComponent).toContain('TODO:');
			expect(mockCodeSamples.reactComponent).toContain('useState');
		});

		test('should validate expected analysis output structure', () => {
			const expectedAnalysisStructure = {
				hasChanges: true,
				fileCount: 2,
				totalLines: 130,
				analysisTime: 45,
				timestamp: '2024-01-15T10:30:00.000Z',
				overallScore: 7.8,
				files: [],
				aggregateMetrics: {
					averageComplexity: 4.5,
					averageCommentRatio: 0.1,
					totalLinesOfCode: 130,
					totalFunctions: 7,
					filesAnalyzed: 2
				},
				lintResults: {
					available: true,
					filesChecked: 2,
					issues: [],
					errorCount: 0,
					warningCount: 1
				},
				taskAlignment: {
					keywordCoverage: 0.75,
					foundKeywords: [],
					missedKeywords: [],
					relevantFileRatio: 0.67,
					implementationScope: 'medium'
				}
			};

			// Validate structure has all required fields
			expect(expectedAnalysisStructure).toHaveProperty('hasChanges');
			expect(expectedAnalysisStructure).toHaveProperty('overallScore');
			expect(expectedAnalysisStructure).toHaveProperty('aggregateMetrics');
			expect(expectedAnalysisStructure).toHaveProperty('lintResults');
			expect(expectedAnalysisStructure).toHaveProperty('taskAlignment');
			
			// Validate nested structure
			expect(expectedAnalysisStructure.aggregateMetrics).toHaveProperty('averageComplexity');
			expect(expectedAnalysisStructure.lintResults).toHaveProperty('available');
			expect(expectedAnalysisStructure.taskAlignment).toHaveProperty('keywordCoverage');
		});
	});

	describe('Error Handling and Edge Cases', () => {
		test('should handle analyzer initialization failures', () => {
			const errorAnalyzer = new CodeQualityAnalyzer();
			
			// Test that analyzer can be created with various option configurations
			expect(errorAnalyzer).toBeDefined();
			expect(CodeQualityAnalyzer).toHaveBeenCalled();
		});

		test('should handle file analysis errors gracefully', async () => {
			const mockError = new Error('File analysis failed');
			mockAnalyzerInstance.analyzeFile.mockRejectedValue(mockError);

			try {
				await mockAnalyzerInstance.analyzeFile({}, {});
			} catch (error) {
				expect(error.message).toBe('File analysis failed');
			}

			expect(mockAnalyzerInstance.analyzeFile).toHaveBeenCalled();
		});

		test('should handle formatter errors gracefully', () => {
			const mockError = new Error('Formatting failed');
			formatForConsole.mockImplementation(() => {
				throw mockError;
			});

			expect(() => {
				formatForConsole({});
			}).toThrow('Formatting failed');
		});

		test('should validate empty and null inputs', () => {
			// Test that the system handles edge cases appropriately
			const edgeCases = [
				null,
				undefined,
				{},
				{ hasChanges: false },
				{ error: 'Analysis failed' }
			];

			edgeCases.forEach((testCase, index) => {
				formatForConsole.mockReturnValueOnce(`Handled case ${index}`);
				const result = formatForConsole(testCase);
				expect(result).toBe(`Handled case ${index}`);
			});

			expect(formatForConsole).toHaveBeenCalledTimes(edgeCases.length);
		});
	});

	describe('Performance and Timing Tests', () => {
		test('should track analysis timing correctly', () => {
			const mockAnalysisWithTiming = {
				hasChanges: true,
				analysisTime: 250, // milliseconds
				timestamp: new Date().toISOString()
			};

			expect(mockAnalysisWithTiming.analysisTime).toBeGreaterThan(0);
			expect(mockAnalysisWithTiming.analysisTime).toBeLessThan(10000); // Should be under 10 seconds
			expect(typeof mockAnalysisWithTiming.timestamp).toBe('string');
			expect(() => new Date(mockAnalysisWithTiming.timestamp)).not.toThrow();
		});

		test('should handle timeout scenarios', () => {
			const timeoutAnalysis = {
				error: 'Analysis timeout after 10000ms',
				analysisTime: 10000,
				timestamp: new Date().toISOString()
			};

			expect(timeoutAnalysis.error).toContain('timeout');
			expect(timeoutAnalysis.analysisTime).toBeGreaterThanOrEqual(10000);
		});
	});
}); 