#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unified Test Runner for Task Master Flow
 * Handles both Jest and Non-Jest tests with categorized execution
 */
class FlowTestRunner {
	constructor() {
		this.baseDir = __dirname;
		this.results = {
			jest: { passed: 0, failed: 0, skipped: 0, total: 0 },
			nonJest: { passed: 0, failed: 0, skipped: 0, total: 0 },
			startTime: Date.now()
		};
		this.verbose =
			process.argv.includes('--verbose') || process.argv.includes('-v');
		this.coverage =
			process.argv.includes('--coverage') || process.argv.includes('-c');
	}

	/**
	 * Main test execution coordinator
	 */
	async run() {
		const args = process.argv.slice(2);
		const category = this.parseCategory(args);

		console.log('🚀 Task Master Flow - Unified Test Suite\n');

		try {
			switch (category) {
				case 'all':
					await this.runAllTests();
					break;
				case 'jest':
					await this.runJestTests();
					break;
				case 'unit':
					await this.runJestTests('unit');
					break;
				case 'integration':
					await this.runJestTests('integration');
					break;
				case 'e2e':
					await this.runNonJestTests('e2e');
					break;
				case 'visual':
					await this.runNonJestTests('visual');
					break;
				case 'component':
					await this.runComponentTests(args);
					break;
				case 'watch':
					await this.runWatchMode();
					break;
				default:
					await this.runAllTests();
			}

			this.printFinalReport();
			process.exit(this.getExitCode());
		} catch (error) {
			console.error('❌ Test runner failed:', error.message);
			process.exit(1);
		}
	}

	/**
	 * Parse command line arguments to determine test category
	 */
	parseCategory(args) {
		const flags = args.filter((arg) => !arg.startsWith('-'));
		if (flags.length === 0) return 'all';

		const category = flags[0].toLowerCase();
		const validCategories = [
			'all',
			'jest',
			'unit',
			'integration',
			'e2e',
			'visual',
			'component',
			'watch'
		];

		return validCategories.includes(category) ? category : 'all';
	}

	/**
	 * Run all test categories
	 */
	async runAllTests() {
		console.log('📋 Running complete test suite...\n');

		// Run Jest tests first (faster)
		await this.runJestTests();

		// Then non-Jest tests
		await this.runNonJestTests();
	}

	/**
	 * Run Jest-based tests (unit + integration)
	 */
	async runJestTests(specificSuite = null) {
		const suiteText = specificSuite ? ` (${specificSuite})` : '';
		console.log(`🧪 Running Jest tests${suiteText}...`);

		try {
			const jestConfig = path.join(this.baseDir, 'jest.config.js');
			const jestArgs = ['jest', '--config', jestConfig, '--passWithNoTests'];

			if (specificSuite) {
				jestArgs.push('--testPathPattern', specificSuite);
			}

			if (this.coverage) {
				jestArgs.push('--coverage');
			}

			if (this.verbose) {
				jestArgs.push('--verbose');
			}

			const result = await this.executeCommand('npx', jestArgs);
			this.parseJestResults(result);
		} catch (error) {
			console.error(`❌ Jest tests failed: ${error.message}`);
			this.results.jest.failed++;
		}
	}

	/**
	 * Run non-Jest tests (e2e, visual, performance)
	 */
	async runNonJestTests(specificCategory = null) {
		const categories = specificCategory
			? [specificCategory]
			: ['e2e', 'visual'];

		for (const category of categories) {
			await this.runNonJestCategory(category);
		}
	}

	/**
	 * Run specific non-Jest test category
	 */
	async runNonJestCategory(category) {
		console.log(`\n🎯 Running ${category} tests...`);

		const categoryDir = path.join(this.baseDir, category);

		try {
			// Check if category directory exists
			await fs.access(categoryDir);
			const files = await fs.readdir(categoryDir);
			const testFiles = files.filter((file) => file.endsWith('.js'));

			if (testFiles.length === 0) {
				console.log(`ℹ️  No ${category} test files found, skipping...`);
				return;
			}

			for (const testFile of testFiles) {
				await this.runNonJestFile(path.join(categoryDir, testFile), category);
			}
		} catch (error) {
			if (error.code === 'ENOENT') {
				console.log(`ℹ️  ${category} directory not found, skipping...`);
				return;
			}
			console.error(`❌ ${category} tests failed: ${error.message}`);
			this.results.nonJest.failed++;
		}
	}

	/**
	 * Run individual non-Jest test file
	 */
	async runNonJestFile(filePath, category) {
		const fileName = path.basename(filePath);
		console.log(`  🔄 Running ${fileName}...`);

		try {
			const result = await this.executeCommand('node', [filePath]);

			if (result.code === 0) {
				console.log(`  ✅ ${fileName} passed`);
				this.results.nonJest.passed++;
			} else {
				console.log(`  ❌ ${fileName} failed`);
				this.results.nonJest.failed++;
				if (this.verbose && result.stderr) {
					console.log(`     Error: ${result.stderr}`);
				}
			}
		} catch (error) {
			console.log(`  ❌ ${fileName} error: ${error.message}`);
			this.results.nonJest.failed++;
		}

		this.results.nonJest.total++;
	}

	/**
	 * Run tests for specific component
	 */
	async runComponentTests(args) {
		const componentName = args.find(
			(arg) => !arg.startsWith('-') && arg !== 'component'
		);

		if (!componentName) {
			console.error(
				'❌ Component name required. Usage: --component ComponentName'
			);
			process.exit(1);
		}

		console.log(`🎯 Running tests for component: ${componentName}`);

		const jestArgs = [
			'jest',
			'--config',
			path.join(this.baseDir, 'jest.config.js'),
			'--testNamePattern',
			componentName,
			'--passWithNoTests'
		];

		if (this.verbose) {
			jestArgs.push('--verbose');
		}

		try {
			const result = await this.executeCommand('npx', jestArgs);
			this.parseJestResults(result);
		} catch (error) {
			console.error(`❌ Component tests failed: ${error.message}`);
			this.results.jest.failed++;
		}
	}

	/**
	 * Run tests in watch mode
	 */
	async runWatchMode() {
		console.log('👀 Running tests in watch mode...');
		console.log('Press Ctrl+C to exit\n');

		const jestArgs = [
			'jest',
			'--config',
			path.join(this.baseDir, 'jest.config.js'),
			'--watch',
			'--passWithNoTests'
		];

		try {
			const child = spawn('npx', jestArgs, {
				stdio: 'inherit',
				cwd: this.baseDir
			});

			child.on('exit', (code) => {
				process.exit(code);
			});
		} catch (error) {
			console.error(`❌ Watch mode failed: ${error.message}`);
			process.exit(1);
		}
	}

	/**
	 * Execute command and capture output
	 */
	executeCommand(command, args) {
		return new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				cwd: this.baseDir,
				stdio: this.verbose ? 'inherit' : 'pipe'
			});

			let stdout = '';
			let stderr = '';

			if (!this.verbose) {
				child.stdout?.on('data', (data) => {
					stdout += data.toString();
				});

				child.stderr?.on('data', (data) => {
					stderr += data.toString();
				});
			}

			child.on('close', (code) => {
				resolve({ code, stdout, stderr });
			});

			child.on('error', (error) => {
				reject(error);
			});
		});
	}

	/**
	 * Parse Jest test results from output
	 */
	parseJestResults(result) {
		// Simple parsing - in real implementation, could parse JSON output
		if (result.code === 0) {
			console.log('✅ Jest tests passed');
			this.results.jest.passed++;
		} else {
			console.log('❌ Jest tests failed');
			this.results.jest.failed++;
		}
		this.results.jest.total++;
	}

	/**
	 * Print comprehensive test report
	 */
	printFinalReport() {
		const duration = Date.now() - this.results.startTime;
		const durationMs = `${duration}ms`;

		console.log('\n' + '='.repeat(60));
		console.log('📊 FLOW TEST SUITE - FINAL REPORT');
		console.log('='.repeat(60));

		// Jest Results
		if (this.results.jest.total > 0) {
			console.log('\n🧪 Jest Tests:');
			console.log(`   ✅ Passed: ${this.results.jest.passed}`);
			console.log(`   ❌ Failed: ${this.results.jest.failed}`);
			console.log(`   ⏭️  Skipped: ${this.results.jest.skipped}`);
			console.log(`   📊 Total: ${this.results.jest.total}`);
		}

		// Non-Jest Results
		if (this.results.nonJest.total > 0) {
			console.log('\n🎯 Non-Jest Tests:');
			console.log(`   ✅ Passed: ${this.results.nonJest.passed}`);
			console.log(`   ❌ Failed: ${this.results.nonJest.failed}`);
			console.log(`   ⏭️  Skipped: ${this.results.nonJest.skipped}`);
			console.log(`   📊 Total: ${this.results.nonJest.total}`);
		}

		// Overall Summary
		const totalPassed = this.results.jest.passed + this.results.nonJest.passed;
		const totalFailed = this.results.jest.failed + this.results.nonJest.failed;
		const totalTests = this.results.jest.total + this.results.nonJest.total;

		console.log('\n📈 Overall Summary:');
		console.log(`   ✅ Total Passed: ${totalPassed}`);
		console.log(`   ❌ Total Failed: ${totalFailed}`);
		console.log(`   📊 Total Tests: ${totalTests}`);
		console.log(`   ⏱️  Duration: ${durationMs}`);

		if (totalTests === 0) {
			console.log('\n⚠️  No tests found to run');
		} else if (totalFailed === 0) {
			console.log('\n🎉 All tests passed!');
		} else {
			console.log(`\n❌ ${totalFailed} test(s) failed`);
		}

		console.log('='.repeat(60));
	}

	/**
	 * Determine exit code based on test results
	 */
	getExitCode() {
		const totalFailed = this.results.jest.failed + this.results.nonJest.failed;
		return totalFailed > 0 ? 1 : 0;
	}

	/**
	 * Print usage information
	 */
	static printUsage() {
		console.log(`
🚀 Task Master Flow - Unified Test Runner

Usage: node run-tests.js [category] [options]

Categories:
  all           Run all test categories (default)
  jest          Run all Jest tests (unit + integration)
  unit          Run unit tests only
  integration   Run integration tests only
  e2e           Run end-to-end tests only
  visual        Run visual tests only
  component     Run tests for specific component
  watch         Run tests in watch mode

Options:
  --verbose, -v     Verbose output
  --coverage, -c    Generate coverage report (Jest only)
  --help, -h       Show this help

Examples:
  node run-tests.js                    # Run all tests
  node run-tests.js unit              # Run unit tests only
  node run-tests.js component TaskList # Run TaskList component tests
  node run-tests.js --coverage        # Run with coverage
  node run-tests.js watch             # Watch mode
        `);
	}
}

// Handle help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	FlowTestRunner.printUsage();
	process.exit(0);
}

// Run the test suite
const runner = new FlowTestRunner();
runner.run().catch((error) => {
	console.error('💥 Test runner crashed:', error);
	process.exit(1);
});
