#!/usr/bin/env node

/**
 * test-parse-prd.js
 *
 * Comprehensive integration test for parse-prd functionality.
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

// Import the parse-prd function
import parsePRD from '../../../scripts/modules/task-manager/parse-prd/index.js';

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
				? Math.round((data.progress / data.total) * 100)
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
				? Math.round((entry.progress / entry.total) * 100)
				: 0;
			console.log(
				`${index + 1}. [${entry.timestamp}ms] ${percentage}% - ${entry.message}`
			);
		});

		// Check for expected message formats
		const hasInitialMessage = this.progressHistory.some(
			(entry) =>
				entry.message.includes('Starting PRD analysis') &&
				entry.message.includes('Input:') &&
				entry.message.includes('tokens')
		);
		// Make regex more flexible to handle potential whitespace variations
		const hasTaskMessages = this.progressHistory.some((entry) =>
			/^[🔴🟠🟢⚪]{3} Task \d+\/\d+ - .+ \| ~Output: \d+ tokens/u.test(
				entry.message.trim()
			)
		);

		const hasCompletionMessage = this.progressHistory.some(
			(entry) =>
				entry.message.includes('✅ Task Generation Completed') &&
				entry.message.includes('Tokens (I/O):')
		);

		console.log(chalk.cyan('\n=== Message Format Validation ==='));
		console.log(
			`✅ Initial message format: ${hasInitialMessage ? 'PASS' : 'FAIL'}`
		);
		console.log(`✅ Task message format: ${hasTaskMessages ? 'PASS' : 'FAIL'}`);
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
 * Get the path to the sample PRD file
 */
function getSamplePRDPath() {
	return path.resolve(PROJECT_ROOT, 'tests', 'fixtures', 'sample-prd.txt');
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
 * Setup test files and configuration
 */
function setupTestFiles(testName) {
	const testPRDPath = getSamplePRDPath();
	const testTasksPath = path.join(__dirname, `test-${testName}-tasks.json`);
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
	}

	return { testPRDPath, testTasksPath, configPath };
}

/**
 * Clean up test files
 */
function cleanupTestFiles(testTasksPath, configPath) {
	if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
	if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
}

/**
 * Run parsePRD with configurable options
 */
async function runParsePRD(testPRDPath, testTasksPath, numTasks, options = {}) {
	const startTime = Date.now();

	const result = await parsePRD(testPRDPath, testTasksPath, numTasks, {
		force: true,
		append: false,
		research: false,
		projectRoot: PROJECT_ROOT,
		...options
	});

	const endTime = Date.now();
	const duration = endTime - startTime;

	return { result, duration };
}

/**
 * Verify task file existence and structure
 */
function verifyTaskResults(testTasksPath) {
	if (fs.existsSync(testTasksPath)) {
		const tasksData = JSON.parse(fs.readFileSync(testTasksPath, 'utf8'));
		console.log(
			chalk.green(
				`\n✅ Tasks file created with ${tasksData.tasks.length} tasks`
			)
		);

		// Verify task structure
		const firstTask = tasksData.tasks[0];
		if (firstTask && firstTask.id && firstTask.title && firstTask.description) {
			console.log(chalk.green('✅ Task structure is valid'));
			return true;
		} else {
			console.log(chalk.red('❌ Task structure is invalid'));
			return false;
		}
	} else {
		console.log(chalk.red('❌ Tasks file was not created'));
		return false;
	}
}

/**
 * Print MCP-specific logs and validation
 */
function printMCPResults(mcpLogger, progressReporter) {
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

	// Verify MCP-specific message formats (should use emoji indicators)
	const hasEmojiIndicators = progressReporter
		.getProgressHistory()
		.some((entry) => /[🔴🟠🟢]/u.test(entry.message));

	console.log(chalk.cyan('\n=== MCP-Specific Validation ==='));
	console.log(
		`✅ Emoji priority indicators: ${hasEmojiIndicators ? 'PASS' : 'FAIL'}`
	);

	return { hasEmojiIndicators, logs };
}

/**
 * Test MCP streaming with proper MCP context
 */
async function testMCPStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing MCP Streaming Functionality\n'));

	const { testPRDPath, testTasksPath, configPath } = setupTestFiles('mcp');
	const progressReporter = new MockProgressReporter(true);
	const mcpLogger = new MockMCPLogger(true); // Enable debug for MCP context

	try {
		console.log(chalk.yellow('Starting MCP streaming test...'));

		const { result, duration } = await runParsePRD(
			testPRDPath,
			testTasksPath,
			numTasks,
			{
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				mcpLog: mcpLogger // Add MCP context - this is the key difference
			}
		);

		console.log(
			chalk.green(`\n✅ MCP streaming test completed in ${duration}ms`)
		);

		const { hasEmojiIndicators, logs } = printMCPResults(
			mcpLogger,
			progressReporter
		);
		const isValidStructure = verifyTaskResults(testTasksPath);

		return {
			success: true,
			duration,
			progressHistory: progressReporter.getProgressHistory(),
			mcpLogs: logs,
			hasEmojiIndicators,
			result
		};
	} catch (error) {
		console.error(chalk.red(`❌ MCP streaming test failed: ${error.message}`));
		return {
			success: false,
			error: error.message
		};
	} finally {
		cleanupTestFiles(testTasksPath, configPath);
	}
}

/**
 * Test CLI streaming (no reportProgress)
 */
async function testCLIStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing CLI Streaming (No Progress Reporter)\n'));

	const { testPRDPath, testTasksPath, configPath } = setupTestFiles('cli');

	try {
		console.log(chalk.yellow('Starting CLI streaming test...'));

		// No reportProgress provided; CLI text mode uses the default streaming reporter
		const { result, duration } = await runParsePRD(
			testPRDPath,
			testTasksPath,
			numTasks
		);

		console.log(
			chalk.green(`\n✅ CLI streaming test completed in ${duration}ms`)
		);

		const isValidStructure = verifyTaskResults(testTasksPath);

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
		cleanupTestFiles(testTasksPath, configPath);
	}
}

/**
 * Test non-streaming functionality
 */
async function testNonStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing Non-Streaming Functionality\n'));

	const { testPRDPath, testTasksPath, configPath } =
		setupTestFiles('non-streaming');

	try {
		console.log(chalk.yellow('Starting non-streaming test...'));

		// Force non-streaming by not providing reportProgress
		const { result, duration } = await runParsePRD(
			testPRDPath,
			testTasksPath,
			numTasks
		);

		console.log(
			chalk.green(`\n✅ Non-streaming test completed in ${duration}ms`)
		);

		const isValidStructure = verifyTaskResults(testTasksPath);

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
		cleanupTestFiles(testTasksPath, configPath);
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
	const numTasks = parseInt(args[1]) || 8;

	console.log(chalk.bold.cyan('🚀 Task Master PRD Streaming Tests\n'));
	console.log(chalk.blue(`Test type: ${testType}`));
	console.log(chalk.blue(`Number of tasks: ${numTasks}\n`));

	try {
		switch (testType.toLowerCase()) {
			case 'mcp':
			case 'mcp-streaming':
				await testMCPStreaming(numTasks);
				break;

			case 'cli':
			case 'cli-streaming':
				await testCLIStreaming(numTasks);
				break;

			case 'non-streaming':
			case 'non':
				await testNonStreaming(numTasks);
				break;

			case 'both': {
				console.log(
					chalk.yellow(
						'Running both MCP streaming and non-streaming tests...\n'
					)
				);
				const mcpStreamingResult = await testMCPStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamingResult = await testNonStreaming(numTasks);
				compareResults(mcpStreamingResult, nonStreamingResult);
				break;
			}

			case 'all': {
				console.log(chalk.yellow('Running all test types...\n'));
				const mcpResult = await testMCPStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const cliResult = await testCLIStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamResult = await testNonStreaming(numTasks);

				console.log(chalk.cyan('\n=== All Tests Summary ==='));
				console.log(
					`MCP Streaming: ${mcpResult.success ? '✅ PASS' : '❌ FAIL'} ${mcpResult.hasEmojiIndicators ? '(✅ Emojis)' : '(❌ No Emojis)'}`
				);
				console.log(
					`CLI Streaming: ${cliResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
				console.log(
					`Non-streaming: ${nonStreamResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
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
