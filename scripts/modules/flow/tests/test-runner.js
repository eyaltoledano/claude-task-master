#!/usr/bin/env node

/**
 * Task Master Flow Test Runner
 *
 * A comprehensive test runner for the Flow TUI system that can run:
 * - Unit tests (with mocks)
 * - Integration tests (real components)
 * - E2E tests (full workflows)
 * - Visual tests (TUI components)
 * - Test runners (orchestration utilities)
 *
 * Usage:
 *   node test-runner.js                    # Run all tests
 *   node test-runner.js unit               # Run all unit tests
 *   node test-runner.js integration        # Run all integration tests
 *   node test-runner.js e2e                # Run all e2e tests
 *   node test-runner.js visual             # Run all visual tests
 *   node test-runner.js ast                # Run AST-related tests
 *   node test-runner.js hooks              # Run hook-related tests
 *   node test-runner.js services           # Run service-related tests
 *   node test-runner.js --watch            # Run in watch mode
 *   node test-runner.js --coverage         # Run with coverage
 *   node test-runner.js --help             # Show help
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FlowTestRunner {
	constructor() {
		this.testDir = __dirname;
		this.rootDir = join(__dirname, '../../../..');
		this.results = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			suites: []
		};
		this.colors = {
			reset: '\x1b[0m',
			bright: '\x1b[1m',
			red: '\x1b[31m',
			green: '\x1b[32m',
			yellow: '\x1b[33m',
			blue: '\x1b[34m',
			magenta: '\x1b[35m',
			cyan: '\x1b[36m',
			white: '\x1b[37m'
		};
	}

	color(text, colorName) {
		return `${this.colors[colorName]}${text}${this.colors.reset}`;
	}

	log(message, colorName = 'white') {
		console.log(this.color(message, colorName));
	}

	async run() {
		const args = process.argv.slice(2);

		if (args.includes('--help') || args.includes('-h')) {
			this.showHelp();
			return;
		}

		this.printHeader();

		const options = this.parseArgs(args);

		try {
			await this.executeTests(options);
			this.printSummary();
			process.exit(this.results.failed > 0 ? 1 : 0);
		} catch (error) {
			this.log(`\n❌ Test runner failed: ${error.message}`, 'red');
			process.exit(1);
		}
	}

	parseArgs(args) {
		const options = {
			testType: null,
			component: null,
			watch: false,
			coverage: false,
			verbose: false,
			pattern: null
		};

		for (const arg of args) {
			if (arg === '--watch' || arg === '-w') {
				options.watch = true;
			} else if (arg === '--coverage' || arg === '-c') {
				options.coverage = true;
			} else if (arg === '--verbose' || arg === '-v') {
				options.verbose = true;
			} else if (arg.startsWith('--pattern=')) {
				options.pattern = arg.split('=')[1];
			} else if (!arg.startsWith('-')) {
				// Determine if it's a test type or component
				if (['unit', 'integration', 'e2e', 'visual'].includes(arg)) {
					options.testType = arg;
				} else {
					options.component = arg;
				}
			}
		}

		return options;
	}

	printHeader() {
		this.log('\n' + '='.repeat(60), 'cyan');
		this.log('🧪 TASK MASTER FLOW TEST RUNNER', 'cyan');
		this.log('='.repeat(60), 'cyan');
		this.log('📍 Running tests from: scripts/modules/flow/tests/', 'blue');
		this.log('');
	}

	showHelp() {
		this.log('\n🧪 Task Master Flow Test Runner', 'cyan');
		this.log('\nUsage:', 'bright');
		this.log('  node test-runner.js [options] [test-type|component]', 'white');

		this.log('\nTest Types:', 'bright');
		this.log('  unit          Run unit tests (with mocks)', 'white');
		this.log(
			'  integration   Run integration tests (real components)',
			'white'
		);
		this.log('  e2e           Run end-to-end tests (full workflows)', 'white');
		this.log('  visual        Run visual/TUI tests', 'white');

		this.log('\nComponents:', 'bright');
		this.log('  ast           Run AST-related tests', 'white');
		this.log('  hooks         Run hook system tests', 'white');
		this.log('  services      Run service tests', 'white');
		this.log('  worktree      Run worktree tests', 'white');
		this.log('  backends      Run backend interface tests', 'white');
		this.log('  tui           Run TUI component tests', 'white');
		this.log('  observability Run observability tests', 'white');

		this.log('\nOptions:', 'bright');
		this.log('  --watch, -w          Run in watch mode', 'white');
		this.log('  --coverage, -c       Run with coverage report', 'white');
		this.log('  --verbose, -v        Verbose output', 'white');
		this.log('  --pattern=<pattern>  Run tests matching pattern', 'white');
		this.log('  --help, -h           Show this help', 'white');

		this.log('\nExamples:', 'bright');
		this.log(
			'  node test-runner.js                    # Run all tests',
			'green'
		);
		this.log(
			'  node test-runner.js unit               # Run all unit tests',
			'green'
		);
		this.log(
			'  node test-runner.js ast                # Run AST tests',
			'green'
		);
		this.log(
			'  node test-runner.js unit ast           # Run unit AST tests',
			'green'
		);
		this.log('  node test-runner.js --watch            # Watch mode', 'green');
		this.log(
			'  node test-runner.js --coverage         # With coverage',
			'green'
		);
		this.log('');
	}

	async executeTests(options) {
		if (options.testType && options.component) {
			// Run specific test type for specific component
			await this.runSpecificTests(options.testType, options.component, options);
		} else if (options.testType) {
			// Run all tests of a specific type
			await this.runTestType(options.testType, options);
		} else if (options.component) {
			// Run all tests for a specific component
			await this.runComponentTests(options.component, options);
		} else {
			// Run all tests
			await this.runAllTests(options);
		}
	}

	async runAllTests(options) {
		this.log('🚀 Running all Flow tests...\n', 'cyan');

		const testTypes = ['unit', 'integration', 'e2e', 'visual'];

		for (const testType of testTypes) {
			await this.runTestType(testType, options);
		}

		// Note: Removed legacy runner calls - we now handle all test execution directly
	}

	async runTestType(testType, options) {
		this.log(`\n📂 Running ${testType} tests...`, 'blue');

		const testDir = join(this.testDir, testType);

		if (!existsSync(testDir)) {
			this.log(`⚠️  No ${testType} test directory found`, 'yellow');
			return;
		}

		if (testType === 'visual' || testType === 'e2e') {
			// These contain .js files that should be run directly with Node
			await this.runNodeTests(testDir, options);
		} else {
			// These contain .test.js files that should be run with Jest
			await this.runJestTests(testDir, options);
		}
	}

	async runComponentTests(component, options) {
		this.log(`\n🔧 Running ${component} tests...`, 'blue');

		// Look for component tests in different test types
		const testTypes = ['unit', 'integration', 'e2e', 'visual'];

		for (const testType of testTypes) {
			const componentPath = join(this.testDir, testType, component);

			if (existsSync(componentPath)) {
				this.log(`  📁 Found ${testType}/${component}`, 'cyan');

				if (testType === 'visual' || testType === 'e2e') {
					await this.runNodeTests(componentPath, options);
				} else {
					await this.runJestTests(componentPath, options);
				}
			}
		}
	}

	async runSpecificTests(testType, component, options) {
		this.log(`\n🎯 Running ${testType}/${component} tests...`, 'blue');

		const testPath = join(this.testDir, testType, component);

		if (!existsSync(testPath)) {
			this.log(`⚠️  No tests found at ${testType}/${component}`, 'yellow');
			return;
		}

		if (testType === 'visual' || testType === 'e2e') {
			await this.runNodeTests(testPath, options);
		} else {
			await this.runJestTests(testPath, options);
		}
	}

	async runJestTests(testPath, options) {
		const jestArgs = [];

		// Use the local Jest configuration
		jestArgs.push('--config', join(this.testDir, 'jest.config.js'));

		// Test path
		jestArgs.push(testPath);

		// Options
		if (options.coverage) {
			jestArgs.push('--coverage');
		}

		if (options.watch) {
			jestArgs.push('--watch');
		}

		if (options.verbose) {
			jestArgs.push('--verbose');
		}

		if (options.pattern) {
			jestArgs.push('--testNamePattern', options.pattern);
		}

		// Add silent flag to reduce noise
		if (!options.verbose) {
			jestArgs.push('--silent');
		}

		const jestPath = join(this.rootDir, 'node_modules/.bin/jest');

		try {
			const result = await this.runCommand('node', [
				'--experimental-vm-modules',
				jestPath,
				...jestArgs
			]);

			this.processJestResult(result, testPath);
		} catch (error) {
			this.log(`❌ Jest tests failed in ${testPath}`, 'red');
			this.results.failed++;
		}
	}

	async runNodeTests(testPath, options) {
		const testFiles = this.findTestFiles(testPath, ['.js']);

		for (const testFile of testFiles) {
			try {
				this.log(`  🧪 Running ${testFile}...`, 'cyan');

				const result = await this.runCommand('node', [testFile]);

				if (result.code === 0) {
					this.log(`  ✅ ${testFile} passed`, 'green');
					this.results.passed++;
				} else {
					this.log(`  ❌ ${testFile} failed`, 'red');
					this.results.failed++;

					if (options.verbose) {
						this.log(`     Output: ${result.stdout}`, 'yellow');
						this.log(`     Error: ${result.stderr}`, 'red');
					}
				}

				this.results.total++;
			} catch (error) {
				this.log(`  ❌ ${testFile} crashed: ${error.message}`, 'red');
				this.results.failed++;
				this.results.total++;
			}
		}
	}

	findTestFiles(dir, extensions = ['.test.js', '.js']) {
		const files = [];

		if (!existsSync(dir)) return files;

		const scan = (currentDir) => {
			const items = readdirSync(currentDir);

			for (const item of items) {
				const fullPath = join(currentDir, item);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					scan(fullPath);
				} else if (extensions.some((ext) => item.endsWith(ext))) {
					files.push(fullPath);
				}
			}
		};

		scan(dir);
		return files;
	}

	async runCommand(command, args, options = {}) {
		return new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				stdio: 'pipe',
				cwd: this.testDir,
				...options
			});

			let stdout = '';
			let stderr = '';

			child.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				resolve({
					code,
					stdout: stdout.trim(),
					stderr: stderr.trim()
				});
			});

			child.on('error', (error) => {
				reject(error);
			});

			// Handle watch mode - don't wait for completion
			if (options.watch) {
				setTimeout(() => {
					resolve({ code: 0, stdout: 'Watch mode started', stderr: '' });
				}, 1000);
			}
		});
	}

	processJestResult(result, testPath) {
		const output = result.stdout + result.stderr;

		// Try to parse Jest output for test counts
		const testMatch = output.match(
			/Tests:\s*(\d+)\s*failed.*?(\d+)\s*passed.*?(\d+)\s*total/
		);
		const suiteMatch = output.match(
			/Test Suites:\s*(\d+)\s*failed.*?(\d+)\s*passed.*?(\d+)\s*total/
		);

		if (testMatch) {
			const [, failed, passed, total] = testMatch;
			this.results.failed += parseInt(failed);
			this.results.passed += parseInt(passed);
			this.results.total += parseInt(total);

			if (parseInt(failed) > 0) {
				this.log(`  ❌ ${failed} test(s) failed in ${testPath}`, 'red');
			} else {
				this.log(`  ✅ All ${passed} test(s) passed in ${testPath}`, 'green');
			}
		} else if (result.code === 0) {
			this.log(`  ✅ Tests passed in ${testPath}`, 'green');
			this.results.passed++;
			this.results.total++;
		} else {
			this.log(`  ❌ Tests failed in ${testPath}`, 'red');
			this.results.failed++;
			this.results.total++;
		}
	}

	printSummary() {
		const successRate =
			this.results.total > 0
				? ((this.results.passed / this.results.total) * 100).toFixed(1)
				: '0.0';

		this.log('\n' + '='.repeat(60), 'cyan');
		this.log('📊 TEST RESULTS SUMMARY', 'cyan');
		this.log('='.repeat(60), 'cyan');

		this.log(`\n📈 Results:`, 'bright');
		this.log(`   Total Tests: ${this.results.total}`, 'white');
		this.log(`   Passed: ${this.results.passed}`, 'green');
		this.log(
			`   Failed: ${this.results.failed}`,
			this.results.failed > 0 ? 'red' : 'white'
		);
		this.log(
			`   Success Rate: ${successRate}%`,
			this.results.failed > 0 ? 'red' : 'green'
		);

		if (this.results.failed === 0) {
			this.log('\n🎉 All tests passed!', 'green');
		} else {
			this.log(`\n⚠️  ${this.results.failed} test(s) failed`, 'red');
		}

		this.log('\n💡 Tips:', 'cyan');
		this.log('   • Use --verbose for detailed output', 'white');
		this.log('   • Use --watch for continuous testing', 'white');
		this.log('   • Use --coverage for coverage reports', 'white');
		this.log('   • Run specific components: node test-runner.js ast', 'white');
		this.log('');
	}
}

// Run the test runner
if (import.meta.url === `file://${process.argv[1]}`) {
	const runner = new FlowTestRunner();
	runner.run().catch((error) => {
		console.error('💥 Test runner crashed:', error);
		process.exit(1);
	});
}

export { FlowTestRunner };
