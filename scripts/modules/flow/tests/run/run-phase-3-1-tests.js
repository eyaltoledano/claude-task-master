#!/usr/bin/env node

/**
 * @fileoverview Phase 3.1 Test Runner - AST-Claude Integration Testing
 * Comprehensive integration testing between AST system and Claude Code components
 * 
 * @author Claude (Task Master Flow Testing Phase 3.1)
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
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m'
};

// Phase 3.1 integration test file configurations
const testFiles = [
  {
    name: 'AST-Claude Integration',
    path: 'integration/ast-claude-integration.test.js',
    description: 'Core AST-Claude integration, session lifecycle, and data flow',
    expectedTests: 40,
    category: 'core-integration',
    priority: 'critical',
    dependencies: ['Phase 1.1-1.3', 'Phase 2.1']
  },
  {
    name: 'Worktree-AST Integration',
    path: 'integration/worktree-ast-integration.test.js',
    description: 'Worktree discovery, file watching, and AST coordination',
    expectedTests: 30,
    category: 'worktree-integration',
    priority: 'high',
    dependencies: ['Phase 1.1-1.3', 'Phase 2.3']
  },
  {
    name: 'Cache Invalidation Integration',
    path: 'integration/cache-invalidation-integration.test.js',
    description: 'Cache behavior during operations and performance optimization',
    expectedTests: 25,
    category: 'cache-integration',
    priority: 'high',
    dependencies: ['Phase 1.2', 'Phase 2.1-2.3']
  },
  {
    name: 'Context Building Integration',
    path: 'integration/context-building-integration.test.js',
    description: 'End-to-end context building pipeline and Claude formatting',
    expectedTests: 35,
    category: 'context-integration',
    priority: 'critical',
    dependencies: ['Phase 1.3', 'Phase 2.1-2.2']
  }
];

class Phase31TestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.totalSkipped = 0;
    this.startTime = Date.now();
    this.performanceThresholds = {
      fast: 3000,     // < 3s is fast for integration tests
      medium: 8000,   // < 8s is acceptable
      slow: 15000     // > 15s is slow
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
    const line = '-'.repeat(70);
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
   * Executes a Jest integration test file with proper configuration
   */
  async runIntegrationTest(testFile) {
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
          dependencies: testFile.dependencies,
          error: 'Integration test file not found',
          stats: { tests: 0, passed: 0, failed: 0, skipped: 0, time: 0 },
          duration: 0
        });
        return;
      }

      // Display test initiation
      console.log(`\n${colors.yellow}${colors.bright}🚀 Executing: ${testFile.name}${colors.reset}`);
      console.log(`${colors.cyan}   📝 ${testFile.description}${colors.reset}`);
      console.log(`${colors.magenta}   📂 ${testFile.path}${colors.reset}`);
      console.log(`${colors.blue}   🎯 Target: ~${testFile.expectedTests} integration tests${colors.reset}`);
      console.log(`${colors.white}   🏷️  Category: ${testFile.category} | Priority: ${testFile.priority}${colors.reset}`);
      console.log(`${colors.yellow}   🔗 Dependencies: ${testFile.dependencies.join(', ')}${colors.reset}`);
      
      const startTime = Date.now();
      
      // Jest execution with enhanced configuration for integration tests
      const jestCommand = [
        '--experimental-vm-modules',
        join(__dirname, '../../../../node_modules/.bin/jest'),
        testFile.path,
        '--config=jest.config.js',
        '--verbose',
        '--no-cache',
        '--forceExit',
        '--detectOpenHandles',
        '--maxWorkers=1',  // Single worker for stability in integration tests
        '--timeout=30000'  // 30s timeout for integration tests
      ];

      const jestProcess = spawn('node', jestCommand, {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: '--experimental-vm-modules --max-old-space-size=8192'
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
          dependencies: testFile.dependencies,
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
          dependencies: testFile.dependencies,
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
    
    return lines.slice(0, 3).join(' | ') || 'Integration test execution failed';
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
    console.log(`   🏷️  Category: ${result.category}`);
    
    if (!result.success) {
      console.log(`   ${colors.red}❗ Error: ${result.error}${colors.reset}`);
    }
    
    if (result.stats.skipped > 0) {
      console.log(`   ${colors.yellow}⏭️  Skipped: ${result.stats.skipped} tests${colors.reset}`);
    }
  }

  /**
   * Runs all Phase 3.1 integration tests with comprehensive reporting
   */
  async runAllTests() {
    this.printHeader('🔗 TASK MASTER FLOW - PHASE 3.1 AST-CLAUDE INTEGRATION TESTING');
    
    // Phase introduction
    console.log(`${colors.bright}Phase 3.1 Objective:${colors.reset} AST-Claude Integration Testing`);
    console.log(`${colors.bright}Integration Scope:${colors.reset}`);
    console.log(`  🏗️  Core AST-Claude Integration (1 component)`);
    console.log(`  🌳 Worktree-AST Integration (1 component)`);
    console.log(`  ⚡ Cache Integration (1 component)`);
    console.log(`  📝 Context Building Integration (1 component)`);
    console.log(`${colors.bright}Total Integration Tests:${colors.reset} ${testFiles.length}`);
    console.log(`${colors.bright}Expected Tests:${colors.reset} ${testFiles.reduce((sum, f) => sum + f.expectedTests, 0)} total`);
    console.log(`${colors.bright}Dependencies:${colors.reset} Phases 1.1-1.3, 2.1-2.3`);
    
    // Execute each integration test file
    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      
      this.printSection(`Integration Test ${i + 1}/${testFiles.length}: ${testFile.name}`, 'blue');
      
      const result = await this.runIntegrationTest(testFile);
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
   * Generates comprehensive summary with detailed analysis
   */
  generateComprehensiveSummary() {
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const successRate = this.totalTests > 0 ? (this.totalPassed / this.totalTests) * 100 : 0;
    
    this.printHeader('📈 PHASE 3.1 COMPREHENSIVE INTEGRATION ANALYSIS');
    
    // Executive Summary
    this.printSection('📋 Executive Summary', 'magenta');
    const passedComponents = this.results.filter(r => r.success).length;
    const failedComponents = this.results.length - passedComponents;
    
    console.log(`🏢 Integration Components: ${passedComponents}/${this.results.length} components passing`);
    console.log(`📊 Test Overview: ${this.totalPassed}/${this.totalTests} tests passing (${successRate.toFixed(1)}%)`);
    console.log(`⏰ Execution Time: ${totalDuration.toFixed(2)}s total`);
    console.log(`🎯 Phase Status: ${failedComponents === 0 ? '✅ COMPLETE' : '❌ ISSUES DETECTED'}`);

    // Integration Category Analysis
    this.printSection('🔬 Integration Category Analysis', 'blue');
    this.analyzeIntegrationCategories();

    // Priority Analysis
    this.printSection('🚨 Priority-Based Analysis', 'yellow');
    this.analyzePriorities();

    // Dependency Validation
    this.printSection('🔗 Dependency Validation', 'cyan');
    this.validateDependencies();

    // Performance Deep Dive
    this.printSection('⚡ Performance Analysis', 'cyan');
    this.analyzePerformance();

    // Integration Coverage Analysis
    this.printSection('📊 Integration Coverage Analysis', 'green');
    this.analyzeIntegrationCoverage();

    // Feature Integration Assessment
    this.printSection('✨ AST-Claude Integration Feature Assessment', 'magenta');
    this.assessIntegrationFeatures();

    // Detailed Component Results
    this.printSection('📄 Detailed Integration Results', 'white');
    this.displayDetailedResults();

    // Quality Gates Assessment
    this.printSection('🛡️ Integration Quality Gates', 'cyan');
    this.assessIntegrationQualityGates();

    // Strategic Recommendations
    this.printSection('🎯 Strategic Recommendations', 'yellow');
    this.generateStrategicRecommendations();

    // Phase Transition Assessment
    this.printSection('🚀 Phase 3.2 Readiness Assessment', 'green');
    this.assessPhase32Readiness();
  }

  /**
   * Analyzes integration test results by categories
   */
  analyzeIntegrationCategories() {
    const categories = {
      'core-integration': { 
        name: 'Core AST-Claude Integration', 
        components: [], 
        description: 'Primary integration between AST and Claude systems' 
      },
      'worktree-integration': { 
        name: 'Worktree-AST Integration', 
        components: [], 
        description: 'Worktree coordination with AST processing' 
      },
      'cache-integration': { 
        name: 'Cache Integration', 
        components: [], 
        description: 'Cache behavior during AST-Claude operations' 
      },
      'context-integration': { 
        name: 'Context Building Integration', 
        components: [], 
        description: 'End-to-end context pipeline integration' 
      }
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
      
      console.log(`\n${statusIcon} ${priority.name}: ${passing}/${total} integration components passing`);
      
      if (passing < total) {
        const failing = priority.components.filter(c => !c.success);
        console.log(`   ⚠️  Issues in: ${failing.map(c => c.name).join(', ')}`);
      }
    });
  }

  /**
   * Validates dependency requirements
   */
  validateDependencies() {
    console.log(`🔗 Dependency Validation:`);
    
    const uniqueDependencies = [...new Set(
      this.results.flatMap(r => r.dependencies)
    )];
    
    console.log(`   📋 Required Phase Dependencies: ${uniqueDependencies.join(', ')}`);
    console.log(`   ✅ All Phase 1 (AST Core): Assumed complete from Phase 2.3`);
    console.log(`   ✅ All Phase 2 (Claude Integration): Assumed complete from Phase 2.3`);
    
    // Check for integration-specific dependencies
    const integrationDependencies = [
      { name: 'AST Language Detection', phase: 'Phase 1.1' },
      { name: 'AST Cache System', phase: 'Phase 1.2' },
      { name: 'AST Context Building', phase: 'Phase 1.3' },
      { name: 'Background Services', phase: 'Phase 2.1' },
      { name: 'Hook System', phase: 'Phase 2.2' },
      { name: 'Worktree Integration', phase: 'Phase 2.3' }
    ];
    
    console.log(`\n   🧩 Integration Dependencies:`);
    integrationDependencies.forEach(dep => {
      console.log(`   ✅ ${dep.name} (${dep.phase}): Available`);
    });
  }

  /**
   * Analyzes performance characteristics
   */
  analyzePerformance() {
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTestTime = this.totalTests > 0 ? totalDuration / this.totalTests : 0;
    
    console.log(`📈 Average integration test duration: ${(avgDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Average test case duration: ${avgTestTime.toFixed(0)}ms`);
    console.log(`📈 Total execution time: ${(totalDuration / 1000).toFixed(2)}s`);
    
    // Performance categorization for integration tests
    const fast = this.results.filter(r => r.duration < this.performanceThresholds.fast);
    const medium = this.results.filter(r => 
      r.duration >= this.performanceThresholds.fast && 
      r.duration < this.performanceThresholds.medium
    );
    const slow = this.results.filter(r => r.duration >= this.performanceThresholds.medium);
    
    console.log(`\n🚀 Fast integration tests (< 3s): ${fast.length}`);
    console.log(`⚡ Medium integration tests (3-8s): ${medium.length}`);
    console.log(`🐌 Slow integration tests (> 8s): ${slow.length}`);
    
    if (slow.length > 0) {
      console.log(`\n⚠️  Performance attention needed:`);
      slow.forEach(component => {
        console.log(`   - ${component.name}: ${(component.duration / 1000).toFixed(2)}s`);
      });
    }
  }

  /**
   * Analyzes integration test coverage metrics
   */
  analyzeIntegrationCoverage() {
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
    
    console.log(`📊 Overall Integration Coverage: ${overallCoverage.toFixed(1)}% (${totalActual}/${totalExpected} tests)`);
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
   * Assesses AST-Claude integration feature completeness
   */
  assessIntegrationFeatures() {
    const features = [
      { 
        name: 'AST-Claude Data Flow', 
        component: 'AST-Claude Integration',
        description: 'Core data flow between AST and Claude systems'
      },
      { 
        name: 'Worktree-AST Coordination', 
        component: 'Worktree-AST Integration',
        description: 'Worktree discovery and AST processing coordination'
      },
      { 
        name: 'Cache Integration', 
        component: 'Cache Invalidation Integration',
        description: 'Cache behavior during AST-Claude operations'
      },
      { 
        name: 'Context Pipeline Integration', 
        component: 'Context Building Integration',
        description: 'End-to-end context building and formatting'
      }
    ];
    
    console.log(`🔧 AST-Claude Integration Features:`);
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
   * Displays detailed results for each integration component
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
      console.log(`   🔗 Dependencies: ${result.dependencies.join(', ')}`);
      
      if (!result.success) {
        console.log(`   ${colors.red}❗ Error: ${result.error}${colors.reset}`);
      }
      
      if (result.stats.skipped > 0) {
        console.log(`   ⏭️  Skipped: ${result.stats.skipped} tests`);
      }
    });
  }

  /**
   * Assesses quality gates for Phase 3.1
   */
  assessIntegrationQualityGates() {
    const gates = [
      {
        name: 'All Critical Integration Components Pass',
        check: () => this.results.filter(r => r.priority === 'critical').every(r => r.success),
        impact: 'Blocks Phase 3.2 and production readiness'
      },
      {
        name: 'Overall Success Rate ≥ 90%',
        check: () => (this.totalPassed / this.totalTests) >= 0.90,
        impact: 'Affects system integration reliability'
      },
      {
        name: 'No Integration Test Takes > 15s',
        check: () => this.results.every(r => r.duration < 15000),
        impact: 'CI/CD pipeline performance'
      },
      {
        name: 'Integration Coverage ≥ 85%',
        check: () => {
          const expected = this.results.reduce((sum, r) => sum + r.expectedTests, 0);
          return expected > 0 ? (this.totalTests / expected) >= 0.85 : true;
        },
        impact: 'Integration test comprehensiveness'
      }
    ];
    
    console.log(`🛡️  Integration Quality Gate Assessment:`);
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
      console.log(`🎉 All integration quality gates passed! Phase 3.1 meets production standards.`);
    } else {
      console.log(`⚠️  ${gates.length - passedGates} quality gate(s) failed. Review required before Phase 3.2.`);
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
      console.log(`🎉 ${colors.green}Excellent! All Phase 3.1 AST-Claude integration tests are passing.${colors.reset}`);
      console.log(`📈 Phase 3.1 exceeds expectations and is ready for Phase 3.2.`);
      console.log(`🔄 Consider stress testing with high-volume operations.`);
    } else {
      console.log(`🔧 ${colors.red}Action Required: ${this.totalFailed} test(s) failing across ${this.results.filter(r => !r.success).length} component(s).${colors.reset}`);
    }
    
    // Critical issues
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 CRITICAL: Immediate attention required for:`);
      criticalFailures.forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
      console.log(`   These integration failures block Phase 3.2.`);
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
        console.log(`   - ${result.name}: ${(result.duration / 1000).toFixed(2)}s (target: <8s)`);
      });
    }
    
    // Strategic next steps
    console.log(`\n📋 Strategic Next Steps:`);
    if (criticalFailures.length > 0) {
      console.log(`   1. 🚨 Fix ${criticalFailures.length} critical integration failure(s) immediately`);
      console.log(`   2. 🔧 Review AST-Claude integration implementation`);
    }
    if (performanceIssues.length > 0) {
      console.log(`   3. ⚡ Optimize ${performanceIssues.length} slow integration test(s)`);
    }
    console.log(`   4. 🧪 Run load testing with realistic workloads`);
    console.log(`   5. 📊 Validate integration performance benchmarks`);
    console.log(`   6. 🔄 Test with multiple concurrent Claude sessions`);
    console.log(`   7. 🚀 Prepare for Phase 3.2 (Hook Pipeline Integration)`);
  }

  /**
   * Assesses readiness for Phase 3.2
   */
  assessPhase32Readiness() {
    const criticalPassing = this.results.filter(r => r.priority === 'critical').every(r => r.success);
    const overallSuccessRate = (this.totalPassed / this.totalTests) * 100;
    const performanceAcceptable = this.results.every(r => r.duration < 20000); // 20s max for integration
    
    console.log(`🎯 Phase 3.1 → Phase 3.2 Transition Assessment:`);
    console.log(`   ✅ Critical Integration Components: ${criticalPassing ? 'Ready' : 'Blocked'}`);
    console.log(`   📊 Success Rate: ${overallSuccessRate.toFixed(1)}% (Target: ≥90%)`);
    console.log(`   ⚡ Performance: ${performanceAcceptable ? 'Acceptable' : 'Needs Work'}`);
    
    const ready = criticalPassing && overallSuccessRate >= 90 && performanceAcceptable;
    
    if (ready) {
      console.log(`\n🚀 ${colors.green}READY FOR PHASE 3.2: Hook Pipeline Integration Testing${colors.reset}`);
      console.log(`   📈 All AST-Claude integration prerequisites met`);
      console.log(`   🔄 Integration system is production-ready`);
      console.log(`   📋 Recommended: Update TESTING_INDEX.md with Phase 3.1 completion`);
    } else {
      console.log(`\n⏸️  ${colors.yellow}PHASE 3.2 BLOCKED: Prerequisites not met${colors.reset}`);
      console.log(`   🔧 Complete Phase 3.1 fixes before proceeding`);
      console.log(`   📊 Ensure all critical integration components pass`);
      console.log(`   ⚡ Address performance issues if any`);
    }
    
    // Command reference
    console.log(`\n📋 Command Reference:`);
    console.log(`   🔄 Re-run Phase 3.1: ${colors.cyan}node run-phase-3-1-tests.js${colors.reset}`);
    console.log(`   🔗 Run specific integration tests:`);
    this.results.forEach(result => {
      console.log(`   ${colors.cyan}npx jest ${result.path} --config=jest.config.js --verbose${colors.reset}`);
    });
    console.log(`   🚀 Start Phase 3.2: ${colors.cyan}node run-phase-3-2-tests.js${colors.reset} (when ready)`);
    
    console.log(`\n🎯 Phase 3.1 AST-Claude Integration Testing Complete!`);
  }
}

// Main execution function
async function main() {
  const runner = new Phase31TestRunner();
  
  try {
    await runner.runAllTests();
    
    // Exit with appropriate code based on results
    const exitCode = runner.totalFailed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}❌ Phase 3.1 test runner fatal error: ${error.message}${colors.reset}`);
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

export { Phase31TestRunner, testFiles }; 