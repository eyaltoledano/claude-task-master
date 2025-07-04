#!/usr/bin/env node

/**
 * @fileoverview Phase 2.1 Background Service Test Runner
 * Custom test runner for background service tests that may not be picked up by standard Jest configuration
 * Part of Phase 2.1: Background Service Testing
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('\n🧪 Phase 2.1: Background Service Testing', 'cyan'));
  console.log(colorize('='.repeat(50), 'blue'));
  console.log(colorize('Testing background services, state management, and event handling\n', 'yellow'));
}

function printSummary(results) {
  console.log(colorize('\n📊 Test Summary', 'cyan'));
  console.log(colorize('-'.repeat(30), 'blue'));
  
  const totalTests = results.reduce((sum, result) => sum + result.tests, 0);
  const totalPassed = results.reduce((sum, result) => sum + result.passed, 0);
  const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
  
  console.log(`${colorize('Total Test Suites:', 'bright')} ${results.length}`);
  console.log(`${colorize('Total Tests:', 'bright')} ${totalTests}`);
  console.log(`${colorize('Passed:', 'green')} ${totalPassed}`);
  console.log(`${colorize('Failed:', 'red')} ${totalFailed}`);
  console.log(`${colorize('Success Rate:', 'bright')} ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
  
  if (totalFailed === 0) {
    console.log(colorize('\n✅ All Phase 2.1 tests passed!', 'green'));
  } else {
    console.log(colorize('\n❌ Some tests failed. Check output above for details.', 'red'));
  }
}

async function runTestFile(testFile) {
  return new Promise((resolve) => {
    console.log(colorize(`\n🔄 Running ${path.basename(testFile)}...`, 'yellow'));
    
    const jest = spawn('npx', ['jest', testFile, '--verbose'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    jest.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    jest.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    jest.on('close', (code) => {
      // Parse Jest output to extract test statistics
      const testResults = parseJestOutput(output + errorOutput);
      
      if (code === 0) {
        console.log(colorize(`✅ ${path.basename(testFile)} - All tests passed`, 'green'));
        console.log(colorize(`   Tests: ${testResults.tests}, Passed: ${testResults.passed}`, 'blue'));
      } else {
        console.log(colorize(`❌ ${path.basename(testFile)} - Some tests failed`, 'red'));
        console.log(colorize(`   Tests: ${testResults.tests}, Passed: ${testResults.passed}, Failed: ${testResults.failed}`, 'blue'));
        
        // Show error details
        if (errorOutput) {
          console.log(colorize('   Error details:', 'red'));
          console.log(errorOutput.split('\n').slice(0, 5).map(line => `   ${line}`).join('\n'));
        }
      }
      
      resolve({
        file: testFile,
        success: code === 0,
        tests: testResults.tests,
        passed: testResults.passed,
        failed: testResults.failed,
        output: output,
        error: errorOutput
      });
    });
  });
}

function parseJestOutput(output) {
  // Extract test statistics from Jest output
  const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  const failedMatch = output.match(/(\d+)\s+failed/);
  
  if (testMatch) {
    const passed = parseInt(testMatch[1]);
    const total = parseInt(testMatch[2]);
    const failed = failedMatch ? parseInt(failedMatch[1]) : total - passed;
    
    return {
      tests: total,
      passed: passed,
      failed: failed
    };
  }
  
  // Fallback parsing for different Jest output formats
  const suiteMatch = output.match(/(\d+)\s+passing/);
  if (suiteMatch) {
    return {
      tests: parseInt(suiteMatch[1]),
      passed: parseInt(suiteMatch[1]),
      failed: 0
    };
  }
  
  // Default if parsing fails
  return {
    tests: 0,
    passed: 0,
    failed: 0
  };
}

async function main() {
  printHeader();
  
  // Define Phase 2.1 test files
  const testFiles = [
    'unit/services/background-claude-code.test.js',
    'unit/services/streaming-state-manager.test.js',
    'unit/services/pr-monitoring-service.test.js',
    'unit/services/workflow-state-manager.test.js',
    'unit/services/service-mesh.test.js'
  ];
  
  const results = [];
  
  console.log(colorize(`📁 Found ${testFiles.length} test files to execute:`, 'blue'));
  testFiles.forEach(file => {
    console.log(`   • ${path.basename(file)}`);
  });
  
  // Run each test file
  for (const testFile of testFiles) {
    const result = await runTestFile(testFile);
    results.push(result);
  }
  
  printSummary(results);
  
  // Exit with appropriate code
  const hasFailures = results.some(result => !result.success);
  process.exit(hasFailures ? 1 : 0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('Unhandled Rejection at:', 'red'), promise, colorize('reason:', 'red'), reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error(colorize('Error running Phase 2.1 tests:', 'red'), error);
  process.exit(1);
});
