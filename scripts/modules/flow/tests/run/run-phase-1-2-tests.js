#!/usr/bin/env node

/**
 * @fileoverview Phase 1.2 Test Runner - AST Cache System Testing
 * Comprehensive test execution for all Phase 1.2 cache components
 * 
 * @author Claude (Task Master Flow Testing Phase 1.2)
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

// Phase 1.2 test file configurations
const testFiles = [
  {
    name: 'Cache Manager',
    path: 'unit/ast/cache/cache-manager.test.js',
    description: 'Core cache management and LRU eviction policies',
    expectedTests: 25,
    category: 'core'
  },
  {
    name: 'Cache Key Generator',
    path: 'unit/ast/cache/cache-key-generator.test.js',
    description: 'Cache key generation and hashing algorithms',
    expectedTests: 20,
    category: 'core'
  },
  {
    name: 'Content Hasher',
    path: 'unit/ast/cache/content-hasher.test.js',
    description: 'Content hashing algorithms and file fingerprinting',
    expectedTests: 15,
    category: 'core'
  },
  {
    name: 'Dependency Tracker',
    path: 'unit/ast/cache/dependency-tracker.test.js',
    description: 'File dependency tracking and cascade invalidation',
    expectedTests: 20,
    category: 'advanced'
  },
  {
    name: 'Batch Invalidation',
    path: 'unit/ast/cache/batch-invalidation.test.js',
    description: 'Batch cache operations and performance optimization',
    expectedTests: 15,
    category: 'advanced'
  },
  {
    name: 'Selective Invalidation',
    path: 'unit/ast/cache/selective-invalidation.test.js',
    description: 'Smart cache invalidation and Git integration',
    expectedTests: 15,
    category: 'advanced'
  }
];

class Phase12TestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.totalSkipped = 0;
    this.startTime = Date.now();
  }

  /**
   * Logs a message with specified color
   */
  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Prints a formatted header
   */
  printHeader(text, color = 'cyan') {
    const line = '='.repeat(80);
    console.log(`\n${colors[color]}${colors.bright}${line}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${text.padStart((80 + text.length) / 2)}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${line}${colors.reset}`);
  }

  /**
   * Prints a section header
   */
  printSection(text, color = 'blue') {
    const line = '-'.repeat(60);
    console.log(`\n${colors[color]}${line}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${text}${colors.reset}`);
    console.log(`${colors[color]}${line}${colors.reset}`);
  }

  /**
   * Executes a single test file using Jest
   */
  async runTestFile(testFile) {
    return new Promise((resolve) => {
      const testPath = join(__dirname, testFile.path);
      
      // Check if test file exists
      if (!existsSync(testPath)) {
        resolve({
          success: false,
          name: testFile.name,
          error: 'Test file not found',
          stats: { tests: 0, passed: 0, failed: 0, skipped: 0, time: 0 }
        });
        return;
      }

      console.log(`\n${colors.yellow}🔄 Running: ${testFile.name}${colors.reset}`);
      console.log(`${colors.cyan}📋 Description: ${testFile.description}${colors.reset}`);
      console.log(`${colors.magenta}📁 File: ${testFile.path}${colors.reset}`);
      console.log(`${colors.blue}🎯 Expected: ~${testFile.expectedTests} tests${colors.reset}`);
      
      const startTime = Date.now();
      
      // Jest command with configuration for ES modules
      const jestArgs = [
        '--experimental-vm-modules',
        join(__dirname, '../../../../node_modules/.bin/jest'),
        testFile.path,
        '--config=jest.config.js',
        '--verbose',
        '--no-cache',
        '--forceExit',
        '--detectOpenHandles'
      ];

      const jestProcess = spawn('node', jestArgs, {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules'
        }
      });

      let output = '';
      let errorOutput = '';

      jestProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Show real-time output for better user experience
        process.stdout.write(text);
      });

      jestProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        // Only show relevant errors
        if (!text.includes('Warning:') && !text.includes('deprecated')) {
          process.stderr.write(text);
        }
      });

      jestProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Parse Jest output for statistics
        const stats = this.parseJestOutput(output);
        stats.time = duration;
        
        const success = code === 0 && stats.failed === 0;
        
        resolve({
          success,
          name: testFile.name,
          category: testFile.category,
          expectedTests: testFile.expectedTests,
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
          category: testFile.category,
          expectedTests: testFile.expectedTests,
          error: error.message,
          output: '',
          stats: { tests: 0, passed: 0, failed: 0, skipped: 0, time: Date.now() - startTime }
        });
      });
    });
  }

  /**
   * Parses Jest output to extract test statistics
   */
  parseJestOutput(output) {
    const stats = { tests: 0, passed: 0, failed: 0, skipped: 0 };
    
    // Look for Jest summary patterns
    const patterns = {
      tests: /(\d+) tests?/,
      passed: /(\d+) passed/,
      failed: /(\d+) failed/,
      skipped: /(\d+) skipped/
    };
    
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = output.match(pattern);
      if (match) {
        stats[key] = parseInt(match[1]);
      }
    });
    
    // Alternative parsing for different output formats
    if (stats.tests === 0) {
      const testResults = output.match(/✓|×|✗/g);
      if (testResults) {
        stats.tests = testResults.length;
        stats.passed = (output.match(/✓/g) || []).length;
        stats.failed = (output.match(/×|✗/g) || []).length;
      }
    }
    
    return stats;
  }

  /**
   * Runs all Phase 1.2 tests
   */
  async runAllTests() {
    this.printHeader('TASK MASTER FLOW - PHASE 1.2 AST CACHE SYSTEM TESTING');
    
    console.log(`${colors.bright}Phase 1.2 Focus:${colors.reset} AST Cache System Testing`);
    console.log(`${colors.bright}Test Categories:${colors.reset}`);
    console.log(`  • Core Cache Components (3 test files)`);
    console.log(`  • Advanced Cache Features (3 test files)`);
    console.log(`${colors.bright}Total Test Files:${colors.reset} ${testFiles.length}`);
    
    let currentFile = 1;
    
    for (const testFile of testFiles) {
      this.printSection(`Test ${currentFile}/${testFiles.length}: ${testFile.name}`, 'blue');
      
      const result = await this.runTestFile(testFile);
      this.results.push(result);
      
      // Update totals
      this.totalTests += result.stats.tests;
      this.totalPassed += result.stats.passed;
      this.totalFailed += result.stats.failed;
      this.totalSkipped += result.stats.skipped;
      
      // Print immediate result
      const statusIcon = result.success ? '✅' : '❌';
      const statusColor = result.success ? 'green' : 'red';
      const timeStr = `(${(result.duration / 1000).toFixed(2)}s)`;
      
      console.log(`\n${statusIcon} ${colors[statusColor]}${result.name}: ${result.stats.passed}/${result.stats.tests} tests passed ${timeStr}${colors.reset}`);
      
      if (!result.success && result.error) {
        console.log(`${colors.red}   Error: ${result.error}${colors.reset}`);
      }
      
      if (result.stats.skipped > 0) {
        console.log(`${colors.yellow}   Skipped: ${result.stats.skipped} tests${colors.reset}`);
      }
      
      currentFile++;
    }
    
    // Generate comprehensive summary
    this.generateSummary();
  }

  /**
   * Generates comprehensive test summary and analysis
   */
  generateSummary() {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests) * 100 : 0;
    
    this.printHeader('📊 PHASE 1.2 CACHE SYSTEM TESTING SUMMARY');
    
    // Overall Statistics
    this.printSection('Overall Results', 'magenta');
    console.log(`📁 Test Files: ${testFiles.length} (${this.results.filter(r => r.success).length} passed, ${this.results.filter(r => !r.success).length} failed)`);
    console.log(`🧪 Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${colors.green}${this.totalPassed}${colors.reset}`);
    console.log(`❌ Failed: ${colors.red}${this.totalFailed}${colors.reset}`);
    console.log(`⏭️  Skipped: ${colors.yellow}${this.totalSkipped}${colors.reset}`);
    console.log(`⏱️  Total Time: ${totalDuration.toFixed(2)}s`);
    console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);

    // Category Analysis
    this.printSection('Cache Component Analysis', 'blue');
    
    const coreComponents = this.results.filter(r => r.category === 'core');
    const advancedComponents = this.results.filter(r => r.category === 'advanced');
    
    const coreStats = this.calculateCategoryStats(coreComponents);
    const advancedStats = this.calculateCategoryStats(advancedComponents);
    
    console.log(`🔧 Core Cache Components:`);
    console.log(`   Files: ${coreComponents.length}/3`);
    console.log(`   Tests: ${coreStats.passed}/${coreStats.total} (${coreStats.rate.toFixed(1)}%)`);
    console.log(`   Status: ${coreStats.allPassed ? '✅ All Passing' : '❌ Issues Detected'}`);
    
    console.log(`🚀 Advanced Cache Features:`);
    console.log(`   Files: ${advancedComponents.length}/3`);
    console.log(`   Tests: ${advancedStats.passed}/${advancedStats.total} (${advancedStats.rate.toFixed(1)}%)`);
    console.log(`   Status: ${advancedStats.allPassed ? '✅ All Passing' : '❌ Issues Detected'}`);

    // Performance Analysis
    this.printSection('Performance Analysis', 'cyan');
    const avgTime = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const avgTestTime = this.totalTests > 0 ? this.results.reduce((sum, r) => sum + r.duration, 0) / this.totalTests : 0;
    
    console.log(`📈 Average time per file: ${(avgTime / 1000).toFixed(2)}s`);
    console.log(`📈 Average time per test: ${avgTestTime.toFixed(0)}ms`);
    
    // Find performance outliers
    const sortedByTime = [...this.results].sort((a, b) => b.duration - a.duration);
    if (sortedByTime.length > 0) {
      console.log(`🐌 Slowest file: ${sortedByTime[0].name} (${(sortedByTime[0].duration / 1000).toFixed(2)}s)`);
      console.log(`⚡ Fastest file: ${sortedByTime[sortedByTime.length - 1].name} (${(sortedByTime[sortedByTime.length - 1].duration / 1000).toFixed(2)}s)`);
    }

    // Test Coverage Analysis
    this.printSection('Test Coverage Analysis', 'yellow');
    this.results.forEach(result => {
      const actualVsExpected = result.expectedTests > 0 ? (result.stats.tests / result.expectedTests) * 100 : 0;
      const coverageColor = actualVsExpected >= 90 ? 'green' : actualVsExpected >= 70 ? 'yellow' : 'red';
      
      console.log(`📋 ${result.name}:`);
      console.log(`   Expected: ~${result.expectedTests} tests`);
      console.log(`   Actual: ${result.stats.tests} tests`);
      console.log(`   Coverage: ${colors[coverageColor]}${actualVsExpected.toFixed(1)}%${colors.reset}`);
      console.log(`   Status: ${result.success ? '✅ Passed' : '❌ Failed'}`);
    });

    // Phase 1.2 Specific Analysis
    this.printSection('Cache System Feature Analysis', 'magenta');
    
    const features = [
      { name: 'Cache Management', component: 'Cache Manager' },
      { name: 'Key Generation', component: 'Cache Key Generator' },
      { name: 'Content Hashing', component: 'Content Hasher' },
      { name: 'Dependency Tracking', component: 'Dependency Tracker' },
      { name: 'Batch Operations', component: 'Batch Invalidation' },
      { name: 'Smart Invalidation', component: 'Selective Invalidation' }
    ];
    
    console.log(`✨ Cache System Features:`);
    features.forEach(feature => {
      const result = this.results.find(r => r.name === feature.component);
      if (result) {
        const status = result.success ? '✅' : '❌';
        const rate = result.stats.tests > 0 ? (result.stats.passed / result.stats.tests * 100).toFixed(1) : '0.0';
        console.log(`   ${status} ${feature.name}: ${rate}%`);
      } else {
        console.log(`   ❓ ${feature.name}: Component not tested`);
      }
    });

    // Detailed Results
    this.printSection('Detailed Results by Component', 'white');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const statusColor = result.success ? 'green' : 'red';
      const timeStr = `(${(result.duration / 1000).toFixed(2)}s)`;
      
      console.log(`${index + 1}. ${colors[statusColor]}${status}${colors.reset} ${result.name}`);
      console.log(`   Tests: ${result.stats.passed}/${result.stats.tests} passed`);
      console.log(`   Duration: ${timeStr}`);
      console.log(`   Category: ${result.category}`);
      
      if (!result.success && result.error) {
        console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
      }
    });

    // Recommendations and Next Steps
    this.generateRecommendations();
  }

  /**
   * Calculates statistics for a category of components
   */
  calculateCategoryStats(components) {
    const total = components.reduce((sum, c) => sum + c.stats.tests, 0);
    const passed = components.reduce((sum, c) => sum + c.stats.passed, 0);
    const rate = total > 0 ? (passed / total) * 100 : 0;
    const allPassed = components.every(c => c.success);
    
    return { total, passed, rate, allPassed };
  }

  /**
   * Generates recommendations and next steps
   */
  generateRecommendations() {
    this.printSection('💡 Recommendations & Next Steps', 'cyan');
    
    if (this.totalFailed === 0) {
      console.log(`🎉 ${colors.green}Excellent! All Phase 1.2 cache system tests are passing.${colors.reset}`);
      console.log(`📈 Phase 1.2 is ready for integration with Phase 1.3.`);
      console.log(`🔄 Consider adding stress tests for cache performance under heavy load.`);
    } else {
      console.log(`🔧 ${colors.red}${this.totalFailed} test(s) need attention across ${this.results.filter(r => !r.success).length} component(s).${colors.reset}`);
      
      // Identify critical failures
      const criticalComponents = ['Cache Manager', 'Cache Key Generator'];
      const criticalFailures = this.results.filter(r => 
        criticalComponents.includes(r.name) && !r.success
      );
      
      if (criticalFailures.length > 0) {
        console.log(`🚨 Critical cache components have failures - these should be fixed first:`);
        criticalFailures.forEach(result => {
          console.log(`   - ${result.name}: ${result.error || 'Unknown error'}`);
        });
      }
    }
    
    // Performance recommendations
    const slowComponents = this.results.filter(r => r.duration > 3000); // > 3 seconds
    if (slowComponents.length > 0) {
      console.log(`⚡ Performance optimization recommended for:`);
      slowComponents.forEach(result => {
        console.log(`   - ${result.name} (${(result.duration / 1000).toFixed(2)}s)`);
      });
    }
    
    // Coverage recommendations
    const lowCoverageComponents = this.results.filter(r => {
      const coverage = r.expectedTests > 0 ? (r.stats.tests / r.expectedTests) * 100 : 0;
      return coverage < 70;
    });
    
    if (lowCoverageComponents.length > 0) {
      console.log(`📊 Consider adding more tests for:`);
      lowCoverageComponents.forEach(result => {
        const coverage = result.expectedTests > 0 ? (result.stats.tests / result.expectedTests) * 100 : 0;
        console.log(`   - ${result.name} (${coverage.toFixed(1)}% coverage)`);
      });
    }
    
    console.log(`\n📚 Next Steps:`);
    if (this.totalFailed > 0) {
      console.log(`   1. Fix ${this.totalFailed} failing test(s) in Phase 1.2`);
      console.log(`   2. Review cache component implementations`);
    }
    console.log(`   3. Run cache performance benchmarks`);
    console.log(`   4. Integrate with Phase 1.3 (AST Context Building)`);
    console.log(`   5. Test cache behavior under concurrent access`);
    console.log(`   6. Validate cache invalidation with real file changes`);
    
    console.log(`\n🎯 Phase 1.2 Cache System Testing Complete!`);
    
    // Command reference
    console.log(`\n📋 Command Reference:`);
    console.log(`   Run all Phase 1.2 tests: ${colors.cyan}node run-phase-1-2-tests.js${colors.reset}`);
    console.log(`   Run individual cache tests:`);
    this.results.forEach(result => {
      console.log(`   ${colors.cyan}npx jest ${result.name.toLowerCase().replace(/\s+/g, '-')} --config=jest.config.js${colors.reset}`);
    });
  }
}

// Main execution
async function main() {
  const runner = new Phase12TestRunner();
  
  try {
    await runner.runAllTests();
    
    // Exit with appropriate code
    const exitCode = runner.totalFailed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Phase 1.2 test runner error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ Unhandled Rejection at:${colors.reset}`, promise);
  console.error(`${colors.red}Reason:${colors.reset}`, reason);
  process.exit(1);
});

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Phase12TestRunner, testFiles }; 