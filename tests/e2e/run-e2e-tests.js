#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import process from 'process';
import chalk from 'chalk';
import boxen from 'boxen';
import { TestLogger } from './utils/logger.js';
import { TestHelpers } from './utils/test-helpers.js';
import { LLMAnalyzer } from './utils/llm-analyzer.js';
import { testConfig, testGroups } from './config/test-config.js';
import {
	ParallelTestRunner,
	SequentialTestRunner
} from './runners/parallel-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs() {
	const args = process.argv.slice(2);
	const options = {
		skipVerification: false,
		analyzeLog: false,
		logFile: null,
		parallel: true,
		groups: null,
		testDir: null
	};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--skip-verification':
				options.skipVerification = true;
				break;
			case '--analyze-log':
				options.analyzeLog = true;
				if (args[i + 1] && !args[i + 1].startsWith('--')) {
					options.logFile = args[i + 1];
					i++;
				}
				break;
			case '--sequential':
				options.parallel = false;
				break;
			case '--groups':
				if (args[i + 1] && !args[i + 1].startsWith('--')) {
					options.groups = args[i + 1].split(',');
					i++;
				}
				break;
			case '--test-dir':
				if (args[i + 1] && !args[i + 1].startsWith('--')) {
					options.testDir = args[i + 1];
					i++;
				}
				break;
			case '--help':
				showHelp();
				process.exit(0);
		}
	}

	return options;
}

function showHelp() {
	console.log(
		boxen(
			`Task Master E2E Test Runner

Usage: node run-e2e-tests.js [options]

Options:
  --skip-verification     Skip fallback verification tests
  --analyze-log [file]    Analyze an existing log file
  --sequential           Run tests sequentially instead of in parallel
  --groups <g1,g2>       Run only specific test groups
  --help                 Show this help message

Test Groups: ${Object.keys(testGroups).join(', ')}`,
			{ padding: 1, margin: 1, borderStyle: 'round' }
		)
	);
}

// Generate timestamp for test run
function generateTimestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Analyze existing log file
async function analyzeLogFile(logFile, logger) {
	console.log(chalk.cyan('\n📊 Running LLM Analysis on log file...\n'));

	const analyzer = new LLMAnalyzer(testConfig, logger);
	const analysis = await analyzer.analyzeLog(logFile);

	if (analysis) {
		const report = analyzer.formatReport(analysis);
		displayAnalysisReport(report);
	} else {
		console.log(chalk.red('Failed to analyze log file'));
	}
}

// Display analysis report
function displayAnalysisReport(report) {
	console.log(
		boxen(chalk.cyan.bold(`${report.title}\n${report.timestamp}`), {
			padding: 1,
			borderStyle: 'double',
			borderColor: 'cyan'
		})
	);

	// Status
	const statusColor =
		report.status === 'Success'
			? chalk.green
			: report.status === 'Warning'
				? chalk.yellow
				: chalk.red;
	console.log(
		boxen(`Overall Status: ${statusColor.bold(report.status)}`, {
			padding: { left: 1, right: 1 },
			borderColor: 'blue'
		})
	);

	// Summary points
	if (report.summary && report.summary.length > 0) {
		console.log(chalk.blue.bold('\n📋 Summary Points:'));
		report.summary.forEach((point) => {
			console.log(chalk.white(`  - ${point}`));
		});
	}

	// Provider comparison
	if (report.providerComparison) {
		console.log(chalk.magenta.bold('\n🔄 Provider Comparison:'));
		const comp = report.providerComparison;

		if (comp.provider_results) {
			Object.entries(comp.provider_results).forEach(([provider, result]) => {
				const status =
					result.status === 'Success' ? chalk.green('✅') : chalk.red('❌');
				console.log(`  ${status} ${provider}: ${result.notes || 'N/A'}`);
			});
		}
	}

	// Issues
	if (report.issues && report.issues.length > 0) {
		console.log(chalk.red.bold('\n🚨 Detected Issues:'));
		report.issues.forEach((issue, index) => {
			const severity =
				issue.severity === 'Error'
					? chalk.red('❌')
					: issue.severity === 'Warning'
						? chalk.yellow('⚠️')
						: 'ℹ️';
			console.log(
				boxen(
					`${severity} Issue ${index + 1}: [${issue.severity}]\n${issue.description}`,
					{ padding: 1, margin: { bottom: 1 }, borderColor: 'red' }
				)
			);
		});
	}
}

// Main test execution
async function runTests(options) {
	const timestamp = generateTimestamp();
	const logger = new TestLogger(testConfig.paths.logDir, timestamp);
	const helpers = new TestHelpers(logger);

	console.log(
		boxen(
			chalk.cyan.bold(
				`Task Master E2E Test Suite\n${new Date().toISOString()}`
			),
			{ padding: 1, borderStyle: 'double', borderColor: 'cyan' }
		)
	);

	logger.info('Starting E2E test suite');
	logger.info(`Test configuration: ${JSON.stringify(options)}`);

	// Update config based on options
	if (options.skipVerification) {
		testConfig.settings.runVerificationTest = false;
	}

	let results;
	let testDir;

	try {
		// Check dependencies
		logger.step('Checking dependencies');
		const deps = ['jq', 'bc'];
		for (const dep of deps) {
			const { exitCode } = await helpers.executeCommand('which', [dep]);
			if (exitCode !== 0) {
				throw new Error(
					`Required dependency '${dep}' not found. Please install it.`
				);
			}
		}
		logger.success('All dependencies found');

		// Determine which test groups to run
		const groupsToRun = options.groups || Object.keys(testGroups);
		const testsToRun = {};

		groupsToRun.forEach((group) => {
			if (testGroups[group]) {
				testsToRun[group] = testGroups[group];
			} else {
				logger.warning(`Unknown test group: ${group}`);
			}
		});

		if (Object.keys(testsToRun).length === 0) {
			throw new Error('No valid test groups to run');
		}

		// Check if we need to run setup (either explicitly requested or needed for other tests)
		const needsSetup =
			testsToRun.setup || (!testDir && Object.keys(testsToRun).length > 0);

		if (needsSetup) {
			// Always run setup if we need a test directory
			if (!testsToRun.setup) {
				logger.info('No test directory available, running setup automatically');
			}

			logger.step('Running setup tests');
			const setupRunner = new SequentialTestRunner(logger, helpers);
			const setupResults = await setupRunner.runTests(['setup'], {});

			if (setupResults.tests.setup && setupResults.tests.setup.testDir) {
				testDir = setupResults.tests.setup.testDir;
				logger.info(`Test directory created: ${testDir}`);
			} else {
				throw new Error('Setup failed to create test directory');
			}

			// Remove setup from remaining tests if it was explicitly requested
			if (testsToRun.setup) {
				delete testsToRun.setup;
			}
		}

		// Run remaining tests
		if (Object.keys(testsToRun).length > 0) {
			const context = { testDir, config: testConfig };

			if (options.parallel) {
				logger.info('Running tests in parallel mode');
				const parallelRunner = new ParallelTestRunner(logger);

				try {
					results = await parallelRunner.runTestGroups(testsToRun, context);
				} finally {
					await parallelRunner.terminate();
				}
			} else {
				logger.info('Running tests in sequential mode');
				const sequentialRunner = new SequentialTestRunner(logger, helpers);

				// Flatten test groups for sequential execution
				const allTests = Object.values(testsToRun).flat();
				results = await sequentialRunner.runTests(allTests, context);
			}
		}

		// Final summary
		logger.flush();
		const summary = logger.getSummary();

		displayTestSummary(summary, results);

		// Run LLM analysis if enabled
		if (testConfig.llmAnalysis.enabled && !options.skipVerification) {
			await analyzeLogFile(summary.logFile, logger);
		}

		// Exit with appropriate code
		const exitCode = results && results.overall === 'passed' ? 0 : 1;
		process.exit(exitCode);
	} catch (error) {
		logger.error(`Fatal error: ${error.message}`);
		logger.flush();

		console.log(chalk.red.bold('\n❌ Test execution failed'));
		console.log(chalk.red(error.stack));

		process.exit(1);
	}
}

// Display test summary
function displayTestSummary(summary, results) {
	console.log(
		boxen(chalk.cyan.bold('E2E Test Summary'), {
			padding: 1,
			margin: { top: 1 },
			borderStyle: 'round',
			borderColor: 'cyan'
		})
	);

	console.log(chalk.white(`📁 Log File: ${summary.logFile}`));
	console.log(chalk.white(`⏱️  Duration: ${summary.duration}`));
	console.log(chalk.white(`📊 Total Steps: ${summary.totalSteps}`));
	console.log(chalk.green(`✅ Successes: ${summary.successCount}`));

	if (summary.errorCount > 0) {
		console.log(chalk.red(`❌ Errors: ${summary.errorCount}`));
	}

	console.log(chalk.yellow(`💰 Total Cost: $${summary.totalCost} USD`));

	if (results) {
		const status =
			results.overall === 'passed'
				? chalk.green.bold('✅ PASSED')
				: chalk.red.bold('❌ FAILED');

		console.log(
			boxen(`Overall Result: ${status}`, {
				padding: 1,
				margin: { top: 1 },
				borderColor: results.overall === 'passed' ? 'green' : 'red'
			})
		);
	}
}

// Main entry point
async function main() {
	const options = parseArgs();

	if (options.analyzeLog) {
		// Analysis mode
		const logFile = options.logFile || (await findLatestLog());
		const logger = new TestLogger(testConfig.paths.logDir, 'analysis');

		if (!existsSync(logFile)) {
			console.error(chalk.red(`Log file not found: ${logFile}`));
			process.exit(1);
		}

		await analyzeLogFile(logFile, logger);
	} else {
		// Test execution mode
		await runTests(options);
	}
}

// Find the latest log file
async function findLatestLog() {
	const { readdir } = await import('fs/promises');
	const files = await readdir(testConfig.paths.logDir);
	const logFiles = files
		.filter((f) => f.startsWith('e2e_run_') && f.endsWith('.log'))
		.sort()
		.reverse();

	if (logFiles.length === 0) {
		throw new Error('No log files found');
	}

	return join(testConfig.paths.logDir, logFiles[0]);
}

// Run the main function
main().catch((error) => {
	console.error(chalk.red('Unexpected error:'), error);
	process.exit(1);
});
