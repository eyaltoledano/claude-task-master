#!/usr/bin/env node

/**
 * Phase 3.3 Test Runner - Workflow Automation Integration
 * 
 * Tests complete end-to-end workflow automation including:
 * - Complete workflow integration (task-to-PR workflows)
 * - Multi-session integration (concurrent session handling)
 * - Error recovery integration (system resilience)
 * - Performance integration (load testing and scalability)
 * 
 * Performance Targets:
 * - Complete Workflow: < 30s end-to-end
 * - Multi-Session: Handle 8+ concurrent sessions
 * - Error Recovery: < 5s recovery time
 * - Performance: Support 100+ tasks/min throughput
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const config = {
  testDir: path.resolve(__dirname, '..'),
  testPattern: 'integration/*-integration.test.js',
  timeout: 90000, // 90 seconds for comprehensive tests
  maxWorkers: 4,
  verbose: true,
  collectCoverage: false, // Disabled for performance
  testNamePattern: null,
  
  // Performance targets for Phase 3.3
  performanceTargets: {
    completeWorkflow: 30000,    // 30 seconds
    multiSession: 15000,        // 15 seconds for 8 sessions
    errorRecovery: 5000,        // 5 seconds recovery
    performanceLoad: 60000      // 60 seconds for load tests
  },
  
  // Memory and resource limits
  resourceLimits: {
    maxMemoryMB: 1024,    // 1GB memory limit
    maxCpuPercent: 90,    // 90% CPU utilization
    memoryLeakThreshold: 100 // 100MB growth threshold
  }
};

// Test suite definitions for Phase 3.3
const testSuites = [
  {
    name: 'Complete Workflow Integration',
    file: 'integration/complete-workflow-integration.test.js',
    description: 'End-to-end workflow from task initiation to PR merge',
    expectedTests: 15,
    timeout: config.performanceTargets.completeWorkflow,
    priority: 'critical'
  },
  {
    name: 'Multi-Session Integration',
    file: 'integration/multi-session-integration.test.js',
    description: 'Concurrent session handling and resource management',
    expectedTests: 12,
    timeout: config.performanceTargets.multiSession,
    priority: 'high'
  },
  {
    name: 'Error Recovery Integration',
    file: 'integration/error-recovery-integration.test.js',
    description: 'System resilience and failure recovery mechanisms',
    expectedTests: 18,
    timeout: config.performanceTargets.errorRecovery,
    priority: 'high'
  },
  {
    name: 'Performance Integration',
    file: 'integration/performance-integration.test.js',
    description: 'Load testing, benchmarking, and scalability',
    expectedTests: 20,
    timeout: config.performanceTargets.performanceLoad,
    priority: 'medium'
  }
];

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Utility functions
function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  const border = '='.repeat(60);
  log(`\n${border}`, colors.cyan);
  log(`${message}`, colors.cyan + colors.bold);
  log(`${border}`, colors.cyan);
}

function logSection(message) {
  log(`\n${'─'.repeat(40)}`, colors.blue);
  log(message, colors.blue + colors.bold);
  log('─'.repeat(40), colors.blue);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: null,
      endTime: null,
      peakMemory: 0,
      testResults: [],
      componentTimes: {},
      resourceUsage: []
    };
  }

  start() {
    this.metrics.startTime = Date.now();
    this.metrics.peakMemory = process.memoryUsage().heapUsed;
    
    // Start resource monitoring
    this.resourceInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.peakMemory = Math.max(this.metrics.peakMemory, memUsage.heapUsed);
      this.metrics.resourceUsage.push({
        timestamp: Date.now(),
        memory: memUsage.heapUsed,
        cpu: process.cpuUsage()
      });
    }, 1000);
  }

  recordTest(suiteName, result) {
    this.metrics.testResults.push({
      suite: suiteName,
      duration: result.duration,
      passed: result.passed,
      failed: result.failed,
      total: result.total,
      timestamp: Date.now()
    });
  }

  recordComponentTime(component, duration) {
    this.metrics.componentTimes[component] = duration;
  }

  stop() {
    this.metrics.endTime = Date.now();
    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
    }
  }

  getReport() {
    const totalDuration = this.metrics.endTime - this.metrics.startTime;
    const totalTests = this.metrics.testResults.reduce((sum, r) => sum + r.total, 0);
    const passedTests = this.metrics.testResults.reduce((sum, r) => sum + r.passed, 0);
    const failedTests = this.metrics.testResults.reduce((sum, r) => sum + r.failed, 0);
    
    const avgMemoryUsage = this.metrics.resourceUsage.length > 0 
      ? this.metrics.resourceUsage.reduce((sum, r) => sum + r.memory, 0) / this.metrics.resourceUsage.length
      : 0;

    return {
      duration: totalDuration,
      peakMemory: this.metrics.peakMemory,
      avgMemoryUsage,
      totalTests,
      passedTests,
      failedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      componentTimes: this.metrics.componentTimes,
      testResults: this.metrics.testResults
    };
  }
}

// Test result analyzer
const TestAnalyzer = {
  parseJestOutput(output) {
    const lines = output.split('\n');
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      coverage: null,
      failureDetails: []
    };

    let inFailureSection = false;
    let currentFailure = '';

    for (const line of lines) {
      // Parse test results
      if (line.includes('Tests:')) {
        const testMatch = line.match(/(\d+) failed.*?(\d+) passed.*?(\d+) total/);
        if (testMatch) {
          results.failed = parseInt(testMatch[1]);
          results.passed = parseInt(testMatch[2]);
          results.total = parseInt(testMatch[3]);
        } else {
          const passedMatch = line.match(/(\d+) passed.*?(\d+) total/);
          if (passedMatch) {
            results.passed = parseInt(passedMatch[1]);
            results.total = parseInt(passedMatch[2]);
            results.failed = 0;
          }
        }
      }

      // Parse duration
      if (line.includes('Time:')) {
        const timeMatch = line.match(/Time:\s*([\d.]+)\s*s/);
        if (timeMatch) {
          results.duration = parseFloat(timeMatch[1]) * 1000; // Convert to ms
        }
      }

      // Parse coverage
      if (line.includes('All files')) {
        const coverageMatch = line.match(/(\d+\.?\d*)\s*%/);
        if (coverageMatch) {
          results.coverage = parseFloat(coverageMatch[1]);
        }
      }

      // Collect failure details
      if (line.includes('FAIL') || inFailureSection) {
        inFailureSection = true;
        currentFailure += line + '\n';
        
        if (line.trim() === '' && currentFailure.length > 0) {
          results.failureDetails.push(currentFailure.trim());
          currentFailure = '';
          inFailureSection = false;
        }
      }
    }

    return results;
  },

  checkPerformanceTargets(results, targets) {
    const issues = [];
    
    if (results.duration > targets.maxDuration) {
      issues.push(`Duration exceeded: ${results.duration}ms > ${targets.maxDuration}ms`);
    }

    if (results.peakMemory > targets.maxMemory) {
      issues.push(`Memory exceeded: ${Math.round(results.peakMemory / 1024 / 1024)}MB > ${Math.round(targets.maxMemory / 1024 / 1024)}MB`);
    }

    if (results.successRate < targets.minSuccessRate) {
      issues.push(`Success rate too low: ${results.successRate.toFixed(1)}% < ${targets.minSuccessRate}%`);
    }

    return issues;
  }
};

// Main test runner
async function runTestSuite(suite, monitor) {
  logSection(`Running ${suite.name}`);
  logInfo(`Description: ${suite.description}`);
  logInfo(`Expected tests: ${suite.expectedTests}`);
  
  const startTime = Date.now();
  
  try {
    // Construct Jest command
    const jestCmd = [
      'node',
      '--experimental-vm-modules',
      path.resolve(__dirname, '../../../../node_modules/.bin/jest'),
      '--config', path.resolve(config.testDir, 'jest.config.js'),
      '--testTimeout', suite.timeout.toString(),
      '--maxWorkers', config.maxWorkers.toString(),
      '--passWithNoTests',
      config.verbose ? '--verbose' : '',
      suite.file
    ].filter(Boolean).join(' ');

    logInfo(`Command: ${jestCmd}`);
    
    // Execute Jest
    const output = execSync(jestCmd, {
      cwd: config.testDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: suite.timeout + 10000 // Add 10s buffer
    });

    // Parse results
    const results = TestAnalyzer.parseJestOutput(output);
    results.duration = Date.now() - startTime;
    
    // Record metrics
    monitor.recordTest(suite.name, results);
    monitor.recordComponentTime(suite.name, results.duration);

    // Log results
    if (results.failed === 0) {
      logSuccess(`${suite.name}: ${results.passed}/${results.total} tests passed`);
    } else {
      logWarning(`${suite.name}: ${results.passed}/${results.total} tests passed, ${results.failed} failed`);
    }
    
    logInfo(`Duration: ${results.duration}ms`);
    
    if (results.coverage) {
      logInfo(`Coverage: ${results.coverage}%`);
    }

    // Check performance targets
    const performanceIssues = TestAnalyzer.checkPerformanceTargets(results, {
      maxDuration: suite.timeout,
      maxMemory: config.resourceLimits.maxMemoryMB * 1024 * 1024,
      minSuccessRate: 80
    });

    if (performanceIssues.length > 0) {
      logWarning('Performance issues detected:');
      performanceIssues.forEach(issue => logWarning(`  - ${issue}`));
    }

    return results;

  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`${suite.name} failed after ${duration}ms`);
    logError(`Error: ${error.message}`);
    
    // Try to parse any output we might have gotten
    let results = { passed: 0, failed: 1, total: 1, duration };
    
    if (error.stdout) {
      try {
        results = TestAnalyzer.parseJestOutput(error.stdout);
        results.duration = duration;
      } catch (parseError) {
        logWarning('Could not parse test output');
      }
    }

    monitor.recordTest(suite.name, results);
    return results;
  }
}

// Quality gates checker
function checkQualityGates(report) {
  const gates = [];
  
  // Overall success rate gate
  if (report.successRate >= 90) {
    gates.push({ name: 'Success Rate', status: 'PASS', value: `${report.successRate.toFixed(1)}%`, threshold: '90%' });
  } else if (report.successRate >= 80) {
    gates.push({ name: 'Success Rate', status: 'WARN', value: `${report.successRate.toFixed(1)}%`, threshold: '90%' });
  } else {
    gates.push({ name: 'Success Rate', status: 'FAIL', value: `${report.successRate.toFixed(1)}%`, threshold: '90%' });
  }

  // Performance gate
  const maxDuration = Math.max(...Object.values(config.performanceTargets));
  if (report.duration <= maxDuration) {
    gates.push({ name: 'Performance', status: 'PASS', value: `${(report.duration/1000).toFixed(1)}s`, threshold: `${maxDuration/1000}s` });
  } else {
    gates.push({ name: 'Performance', status: 'FAIL', value: `${(report.duration/1000).toFixed(1)}s`, threshold: `${maxDuration/1000}s` });
  }

  // Memory gate
  const memoryMB = report.peakMemory / 1024 / 1024;
  if (memoryMB <= config.resourceLimits.maxMemoryMB) {
    gates.push({ name: 'Memory Usage', status: 'PASS', value: `${memoryMB.toFixed(1)}MB`, threshold: `${config.resourceLimits.maxMemoryMB}MB` });
  } else {
    gates.push({ name: 'Memory Usage', status: 'FAIL', value: `${memoryMB.toFixed(1)}MB`, threshold: `${config.resourceLimits.maxMemoryMB}MB` });
  }

  // Component performance gates
  Object.entries(report.componentTimes).forEach(([component, duration]) => {
    const target = config.performanceTargets[component.toLowerCase().replace(/\s+/g, '')] || 30000;
    const status = duration <= target ? 'PASS' : duration <= target * 1.2 ? 'WARN' : 'FAIL';
    gates.push({ 
      name: `${component} Performance`, 
      status, 
      value: `${(duration/1000).toFixed(1)}s`, 
      threshold: `${target/1000}s` 
    });
  });

  return gates;
}

// Report generator
function generateReport(report, gates) {
  logHeader('PHASE 3.3 TEST EXECUTION REPORT');
  
  // Summary
  log(`\n📊 Test Summary:`, colors.bold);
  log(`   Total Tests: ${report.totalTests}`);
  log(`   Passed: ${colors.green}${report.passedTests}${colors.reset}`);
  log(`   Failed: ${colors.red}${report.failedTests}${colors.reset}`);
  log(`   Success Rate: ${report.successRate >= 90 ? colors.green : report.successRate >= 80 ? colors.yellow : colors.red}${report.successRate.toFixed(1)}%${colors.reset}`);
  
  // Performance metrics
  log(`\n⚡ Performance Metrics:`, colors.bold);
  log(`   Total Duration: ${(report.duration / 1000).toFixed(1)}s`);
  log(`   Peak Memory: ${(report.peakMemory / 1024 / 1024).toFixed(1)}MB`);
  log(`   Avg Memory: ${(report.avgMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
  
  // Component breakdown
  if (Object.keys(report.componentTimes).length > 0) {
    log(`\n🔧 Component Performance:`, colors.bold);
    Object.entries(report.componentTimes).forEach(([component, duration]) => {
      log(`   ${component}: ${(duration / 1000).toFixed(1)}s`);
    });
  }

  // Quality gates
  log(`\n🚦 Quality Gates:`, colors.bold);
  gates.forEach(gate => {
    const statusColor = gate.status === 'PASS' ? colors.green : 
                       gate.status === 'WARN' ? colors.yellow : colors.red;
    const statusSymbol = gate.status === 'PASS' ? '✅' : 
                        gate.status === 'WARN' ? '⚠️' : '❌';
    log(`   ${statusSymbol} ${gate.name}: ${statusColor}${gate.value}${colors.reset} (threshold: ${gate.threshold})`);
  });

  // Test suite details
  log(`\n📋 Test Suite Results:`, colors.bold);
  report.testResults.forEach(result => {
    const successRate = result.total > 0 ? (result.passed / result.total) * 100 : 0;
    const statusColor = result.failed === 0 ? colors.green : colors.red;
    log(`   ${result.suite}:`);
    log(`     ${statusColor}${result.passed}/${result.total} passed${colors.reset} (${successRate.toFixed(1)}%)`);
    log(`     Duration: ${(result.duration / 1000).toFixed(1)}s`);
  });

  // Final status
  const overallStatus = gates.every(g => g.status === 'PASS') ? 'PASS' : 
                       gates.some(g => g.status === 'FAIL') ? 'FAIL' : 'WARN';
  
  log(`\n🎯 Overall Status: ${overallStatus === 'PASS' ? colors.green : overallStatus === 'WARN' ? colors.yellow : colors.red}${overallStatus}${colors.reset}`, colors.bold);
  
  if (overallStatus === 'PASS') {
    logSuccess('Phase 3.3 Workflow Automation Integration tests completed successfully!');
  } else if (overallStatus === 'WARN') {
    logWarning('Phase 3.3 tests completed with warnings. Review performance metrics.');
  } else {
    logError('Phase 3.3 tests failed. Review failed tests and quality gates.');
  }

  return overallStatus;
}

// Main execution
async function main() {
  logHeader('PHASE 3.3: WORKFLOW AUTOMATION INTEGRATION TESTS');
  
  log('🚀 Starting comprehensive workflow automation integration testing...', colors.cyan);
  log(`📁 Test directory: ${config.testDir}`);
  log(`⏱️  Timeout per suite: ${config.timeout / 1000}s`);
  log(`👥 Max workers: ${config.maxWorkers}`);
  log(`🎯 Expected total tests: ${testSuites.reduce((sum, suite) => sum + suite.expectedTests, 0)}`);

  const monitor = new PerformanceMonitor();
  monitor.start();

  const results = [];
  let allPassed = true;

  // Run each test suite
  for (const suite of testSuites) {
    try {
      const result = await runTestSuite(suite, monitor);
      results.push(result);
      
      if (result.failed > 0) {
        allPassed = false;
      }
      
      // Brief pause between suites
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logError(`Failed to run ${suite.name}: ${error.message}`);
      allPassed = false;
      results.push({ passed: 0, failed: 1, total: 1, duration: 0 });
    }
  }

  monitor.stop();

  // Generate final report
  const report = monitor.getReport();
  const gates = checkQualityGates(report);
  const finalStatus = generateReport(report, gates);

  // Exit with appropriate code
  const exitCode = finalStatus === 'FAIL' ? 1 : 0;
  
  if (exitCode === 0) {
    log(`\n🎉 Phase 3.3 Workflow Automation Integration testing completed successfully!`, colors.green + colors.bold);
  } else {
    log(`\n💥 Phase 3.3 testing failed. Please review the results above.`, colors.red + colors.bold);
  }

  process.exit(exitCode);
}

// Handle errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  logError(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    logError(error.stack);
    process.exit(1);
  });
}

export default main; 