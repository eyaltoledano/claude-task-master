#!/usr/bin/env node

/**
 * @fileoverview Phase 1.3 Test Runner - AST Context Building & Analysis Testing
 * Comprehensive test execution for all Phase 1.3 context building and analysis components
 * 
 * @author Claude (Task Master Flow Testing Phase 1.3)
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

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
  bgBlue: '\x1b[44m'
};

// Phase 1.3 test file configurations
const testFiles = [
  {
    name: 'AST Context Builder',
    path: 'unit/ast/context/ast-context-builder.test.js',
    description: 'Core context building functionality and worktree analysis',
    expectedTests: 30,
    category: 'core',
    priority: 'critical'
  },
  {
    name: 'Enhanced AST Context Builder',
    path: 'unit/ast/context/enhanced-ast-context-builder.test.js',
    description: 'Advanced context features with Git integration and optimization',
    expectedTests: 35,
    category: 'advanced',
    priority: 'high'
  },
  {
    name: 'Code Relevance Scorer',
    path: 'unit/ast/context/code-relevance-scorer.test.js',
    description: 'Relevance scoring algorithms and task-based prioritization',
    expectedTests: 40,
    category: 'analysis',
    priority: 'critical'
  },
  {
    name: 'Complexity Scorer',
    path: 'unit/ast/context/complexity-scorer.test.js',
    description: 'Code complexity analysis and maintainability metrics',
    expectedTests: 25,
    category: 'analysis',
    priority: 'medium'
  },
  {
    name: 'Context Formatter',
    path: 'unit/ast/context/context-formatter.test.js',
    description: 'Claude-optimized context formatting and token optimization',
    expectedTests: 30,
    category: 'output',
    priority: 'high'
  }
];

class Phase13TestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.totalSkipped = 0;
    this.startTime = Date.now();
    this.performanceThresholds = {
      fast: 2000,     // < 2s is fast
      medium: 5000,   // < 5s is acceptable
      slow: 10000     // > 10s is slow
    };
  }

  /**
   * Logs formatted messages with colors
   */
  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Prints a prominent header with styling
   */
  printHeader(text, color = 'cyan') {
    const line = '='.repeat(85);
    const padding = Math.max(0, Math.floor((85 - text.length) / 2));
    const centeredText = ' '.repeat(padding) + text;
    
    console.log(`\n${colors[color]}${colors.bright}${line}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${centeredText}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${line}${colors.reset}`);
  }

  /**
   * Prints a section divider
   */
  printSection(text, color = 'blue') {
    const line = '-'.repeat(65);
    console.log(`\n${colors[color]}${line}${colors.reset}`);
    console.log(`${colors[color]}${colors.bright}${text}${colors.reset}`);
    console.log(`${colors[color]}${line}${colors.reset}`);
  }

  /**
   * Prints a subsection header
   */
  printSubsection(text, color = 'magenta') {
    console.log(`\n${colors[color]}${colors.bright}▶ ${text}${colors.reset}`);
  }

  /**
   * Executes a Jest test file with proper ES module configuration
   */
  async runTestFile(testFile) {
    return new Promise((resolve) => {
      const testPath = join(__dirname, testFile.path);
      
      // Verify test file exists
      if (!existsSync(testPath)) {
        resolve({
          success: false,
          name: testFile.name,
          category: testFile.category,
          priority: testFile.priority,
          expectedTests: testFile.expectedTests,
          error: 'Test file not found',
          stats: { tests: 0, passed: 0, failed: 0, skipped: 0, time: 0 },
          duration: 0
        });
        return;
      }

      // Display test initiation
      console.log(`\n${colors.yellow}${colors.bright}🚀 Executing: ${testFile.name}${colors.reset}`);
      console.log(`${colors.cyan}   📝 ${testFile.description}${colors.reset}`);
      console.log(`${colors.magenta}   📂 ${testFile.path}${colors.reset}`);
      console.log(`${colors.blue}   🎯 Target: ~${testFile.expectedTests} tests${colors.reset}`);
      console.log(`${colors.white}   🏷️  Category: ${testFile.category} | Priority: ${testFile.priority}${colors.reset}`);
      
      const startTime = Date.now();
      
      // Jest execution with ES module support
      const jestCommand = [
        '--experimental-vm-modules',
        join(__dirname, '../../../../node_modules/.bin/jest'),
        testFile.path,
        '--config=jest.config.js',
        '--verbose',
        '--no-cache',
        '--forceExit',
        '--detectOpenHandles',
        '--maxWorkers=1'  // Single worker for stability
      ];

      const jestProcess = spawn('node', jestCommand, {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules --max-old-space-size=4096'
        }
      });

      let stdout = '';
      let stderr = '';

      jestProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        // Stream output for real-time feedback
        process.stdout.write(text);
      });

      jestProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        // Filter out noise from stderr
        if (!text.includes('Warning:') && 
            !text.includes('deprecated') && 
            !text.includes('ExperimentalWarning')) {
          process.stderr.write(text);
        }
      });

      jestProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Parse Jest output for detailed statistics
        const stats = this.parseJestOutput(stdout + stderr);
        stats.time = duration;
        
        const success = code === 0 && stats.failed === 0;
        
        resolve({
          success,
          name: testFile.name,
          category: testFile.category,
          priority: testFile.priority,
          expectedTests: testFile.expectedTests,
          error: success ? null : this.extractErrorSummary(stderr),
          output: stdout,
          stderr: stderr,
          stats,
          duration,
          exitCode: code
        });
      });

      jestProcess.on('error', (error) => {
        resolve({
          success: false,
          name: testFile.name,
          category: testFile.category,
          priority: testFile.priority,
          expectedTests: testFile.expectedTests,
          error: `Process error: ${error.message}`,
          output: '',
          stderr: '',
          stats: { tests: 0, passed: 0, failed: 0, skipped: 0, time: Date.now() - startTime },
          duration: Date.now() - startTime,
          exitCode: -1
        });
      });
    });
  }

  /**
   * Parses Jest output for comprehensive test statistics
   */
  parseJestOutput(output) {
    const stats = { tests: 0, passed: 0, failed: 0, skipped: 0, suites: 0 };
    
    // Enhanced parsing patterns for different Jest output formats
    const patterns = {
      // Standard patterns
      tests: /Tests:\s+(\d+)\s+total/,
      passed: /(\d+)\s+passed/,
      failed: /(\d+)\s+failed/,
      skipped: /(\d+)\s+skipped/,
      suites: /Test Suites:\s+(\d+)\s+total/,
      
      // Alternative patterns
      testCount: /(\d+) tests?/,
      passCount: /(\d+) passing/,
      failCount: /(\d+) failing/
    };
    
    // Try each pattern
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = output.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        switch (key) {
          case 'tests':
          case 'testCount':
            if (stats.tests === 0) stats.tests = value;
            break;
          case 'passed':
          case 'passCount':
            if (stats.passed === 0) stats.passed = value;
            break;
          case 'failed':
          case 'failCount':
            if (stats.failed === 0) stats.failed = value;
            break;
          case 'skipped':
            stats.skipped = value;
            break;
          case 'suites':
            stats.suites = value;
            break;
        }
      }
    });
    
    // Fallback: count test result indicators
    if (stats.tests === 0) {
      const testIndicators = output.match(/✓|×|✗|√|✖|✘/g);
      if (testIndicators) {
        const passed = (output.match(/✓|√/g) || []).length;
        const failed = (output.match(/×|✗|✖|✘/g) || []).length;
        
        stats.tests = passed + failed;
        stats.passed = passed;
        stats.failed = failed;
      }
    }
    
    return stats;
  }

  /**
   * Extracts meaningful error summary from stderr
   */
  extractErrorSummary(stderr) {
    if (!stderr) return 'Unknown error';
    
    const lines = stderr.split('\n').filter(line => 
      line.trim() && 
      !line.includes('Warning:') && 
      !line.includes('deprecated') &&
      !line.includes('ExperimentalWarning')
    );
    
    return lines.slice(0, 3).join(' | ') || 'Test execution failed';
  }

  /**
   * Runs all Phase 1.3 tests with comprehensive reporting
   */
  async runAllTests() {
    this.printHeader('🧬 TASK MASTER FLOW - PHASE 1.3 AST CONTEXT BUILDING & ANALYSIS');
    
    // Phase introduction
    console.log(`${colors.bright}Phase 1.3 Objective:${colors.reset} AST Context Building & Analysis Testing`);
    console.log(`${colors.bright}Testing Scope:${colors.reset}`);
    console.log(`  🏗️  Core Context Building (2 components)`);
    console.log(`  📊 Analysis & Scoring (2 components)`);
    console.log(`  📝 Output Formatting (1 component)`);
    console.log(`${colors.bright}Total Components:${colors.reset} ${testFiles.length}`);
    console.log(`${colors.bright}Expected Tests:${colors.reset} ${testFiles.reduce((sum, f) => sum + f.expectedTests, 0)} total`);
    
    // Execute each test file
    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      
      this.printSection(`Component ${i + 1}/${testFiles.length}: ${testFile.name}`, 'blue');
      
      const result = await this.runTestFile(testFile);
      this.results.push(result);
      
      // Update aggregate statistics
      this.totalTests += result.stats.tests;
      this.totalPassed += result.stats.passed;
      this.totalFailed += result.stats.failed;
      this.totalSkipped += result.stats.skipped;
      
      // Immediate result summary
      this.displayTestResult(result);
    }
    
    // Generate comprehensive analysis
    this.generateComprehensiveSummary();
  }

  /**
   * Displays immediate result for a completed test
   */
  displayTestResult(result) {
    const statusIcon = result.success ? '✅' : '❌';
    const statusColor = result.success ? 'green' : 'red';
    const durationStr = `${(result.duration / 1000).toFixed(2)}s`;
    const performanceIcon = this.getPerformanceIcon(result.duration);
    
    console.log(`\n${statusIcon} ${colors[statusColor]}${colors.bright}${result.name}${colors.reset}`);
    console.log(`   📊 Tests: ${result.stats.passed}/${result.stats.tests} passed`);
    console.log(`   ⏱️  Duration: ${durationStr} ${performanceIcon}`);
    console.log(`   🎯 Coverage: ${this.calculateCoverage(result)}%`);
    
    if (!result.success) {
      console.log(`   ${colors.red}❗ Error: ${result.error}${colors.reset}`);
    }
    
    if (result.stats.skipped > 0) {
      console.log(`   ${colors.yellow}⏭️  Skipped: ${result.stats.skipped} tests${colors.reset}`);
    }
  }

  /**
   * Returns performance icon based on duration
   */
  getPerformanceIcon(duration) {
    if (duration < this.performanceThresholds.fast) return '🚀';
    if (duration < this.performanceThresholds.medium) return '⚡';
    if (duration < this.performanceThresholds.slow) return '🐌';
    return '🐛';
  }

  /**
   * Calculates test coverage percentage
   */
  calculateCoverage(result) {
    if (result.expectedTests === 0) return 100;
    return Math.min(100, (result.stats.tests / result.expectedTests) * 100).toFixed(1);
  }

  /**
   * Generates comprehensive summary with detailed analysis
   */
  generateComprehensiveSummary() {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests) * 100 : 0;
    
    this.printHeader('📈 PHASE 1.3 COMPREHENSIVE TESTING ANALYSIS');
    
    // Executive Summary
    this.printSection('📋 Executive Summary', 'magenta');
    const passedComponents = this.results.filter(r => r.success).length;
    const failedComponents = this.results.length - passedComponents;
    
    console.log(`🏢 Component Status: ${passedComponents}/${this.results.length} components passing`);
    console.log(`📊 Test Overview: ${this.totalPassed}/${this.totalTests} tests passing (${successRate.toFixed(1)}%)`);
    console.log(`⏰ Execution Time: ${totalDuration.toFixed(2)}s total`);
    console.log(`🎯 Phase Status: ${failedComponents === 0 ? '✅ COMPLETE' : '❌ ISSUES DETECTED'}`);

    // Category Analysis
    this.printSection('🔬 Component Category Analysis', 'blue');
    this.analyzeCategoriesDetailed();

    // Priority Analysis
    this.printSection('🚨 Priority-Based Analysis', 'yellow');
    this.analyzePriorities();

    // Performance Deep Dive
    this.printSection('⚡ Performance Analysis', 'cyan');
    this.analyzePerformance();

    // Test Coverage Analysis
    this.printSection('📊 Test Coverage Analysis', 'green');
    this.analyzeCoverage();

    // Feature Completeness Assessment
    this.printSection('✨ AST Context System Feature Assessment', 'magenta');
    this.assessFeatureCompleteness();

    // Detailed Component Results
    this.printSection('📄 Detailed Component Results', 'white');
    this.displayDetailedResults();

    // Quality Gates Assessment
    this.printSection('🛡️ Quality Gates Assessment', 'cyan');
    this.assessQualityGates();

    // Strategic Recommendations
    this.printSection('🎯 Strategic Recommendations', 'yellow');
    this.generateStrategicRecommendations();

    // Next Phase Readiness
    this.printSection('🚀 Phase Transition Readiness', 'green');
    this.assessPhaseReadiness();
  }

  /**
   * Analyzes test results by component categories
   */
  analyzeCategoriesDetailed() {
    const categories = {
      core: { name: 'Core Context Building', components: [], description: 'Foundation components for context generation' },
      advanced: { name: 'Advanced Features', components: [], description: 'Enhanced context building with Git integration' },
      analysis: { name: 'Analysis & Scoring', components: [], description: 'Relevance scoring and complexity analysis' },
      output: { name: 'Output Formatting', components: [], description: 'Claude-optimized context formatting' }
    };
    
    // Group results by category
    this.results.forEach(result => {
      if (categories[result.category]) {
        categories[result.category].components.push(result);
      }
    });
    
    // Analyze each category
    Object.entries(categories).forEach(([key, category]) => {
      if (category.components.length === 0) return;
      
      const totalTests = category.components.reduce((sum, c) => sum + c.stats.tests, 0);
      const passedTests = category.components.reduce((sum, c) => sum + c.stats.passed, 0);
      const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
      const allPassing = category.components.every(c => c.success);
      
      console.log(`\n🏷️  ${category.name}:`);
      console.log(`   📝 ${category.description}`);
      console.log(`   📊 Components: ${category.components.length}`);
      console.log(`   🧪 Tests: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
      console.log(`   ✅ Status: ${allPassing ? 'All Passing' : 'Issues Detected'}`);
      
      if (!allPassing) {
        const failing = category.components.filter(c => !c.success);
        console.log(`   ❌ Failing: ${failing.map(c => c.name).join(', ')}`);
      }
    });
  }

  /**
   * Analyzes results by priority levels
   */
  analyzePriorities() {
    const priorities = {
      critical: { components: [], name: 'Critical Priority' },
      high: { components: [], name: 'High Priority' },
      medium: { components: [], name: 'Medium Priority' }
    };
    
    this.results.forEach(result => {
      if (priorities[result.priority]) {
        priorities[result.priority].components.push(result);
      }
    });
    
    Object.entries(priorities).forEach(([level, priority]) => {
      if (priority.components.length === 0) return;
      
      const passing = priority.components.filter(c => c.success).length;
      const total = priority.components.length;
      const statusIcon = passing === total ? '✅' : '❌';
      
      console.log(`\n${statusIcon} ${priority.name}: ${passing}/${total} components passing`);
      
      if (passing < total) {
        const failing = priority.components.filter(c => !c.success);
        console.log(`   ⚠️  Issues in: ${failing.map(c => c.name).join(', ')}`);
      }
    });
  }

  /**
   * Analyzes performance characteristics
   */
  analyzePerformance() {
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTestTime = this.totalTests > 0 ? totalDuration / this.totalTests : 0;
    
    console.log(`📈 Average component duration: ${(avgDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Average test duration: ${avgTestTime.toFixed(0)}ms`);
    console.log(`📈 Total execution time: ${(totalDuration / 1000).toFixed(2)}s`);
    
    // Performance categorization
    const fast = this.results.filter(r => r.duration < this.performanceThresholds.fast);
    const medium = this.results.filter(r => 
      r.duration >= this.performanceThresholds.fast && 
      r.duration < this.performanceThresholds.medium
    );
    const slow = this.results.filter(r => r.duration >= this.performanceThresholds.medium);
    
    console.log(`\n🚀 Fast components (< 2s): ${fast.length}`);
    console.log(`⚡ Medium components (2-5s): ${medium.length}`);
    console.log(`🐌 Slow components (> 5s): ${slow.length}`);
    
    if (slow.length > 0) {
      console.log(`\n⚠️  Performance attention needed:`);
      slow.forEach(component => {
        console.log(`   - ${component.name}: ${(component.duration / 1000).toFixed(2)}s`);
      });
    }
  }

  /**
   * Analyzes test coverage metrics
   */
  analyzeCoverage() {
    let totalExpected = 0;
    let totalActual = 0;
    let highCoverage = 0;
    let mediumCoverage = 0;
    let lowCoverage = 0;
    
    this.results.forEach(result => {
      totalExpected += result.expectedTests;
      totalActual += result.stats.tests;
      
      const coverage = this.calculateCoverage(result);
      if (coverage >= 90) highCoverage++;
      else if (coverage >= 70) mediumCoverage++;
      else lowCoverage++;
    });
    
    const overallCoverage = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 100;
    
    console.log(`📊 Overall Coverage: ${overallCoverage.toFixed(1)}% (${totalActual}/${totalExpected} tests)`);
    console.log(`🎯 High Coverage (≥90%): ${highCoverage} components`);
    console.log(`🎯 Medium Coverage (70-89%): ${mediumCoverage} components`);
    console.log(`🎯 Low Coverage (<70%): ${lowCoverage} components`);
    
    if (lowCoverage > 0) {
      console.log(`\n📈 Coverage improvement needed:`);
      this.results.forEach(result => {
        const coverage = this.calculateCoverage(result);
        if (coverage < 70) {
          console.log(`   - ${result.name}: ${coverage}% (${result.stats.tests}/${result.expectedTests})`);
        }
      });
    }
  }

  /**
   * Assesses AST context system feature completeness
   */
  assessFeatureCompleteness() {
    const features = [
      { 
        name: 'Core Context Building', 
        component: 'AST Context Builder',
        description: 'Basic worktree context generation'
      },
      { 
        name: 'Enhanced Context Building', 
        component: 'Enhanced AST Context Builder',
        description: 'Git integration and advanced features'
      },
      { 
        name: 'Relevance Scoring', 
        component: 'Code Relevance Scorer',
        description: 'Task-based code relevance analysis'
      },
      { 
        name: 'Complexity Analysis', 
        component: 'Complexity Scorer',
        description: 'Code complexity and maintainability metrics'
      },
      { 
        name: 'Context Formatting', 
        component: 'Context Formatter',
        description: 'Claude-optimized output formatting'
      }
    ];
    
    console.log(`🔧 AST Context System Features:`);
    features.forEach(feature => {
      const result = this.results.find(r => r.name === feature.component);
      if (result) {
        const status = result.success ? '✅' : '❌';
        const rate = result.stats.tests > 0 ? (result.stats.passed / result.stats.tests * 100).toFixed(1) : '0.0';
        console.log(`   ${status} ${feature.name}: ${rate}% tested`);
        console.log(`      ${feature.description}`);
      } else {
        console.log(`   ❓ ${feature.name}: Component not found`);
      }
    });
  }

  /**
   * Displays detailed results for each component
   */
  displayDetailedResults() {
    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const statusColor = result.success ? 'green' : 'red';
      const performanceIcon = this.getPerformanceIcon(result.duration);
      
      console.log(`\n${index + 1}. ${colors[statusColor]}${status}${colors.reset} ${result.name}`);
      console.log(`   📂 ${result.path}`);
      console.log(`   🧪 Tests: ${result.stats.passed}/${result.stats.tests} passed`);
      console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s ${performanceIcon}`);
      console.log(`   🏷️  Category: ${result.category} | Priority: ${result.priority}`);
      console.log(`   📊 Coverage: ${this.calculateCoverage(result)}%`);
      
      if (!result.success) {
        console.log(`   ${colors.red}❗ Error: ${result.error}${colors.reset}`);
      }
      
      if (result.stats.skipped > 0) {
        console.log(`   ⏭️  Skipped: ${result.stats.skipped} tests`);
      }
    });
  }

  /**
   * Assesses quality gates for Phase 1.3
   */
  assessQualityGates() {
    const gates = [
      {
        name: 'All Critical Components Pass',
        check: () => this.results.filter(r => r.priority === 'critical').every(r => r.success),
        impact: 'Blocks Phase 2 integration'
      },
      {
        name: 'Overall Success Rate ≥ 95%',
        check: () => (this.totalPassed / this.totalTests) >= 0.95,
        impact: 'Affects integration reliability'
      },
      {
        name: 'No Component Takes > 10s',
        check: () => this.results.every(r => r.duration < 10000),
        impact: 'Performance in production'
      },
      {
        name: 'Test Coverage ≥ 80%',
        check: () => {
          const expected = this.results.reduce((sum, r) => sum + r.expectedTests, 0);
          return expected > 0 ? (this.totalTests / expected) >= 0.8 : true;
        },
        impact: 'Code quality assurance'
      }
    ];
    
    console.log(`🛡️  Quality Gate Assessment:`);
    let passedGates = 0;
    
    gates.forEach(gate => {
      const passed = gate.check();
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${gate.name}`);
      console.log(`      Impact: ${gate.impact}`);
      if (passed) passedGates++;
    });
    
    console.log(`\n📊 Quality Gates: ${passedGates}/${gates.length} passed`);
    
    if (passedGates === gates.length) {
      console.log(`🎉 All quality gates passed! Phase 1.3 meets production standards.`);
    } else {
      console.log(`⚠️  ${gates.length - passedGates} quality gate(s) failed. Review required before Phase 2.`);
    }
  }

  /**
   * Generates strategic recommendations
   */
  generateStrategicRecommendations() {
    const criticalFailures = this.results.filter(r => r.priority === 'critical' && !r.success);
    const highFailures = this.results.filter(r => r.priority === 'high' && !r.success);
    const performanceIssues = this.results.filter(r => r.duration > this.performanceThresholds.medium);
    
    if (this.totalFailed === 0) {
      console.log(`🎉 ${colors.green}Outstanding! All Phase 1.3 context building tests are passing.${colors.reset}`);
      console.log(`📈 Phase 1.3 exceeds expectations and is ready for Phase 2 integration.`);
      console.log(`🔄 Consider stress testing with large codebases (500+ files).`);
    } else {
      console.log(`🔧 ${colors.red}Action Required: ${this.totalFailed} test(s) failing across ${this.results.filter(r => !r.success).length} component(s).${colors.reset}`);
    }
    
    // Critical issues
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 CRITICAL: Immediate attention required for:`);
      criticalFailures.forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
      console.log(`   These components block Phase 2 integration.`);
    }
    
    // High priority issues
    if (highFailures.length > 0) {
      console.log(`\n⚠️  HIGH PRIORITY: Address soon:`);
      highFailures.forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
    }
    
    // Performance recommendations
    if (performanceIssues.length > 0) {
      console.log(`\n⚡ PERFORMANCE: Optimization recommended for:`);
      performanceIssues.forEach(result => {
        console.log(`   - ${result.name}: ${(result.duration / 1000).toFixed(2)}s (target: <5s)`);
      });
    }
    
    // Strategic next steps
    console.log(`\n📋 Strategic Next Steps:`);
    if (criticalFailures.length > 0) {
      console.log(`   1. 🚨 Fix ${criticalFailures.length} critical component(s) immediately`);
      console.log(`   2. 🔧 Address component implementation issues`);
    }
    if (performanceIssues.length > 0) {
      console.log(`   3. ⚡ Optimize ${performanceIssues.length} slow component(s)`);
    }
    console.log(`   4. 🧪 Run integration tests with Phase 1.1 and 1.2`);
    console.log(`   5. 📊 Benchmark context building with realistic codebases`);
    console.log(`   6. 🔄 Validate Claude context formatting effectiveness`);
    console.log(`   7. 🚀 Prepare for Phase 2.1 (Background Service Integration)`);
  }

  /**
   * Assesses readiness for next phase
   */
  assessPhaseReadiness() {
    const criticalPassing = this.results.filter(r => r.priority === 'critical').every(r => r.success);
    const overallSuccessRate = (this.totalPassed / this.totalTests) * 100;
    const performanceAcceptable = this.results.every(r => r.duration < 15000); // 15s max
    
    console.log(`🎯 Phase 1.3 → Phase 2.1 Transition Assessment:`);
    console.log(`   ✅ Critical Components: ${criticalPassing ? 'Ready' : 'Blocked'}`);
    console.log(`   📊 Success Rate: ${overallSuccessRate.toFixed(1)}% (Target: ≥95%)`);
    console.log(`   ⚡ Performance: ${performanceAcceptable ? 'Acceptable' : 'Needs Work'}`);
    
    const ready = criticalPassing && overallSuccessRate >= 95 && performanceAcceptable;
    
    if (ready) {
      console.log(`\n🚀 ${colors.green}READY FOR PHASE 2.1: Background Service Testing${colors.reset}`);
      console.log(`   📈 All prerequisites met for Phase 2 integration`);
      console.log(`   🔄 AST Context system is production-ready`);
      console.log(`   📋 Recommended: Update TESTING_INDEX.md with Phase 1.3 completion`);
    } else {
      console.log(`\n⏸️  ${colors.yellow}PHASE 2.1 BLOCKED: Prerequisites not met${colors.reset}`);
      console.log(`   🔧 Complete Phase 1.3 fixes before proceeding`);
      console.log(`   📊 Ensure all critical components pass`);
      console.log(`   ⚡ Address performance issues if any`);
    }
    
    // Command reference
    console.log(`\n📋 Command Reference:`);
    console.log(`   🔄 Re-run Phase 1.3: ${colors.cyan}node run-phase-1-3-tests.js${colors.reset}`);
    console.log(`   🔗 Run full Phase 1: ${colors.cyan}node run-phase-1-1-tests.js && node run-phase-1-2-tests.js && node run-phase-1-3-tests.js${colors.reset}`);
    console.log(`   🚀 Start Phase 2.1: ${colors.cyan}node run-phase-2-1-tests.js${colors.reset}`);
    
    console.log(`\n🎯 Phase 1.3 AST Context Building & Analysis Testing Complete!`);
  }
}

// Main execution function
async function main() {
  const runner = new Phase13TestRunner();
  
  try {
    await runner.runAllTests();
    
    // Exit with appropriate code based on results
    const exitCode = runner.totalFailed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Phase 1.3 test runner fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ Unhandled Promise Rejection at:${colors.reset}`, promise);
  console.error(`${colors.red}Reason:${colors.reset}`, reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}❌ Uncaught Exception:${colors.reset}`, error);
  console.error(error.stack);
  process.exit(1);
});

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Phase13TestRunner, testFiles }; 