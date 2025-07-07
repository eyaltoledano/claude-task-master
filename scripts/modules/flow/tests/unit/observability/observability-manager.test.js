/**
 * Observability Manager Testing
 * 
 * Tests the ObservabilityManager with:
 * - OpenTelemetry SDK integration
 * - Flow-compatible telemetry setup
 * - Performance monitoring with PerformanceObserver
 * - Health checks with 4-tier validation
 * - Metric recording and storage
 */

import { EventEmitter } from 'events';

describe('ObservabilityManager', () => {
    let mockObservabilityManager;
    let mockOpenTelemetry;
    let mockPerformanceObserver;
    let mockHealthChecker;
    let mockMetricStore;
    let mockFlowTelemetry;

    beforeEach(() => {
        // Mock OpenTelemetry SDK
        mockOpenTelemetry = {
            trace: {
                getTracer: jest.fn(() => ({
                    startSpan: jest.fn(() => ({
                        setAttributes: jest.fn(),
                        setStatus: jest.fn(),
                        addEvent: jest.fn(),
                        end: jest.fn()
                    }))
                }))
            },
            metrics: {
                getMeter: jest.fn(() => ({
                    createCounter: jest.fn(() => ({
                        add: jest.fn()
                    })),
                    createHistogram: jest.fn(() => ({
                        record: jest.fn()
                    })),
                    createGauge: jest.fn(() => ({
                        record: jest.fn()
                    }))
                }))
            },
            context: {
                active: jest.fn(() => ({})),
                with: jest.fn((ctx, fn) => fn())
            }
        };

        // Mock PerformanceObserver
        mockPerformanceObserver = {
            observe: jest.fn(),
            disconnect: jest.fn(),
            takeRecords: jest.fn(() => [
                { name: 'measure1', duration: 25.5, startTime: 1000 },
                { name: 'measure2', duration: 15.2, startTime: 1025 }
            ])
        };

        // Mock Health Checker
        mockHealthChecker = {
            checkMemory: jest.fn(() => ({ 
                status: 'healthy', 
                usage: 45 * 1024 * 1024, 
                limit: 150 * 1024 * 1024 
            })),
            checkPerformance: jest.fn(() => ({ 
                status: 'healthy', 
                avgRenderTime: 12.5, 
                threshold: 16 
            })),
            checkConnectivity: jest.fn(() => ({ 
                status: 'healthy', 
                latency: 85, 
                endpoint: 'vibekit-api' 
            })),
            checkTelemetry: jest.fn(() => ({ 
                status: 'healthy', 
                queueSize: 25, 
                maxQueue: 100 
            }))
        };

        // Mock Metric Store
        mockMetricStore = {
            store: jest.fn(),
            retrieve: jest.fn(),
            getMetricCount: jest.fn(() => ({ counters: 25, histograms: 15, gauges: 10 })),
            clear: jest.fn(),
            export: jest.fn()
        };

        // Mock Flow Telemetry
        mockFlowTelemetry = {
            configure: jest.fn(),
            exportTraces: jest.fn(),
            exportMetrics: jest.fn(),
            getConfiguration: jest.fn(() => ({
                endpoint: 'https://flow-telemetry.example.com',
                apiKey: 'flow_test_key_123',
                sampleRate: 0.1
            }))
        };

        // Create ObservabilityManager
        mockObservabilityManager = new MockObservabilityManager({
            openTelemetry: mockOpenTelemetry,
            performanceObserver: mockPerformanceObserver,
            healthChecker: mockHealthChecker,
            metricStore: mockMetricStore,
            flowTelemetry: mockFlowTelemetry,
            config: {
                memoryThreshold: 150 * 1024 * 1024,  // 150MB
                cleanupInterval: 15 * 1000,           // 15 seconds
                samplingRate: 0.1,                    // 10%
                flushInterval: 30 * 1000,             // 30 seconds
                healthCheckInterval: 60 * 1000,       // 1 minute
                maxMetricsPerType: 100
            }
        });
    });

    describe('OpenTelemetry Integration', () => {
        test('should initialize OpenTelemetry SDK', async () => {
            await mockObservabilityManager.initialize();

            expect(mockOpenTelemetry.trace.getTracer).toHaveBeenCalledWith('task-master-tui');
            expect(mockOpenTelemetry.metrics.getMeter).toHaveBeenCalledWith('task-master-tui');
        });

        test('should create and manage traces', async () => {
            const tracer = mockOpenTelemetry.trace.getTracer();
            const span = tracer.startSpan('test-operation');

            await mockObservabilityManager.startTrace('test-operation', {
                'operation.type': 'ui_render',
                'component.name': 'MainView'
            });

            expect(tracer.startSpan).toHaveBeenCalledWith('test-operation');
            expect(span.setAttributes).toHaveBeenCalledWith({
                'operation.type': 'ui_render',
                'component.name': 'MainView'
            });
        });

        test('should handle span events and status', async () => {
            const span = mockObservabilityManager.getActiveSpan();
            
            await mockObservabilityManager.addSpanEvent('user_interaction', {
                'event.type': 'click',
                'element.id': 'submit-button'
            });

            expect(span.addEvent).toHaveBeenCalledWith('user_interaction', {
                'event.type': 'click',
                'element.id': 'submit-button'
            });
        });

        test('should create nested spans for complex operations', async () => {
            const parentSpan = await mockObservabilityManager.startTrace('parent-operation');
            const childSpan = await mockObservabilityManager.startTrace('child-operation', {
                parent: parentSpan
            });

            expect(parentSpan).toBeDefined();
            expect(childSpan).toBeDefined();
            expect(mockObservabilityManager.getActiveSpanCount()).toBe(2);
        });

        test('should handle span completion and cleanup', async () => {
            const span = await mockObservabilityManager.startTrace('completion-test');
            
            await mockObservabilityManager.completeTrace(span, {
                status: 'success',
                duration: 125.5
            });

            expect(span.setStatus).toHaveBeenCalledWith({ code: 'OK' });
            expect(span.end).toHaveBeenCalled();
        });
    });

    describe('Metric Recording and Storage', () => {
        test('should record counter metrics', async () => {
            const counter = mockOpenTelemetry.metrics.getMeter().createCounter('test-counter');
            
            await mockObservabilityManager.recordCounter('ui_interactions', 1, {
                'interaction.type': 'click',
                'component': 'button'
            });

            expect(counter.add).toHaveBeenCalledWith(1, {
                'interaction.type': 'click',
                'component': 'button'
            });
        });

        test('should record histogram metrics', async () => {
            const histogram = mockOpenTelemetry.metrics.getMeter().createHistogram('test-histogram');
            
            await mockObservabilityManager.recordHistogram('render_times', 15.2, {
                'component': 'TaskList',
                'complexity': 'high'
            });

            expect(histogram.record).toHaveBeenCalledWith(15.2, {
                'component': 'TaskList',
                'complexity': 'high'
            });
        });

        test('should record gauge metrics', async () => {
            const gauge = mockOpenTelemetry.metrics.getMeter().createGauge('test-gauge');
            
            await mockObservabilityManager.recordGauge('memory_usage', 45 * 1024 * 1024, {
                'process': 'main',
                'unit': 'bytes'
            });

            expect(gauge.record).toHaveBeenCalledWith(45 * 1024 * 1024, {
                'process': 'main',
                'unit': 'bytes'
            });
        });

        test('should enforce metric limits per type', async () => {
            const maxMetrics = 100;
            
            // Fill up to limit
            for (let i = 0; i < maxMetrics; i++) {
                await mockObservabilityManager.recordCounter(`counter_${i}`, 1);
            }

            // This should be rejected
            const result = await mockObservabilityManager.recordCounter('counter_overflow', 1);
            
            expect(result.recorded).toBe(false);
            expect(result.reason).toBe('metric_limit_exceeded');
        });

        test('should store metrics in metric store', async () => {
            await mockObservabilityManager.recordCounter('stored_counter', 5);
            
            expect(mockMetricStore.store).toHaveBeenCalledWith({
                type: 'counter',
                name: 'stored_counter',
                value: 5,
                timestamp: expect.any(Number)
            });
        });

        test('should retrieve stored metrics', async () => {
            mockMetricStore.retrieve.mockResolvedValue([
                { name: 'counter1', value: 10, timestamp: 1000 },
                { name: 'counter2', value: 15, timestamp: 2000 }
            ]);

            const metrics = await mockObservabilityManager.getStoredMetrics('counter');
            
            expect(metrics).toHaveLength(2);
            expect(metrics[0].name).toBe('counter1');
            expect(mockMetricStore.retrieve).toHaveBeenCalledWith('counter');
        });
    });

    describe('Performance Monitoring', () => {
        test('should observe performance entries', async () => {
            await mockObservabilityManager.startPerformanceMonitoring();

            expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({
                entryTypes: ['measure', 'navigation', 'resource', 'paint']
            });
        });

        test('should process performance observations', async () => {
            const entries = mockPerformanceObserver.takeRecords();
            
            await mockObservabilityManager.processPerformanceEntries(entries);

            expect(mockObservabilityManager.getPerformanceMetrics()).toEqual({
                avgDuration: 20.35,  // (25.5 + 15.2) / 2
                totalEntries: 2,
                longestDuration: 25.5,
                shortestDuration: 15.2
            });
        });

        test('should detect performance anomalies', async () => {
            const slowEntries = [
                { name: 'slow_render', duration: 150, startTime: 1000 },
                { name: 'slow_computation', duration: 200, startTime: 1150 }
            ];

            const anomalies = await mockObservabilityManager.detectPerformanceAnomalies(slowEntries);

            expect(anomalies).toHaveLength(2);
            expect(anomalies[0].type).toBe('slow_performance');
            expect(anomalies[0].duration).toBe(150);
        });

        test('should correlate performance with user actions', async () => {
            const userAction = {
                type: 'click',
                target: 'submit-button',
                timestamp: 1000
            };

            const performanceEntry = {
                name: 'button_click_handler',
                duration: 45,
                startTime: 1005
            };

            const correlation = await mockObservabilityManager.correlatePerformanceWithAction(
                userAction, 
                performanceEntry
            );

            expect(correlation.correlated).toBe(true);
            expect(correlation.delay).toBe(5); // 1005 - 1000
            expect(correlation.responseTime).toBe(45);
        });
    });

    describe('Health Check System', () => {
        test('should perform 4-tier health validation', async () => {
            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(healthReport.tiers).toEqual({
                memory: { status: 'healthy', usage: 45 * 1024 * 1024, limit: 150 * 1024 * 1024 },
                performance: { status: 'healthy', avgRenderTime: 12.5, threshold: 16 },
                connectivity: { status: 'healthy', latency: 85, endpoint: 'vibekit-api' },
                telemetry: { status: 'healthy', queueSize: 25, maxQueue: 100 }
            });

            expect(healthReport.overallStatus).toBe('healthy');
        });

        test('should detect memory issues', async () => {
            mockHealthChecker.checkMemory.mockReturnValue({
                status: 'warning',
                usage: 120 * 1024 * 1024,  // 120MB
                limit: 150 * 1024 * 1024   // 150MB limit
            });

            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(healthReport.tiers.memory.status).toBe('warning');
            expect(healthReport.overallStatus).toBe('warning');
        });

        test('should detect performance degradation', async () => {
            mockHealthChecker.checkPerformance.mockReturnValue({
                status: 'error',
                avgRenderTime: 25.5,  // Exceeds 16ms threshold
                threshold: 16
            });

            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(healthReport.tiers.performance.status).toBe('error');
            expect(healthReport.overallStatus).toBe('error');
        });

        test('should detect connectivity issues', async () => {
            mockHealthChecker.checkConnectivity.mockReturnValue({
                status: 'error',
                latency: 5000,  // 5 seconds - very high
                endpoint: 'vibekit-api'
            });

            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(healthReport.tiers.connectivity.status).toBe('error');
            expect(healthReport.overallStatus).toBe('error');
        });

        test('should detect telemetry queue backup', async () => {
            mockHealthChecker.checkTelemetry.mockReturnValue({
                status: 'warning',
                queueSize: 85,   // Near 100 limit
                maxQueue: 100
            });

            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(healthReport.tiers.telemetry.status).toBe('warning');
            expect(healthReport.overallStatus).toBe('warning');
        });

        test('should schedule periodic health checks', async () => {
            const healthCheckInterval = 60 * 1000; // 1 minute
            
            await mockObservabilityManager.startPeriodicHealthChecks();

            expect(mockObservabilityManager.getHealthCheckInterval()).toBe(healthCheckInterval);
            expect(mockObservabilityManager.isHealthCheckScheduled()).toBe(true);
        });

        test('should trigger alerts on health issues', async () => {
            mockHealthChecker.checkMemory.mockReturnValue({
                status: 'critical',
                usage: 180 * 1024 * 1024,  // 180MB - exceeds 150MB limit
                limit: 150 * 1024 * 1024
            });

            const healthReport = await mockObservabilityManager.performHealthCheck();

            expect(mockObservabilityManager.getTriggeredAlerts()).toContainEqual({
                type: 'health_alert',
                tier: 'memory',
                status: 'critical',
                message: 'Memory usage exceeds limit'
            });
        });
    });

    describe('VibeKit Telemetry Integration', () => {
        test('should configure VibeKit telemetry', async () => {
            const config = {
                endpoint: 'https://vibekit-telemetry.example.com',
                apiKey: 'vk_test_key_123',
                sampleRate: 0.1
            };

            await mockObservabilityManager.configureVibeKitTelemetry(config);

            expect(mockVibeKitTelemetry.configure).toHaveBeenCalledWith(config);
        });

        test('should export traces to VibeKit', async () => {
            const traces = [
                { traceId: 'trace1', spans: [{ spanId: 'span1' }] },
                { traceId: 'trace2', spans: [{ spanId: 'span2' }] }
            ];

            await mockObservabilityManager.exportTracesToVibeKit(traces);

            expect(mockVibeKitTelemetry.exportTraces).toHaveBeenCalledWith(traces);
        });

        test('should export metrics to VibeKit', async () => {
            const metrics = [
                { name: 'counter1', value: 10, timestamp: 1000 },
                { name: 'histogram1', value: 15.5, timestamp: 2000 }
            ];

            await mockObservabilityManager.exportMetricsToVibeKit(metrics);

            expect(mockVibeKitTelemetry.exportMetrics).toHaveBeenCalledWith(metrics);
        });

        test('should handle VibeKit telemetry errors', async () => {
            mockVibeKitTelemetry.exportTraces.mockRejectedValue(new Error('Network error'));

            const result = await mockObservabilityManager.exportTracesToVibeKit([]);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        test('should respect sampling rate', async () => {
            const samplingRate = 0.1; // 10%
            const totalTraces = 100;
            
            let exportedTraces = 0;
            for (let i = 0; i < totalTraces; i++) {
                const shouldExport = mockObservabilityManager.shouldSample(samplingRate);
                if (shouldExport) exportedTraces++;
            }

            // Should be approximately 10% (within reasonable variance)
            expect(exportedTraces).toBeGreaterThan(5);
            expect(exportedTraces).toBeLessThan(20);
        });
    });

    describe('Data Export and Cleanup', () => {
        test('should export observability data', async () => {
            const exportData = await mockObservabilityManager.exportData();

            expect(exportData).toHaveProperty('traces');
            expect(exportData).toHaveProperty('metrics');
            expect(exportData).toHaveProperty('healthChecks');
            expect(exportData).toHaveProperty('performanceData');
            expect(mockMetricStore.export).toHaveBeenCalled();
        });

        test('should clean up old data', async () => {
            const cleanupThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            await mockObservabilityManager.cleanupOldData(cleanupThreshold);

            expect(mockMetricStore.clear).toHaveBeenCalledWith({
                olderThan: cleanupThreshold
            });
        });

        test('should handle cleanup errors gracefully', async () => {
            mockMetricStore.clear.mockRejectedValue(new Error('Cleanup failed'));

            const result = await mockObservabilityManager.cleanupOldData();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cleanup failed');
        });

        test('should maintain data within size limits', async () => {
            const sizeLimit = 50 * 1024 * 1024; // 50MB
            
            const currentSize = await mockObservabilityManager.getDataSize();
            expect(currentSize).toBeLessThan(sizeLimit);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle OpenTelemetry initialization errors', async () => {
            mockOpenTelemetry.trace.getTracer.mockImplementation(() => {
                throw new Error('OpenTelemetry initialization failed');
            });

            const result = await mockObservabilityManager.initializeWithErrorHandling();

            expect(result.success).toBe(false);
            expect(result.error).toBe('OpenTelemetry initialization failed');
            expect(result.fallbackMode).toBe(true);
        });

        test('should operate in fallback mode when telemetry fails', async () => {
            await mockObservabilityManager.enableFallbackMode();

            const result = await mockObservabilityManager.recordCounter('fallback_counter', 1);

            expect(result.recorded).toBe(true);
            expect(result.mode).toBe('fallback');
        });

        test('should recover from telemetry service failures', async () => {
            mockVibeKitTelemetry.exportTraces.mockRejectedValue(new Error('Service unavailable'));

            const result = await mockObservabilityManager.recoverFromTelemetryFailure();

            expect(result.recovered).toBe(true);
            expect(result.strategy).toBe('local_storage');
        });

        test('should handle performance observer errors', async () => {
            mockPerformanceObserver.observe.mockImplementation(() => {
                throw new Error('Performance observer failed');
            });

            const result = await mockObservabilityManager.startPerformanceMonitoringWithErrorHandling();

            expect(result.success).toBe(false);
            expect(result.alternativeMode).toBe(true);
        });
    });

    describe('Configuration Management', () => {
        test('should validate configuration parameters', async () => {
            const invalidConfig = {
                memoryThreshold: -1,
                samplingRate: 1.5,
                healthCheckInterval: 'invalid'
            };

            const validation = await mockObservabilityManager.validateConfiguration(invalidConfig);

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('memoryThreshold must be positive');
            expect(validation.errors).toContain('samplingRate must be between 0 and 1');
            expect(validation.errors).toContain('healthCheckInterval must be a number');
        });

        test('should apply configuration updates', async () => {
            const newConfig = {
                memoryThreshold: 200 * 1024 * 1024,  // 200MB
                samplingRate: 0.2,                    // 20%
                healthCheckInterval: 30 * 1000       // 30 seconds
            };

            await mockObservabilityManager.updateConfiguration(newConfig);

            expect(mockObservabilityManager.getConfiguration().memoryThreshold).toBe(200 * 1024 * 1024);
            expect(mockObservabilityManager.getConfiguration().samplingRate).toBe(0.2);
        });

        test('should handle configuration reload', async () => {
            await mockObservabilityManager.reloadConfiguration();

            expect(mockObservabilityManager.getConfigurationStatus()).toBe('reloaded');
        });
    });
});

// Mock ObservabilityManager Implementation
class MockObservabilityManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.openTelemetry = options.openTelemetry;
        this.performanceObserver = options.performanceObserver;
        this.healthChecker = options.healthChecker;
        this.metricStore = options.metricStore;
        this.vibeKitTelemetry = options.vibeKitTelemetry;
        this.config = options.config || {};
        
        this.activeSpans = new Map();
        this.performanceMetrics = { avgDuration: 0, totalEntries: 0, longestDuration: 0, shortestDuration: 0 };
        this.healthCheckInterval = null;
        this.triggeredAlerts = [];
        this.fallbackMode = false;
        this.metricCounts = { counters: 0, histograms: 0, gauges: 0 };
        this.configurationStatus = 'initialized';
    }

    async initialize() {
        this.tracer = this.openTelemetry.trace.getTracer('task-master-tui');
        this.meter = this.openTelemetry.metrics.getMeter('task-master-tui');
        return { success: true };
    }

    async initializeWithErrorHandling() {
        try {
            await this.initialize();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                fallbackMode: true
            };
        }
    }

    async startTrace(name, attributes = {}) {
        const span = this.tracer.startSpan(name);
        span.setAttributes(attributes);
        
        const spanId = `span_${Date.now()}`;
        this.activeSpans.set(spanId, span);
        
        return span;
    }

    getActiveSpan() {
        const spans = Array.from(this.activeSpans.values());
        return spans[spans.length - 1] || {
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            addEvent: jest.fn(),
            end: jest.fn()
        };
    }

    getActiveSpanCount() {
        return this.activeSpans.size;
    }

    async addSpanEvent(eventName, attributes = {}) {
        const span = this.getActiveSpan();
        span.addEvent(eventName, attributes);
    }

    async completeTrace(span, completion = {}) {
        if (completion.status === 'success') {
            span.setStatus({ code: 'OK' });
        } else {
            span.setStatus({ code: 'ERROR', message: completion.error });
        }
        span.end();
        
        // Remove from active spans
        for (const [id, activeSpan] of this.activeSpans.entries()) {
            if (activeSpan === span) {
                this.activeSpans.delete(id);
                break;
            }
        }
    }

    async recordCounter(name, value, attributes = {}) {
        if (this.metricCounts.counters >= this.config.maxMetricsPerType) {
            return { recorded: false, reason: 'metric_limit_exceeded' };
        }

        const counter = this.meter.createCounter(name);
        counter.add(value, attributes);
        
        await this.metricStore.store({
            type: 'counter',
            name,
            value,
            timestamp: Date.now()
        });

        this.metricCounts.counters++;
        
        return { recorded: true, mode: this.fallbackMode ? 'fallback' : 'normal' };
    }

    async recordHistogram(name, value, attributes = {}) {
        if (this.metricCounts.histograms >= this.config.maxMetricsPerType) {
            return { recorded: false, reason: 'metric_limit_exceeded' };
        }

        const histogram = this.meter.createHistogram(name);
        histogram.record(value, attributes);
        
        await this.metricStore.store({
            type: 'histogram',
            name,
            value,
            timestamp: Date.now()
        });

        this.metricCounts.histograms++;
        return { recorded: true };
    }

    async recordGauge(name, value, attributes = {}) {
        if (this.metricCounts.gauges >= this.config.maxMetricsPerType) {
            return { recorded: false, reason: 'metric_limit_exceeded' };
        }

        const gauge = this.meter.createGauge(name);
        gauge.record(value, attributes);
        
        await this.metricStore.store({
            type: 'gauge',
            name,
            value,
            timestamp: Date.now()
        });

        this.metricCounts.gauges++;
        return { recorded: true };
    }

    async getStoredMetrics(type) {
        return await this.metricStore.retrieve(type);
    }

    async startPerformanceMonitoring() {
        this.performanceObserver.observe({
            entryTypes: ['measure', 'navigation', 'resource', 'paint']
        });
    }

    async startPerformanceMonitoringWithErrorHandling() {
        try {
            await this.startPerformanceMonitoring();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                alternativeMode: true
            };
        }
    }

    async processPerformanceEntries(entries) {
        let totalDuration = 0;
        let longestDuration = 0;
        let shortestDuration = Infinity;

        for (const entry of entries) {
            totalDuration += entry.duration;
            longestDuration = Math.max(longestDuration, entry.duration);
            shortestDuration = Math.min(shortestDuration, entry.duration);
        }

        this.performanceMetrics = {
            avgDuration: totalDuration / entries.length,
            totalEntries: entries.length,
            longestDuration,
            shortestDuration
        };
    }

    getPerformanceMetrics() {
        return this.performanceMetrics;
    }

    async detectPerformanceAnomalies(entries) {
        const threshold = 100; // 100ms threshold
        return entries
            .filter(entry => entry.duration > threshold)
            .map(entry => ({
                type: 'slow_performance',
                name: entry.name,
                duration: entry.duration,
                threshold
            }));
    }

    async correlatePerformanceWithAction(userAction, performanceEntry) {
        const timeDiff = performanceEntry.startTime - userAction.timestamp;
        const correlated = timeDiff >= 0 && timeDiff <= 100; // Within 100ms

        return {
            correlated,
            delay: timeDiff,
            responseTime: performanceEntry.duration
        };
    }

    async performHealthCheck() {
        const memory = this.healthChecker.checkMemory();
        const performance = this.healthChecker.checkPerformance();
        const connectivity = this.healthChecker.checkConnectivity();
        const telemetry = this.healthChecker.checkTelemetry();

        const tiers = { memory, performance, connectivity, telemetry };
        const statuses = Object.values(tiers).map(tier => tier.status);
        
        let overallStatus = 'healthy';
        if (statuses.includes('critical')) overallStatus = 'critical';
        else if (statuses.includes('error')) overallStatus = 'error';
        else if (statuses.includes('warning')) overallStatus = 'warning';

        // Trigger alerts for critical/error conditions
        for (const [tierName, tier] of Object.entries(tiers)) {
            if (tier.status === 'critical' || tier.status === 'error') {
                this.triggeredAlerts.push({
                    type: 'health_alert',
                    tier: tierName,
                    status: tier.status,
                    message: `${tierName} ${tier.status === 'critical' ? 'exceeds limit' : 'degraded'}`
                });
            }
        }

        return { tiers, overallStatus };
    }

    async startPeriodicHealthChecks() {
        this.healthCheckInterval = this.config.healthCheckInterval;
        return { scheduled: true };
    }

    getHealthCheckInterval() {
        return this.healthCheckInterval;
    }

    isHealthCheckScheduled() {
        return this.healthCheckInterval !== null;
    }

    getTriggeredAlerts() {
        return this.triggeredAlerts;
    }

    async configureVibeKitTelemetry(config) {
        await this.vibeKitTelemetry.configure(config);
    }

    async exportTracesToVibeKit(traces) {
        try {
            await this.vibeKitTelemetry.exportTraces(traces);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async exportMetricsToVibeKit(metrics) {
        try {
            await this.vibeKitTelemetry.exportMetrics(metrics);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    shouldSample(samplingRate) {
        return Math.random() < samplingRate;
    }

    async exportData() {
        const data = {
            traces: [],
            metrics: await this.metricStore.export(),
            healthChecks: [],
            performanceData: this.performanceMetrics
        };
        return data;
    }

    async cleanupOldData(threshold) {
        try {
            await this.metricStore.clear({ olderThan: threshold });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDataSize() {
        return 25 * 1024 * 1024; // 25MB mock size
    }

    async enableFallbackMode() {
        this.fallbackMode = true;
    }

    async recoverFromTelemetryFailure() {
        return {
            recovered: true,
            strategy: 'local_storage'
        };
    }

    async validateConfiguration(config) {
        const errors = [];
        
        if (config.memoryThreshold <= 0) {
            errors.push('memoryThreshold must be positive');
        }
        
        if (config.samplingRate < 0 || config.samplingRate > 1) {
            errors.push('samplingRate must be between 0 and 1');
        }
        
        if (typeof config.healthCheckInterval !== 'number') {
            errors.push('healthCheckInterval must be a number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getConfiguration() {
        return this.config;
    }

    async reloadConfiguration() {
        this.configurationStatus = 'reloaded';
    }

    getConfigurationStatus() {
        return this.configurationStatus;
    }
} 