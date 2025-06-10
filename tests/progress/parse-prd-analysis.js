#!/usr/bin/env node

/**
 * parse-prd-analysis.js
 *
 * Detailed timing and accuracy analysis for parse-prd progress reporting.
 * Tests different PRD complexities and validates real-time characteristics.
 * Focuses specifically on progress behavior and performance metrics.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import parsePRD from '../../scripts/modules/task-manager/parse-prd.js';

/**
 * Detailed Progress Reporter for timing analysis
 */
class DetailedProgressReporter {
	constructor() {
		this.progressHistory = [];
		this.startTime = Date.now();
		this.lastProgress = 0;
	}

	async reportProgress(data) {
		const timestamp = Date.now() - this.startTime;
		const timeSinceLastProgress =
			this.progressHistory.length > 0
				? timestamp -
					this.progressHistory[this.progressHistory.length - 1].timestamp
				: timestamp;

		const entry = {
			timestamp,
			timeSinceLastProgress,
			...data
		};

		this.progressHistory.push(entry);

		const percentage = data.total
			? Math.round((data.progress / data.total) * 100)
			: 0;
		console.log(
			chalk.blue(`[${timestamp}ms] (+${timeSinceLastProgress}ms)`),
			chalk.green(`${percentage}%`),
			`(${data.progress}/${data.total})`,
			chalk.yellow(data.message)
		);
	}

	getAnalysis() {
		if (this.progressHistory.length === 0) return null;

		const totalDuration =
			this.progressHistory[this.progressHistory.length - 1].timestamp;
		const intervals = this.progressHistory
			.slice(1)
			.map((entry) => entry.timeSinceLastProgress);
		const avgInterval =
			intervals.length > 0
				? intervals.reduce((a, b) => a + b, 0) / intervals.length
				: 0;
		const minInterval = intervals.length > 0 ? Math.min(...intervals) : 0;
		const maxInterval = intervals.length > 0 ? Math.max(...intervals) : 0;

		return {
			totalReports: this.progressHistory.length,
			totalDuration,
			avgInterval: Math.round(avgInterval),
			minInterval,
			maxInterval,
			intervals
		};
	}

	printDetailedAnalysis() {
		const analysis = this.getAnalysis();
		if (!analysis) {
			console.log(chalk.red('No progress data to analyze'));
			return;
		}

		console.log(chalk.cyan('\n=== Detailed Progress Analysis ==='));
		console.log(`Total Progress Reports: ${analysis.totalReports}`);
		console.log(`Total Duration: ${analysis.totalDuration}ms`);
		console.log(`Average Interval: ${analysis.avgInterval}ms`);
		console.log(`Min Interval: ${analysis.minInterval}ms`);
		console.log(`Max Interval: ${analysis.maxInterval}ms`);

		console.log(chalk.cyan('\n=== Progress Timeline ==='));
		this.progressHistory.forEach((entry, index) => {
			const percentage = entry.total
				? Math.round((entry.progress / entry.total) * 100)
				: 0;
			const intervalText =
				index > 0 ? ` (+${entry.timeSinceLastProgress}ms)` : '';
			console.log(
				`${index + 1}. [${entry.timestamp}ms]${intervalText} ${percentage}% - ${entry.message}`
			);
		});

		// Check for real-time characteristics
		console.log(chalk.cyan('\n=== Real-time Characteristics ==='));
		const hasRealTimeUpdates = analysis.intervals.some(
			(interval) => interval < 10000
		); // Less than 10s
		const hasConsistentUpdates = analysis.intervals.length > 3;
		const hasProgressiveUpdates = this.progressHistory.every(
			(entry, index) =>
				index === 0 ||
				entry.progress >= this.progressHistory[index - 1].progress
		);

		console.log(`✅ Real-time updates: ${hasRealTimeUpdates ? 'YES' : 'NO'}`);
		console.log(
			`✅ Consistent updates: ${hasConsistentUpdates ? 'YES' : 'NO'}`
		);
		console.log(
			`✅ Progressive updates: ${hasProgressiveUpdates ? 'YES' : 'NO'}`
		);
	}
}

/**
 * Create test PRD with specific complexity
 */
function createTestPRD(complexity = 'medium') {
	const prdTemplates = {
		simple: `# Simple Todo App
Build a basic todo application.
Features: add tasks, mark complete, delete tasks.
Tech: HTML, CSS, JavaScript.`,

		medium: `# Task Management Web App
Build a comprehensive task management application with user authentication.
Features: user registration, task CRUD, categories, due dates, search.
Tech: React, Node.js, PostgreSQL, JWT authentication.
Requirements: responsive design, error handling, data validation.`,

		complex: `# Enterprise Project Management Platform
Build a full-featured project management platform for enterprise use.
Features: multi-user workspaces, project templates, Gantt charts, time tracking, reporting, integrations.
Tech: React with TypeScript, Node.js microservices, PostgreSQL, Redis, Docker, Kubernetes.
Requirements: real-time collaboration, advanced permissions, audit logging, API rate limiting, comprehensive testing.
Integrations: Slack, GitHub, Jira, Google Calendar, email notifications.
Performance: handle 10,000+ concurrent users, sub-second response times.
Security: OAuth 2.0, RBAC, data encryption, GDPR compliance.`
	};

	const content = prdTemplates[complexity] || prdTemplates.medium;
	const testPRDPath = path.join(__dirname, `test-prd-${complexity}.txt`);
	fs.writeFileSync(testPRDPath, content);
	return testPRDPath;
}

/**
 * Test streaming with different complexities
 */
async function testStreamingComplexity() {
	console.log(
		chalk.cyan('🧪 Testing Streaming with Different PRD Complexities\n')
	);

	const complexities = ['simple', 'medium', 'complex'];
	const results = [];

	for (const complexity of complexities) {
		console.log(
			chalk.yellow(`\n--- Testing ${complexity.toUpperCase()} PRD ---`)
		);

		const testPRDPath = createTestPRD(complexity);
		const testTasksPath = path.join(__dirname, `test-tasks-${complexity}.json`);

		// Clean up existing file
		if (fs.existsSync(testTasksPath)) {
			fs.unlinkSync(testTasksPath);
		}

		const progressReporter = new DetailedProgressReporter();
		const expectedTasks =
			complexity === 'simple' ? 3 : complexity === 'medium' ? 6 : 10;

		try {
			const startTime = Date.now();

			await parsePRD(testPRDPath, testTasksPath, expectedTasks, {
				force: true,
				append: false,
				research: false,
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				projectRoot: __dirname
			});

			const endTime = Date.now();
			const duration = endTime - startTime;

			console.log(
				chalk.green(`✅ ${complexity} PRD completed in ${duration}ms`)
			);

			progressReporter.printDetailedAnalysis();

			results.push({
				complexity,
				duration,
				analysis: progressReporter.getAnalysis()
			});
		} catch (error) {
			console.error(chalk.red(`❌ ${complexity} PRD failed: ${error.message}`));
			results.push({
				complexity,
				error: error.message
			});
		} finally {
			// Clean up
			if (fs.existsSync(testPRDPath)) fs.unlinkSync(testPRDPath);
			if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
		}
	}

	// Summary
	console.log(chalk.cyan('\n=== Complexity Test Summary ==='));
	results.forEach((result) => {
		if (result.error) {
			console.log(`${result.complexity}: ❌ FAILED - ${result.error}`);
		} else {
			console.log(
				`${result.complexity}: ✅ ${result.duration}ms (${result.analysis.totalReports} reports)`
			);
		}
	});

	return results;
}

/**
 * Test progress accuracy
 */
async function testProgressAccuracy() {
	console.log(chalk.cyan('🧪 Testing Progress Accuracy\n'));

	const testPRDPath = createTestPRD('medium');
	const testTasksPath = path.join(__dirname, 'test-accuracy-tasks.json');

	// Clean up existing file
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
	}

	const progressReporter = new DetailedProgressReporter();

	try {
		await parsePRD(testPRDPath, testTasksPath, 8, {
			force: true,
			append: false,
			research: false,
			reportProgress: progressReporter.reportProgress.bind(progressReporter),
			projectRoot: __dirname
		});

		console.log(chalk.green('✅ Progress accuracy test completed'));
		progressReporter.printDetailedAnalysis();

		// Additional accuracy checks
		const analysis = progressReporter.getAnalysis();
		console.log(chalk.cyan('\n=== Accuracy Metrics ==='));
		console.log(
			`Progress consistency: ${analysis.intervals.every((i) => i > 0) ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`Reasonable intervals: ${analysis.intervals.every((i) => i < 30000) ? 'PASS' : 'FAIL'}`
		);
		console.log(
			`Expected report count: ${analysis.totalReports >= 8 ? 'PASS' : 'FAIL'}`
		);
	} catch (error) {
		console.error(
			chalk.red(`❌ Progress accuracy test failed: ${error.message}`)
		);
	} finally {
		// Clean up
		if (fs.existsSync(testPRDPath)) fs.unlinkSync(testPRDPath);
		if (fs.existsSync(testTasksPath)) fs.unlinkSync(testTasksPath);
	}
}

/**
 * Main test runner
 */
async function main() {
	const args = process.argv.slice(2);
	const testType = args[0] || 'accuracy';

	console.log(chalk.bold.cyan('🚀 Task Master Detailed Progress Tests\n'));
	console.log(chalk.blue(`Test type: ${testType}\n`));

	try {
		switch (testType.toLowerCase()) {
			case 'accuracy':
				await testProgressAccuracy();
				break;

			case 'complexity':
				await testStreamingComplexity();
				break;

			case 'all':
				console.log(chalk.yellow('Running all detailed tests...\n'));
				await testProgressAccuracy();
				console.log('\n' + '='.repeat(60) + '\n');
				await testStreamingComplexity();
				break;

			default:
				console.log(chalk.red(`Unknown test type: ${testType}`));
				console.log(
					chalk.yellow('Available options: accuracy, complexity, all')
				);
				process.exit(1);
		}

		console.log(chalk.green('\n🎉 Detailed tests completed successfully!'));
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
