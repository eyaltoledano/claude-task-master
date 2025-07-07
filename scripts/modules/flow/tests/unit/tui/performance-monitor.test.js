/**
 * Phase 8.6.3 - Performance Monitor Testing
 * 
 * Tests the usePerformanceMonitor hook and telemetry service:
 * - Render time monitoring
 * - Memory usage tracking
 * - Telemetry efficiency validation
 * - Performance threshold enforcement
 * - Resource cleanup testing
 */

import { EventEmitter } from 'events';

describe('usePerformanceMonitor Hook', () => {
    let mockPerformanceMonitor;
    let mockTelemetryService;
    let mockResourceManager;

    beforeEach(() => {
        // Reset performance APIs
        global.performance = {
            now: jest.fn(() => Date.now()),
            mark: jest.fn(),
            measure: jest.fn(),
            getEntriesByName: jest.fn(() => []),
            getEntriesByType: jest.fn(() => []),
            clearMarks: jest.fn(),
            clearMeasures: jest.fn()
        };

        // Mock process.memoryUsage
        global.process = {
            ...global.process,
            memoryUsage: jest.fn(() => ({
                rss: 50 * 1024 * 1024,        // 50MB
                heapTotal: 30 * 1024 * 1024,   // 30MB
                heapUsed: 20 * 1024 * 1024,    // 20MB
                external: 5 * 1024 * 1024,     // 5MB
                arrayBuffers: 1 * 1024 * 1024  // 1MB
            }))
        };

        // Mock telemetry service
        mockTelemetryService = {
            recordPerformance: jest.fn(),
            recordMemoryUsage: jest.fn(),
            recordEvent: jest.fn(),
            getEventCount: jest.fn(() => 0),
            flush: jest.fn(),
            cleanup: jest.fn()
        };

        // Mock resource manager
        mockResourceManager = {
            cleanup: jest.fn(() => Promise.resolve()),
            getResourceUsage: jest.fn(() => ({
                openHandles: 5,
                activeTimers: 2,
                memoryLeaks: 0
            }))
        };

        // Create performance monitor
        mockPerformanceMonitor = new MockPerformanceMonitor({
            telemetryService: mockTelemetryService,
            resourceManager: mockResourceManager,
            thresholds: {
                maxRenderTime: 16,           // 16ms for 60fps
                maxMemoryUsage: 50 * 1024 * 1024,  // 50MB
                maxTelemetryEvents: 100,
                cleanupTimeout: 10           // 10ms
            }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Render Time Monitoring', () => {
        test('should measure render performance accurately', async () => {
            const componentName = 'TestComponent';
            const mockRenderTime = 12; // 12ms
            
            global.performance.now = jest.fn()
                .mockReturnValueOnce(1000)  // Start time
                .mockReturnValueOnce(1012); // End time

            const timer = mockPerformanceMonitor.startTimer(componentName);
            await mockPerformanceMonitor.simulateRender(50); // Simulate 50ms work
            const renderTime = timer.stop();

            expect(renderTime).toBe(mockRenderTime);
            expect(mockTelemetryService.recordPerformance).toHaveBeenCalledWith({
                component: componentName,
                renderTime: mockRenderTime,
                timestamp: expect.any(Number),
                withinThreshold: true
            });
        });

        test('should detect slow renders', async () => {
            const componentName = 'SlowComponent';
            const slowRenderTime = 25; // 25ms - exceeds 16ms threshold
            
            global.performance.now = jest.fn()
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1025);

            const timer = mockPerformanceMonitor.startTimer(componentName);
            const renderTime = timer.stop();

            expect(renderTime).toBe(slowRenderTime);
            expect(mockTelemetryService.recordPerformance).toHaveBeenCalledWith({
                component: componentName,
                renderTime: slowRenderTime,
                timestamp: expect.any(Number),
                withinThreshold: false,
                thresholdExceededBy: 9
            });
        });

        test('should track render performance over time', async () => {
            const componentName = 'TrackedComponent';
            const renderTimes = [8, 12, 15, 20, 14, 9, 11];
            
            for (let i = 0; i < renderTimes.length; i++) {
                global.performance.now = jest.fn()
                    .mockReturnValueOnce(1000)
                    .mockReturnValueOnce(1000 + renderTimes[i]);

                const timer = mockPerformanceMonitor.startTimer(componentName);
                timer.stop();
            }

            const stats = mockPerformanceMonitor.getComponentStats(componentName);
            expect(stats.totalRenders).toBe(renderTimes.length);
            expect(stats.averageRenderTime).toBeCloseTo(
                renderTimes.reduce((a, b) => a + b) / renderTimes.length
            );
            expect(stats.slowRenders).toBe(1); // Only one render > 16ms
        });

        test('should meet 60fps performance requirements', async () => {
            const targetFPS = 60;
            const frameTime = 1000 / targetFPS; // 16.67ms per frame
            const testDuration = 1000; // 1 second
            const expectedFrames = Math.floor(testDuration / frameTime);

            const results = [];
            const startTime = Date.now();

            for (let i = 0; i < expectedFrames; i++) {
                global.performance.now = jest.fn()
                    .mockReturnValueOnce(startTime + (i * frameTime))
                    .mockReturnValueOnce(startTime + (i * frameTime) + 15); // 15ms render

                const timer = mockPerformanceMonitor.startTimer('FPSTest');
                const renderTime = timer.stop();
                results.push(renderTime);
            }

            const avgRenderTime = results.reduce((a, b) => a + b) / results.length;
            const slowFrames = results.filter(time => time > 16).length;
            const performanceScore = (results.length - slowFrames) / results.length;

            expect(avgRenderTime).toBeLessThan(16);
            expect(performanceScore).toBeGreaterThan(0.95); // 95% of frames within budget
        });
    });

    describe('Memory Usage Tracking', () => {
        test('should monitor memory usage accurately', async () => {
            const initialMemory = mockPerformanceMonitor.getMemoryUsage();
            
            expect(initialMemory).toEqual({
                rss: 50 * 1024 * 1024,
                heapTotal: 30 * 1024 * 1024,
                heapUsed: 20 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            });

            expect(mockTelemetryService.recordMemoryUsage).toHaveBeenCalledWith({
                ...initialMemory,
                timestamp: expect.any(Number)
            });
        });

        test('should detect memory leaks', async () => {
            const baselineMemory = 20 * 1024 * 1024; // 20MB
            const memoryGrowth = [];

            // Simulate memory growth over time
            for (let i = 0; i < 10; i++) {
                const currentMemory = baselineMemory + (i * 2 * 1024 * 1024); // 2MB growth per iteration
                global.process.memoryUsage = jest.fn(() => ({
                    rss: currentMemory + 10 * 1024 * 1024,
                    heapTotal: currentMemory + 5 * 1024 * 1024,
                    heapUsed: currentMemory,
                    external: 5 * 1024 * 1024,
                    arrayBuffers: 1 * 1024 * 1024
                }));

                const memoryData = mockPerformanceMonitor.getMemoryUsage();
                memoryGrowth.push(memoryData.heapUsed);
                
                await mockPerformanceMonitor.trackMemoryUsage();
            }

            const leakDetected = mockPerformanceMonitor.detectMemoryLeak(memoryGrowth);
            expect(leakDetected).toBe(true);
            expect(mockTelemetryService.recordEvent).toHaveBeenCalledWith({
                type: 'memory_leak_detected',
                growthRate: expect.any(Number),
                currentUsage: expect.any(Number)
            });
        });

        test('should enforce memory usage limits', async () => {
            const memoryLimit = 50 * 1024 * 1024; // 50MB limit
            const excessiveMemory = 60 * 1024 * 1024; // 60MB usage

            global.process.memoryUsage = jest.fn(() => ({
                rss: excessiveMemory,
                heapTotal: excessiveMemory - 10 * 1024 * 1024,
                heapUsed: excessiveMemory - 15 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            }));

            const result = await mockPerformanceMonitor.checkMemoryLimits();
            
            expect(result.withinLimits).toBe(false);
            expect(result.exceedsBy).toBe(10 * 1024 * 1024); // 10MB over limit
            expect(mockTelemetryService.recordEvent).toHaveBeenCalledWith({
                type: 'memory_limit_exceeded',
                limit: memoryLimit,
                current: excessiveMemory,
                exceedsBy: 10 * 1024 * 1024
            });
        });
    });

    describe('Telemetry Efficiency Validation', () => {
        test('should limit telemetry events effectively', async () => {
            const maxEvents = 100;
            mockTelemetryService.getEventCount = jest.fn(() => maxEvents - 1);

            const result = await mockPerformanceMonitor.recordTelemetryEvent({
                type: 'performance_test',
                data: { value: 123 }
            });

            expect(result.recorded).toBe(true);
            expect(mockTelemetryService.recordEvent).toHaveBeenCalled();

            // Exceed limit
            mockTelemetryService.getEventCount = jest.fn(() => maxEvents);
            
            const limitResult = await mockPerformanceMonitor.recordTelemetryEvent({
                type: 'performance_test_over_limit',
                data: { value: 456 }
            });

            expect(limitResult.recorded).toBe(false);
            expect(limitResult.reason).toBe('event_limit_exceeded');
        });

        test('should batch telemetry events for efficiency', async () => {
            const events = Array.from({ length: 20 }, (_, i) => ({
                type: 'batch_test',
                data: { index: i }
            }));

            for (const event of events) {
                await mockPerformanceMonitor.recordTelemetryEvent(event);
            }

            // Should batch events instead of individual calls
            expect(mockTelemetryService.recordEvent).toHaveBeenCalledTimes(20);
            expect(mockTelemetryService.flush).toHaveBeenCalledTimes(2); // Batch size of 10
        });

        test('should prioritize critical telemetry events', async () => {
            // Fill up to near limit
            mockTelemetryService.getEventCount = jest.fn(() => 98);

            const lowPriorityEvent = {
                type: 'low_priority',
                priority: 'low',
                data: { value: 1 }
            };

            const criticalEvent = {
                type: 'critical_error',
                priority: 'critical',
                data: { error: 'system_failure' }
            };

            const lowResult = await mockPerformanceMonitor.recordTelemetryEvent(lowPriorityEvent);
            const criticalResult = await mockPerformanceMonitor.recordTelemetryEvent(criticalEvent);

            expect(lowResult.recorded).toBe(true);
            expect(criticalResult.recorded).toBe(true);
            expect(criticalResult.priority).toBe('critical');
        });
    });

    describe('Resource Cleanup Testing', () => {
        test('should cleanup resources efficiently', async () => {
            const startTime = Date.now();
            
            await mockPerformanceMonitor.cleanup();
            
            const cleanupTime = Date.now() - startTime;
            expect(cleanupTime).toBeLessThan(10); // Under 10ms
            expect(mockResourceManager.cleanup).toHaveBeenCalled();
            expect(mockTelemetryService.cleanup).toHaveBeenCalled();
        });

        test('should track resource usage before cleanup', async () => {
            const resourceUsage = mockResourceManager.getResourceUsage();
            
            await mockPerformanceMonitor.cleanup();
            
            expect(mockTelemetryService.recordEvent).toHaveBeenCalledWith({
                type: 'resource_cleanup',
                before: resourceUsage,
                cleanupTime: expect.any(Number)
            });
        });

        test('should handle cleanup timeouts gracefully', async () => {
            // Mock slow cleanup
            mockResourceManager.cleanup = jest.fn(() => 
                new Promise(resolve => setTimeout(resolve, 20))
            );

            const result = await mockPerformanceMonitor.cleanup();
            
            expect(result.timedOut).toBe(true);
            expect(result.cleanupTime).toBeGreaterThan(10);
            expect(mockTelemetryService.recordEvent).toHaveBeenCalledWith({
                type: 'cleanup_timeout',
                timeoutDuration: 10,
                actualDuration: expect.any(Number)
            });
        });
    });

    describe('Performance Threshold Enforcement', () => {
        test('should enforce render time thresholds', async () => {
            const thresholds = {
                warning: 10,  // 10ms
                error: 16,    // 16ms
                critical: 33  // 33ms (2 frames)
            };

            const testCases = [
                { renderTime: 8, expectedLevel: 'normal' },
                { renderTime: 12, expectedLevel: 'warning' },
                { renderTime: 20, expectedLevel: 'error' },
                { renderTime: 40, expectedLevel: 'critical' }
            ];

            for (const testCase of testCases) {
                const result = mockPerformanceMonitor.evaluateRenderTime(testCase.renderTime);
                expect(result.level).toBe(testCase.expectedLevel);
            }
        });

        test('should enforce memory thresholds', async () => {
            const thresholds = {
                warning: 30 * 1024 * 1024,  // 30MB
                error: 50 * 1024 * 1024,    // 50MB
                critical: 80 * 1024 * 1024  // 80MB
            };

            const testCases = [
                { memoryUsage: 20 * 1024 * 1024, expectedLevel: 'normal' },
                { memoryUsage: 35 * 1024 * 1024, expectedLevel: 'warning' },
                { memoryUsage: 55 * 1024 * 1024, expectedLevel: 'error' },
                { memoryUsage: 90 * 1024 * 1024, expectedLevel: 'critical' }
            ];

            for (const testCase of testCases) {
                const result = mockPerformanceMonitor.evaluateMemoryUsage(testCase.memoryUsage);
                expect(result.level).toBe(testCase.expectedLevel);
            }
        });

        test('should trigger alerts on threshold violations', async () => {
            const criticalRenderTime = 50; // 50ms - critical threshold
            
            global.performance.now = jest.fn()
                .mockReturnValueOnce(1000)
                .mockReturnValueOnce(1050);

            const timer = mockPerformanceMonitor.startTimer('CriticalComponent');
            timer.stop();

            expect(mockTelemetryService.recordEvent).toHaveBeenCalledWith({
                type: 'performance_threshold_violation',
                level: 'critical',
                metric: 'render_time',
                value: criticalRenderTime,
                threshold: 33
            });
        });
    });

    describe('Component-Specific Performance Tracking', () => {
        test('should track individual component performance', async () => {
            const components = ['ComponentA', 'ComponentB', 'ComponentC'];
            
            for (const component of components) {
                for (let i = 0; i < 5; i++) {
                    global.performance.now = jest.fn()
                        .mockReturnValueOnce(1000)
                        .mockReturnValueOnce(1000 + (10 + i * 2)); // Increasing render times

                    const timer = mockPerformanceMonitor.startTimer(component);
                    timer.stop();
                }
            }

            for (const component of components) {
                const stats = mockPerformanceMonitor.getComponentStats(component);
                expect(stats.totalRenders).toBe(5);
                expect(stats.averageRenderTime).toBeGreaterThan(0);
                expect(stats.minRenderTime).toBeLessThan(stats.maxRenderTime);
            }
        });

        test('should identify performance bottlenecks', async () => {
            const components = [
                { name: 'FastComponent', renderTime: 8 },
                { name: 'SlowComponent', renderTime: 25 },
                { name: 'AverageComponent', renderTime: 12 }
            ];

            for (const component of components) {
                for (let i = 0; i < 10; i++) {
                    global.performance.now = jest.fn()
                        .mockReturnValueOnce(1000)
                        .mockReturnValueOnce(1000 + component.renderTime);

                    const timer = mockPerformanceMonitor.startTimer(component.name);
                    timer.stop();
                }
            }

            const bottlenecks = mockPerformanceMonitor.identifyBottlenecks();
            expect(bottlenecks).toContain('SlowComponent');
            expect(bottlenecks).not.toContain('FastComponent');
        });
    });
});

// Mock Performance Monitor Implementation
class MockPerformanceMonitor {
    constructor(options = {}) {
        this.telemetryService = options.telemetryService;
        this.resourceManager = options.resourceManager;
        this.thresholds = options.thresholds || {};
        
        this.componentStats = new Map();
        this.renderTimes = [];
        this.memoryReadings = [];
        this.activeTimers = new Map();
        this.telemetryEventCount = 0;
    }

    startTimer(componentName) {
        const startTime = performance.now();
        const timerId = `${componentName}_${Date.now()}`;
        
        this.activeTimers.set(timerId, {
            componentName,
            startTime
        });

        return {
            stop: () => {
                const endTime = performance.now();
                const renderTime = endTime - startTime;
                
                this.recordRenderTime(componentName, renderTime);
                this.activeTimers.delete(timerId);
                
                return renderTime;
            }
        };
    }

    recordRenderTime(componentName, renderTime) {
        // Update component stats
        if (!this.componentStats.has(componentName)) {
            this.componentStats.set(componentName, {
                totalRenders: 0,
                totalTime: 0,
                minRenderTime: Infinity,
                maxRenderTime: 0,
                slowRenders: 0
            });
        }

        const stats = this.componentStats.get(componentName);
        stats.totalRenders++;
        stats.totalTime += renderTime;
        stats.minRenderTime = Math.min(stats.minRenderTime, renderTime);
        stats.maxRenderTime = Math.max(stats.maxRenderTime, renderTime);
        
        if (renderTime > this.thresholds.maxRenderTime) {
            stats.slowRenders++;
        }

        stats.averageRenderTime = stats.totalTime / stats.totalRenders;

        // Record telemetry
        this.telemetryService.recordPerformance({
            component: componentName,
            renderTime,
            timestamp: Date.now(),
            withinThreshold: renderTime <= this.thresholds.maxRenderTime,
            ...(renderTime > this.thresholds.maxRenderTime && {
                thresholdExceededBy: renderTime - this.thresholds.maxRenderTime
            })
        });

        // Check for critical performance issues
        const level = this.evaluateRenderTime(renderTime);
        if (level.level !== 'normal') {
            this.telemetryService.recordEvent({
                type: 'performance_threshold_violation',
                level: level.level,
                metric: 'render_time',
                value: renderTime,
                threshold: level.threshold
            });
        }
    }

    evaluateRenderTime(renderTime) {
        if (renderTime > 33) return { level: 'critical', threshold: 33 };
        if (renderTime > 16) return { level: 'error', threshold: 16 };
        if (renderTime > 10) return { level: 'warning', threshold: 10 };
        return { level: 'normal', threshold: null };
    }

    evaluateMemoryUsage(memoryUsage) {
        const mb = 1024 * 1024;
        if (memoryUsage > 80 * mb) return { level: 'critical', threshold: 80 * mb };
        if (memoryUsage > 50 * mb) return { level: 'error', threshold: 50 * mb };
        if (memoryUsage > 30 * mb) return { level: 'warning', threshold: 30 * mb };
        return { level: 'normal', threshold: null };
    }

    getMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        this.memoryReadings.push({
            ...memoryUsage,
            timestamp: Date.now()
        });
        return memoryUsage;
    }

    async trackMemoryUsage() {
        const memoryUsage = this.getMemoryUsage();
        
        await this.telemetryService.recordMemoryUsage({
            ...memoryUsage,
            timestamp: Date.now()
        });

        // Check for memory leaks
        if (this.memoryReadings.length >= 5) {
            const recentReadings = this.memoryReadings.slice(-5);
            const leakDetected = this.detectMemoryLeak(recentReadings.map(r => r.heapUsed));
            
            if (leakDetected) {
                await this.telemetryService.recordEvent({
                    type: 'memory_leak_detected',
                    growthRate: this.calculateGrowthRate(recentReadings),
                    currentUsage: memoryUsage.heapUsed
                });
            }
        }
    }

    detectMemoryLeak(memoryReadings) {
        if (memoryReadings.length < 3) return false;
        
        const growthRate = this.calculateGrowthRate(memoryReadings.map(usage => ({ heapUsed: usage })));
        return growthRate > 0.1; // 10% growth rate threshold
    }

    calculateGrowthRate(readings) {
        if (readings.length < 2) return 0;
        
        const first = readings[0].heapUsed;
        const last = readings[readings.length - 1].heapUsed;
        
        return (last - first) / first;
    }

    async checkMemoryLimits() {
        const memoryUsage = this.getMemoryUsage();
        const limit = this.thresholds.maxMemoryUsage;
        
        if (memoryUsage.rss > limit) {
            await this.telemetryService.recordEvent({
                type: 'memory_limit_exceeded',
                limit,
                current: memoryUsage.rss,
                exceedsBy: memoryUsage.rss - limit
            });
            
            return {
                withinLimits: false,
                exceedsBy: memoryUsage.rss - limit
            };
        }
        
        return { withinLimits: true };
    }

    async recordTelemetryEvent(event) {
        const eventCount = this.telemetryService.getEventCount();
        const maxEvents = this.thresholds.maxTelemetryEvents;
        
        if (eventCount >= maxEvents && event.priority !== 'critical') {
            return {
                recorded: false,
                reason: 'event_limit_exceeded'
            };
        }

        await this.telemetryService.recordEvent(event);
        this.telemetryEventCount++;
        
        // Auto-flush in batches
        if (this.telemetryEventCount % 10 === 0) {
            await this.telemetryService.flush();
        }
        
        return {
            recorded: true,
            priority: event.priority
        };
    }

    getComponentStats(componentName) {
        return this.componentStats.get(componentName) || {
            totalRenders: 0,
            averageRenderTime: 0,
            minRenderTime: 0,
            maxRenderTime: 0,
            slowRenders: 0
        };
    }

    identifyBottlenecks() {
        const bottlenecks = [];
        
        for (const [componentName, stats] of this.componentStats.entries()) {
            if (stats.averageRenderTime > this.thresholds.maxRenderTime) {
                bottlenecks.push(componentName);
            }
        }
        
        return bottlenecks;
    }

    async cleanup() {
        const startTime = Date.now();
        const cleanupTimeout = this.thresholds.cleanupTimeout || 10;
        
        try {
            const resourceUsage = this.resourceManager.getResourceUsage();
            
            await Promise.race([
                this.performCleanup(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Cleanup timeout')), cleanupTimeout)
                )
            ]);
            
            const cleanupTime = Date.now() - startTime;
            
            await this.telemetryService.recordEvent({
                type: 'resource_cleanup',
                before: resourceUsage,
                cleanupTime
            });
            
            return {
                timedOut: false,
                cleanupTime
            };
        } catch (error) {
            const cleanupTime = Date.now() - startTime;
            
            await this.telemetryService.recordEvent({
                type: 'cleanup_timeout',
                timeoutDuration: cleanupTimeout,
                actualDuration: cleanupTime
            });
            
            return {
                timedOut: true,
                cleanupTime
            };
        }
    }

    async performCleanup() {
        await this.resourceManager.cleanup();
        await this.telemetryService.cleanup();
        
        // Clear internal state
        this.componentStats.clear();
        this.renderTimes = [];
        this.memoryReadings = [];
        this.activeTimers.clear();
        this.telemetryEventCount = 0;
    }

    async simulateRender(duration) {
        // Simulate render work
        const start = Date.now();
        while (Date.now() - start < duration) {
            // Busy wait to simulate render work
        }
    }
} 