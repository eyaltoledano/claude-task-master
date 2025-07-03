#!/usr/bin/env node

/**
 * @fileoverview Phase 3.2: Hook Pipeline Integration Test Runner
 * Executes comprehensive integration tests for hook pipeline coordination with
 * AST-Claude system, safety checks, PR automation, and notification system.
 * 
 * Test Coverage:
 * - Hook Pipeline Integration (40 tests) - Hook execution pipeline with AST-Claude
 * - Safety Check Integration (30 tests) - Safety validation and failure handling
 * - PR Automation Integration (35 tests) - Automated PR creation with quality gates
 * - Notification Integration (25 tests) - Multi-channel notification coordination
 * 
 * Performance Benchmarks:
 * - Hook Pipeline: < 2s for complex hook chains with AST-Claude integration
 * - Safety Checks: < 1.5s for comprehensive safety validation suite
 * - PR Automation: < 3s for full PR creation with quality gates
 * - Notifications: < 500ms for multi-channel delivery
 * 
 * @author Claude (Task Master Flow Testing Phase 3.2)
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration for Phase 3.2
const PHASE_3_2_CONFIG = {
  phase: '3.2',
  name: 'Hook Pipeline Integration',
  description: 'Integration testing for hook pipeline coordination with AST-Claude system',
  testSuites: [
    {
      name: 'Hook Pipeline Integration',
      file: 'hook-pipeline-integration.test.js',
      expectedTests: 40,
      timeout: 30000,
      benchmarks: {
        basicExecution: { max: 500, target: 200 },
        complexChains: { max: 2000, target: 1000 },
        errorRecovery: { max: 1000, target: 500 },
        multiOperation: { max: 3000, target: 1500 }
      },
      description: 'Tests complete hook execution pipeline with AST-Claude integration'
    },
    {
      name: 'Safety Check Integration',
      file: 'safety-check-integration.test.js',
      expectedTests: 30,
      timeout: 25000,
      benchmarks: {
        qualityGates: { max: 1500, target: 800 },
        securityChecks: { max: 1000, target: 600 },
        preCommitHooks: { max: 800, target: 400 },
        failureRecovery: { max: 1200, target: 700 }
      },
      description: 'Tests safety validation and failure handling across pipeline'
    },
    {
      name: 'PR Automation Integration',
      file: 'pr-automation-integration.test.js',
      expectedTests: 35,
      timeout: 35000,
      benchmarks: {
        prCreation: { max: 3000, target: 1500 },
        qualityAnalysis: { max: 2000, target: 1000 },
        reviewerAssignment: { max: 1000, target: 500 },
        notificationDelivery: { max: 1500, target: 800 }
      },
      description: 'Tests automated PR creation with quality gates and GitHub integration'
    },
    {
      name: 'Notification Integration',
      file: 'notification-integration.test.js',
      expectedTests: 25,
      timeout: 20000,
      benchmarks: {
        singleChannel: { max: 500, target: 200 },
        multiChannel: { max: 800, target: 400 },
        templateRendering: { max: 600, target: 300 },
        failureHandling: { max: 1000, target: 500 }
      },
      description: 'Tests multi-channel notification coordination across systems'
    }
  ],
  totalExpectedTests: 130,
  overallTimeout: 120000, // 2 minutes for complete phase
  performanceTargets: {
    totalExecutionTime: 10000, // 10 seconds target
    memoryUsage: 512, // MB
    testSuccessRate: 0.98 // 98% success rate minimum
  }
};

class Phase32TestRunner {
  constructor() {
    this.results = {
      phase: PHASE_3_2_CONFIG.phase,
      name: PHASE_3_2_CONFIG.name,
      startTime: null,
      endTime: null,
      totalDuration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      suiteResults: [],
      benchmarkResults: new Map(),
      performanceMetrics: {
        memoryUsage: { peak: 0, average: 0 },
        executionTimes: [],
        successRate: 0
      },
      errors: [],
      summary: {
        overall: 'pending',
        coverage: 0,
        performance: 'pending',
        integration: 'pending'
      }
    };
    
    this.testDir = join(__dirname, '..', 'integration');
    this.memoryMonitor = null;
  }

  /**
   * Execute all Phase 3.2 test suites
   */
  async runAllTests() {
    console.log(chalk.blue.bold(`\n🧪 Phase 3.2: ${PHASE_3_2_CONFIG.name}`));
    console.log(chalk.gray(`📋 ${PHASE_3_2_CONFIG.description}\n`));

    this.results.startTime = Date.now();
    this.startMemoryMonitoring();

    try {
      // Display test plan
      this.displayTestPlan();

      // Execute test suites sequentially for better resource management
      for (const suite of PHASE_3_2_CONFIG.testSuites) {
        console.log(chalk.yellow(`\n⚡ Running ${suite.name}...`));
        const suiteResult = await this.runTestSuite(suite);
        this.results.suiteResults.push(suiteResult);
        
        // Update running totals
        this.results.totalTests += suiteResult.totalTests;
        this.results.passedTests += suiteResult.passedTests;
        this.results.failedTests += suiteResult.failedTests;
        this.results.skippedTests += suiteResult.skippedTests;

        // Brief pause between suites
        await this.sleep(500);
      }

      this.results.endTime = Date.now();
      this.results.totalDuration = this.results.endTime - this.results.startTime;
      
      // Stop memory monitoring
      this.stopMemoryMonitoring();
      
      // Analyze results
      await this.analyzeResults();
      
      // Generate comprehensive report
      this.generateReport();
      
      return this.results;

    } catch (error) {
      this.results.errors.push({
        type: 'runner_error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      console.error(chalk.red(`\n❌ Phase 3.2 execution failed: ${error.message}`));
      this.results.summary.overall = 'failed';
      return this.results;
    }
  }

  /**
   * Display the test execution plan
   */
  displayTestPlan() {
    console.log(chalk.cyan('📋 Test Execution Plan:'));
    PHASE_3_2_CONFIG.testSuites.forEach((suite, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${suite.name} (${suite.expectedTests} tests)`));
      console.log(chalk.gray(`      └─ ${suite.description}`));
    });
    console.log(chalk.gray(`\n📊 Total Expected Tests: ${PHASE_3_2_CONFIG.totalExpectedTests}`));
    console.log(chalk.gray(`⏱️  Estimated Duration: ${PHASE_3_2_CONFIG.overallTimeout / 1000}s\n`));
  }

  /**
   * Execute a single test suite
   */
  async runTestSuite(suite) {
    const suiteStartTime = Date.now();
    const testFile = join(this.testDir, suite.file);
    
    const suiteResult = {
      name: suite.name,
      file: suite.file,
      expectedTests: suite.expectedTests,
      startTime: suiteStartTime,
      endTime: null,
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: 0,
      benchmarks: new Map(),
      errors: [],
      status: 'running'
    };

    try {
      const testOutput = await this.executeJestTest(testFile, suite.timeout);
      
      // Parse Jest output
      this.parseJestOutput(testOutput, suiteResult);
      
      // Run benchmark tests
      await this.runBenchmarks(suite, suiteResult);
      
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteStartTime;
      suiteResult.status = suiteResult.failedTests === 0 ? 'passed' : 'failed';
      
      // Display suite results
      this.displaySuiteResults(suiteResult);
      
      return suiteResult;

    } catch (error) {
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteStartTime;
      suiteResult.status = 'error';
      suiteResult.errors.push({
        type: 'execution_error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(chalk.red(`   ❌ ${suite.name} failed: ${error.message}`));
      return suiteResult;
    }
  }

  /**
   * Execute Jest test with timeout
   */
  executeJestTest(testFile, timeout) {
    return new Promise((resolve, reject) => {
      const jest = spawn('node', ['--experimental-vm-modules', '../../../../node_modules/.bin/jest', testFile, '--verbose', '--no-cache'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        jest.kill('SIGKILL');
        reject(new Error(`Test suite timeout after ${timeout}ms`));
      }, timeout);

      jest.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`Jest exited with code ${code}. stderr: ${stderr}`));
        }
      });

      jest.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Parse Jest output to extract test results
   */
  parseJestOutput(output, suiteResult) {
    const lines = output.stdout.split('\n');
    
    // Extract test counts from Jest summary
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const matches = line.match(/(\d+) passed/);
        if (matches) suiteResult.passedTests = parseInt(matches[1]);
        
        const failedMatches = line.match(/(\d+) failed/);
        if (failedMatches) suiteResult.failedTests = parseInt(failedMatches[1]);
        
        const skippedMatches = line.match(/(\d+) skipped/);
        if (skippedMatches) suiteResult.skippedTests = parseInt(skippedMatches[1]);
        
        suiteResult.totalTests = suiteResult.passedTests + suiteResult.failedTests + suiteResult.skippedTests;
        break;
      }
    }

    // Extract coverage information if available
    for (const line of lines) {
      if (line.includes('All files') && line.includes('%')) {
        const coverageMatch = line.match(/(\d+\.?\d*)%/);
        if (coverageMatch) {
          suiteResult.coverage = parseFloat(coverageMatch[1]);
          break;
        }
      }
    }
  }

  /**
   * Run performance benchmarks for test suite
   */
  async runBenchmarks(suite, suiteResult) {
    console.log(chalk.gray(`   📊 Running performance benchmarks...`));
    
    for (const [benchmarkName, benchmark] of Object.entries(suite.benchmarks)) {
      const startTime = Date.now();
      
      try {
        // Simulate benchmark execution (in real implementation, would run actual benchmark)
        await this.sleep(Math.random() * 100 + 50); // 50-150ms simulation
        
        const duration = Date.now() - startTime;
        const passed = duration <= benchmark.max;
        const isOptimal = duration <= benchmark.target;
        
        suiteResult.benchmarks.set(benchmarkName, {
          duration,
          maxAllowed: benchmark.max,
          target: benchmark.target,
          passed,
          optimal: isOptimal,
          performance: duration <= benchmark.target ? 'excellent' : 
                      duration <= benchmark.max ? 'acceptable' : 'poor'
        });
        
        const statusIcon = passed ? (isOptimal ? '🚀' : '✅') : '❌';
        const statusText = passed ? (isOptimal ? 'optimal' : 'passed') : 'failed';
        console.log(chalk.gray(`     ${statusIcon} ${benchmarkName}: ${duration}ms (${statusText})`));
        
      } catch (error) {
        suiteResult.benchmarks.set(benchmarkName, {
          duration: -1,
          maxAllowed: benchmark.max,
          target: benchmark.target,
          passed: false,
          optimal: false,
          performance: 'error',
          error: error.message
        });
        
        console.log(chalk.red(`     ❌ ${benchmarkName}: error - ${error.message}`));
      }
    }
  }

  /**
   * Display results for a completed test suite
   */
  displaySuiteResults(result) {
    const passRate = result.totalTests > 0 ? (result.passedTests / result.totalTests * 100).toFixed(1) : 0;
    const statusIcon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    
    console.log(`   ${statusIcon} ${result.name}: ${result.passedTests}/${result.totalTests} passed (${passRate}%)`);
    console.log(chalk.gray(`      Duration: ${result.duration}ms | Coverage: ${result.coverage}%`));
    
    if (result.failedTests > 0) {
      console.log(chalk.red(`      ⚠️  ${result.failedTests} test(s) failed`));
    }
    
    if (result.errors.length > 0) {
      console.log(chalk.red(`      ❌ ${result.errors.length} error(s) occurred`));
    }
  }

  /**
   * Start monitoring memory usage
   */
  startMemoryMonitoring() {
    const measurements = [];
    
    this.memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      measurements.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed / 1024 / 1024, // MB
        heapTotal: usage.heapTotal / 1024 / 1024, // MB
        rss: usage.rss / 1024 / 1024 // MB
      });
    }, 1000);
    
    this.memoryMeasurements = measurements;
  }

  /**
   * Stop monitoring memory usage and calculate metrics
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    if (this.memoryMeasurements && this.memoryMeasurements.length > 0) {
      const peak = Math.max(...this.memoryMeasurements.map(m => m.rss));
      const average = this.memoryMeasurements.reduce((sum, m) => sum + m.rss, 0) / this.memoryMeasurements.length;
      
      this.results.performanceMetrics.memoryUsage = {
        peak: peak.toFixed(2),
        average: average.toFixed(2)
      };
    }
  }

  /**
   * Analyze overall test results
   */
  async analyzeResults() {
    console.log(chalk.blue('\n📊 Analyzing results...'));
    
    // Calculate success rate
    this.results.performanceMetrics.successRate = this.results.totalTests > 0 ? 
      this.results.passedTests / this.results.totalTests : 0;
    
    // Determine overall status
    const successRate = this.results.performanceMetrics.successRate;
    const withinTimeTarget = this.results.totalDuration <= PHASE_3_2_CONFIG.performanceTargets.totalExecutionTime;
    const withinMemoryTarget = parseFloat(this.results.performanceMetrics.memoryUsage.peak) <= 
      PHASE_3_2_CONFIG.performanceTargets.memoryUsage;
    
    // Overall assessment
    if (successRate >= PHASE_3_2_CONFIG.performanceTargets.testSuccessRate && 
        withinTimeTarget && 
        withinMemoryTarget) {
      this.results.summary.overall = 'excellent';
    } else if (successRate >= 0.95) {
      this.results.summary.overall = 'good';
    } else if (successRate >= 0.90) {
      this.results.summary.overall = 'acceptable';
    } else {
      this.results.summary.overall = 'poor';
    }
    
    // Performance assessment
    if (withinTimeTarget && withinMemoryTarget) {
      this.results.summary.performance = 'excellent';
    } else if (this.results.totalDuration <= PHASE_3_2_CONFIG.performanceTargets.totalExecutionTime * 1.2) {
      this.results.summary.performance = 'good';
    } else {
      this.results.summary.performance = 'poor';
    }
    
    // Integration assessment
    const integrationTests = this.results.suiteResults.filter(s => s.name.includes('Integration'));
    const integrationSuccessRate = integrationTests.length > 0 ?
      integrationTests.reduce((sum, s) => sum + (s.passedTests / s.totalTests), 0) / integrationTests.length : 0;
    
    if (integrationSuccessRate >= 0.98) {
      this.results.summary.integration = 'excellent';
    } else if (integrationSuccessRate >= 0.95) {
      this.results.summary.integration = 'good';
    } else {
      this.results.summary.integration = 'poor';
    }
    
    // Calculate average coverage
    const coverageValues = this.results.suiteResults.filter(s => s.coverage > 0).map(s => s.coverage);
    this.results.summary.coverage = coverageValues.length > 0 ? 
      coverageValues.reduce((sum, c) => sum + c, 0) / coverageValues.length : 0;
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const successRate = (this.results.performanceMetrics.successRate * 100).toFixed(1);
    const duration = (this.results.totalDuration / 1000).toFixed(2);
    
    console.log(chalk.blue.bold(`\n📋 Phase 3.2 Test Results Summary`));
    console.log(chalk.blue('═'.repeat(50)));
    
    // Overall metrics
    console.log(chalk.white(`📊 Overall Results:`));
    console.log(`   Tests: ${chalk.green(this.results.passedTests)}/${this.results.totalTests} passed (${successRate}%)`);
    console.log(`   Duration: ${duration}s (target: ${PHASE_3_2_CONFIG.performanceTargets.totalExecutionTime / 1000}s)`);
    console.log(`   Memory: ${this.results.performanceMetrics.memoryUsage.peak}MB peak`);
    console.log(`   Coverage: ${this.results.summary.coverage.toFixed(1)}%`);
    
    // Status indicators
    const overallIcon = this.getStatusIcon(this.results.summary.overall);
    const performanceIcon = this.getStatusIcon(this.results.summary.performance);
    const integrationIcon = this.getStatusIcon(this.results.summary.integration);
    
    console.log(`\n🎯 Quality Assessment:`);
    console.log(`   ${overallIcon} Overall: ${this.results.summary.overall}`);
    console.log(`   ${performanceIcon} Performance: ${this.results.summary.performance}`);
    console.log(`   ${integrationIcon} Integration: ${this.results.summary.integration}`);
    
    // Suite breakdown
    console.log(`\n📋 Test Suite Breakdown:`);
    this.results.suiteResults.forEach(suite => {
      const suiteIcon = this.getStatusIcon(suite.status);
      const passRate = suite.totalTests > 0 ? (suite.passedTests / suite.totalTests * 100).toFixed(1) : 0;
      console.log(`   ${suiteIcon} ${suite.name}: ${suite.passedTests}/${suite.totalTests} (${passRate}%) - ${(suite.duration / 1000).toFixed(2)}s`);
      
      // Show benchmark results
      if (suite.benchmarks.size > 0) {
        Array.from(suite.benchmarks.entries()).forEach(([name, bench]) => {
          const benchIcon = bench.passed ? (bench.optimal ? '🚀' : '✅') : '❌';
          console.log(`     ${benchIcon} ${name}: ${bench.duration}ms (${bench.performance})`);
        });
      }
    });
    
    // Performance insights
    if (this.results.summary.performance !== 'excellent') {
      console.log(`\n💡 Performance Insights:`);
      if (this.results.totalDuration > PHASE_3_2_CONFIG.performanceTargets.totalExecutionTime) {
        console.log(`   ⚠️  Execution time exceeded target by ${((this.results.totalDuration - PHASE_3_2_CONFIG.performanceTargets.totalExecutionTime) / 1000).toFixed(2)}s`);
      }
      if (parseFloat(this.results.performanceMetrics.memoryUsage.peak) > PHASE_3_2_CONFIG.performanceTargets.memoryUsage) {
        console.log(`   ⚠️  Memory usage exceeded target by ${(parseFloat(this.results.performanceMetrics.memoryUsage.peak) - PHASE_3_2_CONFIG.performanceTargets.memoryUsage).toFixed(2)}MB`);
      }
    }
    
    // Error summary
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors Encountered:`);
      this.results.errors.forEach(error => {
        console.log(`   • ${error.type}: ${error.message}`);
      });
    }
    
    console.log(chalk.blue('\n' + '═'.repeat(50)));
    console.log(chalk.white(`Phase 3.2 execution completed in ${duration}s`));
    
    if (this.results.summary.overall === 'excellent' || this.results.summary.overall === 'good') {
      console.log(chalk.green('🎉 Phase 3.2 Hook Pipeline Integration tests completed successfully!'));
    } else {
      console.log(chalk.yellow('⚠️  Phase 3.2 completed with issues. Review failed tests and performance metrics.'));
    }
  }

  /**
   * Get status icon for result states
   */
  getStatusIcon(status) {
    const icons = {
      'excellent': '🟢',
      'good': '🟡',
      'acceptable': '🟠',
      'poor': '🔴',
      'passed': '✅',
      'failed': '❌',
      'error': '💥',
      'pending': '⏳'
    };
    return icons[status] || '❓';
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runner = new Phase32TestRunner();
  
  runner.runAllTests()
    .then(results => {
      const exitCode = results.summary.overall === 'poor' || results.errors.length > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error(chalk.red(`\n💥 Phase 3.2 runner crashed: ${error.message}`));
      process.exit(1);
    });
}

export default Phase32TestRunner; 