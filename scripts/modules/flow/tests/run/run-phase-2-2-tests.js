#!/usr/bin/env node

/**
 * @fileoverview Custom Test Runner for Phase 2.2 - Hook System Testing
 * Executes all hook system tests including core hooks and built-in hooks
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for output formatting
const colors = {
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

// Test file configurations for Phase 2.2
const testFiles = [
  // Core Hook System Tests
  {
    name: 'Hook Executor',
    path: 'unit/hooks/hook-executor.test.js',
    description: 'Hook registration, discovery, and execution'
  },
  {
    name: 'Hook Validator',
    path: 'unit/hooks/hook-validator.test.js',
    description: 'Hook validation and safety checks'
  },
  {
    name: 'Hook Context',
    path: 'unit/hooks/hook-context.test.js',
    description: 'Hook context management and data passing'
  },
  {
    name: 'Hook Storage',
    path: 'unit/hooks/hook-storage.test.js',
    description: 'Hook persistence and configuration storage'
  },
  
  // Built-in Hook Tests
  {
    name: 'Claude Code Stop Hook',
    path: 'unit/hooks/built-in/claude-code-stop.test.js',
    description: 'Claude Code session termination hooks'
  },
  {
    name: 'Pre-Launch Validation Hook',
    path: 'unit/hooks/built-in/pre-launch-validation.test.js',
    description: 'Pre-launch validation and safety checks'
  },
  {
    name: 'Session Completion Hook',
    path: 'unit/hooks/built-in/session-completion.test.js',
    description: 'Session finalization and cleanup'
  },
  {
    name: 'PR Lifecycle Management Hook',
    path: 'unit/hooks/built-in/pr-lifecycle-management.test.js',
    description: 'PR creation, monitoring, and management'
  },
  {
    name: 'Research Integration Hook',
    path: 'unit/hooks/built-in/research-integration.test.js',
    description: 'Research operations and data integration'
  }
];

/**
 * Formats and prints a header with color and styling
 */
function printHeader(text, color = 'cyan') {
  const line = '='.repeat(80);
  console.log(`${colors[color]}${colors.bright}${line}${colors.reset}`);
  console.log(`${colors[color]}${colors.bright}${text.padStart((80 + text.length) / 2)}${colors.reset}`);
  console.log(`${colors[color]}${colors.bright}${line}${colors.reset}`);
}

/**
 * Formats and prints a section header
 */
function printSection(text, color = 'blue') {
  const line = '-'.repeat(60);
  console.log(`\\n${colors[color]}${line}${colors.reset}`);
  console.log(`${colors[color]}${colors.bright}${text}${colors.reset}`);
  console.log(`${colors[color]}${line}${colors.reset}`);
}

/**
 * Formats test results with appropriate colors
 */
function formatTestResult(success, message) {
  const icon = success ? '✅' : '❌';
  const color = success ? 'green' : 'red';
  return `${icon} ${colors[color]}${message}${colors.reset}`;
}

/**
 * Executes a single test file using Jest
 */
function runTestFile(testFile) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, testFile.path);
    
    // Check if test file exists
    if (!existsSync(testPath)) {
      resolve({
        success: false,
        name: testFile.name,
        error: 'Test file not found',
        output: '',
        stats: { tests: 0, passed: 0, failed: 0, time: 0 }
      });
      return;
    }

    console.log(`\\n${colors.yellow}Running: ${testFile.name}${colors.reset}`);
    console.log(`${colors.cyan}Description: ${testFile.description}${colors.reset}`);
    console.log(`${colors.magenta}File: ${testFile.path}${colors.reset}`);
    
    const startTime = Date.now();
    
    // Jest command with configuration
    const jestCommand = [
      '--experimental-vm-modules',
      join(__dirname, '../../../../node_modules/.bin/jest'),
      testFile.path,
      '--config=jest.config.js',
      '--verbose',
      '--no-cache',
      '--forceExit'
    ];

    const jestProcess = spawn('node', jestCommand, {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    jestProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Real-time output for better user experience
      process.stdout.write(text);
    });

    jestProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // Only show errors that aren't Jest warnings
      if (!text.includes('Warning:') && !text.includes('deprecated')) {
        process.stderr.write(text);
      }
    });

    jestProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Parse Jest output for test statistics
      const stats = parseJestOutput(output);
      stats.time = duration;
      
      const success = code === 0 && stats.failed === 0;
      
      resolve({
        success,
        name: testFile.name,
        error: success ? null : (errorOutput || 'Test execution failed'),
        output,
        stats,
        duration
      });
    });

    jestProcess.on('error', (error) => {
      resolve({
        success: false,
        name: testFile.name,
        error: error.message,
        output: '',
        stats: { tests: 0, passed: 0, failed: 0, time: Date.now() - startTime }
      });
    });
  });
}

/**
 * Parses Jest output to extract test statistics
 */
function parseJestOutput(output) {
  const stats = { tests: 0, passed: 0, failed: 0, skipped: 0 };
  
  // Look for Jest summary patterns
  const testPattern = /(\\d+) tests?/;
  const passedPattern = /(\\d+) passed/;
  const failedPattern = /(\\d+) failed/;
  const skippedPattern = /(\\d+) skipped/;
  
  const testMatch = output.match(testPattern);
  const passedMatch = output.match(passedPattern);
  const failedMatch = output.match(failedPattern);
  const skippedMatch = output.match(skippedPattern);
  
  if (testMatch) stats.tests = parseInt(testMatch[1]);
  if (passedMatch) stats.passed = parseInt(passedMatch[1]);
  if (failedMatch) stats.failed = parseInt(failedMatch[1]);
  if (skippedMatch) stats.skipped = parseInt(skippedMatch[1]);
  
  // If we can't parse, try to count test descriptions
  if (stats.tests === 0) {
    const testDescriptions = output.match(/✓|×|✗/g);
    if (testDescriptions) {
      stats.tests = testDescriptions.length;
      stats.passed = (output.match(/✓/g) || []).length;
      stats.failed = (output.match(/×|✗/g) || []).length;
    }
  }
  
  return stats;
}

/**
 * Prints a comprehensive summary of all test results
 */
function printSummary(results) {
  printSection('PHASE 2.2 HOOK SYSTEM TESTING SUMMARY', 'magenta');
  
  const totalStats = results.reduce((acc, result) => {
    acc.totalFiles++;
    acc.totalTests += result.stats.tests;
    acc.totalPassed += result.stats.passed;
    acc.totalFailed += result.stats.failed;
    acc.totalTime += result.stats.time;
    
    if (result.success) {
      acc.successfulFiles++;
    } else {
      acc.failedFiles++;
    }
    
    return acc;
  }, {
    totalFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalTime: 0
  });

  // Overall statistics
  console.log(`\\n${colors.bright}Overall Results:${colors.reset}`);
  console.log(`📁 Test Files: ${totalStats.totalFiles} (${totalStats.successfulFiles} passed, ${totalStats.failedFiles} failed)`);
  console.log(`🧪 Total Tests: ${totalStats.totalTests}`);
  console.log(`✅ Passed: ${colors.green}${totalStats.totalPassed}${colors.reset}`);
  console.log(`❌ Failed: ${colors.red}${totalStats.totalFailed}${colors.reset}`);
  console.log(`⏱️  Total Time: ${(totalStats.totalTime / 1000).toFixed(2)}s`);
  
  const successRate = totalStats.totalTests > 0 
    ? ((totalStats.totalPassed / totalStats.totalTests) * 100).toFixed(1)
    : 0;
  console.log(`📊 Success Rate: ${successRate}%`);

  // Individual file results
  console.log(`\\n${colors.bright}Individual Test File Results:${colors.reset}`);
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const timeStr = `(${(result.stats.time / 1000).toFixed(2)}s)`;
    const testStr = `${result.stats.passed}/${result.stats.tests} tests`;
    
    console.log(`${index + 1}. ${status} ${result.name} - ${testStr} ${timeStr}`);
    
    if (!result.success && result.error) {
      console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
    }
  });

  // Performance analysis
  console.log(`\\n${colors.bright}Performance Analysis:${colors.reset}`);
  const avgTimePerFile = totalStats.totalTime / totalStats.totalFiles;
  const avgTimePerTest = totalStats.totalTests > 0 ? totalStats.totalTime / totalStats.totalTests : 0;
  
  console.log(`📈 Average time per file: ${(avgTimePerFile / 1000).toFixed(2)}s`);
  console.log(`📈 Average time per test: ${(avgTimePerTest).toFixed(0)}ms`);
  
  // Find slowest and fastest files
  const sortedByTime = [...results].sort((a, b) => b.stats.time - a.stats.time);
  if (sortedByTime.length > 0) {
    console.log(`🐌 Slowest file: ${sortedByTime[0].name} (${(sortedByTime[0].stats.time / 1000).toFixed(2)}s)`);
    console.log(`⚡ Fastest file: ${sortedByTime[sortedByTime.length - 1].name} (${(sortedByTime[sortedByTime.length - 1].stats.time / 1000).toFixed(2)}s)`);
  }

  // Hook system coverage analysis
  console.log(`\\n${colors.bright}Hook System Test Coverage:${colors.reset}`);
  const coreHooks = results.filter(r => !r.name.includes('Hook')).length;
  const builtinHooks = results.filter(r => r.name.includes('Hook')).length;
  
  console.log(`🔧 Core Hook System Components: ${coreHooks}/4 tested`);
  console.log(`🔌 Built-in Hook Implementations: ${builtinHooks}/5 tested`);
  
  // Recommendations
  console.log(`\\n${colors.bright}Recommendations:${colors.reset}`);
  if (totalStats.failedFiles > 0) {
    console.log(`🔧 Fix ${totalStats.failedFiles} failing test files`);
  }
  if (totalStats.totalFailed > 0) {
    console.log(`🧪 Address ${totalStats.totalFailed} failing individual tests`);
  }
  if (avgTimePerFile > 2000) {
    console.log(`⚡ Consider optimizing test performance (avg ${(avgTimePerFile / 1000).toFixed(2)}s per file)`);
  }
  if (totalStats.failedFiles === 0 && totalStats.totalFailed === 0) {
    console.log(`🎉 All tests passing! Hook system is ready for integration.`);
  }

  return totalStats;
}

/**
 * Main execution function
 */
async function runPhase22Tests() {
  printHeader('TASK MASTER FLOW - PHASE 2.2 HOOK SYSTEM TESTING');
  
  console.log(`${colors.bright}Phase 2.2 Focus:${colors.reset} Hook System Testing`);
  console.log(`${colors.bright}Test Categories:${colors.reset}`);
  console.log(`  • Core Hook System (4 test files)`);
  console.log(`  • Built-in Hook Implementations (5 test files)`);
  console.log(`${colors.bright}Total Test Files:${colors.reset} ${testFiles.length}`);
  
  const results = [];
  let currentFile = 1;
  
  for (const testFile of testFiles) {
    printSection(`Test ${currentFile}/${testFiles.length}: ${testFile.name}`, 'blue');
    
    const result = await runTestFile(testFile);
    results.push(result);
    
    // Print immediate result
    const statusMessage = result.success 
      ? `✅ ${result.name} completed successfully (${result.stats.passed}/${result.stats.tests} tests)`
      : `❌ ${result.name} failed (${result.stats.passed}/${result.stats.tests} tests)`;
    
    console.log(`\\n${formatTestResult(result.success, statusMessage)}`);
    
    if (!result.success && result.error) {
      console.log(`${colors.red}Error details: ${result.error}${colors.reset}`);
    }
    
    currentFile++;
  }
  
  // Print comprehensive summary
  const summary = printSummary(results);
  
  // Final status
  const allPassed = results.every(r => r.success);
  const finalMessage = allPassed 
    ? 'Phase 2.2 Hook System Testing completed successfully!'
    : `Phase 2.2 Hook System Testing completed with ${summary.failedFiles} failed files`;
  
  console.log(`\\n${formatTestResult(allPassed, finalMessage)}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase22Tests().catch((error) => {
    console.error(`${colors.red}Fatal error running Phase 2.2 tests:${colors.reset}`, error);
    process.exit(1);
  });
}

export { runPhase22Tests, testFiles }; 