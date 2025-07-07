import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// Mock fs/promises
jest.unstable_mockModule('fs/promises', () => ({
	readFile: jest.fn(),
	access: jest.fn()
}));

// Mock child_process
jest.unstable_mockModule('child_process', () => ({
	spawn: jest.fn()
}));

// Import the module to test after mocks
const { CodeQualityAnalyzer } = await import(
	'../../../../scripts/modules/flow/hooks/quality/code-quality-analyzer.js'
);

describe('CodeQualityAnalyzer', () => {
	let analyzer;
	let mockWorktree;
	let mockServices;
	let mockSession;
	let mockTask;

	beforeEach(() => {
		jest.clearAllMocks();

		analyzer = new CodeQualityAnalyzer({
			enableBiomeAnalysis: true,
			enableComplexityAnalysis: true,
			enableStructuralAnalysis: true,
			enableTaskAlignment: true,
			maxAnalysisTimeMs: 10000
		});

		mockWorktree = {
			path: '/test/project'
		};

		mockServices = {};

		mockSession = {
			id: 'test-session-123'
		};

		mockTask = {
			id: '5.2',
			title: 'Implement Todo List Component',
			description:
				'Create a React component for displaying and filtering todos',
			details:
				'Should include filtering, toggle functionality, and delete capability',
			isSubtask: true
		};
	});

	describe('constructor', () => {
		test('should initialize with default options', () => {
			const defaultAnalyzer = new CodeQualityAnalyzer();
			expect(defaultAnalyzer.options.enableBiomeAnalysis).toBe(true);
			expect(defaultAnalyzer.options.enableComplexityAnalysis).toBe(true);
			expect(defaultAnalyzer.options.maxAnalysisTimeMs).toBe(10000);
		});

		test('should initialize with custom options', () => {
			const customAnalyzer = new CodeQualityAnalyzer({
				enableBiomeAnalysis: false,
				maxAnalysisTimeMs: 5000
			});
			expect(customAnalyzer.options.enableBiomeAnalysis).toBe(false);
			expect(customAnalyzer.options.maxAnalysisTimeMs).toBe(5000);
		});
	});

	describe('analyzeSession', () => {
		test('should return no changes when no files are detected', async () => {
			// Mock git diff returning empty
			jest.spyOn(analyzer, 'executeCommand').mockResolvedValue({
				stdout: '',
				stderr: '',
				code: 0
			});

			const result = await analyzer.analyzeSession(
				mockSession,
				mockTask,
				mockWorktree,
				mockServices
			);

			expect(result.hasChanges).toBe(false);
			expect(result.message).toBe('No code changes detected');
			expect(result.timestamp).toBeDefined();
		});

		test('should analyze session with changed files successfully', async () => {
			const mockGitOutput =
				'M\tsrc/components/TodoList.jsx\nA\tsrc/utils/helpers.js';
			const mockFileContent = `import React from 'react';
export function TodoList() {
	return <div>Todo List</div>;
}`;

			// Mock git diff
			jest.spyOn(analyzer, 'executeCommand').mockResolvedValue({
				stdout: mockGitOutput,
				stderr: '',
				code: 0
			});

			// Mock file reading
			fs.readFile.mockResolvedValue(mockFileContent);

			// Mock Biome analysis
			jest.spyOn(analyzer, 'runBiomeAnalysis').mockResolvedValue({
				available: true,
				filesChecked: 2,
				issues: [],
				errorCount: 0,
				warningCount: 0
			});

			const result = await analyzer.analyzeSession(
				mockSession,
				mockTask,
				mockWorktree,
				mockServices
			);

			expect(result.hasChanges).toBe(true);
			expect(result.fileCount).toBe(2);
			expect(result.files).toHaveLength(2);
			expect(result.aggregateMetrics).toBeDefined();
			expect(result.lintResults).toBeDefined();
			expect(result.taskAlignment).toBeDefined();
			expect(result.overallScore).toBeGreaterThan(0);
			expect(result.overallScore).toBeLessThanOrEqual(10);
		});

		test('should handle analysis errors gracefully', async () => {
			jest
				.spyOn(analyzer, 'executeCommand')
				.mockRejectedValue(new Error('Git command failed'));

			const result = await analyzer.analyzeSession(
				mockSession,
				mockTask,
				mockWorktree,
				mockServices
			);

			expect(result.error).toBeDefined();
			expect(result.analysisTime).toBeDefined();
			expect(result.timestamp).toBeDefined();
		});
	});

	describe('getSessionChanges', () => {
		test('should parse git diff output correctly', async () => {
			const mockGitOutput =
				'M\tsrc/components/TodoList.jsx\nA\tsrc/utils/helpers.js\nD\tpackage-lock.json';
			const mockTodoContent = 'React component content';
			const mockHelperContent = 'Helper functions';

			jest.spyOn(analyzer, 'executeCommand').mockResolvedValue({
				stdout: mockGitOutput,
				stderr: '',
				code: 0
			});

			fs.readFile
				.mockResolvedValueOnce(mockTodoContent)
				.mockResolvedValueOnce(mockHelperContent);

			const changes = await analyzer.getSessionChanges(
				mockWorktree,
				mockServices
			);

			expect(changes).toHaveLength(2); // Only .jsx and .js files, not .json
			expect(changes[0]).toEqual({
				path: 'src/components/TodoList.jsx',
				fullPath: '/test/project/src/components/TodoList.jsx',
				status: 'M',
				content: mockTodoContent,
				size: mockTodoContent.length
			});
		});

		test('should handle git command failure', async () => {
			jest
				.spyOn(analyzer, 'executeCommand')
				.mockRejectedValue(new Error('Git failed'));

			const changes = await analyzer.getSessionChanges(
				mockWorktree,
				mockServices
			);

			expect(changes).toEqual([]);
		});

		test('should filter out non-analyzable files', async () => {
			const mockGitOutput =
				'M\tsrc/test.js\nA\tnode_modules/package.json\nM\t.git/config';

			jest.spyOn(analyzer, 'executeCommand').mockResolvedValue({
				stdout: mockGitOutput,
				stderr: '',
				code: 0
			});

			fs.readFile.mockResolvedValue('test content');

			const changes = await analyzer.getSessionChanges(
				mockWorktree,
				mockServices
			);

			expect(changes).toHaveLength(1);
			expect(changes[0].path).toBe('src/test.js');
		});
	});

	describe('analyzeFile', () => {
		test('should analyze JavaScript file correctly', async () => {
			const change = {
				path: 'src/components/TodoList.jsx',
				status: 'M',
				size: 1200,
				content: `import React, { useState } from 'react';

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

			const result = await analyzer.analyzeFile(change, mockTask);

			expect(result.path).toBe('src/components/TodoList.jsx');
			expect(result.status).toBe('M');
			expect(result.size).toBe(1200);
			expect(result.language).toBe('javascript');
			expect(result.metrics.linesOfCode).toBeGreaterThan(0);
			expect(result.metrics.complexity).toBeDefined();
			expect(result.jsMetrics).toBeDefined();
			expect(result.jsMetrics.functionCount).toBe(1);
			expect(result.jsMetrics.importCount).toBe(1);
			expect(result.jsMetrics.todoComments).toBe(1);
		});

		test('should handle analysis errors', async () => {
			const change = {
				path: 'test.js',
				status: 'A',
				size: 100,
				content: null // This should cause an error
			};

			const result = await analyzer.analyzeFile(change, mockTask);

			expect(result.issues).toHaveLength(1);
			expect(result.issues[0]).toContain('Analysis error:');
		});
	});

	describe('calculateStructuralMetrics', () => {
		test('should calculate basic metrics correctly', () => {
			const code = `// Header comment
const x = 1;

// Another comment
function test() {
	return 'hello world from a long line that exceeds normal length';
}

`;
			const metrics = analyzer.calculateStructuralMetrics(code);

			expect(metrics.totalLines).toBe(8);
			expect(metrics.linesOfCode).toBe(4); // Non-empty lines
			expect(metrics.commentLines).toBe(2);
			expect(metrics.blankLines).toBe(2);
			expect(metrics.commentRatio).toBeCloseTo(0.5); // 2 comments / 4 code lines
			expect(metrics.maxLineLength).toBeGreaterThan(50);
		});

		test('should handle empty code', () => {
			const metrics = analyzer.calculateStructuralMetrics('');

			expect(metrics.totalLines).toBe(1);
			expect(metrics.linesOfCode).toBe(0);
			expect(metrics.commentLines).toBe(0);
		});
	});

	describe('calculateComplexity', () => {
		test('should calculate JavaScript complexity correctly', () => {
			const code = `function test(x) {
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
}`;

			const complexity = analyzer.calculateComplexity(code, 'javascript');

			expect(complexity.cyclomaticComplexity).toBeGreaterThan(1);
			expect(complexity.complexityLevel).toBeDefined();
			expect(['low', 'medium', 'high', 'very-high']).toContain(
				complexity.complexityLevel
			);
		});

		test('should handle simple code with low complexity', () => {
			const code = `function simple() {
	return 'hello';
}`;

			const complexity = analyzer.calculateComplexity(code, 'javascript');

			expect(complexity.cyclomaticComplexity).toBe(1);
			expect(complexity.complexityLevel).toBe('low');
		});
	});

	describe('analyzeJavaScript', () => {
		test('should analyze JavaScript patterns correctly', () => {
			const code = `import React from 'react';
import { useState } from 'react';

// TODO: Refactor this component
export default class TodoApp extends React.Component {
	async componentDidMount() {
		console.log('Component mounted');
		const data = await fetch('/api/todos')
			.then(response => response.json())
			.catch(error => console.error(error));
	}
	
	render() {
		return <div>App</div>;
	}
}

export const helper = () => {};`;

			const metrics = analyzer.analyzeJavaScript(code);

			expect(metrics.functionCount).toBeGreaterThan(0);
			expect(metrics.classCount).toBe(1);
			expect(metrics.importCount).toBe(2);
			expect(metrics.exportCount).toBe(2);
			expect(metrics.asyncFunctionCount).toBe(1);
			expect(metrics.promiseUsage).toBeGreaterThan(0);
			expect(metrics.consoleUsage).toBe(2);
			expect(metrics.todoComments).toBe(1);
		});
	});

	describe('runBiomeAnalysis', () => {
		test('should run Biome analysis successfully', async () => {
			const mockChanges = [
				{ path: 'src/test.js', content: 'test' },
				{ path: 'src/test.jsx', content: 'test jsx' }
			];

			// Mock biome.json exists
			fs.access.mockResolvedValue();

			// Mock Biome command execution
			const mockBiomeOutput = {
				summary: { files: 2 },
				diagnostics: [
					{
						severity: 'warning',
						description: 'Use const instead of let',
						location: { path: 'src/test.js', span: { start: 10 } }
					}
				]
			};

			jest.spyOn(analyzer, 'executeCommand').mockResolvedValue({
				stdout: JSON.stringify(mockBiomeOutput),
				stderr: '',
				code: 0
			});

			const result = await analyzer.runBiomeAnalysis(mockChanges, mockWorktree);

			expect(result.available).toBe(true);
			expect(result.filesChecked).toBe(2);
			expect(result.issues).toHaveLength(1);
			expect(result.warningCount).toBe(1);
			expect(result.errorCount).toBe(0);
		});

		test('should handle missing biome.json', async () => {
			fs.access.mockRejectedValue(new Error('File not found'));

			const result = await analyzer.runBiomeAnalysis([], mockWorktree);

			expect(result.available).toBe(false);
			expect(result.reason).toBe('No biome.json found');
		});

		test('should handle Biome command failure', async () => {
			fs.access.mockResolvedValue();
			jest
				.spyOn(analyzer, 'executeCommand')
				.mockRejectedValue(new Error('Biome failed'));

			const result = await analyzer.runBiomeAnalysis(
				[{ path: 'test.js' }],
				mockWorktree
			);

			expect(result.available).toBe(false);
			expect(result.error).toBe('Biome failed');
		});
	});

	describe('analyzeTaskAlignment', () => {
		test('should analyze task alignment correctly', async () => {
			const mockChanges = [
				{
					path: 'src/TodoList.jsx',
					content: 'React component for todo filtering and display'
				},
				{
					path: 'src/helpers.js',
					content: 'helper functions for component logic'
				}
			];

			const result = await analyzer.analyzeTaskAlignment(mockChanges, mockTask);

			expect(result.keywordCoverage).toBeGreaterThan(0);
			expect(result.foundKeywords).toBeInstanceOf(Array);
			expect(result.missedKeywords).toBeInstanceOf(Array);
			expect(result.relevantFileRatio).toBeGreaterThan(0);
			expect(result.implementationScope).toBeDefined();
		});
	});

	describe('calculateAggregateMetrics', () => {
		test('should calculate aggregate metrics correctly', () => {
			const fileAnalyses = [
				{
					metrics: {
						linesOfCode: 100,
						complexity: { cyclomaticComplexity: 5 },
						commentLines: 10
					},
					jsMetrics: { functionCount: 3 }
				},
				{
					metrics: {
						linesOfCode: 200,
						complexity: { cyclomaticComplexity: 15 },
						commentLines: 30
					},
					jsMetrics: { functionCount: 7 }
				}
			];

			const aggregate = analyzer.calculateAggregateMetrics(fileAnalyses);

			expect(aggregate.totalLinesOfCode).toBe(300);
			expect(aggregate.averageComplexity).toBe(10);
			expect(aggregate.totalFunctions).toBe(10);
			expect(aggregate.filesAnalyzed).toBe(2);
			expect(aggregate.complexityDistribution).toBeDefined();
		});

		test('should handle empty file analyses', () => {
			const aggregate = analyzer.calculateAggregateMetrics([]);
			expect(aggregate).toEqual({});
		});
	});

	describe('calculateOverallScore', () => {
		test('should calculate high score for good quality code', () => {
			const analysis = {
				aggregateMetrics: {
					averageComplexity: 3,
					averageCommentRatio: 0.25
				},
				lintResults: {
					issues: []
				},
				taskAlignment: {
					keywordCoverage: 0.8
				}
			};

			const score = analyzer.calculateOverallScore(analysis);

			expect(score).toBeGreaterThanOrEqual(8);
			expect(score).toBeLessThanOrEqual(10);
		});

		test('should calculate low score for problematic code', () => {
			const analysis = {
				aggregateMetrics: {
					averageComplexity: 25,
					averageCommentRatio: 0.05
				},
				lintResults: {
					issues: new Array(10).fill({ severity: 'error' })
				},
				taskAlignment: {
					keywordCoverage: 0.2
				}
			};

			const score = analyzer.calculateOverallScore(analysis);

			expect(score).toBeGreaterThanOrEqual(1);
			expect(score).toBeLessThanOrEqual(5);
		});
	});

	describe('helper methods', () => {
		test('shouldAnalyzeFile should filter correctly', () => {
			expect(analyzer.shouldAnalyzeFile('src/test.js')).toBe(true);
			expect(analyzer.shouldAnalyzeFile('src/test.tsx')).toBe(true);
			expect(analyzer.shouldAnalyzeFile('package.json')).toBe(true);
			expect(analyzer.shouldAnalyzeFile('README.md')).toBe(true);

			expect(analyzer.shouldAnalyzeFile('node_modules/package.json')).toBe(
				false
			);
			expect(analyzer.shouldAnalyzeFile('.git/config')).toBe(false);
			expect(analyzer.shouldAnalyzeFile('dist/bundle.js')).toBe(false);
			expect(analyzer.shouldAnalyzeFile('test.txt')).toBe(false);
		});

		test('detectLanguage should detect correctly', () => {
			expect(analyzer.detectLanguage('test.js')).toBe('javascript');
			expect(analyzer.detectLanguage('test.jsx')).toBe('javascript');
			expect(analyzer.detectLanguage('test.ts')).toBe('typescript');
			expect(analyzer.detectLanguage('test.tsx')).toBe('typescript');
			expect(analyzer.detectLanguage('package.json')).toBe('json');
			expect(analyzer.detectLanguage('README.md')).toBe('markdown');
			expect(analyzer.detectLanguage('test.py')).toBe('unknown');
		});

		test('getComplexityLevel should categorize correctly', () => {
			expect(analyzer.getComplexityLevel(3)).toBe('low');
			expect(analyzer.getComplexityLevel(8)).toBe('medium');
			expect(analyzer.getComplexityLevel(15)).toBe('high');
			expect(analyzer.getComplexityLevel(25)).toBe('very-high');
		});

		test('extractTaskKeywords should extract correctly', () => {
			const keywords = analyzer.extractTaskKeywords(mockTask);

			expect(keywords).toBeInstanceOf(Array);
			expect(keywords.length).toBeGreaterThan(0);
			expect(keywords).toContain('implement');
			expect(keywords).toContain('component');
			expect(keywords).not.toContain('the'); // Common words should be filtered
		});

		test('isCommonWord should identify common words', () => {
			expect(analyzer.isCommonWord('the')).toBe(true);
			expect(analyzer.isCommonWord('and')).toBe(true);
			expect(analyzer.isCommonWord('implement')).toBe(false);
			expect(analyzer.isCommonWord('component')).toBe(false);
		});
	});

	describe('executeCommand', () => {
		test('should execute command successfully', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn(),
				kill: jest.fn()
			};

			spawn.mockReturnValue(mockChild);

			// Simulate successful command execution
			setTimeout(() => {
				const stdoutCallback = mockChild.stdout.on.mock.calls.find(
					(call) => call[0] === 'data'
				)[1];
				const closeCallback = mockChild.on.mock.calls.find(
					(call) => call[0] === 'close'
				)[1];

				stdoutCallback('test output');
				closeCallback(0);
			}, 10);

			const result = await analyzer.executeCommand(
				'test command',
				'/test/path'
			);

			expect(result.stdout).toBe('test output');
			expect(result.code).toBe(0);
		});

		test('should handle command timeout', async () => {
			const mockChild = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn(),
				kill: jest.fn()
			};

			spawn.mockReturnValue(mockChild);

			// Don't trigger any callbacks to simulate timeout

			await expect(
				analyzer.executeCommand('slow command', '/test/path')
			).rejects.toThrow('Command timeout');

			// Should kill the process
			expect(mockChild.kill).toHaveBeenCalled();
		});
	});
});
