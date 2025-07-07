/**
 * End-to-End Testing & Validation
 * 
 * Comprehensive E2E tests for production readiness:
 * - Full workflow testing using child process spawning
 * - Complete TUI startup and navigation testing
 * - Error recovery workflow validation
 * - Performance under load testing
 * - 30-second timeout limits and clean shutdown verification
 * - Flow integration validation
 * - Production environment simulation
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

describe('Flow Production Validation E2E Tests', () => {
    let testEnvironment;
    let mockFlowEndpoint;
    let performanceMonitor;
    let processManager;

    beforeAll(async () => {
        // Setup test environment
        testEnvironment = new ProductionTestEnvironment({
            tuiPath: path.join(process.cwd(), 'scripts/modules/flow/dev.js'),
            timeout: 30000,
            maxMemory: 150 * 1024 * 1024,  // 150MB
            mockFlow: true,
            enableTelemetry: true
        });

        await testEnvironment.initialize();
        
        // Setup performance monitoring
        performanceMonitor = new E2EPerformanceMonitor();
        await performanceMonitor.start();

        // Setup process management
        processManager = new ProcessManager();
    });

    afterAll(async () => {
        await testEnvironment.cleanup();
        await performanceMonitor.stop();
        await processManager.cleanup();
    });

    describe('Full Workflow Testing', () => {
        test('should complete full TUI startup sequence', async () => {
            const startupTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--no-interactive'],
                timeout: 15000
            });

            // Verify startup sequence
            expect(startupTest.events).toContainEqual({
                type: 'initialization_started',
                timestamp: expect.any(Number)
            });

            expect(startupTest.events).toContainEqual({
                type: 'flow_connected',
                status: 'connected'
            });

            expect(startupTest.events).toContainEqual({
                type: 'tui_ready',
                components: expect.arrayContaining(['MainView', 'StatusBar', 'TaskPanel'])
            });

            expect(startupTest.exitCode).toBe(0);
            expect(startupTest.duration).toBeLessThan(15000);
        });

        test('should handle complete navigation workflow', async () => {
            const navigationTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=navigation'],
                timeout: 20000
            });

            // Simulate user navigation sequence
            const navigationSequence = [
                { key: 'Tab', description: 'Navigate to task list' },
                { key: 'Enter', description: 'Select task' },
                { key: 'Escape', description: 'Return to main view' },
                { key: 'F1', description: 'Open help' },
                { key: 'Escape', description: 'Close help' },
                { key: 'q', description: 'Quit application' }
            ];

            for (const [index, action] of navigationSequence.entries()) {
                const stepResult = await testEnvironment.simulateKeyPress(
                    navigationTest.process, 
                    action.key,
                    { timeout: 2000, expectResponse: true }
                );

                expect(stepResult.success).toBe(true);
                expect(stepResult.responseTime).toBeLessThan(100);
            }

            expect(navigationTest.exitCode).toBe(0);
        });

        test('should execute complete task workflow', async () => {
            const taskWorkflowTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=task-workflow'],
                timeout: 25000
            });

            // Verify task workflow components
            const workflowEvents = taskWorkflowTest.events.filter(e => 
                e.type.startsWith('task_') || e.type.startsWith('workflow_')
            );

            expect(workflowEvents).toContainEqual({
                type: 'task_list_loaded',
                count: expect.any(Number)
            });

            expect(workflowEvents).toContainEqual({
                type: 'task_selection_active',
                component: 'TaskSelector'
            });

            expect(workflowEvents).toContainEqual({
                type: 'workflow_execution_started',
                tasks: expect.any(Array)
            });

            expect(workflowEvents).toContainEqual({
                type: 'workflow_execution_completed',
                success: true,
                duration: expect.any(Number)
            });
        });

        test('should handle complex multi-component interactions', async () => {
            const interactionTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=complex-interactions'],
                timeout: 30000
            });

            // Test simultaneous component interactions
            const interactions = [
                { component: 'TaskPanel', action: 'scroll', data: { direction: 'down', amount: 5 } },
                { component: 'StatusBar', action: 'update', data: { message: 'Processing...' } },
                { component: 'MonitoringDashboard', action: 'refresh', data: { metrics: true } },
                { component: 'NotificationCenter', action: 'show', data: { type: 'info', message: 'Test' } }
            ];

            const results = await Promise.all(
                interactions.map(interaction => 
                    testEnvironment.simulateComponentInteraction(
                        interactionTest.process,
                        interaction
                    )
                )
            );

            expect(results.every(r => r.success)).toBe(true);
            expect(Math.max(...results.map(r => r.responseTime))).toBeLessThan(50);
        });
    });

    describe('Error Recovery Workflow Validation', () => {
        test('should recover from component crashes', async () => {
            const crashRecoveryTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=crash-recovery'],
                timeout: 20000
            });

            // Simulate component crash
            await testEnvironment.simulateComponentCrash(crashRecoveryTest.process, 'TaskPanel');

            // Verify recovery process
            const recoveryEvents = crashRecoveryTest.events.filter(e => 
                e.type.includes('error') || e.type.includes('recovery')
            );

            expect(recoveryEvents).toContainEqual({
                type: 'component_error_detected',
                component: 'TaskPanel',
                error: expect.any(String)
            });

            expect(recoveryEvents).toContainEqual({
                type: 'error_recovery_initiated',
                strategy: expect.any(String),
                component: 'TaskPanel'
            });

            expect(recoveryEvents).toContainEqual({
                type: 'component_recovery_successful',
                component: 'TaskPanel',
                recoveryTime: expect.any(Number)
            });

            // Verify application continues functioning
            const postRecoveryHealth = await testEnvironment.checkApplicationHealth(
                crashRecoveryTest.process
            );
            expect(postRecoveryHealth.status).toBe('healthy');
        });

        test('should handle memory pressure gracefully', async () => {
            const memoryPressureTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=memory-pressure'],
                timeout: 25000
            });

            // Simulate memory pressure
            await testEnvironment.simulateMemoryPressure(memoryPressureTest.process, {
                targetUsage: 120 * 1024 * 1024,  // 120MB
                duration: 10000                  // 10 seconds
            });

            const memoryEvents = memoryPressureTest.events.filter(e => 
                e.type.includes('memory')
            );

            expect(memoryEvents).toContainEqual({
                type: 'memory_pressure_detected',
                usage: expect.any(Number),
                threshold: expect.any(Number)
            });

            expect(memoryEvents).toContainEqual({
                type: 'memory_cleanup_initiated',
                strategy: expect.any(String)
            });

            expect(memoryEvents).toContainEqual({
                type: 'memory_pressure_resolved',
                newUsage: expect.any(Number),
                cleanupTime: expect.any(Number)
            });
        });

        test('should recover from Flow connection failures', async () => {
            const connectionFailureTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=flow-failure'],
                timeout: 20000
            });

            // Simulate Flow connection failure
            await testEnvironment.simulateFlowFailure(connectionFailureTest.process, {
                type: 'connection_lost',
                duration: 5000
            });

            const connectionEvents = connectionFailureTest.events.filter(e => 
                e.type.includes('flow') || e.type.includes('connection')
            );

            expect(connectionEvents).toContainEqual({
                type: 'flow_connection_lost',
                reason: expect.any(String)
            });

            expect(connectionEvents).toContainEqual({
                type: 'flow_reconnection_attempted',
                attempt: expect.any(Number)
            });

            expect(connectionEvents).toContainEqual({
                type: 'flow_connection_restored',
                downtime: expect.any(Number)
            });
        });

        test('should handle multiple simultaneous errors', async () => {
            const multiErrorTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=multi-error'],
                timeout: 30000
            });

            // Simulate multiple errors simultaneously
            const errorSimulations = [
                testEnvironment.simulateComponentCrash(multiErrorTest.process, 'StatusBar'),
                testEnvironment.simulateMemoryPressure(multiErrorTest.process, { targetUsage: 140 * 1024 * 1024 }),
                testEnvironment.simulateFlowFailure(multiErrorTest.process, { type: 'timeout' })
            ];

            await Promise.all(errorSimulations);

            // Verify application handles multiple errors gracefully
            const finalHealth = await testEnvironment.checkApplicationHealth(multiErrorTest.process);
            expect(['healthy', 'warning']).toContain(finalHealth.status);
            expect(finalHealth.recoveredErrors).toBeGreaterThan(0);
        });
    });

    describe('Performance Under Load Testing', () => {
        test('should maintain performance with rapid navigation', async () => {
            const rapidNavigationTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=rapid-navigation'],
                timeout: 25000
            });

            const navigationCommands = Array.from({ length: 100 }, (_, i) => ({
                key: i % 2 === 0 ? 'Tab' : 'Shift+Tab',
                delay: 50  // 50ms between commands
            }));

            const startTime = Date.now();
            const results = [];

            for (const command of navigationCommands) {
                const result = await testEnvironment.simulateKeyPress(
                    rapidNavigationTest.process,
                    command.key,
                    { timeout: 100 }
                );
                results.push(result);
                
                if (command.delay) {
                    await new Promise(resolve => setTimeout(resolve, command.delay));
                }
            }

            const totalTime = Date.now() - startTime;
            const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

            expect(results.every(r => r.success)).toBe(true);
            expect(avgResponseTime).toBeLessThan(16); // Maintain 60fps
            expect(totalTime).toBeLessThan(15000); // Complete within 15s
        });

        test('should handle high-frequency updates', async () => {
            const highFrequencyTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=high-frequency-updates'],
                timeout: 20000
            });

            // Simulate high-frequency status updates
            const updateInterval = 100; // 100ms
            const updateDuration = 10000; // 10 seconds
            const expectedUpdates = updateDuration / updateInterval;

            const updateResults = await testEnvironment.simulateHighFrequencyUpdates(
                highFrequencyTest.process,
                {
                    interval: updateInterval,
                    duration: updateDuration,
                    component: 'StatusBar'
                }
            );

            expect(updateResults.totalUpdates).toBeGreaterThan(expectedUpdates * 0.9); // Allow 10% variance
            expect(updateResults.avgUpdateTime).toBeLessThan(16); // Under 16ms per update
            expect(updateResults.droppedUpdates).toBeLessThan(expectedUpdates * 0.05); // Less than 5% dropped
        });

        test('should handle concurrent user sessions', async () => {
            const sessionCount = 5;
            const sessionDuration = 15000; // 15 seconds

            const sessionPromises = Array.from({ length: sessionCount }, (_, i) =>
                testEnvironment.spawnTUI({
                    args: ['--mode=test', '--scenario=concurrent-session', `--session-id=${i}`],
                    timeout: sessionDuration + 5000
                })
            );

            const sessionResults = await Promise.all(sessionPromises);

            // Verify all sessions completed successfully
            expect(sessionResults.every(r => r.exitCode === 0)).toBe(true);
            
            // Check resource usage didn't exceed limits
            const totalMemoryUsage = sessionResults.reduce((sum, r) => sum + r.peakMemoryUsage, 0);
            expect(totalMemoryUsage).toBeLessThan(sessionCount * 50 * 1024 * 1024); // 50MB per session max
        });

        test('should handle complex data processing under load', async () => {
            const dataProcessingTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=complex-data-processing'],
                timeout: 30000
            });

            // Simulate processing large datasets
            const dataSet = {
                tasks: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    title: `Task ${i}`,
                    complexity: Math.floor(Math.random() * 10) + 1,
                    dependencies: Array.from({ length: Math.floor(Math.random() * 5) }, () => 
                        Math.floor(Math.random() * i)
                    )
                }))
            };

            const processingResult = await testEnvironment.simulateDataProcessing(
                dataProcessingTest.process,
                dataSet
            );

            expect(processingResult.success).toBe(true);
            expect(processingResult.processingTime).toBeLessThan(5000); // Under 5 seconds
            expect(processingResult.memoryEfficient).toBe(true);
        });
    });

    describe('Timeout and Shutdown Validation', () => {
        test('should respect 30-second timeout limits', async () => {
            const timeoutTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=timeout-test'],
                timeout: 30000
            });

            // Simulate long-running operation
            await testEnvironment.simulateLongRunningOperation(timeoutTest.process, {
                operation: 'complex_computation',
                expectedDuration: 35000  // 35 seconds - should timeout
            });

            expect(timeoutTest.timedOut).toBe(true);
            expect(timeoutTest.duration).toBeLessThanOrEqual(30000);
        });

        test('should perform clean shutdown on SIGTERM', async () => {
            const shutdownTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=shutdown-test'],
                timeout: 15000
            });

            // Wait for application to be fully initialized
            await testEnvironment.waitForEvent(shutdownTest.process, 'tui_ready', 10000);

            // Send SIGTERM
            const shutdownStart = Date.now();
            shutdownTest.process.kill('SIGTERM');
            
            await testEnvironment.waitForProcessExit(shutdownTest.process, 10000);
            const shutdownDuration = Date.now() - shutdownStart;

            expect(shutdownTest.exitCode).toBe(0);
            expect(shutdownDuration).toBeLessThan(5000); // Should shutdown within 5 seconds

            // Verify clean shutdown events
            expect(shutdownTest.events).toContainEqual({
                type: 'shutdown_initiated',
                signal: 'SIGTERM'
            });

            expect(shutdownTest.events).toContainEqual({
                type: 'cleanup_completed',
                components: expect.any(Array)
            });
        });

        test('should handle graceful shutdown during operations', async () => {
            const operationShutdownTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=operation-shutdown'],
                timeout: 20000
            });

            // Start a long-running operation
            await testEnvironment.simulateLongRunningOperation(
                operationShutdownTest.process,
                { operation: 'data_processing', expectedDuration: 10000 }
            );

            // Shutdown during operation
            setTimeout(() => {
                operationShutdownTest.process.kill('SIGTERM');
            }, 3000);

            await testEnvironment.waitForProcessExit(operationShutdownTest.process, 15000);

            expect(operationShutdownTest.exitCode).toBe(0);
            expect(operationShutdownTest.events).toContainEqual({
                type: 'operation_interrupted',
                reason: 'shutdown_requested'
            });
        });

        test('should handle emergency shutdown on resource exhaustion', async () => {
            const emergencyShutdownTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=emergency-shutdown'],
                timeout: 25000
            });

            // Simulate resource exhaustion
            await testEnvironment.simulateResourceExhaustion(emergencyShutdownTest.process, {
                type: 'memory',
                threshold: 200 * 1024 * 1024  // 200MB - above limit
            });

            // Should trigger emergency shutdown
            expect(emergencyShutdownTest.events).toContainEqual({
                type: 'emergency_shutdown_triggered',
                reason: 'resource_exhaustion'
            });

            expect(emergencyShutdownTest.exitCode).toBeGreaterThan(0); // Non-zero exit for emergency
        });
    });

    describe('VibeKit Integration Validation', () => {
        test('should maintain VibeKit connection throughout session', async () => {
            const vibeKitTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=vibekit-integration'],
                timeout: 20000
            });

            // Monitor VibeKit connection events
            const vibeKitEvents = vibeKitTest.events.filter(e => 
                e.type.includes('vibekit')
            );

            expect(vibeKitEvents).toContainEqual({
                type: 'vibekit_connection_established',
                endpoint: expect.any(String)
            });

            expect(vibeKitEvents).toContainEqual({
                type: 'vibekit_telemetry_active',
                samplingRate: expect.any(Number)
            });

            // No connection lost events (unless intentionally tested)
            const connectionLostEvents = vibeKitEvents.filter(e => 
                e.type === 'vibekit_connection_lost'
            );
            expect(connectionLostEvents).toHaveLength(0);
        });

        test('should export telemetry data to VibeKit', async () => {
            const telemetryTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=telemetry-export'],
                timeout: 15000
            });

            // Generate telemetry data
            await testEnvironment.generateTelemetryData(telemetryTest.process, {
                events: 50,
                metrics: 25,
                traces: 10
            });

            const telemetryEvents = telemetryTest.events.filter(e => 
                e.type.includes('telemetry')
            );

            expect(telemetryEvents).toContainEqual({
                type: 'telemetry_batch_exported',
                destination: 'vibekit',
                count: expect.any(Number)
            });

            expect(telemetryEvents).toContainEqual({
                type: 'telemetry_export_successful',
                dataSize: expect.any(Number)
            });
        });

        test('should handle VibeKit sandbox monitoring', async () => {
            const sandboxTest = await testEnvironment.spawnTUI({
                args: ['--mode=test', '--scenario=sandbox-monitoring'],
                timeout: 25000
            });

            // Simulate sandbox operations
            await testEnvironment.simulateSandboxOperations(sandboxTest.process, {
                providers: ['e2b', 'modal', 'fly'],
                operations: ['execute', 'monitor', 'cleanup']
            });

            const sandboxEvents = sandboxTest.events.filter(e => 
                e.type.includes('sandbox')
            );

            expect(sandboxEvents.length).toBeGreaterThan(0);
            expect(sandboxEvents).toContainEqual({
                type: 'sandbox_monitoring_active',
                providers: expect.arrayContaining(['e2b', 'modal', 'fly'])
            });
        });
    });

    describe('Production Environment Simulation', () => {
        test('should perform under production load characteristics', async () => {
            const productionTest = await testEnvironment.spawnTUI({
                args: ['--mode=production', '--scenario=load-simulation'],
                timeout: 30000,
                env: {
                    NODE_ENV: 'production',
                    VIBEKIT_ENABLED: 'true',
                    TELEMETRY_SAMPLING_RATE: '0.1'
                }
            });

            // Simulate production-like workload
            const workloadResults = await testEnvironment.simulateProductionWorkload(
                productionTest.process,
                {
                    duration: 20000,
                    userSessions: 3,
                    operationsPerSession: 50,
                    errorRate: 0.02  // 2% error rate
                }
            );

            expect(workloadResults.completionRate).toBeGreaterThan(0.95); // 95% completion
            expect(workloadResults.avgResponseTime).toBeLessThan(50); // Under 50ms
            expect(workloadResults.errorRate).toBeLessThan(0.05); // Under 5% errors
        });

        test('should handle production configuration correctly', async () => {
            const configTest = await testEnvironment.spawnTUI({
                args: ['--mode=production', '--validate-config'],
                timeout: 10000,
                env: {
                    NODE_ENV: 'production',
                    MEMORY_THRESHOLD: '150MB',
                    CLEANUP_INTERVAL: '15s',
                    TELEMETRY_FLUSH_INTERVAL: '30s'
                }
            });

            expect(configTest.events).toContainEqual({
                type: 'production_config_validated',
                memoryThreshold: 150 * 1024 * 1024,
                cleanupInterval: 15000,
                telemetryFlushInterval: 30000
            });
        });

        test('should maintain security standards in production mode', async () => {
            const securityTest = await testEnvironment.spawnTUI({
                args: ['--mode=production', '--security-audit'],
                timeout: 15000
            });

            const securityEvents = securityTest.events.filter(e => 
                e.type.includes('security')
            );

            expect(securityEvents).toContainEqual({
                type: 'security_audit_passed',
                checks: expect.arrayContaining([
                    'input_sanitization',
                    'api_key_protection',
                    'audit_logging'
                ])
            });
        });
    });
});

// Production Test Environment Implementation
class ProductionTestEnvironment extends EventEmitter {
    constructor(options = {}) {
        super();
        this.tuiPath = options.tuiPath;
        this.timeout = options.timeout || 30000;
        this.maxMemory = options.maxMemory;
        this.mockVibeKit = options.mockVibeKit;
        this.enableTelemetry = options.enableTelemetry;
        
        this.activeProcesses = new Set();
        this.mockEndpoints = new Map();
    }

    async initialize() {
        if (this.mockVibeKit) {
            await this.setupMockVibeKitEndpoint();
        }
        
        if (this.enableTelemetry) {
            await this.setupMockTelemetryEndpoint();
        }
    }

    async setupMockVibeKitEndpoint() {
        // Mock VibeKit endpoint for testing
        this.mockEndpoints.set('vibekit', {
            url: 'http://localhost:9999/vibekit',
            responses: {
                '/health': { status: 'healthy' },
                '/telemetry': { received: true },
                '/sandbox': { providers: ['e2b', 'modal', 'fly'] }
            }
        });
    }

    async setupMockTelemetryEndpoint() {
        this.mockEndpoints.set('telemetry', {
            url: 'http://localhost:9998/telemetry',
            responses: {
                '/export': { success: true }
            }
        });
    }

    async spawnTUI(options = {}) {
        const args = options.args || [];
        const timeout = options.timeout || this.timeout;
        const env = { ...process.env, ...options.env };

        return new Promise((resolve, reject) => {
            const childProcess = spawn('node', [this.tuiPath, ...args], {
                env,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const testResult = {
                process: childProcess,
                events: [],
                stdout: '',
                stderr: '',
                exitCode: null,
                duration: 0,
                timedOut: false,
                peakMemoryUsage: 0
            };

            const startTime = Date.now();
            let timeoutHandle;

            // Setup timeout
            timeoutHandle = setTimeout(() => {
                testResult.timedOut = true;
                testResult.duration = Date.now() - startTime;
                childProcess.kill('SIGKILL');
                resolve(testResult);
            }, timeout);

            // Capture stdout
            childProcess.stdout.on('data', (data) => {
                testResult.stdout += data.toString();
                this.parseEventsFromOutput(data.toString(), testResult.events);
            });

            // Capture stderr
            childProcess.stderr.on('data', (data) => {
                testResult.stderr += data.toString();
            });

            // Handle process exit
            childProcess.on('exit', (code) => {
                clearTimeout(timeoutHandle);
                testResult.exitCode = code;
                testResult.duration = Date.now() - startTime;
                this.activeProcesses.delete(childProcess);
                resolve(testResult);
            });

            // Track process
            this.activeProcesses.add(childProcess);
        });
    }

    parseEventsFromOutput(output, events) {
        const lines = output.split('\n');
        for (const line of lines) {
            try {
                if (line.trim().startsWith('{')) {
                    const event = JSON.parse(line.trim());
                    if (event.type) {
                        events.push(event);
                    }
                }
            } catch (e) {
                // Ignore non-JSON lines
            }
        }
    }

    async simulateKeyPress(process, key, options = {}) {
        const timeout = options.timeout || 1000;
        
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            // Send key to process
            process.stdin.write(key);
            
            const timeoutHandle = setTimeout(() => {
                resolve({
                    success: false,
                    responseTime: Date.now() - startTime
                });
            }, timeout);

            // Wait for response or timeout
            const dataHandler = (data) => {
                clearTimeout(timeoutHandle);
                process.stdout.removeListener('data', dataHandler);
                resolve({
                    success: true,
                    responseTime: Date.now() - startTime
                });
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async simulateComponentInteraction(process, interaction) {
        const command = JSON.stringify({
            type: 'component_interaction',
            ...interaction
        }) + '\n';

        const startTime = Date.now();
        process.stdin.write(command);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    success: false,
                    responseTime: Date.now() - startTime
                });
            }, 2000);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes('interaction_complete')) {
                    clearTimeout(timeout);
                    process.stdout.removeListener('data', dataHandler);
                    resolve({
                        success: true,
                        responseTime: Date.now() - startTime
                    });
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async simulateComponentCrash(process, componentName) {
        const command = JSON.stringify({
            type: 'simulate_crash',
            component: componentName
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateMemoryPressure(process, options) {
        const command = JSON.stringify({
            type: 'simulate_memory_pressure',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateVibeKitFailure(process, options) {
        const command = JSON.stringify({
            type: 'simulate_vibekit_failure',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateHighFrequencyUpdates(process, options) {
        const command = JSON.stringify({
            type: 'simulate_high_frequency_updates',
            ...options
        }) + '\n';

        process.stdin.write(command);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    totalUpdates: 0,
                    avgUpdateTime: 0,
                    droppedUpdates: 0
                });
            }, options.duration + 2000);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes('high_frequency_test_complete')) {
                    clearTimeout(timeout);
                    process.stdout.removeListener('data', dataHandler);
                    
                    try {
                        const result = JSON.parse(output);
                        resolve(result.testResults);
                    } catch (e) {
                        resolve({
                            totalUpdates: 0,
                            avgUpdateTime: 0,
                            droppedUpdates: 0
                        });
                    }
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async simulateDataProcessing(process, dataSet) {
        const command = JSON.stringify({
            type: 'simulate_data_processing',
            dataSet
        }) + '\n';

        const startTime = Date.now();
        process.stdin.write(command);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    success: false,
                    processingTime: Date.now() - startTime,
                    memoryEfficient: false
                });
            }, 10000);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes('data_processing_complete')) {
                    clearTimeout(timeout);
                    process.stdout.removeListener('data', dataHandler);
                    
                    try {
                        const result = JSON.parse(output);
                        resolve({
                            success: true,
                            processingTime: Date.now() - startTime,
                            memoryEfficient: result.memoryEfficient
                        });
                    } catch (e) {
                        resolve({
                            success: false,
                            processingTime: Date.now() - startTime,
                            memoryEfficient: false
                        });
                    }
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async simulateLongRunningOperation(process, options) {
        const command = JSON.stringify({
            type: 'simulate_long_running_operation',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateResourceExhaustion(process, options) {
        const command = JSON.stringify({
            type: 'simulate_resource_exhaustion',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateSandboxOperations(process, options) {
        const command = JSON.stringify({
            type: 'simulate_sandbox_operations',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async simulateProductionWorkload(process, options) {
        const command = JSON.stringify({
            type: 'simulate_production_workload',
            ...options
        }) + '\n';

        const startTime = Date.now();
        process.stdin.write(command);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    completionRate: 0,
                    avgResponseTime: 0,
                    errorRate: 1
                });
            }, options.duration + 5000);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes('production_workload_complete')) {
                    clearTimeout(timeout);
                    process.stdout.removeListener('data', dataHandler);
                    
                    try {
                        const result = JSON.parse(output);
                        resolve(result.workloadResults);
                    } catch (e) {
                        resolve({
                            completionRate: 0,
                            avgResponseTime: 0,
                            errorRate: 1
                        });
                    }
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async generateTelemetryData(process, options) {
        const command = JSON.stringify({
            type: 'generate_telemetry_data',
            ...options
        }) + '\n';

        process.stdin.write(command);
    }

    async checkApplicationHealth(process) {
        const command = JSON.stringify({
            type: 'health_check'
        }) + '\n';

        process.stdin.write(command);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ status: 'unknown', recoveredErrors: 0 });
            }, 5000);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes('health_check_result')) {
                    clearTimeout(timeout);
                    process.stdout.removeListener('data', dataHandler);
                    
                    try {
                        const result = JSON.parse(output);
                        resolve(result.health);
                    } catch (e) {
                        resolve({ status: 'unknown', recoveredErrors: 0 });
                    }
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async waitForEvent(process, eventType, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                process.stdout.removeListener('data', dataHandler);
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeout);

            const dataHandler = (data) => {
                const output = data.toString();
                if (output.includes(eventType)) {
                    clearTimeout(timeoutHandle);
                    process.stdout.removeListener('data', dataHandler);
                    resolve();
                }
            };

            process.stdout.on('data', dataHandler);
        });
    }

    async waitForProcessExit(process, timeout = 10000) {
        return new Promise((resolve) => {
            const timeoutHandle = setTimeout(() => {
                resolve();
            }, timeout);

            process.on('exit', () => {
                clearTimeout(timeoutHandle);
                resolve();
            });
        });
    }

    async cleanup() {
        // Kill all active processes
        for (const process of this.activeProcesses) {
            try {
                process.kill('SIGTERM');
            } catch (e) {
                // Process might already be dead
            }
        }

        // Clear process set
        this.activeProcesses.clear();

        // Cleanup mock endpoints
        this.mockEndpoints.clear();
    }
}

// E2E Performance Monitor
class E2EPerformanceMonitor {
    constructor() {
        this.metrics = {
            testDurations: [],
            memoryUsage: [],
            responsesTimes: []
        };
        this.isRunning = false;
    }

    async start() {
        this.isRunning = true;
        this.startTime = Date.now();
    }

    async stop() {
        this.isRunning = false;
        this.endTime = Date.now();
        return this.generateReport();
    }

    generateReport() {
        return {
            totalDuration: this.endTime - this.startTime,
            metrics: this.metrics,
            summary: {
                avgTestDuration: this.metrics.testDurations.reduce((a, b) => a + b, 0) / this.metrics.testDurations.length || 0,
                peakMemoryUsage: Math.max(...this.metrics.memoryUsage) || 0,
                avgResponseTime: this.metrics.responsesTimes.reduce((a, b) => a + b, 0) / this.metrics.responsesTimes.length || 0
            }
        };
    }
}

// Process Manager
class ProcessManager {
    constructor() {
        this.processes = new Set();
    }

    async cleanup() {
        for (const process of this.processes) {
            try {
                process.kill('SIGTERM');
            } catch (e) {
                // Process might already be dead
            }
        }
        this.processes.clear();
    }
} 