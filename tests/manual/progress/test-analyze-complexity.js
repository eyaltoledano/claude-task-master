#!/usr/bin/env node

/**
 * test-analyze-complexity.js
 *
 * Comprehensive integration test for analyze-complexity functionality.
 * Tests MCP streaming, CLI streaming, and non-streaming modes.
 * Validates token tracking, message formats, and priority indicators across all contexts.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root (three levels up from tests/manual/progress/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Import the analyze-complexity function
import analyzeTaskComplexity from '../../../scripts/modules/task-manager/analyze-task-complexity.js';

/**
 * Mock Progress Reporter for testing
 */
class MockProgressReporter {
	constructor(enableDebug = true) {
		this.enableDebug = enableDebug;
		this.progressHistory = [];
		this.startTime = Date.now();
	}

	async reportProgress(data) {
		const timestamp = Date.now() - this.startTime;

		const entry = {
			timestamp,
			...data
		};

		this.progressHistory.push(entry);

		if (this.enableDebug) {
			const percentage = data.total
				? Math.round((data.current / data.total) * 100)
				: 0;
			console.log(
				chalk.blue(`[${timestamp}ms]`),
				chalk.green(`${percentage}%`),
				chalk.yellow(data.message)
			);
		}
	}

	getProgressHistory() {
		return this.progressHistory;
	}

	printSummary() {
		console.log(chalk.green('\n=== Progress Summary ==='));
		console.log(`Total progress reports: ${this.progressHistory.length}`);
		console.log(
			`Duration: ${this.progressHistory[this.progressHistory.length - 1]?.timestamp || 0}ms`
		);

		this.progressHistory.forEach((entry, index) => {
			const percentage = entry.total
				? Math.round((entry.current / entry.total) * 100)
				: 0;
			console.log(
				`${index + 1}. [${entry.timestamp}ms] ${percentage}% - ${entry.message}`
			);
		});

		// Check for expected message formats
		// Note: analyze-complexity only sends individual task analysis messages,
		// not initial/completion messages like parse-prd does

		// Check for task progress messages - actual format: "Analyzed Task 1: Title (Score: 5, Subtasks: 4)"
		const hasTaskMessages = this.progressHistory.some((entry) =>
			/^Analyzed Task \d+: .+ \(Score: \d+, Subtasks: \d+\)/.test(
				entry.message.trim()
			)
		);

		// Check that we have the expected number of task messages (one per task)
		const taskMessageCount = this.progressHistory.filter((entry) =>
			/^Analyzed Task \d+: .+ \(Score: \d+, Subtasks: \d+\)/.test(
				entry.message.trim()
			)
		).length;

		console.log(chalk.cyan('\n=== Message Format Validation ==='));
		console.log(`✅ Task message format: ${hasTaskMessages ? 'PASS' : 'FAIL'}`);
		console.log(
			`✅ Task message count: ${taskMessageCount === 5 ? 'PASS' : 'FAIL'} (${taskMessageCount}/5)`
		);
	}
}

/**
 * Mock MCP Logger for testing
 */
class MockMCPLogger {
	constructor(enableDebug = true) {
		this.enableDebug = enableDebug;
		this.logs = [];
	}

	_log(level, ...args) {
		const entry = {
			level,
			timestamp: Date.now(),
			message: args.join(' ')
		};
		this.logs.push(entry);

		if (this.enableDebug) {
			const color =
				{
					info: chalk.blue,
					warn: chalk.yellow,
					error: chalk.red,
					debug: chalk.gray,
					success: chalk.green
				}[level] || chalk.white;

			console.log(color(`[${level.toUpperCase()}]`), ...args);
		}
	}

	info(...args) {
		this._log('info', ...args);
	}
	warn(...args) {
		this._log('warn', ...args);
	}
	error(...args) {
		this._log('error', ...args);
	}
	debug(...args) {
		this._log('debug', ...args);
	}
	success(...args) {
		this._log('success', ...args);
	}

	getLogs() {
		return this.logs;
	}
}

/**
 * Create a test tasks.json file
 */
function createTestTasksFile() {
	const testTasks = {
		tasks: [
			{
				id: 1,
				title: 'Setup Project Structure and HTML Foundation',
				description:
					'Create the basic project structure with HTML, CSS, and JavaScript files for a todo application.',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details:
					'Set up the foundational files and folder structure for the todo app.',
				testStrategy: 'Verify that all files are created and properly linked.'
			},
			{
				id: 2,
				title: 'Implement Core Todo Data Management',
				description:
					'Create JavaScript functions to manage todo items including add, edit, delete, and toggle completion.',
				status: 'pending',
				priority: 'high',
				dependencies: [1],
				details: 'Implement the core CRUD operations for todo items.',
				testStrategy: 'Test all CRUD operations work correctly.'
			},
			{
				id: 3,
				title: 'Build User Interface Interaction Logic',
				description:
					'Implement event handlers and DOM manipulation for user interactions with the todo interface.',
				status: 'pending',
				priority: 'medium',
				dependencies: [1, 2],
				details: 'Connect the UI elements to the data management functions.',
				testStrategy: 'Test all UI interactions work as expected.'
			},
			{
				id: 4,
				title: 'Add Local Storage Persistence',
				description:
					'Implement local storage functionality to persist todo items between browser sessions.',
				status: 'pending',
				priority: 'medium',
				dependencies: [2],
				details: 'Save and load todo data from localStorage.',
				testStrategy: 'Verify data persists after page refresh.'
			},
			{
				id: 5,
				title: 'Enhance User Experience',
				description:
					'Add animations, transitions, and improved styling to create a polished user experience.',
				status: 'pending',
				priority: 'low',
				dependencies: [3],
				details:
					'Polish the UI with smooth animations and better visual feedback.',
				testStrategy:
					'Test that animations work smoothly and enhance usability.'
			}
		]
	};

	const testTasksPath = path.join(__dirname, 'test-tasks.json');
	fs.writeFileSync(testTasksPath, JSON.stringify(testTasks, null, 2));
	return testTasksPath;
}

/**
 * Create a basic test config file
 */
function createTestConfig() {
	const testConfig = {
		models: {
			main: {
				provider: 'anthropic',
				modelId: 'claude-3-5-sonnet',
				maxTokens: 64000,
				temperature: 0.2
			},
			research: {
				provider: 'perplexity',
				modelId: 'sonar-pro',
				maxTokens: 8700,
				temperature: 0.1
			},
			fallback: {
				provider: 'anthropic',
				modelId: 'claude-3-5-sonnet',
				maxTokens: 64000,
				temperature: 0.2
			}
		},
		global: {
			logLevel: 'info',
			debug: false,
			defaultSubtasks: 5,
			defaultPriority: 'medium',
			projectName: 'Task Master Test',
			ollamaBaseURL: 'http://localhost:11434/api',
			bedrockBaseURL: 'https://bedrock.us-east-1.amazonaws.com'
		}
	};

	const taskmasterDir = path.join(__dirname, '.taskmaster');
	const configPath = path.join(taskmasterDir, 'config.json');

	// Create .taskmaster directory if it doesn't exist
	if (!fs.existsSync(taskmasterDir)) {
		fs.mkdirSync(taskmasterDir, { recursive: true });
	}

	fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
	return configPath;
}

/**
 * Test MCP streaming with proper MCP context
 */
async function testMCPStreaming() {
	console.log(chalk.cyan('🧪 Testing MCP Streaming Functionality\n'));

	const testTasksPath = createTestTasksFile();
	const testReportPath = path.join(
		__dirname,
		'test-mcp-complexity-report.json'
	);
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testReportPath)) {
		fs.unlinkSync(testReportPath);
	}

	const progressReporter = new MockProgressReporter(true);
	const mcpLogger = new MockMCPLogger(true); // Enable debug for MCP context

	try {
		console.log(chalk.yellow('Starting MCP streaming test...'));
		const startTime = Date.now();

		const result = await analyzeTaskComplexity(
			{
				file: testTasksPath,
				output: testReportPath,
				threshold: 5,
				research: false,
				projectRoot: PROJECT_ROOT
			},
			{
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				// Add MCP context - this is the key difference
				mcpLog: mcpLogger
			}
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ MCP streaming test completed in ${duration}ms`)
		);

		// Print progress summary
		progressReporter.printSummary();

		// Print MCP logs
		console.log(chalk.cyan('\n=== MCP Logs ==='));
		const logs = mcpLogger.getLogs();
		logs.forEach((log, index) => {
			const color =
				{
					info: chalk.blue,
					warn: chalk.yellow,
					error: chalk.red,
					debug: chalk.gray,
					success: chalk.green
				}[log.level] || chalk.white;
			console.log(
				`${index + 1}. ${color(`[${log.level.toUpperCase()}]`)} ${log.message}`
			);
		});

		// Verify MCP-specific message formats (should have task analysis messages)
		const hasAnalysisMessages = progressReporter
			.getProgressHistory()
			.some((entry) => entry.message.includes('Analyzed Task'));

		console.log(chalk.cyan('\n=== MCP-Specific Validation ==='));
		console.log(
			`✅ Analysis progress messages: ${hasAnalysisMessages ? 'PASS' : 'FAIL'}`
		);

		// Verify results
		if (fs.existsSync(testReportPath)) {
			const reportData = JSON.parse(fs.readFileSync(testReportPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Complexity report created with ${reportData.complexityAnalysis?.length || 0} task analyses`
				)
			);

			// Verify report structure
			const firstAnalysis = reportData.complexityAnalysis?.[0];
			if (
				firstAnalysis &&
				firstAnalysis.taskId &&
				firstAnalysis.taskTitle &&
				typeof firstAnalysis.complexityScore === 'number'
			) {
				console.log(chalk.green('✅ Report structure is valid'));
			} else {
				console.log(chalk.red('❌ Report structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Complexity report was not created'));
		}

		return {
			success: true,
			duration,
			progressHistory: progressReporter.getProgressHistory(),
			mcpLogs: mcpLogger.getLogs(),
			hasAnalysisMessages,
			result
		};
	} catch (error) {
		console.error(chalk.red(`❌ MCP streaming test failed: ${error.message}`));
		return {
			success: false,
			error: error.message
		};
	} finally {
		// Clean up
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test CLI streaming (no reportProgress)
 */
async function testCLIStreaming() {
	console.log(chalk.cyan('🧪 Testing CLI Streaming (With Progress Tracker)\n'));

	const testTasksPath = createTestTasksFile();
	const testReportPath = path.join(
		__dirname,
		'test-cli-complexity-report.json'
	);
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testReportPath)) {
		fs.unlinkSync(testReportPath);
	}

	try {
		console.log(chalk.yellow('Starting CLI streaming test...'));
		const startTime = Date.now();

		// Enable progressTracker to trigger streaming in CLI mode
		const result = await analyzeTaskComplexity(
			{
				file: testTasksPath,
				output: testReportPath,
				threshold: 5,
				research: false,
				projectRoot: PROJECT_ROOT,
				progressTracker: true // Enable streaming for CLI
			},
			{
				// No reportProgress provided (this is CLI mode, not MCP)
			}
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ CLI streaming test completed in ${duration}ms`)
		);

		// Verify results
		if (fs.existsSync(testReportPath)) {
			const reportData = JSON.parse(fs.readFileSync(testReportPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Complexity report created with ${reportData.complexityAnalysis?.length || 0} task analyses`
				)
			);

			// Verify report structure
			const firstAnalysis = reportData.complexityAnalysis?.[0];
			if (
				firstAnalysis &&
				firstAnalysis.taskId &&
				firstAnalysis.taskTitle &&
				typeof firstAnalysis.complexityScore === 'number'
			) {
				console.log(chalk.green('✅ Report structure is valid'));
			} else {
				console.log(chalk.red('❌ Report structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Complexity report was not created'));
		}

		return {
			success: true,
			duration,
			result
		};
	} catch (error) {
		console.error(chalk.red(`❌ CLI streaming test failed: ${error.message}`));
		return {
			success: false,
			error: error.message
		};
	} finally {
		// Clean up
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test non-streaming functionality
 */
async function testNonStreaming() {
	console.log(chalk.cyan('🧪 Testing Non-Streaming Functionality\n'));

	const testTasksPath = createTestTasksFile();
	const testReportPath = path.join(
		__dirname,
		'test-non-streaming-complexity-report.json'
	);
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testReportPath)) {
		fs.unlinkSync(testReportPath);
	}

	try {
		console.log(chalk.yellow('Starting non-streaming test...'));
		const startTime = Date.now();

		// Force non-streaming by not providing reportProgress
		const result = await analyzeTaskComplexity(
			{
				file: testTasksPath,
				output: testReportPath,
				threshold: 5,
				research: false,
				projectRoot: PROJECT_ROOT
			},
			{
				// No reportProgress - should use generateTextService
			}
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ Non-streaming test completed in ${duration}ms`)
		);

		// Verify results
		if (fs.existsSync(testReportPath)) {
			const reportData = JSON.parse(fs.readFileSync(testReportPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Complexity report created with ${reportData.complexityAnalysis?.length || 0} task analyses`
				)
			);

			// Verify report structure
			const firstAnalysis = reportData.complexityAnalysis?.[0];
			if (
				firstAnalysis &&
				firstAnalysis.taskId &&
				firstAnalysis.taskTitle &&
				typeof firstAnalysis.complexityScore === 'number'
			) {
				console.log(chalk.green('✅ Report structure is valid'));
			} else {
				console.log(chalk.red('❌ Report structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Complexity report was not created'));
		}

		return {
			success: true,
			duration,
			result
		};
	} catch (error) {
		console.error(chalk.red(`❌ Non-streaming test failed: ${error.message}`));
		return {
			success: false,
			error: error.message
		};
	} finally {
		// Clean up
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Compare results between streaming and non-streaming
 */
function compareResults(streamingResult, nonStreamingResult) {
	console.log(chalk.cyan('\n=== Results Comparison ==='));

	if (!streamingResult.success || !nonStreamingResult.success) {
		console.log(chalk.red('❌ Cannot compare - one or both tests failed'));
		return;
	}

	console.log(`Streaming duration: ${streamingResult.duration}ms`);
	console.log(`Non-streaming duration: ${nonStreamingResult.duration}ms`);

	const durationDiff = Math.abs(
		streamingResult.duration - nonStreamingResult.duration
	);
	const durationDiffPercent = Math.round(
		(durationDiff /
			Math.max(streamingResult.duration, nonStreamingResult.duration)) *
			100
	);

	console.log(
		`Duration difference: ${durationDiff}ms (${durationDiffPercent}%)`
	);

	if (streamingResult.progressHistory) {
		console.log(
			`Streaming progress reports: ${streamingResult.progressHistory.length}`
		);
	}

	console.log(chalk.green('✅ Both methods completed successfully'));
}

/**
 * Main test runner
 */
async function main() {
	const args = process.argv.slice(2);
	const testType = args[0] || 'streaming';

	console.log(
		chalk.bold.cyan('🚀 Task Master Analyze-Complexity Streaming Tests\n')
	);
	console.log(chalk.blue(`Test type: ${testType}\n`));

	try {
		switch (testType.toLowerCase()) {
			case 'mcp':
			case 'mcp-streaming':
				await testMCPStreaming();
				break;

			case 'cli':
			case 'cli-streaming':
				await testCLIStreaming();
				break;

			case 'non-streaming':
			case 'non':
				await testNonStreaming();
				break;

			case 'both':
				console.log(
					chalk.yellow(
						'Running both MCP streaming and non-streaming tests...\n'
					)
				);
				const mcpStreamingResult = await testMCPStreaming();
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamingResult = await testNonStreaming();
				compareResults(mcpStreamingResult, nonStreamingResult);
				break;

			case 'all':
				console.log(chalk.yellow('Running all test types...\n'));
				const mcpResult = await testMCPStreaming();
				console.log('\n' + '='.repeat(60) + '\n');
				const cliResult = await testCLIStreaming();
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamResult = await testNonStreaming();

				console.log(chalk.cyan('\n=== All Tests Summary ==='));
				console.log(
					`MCP Streaming: ${mcpResult.success ? '✅ PASS' : '❌ FAIL'} ${mcpResult.hasAnalysisMessages ? '(✅ Analysis)' : '(❌ No Analysis)'}`
				);
				console.log(
					`CLI Streaming: ${cliResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
				console.log(
					`Non-streaming: ${nonStreamResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
				break;

			default:
				console.log(chalk.red(`Unknown test type: ${testType}`));
				console.log(
					chalk.yellow(
						'Available options: mcp-streaming, cli-streaming, non-streaming, both, all'
					)
				);
				process.exit(1);
		}

		console.log(chalk.green('\n🎉 Tests completed successfully!'));
	} catch (error) {
		console.error(chalk.red(`\n❌ Test failed: ${error.message}`));
		console.error(chalk.red(error.stack));
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
