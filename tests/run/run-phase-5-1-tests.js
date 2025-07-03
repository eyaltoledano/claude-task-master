#!/usr/bin/env node

/**
 * Phase 5.1 Quality Analysis Testing Runner
 * 
 * Comprehensive test execution for Quality Analysis components:
 * - CodeQualityAnalyzer (Quality metric accuracy testing)
 * - QualityInsightsFormatter (PR description formatting testing)
 * - TestQualityAnalyzer (Linting integration testing)
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const PHASE_5_1_TESTS = [
	{
		name: 'Code Quality Analyzer Tests',
		path: 'tests/unit/hooks/quality/code-quality-analyzer.test.js',
		description: 'Core quality metric accuracy validation',
		criticalPaths: [
			'analyzeSession - Main analysis workflow',
			'calculateStructuralMetrics - Basic code metrics',
			'calculateComplexity - Cyclomatic complexity analysis',
			'runBiomeAnalysis - Linting integration',
			'analyzeTaskAlignment - Task relevance checking'
		],
		coverage: {
			target: 95,
			critical: 90
		}
	},
	{
		name: 'Quality Insights Formatter Tests',
		path: 'tests/unit/hooks/quality/quality-insights-formatter.test.js',
		description: 'PR description and output formatting verification',
		criticalPaths: [
			'formatForTaskUpdate - Task update formatting',
			'formatForPRDescription - PR description generation',
			'formatForConsole - CLI output formatting',
			'generateDetailedReport - Comprehensive reporting'
		],
		coverage: {
			target: 95,
			critical: 90
		}
	},
	{
		name: 'Test Quality Analyzer Integration Tests',
		path: 'tests/unit/hooks/quality/test-quality-analyzer.test.js',
		description: 'Linting integration and workflow testing',
		criticalPaths: [
			'Biome configuration detection',
			'Linting JSON output parsing',
			'File filtering for linting support',
			'Error handling for linting failures'
		],
		coverage: {
			target: 95,
			critical: 85
		}
	}
];

class Phase51TestRunner {
	constructor() {
		this.results = {
			phase: '5.1',
			name: 'Quality Analysis Testing',
			startTime: new Date(),
			endTime: null,
			duration: 0,
			totalTests: 0,
			passedTests: 0,
			failedTests: 0,
			testSuites: [],
			coverage: {},
			errors: [],
			warnings: [],
			qualityGates: {
				allTestsPass: false,
				coverageThreshold: false,
				noHighSeverityIssues: false,
				performanceAcceptable: false
			}
		};
	}

	async runPhase51Tests() {
		console.log('🧪 Running Phase 5.1: Quality Analysis Testing');
		console.log('='.repeat(60));
		console.log('');

		// Run pre-test validation
		await this.validateTestEnvironment();

		// Execute each test suite
		for (const testConfig of PHASE_5_1_TESTS) {
			console.log(`📋 Running: ${testConfig.name}`);
			console.log(`   Description: ${testConfig.description}`);
			console.log(`   Path: ${testConfig.path}`);
			console.log('');

			const suiteResult = await this.runTestSuite(testConfig);
			this.results.testSuites.push(suiteResult);

			// Update totals
			this.results.totalTests += suiteResult.totalTests;
			this.results.passedTests += suiteResult.passedTests;
			this.results.failedTests += suiteResult.failedTests;

			console.log(`   Result: ${suiteResult.status}`);
			console.log(`   Tests: ${suiteResult.passedTests}/${suiteResult.totalTests} passed`);
			console.log(`   Duration: ${suiteResult.duration}ms`);
			console.log('');
		}

		// Collect coverage data
		await this.collectCoverageData();

		// Evaluate quality gates
		this.evaluateQualityGates();

		// Generate comprehensive report
		await this.generatePhaseReport();

		this.results.endTime = new Date();
		this.results.duration = this.results.endTime - this.results.startTime;

		// Display summary
		this.displaySummary();

		return this.results;
	}

	async validateTestEnvironment() {
		console.log('🔍 Validating test environment...');

		// Check if quality analysis files exist
		const requiredFiles = [
			'scripts/modules/flow/hooks/quality/code-quality-analyzer.js',
			'scripts/modules/flow/hooks/quality/quality-insights-formatter.js',
			'scripts/modules/flow/hooks/quality/test-quality-analyzer.js'
		];

		for (const file of requiredFiles) {
			try {
				await fs.access(file);
				console.log(`   ✅ Found: ${file}`);
			} catch (error) {
				this.results.errors.push(`Missing required file: ${file}`);
				console.log(`   ❌ Missing: ${file}`);
			}
		}

		// Check test files exist
		for (const testConfig of PHASE_5_1_TESTS) {
			try {
				await fs.access(testConfig.path);
				console.log(`   ✅ Test file: ${testConfig.path}`);
			} catch (error) {
				this.results.errors.push(`Missing test file: ${testConfig.path}`);
				console.log(`   ❌ Missing test: ${testConfig.path}`);
			}
		}

		console.log('');
	}

	async runTestSuite(testConfig) {
		const startTime = Date.now();
		
		const suiteResult = {
			name: testConfig.name,
			path: testConfig.path,
			status: 'unknown',
			totalTests: 0,
			passedTests: 0,
			failedTests: 0,
			duration: 0,
			coverage: {},
			criticalPaths: testConfig.criticalPaths,
			errors: [],
			warnings: []
		};

		try {
			const result = await this.executeJestTest(testConfig.path);
			
			suiteResult.status = result.success ? 'passed' : 'failed';
			suiteResult.totalTests = result.numTotalTests || 0;
			suiteResult.passedTests = result.numPassedTests || 0;
			suiteResult.failedTests = result.numFailedTests || 0;
			suiteResult.duration = Date.now() - startTime;

			if (result.testResults && result.testResults.length > 0) {
				result.testResults.forEach(testResult => {
					if (testResult.failureMessage) {
						suiteResult.errors.push(testResult.failureMessage);
					}
				});
			}

		} catch (error) {
			suiteResult.status = 'error';
			suiteResult.errors.push(error.message);
			console.log(`   ❌ Error running ${testConfig.name}: ${error.message}`);
		}

		return suiteResult;
	}

	async executeJestTest(testPath) {
		return new Promise((resolve, reject) => {
			const jestCommand = 'npx';
			const jestArgs = [
				'jest',
				testPath,
				'--json',
				'--coverage',
				'--verbose',
				'--detectOpenHandles',
				'--forceExit'
			];

			const child = spawn(jestCommand, jestArgs, {
				stdio: ['inherit', 'pipe', 'pipe'],
				shell: true
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
				try {
					// Try to parse Jest JSON output
					const output = stdout.trim();
					const lines = output.split('\n');
					
					// Find the JSON line (usually the last line)
					let jsonLine = lines[lines.length - 1];
					for (let i = lines.length - 1; i >= 0; i--) {
						if (lines[i].startsWith('{') && lines[i].includes('"success"')) {
							jsonLine = lines[i];
							break;
						}
					}

					const result = JSON.parse(jsonLine);
					resolve(result);
				} catch (parseError) {
					// If JSON parsing fails, create a basic result object
					const result = {
						success: code === 0,
						numTotalTests: 0,
						numPassedTests: code === 0 ? 1 : 0,
						numFailedTests: code === 0 ? 0 : 1,
						testResults: [],
						rawOutput: stdout,
						rawError: stderr
					};

					if (code === 0) {
						resolve(result);
					} else {
						result.testResults.push({
							failureMessage: stderr || 'Test execution failed'
						});
						resolve(result);
					}
				}
			});

			child.on('error', (error) => {
				reject(error);
			});

			// Kill process after 5 minutes
			setTimeout(() => {
				child.kill('SIGKILL');
				reject(new Error('Test execution timeout'));
			}, 300000);
		});
	}

	async collectCoverageData() {
		console.log('📊 Collecting coverage data...');

		try {
			// Try to read coverage data from Jest output
			const coveragePath = 'coverage/coverage-final.json';
			
			try {
				const coverageData = await fs.readFile(coveragePath, 'utf8');
				const coverage = JSON.parse(coverageData);
				
				this.results.coverage = this.processCoverageData(coverage);
				console.log('   ✅ Coverage data collected');
			} catch (coverageError) {
				console.log('   ⚠️ Coverage data not available');
				this.results.warnings.push('Coverage data not available');
			}

		} catch (error) {
			console.log(`   ❌ Error collecting coverage: ${error.message}`);
			this.results.errors.push(`Coverage collection failed: ${error.message}`);
		}

		console.log('');
	}

	processCoverageData(coverageData) {
		const summary = {
			lines: { total: 0, covered: 0, percentage: 0 },
			functions: { total: 0, covered: 0, percentage: 0 },
			branches: { total: 0, covered: 0, percentage: 0 },
			statements: { total: 0, covered: 0, percentage: 0 },
			files: {}
		};

		for (const [filePath, fileData] of Object.entries(coverageData)) {
			if (filePath.includes('hooks/quality/')) {
				summary.lines.total += fileData.s ? Object.keys(fileData.s).length : 0;
				summary.lines.covered += fileData.s ? Object.values(fileData.s).filter(v => v > 0).length : 0;

				summary.functions.total += fileData.f ? Object.keys(fileData.f).length : 0;
				summary.functions.covered += fileData.f ? Object.values(fileData.f).filter(v => v > 0).length : 0;

				summary.branches.total += fileData.b ? Object.keys(fileData.b).length : 0;
				summary.branches.covered += fileData.b ? Object.values(fileData.b).filter(branch => branch.some(v => v > 0)).length : 0;

				summary.files[filePath] = {
					lines: fileData.s,
					functions: fileData.f,
					branches: fileData.b
				};
			}
		}

		// Calculate percentages
		summary.lines.percentage = summary.lines.total > 0 ? (summary.lines.covered / summary.lines.total) * 100 : 0;
		summary.functions.percentage = summary.functions.total > 0 ? (summary.functions.covered / summary.functions.total) * 100 : 0;
		summary.branches.percentage = summary.branches.total > 0 ? (summary.branches.covered / summary.branches.total) * 100 : 0;

		return summary;
	}

	evaluateQualityGates() {
		console.log('🚦 Evaluating quality gates...');

		// Gate 1: All tests pass
		this.results.qualityGates.allTestsPass = this.results.failedTests === 0;
		console.log(`   ${this.results.qualityGates.allTestsPass ? '✅' : '❌'} All tests pass: ${this.results.passedTests}/${this.results.totalTests}`);

		// Gate 2: Coverage threshold
		const avgCoverage = (
			this.results.coverage.lines?.percentage || 0 +
			this.results.coverage.functions?.percentage || 0 +
			this.results.coverage.branches?.percentage || 0
		) / 3;
		this.results.qualityGates.coverageThreshold = avgCoverage >= 85;
		console.log(`   ${this.results.qualityGates.coverageThreshold ? '✅' : '❌'} Coverage threshold (≥85%): ${avgCoverage.toFixed(1)}%`);

		// Gate 3: No high severity issues
		const highSeverityIssues = this.results.errors.filter(error => 
			error.includes('CRITICAL') || error.includes('FATAL') || error.includes('ERROR')
		).length;
		this.results.qualityGates.noHighSeverityIssues = highSeverityIssues === 0;
		console.log(`   ${this.results.qualityGates.noHighSeverityIssues ? '✅' : '❌'} No high severity issues: ${highSeverityIssues} found`);

		// Gate 4: Performance acceptable
		const avgDuration = this.results.testSuites.reduce((sum, suite) => sum + suite.duration, 0) / this.results.testSuites.length;
		this.results.qualityGates.performanceAcceptable = avgDuration < 30000; // 30 seconds per suite
		console.log(`   ${this.results.qualityGates.performanceAcceptable ? '✅' : '❌'} Performance acceptable (<30s/suite): ${avgDuration.toFixed(0)}ms avg`);

		console.log('');
	}

	async generatePhaseReport() {
		console.log('📝 Generating Phase 5.1 report...');

		const reportData = {
			phase: this.results.phase,
			name: this.results.name,
			timestamp: new Date().toISOString(),
			summary: {
				totalTests: this.results.totalTests,
				passedTests: this.results.passedTests,
				failedTests: this.results.failedTests,
				successRate: this.results.totalTests > 0 ? (this.results.passedTests / this.results.totalTests) * 100 : 0,
				duration: this.results.duration
			},
			testSuites: this.results.testSuites,
			coverage: this.results.coverage,
			qualityGates: this.results.qualityGates,
			errors: this.results.errors,
			warnings: this.results.warnings,
			recommendations: this.generateRecommendations()
		};

		try {
			await fs.mkdir('tests/reports', { recursive: true });
			const reportPath = `tests/reports/phase-5-1-quality-analysis-${Date.now()}.json`;
			await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
			console.log(`   ✅ Report saved: ${reportPath}`);
		} catch (error) {
			console.log(`   ❌ Error saving report: ${error.message}`);
		}

		console.log('');
	}

	generateRecommendations() {
		const recommendations = [];

		// Test failure recommendations
		if (this.results.failedTests > 0) {
			recommendations.push({
				priority: 'high',
				category: 'testing',
				message: `${this.results.failedTests} test(s) failed. Review error messages and fix failing tests.`,
				action: 'Fix failing tests before proceeding to next phase'
			});
		}

		// Coverage recommendations
		const avgCoverage = (
			this.results.coverage.lines?.percentage || 0 +
			this.results.coverage.functions?.percentage || 0 +
			this.results.coverage.branches?.percentage || 0
		) / 3;

		if (avgCoverage < 85) {
			recommendations.push({
				priority: 'medium',
				category: 'coverage',
				message: `Code coverage is below target (${avgCoverage.toFixed(1)}% vs 85%)`,
				action: 'Add more comprehensive test cases for uncovered code paths'
			});
		}

		// Performance recommendations
		const slowSuites = this.results.testSuites.filter(suite => suite.duration > 30000);
		if (slowSuites.length > 0) {
			recommendations.push({
				priority: 'low',
				category: 'performance',
				message: `${slowSuites.length} test suite(s) are slow (>30s)`,
				action: 'Optimize slow tests or consider splitting large test suites'
			});
		}

		// Success recommendations
		if (this.results.failedTests === 0 && avgCoverage >= 85) {
			recommendations.push({
				priority: 'info',
				category: 'success',
				message: 'Phase 5.1 Quality Analysis Testing completed successfully',
				action: 'Ready to proceed to Phase 5.2 Performance & Stress Testing'
			});
		}

		return recommendations;
	}

	displaySummary() {
		console.log('📊 Phase 5.1 Quality Analysis Testing Summary');
		console.log('='.repeat(60));
		console.log(`Total Tests: ${this.results.totalTests}`);
		console.log(`Passed: ${this.results.passedTests}`);
		console.log(`Failed: ${this.results.failedTests}`);
		console.log(`Success Rate: ${this.results.totalTests > 0 ? ((this.results.passedTests / this.results.totalTests) * 100).toFixed(1) : 0}%`);
		console.log(`Duration: ${this.results.duration}ms`);
		console.log('');

		console.log('Quality Gates:');
		Object.entries(this.results.qualityGates).forEach(([gate, passed]) => {
			console.log(`  ${passed ? '✅' : '❌'} ${gate}`);
		});
		console.log('');

		if (this.results.errors.length > 0) {
			console.log('❌ Errors:');
			this.results.errors.forEach(error => console.log(`  - ${error}`));
			console.log('');
		}

		if (this.results.warnings.length > 0) {
			console.log('⚠️ Warnings:');
			this.results.warnings.forEach(warning => console.log(`  - ${warning}`));
			console.log('');
		}

		const allGatesPassed = Object.values(this.results.qualityGates).every(gate => gate);
		console.log(`Overall Result: ${allGatesPassed ? '✅ PASSED' : '❌ FAILED'}`);
		console.log('='.repeat(60));
	}
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const runner = new Phase51TestRunner();
	runner.runPhase51Tests()
		.then(results => {
			const allGatesPassed = Object.values(results.qualityGates).every(gate => gate);
			process.exit(allGatesPassed ? 0 : 1);
		})
		.catch(error => {
			console.error('❌ Phase 5.1 execution failed:', error);
			process.exit(1);
		});
}

export { Phase51TestRunner }; 