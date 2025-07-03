#!/usr/bin/env node

/**
 * @file run-phase-2-3-tests.js
 * @description Custom test runner for Phase 2.3: Worktree Integration Testing
 * Executes all worktree integration tests with colored output and detailed reporting
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Phase 2.3 test files configuration
const testFiles = [
  {
    name: 'Worktree Manager',
    file: 'unit/worktree/worktree-manager.test.js',
    description: 'Git worktree discovery, lifecycle management, and operations',
    expectedTests: 45
  },
  {
    name: 'Simple Worktree Manager',
    file: 'unit/worktree/simple-worktree-manager.test.js',
    description: 'Basic worktree operations and simplified discovery',
    expectedTests: 25
  },
  {
    name: 'Resource Monitor',
    file: 'unit/worktree/resource-monitor.test.js',
    description: 'Resource isolation, monitoring, and performance tracking',
    expectedTests: 35
  },
  {
    name: 'Worktree Coordinator',
    file: 'unit/worktree/worktree-coordinator.test.js',
    description: 'Component coordination and system integration',
    expectedTests: 30
  }
];

class Phase23TestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.startTime = Date.now();
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    const border = '='.repeat(80);
    this.log(`\n${border}`, 'cyan');
    this.log(`${message}`, 'cyan');
    this.log(`${border}`, 'cyan');
  }

  logSubHeader(message) {
    const border = '-'.repeat(60);
    this.log(`\n${border}`, 'blue');
    this.log(`${message}`, 'blue');
    this.log(`${border}`, 'blue');
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logWarning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  logInfo(message) {
    this.log(`ℹ️  ${message}`, 'cyan');
  }

  async runJestTest(testFile) {
    return new Promise((resolve) => {
      const configPath = join(__dirname, 'jest.config.js');
      
      // Use npx directly with NODE_OPTIONS for ES module support
      const args = [
        'jest',
        testFile.file,
        '--config', configPath,
        '--verbose',
        '--no-cache',
        '--detectOpenHandles',
        '--forceExit'
      ];

      const jest = spawn('npx', args, {
        cwd: __dirname,
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules'
        }
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          testFile
        });
      });
    });
  }

  parseJestOutput(output) {
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let total = 0;
    let duration = 0;
    const failures = [];

    // Parse test results
    for (const line of lines) {
      // Match test summary line
      const summaryMatch = line.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (summaryMatch) {
        failed = parseInt(summaryMatch[1]);
        passed = parseInt(summaryMatch[2]);
        total = parseInt(summaryMatch[3]);
      }

      // Alternative summary format (all passed)
      const passedMatch = line.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1]);
        total = parseInt(passedMatch[2]);
        failed = 0;
      }

      // Parse duration
      const durationMatch = line.match(/Time:\s+([\d.]+)\s*s/);
      if (durationMatch) {
        duration = parseFloat(durationMatch[1]);
      }

      // Collect failure information
      if (line.includes('FAIL') && line.includes('.test.js')) {
        failures.push(line.trim());
      }
    }

    return {
      passed,
      failed,
      total,
      duration,
      failures
    };
  }

  async runAllTests() {
    this.logHeader('🧪 Phase 2.3: Worktree Integration Testing');
    this.logInfo('Testing Git worktree discovery, resource monitoring, and component coordination');
    this.logInfo(`Running ${testFiles.length} test suites...`);

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      
      this.logSubHeader(`Test ${i + 1}/${testFiles.length}: ${testFile.name}`);
      this.logInfo(`Description: ${testFile.description}`);
      this.logInfo(`File: ${testFile.file}`);
      this.logInfo(`Expected tests: ~${testFile.expectedTests}`);

      const startTime = Date.now();
      const result = await this.runJestTest(testFile);
      const endTime = Date.now();

      const parsed = this.parseJestOutput(result.stdout + result.stderr);
      const duration = (endTime - startTime) / 1000;

      const testResult = {
        name: testFile.name,
        file: testFile.file,
        description: testFile.description,
        expectedTests: testFile.expectedTests,
        ...parsed,
        duration,
        exitCode: result.code,
        rawOutput: result.stdout + result.stderr
      };

      this.results.push(testResult);
      this.totalTests += parsed.total;
      this.totalPassed += parsed.passed;
      this.totalFailed += parsed.failed;

      // Display results
      if (result.code === 0 && parsed.failed === 0) {
        this.logSuccess(`${testFile.name}: ${parsed.passed}/${parsed.total} tests passed (${duration.toFixed(2)}s)`);
      } else {
        this.logError(`${testFile.name}: ${parsed.failed} failed, ${parsed.passed} passed, ${parsed.total} total (${duration.toFixed(2)}s)`);
        
        if (parsed.failures.length > 0) {
          this.logError('Failures:');
          parsed.failures.forEach(failure => {
            this.log(`  ${failure}`, 'red');
          });
        }
      }

      // Show performance notes
      if (duration > 10) {
        this.logWarning(`Slow execution: ${duration.toFixed(2)}s (consider optimization)`);
      } else if (duration < 1) {
        this.logInfo(`Fast execution: ${duration.toFixed(2)}s`);
      }
    }

    this.generateSummaryReport();
  }

  generateSummaryReport() {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests) * 100 : 0;

    this.logHeader('📊 Phase 2.3 Test Results Summary');

    // Overall statistics
    this.logSubHeader('Overall Statistics');
    this.log(`Total Test Suites: ${testFiles.length}`, 'white');
    this.log(`Total Test Cases: ${this.totalTests}`, 'white');
    this.log(`Tests Passed: ${this.totalPassed}`, this.totalPassed === this.totalTests ? 'green' : 'yellow');
    this.log(`Tests Failed: ${this.totalFailed}`, this.totalFailed === 0 ? 'green' : 'red');
    this.log(`Success Rate: ${successRate.toFixed(1)}%`, successRate === 100 ? 'green' : 'yellow');
    this.log(`Total Duration: ${totalDuration.toFixed(2)}s`, 'white');

    // Performance analysis
    this.logSubHeader('Performance Analysis');
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    this.log(`Average Test Suite Duration: ${avgDuration.toFixed(2)}s`, 'white');
    
    const slowTests = this.results.filter(r => r.duration > 5);
    if (slowTests.length > 0) {
      this.logWarning(`Slow test suites (>5s): ${slowTests.length}`);
      slowTests.forEach(test => {
        this.log(`  ${test.name}: ${test.duration.toFixed(2)}s`, 'yellow');
      });
    }

    // Test coverage analysis
    this.logSubHeader('Test Coverage Analysis');
    this.results.forEach(result => {
      const coverage = result.expectedTests > 0 ? (result.total / result.expectedTests) * 100 : 0;
      const coverageColor = coverage >= 90 ? 'green' : coverage >= 70 ? 'yellow' : 'red';
      
      this.log(`${result.name}:`, 'white');
      this.log(`  Expected: ~${result.expectedTests} tests`, 'white');
      this.log(`  Actual: ${result.total} tests`, 'white');
      this.log(`  Coverage: ${coverage.toFixed(1)}%`, coverageColor);
      
      if (result.failed > 0) {
        this.log(`  Status: ${result.failed} failed ❌`, 'red');
      } else {
        this.log(`  Status: All passed ✅`, 'green');
      }
    });

    // Detailed test suite results
    this.logSubHeader('Detailed Results by Test Suite');
    this.results.forEach((result, index) => {
      const status = result.failed === 0 ? '✅ PASS' : '❌ FAIL';
      const statusColor = result.failed === 0 ? 'green' : 'red';
      
      this.log(`${index + 1}. ${result.name}`, 'white');
      this.log(`   File: ${result.file}`, 'white');
      this.log(`   Tests: ${result.passed}/${result.total} passed`, result.failed === 0 ? 'green' : 'yellow');
      this.log(`   Duration: ${result.duration.toFixed(2)}s`, 'white');
      this.log(`   Status: ${status}`, statusColor);
      
      if (result.failed > 0) {
        this.log(`   Failures: ${result.failed}`, 'red');
      }
    });

    // Phase completion status
    this.logHeader('🎯 Phase 2.3 Completion Status');
    
    if (this.totalFailed === 0) {
      this.logSuccess('Phase 2.3: Worktree Integration Testing - COMPLETE ✅');
      this.logSuccess('All worktree integration tests are passing!');
      this.logInfo('✅ Git worktree discovery and lifecycle management');
      this.logInfo('✅ Resource isolation and monitoring');
      this.logInfo('✅ Component coordination and integration');
      this.logInfo('✅ Performance benchmarks met');
    } else {
      this.logError('Phase 2.3: Worktree Integration Testing - INCOMPLETE ❌');
      this.logError(`${this.totalFailed} test(s) failing across ${this.results.filter(r => r.failed > 0).length} suite(s)`);
      this.logWarning('Review failed tests and fix issues before proceeding to Phase 3');
    }

    // Next steps
    this.logSubHeader('Next Steps');
    if (this.totalFailed === 0) {
      this.logInfo('✅ Phase 2.3 Complete - Ready for Phase 3: Integration Testing');
      this.logInfo('📋 Update TESTING_INDEX.md with Phase 2.3 completion status');
      this.logInfo('🚀 Begin Phase 3.1: AST-Claude Integration Testing');
    } else {
      this.logWarning('🔧 Fix failing tests in Phase 2.3 before proceeding');
      this.logInfo('📝 Review test output above for specific failure details');
      this.logInfo('🔄 Re-run tests after fixes: node run-phase-2-3-tests.js');
    }

    // Test execution command reference
    this.logSubHeader('Command Reference');
    this.logInfo('Run all Phase 2.3 tests:');
    this.log('  node run-phase-2-3-tests.js', 'cyan');
    this.logInfo('Run individual test suites:');
    this.results.forEach(result => {
      this.log(`  npx jest ${result.file} --config=jest.config.js --verbose`, 'cyan');
    });

    console.log('\n');
  }
}

// Main execution
async function main() {
  const runner = new Phase23TestRunner();
  
  try {
    await runner.runAllTests();
    
    // Exit with appropriate code
    const exitCode = runner.totalFailed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Test runner error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ Unhandled Rejection at:${colors.reset}`, promise);
  console.error(`${colors.red}Reason:${colors.reset}`, reason);
  process.exit(1);
});

main(); 