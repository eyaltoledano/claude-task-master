#!/usr/bin/env node
/**
 * Phase 4.1 Test Runner - Real-World Workflow Tests
 * 
 * Executes comprehensive end-to-end workflow tests:
 * - Claude Code workflows
 * - AST analysis workflows
 * - Hook automation workflows
 * - Performance benchmarks
 * 
 * @fileoverview Test runner for Phase 4.1 real-world workflow testing
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Phase41TestRunner {
    constructor() {
        this.startTime = Date.now();
        this.testResults = [];
        this.phase41Tests = [
            {
                name: 'Claude Code Workflows',
                file: '../e2e/claude-code-workflows.js',
                description: 'Complete task implementation workflows',
                expectedDuration: 15000, // 15 seconds
                criticalityLevel: 'high'
            },
            {
                name: 'AST Analysis Workflows',
                file: '../e2e/ast-analysis-workflows.js',
                description: 'Multi-language project analysis',
                expectedDuration: 20000, // 20 seconds
                criticalityLevel: 'high'
            },
            {
                name: 'Hook Automation Workflows',
                file: '../e2e/hook-automation-workflows.js',
                description: 'Automated PR creation and management',
                expectedDuration: 18000, // 18 seconds
                criticalityLevel: 'medium'
            },
            {
                name: 'Performance Benchmarks',
                file: '../e2e/performance-benchmarks.js',
                description: 'System performance under realistic loads',
                expectedDuration: 25000, // 25 seconds
                criticalityLevel: 'high'
            }
        ];
        
        this.performanceTargets = {
            'Claude Code Workflows': { maxTime: 20000, minSuccessRate: 85 },
            'AST Analysis Workflows': { maxTime: 25000, minSuccessRate: 90 },
            'Hook Automation Workflows': { maxTime: 22000, minSuccessRate: 80 },
            'Performance Benchmarks': { maxTime: 30000, minSuccessRate: 75 }
        };
        
        this.systemInfo = {
            platform: os.platform(),
            cpus: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
            nodeVersion: process.version
        };
    }

    async run() {
        try {
            console.log('🚀 Phase 4.1 - Real-World Workflow Test Runner\n');
            console.log('=' .repeat(60));
            console.log('🏗️  END-TO-END REAL-WORLD WORKFLOW TESTING');
            console.log('=' .repeat(60));
            
            this.printSystemInfo();
            console.log('\n📋 Test Suite Overview:');
            this.phase41Tests.forEach((test, index) => {
                console.log(`   ${index + 1}. ${test.name}`);
                console.log(`      ${test.description}`);
                console.log(`      Expected: ~${Math.round(test.expectedDuration / 1000)}s, Criticality: ${test.criticalityLevel}`);
            });
            
            console.log(`\n🎯 Performance Targets:`);
            Object.entries(this.performanceTargets).forEach(([name, targets]) => {
                console.log(`   ${name}: <${Math.round(targets.maxTime / 1000)}s, ≥${targets.minSuccessRate}% success rate`);
            });
            
            console.log('\n' + '='.repeat(60));
            console.log('🧪 EXECUTING PHASE 4.1 TEST SUITES');
            console.log('='.repeat(60) + '\n');
            
            // Execute all test suites
            await this.executeAllTests();
            
            // Generate comprehensive report
            this.generateFinalReport();
            
        } catch (error) {
            console.error('💥 Phase 4.1 test runner failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    printSystemInfo() {
        console.log(`\n💻 System Information:`);
        console.log(`   Platform: ${this.systemInfo.platform}`);
        console.log(`   CPUs: ${this.systemInfo.cpus}`);
        console.log(`   Memory: ${this.systemInfo.totalMemory}GB`);
        console.log(`   Node.js: ${this.systemInfo.nodeVersion}`);
    }

    async executeAllTests() {
        for (let i = 0; i < this.phase41Tests.length; i++) {
            const test = this.phase41Tests[i];
            console.log(`\n📦 [${i + 1}/${this.phase41Tests.length}] Executing: ${test.name}`);
            console.log(`📄 Description: ${test.description}`);
            console.log(`⏱️  Expected Duration: ~${Math.round(test.expectedDuration / 1000)} seconds`);
            console.log(`🔥 Criticality: ${test.criticalityLevel.toUpperCase()}`);
            console.log('-'.repeat(50));
            
            const result = await this.executeTest(test);
            this.testResults.push(result);
            
            // Print immediate result
            this.printTestResult(result, i + 1);
            
            // Brief pause between tests
            if (i < this.phase41Tests.length - 1) {
                console.log('\n⏸️  Brief pause before next test...');
                await this.delay(2000);
            }
        }
    }

    async executeTest(testConfig) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        const testPath = path.resolve(__dirname, testConfig.file);
        
        try {
            console.log(`🚀 Starting ${testConfig.name}...`);
            
            const result = await this.runTestProcess(testPath, testConfig);
            const endTime = Date.now();
            const endMemory = process.memoryUsage();
            
            const duration = endTime - startTime;
            const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
            const target = this.performanceTargets[testConfig.name];
            
            return {
                name: testConfig.name,
                success: result.exitCode === 0,
                duration,
                memoryUsed,
                exitCode: result.exitCode,
                output: result.output,
                error: result.error,
                meetsPerformanceTarget: duration <= target.maxTime,
                criticalityLevel: testConfig.criticalityLevel,
                target
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                name: testConfig.name,
                success: false,
                duration,
                memoryUsed: 0,
                exitCode: 1,
                output: '',
                error: error.message,
                meetsPerformanceTarget: false,
                criticalityLevel: testConfig.criticalityLevel,
                target: this.performanceTargets[testConfig.name]
            };
        }
    }

    async runTestProcess(testPath, testConfig) {
        return new Promise((resolve, reject) => {
            const timeout = testConfig.expectedDuration * 2; // 2x expected time as timeout
            
            const process = spawn('node', [testPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout
            });
            
            let output = '';
            let error = '';
            
            process.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                // Forward output in real-time
                process.stdout.write(chunk);
            });
            
            process.stderr.on('data', (data) => {
                const chunk = data.toString();
                error += chunk;
                // Forward error output in real-time
                process.stderr.write(chunk);
            });
            
            process.on('close', (code) => {
                resolve({
                    exitCode: code,
                    output,
                    error
                });
            });
            
            process.on('error', (err) => {
                reject(new Error(`Process error: ${err.message}`));
            });
            
            // Handle timeout
            setTimeout(() => {
                if (!process.killed) {
                    process.kill('SIGTERM');
                    reject(new Error(`Test timeout after ${timeout}ms`));
                }
            }, timeout);
        });
    }

    printTestResult(result, testNumber) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        const performance = result.meetsPerformanceTarget ? '⚡ FAST' : '🐌 SLOW';
        const criticality = result.criticalityLevel === 'high' ? '🔥 HIGH' : 
                           result.criticalityLevel === 'medium' ? '⚠️  MEDIUM' : '🔵 LOW';
        
        console.log(`\n📊 Test ${testNumber} Result: ${status}`);
        console.log(`   Name: ${result.name}`);
        console.log(`   Duration: ${Math.round(result.duration / 1000)}s (target: <${Math.round(result.target.maxTime / 1000)}s) ${performance}`);
        console.log(`   Memory: ${Math.round(result.memoryUsed / 1024 / 1024)}MB`);
        console.log(`   Exit Code: ${result.exitCode}`);
        console.log(`   Criticality: ${criticality}`);
        
        if (result.error) {
            console.log(`   Error: ${result.error.substring(0, 200)}${result.error.length > 200 ? '...' : ''}`);
        }
    }

    generateFinalReport() {
        const totalDuration = Date.now() - this.startTime;
        const passedTests = this.testResults.filter(r => r.success);
        const failedTests = this.testResults.filter(r => !r.success);
        const criticalFailures = failedTests.filter(r => r.criticalityLevel === 'high');
        const performantTests = this.testResults.filter(r => r.meetsPerformanceTarget);
        
        const successRate = (passedTests.length / this.testResults.length * 100).toFixed(1);
        const performanceRate = (performantTests.length / this.testResults.length * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(70));
        console.log('📊 PHASE 4.1 FINAL TEST REPORT - REAL-WORLD WORKFLOWS');
        console.log('='.repeat(70));
        
        console.log(`\n🎯 Overall Results:`);
        console.log(`   Total Tests: ${this.testResults.length}`);
        console.log(`   Passed: ${passedTests.length} (${successRate}%)`);
        console.log(`   Failed: ${failedTests.length}`);
        console.log(`   Critical Failures: ${criticalFailures.length}`);
        console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);
        
        console.log(`\n⚡ Performance Analysis:`);
        console.log(`   Met Performance Targets: ${performantTests.length}/${this.testResults.length} (${performanceRate}%)`);
        
        this.testResults.forEach(result => {
            const targetTime = Math.round(result.target.maxTime / 1000);
            const actualTime = Math.round(result.duration / 1000);
            const performance = result.meetsPerformanceTarget ? '✅' : '❌';
            console.log(`   ${performance} ${result.name}: ${actualTime}s (target: <${targetTime}s)`);
        });
        
        console.log(`\n🧠 Memory Usage:`);
        const totalMemory = this.testResults.reduce((sum, r) => sum + r.memoryUsed, 0);
        const avgMemory = totalMemory / this.testResults.length;
        console.log(`   Total Memory Used: ${Math.round(totalMemory / 1024 / 1024)}MB`);
        console.log(`   Average per Test: ${Math.round(avgMemory / 1024 / 1024)}MB`);
        console.log(`   Peak Memory Test: ${this.findPeakMemoryTest()}`);
        
        console.log(`\n🔥 Criticality Breakdown:`);
        const highCritTests = this.testResults.filter(r => r.criticalityLevel === 'high');
        const mediumCritTests = this.testResults.filter(r => r.criticalityLevel === 'medium');
        const lowCritTests = this.testResults.filter(r => r.criticalityLevel === 'low');
        
        console.log(`   🔥 High Criticality: ${highCritTests.filter(r => r.success).length}/${highCritTests.length} passed`);
        console.log(`   ⚠️  Medium Criticality: ${mediumCritTests.filter(r => r.success).length}/${mediumCritTests.length} passed`);
        console.log(`   🔵 Low Criticality: ${lowCritTests.filter(r => r.success).length}/${lowCritTests.length} passed`);
        
        // Detailed test breakdown
        console.log(`\n📋 Detailed Test Breakdown:`);
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            const perf = result.meetsPerformanceTarget ? '⚡' : '🐌';
            console.log(`   ${index + 1}. ${status} ${perf} ${result.name} (${Math.round(result.duration / 1000)}s)`);
        });
        
        // Recommendations
        console.log(`\n💡 Recommendations:`);
        if (criticalFailures.length > 0) {
            console.log(`   🚨 URGENT: ${criticalFailures.length} critical test(s) failed - immediate attention required`);
            criticalFailures.forEach(failure => {
                console.log(`      - ${failure.name}: ${failure.error || 'Unknown error'}`);
            });
        }
        
        if (performanceRate < 75) {
            console.log(`   ⚡ PERFORMANCE: Only ${performanceRate}% of tests met performance targets`);
            const slowTests = this.testResults.filter(r => !r.meetsPerformanceTarget);
            slowTests.forEach(slow => {
                const overrun = Math.round((slow.duration - slow.target.maxTime) / 1000);
                console.log(`      - ${slow.name}: ${overrun}s over target`);
            });
        }
        
        if (avgMemory > 100 * 1024 * 1024) { // 100MB
            console.log(`   🧠 MEMORY: Average memory usage high (${Math.round(avgMemory / 1024 / 1024)}MB per test)`);
        }
        
        // Quality Gates
        console.log(`\n🎯 Quality Gates:`);
        const allCriticalPassed = criticalFailures.length === 0;
        const goodSuccessRate = parseFloat(successRate) >= 80;
        const goodPerformanceRate = parseFloat(performanceRate) >= 70;
        
        console.log(`   ✅ All Critical Tests Pass: ${allCriticalPassed ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Success Rate ≥80%: ${goodSuccessRate ? 'PASS' : 'FAIL'} (${successRate}%)`);
        console.log(`   ✅ Performance Rate ≥70%: ${goodPerformanceRate ? 'PASS' : 'FAIL'} (${performanceRate}%)`);
        
        // Final assessment
        console.log(`\n🏆 PHASE 4.1 ASSESSMENT:`);
        
        if (allCriticalPassed && goodSuccessRate && goodPerformanceRate) {
            console.log(`   🎉 EXCELLENT: All quality gates passed!`);
            console.log(`   🚀 Real-world workflows are ready for production`);
            console.log(`   📈 System demonstrates excellent E2E capabilities`);
            process.exit(0);
        } else if (allCriticalPassed && goodSuccessRate) {
            console.log(`   ✅ GOOD: Core functionality working well`);
            console.log(`   ⚡ Some performance optimizations recommended`);
            console.log(`   🎯 Real-world workflows are functional with room for improvement`);
            process.exit(0);
        } else if (allCriticalPassed) {
            console.log(`   ⚠️  NEEDS IMPROVEMENT: Critical features work but success rate low`);
            console.log(`   🔧 Several workflow issues need attention`);
            console.log(`   📋 Review failed test details above`);
            process.exit(1);
        } else {
            console.log(`   💥 CRITICAL ISSUES: Core workflow features failing`);
            console.log(`   🚨 Immediate attention required before production`);
            console.log(`   🛠️  Address critical failures listed above`);
            process.exit(1);
        }
    }

    findPeakMemoryTest() {
        const peakTest = this.testResults.reduce((peak, current) => 
            current.memoryUsed > peak.memoryUsed ? current : peak
        );
        return `${peakTest.name} (${Math.round(peakTest.memoryUsed / 1024 / 1024)}MB)`;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new Phase41TestRunner();
    runner.run().catch(error => {
        console.error('💥 Phase 4.1 test runner crashed:', error);
        process.exit(1);
    });
} 