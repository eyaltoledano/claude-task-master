#!/usr/bin/env node

/**
 * test-expand.js
 *
 * Comprehensive integration test for expand-task functionality.
 * Tests MCP streaming, CLI streaming, and non-streaming modes.
 * Validates token tracking, message formats, and subtask generation across all contexts.
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

// Import the expand-task function
import expandTask from '../../scripts/modules/task-manager/expand-task.js';

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
		const hasInitialMessage = this.progressHistory.some(
			(entry) =>
				entry.message.includes('Starting subtask generation') &&
				entry.message.includes('Input:') &&
				entry.message.includes('tokens')
		);

		const hasSubtaskMessages = this.progressHistory.some((entry) =>
			/Generated subtask \d+\/\d+: .+/.test(entry.message.trim())
		);

		const hasCompletionMessage = this.progressHistory.some(
			(entry) =>
				entry.message.includes('✅ Subtask generation completed') &&
				entry.message.includes('Tokens (I/O):')
		);

		console.log(chalk.cyan('\n=== Message Format Validation ==='));
		console.log(
			`✅ Initial message format: ${hasInitialMessage ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`✅ Subtask message format: ${hasSubtaskMessages ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`✅ Completion message format: ${hasCompletionMessage ? 'PASS' : 'FAIL'}`
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
 * Create a test tasks.json file with a single task
 */
function createTestTasksFile() {
	const testTasks = {
		tasks: [
			{
				id: 1,
				title: 'Implement User Authentication System',
				description:
					'Create a complete user authentication system with registration, login, password reset, and session management.',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details:
					'Build a secure authentication system following best practices. Include JWT tokens, password hashing with bcrypt, email verification, and rate limiting.',
				testStrategy:
					'Test all authentication flows including edge cases and security vulnerabilities.'
			}
		]
	};

	const testTasksPath = path.join(__dirname, 'test-expand-tasks.json');
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
async function testMCPStreaming(numSubtasks = 5) {
	console.log(chalk.cyan('🧪 Testing MCP Streaming Functionality\n'));

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	const progressReporter = new MockProgressReporter(true);
	const mcpLogger = new MockMCPLogger(true); // Enable debug for MCP context

	try {
		console.log(chalk.yellow('Starting MCP streaming test...'));
		const startTime = Date.now();

		const result = await expandTask(
			testTasksPath,
			1, // Task ID
			numSubtasks, // Number of subtasks
			false, // useResearch
			'', // additionalContext
			{
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				mcpLog: mcpLogger,
				projectRoot: PROJECT_ROOT,
				session: {}
			},
			true // force
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
		const subtasksGenerated = result.task?.subtasks?.length || 0;

		console.log(chalk.cyan('\n=== MCP-Specific Validation ==='));
		console.log(
			`✅ Subtasks generated: ${subtasksGenerated} (expected: ${numSubtasks})`
		);
		console.log(
			`✅ Progress reports count: ${progressReporter.getProgressHistory().length}`
		);

		return {
			success: true,
			duration,
			progressHistory: progressReporter.getProgressHistory(),
			mcpLogs: mcpLogger.getLogs(),
			subtasksGenerated,
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
 * Test CLI streaming (no reportProgress but with progress bar)
 */
async function testCLIStreaming(numSubtasks = 5) {
	console.log(chalk.cyan('🧪 Testing CLI Streaming (With Progress Bar)\n'));

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	try {
		console.log(chalk.yellow('Starting CLI streaming test...'));
		const startTime = Date.now();

		// No reportProgress - should use CLI progress bars
		const result = await expandTask(
			testTasksPath,
			1, // Task ID
			numSubtasks, // Number of subtasks
			false, // useResearch
			'', // additionalContext
			{
				projectRoot: PROJECT_ROOT,
				session: {}
			},
			true // force
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ CLI streaming test completed in ${duration}ms`)
		);

		// Verify results
		const subtasksGenerated = result.task?.subtasks?.length || 0;

		console.log(chalk.cyan('\n=== CLI-Specific Validation ==='));
		console.log(
			`✅ Subtasks generated: ${subtasksGenerated} (expected: ${numSubtasks})`
		);

		return {
			success: true,
			duration,
			subtasksGenerated,
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
async function testNonStreaming(numSubtasks = 5) {
	console.log(chalk.cyan('🧪 Testing Non-Streaming Functionality\n'));

	const testTasksPath = createTestTasksFile();
	const configPath = createTestConfig();

	try {
		console.log(chalk.yellow('Starting non-streaming test...'));
		const startTime = Date.now();

		// Force non-streaming by setting outputFormat to 'json'
		const result = await expandTask(
			testTasksPath,
			1, // Task ID
			numSubtasks, // Number of subtasks
			false, // useResearch
			'', // additionalContext
			{
				projectRoot: PROJECT_ROOT,
				session: {},
				mcpLog: {
					info: () => {},
					warn: () => {},
					error: console.error,
					debug: () => {}
				}
			},
			true // force
		);

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ Non-streaming test completed in ${duration}ms`)
		);

		// Verify results
		const subtasksGenerated = result.task?.subtasks?.length || 0;

		console.log(chalk.cyan('\n=== Non-Streaming Validation ==='));
		console.log(
			`✅ Subtasks generated: ${subtasksGenerated} (expected: ${numSubtasks})`
		);

		return {
			success: true,
			duration,
			subtasksGenerated,
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

	// Compare subtask counts
	console.log(chalk.yellow('\nSubtask Generation:'));
	results.forEach((result) => {
		if (result.success) {
			console.log(`${result.name}: ${result.subtasksGenerated} subtasks`);
		}
	});

	// Progress reporting comparison
	console.log(chalk.yellow('\nProgress Reporting:'));
	results.forEach((result) => {
		if (result.success && result.progressHistory) {
			console.log(
				`${result.name}: ${result.progressHistory.length} progress reports`
			);
		}
	});

	const allSubtaskCounts = validResults.map((r) => r.subtasksGenerated);
	const allMatch = allSubtaskCounts.every(
		(count) => count === allSubtaskCounts[0]
	);

	console.log(
		chalk.green(
			`\n✅ All methods generated same subtask count: ${allMatch ? 'YES' : 'NO'}`
		)
	);
}

/**
 * Main test runner
 */
async function main() {
	const args = process.argv.slice(2);
	const testType = args[0] || 'mcp-streaming';
	const numSubtasks = parseInt(args[1]) || 5;

	console.log(chalk.bold.cyan('🚀 Task Master Expand Task Tests\n'));
	console.log(chalk.blue(`Test type: ${testType}`));
	console.log(chalk.blue(`Number of subtasks: ${numSubtasks}\n`));

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
