#!/usr/bin/env node
/**
 * Phase 4.2 Test Runner - Cross-Platform Testing
 * 
 * Executes comprehensive cross-platform testing:
 * - Cross-platform compatibility
 * - Git integration testing
 * - Filesystem testing
 * - Resource management testing
 * 
 * @fileoverview Test runner for Phase 4.2 cross-platform testing
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Phase42TestRunner {
    constructor() {
        this.startTime = Date.now();
        this.testResults = [];
        this.phase42Tests = [
            {
                name: 'Cross-Platform Compatibility',
                file: '../e2e/cross-platform-compatibility.js',
                description: 'Windows/macOS/Linux compatibility testing',
                expectedDuration: 18000,
                criticalityLevel: 'high'
            },
            {
                name: 'Git Integration Testing',
                file: '../e2e/git-integration-testing.js',
                description: 'Git configurations and operations',
                expectedDuration: 25000,
                criticalityLevel: 'high'
            },
            {
                name: 'Filesystem Testing',
                file: '../e2e/filesystem-testing.js',
                description: 'Filesystem operations and compatibility',
                expectedDuration: 20000,
                criticalityLevel: 'high'
            },
            {
                name: 'Resource Management Testing',
                file: '../e2e/resource-management-testing.js',
                description: 'Resource constraints and monitoring',
                expectedDuration: 22000,
                criticalityLevel: 'medium'
            }
        ];
        
        this.performanceTargets = {
            'Cross-Platform Compatibility': { maxTime: 25000, minSuccessRate: 80 },
            'Git Integration Testing': { maxTime: 30000, minSuccessRate: 85 },
            'Filesystem Testing': { maxTime: 25000, minSuccessRate: 85 },
            'Resource Management Testing': { maxTime: 28000, minSuccessRate: 75 }
        };
        
        this.systemInfo = {
            platform: os.platform(),
            cpus: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
            nodeVersion: process.version,
            architecture: os.arch(),
            gitVersion: null
        };
    }

    async run() {
        try {
            console.log('🚀 Phase 4.2 - Cross-Platform Test Runner\n');
            console.log('=' .repeat(65));
            console.log('🌍  CROSS-PLATFORM COMPATIBILITY TESTING');
            console.log('=' .repeat(65));
            
            await this.detectSystemCapabilities();
            this.printSystemInfo();
            
            console.log('\n📋 Test Suite Overview:');
            this.phase42Tests.forEach((test, index) => {
                console.log(`   ${index + 1}. ${test.name}`);
                console.log(`      ${test.description}`);
                console.log(`      Expected: ~${Math.round(test.expectedDuration / 1000)}s, Criticality: ${test.criticalityLevel}`);
            });
            
            console.log(`\n🎯 Performance Targets:`);
            Object.entries(this.performanceTargets).forEach(([name, targets]) => {
                console.log(`   ${name}: <${Math.round(targets.maxTime / 1000)}s, ≥${targets.minSuccessRate}% success rate`);
            });
            
            console.log('\n' + '='.repeat(65));
            console.log('🧪 EXECUTING PHASE 4.2 TEST SUITES');
            console.log('='.repeat(65) + '\n');
            
            await this.executeAllTests();
            this.generateFinalReport();
            
        } catch (error) {
            console.error('💥 Phase 4.2 test runner failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    async detectSystemCapabilities() {
        try {
            const gitResult = await this.runCommand('git', ['--version']);
            if (gitResult.exitCode === 0) {
                this.systemInfo.gitVersion = gitResult.stdout.trim();
            }
        } catch (error) {
            this.systemInfo.gitVersion = 'Not available';
        }
    }

    printSystemInfo() {
        console.log(`\n💻 System Information:`);
        console.log(`   Platform: ${this.systemInfo.platform}`);
        console.log(`   Architecture: ${this.systemInfo.architecture}`);
        console.log(`   CPUs: ${this.systemInfo.cpus}`);
        console.log(`   Memory: ${this.systemInfo.totalMemory}GB`);
        console.log(`   Node.js: ${this.systemInfo.nodeVersion}`);
        console.log(`   Git: ${this.systemInfo.gitVersion || 'Not detected'}`);
    }

    async executeAllTests() {
        for (let i = 0; i < this.phase42Tests.length; i++) {
            const test = this.phase42Tests[i];
            console.log(`\n📦 [${i + 1}/${this.phase42Tests.length}] Executing: ${test.name}`);
            console.log(`📄 Description: ${test.description}`);
            console.log(`⏱️  Expected Duration: ~${Math.round(test.expectedDuration / 1000)} seconds`);
            console.log(`🔥 Criticality: ${test.criticalityLevel.toUpperCase()}`);
            console.log('-'.repeat(55));
            
            const result = await this.executeTest(test);
            this.testResults.push(result);
            this.printTestResult(result, i + 1);
            
            if (i < this.phase42Tests.length - 1) {
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
                target,
                platform: this.systemInfo.platform
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
                target: this.performanceTargets[testConfig.name],
                platform: this.systemInfo.platform
            };
        }
    }

    async runTestProcess(testPath, testConfig) {
        return new Promise((resolve, reject) => {
            const timeout = testConfig.expectedDuration * 2.5;
            
            const process = spawn('node', [testPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout
            });
            
            let output = '';
            let error = '';
            
            process.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                process.stdout.write(chunk);
            });
            
            process.stderr.on('data', (data) => {
                const chunk = data.toString();
                error += chunk;
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
            
            setTimeout(() => {
                if (!process.killed) {
                    process.kill('SIGTERM');
                    reject(new Error(`Test timeout after ${timeout}ms`));
                }
            }, timeout);
        });
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 10000,
                ...options
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                resolve({
                    exitCode: code,
                    stdout,
                    stderr
                });
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    printTestResult(result, testNumber) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        const performance = result.meetsPerformanceTarget ? '⚡ FAST' : '🐌 SLOW';
        const criticality = result.criticalityLevel === 'high' ? '🔥 HIGH' : 
                           result.criticalityLevel === 'medium' ? '⚠️  MEDIUM' : '🔵 LOW';
        
        console.log(`\n📊 Test ${testNumber} Result: ${status}`);
        console.log(`   Name: ${result.name}`);
        console.log(`   Platform: ${result.platform}`);
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
        
        console.log('\n' + '='.repeat(75));
        console.log('📊 PHASE 4.2 FINAL TEST REPORT - CROSS-PLATFORM TESTING');
        console.log('='.repeat(75));
        
        console.log(`\n🎯 Overall Results:`);
        console.log(`   Total Tests: ${this.testResults.length}`);
        console.log(`   Passed: ${passedTests.length} (${successRate}%)`);
        console.log(`   Failed: ${failedTests.length}`);
        console.log(`   Critical Failures: ${criticalFailures.length}`);
        console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log(`   Test Platform: ${this.systemInfo.platform} (${this.systemInfo.architecture})`);
        
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
        
        console.log(`   🔥 High Criticality: ${highCritTests.filter(r => r.success).length}/${highCritTests.length} passed`);
        console.log(`   ⚠️  Medium Criticality: ${mediumCritTests.filter(r => r.success).length}/${mediumCritTests.length} passed`);
        
        console.log(`\n🌍 Platform Compatibility Analysis:`);
        console.log(`   Test Platform: ${this.systemInfo.platform}`);
        console.log(`   Architecture: ${this.systemInfo.architecture}`);
        console.log(`   System Resources: ${this.systemInfo.cpus} CPUs, ${this.systemInfo.totalMemory}GB RAM`);
        console.log(`   Git Available: ${this.systemInfo.gitVersion !== 'Not available' ? 'Yes' : 'No'}`);
        
        this.analyzeCrossPlatformResults();
        
        console.log(`\n📋 Detailed Test Breakdown:`);
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            const perf = result.meetsPerformanceTarget ? '⚡' : '🐌';
            console.log(`   ${index + 1}. ${status} ${perf} ${result.name} (${Math.round(result.duration / 1000)}s)`);
        });
        
        console.log(`\n💡 Recommendations:`);
        if (criticalFailures.length > 0) {
            console.log(`   🚨 URGENT: ${criticalFailures.length} critical test(s) failed - immediate attention required`);
        }
        
        if (parseFloat(performanceRate) < 70) {
            console.log(`   ⚡ PERFORMANCE: Only ${performanceRate}% of tests met performance targets`);
        }
        
        console.log(`\n🎯 Quality Gates:`);
        const allCriticalPassed = criticalFailures.length === 0;
        const goodSuccessRate = parseFloat(successRate) >= 75;
        const goodPerformanceRate = parseFloat(performanceRate) >= 65;
        
        console.log(`   ✅ All Critical Tests Pass: ${allCriticalPassed ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Success Rate ≥75%: ${goodSuccessRate ? 'PASS' : 'FAIL'} (${successRate}%)`);
        console.log(`   ✅ Performance Rate ≥65%: ${goodPerformanceRate ? 'PASS' : 'FAIL'} (${performanceRate}%)`);
        
        console.log(`\n🏆 PHASE 4.2 ASSESSMENT:`);
        
        if (allCriticalPassed && goodSuccessRate && goodPerformanceRate) {
            console.log(`   🎉 EXCELLENT: All quality gates passed!`);
            console.log(`   🌍 Cross-platform compatibility verified`);
            process.exit(0);
        } else if (allCriticalPassed && goodSuccessRate) {
            console.log(`   ✅ GOOD: Core cross-platform functionality working well`);
            console.log(`   ⚡ Some performance optimizations recommended`);
            process.exit(0);
        } else {
            console.log(`   ⚠️  ISSUES DETECTED: Review failed tests above`);
            process.exit(1);
        }
    }

    analyzeCrossPlatformResults() {
        console.log(`\n🔍 Cross-Platform Analysis:`);
        
        const compatibilityTest = this.testResults.find(r => r.name === 'Cross-Platform Compatibility');
        const gitTest = this.testResults.find(r => r.name === 'Git Integration Testing');
        const filesystemTest = this.testResults.find(r => r.name === 'Filesystem Testing');
        const resourceTest = this.testResults.find(r => r.name === 'Resource Management Testing');
        
        console.log(`   🌍 Platform Compatibility: ${compatibilityTest?.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   🔀 Git Integration: ${gitTest?.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   💾 Filesystem Operations: ${filesystemTest?.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   ⚡ Resource Management: ${resourceTest?.success ? '✅ PASS' : '❌ FAIL'}`);
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

if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new Phase42TestRunner();
    runner.run().catch(error => {
        console.error('💥 Phase 4.2 test runner crashed:', error);
        process.exit(1);
    });
}
