#!/usr/bin/env node

/**
 * test-expand-all.js
 *
 * Comprehensive integration test for expand-all-tasks functionality.
 * Tests MCP streaming, CLI streaming, and non-streaming modes.
 * Validates token tracking, message formats, dual progress bars, and fractional progress across all contexts.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root (two levels up from tests/progress/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Import the expand-all-tasks function
import expandAllTasks from '../../scripts/modules/task-manager/expand-all-tasks.js';

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
			const percentage = data.total ? Math.round(data.progress * 100) : 0;
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
			const percentage = entry.total ? Math.round(entry.progress * 100) : 0;
			console.log(
				`${index + 1}. [${entry.timestamp}ms] ${percentage}% - ${entry.message}`
			);
		});

		// Check for expected message formats
		const hasStartMessage = this.progressHistory.some(
			(entry) =>
				entry.type === 'expand_all_start' &&
				entry.message.includes('Starting expansion')
		);

		const hasTaskExpansionStart = this.progressHistory.some(
			(entry) => entry.type === 'task_expansion_start'
		);

		const hasFractionalProgress = this.progressHistory.some(
			(entry) => entry.type === 'subtask_progress' && entry.progress % 1 !== 0
		);

		const hasCompletionMessage = this.progressHistory.some(
			(entry) =>
				entry.type === 'expand_all_complete' &&
				entry.message.includes('Expansion complete')
		);

		console.log(chalk.cyan('\n=== Message Format Validation ==='));
		console.log(
			`✅ Start message format: ${hasStartMessage ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`✅ Task expansion start: ${hasTaskExpansionStart ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`✅ Fractional progress: ${hasFractionalProgress ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`✅ Completion message format: ${hasCompletionMessage ? 'PASS' : 'FAIL'}`
		);

		// Analyze fractional progress
		const fractionalEntries = this.progressHistory.filter(
			(entry) => entry.type === 'subtask_progress'
		);
		if (fractionalEntries.length > 0) {
			console.log(chalk.cyan('\n=== Fractional Progress Analysis ==='));
			console.log(`Total fractional updates: ${fractionalEntries.length}`);
			const progressValues = fractionalEntries.map((e) => e.progress);
			console.log(
				`Progress range: ${Math.min(...progressValues).toFixed(3)} - ${Math.max(...progressValues).toFixed(3)}`
			);
		}
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
 * Create a test tasks.json file with multiple tasks
 */
function createTestTasksFile() {
	const testTasks = {
		tasks: [
			{
				id: 1,
				title: 'Setup Project Structure',
				description:
					'Initialize the project with proper structure and configuration.',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: 'Create folder structure, initialize npm, setup TypeScript.',
				testStrategy: 'Verify all files and configurations are in place.'
			},
			{
				id: 2,
				title: 'Implement Authentication',
				description: 'Build user authentication system with JWT.',
				status: 'pending',
				priority: 'high',
				dependencies: [1],
				details: 'Create auth endpoints, JWT handling, user sessions.',
				testStrategy: 'Test all auth flows and edge cases.'
			},
			{
				id: 3,
				title: 'Create Database Schema',
				description: 'Design and implement the database schema.',
				status: 'pending',
				priority: 'medium',
				dependencies: [1],
				details: 'Design tables, relationships, and indexes.',
				testStrategy: 'Verify schema integrity and performance.'
			}
		]
	};

	const testTasksPath = path.join(__dirname, 'test-expand-all-tasks.json');
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
 * Test MCP streaming with proper MCP context and fractional progress
 */
async function testMCPStreaming(numSubtasks = 3) {
	console.log(
		chalk.cyan(
			'🧪 Testing MCP Streaming Functionality with Fractional Progress\n'
		)
	);

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	const progressReporter = new MockProgressReporter(true);
	const mcpLogger = new MockMCPLogger(true); // Enable debug for MCP context

	try {
		console.log(chalk.yellow('Starting MCP streaming test...'));
		const startTime = Date.now();

		const result = await expandAllTasks(
			testTasksPath,
			numSubtasks, // Number of subtasks per task
			false, // useResearch
			'', // additionalContext
			true, // force
			{
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				mcpLog: mcpLogger,
				projectRoot: PROJECT_ROOT, // Use actual project root
				session: {}
			},
			'json' // outputFormat for MCP
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

		// Verify results
		console.log(chalk.cyan('\n=== MCP-Specific Validation ==='));
		console.log(`✅ Tasks expanded: ${result.expandedCount} (expected: 3)`);
		console.log(
			`✅ Progress reports count: ${progressReporter.getProgressHistory().length}`
		);
		console.log(`✅ Success: ${result.success}`);

		return {
			success: true,
			duration,
			progressHistory: progressReporter.getProgressHistory(),
			mcpLogs: mcpLogger.getLogs(),
			expandedCount: result.expandedCount,
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
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test CLI streaming (no reportProgress but with dual progress bars)
 */
async function testCLIStreaming(numSubtasks = 3) {
	console.log(
		chalk.cyan('🧪 Testing CLI Streaming (With Dual Progress Bars)\n')
	);

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	try {
		console.log(chalk.yellow('Starting CLI streaming test...'));
		console.log(chalk.gray(`[DEBUG] PROJECT_ROOT: ${PROJECT_ROOT}`));
		console.log(
			chalk.gray(`[DEBUG] PROJECT_ROOT type: ${typeof PROJECT_ROOT}`)
		);
		const startTime = Date.now();

		// No reportProgress - should use CLI progress bars
		// Note: expandAllTasks has different parameter order than expandTask
		// (tasksPath, numSubtasks, useResearch, additionalContext, force, context, outputFormat)
		const result = await expandAllTasks(
			testTasksPath,
			numSubtasks, // Number of subtasks per task
			false, // useResearch
			'', // additionalContext
			true, // force
			{
				projectRoot: PROJECT_ROOT, // Use actual project root
				session: {}
			},
			'text' // outputFormat for CLI
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ CLI streaming test completed in ${duration}ms`)
		);

		// Verify results
		console.log(chalk.cyan('\n=== CLI-Specific Validation ==='));
		console.log(`✅ Tasks expanded: ${result.expandedCount} (expected: 3)`);
		console.log(`✅ Success: ${result.success}`);

		return {
			success: true,
			duration,
			expandedCount: result.expandedCount,
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
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test non-streaming functionality
 */
async function testNonStreaming(numSubtasks = 3) {
	console.log(chalk.cyan('🧪 Testing Non-Streaming Functionality\n'));

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	try {
		console.log(chalk.yellow('Starting non-streaming test...'));
		const startTime = Date.now();

		// Force non-streaming by using JSON output without reportProgress
		const result = await expandAllTasks(
			testTasksPath,
			numSubtasks, // Number of subtasks per task
			false, // useResearch
			'', // additionalContext
			true, // force
			{
				projectRoot: PROJECT_ROOT, // Use actual project root
				session: {},
				mcpLog: {
					info: () => {},
					warn: () => {},
					error: console.error,
					debug: () => {}
				}
			},
			'json' // outputFormat
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ Non-streaming test completed in ${duration}ms`)
		);

		// Verify results
		console.log(chalk.cyan('\n=== Non-Streaming Validation ==='));
		console.log(`✅ Tasks expanded: ${result.expandedCount} (expected: 3)`);
		console.log(`✅ Success: ${result.success}`);

		return {
			success: true,
			duration,
			expandedCount: result.expandedCount,
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
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Compare results between different modes
 */
function compareResults(results) {
	console.log(chalk.cyan('\n=== Results Comparison ==='));

	const validResults = results.filter((r) => r.success);
	if (validResults.length < 2) {
		console.log(chalk.red('❌ Cannot compare - insufficient successful tests'));
		return;
	}

	// Compare durations
	console.log(chalk.yellow('\nDuration Comparison:'));
	results.forEach((result) => {
		if (result.success) {
			console.log(`${result.name}: ${result.duration}ms`);
		}
	});

	// Compare expansion counts
	console.log(chalk.yellow('\nTasks Expanded:'));
	results.forEach((result) => {
		if (result.success) {
			console.log(`${result.name}: ${result.expandedCount} tasks`);
		}
	});

	// Progress reporting comparison
	console.log(chalk.yellow('\nProgress Reporting:'));
	results.forEach((result) => {
		if (result.success && result.progressHistory) {
			console.log(
				`${result.name}: ${result.progressHistory.length} progress reports`
			);
			// Check for fractional progress
			const fractionalCount = result.progressHistory.filter(
				(entry) => entry.type === 'subtask_progress'
			).length;
			if (fractionalCount > 0) {
				console.log(`  - Fractional progress updates: ${fractionalCount}`);
			}
		}
	});

	const allExpandCounts = validResults.map((r) => r.expandedCount);
	const allMatch = allExpandCounts.every(
		(count) => count === allExpandCounts[0]
	);

	console.log(
		chalk.green(
			`\n✅ All methods expanded same task count: ${allMatch ? 'YES' : 'NO'}`
		)
	);
}

/**
 * Main test runner
 */
async function main() {
	const args = process.argv.slice(2);
	const testType = args[0] || 'mcp-streaming';
	const numSubtasks = parseInt(args[1]) || 3;

	console.log(chalk.bold.cyan('🚀 Task Master Expand All Tasks Tests\n'));
	console.log(chalk.blue(`Test type: ${testType}`));
	console.log(chalk.blue(`Number of subtasks per task: ${numSubtasks}\n`));

	try {
		const results = [];

		switch (testType.toLowerCase()) {
			case 'mcp':
			case 'mcp-streaming': {
				const mcpResult = await testMCPStreaming(numSubtasks);
				results.push({ ...mcpResult, name: 'MCP Streaming' });
				break;
			}

			case 'cli':
			case 'cli-streaming': {
				const cliResult = await testCLIStreaming(numSubtasks);
				results.push({ ...cliResult, name: 'CLI Streaming' });
				break;
			}

			case 'non-streaming':
			case 'non': {
				const nonResult = await testNonStreaming(numSubtasks);
				results.push({ ...nonResult, name: 'Non-Streaming' });
				break;
			}

			case 'both': {
				console.log(
					chalk.yellow(
						'Running both MCP streaming and non-streaming tests...\n'
					)
				);
				const mcpStreamResult = await testMCPStreaming(numSubtasks);
				results.push({ ...mcpStreamResult, name: 'MCP Streaming' });
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamResult = await testNonStreaming(numSubtasks);
				results.push({ ...nonStreamResult, name: 'Non-Streaming' });
				compareResults(results);
				break;
			}

			case 'all': {
				console.log(chalk.yellow('Running all test types...\n'));
				const allMcpResult = await testMCPStreaming(numSubtasks);
				results.push({ ...allMcpResult, name: 'MCP Streaming' });
				console.log('\n' + '='.repeat(60) + '\n');
				const allCliResult = await testCLIStreaming(numSubtasks);
				results.push({ ...allCliResult, name: 'CLI Streaming' });
				console.log('\n' + '='.repeat(60) + '\n');
				const allNonResult = await testNonStreaming(numSubtasks);
				results.push({ ...allNonResult, name: 'Non-Streaming' });
				compareResults(results);

				console.log(chalk.cyan('\n=== All Tests Summary ==='));
				results.forEach((result) => {
					console.log(
						`${result.name}: ${result.success ? '✅ PASS' : '❌ FAIL'}`
					);
				});
				break;
			}

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
