#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unified Test Runner for Task Master Flow
 * Handles both Jest and Non-Jest tests with categorized execution
 * Now includes Enhanced Mode with parallel execution, analytics, and CI/CD integration
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
		this.enhanced = process.argv.includes('--enhanced') || process.argv.includes('--advanced');
	}

	/**
	 * Main test execution coordinator
	 */
	async run() {
		const args = process.argv.slice(2);
		const category = this.parseCategory(args);

		if (this.enhanced) {
			console.log('🚀 Task Master Flow - Enhanced Test Runner');
			console.log('=====================================');
			console.log(`System: ${os.platform()} ${os.arch()}`);
			console.log(`Node: ${process.version}`);
			console.log(`CPUs: ${os.cpus().length}`);
			console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
			console.log('=====================================\n');
			
			return this.runEnhancedMode(args);
		}

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
	 * Run enhanced mode with parallel execution and analytics
	 */
	async runEnhancedMode(args) {
		try {
			const enhancedRunner = new EnhancedTestRunner();
			const options = this.parseEnhancedOptions(args);
			await enhancedRunner.run(options);
		} catch (error) {
			console.error('💥 Enhanced test runner failed:', error);
			process.exit(1);
		}
	}

	/**
	 * Parse enhanced mode options
	 */
	parseEnhancedOptions(args) {
		const options = {
			phases: null,
			generateFixtures: true,
			saveBaseline: false
		};

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			
			if (arg === '--phases' && i + 1 < args.length) {
				options.phases = args[i + 1].split(',');
				i++;
			} else if (arg === '--no-fixtures') {
				options.generateFixtures = false;
			} else if (arg === '--save-baseline') {
				options.saveBaseline = true;
			}
		}

		return options;
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
  --verbose, -v        Verbose output
  --coverage, -c       Generate coverage report (Jest only)
  --enhanced           Enable enhanced mode with parallel execution and analytics
  --phases <list>      Run specific phases (e.g., "1.1,2.1,3.1")
  --no-fixtures        Skip automatic fixture generation (enhanced mode)
  --save-baseline      Update performance baseline (enhanced mode)
  --help, -h           Show this help

Examples:
  node run-tests.js                              # Run all tests (basic mode)
  node run-tests.js unit                         # Run unit tests only
  node run-tests.js component TaskList           # Run TaskList component tests
  node run-tests.js --coverage                   # Run with coverage
  node run-tests.js watch                        # Watch mode
  
Enhanced Mode Examples:
  node run-tests.js --enhanced                   # Run enhanced mode (all phases)
  node run-tests.js --enhanced --phases 1.1,2.1 # Specific phases only
  node run-tests.js --enhanced --no-fixtures     # Skip fixture generation
  node run-tests.js --enhanced --save-baseline   # Update performance baseline
        `);
	}
}

/**
 * Enhanced Test Runner with parallel execution, analytics, and CI/CD integration
 */
class EnhancedTestRunner {
	constructor() {
		this.baseDir = __dirname;
		this.analytics = new TestAnalytics();
		this.fixtureGenerator = new FixtureGenerator();
		this.parallelExecutor = new ParallelExecutor();
		this.cicdIntegrator = new CICDIntegrator();
	}

	async run(options = {}) {
		const startTime = performance.now();
		
		console.log('🎯 Initializing Enhanced Test Runner...\n');

		// Generate fixtures if enabled
		if (options.generateFixtures) {
			console.log('📦 Generating test fixtures...');
			await this.fixtureGenerator.generate();
		}

		// Load baseline for comparison
		await this.analytics.loadBaseline();

		// Run tests
		const phases = options.phases || this.getDefaultPhases();
		const results = await this.parallelExecutor.runPhases(phases);

		// Analyze results
		const analysis = await this.analytics.analyze(results);

		// Save baseline if requested
		if (options.saveBaseline) {
			await this.analytics.saveBaseline(analysis);
		}

		// Generate reports
		await this.generateReports(results, analysis);

		// CI/CD integration
		await this.cicdIntegrator.processResults(results, analysis);

		const duration = performance.now() - startTime;
		console.log(`\n⏱️  Total execution time: ${Math.round(duration)}ms`);

		this.printEnhancedReport(results, analysis);
		
		const exitCode = this.determineExitCode(results);
		process.exit(exitCode);
	}

	getDefaultPhases() {
		return ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.3', '4.1', '4.2', '5.1', '5.2'];
	}

	async generateReports(results, analysis) {
		// Create reports directory
		const reportsDir = path.join(this.baseDir, 'reports');
		await fs.mkdir(reportsDir, { recursive: true });

		// JSON report
		const jsonReport = {
			timestamp: new Date().toISOString(),
			results,
			analysis,
			system: {
				platform: os.platform(),
				arch: os.arch(),
				nodeVersion: process.version,
				cpus: os.cpus().length,
				memory: os.totalmem()
			}
		};

		await fs.writeFile(
			path.join(reportsDir, 'enhanced-test-report.json'),
			JSON.stringify(jsonReport, null, 2)
		);

		console.log('📊 Enhanced test reports generated in reports/');
	}

	printEnhancedReport(results, analysis) {
		console.log('\n' + '='.repeat(80));
		console.log('📊 ENHANCED TEST RUNNER - FINAL REPORT');
		console.log('='.repeat(80));

		// Phase Results
		console.log('\n🧪 Phase Results:');
		let totalPassed = 0;
		let totalFailed = 0;
		let totalTests = 0;

		for (const [phase, result] of Object.entries(results)) {
			const passed = result.passed || 0;
			const failed = result.failed || 0;
			const total = passed + failed;
			totalPassed += passed;
			totalFailed += failed;
			totalTests += total;

			const status = failed === 0 ? '✅' : '❌';
			console.log(`   ${status} Phase ${phase}: ${passed}/${total} passed (${result.duration}ms)`);
		}

		// Performance Analysis
		if (analysis.regressions.length > 0) {
			console.log('\n⚠️  Performance Regressions Detected:');
			analysis.regressions.forEach(regression => {
				console.log(`   🔍 ${regression.metric}: ${regression.change}`);
			});
		}

		// Overall Summary
		console.log('\n📈 Overall Summary:');
		console.log(`   ✅ Total Passed: ${totalPassed}`);
		console.log(`   ❌ Total Failed: ${totalFailed}`);
		console.log(`   📊 Total Tests: ${totalTests}`);
		console.log(`   🎯 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

		if (totalFailed === 0) {
			console.log('\n🎉 All tests passed!');
		} else {
			console.log(`\n❌ ${totalFailed} test(s) failed`);
		}

		console.log('='.repeat(80));
	}

	determineExitCode(results) {
		return Object.values(results).some(result => result.failed > 0) ? 1 : 0;
	}
}

/**
 * Test Analytics for performance tracking and regression detection
 */
class TestAnalytics {
	constructor() {
		this.baselineFile = path.join(__dirname, '.test-baseline.json');
		this.baseline = null;
	}

	async loadBaseline() {
		try {
			const data = await fs.readFile(this.baselineFile, 'utf8');
			this.baseline = JSON.parse(data);
		} catch (error) {
			console.log('ℹ️  No baseline found, creating new baseline');
			this.baseline = {};
		}
	}

	async analyze(results) {
		const analysis = {
			regressions: [],
			improvements: [],
			metrics: {}
		};

		for (const [phase, result] of Object.entries(results)) {
			const baseline = this.baseline[phase];
			if (baseline) {
				// Check for regressions
				if (result.duration > baseline.duration * 1.2) {
					analysis.regressions.push({
						phase,
						metric: 'duration',
						change: `+${Math.round((result.duration - baseline.duration) / baseline.duration * 100)}%`
					});
				}

				if (result.memoryUsage > baseline.memoryUsage * 1.15) {
					analysis.regressions.push({
						phase,
						metric: 'memory',
						change: `+${Math.round((result.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage * 100)}%`
					});
				}

				// Check for improvements
				if (result.duration < baseline.duration * 0.9) {
					analysis.improvements.push({
						phase,
						metric: 'duration',
						change: `-${Math.round((baseline.duration - result.duration) / baseline.duration * 100)}%`
					});
				}
			}

			analysis.metrics[phase] = {
				duration: result.duration,
				memoryUsage: result.memoryUsage,
				successRate: result.passed / (result.passed + result.failed)
			};
		}

		return analysis;
	}

	async saveBaseline(analysis) {
		await fs.writeFile(this.baselineFile, JSON.stringify(analysis.metrics, null, 2));
		console.log('💾 Performance baseline updated');
	}
}

/**
 * Fixture Generator for automatic test data creation
 */
class FixtureGenerator {
	async generate() {
		const fixturesDir = path.join(__dirname, 'fixtures');
		await fs.mkdir(fixturesDir, { recursive: true });
		
		// Basic fixture generation
		console.log('   📝 Generating basic test fixtures...');
	}
}

/**
 * Parallel Executor for running tests concurrently
 */
class ParallelExecutor {
	constructor() {
		this.maxWorkers = Math.min(os.cpus().length, 8);
	}

	async runPhases(phases) {
		const results = {};
		const phaseConfigs = this.getPhaseConfigs();
		
		// Group phases by priority for parallel execution
		const phaseGroups = this.groupPhasesByPriority(phases, phaseConfigs);
		
		for (const group of phaseGroups) {
			const groupResults = await this.runPhaseGroup(group);
			Object.assign(results, groupResults);
		}

		return results;
	}

	getPhaseConfigs() {
		return {
			'1.1': { name: 'AST Language Detection', priority: 1, timeout: 30000 },
			'1.2': { name: 'AST Cache System', priority: 1, timeout: 30000 },
			'1.3': { name: 'AST Context Building', priority: 1, timeout: 45000 },
			'2.1': { name: 'Background Services', priority: 2, timeout: 60000 },
			'2.2': { name: 'Hook System', priority: 2, timeout: 60000 },
			'2.3': { name: 'Worktree Integration', priority: 2, timeout: 45000 },
			'3.1': { name: 'AST-Claude Integration', priority: 3, timeout: 90000 },
			'3.3': { name: 'Workflow Automation', priority: 3, timeout: 90000 },
			'4.1': { name: 'Real-World E2E', priority: 4, timeout: 120000 },
			'4.2': { name: 'Cross-Platform', priority: 4, timeout: 120000 },
			'5.1': { name: 'Quality Analysis', priority: 5, timeout: 60000 },
			'5.2': { name: 'Performance & Stress', priority: 5, timeout: 180000 }
		};
	}

	groupPhasesByPriority(phases, configs) {
		const groups = {};
		
		phases.forEach(phase => {
			const priority = configs[phase]?.priority || 1;
			if (!groups[priority]) groups[priority] = [];
			groups[priority].push(phase);
		});

		return Object.keys(groups).sort().map(priority => groups[priority]);
	}

	async runPhaseGroup(phases) {
		const promises = phases.map(phase => this.runPhase(phase));
		const results = await Promise.allSettled(promises);
		
		const groupResults = {};
		phases.forEach((phase, index) => {
			const result = results[index];
			if (result.status === 'fulfilled') {
				groupResults[phase] = result.value;
			} else {
				groupResults[phase] = {
					passed: 0,
					failed: 1,
					duration: 0,
					memoryUsage: 0,
					error: result.reason?.message || 'Unknown error'
				};
			}
		});

		return groupResults;
	}

	async runPhase(phase) {
		const startTime = performance.now();
		const startMemory = process.memoryUsage().heapUsed;

		try {
			const phaseRunner = path.join(__dirname, 'run', `run-phase-${phase}-tests.js`);
			
			// Check if phase runner exists
			try {
				await fs.access(phaseRunner);
			} catch {
				console.log(`ℹ️  Phase ${phase} runner not found, skipping...`);
				return { passed: 0, failed: 0, duration: 0, memoryUsage: 0, skipped: true };
			}

			console.log(`🔄 Running Phase ${phase}...`);

			const result = await this.executePhaseRunner(phaseRunner);
			const duration = performance.now() - startTime;
			const memoryUsage = process.memoryUsage().heapUsed - startMemory;

			return {
				passed: result.passed || 0,
				failed: result.failed || 0,
				duration: Math.round(duration),
				memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
				output: result.output
			};
		} catch (error) {
			const duration = performance.now() - startTime;
			console.error(`❌ Phase ${phase} failed: ${error.message}`);
			
			return {
				passed: 0,
				failed: 1,
				duration: Math.round(duration),
				memoryUsage: 0,
				error: error.message
			};
		}
	}

	executePhaseRunner(phaseRunner) {
		return new Promise((resolve, reject) => {
			const child = spawn('node', [phaseRunner], {
				cwd: __dirname,
				stdio: 'pipe'
			});

			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				// Simple result parsing
				const passed = (stdout.match(/✅/g) || []).length;
				const failed = (stdout.match(/❌/g) || []).length;

				resolve({
					passed,
					failed,
					output: stdout,
					stderr,
					exitCode: code
				});
			});

			child.on('error', (error) => {
				reject(error);
			});
		});
	}
}

/**
 * CI/CD Integrator for build system integration
 */
class CICDIntegrator {
	async processResults(results, analysis) {
		// Generate GitHub Actions outputs
		if (process.env.GITHUB_ACTIONS) {
			await this.generateGitHubOutputs(results, analysis);
		}

		// Generate quality gates
		await this.checkQualityGates(results, analysis);
	}

	async generateGitHubOutputs(results, analysis) {
		const totalTests = Object.values(results).reduce((sum, r) => sum + r.passed + r.failed, 0);
		const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
		const successRate = (totalPassed / totalTests) * 100;

		console.log(`::set-output name=total-tests::${totalTests}`);
		console.log(`::set-output name=passed-tests::${totalPassed}`);
		console.log(`::set-output name=success-rate::${successRate.toFixed(1)}`);
		console.log(`::set-output name=regressions::${analysis.regressions.length}`);
	}

	async checkQualityGates(results, analysis) {
		const gates = {
			minSuccessRate: 85,
			maxRegressions: 0,
			maxDuration: 600000 // 10 minutes
		};

		const totalTests = Object.values(results).reduce((sum, r) => sum + r.passed + r.failed, 0);
		const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
		const successRate = (totalPassed / totalTests) * 100;
		const totalDuration = Object.values(results).reduce((sum, r) => sum + r.duration, 0);

		console.log('\n🚪 Quality Gates:');
		
		if (successRate >= gates.minSuccessRate) {
			console.log(`   ✅ Success Rate: ${successRate.toFixed(1)}% (>= ${gates.minSuccessRate}%)`);
		} else {
			console.log(`   ❌ Success Rate: ${successRate.toFixed(1)}% (< ${gates.minSuccessRate}%)`);
		}

		if (analysis.regressions.length <= gates.maxRegressions) {
			console.log(`   ✅ Regressions: ${analysis.regressions.length} (<= ${gates.maxRegressions})`);
		} else {
			console.log(`   ❌ Regressions: ${analysis.regressions.length} (> ${gates.maxRegressions})`);
		}

		if (totalDuration <= gates.maxDuration) {
			console.log(`   ✅ Duration: ${Math.round(totalDuration)}ms (<= ${gates.maxDuration}ms)`);
		} else {
			console.log(`   ❌ Duration: ${Math.round(totalDuration)}ms (> ${gates.maxDuration}ms)`);
		}
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
