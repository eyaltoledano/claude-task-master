#!/usr/bin/env node

/**
 * test-parse-prd.js
 *
 * Comprehensive integration test for parse-prd functionality.
 * Tests MCP streaming, CLI streaming, and non-streaming modes.
 * Validates token tracking and message formats across all contexts.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the parse-prd function
import parsePRD from '../../scripts/modules/task-manager/parse-prd.js';

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
 * Create a test PRD file
 */
function createTestPRD() {
	const testPRDContent = `# Test Task Management App

## Project Overview
Build a comprehensive task management web application with real-time collaboration features.

## Core Features
1. User authentication and authorization
2. Create, read, update, delete tasks
3. Real-time task updates using WebSockets
4. Task categorization and filtering
5. User dashboard with analytics
6. Team collaboration features
7. File attachments for tasks
8. Email notifications
9. Mobile responsive design
10. API for third-party integrations

## Technical Requirements
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL with Redis for caching
- Authentication: JWT tokens with refresh mechanism
- Real-time: Socket.io for live updates
- File Storage: AWS S3 or similar
- Email: SendGrid or similar service
- Styling: Tailwind CSS with custom components
- Testing: Jest for unit tests, Cypress for E2E
- Deployment: Docker containers on AWS/GCP

## User Stories
- As a user, I want to register and login securely
- As a user, I want to create tasks with rich descriptions and attachments
- As a user, I want to see real-time updates when team members modify tasks
- As a user, I want to organize tasks into projects and categories
- As a user, I want to receive notifications about important task updates
- As a team lead, I want to assign tasks to team members
- As a team lead, I want to track project progress with analytics
- As an admin, I want to manage user permissions and access

## Success Criteria
- Users can register, login, and manage their profiles
- Tasks can be created, edited, deleted, and organized
- Real-time collaboration works seamlessly
- Application is responsive and accessible
- All features have comprehensive error handling
- Performance meets requirements (sub-second response times)
- Security best practices are implemented
`;

	const testPRDPath = path.join(__dirname, 'test-prd.txt');
	fs.writeFileSync(testPRDPath, testPRDContent);
	return testPRDPath;
}

/**
 * Test streaming functionality
 */
async function testStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing Streaming Functionality\n'));

	const testPRDPath = createTestPRD();
	const testTasksPath = path.join(__dirname, 'test-streaming-tasks.json');
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
	}

	const progressReporter = new MockProgressReporter(true);
	const mcpLogger = new MockMCPLogger(false); // Disable debug for cleaner output

	try {
		console.log(chalk.yellow('Starting streaming test...'));
		const startTime = Date.now();

		const result = await parsePRD(testPRDPath, testTasksPath, numTasks, {
			force: true,
			append: false,
			research: false,
			reportProgress: progressReporter.reportProgress.bind(progressReporter),
			projectRoot: __dirname
		});

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(chalk.green(`\n✅ Streaming test completed in ${duration}ms`));

		// Print progress summary
		progressReporter.printSummary();

		// Verify results
		if (fs.existsSync(testTasksPath)) {
			const tasksData = JSON.parse(fs.readFileSync(testTasksPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Tasks file created with ${tasksData.tasks.length} tasks`
				)
			);

			// Verify task structure
			const firstTask = tasksData.tasks[0];
			if (
				firstTask &&
				firstTask.id &&
				firstTask.title &&
				firstTask.description
			) {
				console.log(chalk.green('✅ Task structure is valid'));
			} else {
				console.log(chalk.red('❌ Task structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Tasks file was not created'));
		}

		return {
			success: true,
			duration,
			progressHistory: progressReporter.getProgressHistory(),
			result
		};
	} catch (error) {
		console.error(chalk.red(`❌ Streaming test failed: ${error.message}`));
		return {
			success: false,
			error: error.message
		};
	} finally {
		// Clean up
		if (fs.existsSync(testPRDPath)) fs.unlinkSync(testPRDPath);
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test CLI streaming (no reportProgress)
 */
async function testCLIStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing CLI Streaming (No Progress Reporter)\n'));

	const testPRDPath = createTestPRD();
	const testTasksPath = path.join(__dirname, 'test-cli-tasks.json');
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
	}

	try {
		console.log(chalk.yellow('Starting CLI streaming test...'));
		const startTime = Date.now();

		// No reportProgress - should use non-streaming path
		const result = await parsePRD(testPRDPath, testTasksPath, numTasks, {
			force: true,
			append: false,
			research: false,
			// No reportProgress provided
			projectRoot: __dirname
		});

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ CLI streaming test completed in ${duration}ms`)
		);

		// Verify results
		if (fs.existsSync(testTasksPath)) {
			const tasksData = JSON.parse(fs.readFileSync(testTasksPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Tasks file created with ${tasksData.tasks.length} tasks`
				)
			);

			// Verify task structure
			const firstTask = tasksData.tasks[0];
			if (
				firstTask &&
				firstTask.id &&
				firstTask.title &&
				firstTask.description
			) {
				console.log(chalk.green('✅ Task structure is valid'));
			} else {
				console.log(chalk.red('❌ Task structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Tasks file was not created'));
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
		if (fs.existsSync(testPRDPath)) fs.unlinkSync(testPRDPath);
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
}

/**
 * Test non-streaming functionality
 */
async function testNonStreaming(numTasks = 10) {
	console.log(chalk.cyan('🧪 Testing Non-Streaming Functionality\n'));

	const testPRDPath = createTestPRD();
	const testTasksPath = path.join(__dirname, 'test-non-streaming-tasks.json');
	const configPath = createTestConfig();

	// Clean up existing files
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
	}

	try {
		console.log(chalk.yellow('Starting non-streaming test...'));
		const startTime = Date.now();

		// Force non-streaming by not providing reportProgress
		const result = await parsePRD(testPRDPath, testTasksPath, numTasks, {
			force: true,
			append: false,
			research: false,
			projectRoot: __dirname
			// No reportProgress - should use generateObjectService
		});

		const endTime = Date.now();
		const duration = endTime - startTime;

		console.log(
			chalk.green(`\n✅ Non-streaming test completed in ${duration}ms`)
		);

		// Verify results
		if (fs.existsSync(testTasksPath)) {
			const tasksData = JSON.parse(fs.readFileSync(testTasksPath, 'utf8'));
			console.log(
				chalk.green(
					`\n✅ Tasks file created with ${tasksData.tasks.length} tasks`
				)
			);

			// Verify task structure
			const firstTask = tasksData.tasks[0];
			if (
				firstTask &&
				firstTask.id &&
				firstTask.title &&
				firstTask.description
			) {
				console.log(chalk.green('✅ Task structure is valid'));
			} else {
				console.log(chalk.red('❌ Task structure is invalid'));
			}
		} else {
			console.log(chalk.red('❌ Tasks file was not created'));
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
		if (fs.existsSync(testPRDPath)) fs.unlinkSync(testPRDPath);
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
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
	const numTasks = parseInt(args[1]) || 8;

	console.log(chalk.bold.cyan('🚀 Task Master PRD Streaming Tests\n'));
	console.log(chalk.blue(`Test type: ${testType}`));
	console.log(chalk.blue(`Number of tasks: ${numTasks}\n`));

	try {
		switch (testType.toLowerCase()) {
			case 'streaming':
				await testStreaming(numTasks);
				break;

			case 'cli':
			case 'cli-streaming':
				await testCLIStreaming(numTasks);
				break;

			case 'non-streaming':
			case 'non':
				await testNonStreaming(numTasks);
				break;

			case 'both':
				console.log(
					chalk.yellow('Running both streaming and non-streaming tests...\n')
				);
				const streamingResult = await testStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamingResult = await testNonStreaming(numTasks);
				compareResults(streamingResult, nonStreamingResult);
				break;

			case 'all':
				console.log(chalk.yellow('Running all test types...\n'));
				const streamResult = await testStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const cliResult = await testCLIStreaming(numTasks);
				console.log('\n' + '='.repeat(60) + '\n');
				const nonStreamResult = await testNonStreaming(numTasks);

				console.log(chalk.cyan('\n=== All Tests Summary ==='));
				console.log(
					`Streaming: ${streamResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
				console.log(`CLI: ${cliResult.success ? '✅ PASS' : '❌ FAIL'}`);
				console.log(
					`Non-streaming: ${nonStreamResult.success ? '✅ PASS' : '❌ FAIL'}`
				);
				break;

			default:
				console.log(chalk.red(`Unknown test type: ${testType}`));
				console.log(
					chalk.yellow(
						'Available options: streaming, cli, non-streaming, both, all'
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
