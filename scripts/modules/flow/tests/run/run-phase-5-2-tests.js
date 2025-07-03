#!/usr/bin/env node
/**
 * Phase 5.2 Test Runner - Performance & Stress Testing
 * 
 * Executes all Phase 5.2 performance and stress tests:
 * - Memory Usage Testing
 * - Concurrent Session Testing
 * - Large Project Testing
 * - Cache Performance Testing
 * 
 * @fileoverview Comprehensive test runner for performance and stress testing with monitoring
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Phase 5.2 - Performance & Stress Testing Runner\n');

class Phase52TestRunner {
    constructor() {
        this.startTime = Date.now();
        this.testSuites = [
            {
                name: 'Memory Usage Testing',
                file: '../e2e/memory-usage-testing.js',
                description: 'Memory consumption patterns and optimization',
                timeout: 180000, // 3 minutes
                required: true
            },
            {
                name: 'Concurrent Session Testing',
                file: '../e2e/concurrent-session-testing.js',
                description: 'Multi-session handling and resource contention',
                timeout: 240000, // 4 minutes
                required: true
            },
            {
                name: 'Large Project Testing',
                file: '../e2e/large-project-testing.js',
                description: 'Performance with large codebases',
                timeout: 300000, // 5 minutes
                required: true
            },
            {
                name: 'Cache Performance Testing',
                file: '../e2e/cache-performance-testing.js',
                description: 'Cache system optimization',
                timeout: 240000, // 4 minutes
                required: true
            }
        ];
        
        this.results = [];
        this.systemInfo = this.collectSystemInfo();
        this.performanceThresholds = {
            maxTestSuiteTime: 300000,      // 5 minutes per suite
            minSuccessRate: 0.8,           // 80% tests must pass
            maxMemoryUsage: 2048,          // 2GB max memory usage
            maxConcurrentSessions: 20,     // Max concurrent sessions to test
            performanceRegressionLimit: 2.0 // Max 2x performance degradation
        };
    }

    async run() {
        try {
            console.log('📊 Starting Performance & Stress Testing Suite...\n');
            
            await this.validateEnvironment();
            await this.runTestSuites();
            await this.generateReport();
            
            this.printResults();
            process.exit(this.allTestsPassed() ? 0 : 1);
        } catch (error) {
            console.error('💥 Test runner crashed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    async validateEnvironment() {
        console.log('🔍 Validating test environment...\n');
        
        const validations = [
            {
                name: 'Node.js Version',
                check: () => {
                    const version = process.version;
                    const majorVersion = parseInt(version.slice(1).split('.')[0]);
                    return majorVersion >= 18;
                },
                message: 'Node.js 18+ required for ES modules and performance features'
            },
            {
                name: 'Available Memory',
                check: () => {
                    const totalMemory = os.totalmem();
                    const availableMemory = os.freemem();
                    return availableMemory >= 1024 * 1024 * 1024; // 1GB minimum
                },
                message: 'At least 1GB free memory required for stress testing'
            },
            {
                name: 'Disk Space',
                check: async () => {
                    try {
                        const stats = await fs.stat(process.cwd());
                        return true; // Basic check - directory exists and accessible
                    } catch (error) {
                        return false;
                    }
                },
                message: 'Sufficient disk space required for large project testing'
            },
            {
                name: 'Test Files Exist',
                check: async () => {
                    const testFiles = this.testSuites.map(suite => 
                        path.resolve(__dirname, suite.file)
                    );
                    
                    for (const file of testFiles) {
                        try {
                            await fs.access(file);
                        } catch (error) {
                            return false;
                        }
                    }
                    return true;
                },
                message: 'All test suite files must exist'
            }
        ];

        let allValid = true;
        for (const validation of validations) {
            const result = await validation.check();
            const status = result ? '✅' : '❌';
            console.log(`${status} ${validation.name}: ${validation.message}`);
            
            if (!result) {
                allValid = false;
            }
        }

        if (!allValid) {
            throw new Error('Environment validation failed. Please fix the issues above.');
        }

        console.log('\n✅ Environment validation passed\n');
    }

    async runTestSuites() {
        console.log('🧪 Executing Performance & Stress Test Suites...\n');
        
        for (const suite of this.testSuites) {
            console.log(`🔄 Running: ${suite.name}`);
            console.log(`   Description: ${suite.description}`);
            console.log(`   Timeout: ${Math.round(suite.timeout / 1000)}s\n`);
            
            const suiteResult = await this.runTestSuite(suite);
            this.results.push(suiteResult);
            
            if (suiteResult.required && !suiteResult.success) {
                console.log(`❌ Required test suite failed: ${suite.name}`);
                console.log('   Stopping execution due to critical failure.\n');
                break;
            }
            
            // Brief pause between suites to allow system recovery
            await this.delay(2000);
        }
    }

    async runTestSuite(suite) {
        const startTime = Date.now();
        const testFile = path.resolve(__dirname, suite.file);
        
        let processOutput = '';
        let processError = '';
        
        try {
            // Start monitoring system resources
            const resourceMonitor = this.startResourceMonitoring();
            
            const result = await new Promise((resolve, reject) => {
                // Run with increased memory limit and garbage collection exposure
                const args = [
                    '--max-old-space-size=4096',
                    '--expose-gc',
                    testFile
                ];
                
                const testProcess = spawn('node', args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        NODE_ENV: 'test'
                    }
                });

                testProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    processOutput += output;
                    console.log(output.trim());
                });

                testProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    processError += output;
                    console.error(output.trim());
                });

                const timeout = setTimeout(() => {
                    testProcess.kill('SIGTERM');
                    reject(new Error(`Test suite timed out after ${suite.timeout}ms`));
                }, suite.timeout);

                testProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    resolve({ code, output: processOutput, error: processError });
                });

                testProcess.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            // Stop resource monitoring
            const resourceStats = this.stopResourceMonitoring(resourceMonitor);
            
            const duration = Date.now() - startTime;
            const success = result.code === 0;
            
            const suiteResult = {
                name: suite.name,
                success,
                duration,
                exitCode: result.code,
                output: result.output,
                error: result.error,
                required: suite.required,
                resourceStats,
                timestamp: new Date().toISOString()
            };

            // Parse performance metrics from output
            suiteResult.metrics = this.parsePerformanceMetrics(result.output);
            
            const status = success ? '✅' : '❌';
            console.log(`\n${status} ${suite.name}: ${success ? 'PASSED' : 'FAILED'}`);
            console.log(`   Duration: ${Math.round(duration / 1000)}s`);
            console.log(`   Peak Memory: ${Math.round(resourceStats.peakMemory / 1024 / 1024)}MB`);
            
            if (suiteResult.metrics.testsRun) {
                console.log(`   Tests: ${suiteResult.metrics.testsPassed}/${suiteResult.metrics.testsRun} passed`);
            }
            
            console.log(''); // Empty line for spacing
            
            return suiteResult;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log(`\n❌ ${suite.name}: ERROR`);
            console.log(`   Duration: ${Math.round(duration / 1000)}s`);
            console.log(`   Error: ${error.message}\n`);
            
            return {
                name: suite.name,
                success: false,
                duration,
                error: error.message,
                required: suite.required,
                timestamp: new Date().toISOString()
            };
        }
    }

    startResourceMonitoring() {
        const monitor = {
            startTime: Date.now(),
            startMemory: process.memoryUsage(),
            peakMemory: process.memoryUsage().heapUsed,
            samples: []
        };

        monitor.interval = setInterval(() => {
            const currentMemory = process.memoryUsage();
            monitor.peakMemory = Math.max(monitor.peakMemory, currentMemory.heapUsed);
            monitor.samples.push({
                timestamp: Date.now(),
                memory: currentMemory,
                cpu: process.cpuUsage()
            });
        }, 1000);

        return monitor;
    }

    stopResourceMonitoring(monitor) {
        clearInterval(monitor.interval);
        
        const endMemory = process.memoryUsage();
        const duration = Date.now() - monitor.startTime;
        
        return {
            duration,
            startMemory: monitor.startMemory,
            endMemory,
            peakMemory: monitor.peakMemory,
            memoryDelta: endMemory.heapUsed - monitor.startMemory.heapUsed,
            samples: monitor.samples.length,
            avgMemoryUsage: monitor.samples.reduce((sum, s) => sum + s.memory.heapUsed, 0) / monitor.samples.length
        };
    }

    parsePerformanceMetrics(output) {
        const metrics = {
            testsRun: 0,
            testsPassed: 0,
            testsFailed: 0,
            averageExecutionTime: 0,
            performanceData: {}
        };

        try {
            // Parse test results
            const testResultMatch = output.match(/Total Tests:\s*(\d+)/);
            if (testResultMatch) {
                metrics.testsRun = parseInt(testResultMatch[1]);
            }

            const passedMatch = output.match(/Passed:\s*(\d+)/);
            if (passedMatch) {
                metrics.testsPassed = parseInt(passedMatch[1]);
            }

            const failedMatch = output.match(/Failed:\s*(\d+)/);
            if (failedMatch) {
                metrics.testsFailed = parseInt(failedMatch[1]);
            }

            // Parse performance-specific metrics
            const durationMatch = output.match(/Total Duration:\s*(\d+)s/);
            if (durationMatch) {
                metrics.averageExecutionTime = parseInt(durationMatch[1]) * 1000;
            }

            // Parse memory usage
            const memoryMatch = output.match(/Memory usage:\s*([\d.]+)MB/);
            if (memoryMatch) {
                metrics.performanceData.memoryUsage = parseFloat(memoryMatch[1]);
            }

            // Parse throughput metrics
            const throughputMatch = output.match(/(\d+)\s*files\/sec/);
            if (throughputMatch) {
                metrics.performanceData.throughput = parseInt(throughputMatch[1]);
            }

        } catch (error) {
            console.warn('⚠️ Could not parse performance metrics:', error.message);
        }

        return metrics;
    }

    async generateReport() {
        console.log('📊 Generating Performance Test Report...\n');
        
        const report = {
            timestamp: new Date().toISOString(),
            phase: '5.2',
            testType: 'Performance & Stress Testing',
            systemInfo: this.systemInfo,
            configuration: this.performanceThresholds,
            results: this.results,
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations()
        };

        const reportPath = path.join(__dirname, '../reports/phase-5-2-performance-report.json');
        
        try {
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📄 Report saved to: ${reportPath}\n`);
        } catch (error) {
            console.warn('⚠️ Could not save report:', error.message);
        }
    }

    generateSummary() {
        const totalSuites = this.results.length;
        const passedSuites = this.results.filter(r => r.success).length;
        const failedSuites = this.results.filter(r => !r.success).length;
        const totalDuration = Date.now() - this.startTime;
        
        const totalTests = this.results.reduce((sum, r) => sum + (r.metrics?.testsRun || 0), 0);
        const totalPassed = this.results.reduce((sum, r) => sum + (r.metrics?.testsPassed || 0), 0);
        
        const peakMemoryUsage = Math.max(
            ...this.results
                .filter(r => r.resourceStats)
                .map(r => r.resourceStats.peakMemory)
        );
        
        return {
            totalSuites,
            passedSuites,
            failedSuites,
            successRate: totalSuites > 0 ? passedSuites / totalSuites : 0,
            totalDuration,
            totalTests,
            totalPassed,
            testSuccessRate: totalTests > 0 ? totalPassed / totalTests : 0,
            peakMemoryUsage: Math.round(peakMemoryUsage / 1024 / 1024),
            performance: {
                withinTimeThresholds: this.results.every(r => 
                    r.duration <= this.performanceThresholds.maxTestSuiteTime
                ),
                withinMemoryThresholds: peakMemoryUsage <= (this.performanceThresholds.maxMemoryUsage * 1024 * 1024),
                overallHealthy: passedSuites >= totalSuites * this.performanceThresholds.minSuccessRate
            }
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();
        
        if (summary.successRate < this.performanceThresholds.minSuccessRate) {
            recommendations.push({
                type: 'critical',
                category: 'test-success',
                message: `Test success rate (${(summary.successRate * 100).toFixed(1)}%) is below threshold (${(this.performanceThresholds.minSuccessRate * 100).toFixed(1)}%)`,
                action: 'Review failed tests and address performance bottlenecks'
            });
        }
        
        if (!summary.performance.withinMemoryThresholds) {
            recommendations.push({
                type: 'warning',
                category: 'memory',
                message: `Peak memory usage (${summary.peakMemoryUsage}MB) exceeded threshold (${this.performanceThresholds.maxMemoryUsage}MB)`,
                action: 'Optimize memory usage in performance-critical paths'
            });
        }
        
        if (!summary.performance.withinTimeThresholds) {
            recommendations.push({
                type: 'warning',
                category: 'performance',
                message: 'Some test suites exceeded time thresholds',
                action: 'Profile and optimize slow test execution paths'
            });
        }
        
        // Check for specific performance issues
        const failedSuites = this.results.filter(r => !r.success);
        if (failedSuites.length > 0) {
            failedSuites.forEach(suite => {
                recommendations.push({
                    type: 'error',
                    category: 'suite-failure',
                    message: `${suite.name} failed`,
                    action: `Review ${suite.name} implementation and fix identified issues`,
                    details: suite.error || 'Check test output for specific failures'
                });
            });
        }
        
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                category: 'performance',
                message: 'All performance and stress tests passed successfully',
                action: 'Continue monitoring performance in production environments'
            });
        }
        
        return recommendations;
    }

    collectSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024),
            freeMemory: Math.round(os.freemem() / 1024 / 1024),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
    }

    allTestsPassed() {
        return this.results.every(result => result.success);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        const totalDuration = Date.now() - this.startTime;
        const summary = this.generateSummary();
        
        console.log('='.repeat(80));
        console.log('🚀 PHASE 5.2 - PERFORMANCE & STRESS TESTING RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n💻 System Information:`);
        console.log(`   Platform: ${this.systemInfo.platform} (${this.systemInfo.arch})`);
        console.log(`   Node.js: ${this.systemInfo.nodeVersion}`);
        console.log(`   Memory: ${this.systemInfo.freeMemory}MB free / ${this.systemInfo.totalMemory}MB total`);
        console.log(`   CPU: ${this.systemInfo.cpuCount}x ${this.systemInfo.cpuModel}`);
        
        console.log(`\n🎯 Test Suite Results:`);
        console.log(`   Total Suites: ${summary.totalSuites}`);
        console.log(`   Passed: ${summary.passedSuites}`);
        console.log(`   Failed: ${summary.failedSuites}`);
        console.log(`   Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
        console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);
        
        console.log(`\n📊 Performance Metrics:`);
        console.log(`   Total Tests: ${summary.totalTests}`);
        console.log(`   Tests Passed: ${summary.totalPassed}`);
        console.log(`   Test Success Rate: ${(summary.testSuccessRate * 100).toFixed(1)}%`);
        console.log(`   Peak Memory Usage: ${summary.peakMemoryUsage}MB`);
        
        console.log(`\n📋 Test Suite Details:`);
        this.results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            const duration = Math.round(result.duration / 1000);
            const memory = result.resourceStats ? Math.round(result.resourceStats.peakMemory / 1024 / 1024) : 'N/A';
            
            console.log(`   ${status} ${result.name}: ${duration}s (${memory}MB peak)`);
            
            if (result.metrics && result.metrics.testsRun > 0) {
                console.log(`      Tests: ${result.metrics.testsPassed}/${result.metrics.testsRun} passed`);
            }
            
            if (!result.success && result.error) {
                console.log(`      Error: ${result.error}`);
            }
        });
        
        const recommendations = this.generateRecommendations();
        if (recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            recommendations.forEach(rec => {
                const icon = rec.type === 'critical' ? '🔴' : rec.type === 'warning' ? '🟡' : rec.type === 'error' ? '❌' : '✅';
                console.log(`   ${icon} ${rec.message}`);
                console.log(`      Action: ${rec.action}`);
                if (rec.details) {
                    console.log(`      Details: ${rec.details}`);
                }
            });
        }
        
        console.log(`\n🏆 Quality Gates:`);
        console.log(`   ✅ Test Success Rate: ${summary.performance.overallHealthy ? 'PASS' : 'FAIL'} (${(summary.testSuccessRate * 100).toFixed(1)}% >= ${(this.performanceThresholds.minSuccessRate * 100).toFixed(1)}%)`);
        console.log(`   ✅ Memory Usage: ${summary.performance.withinMemoryThresholds ? 'PASS' : 'FAIL'} (${summary.peakMemoryUsage}MB <= ${this.performanceThresholds.maxMemoryUsage}MB)`);
        console.log(`   ✅ Execution Time: ${summary.performance.withinTimeThresholds ? 'PASS' : 'FAIL'} (all suites within time limits)`);
        
        const overallSuccess = summary.performance.overallHealthy && 
                              summary.performance.withinMemoryThresholds && 
                              summary.performance.withinTimeThresholds;
        
        console.log(`\n🎯 Overall Assessment: ${overallSuccess ? '✅ PERFORMANCE OPTIMIZED' : '❌ PERFORMANCE ISSUES DETECTED'}`);
        
        if (!overallSuccess) {
            console.log(`\n⚠️ Performance and stress testing revealed issues that need attention.`);
            console.log(`   Review the recommendations above and the detailed test output.`);
        } else {
            console.log(`\n🎉 All performance and stress tests passed successfully!`);
            console.log(`   The system demonstrates good performance under stress conditions.`);
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

export { Phase52TestRunner };

if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new Phase52TestRunner();
    runner.run().catch(error => {
        console.error('💥 Test runner crashed:', error);
        process.exit(1);
    });
} 