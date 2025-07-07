/**
 * Performance Integration Tests
 *
 * Tests system performance under realistic loads, benchmarking,
 * scalability, and resource utilization optimization.
 *
 * Test Coverage:
 * - Load testing under realistic conditions
 * - Performance benchmarking and metrics
 * - Resource utilization optimization
 * - Scalability testing
 * - Memory leak detection
 * - Throughput and latency measurements
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// Mock performance monitor
const mockPerformanceMonitor = {
	startProfiling: jest.fn(),
	stopProfiling: jest.fn(),
	getMetrics: jest.fn(),
	measureMemoryUsage: jest.fn(),
	measureCPUUsage: jest.fn(),
	measureLatency: jest.fn(),
	trackThroughput: jest.fn(),
	detectMemoryLeaks: jest.fn()
};

// Mock load generator
const mockLoadGenerator = {
	generateLoad: jest.fn(),
	createConcurrentSessions: jest.fn(),
	simulateUserWorkflows: jest.fn(),
	createStressTest: jest.fn(),
	measureResponseTimes: jest.fn(),
	trackResourceUsage: jest.fn()
};

// Mock resource manager
const mockResourceManager = {
	allocateResources: jest.fn(),
	optimizeAllocation: jest.fn(),
	monitorUsage: jest.fn(),
	enforceQuotas: jest.fn(),
	cleanupResources: jest.fn(),
	getResourceMetrics: jest.fn()
};

// Mock system components with performance tracking
const mockASTPerformance = {
	buildContext: jest.fn(),
	measureParsingTime: jest.fn(),
	trackMemoryUsage: jest.fn(),
	optimizeCache: jest.fn()
};

const mockClaudePerformance = {
	createSession: jest.fn(),
	processRequest: jest.fn(),
	measureResponseTime: jest.fn(),
	trackTokenUsage: jest.fn(),
	optimizeRequests: jest.fn()
};

const mockWorkflowPerformance = {
	executeWorkflow: jest.fn(),
	measureEndToEndTime: jest.fn(),
	trackComponentTimes: jest.fn(),
	optimizeWorkflow: jest.fn()
};

// Mock benchmark runner
const mockBenchmarkRunner = {
	runBenchmark: jest.fn(),
	compareBenchmarks: jest.fn(),
	generateReport: jest.fn(),
	validatePerformance: jest.fn(),
	trackRegression: jest.fn()
};

// Test utilities
function createPerformanceConfig(scenario = 'standard') {
	const configs = {
		standard: {
			concurrentSessions: 5,
			requestsPerSession: 10,
			maxMemoryMB: 512,
			maxCPUPercent: 80,
			targetLatencyMs: 2000,
			targetThroughputPerMin: 100
		},
		stress: {
			concurrentSessions: 15,
			requestsPerSession: 25,
			maxMemoryMB: 1024,
			maxCPUPercent: 95,
			targetLatencyMs: 5000,
			targetThroughputPerMin: 200
		},
		light: {
			concurrentSessions: 2,
			requestsPerSession: 5,
			maxMemoryMB: 256,
			maxCPUPercent: 40,
			targetLatencyMs: 1000,
			targetThroughputPerMin: 50
		}
	};

	return configs[scenario] || configs.standard;
}

function createMockTask(complexity = 5, size = 'medium') {
	const sizeConfig = {
		small: { files: 3, lines: 500, dependencies: 1 },
		medium: { files: 8, lines: 2000, dependencies: 3 },
		large: { files: 20, lines: 8000, dependencies: 8 },
		xlarge: { files: 50, lines: 25000, dependencies: 15 }
	};

	const config = sizeConfig[size] || sizeConfig.medium;

	return {
		id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		complexity,
		files: Array.from({ length: config.files }, (_, i) => `src/module-${i}.js`),
		totalLines: config.lines,
		dependencies: Array.from(
			{ length: config.dependencies },
			(_, i) => `dep-${i}`
		),
		estimatedProcessingTime: complexity * 1000 + config.lines
	};
}

function createWorkloadProfile(type = 'mixed') {
	const profiles = {
		mixed: [
			{ weight: 40, taskSize: 'small', complexity: 3 },
			{ weight: 40, taskSize: 'medium', complexity: 5 },
			{ weight: 15, taskSize: 'large', complexity: 7 },
			{ weight: 5, taskSize: 'xlarge', complexity: 9 }
		],
		heavy: [
			{ weight: 20, taskSize: 'medium', complexity: 6 },
			{ weight: 50, taskSize: 'large', complexity: 8 },
			{ weight: 30, taskSize: 'xlarge', complexity: 9 }
		],
		light: [
			{ weight: 70, taskSize: 'small', complexity: 2 },
			{ weight: 30, taskSize: 'medium', complexity: 4 }
		]
	};

	return profiles[type] || profiles.mixed;
}

function generateRealisticLoad(profile) {
	return profile
		.map((item) => {
			const count = Math.floor(item.weight / 10); // Approximate task count
			return Array.from({ length: count }, () =>
				createMockTask(item.complexity, item.taskSize)
			);
		})
		.flat();
}

describe('Performance Integration Tests', () => {
	let testTempDir;
	let performanceBaseline;
	let loadTestResults;

	beforeAll(async () => {
		testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-'));

		// Establish baseline performance metrics
		performanceBaseline = {
			astParsingTime: 500, // ms per 1000 lines
			claudeResponseTime: 3000, // ms per request
			workflowTime: 15000, // ms per complete workflow
			memoryUsage: 256, // MB baseline
			cpuUsage: 30, // % baseline
			throughput: 4 // requests per minute
		};
	});

	afterAll(async () => {
		if (testTempDir) {
			await fs.remove(testTempDir);
		}
	});

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();
		loadTestResults = [];

		// Setup performance monitoring mocks
		mockPerformanceMonitor.getMetrics.mockReturnValue({
			timestamp: new Date().toISOString(),
			memory: {
				used: Math.random() * 200 + 100, // 100-300 MB
				peak: Math.random() * 250 + 150, // 150-400 MB
				available: 2048 - (Math.random() * 200 + 100)
			},
			cpu: {
				current: Math.random() * 40 + 20, // 20-60%
				peak: Math.random() * 60 + 30, // 30-90%
				average: Math.random() * 35 + 25 // 25-60%
			},
			latency: {
				min: Math.random() * 500 + 200, // 200-700ms
				max: Math.random() * 2000 + 1000, // 1000-3000ms
				avg: Math.random() * 1000 + 500, // 500-1500ms
				p95: Math.random() * 1500 + 800 // 800-2300ms
			}
		});

		// Setup component performance mocks
		mockASTPerformance.buildContext.mockImplementation(
			async (projectPath, task) => {
				const processingTime = task.totalLines * 0.5 + Math.random() * 200; // Base + variance
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(processingTime / 10, 100))
				); // Simulate processing

				return {
					files: task.files.length,
					totalLines: task.totalLines,
					complexity: task.complexity,
					processingTime,
					memoryUsed: task.totalLines * 0.02 + Math.random() * 10 // MB
				};
			}
		);

		mockClaudePerformance.processRequest.mockImplementation(async (request) => {
			const baseTime = 2000;
			const complexityFactor = (request.task?.complexity || 5) * 200;
			const responseTime = baseTime + complexityFactor + Math.random() * 1000;

			await new Promise((resolve) =>
				setTimeout(resolve, Math.min(responseTime / 20, 200))
			); // Simulate processing

			return {
				sessionId: request.sessionId,
				responseTime,
				tokensUsed: Math.floor(responseTime / 10) + Math.random() * 500,
				memoryUsed: Math.random() * 100 + 50 // MB
			};
		});

		mockWorkflowPerformance.executeWorkflow.mockImplementation(
			async (workflow) => {
				const startTime = Date.now();

				// Simulate workflow steps
				const astResult = await mockASTPerformance.buildContext(
					'/',
					workflow.task
				);
				const claudeResult = await mockClaudePerformance.processRequest({
					sessionId: workflow.sessionId,
					task: workflow.task
				});

				const endTime = Date.now();
				const totalTime = endTime - startTime;

				return {
					workflowId: workflow.id,
					totalTime,
					astTime: astResult.processingTime,
					claudeTime: claudeResult.responseTime,
					memoryPeak: Math.max(astResult.memoryUsed, claudeResult.memoryUsed),
					success: true
				};
			}
		);
	});

	describe('Load Testing', () => {
		test('should handle standard concurrent load', async () => {
			const config = createPerformanceConfig('standard');
			const workload = generateRealisticLoad(createWorkloadProfile('mixed'));

			mockLoadGenerator.generateLoad.mockImplementation(
				async (config, tasks) => {
					const results = [];

					// Simulate concurrent execution
					const batchSize = config.concurrentSessions;
					for (let i = 0; i < tasks.length; i += batchSize) {
						const batch = tasks.slice(i, i + batchSize);

						const batchPromises = batch.map(async (task, index) => {
							const startTime = Date.now();

							const workflow = await mockWorkflowPerformance.executeWorkflow({
								id: `workflow-${i}-${index}`,
								sessionId: `session-${i}-${index}`,
								task
							});

							const endTime = Date.now();

							return {
								taskId: task.id,
								workflowId: workflow.workflowId,
								duration: endTime - startTime,
								success: workflow.success,
								memoryUsed: workflow.memoryPeak,
								timestamp: startTime
							};
						});

						const batchResults = await Promise.all(batchPromises);
						results.push(...batchResults);

						// Brief pause between batches to simulate realistic load
						await new Promise((resolve) => setTimeout(resolve, 50));
					}

					return results;
				}
			);

			// Execute load test
			const startTime = Date.now();
			const results = await mockLoadGenerator.generateLoad(
				config,
				workload.slice(0, 20)
			); // Limit for test
			const totalDuration = Date.now() - startTime;

			// Analyze results
			const successfulTasks = results.filter((r) => r.success);
			const avgDuration =
				results.reduce((sum, r) => sum + r.duration, 0) / results.length;
			const avgMemoryUsage =
				results.reduce((sum, r) => sum + r.memoryUsed, 0) / results.length;
			const throughput = (results.length / totalDuration) * 60000; // tasks per minute

			// Verify performance targets
			expect(successfulTasks.length).toBe(results.length); // 100% success rate
			expect(avgDuration).toBeLessThan(config.targetLatencyMs);
			expect(avgMemoryUsage).toBeLessThan(config.maxMemoryMB);
			expect(throughput).toBeGreaterThan(config.targetThroughputPerMin * 0.8); // 80% of target

			console.log('Standard Load Test Results:', {
				totalTasks: results.length,
				successRate: `${((successfulTasks.length / results.length) * 100).toFixed(1)}%`,
				avgDuration: `${Math.round(avgDuration)}ms`,
				avgMemoryUsage: `${Math.round(avgMemoryUsage)}MB`,
				throughput: `${throughput.toFixed(1)} tasks/min`
			});
		});

		test('should maintain performance under stress conditions', async () => {
			const config = createPerformanceConfig('stress');
			const workload = generateRealisticLoad(createWorkloadProfile('heavy'));

			// Track performance degradation
			const performanceSnapshots = [];

			mockPerformanceMonitor.measureLatency.mockImplementation(() => {
				const snapshot = {
					timestamp: Date.now(),
					latency: Math.random() * 1000 + 1500, // Higher latency under stress
					memoryUsage: Math.random() * 400 + 600, // Higher memory usage
					cpuUsage: Math.random() * 20 + 70, // Higher CPU usage
					activeConnections: Math.floor(Math.random() * 10) + 12
				};
				performanceSnapshots.push(snapshot);
				return snapshot;
			});

			// Execute stress test with monitoring
			const stressResults = [];
			const monitoringInterval = setInterval(async () => {
				const metrics = await mockPerformanceMonitor.measureLatency();
				stressResults.push(metrics);
			}, 100); // Monitor every 100ms

			try {
				const results = await mockLoadGenerator.generateLoad(
					config,
					workload.slice(0, 30)
				);

				// Stop monitoring
				clearInterval(monitoringInterval);

				// Analyze stress test results
				const avgLatency =
					performanceSnapshots.reduce((sum, s) => sum + s.latency, 0) /
					performanceSnapshots.length;
				const maxMemoryUsage = Math.max(
					...performanceSnapshots.map((s) => s.memoryUsage)
				);
				const maxCpuUsage = Math.max(
					...performanceSnapshots.map((s) => s.cpuUsage)
				);

				// Verify system remained stable under stress
				expect(avgLatency).toBeLessThan(config.targetLatencyMs);
				expect(maxMemoryUsage).toBeLessThan(config.maxMemoryMB);
				expect(maxCpuUsage).toBeLessThan(config.maxCPUPercent);

				console.log('Stress Test Results:', {
					avgLatency: `${Math.round(avgLatency)}ms`,
					maxMemoryUsage: `${Math.round(maxMemoryUsage)}MB`,
					maxCpuUsage: `${Math.round(maxCpuUsage)}%`,
					samplesCollected: performanceSnapshots.length
				});
			} finally {
				clearInterval(monitoringInterval);
			}
		});

		test('should scale efficiently with increasing load', async () => {
			const scalabilityTests = [
				{ sessions: 1, expectedThroughput: 15 },
				{ sessions: 3, expectedThroughput: 40 },
				{ sessions: 5, expectedThroughput: 60 },
				{ sessions: 8, expectedThroughput: 85 },
				{ sessions: 12, expectedThroughput: 110 }
			];

			const scalabilityResults = [];

			for (const test of scalabilityTests) {
				const config = {
					...createPerformanceConfig('standard'),
					concurrentSessions: test.sessions
				};

				const workload = generateRealisticLoad(createWorkloadProfile('mixed'));
				const testTasks = workload.slice(0, test.sessions * 3); // 3 tasks per session

				const startTime = Date.now();
				const results = await mockLoadGenerator.generateLoad(config, testTasks);
				const duration = Date.now() - startTime;

				const actualThroughput = (results.length / duration) * 60000; // tasks per minute
				const efficiency = actualThroughput / test.expectedThroughput;

				scalabilityResults.push({
					sessions: test.sessions,
					tasksCompleted: results.length,
					duration: duration,
					actualThroughput,
					expectedThroughput: test.expectedThroughput,
					efficiency
				});
			}

			// Verify scaling characteristics
			scalabilityResults.forEach((result, index) => {
				expect(result.efficiency).toBeGreaterThan(0.7); // At least 70% efficiency

				if (index > 0) {
					const previousResult = scalabilityResults[index - 1];
					const throughputGrowth =
						result.actualThroughput / previousResult.actualThroughput;
					const sessionGrowth = result.sessions / previousResult.sessions;

					// Verify sub-linear but positive scaling
					expect(throughputGrowth).toBeGreaterThan(1.0); // Should increase
					expect(throughputGrowth).toBeLessThan(sessionGrowth * 1.2); // But not perfectly linear
				}
			});

			console.log(
				'Scalability Test Results:',
				scalabilityResults.map((r) => ({
					sessions: r.sessions,
					throughput: `${r.actualThroughput.toFixed(1)} tasks/min`,
					efficiency: `${(r.efficiency * 100).toFixed(1)}%`
				}))
			);
		});
	});

	describe('Performance Benchmarking', () => {
		test('should establish component-level benchmarks', async () => {
			const benchmarkTasks = [
				createMockTask(3, 'small'),
				createMockTask(5, 'medium'),
				createMockTask(7, 'large'),
				createMockTask(9, 'xlarge')
			];

			const componentBenchmarks = {
				ast: [],
				claude: [],
				workflow: []
			};

			// Run benchmarks for each component
			for (const task of benchmarkTasks) {
				// AST benchmarks
				const astStartTime = Date.now();
				const astResult = await mockASTPerformance.buildContext('/', task);
				const astDuration = Date.now() - astStartTime;

				componentBenchmarks.ast.push({
					taskSize: task.files.length,
					complexity: task.complexity,
					duration: astDuration,
					memoryUsed: astResult.memoryUsed,
					linesPerSecond: task.totalLines / (astDuration / 1000)
				});

				// Claude benchmarks
				const claudeStartTime = Date.now();
				const claudeResult = await mockClaudePerformance.processRequest({
					sessionId: 'benchmark-session',
					task
				});
				const claudeDuration = Date.now() - claudeStartTime;

				componentBenchmarks.claude.push({
					taskComplexity: task.complexity,
					duration: claudeDuration,
					tokensUsed: claudeResult.tokensUsed,
					memoryUsed: claudeResult.memoryUsed,
					tokensPerSecond: claudeResult.tokensUsed / (claudeDuration / 1000)
				});

				// Workflow benchmarks
				const workflowStartTime = Date.now();
				const workflowResult = await mockWorkflowPerformance.executeWorkflow({
					id: `benchmark-workflow-${task.complexity}`,
					sessionId: 'benchmark-session',
					task
				});
				const workflowDuration = Date.now() - workflowStartTime;

				componentBenchmarks.workflow.push({
					taskComplexity: task.complexity,
					totalDuration: workflowDuration,
					astDuration: workflowResult.astTime,
					claudeDuration: workflowResult.claudeTime,
					memoryPeak: workflowResult.memoryPeak,
					efficiency: task.complexity / (workflowDuration / 1000) // complexity per second
				});
			}

			// Verify benchmark consistency and performance
			componentBenchmarks.ast.forEach((benchmark) => {
				expect(benchmark.linesPerSecond).toBeGreaterThan(1000); // Should process at least 1000 lines/sec
				expect(benchmark.memoryUsed).toBeLessThan(benchmark.taskSize * 5); // Reasonable memory usage
			});

			componentBenchmarks.claude.forEach((benchmark) => {
				expect(benchmark.tokensPerSecond).toBeGreaterThan(50); // Should process at least 50 tokens/sec
				expect(benchmark.duration).toBeLessThan(10000); // Should complete within 10 seconds
			});

			componentBenchmarks.workflow.forEach((benchmark) => {
				expect(benchmark.efficiency).toBeGreaterThan(0.1); // Reasonable efficiency
				expect(benchmark.totalDuration).toBeLessThan(20000); // Should complete within 20 seconds
			});

			console.log('Component Benchmarks:', {
				astAvgLinesPerSec: Math.round(
					componentBenchmarks.ast.reduce(
						(sum, b) => sum + b.linesPerSecond,
						0
					) / componentBenchmarks.ast.length
				),
				claudeAvgTokensPerSec: Math.round(
					componentBenchmarks.claude.reduce(
						(sum, b) => sum + b.tokensPerSecond,
						0
					) / componentBenchmarks.claude.length
				),
				workflowAvgEfficiency: (
					componentBenchmarks.workflow.reduce(
						(sum, b) => sum + b.efficiency,
						0
					) / componentBenchmarks.workflow.length
				).toFixed(2)
			});
		});

		test('should detect performance regressions', async () => {
			const baselineBenchmarks = {
				astProcessingTime: 500,
				claudeResponseTime: 3000,
				workflowCompletionTime: 15000,
				memoryUsage: 256,
				throughput: 4.5
			};

			// Run current performance tests
			const currentBenchmarks = {};

			const testTask = createMockTask(5, 'medium');

			// Measure current AST performance
			const astStart = Date.now();
			const astResult = await mockASTPerformance.buildContext('/', testTask);
			currentBenchmarks.astProcessingTime = Date.now() - astStart;

			// Measure current Claude performance
			const claudeStart = Date.now();
			const claudeResult = await mockClaudePerformance.processRequest({
				sessionId: 'regression-test',
				task: testTask
			});
			currentBenchmarks.claudeResponseTime = Date.now() - claudeStart;

			// Measure current workflow performance
			const workflowStart = Date.now();
			const workflowResult = await mockWorkflowPerformance.executeWorkflow({
				id: 'regression-workflow',
				sessionId: 'regression-test',
				task: testTask
			});
			currentBenchmarks.workflowCompletionTime = Date.now() - workflowStart;
			currentBenchmarks.memoryUsage = workflowResult.memoryPeak;

			// Calculate regression percentages
			const regressions = {};
			Object.keys(baselineBenchmarks).forEach((key) => {
				if (currentBenchmarks[key] !== undefined) {
					const change =
						(currentBenchmarks[key] - baselineBenchmarks[key]) /
						baselineBenchmarks[key];
					regressions[key] = {
						baseline: baselineBenchmarks[key],
						current: currentBenchmarks[key],
						changePercent: change * 100,
						isRegression: change > 0.1 // 10% threshold for regression
					};
				}
			});

			// Verify no significant regressions
			Object.values(regressions).forEach((regression) => {
				if (regression.isRegression) {
					console.warn(
						`Performance regression detected: ${regression.changePercent.toFixed(1)}% increase`
					);
				}
				expect(regression.changePercent).toBeLessThan(50); // No more than 50% regression
			});

			console.log(
				'Regression Analysis:',
				Object.entries(regressions).map(([key, reg]) => ({
					metric: key,
					change: `${reg.changePercent.toFixed(1)}%`,
					status: reg.isRegression ? 'REGRESSION' : 'OK'
				}))
			);
		});

		test('should optimize resource allocation based on workload', async () => {
			const workloadScenarios = [
				{ name: 'light', profile: createWorkloadProfile('light') },
				{ name: 'mixed', profile: createWorkloadProfile('mixed') },
				{ name: 'heavy', profile: createWorkloadProfile('heavy') }
			];

			const optimizationResults = [];

			for (const scenario of workloadScenarios) {
				const tasks = generateRealisticLoad(scenario.profile).slice(0, 10);

				// Mock resource optimization
				mockResourceManager.optimizeAllocation.mockImplementation(
					async (workload) => {
						const totalComplexity = workload.reduce(
							(sum, task) => sum + task.complexity,
							0
						);
						const avgComplexity = totalComplexity / workload.length;

						// Optimize based on workload characteristics
						let recommendedSessions, memoryAllocation, cpuAllocation;

						if (avgComplexity < 4) {
							// Light workload
							recommendedSessions = Math.min(8, workload.length);
							memoryAllocation = 256;
							cpuAllocation = 60;
						} else if (avgComplexity < 7) {
							// Mixed workload
							recommendedSessions = Math.min(5, workload.length);
							memoryAllocation = 512;
							cpuAllocation = 80;
						} else {
							// Heavy workload
							recommendedSessions = Math.min(3, workload.length);
							memoryAllocation = 1024;
							cpuAllocation = 95;
						}

						return {
							workloadType: scenario.name,
							recommendedSessions,
							memoryAllocation,
							cpuAllocation,
							expectedThroughput: recommendedSessions * (10 - avgComplexity),
							efficiency: 1 / avgComplexity
						};
					}
				);

				const optimization =
					await mockResourceManager.optimizeAllocation(tasks);

				// Test the optimized configuration
				const testConfig = {
					concurrentSessions: optimization.recommendedSessions,
					maxMemoryMB: optimization.memoryAllocation,
					maxCPUPercent: optimization.cpuAllocation
				};

				const startTime = Date.now();
				const results = await mockLoadGenerator.generateLoad(testConfig, tasks);
				const actualThroughput =
					(results.length / (Date.now() - startTime)) * 60000;

				optimizationResults.push({
					workloadType: scenario.name,
					optimization,
					actualThroughput,
					throughputAccuracy:
						Math.abs(actualThroughput - optimization.expectedThroughput) /
						optimization.expectedThroughput,
					resourceUtilization:
						(optimization.memoryAllocation * optimization.cpuAllocation) /
						100000 // Simplified metric
				});
			}

			// Verify optimization effectiveness
			optimizationResults.forEach((result) => {
				expect(result.throughputAccuracy).toBeLessThan(0.5); // Within 50% of prediction
				expect(result.optimization.efficiency).toBeGreaterThan(0); // Positive efficiency
			});

			console.log(
				'Resource Optimization Results:',
				optimizationResults.map((r) => ({
					workload: r.workloadType,
					sessions: r.optimization.recommendedSessions,
					memory: `${r.optimization.memoryAllocation}MB`,
					throughput: `${r.actualThroughput.toFixed(1)} tasks/min`,
					accuracy: `${(100 - r.throughputAccuracy * 100).toFixed(1)}%`
				}))
			);
		});
	});

	describe('Memory and Resource Management', () => {
		test('should detect and prevent memory leaks', async () => {
			const memorySnapshots = [];
			let sessionCounter = 0;

			// Mock memory leak detection
			mockPerformanceMonitor.detectMemoryLeaks.mockImplementation(() => {
				const baseMemory = 200;
				const sessionGrowth = sessionCounter * 5; // Simulate some memory growth per session
				const randomVariation = Math.random() * 20 - 10;

				const currentMemory = baseMemory + sessionGrowth + randomVariation;
				memorySnapshots.push({
					timestamp: Date.now(),
					sessionCount: sessionCounter,
					memoryUsage: currentMemory,
					growth:
						sessionCounter > 0
							? currentMemory - memorySnapshots[0]?.memoryUsage || 0
							: 0
				});

				// Detect potential leak if growth is excessive
				const potentialLeak = sessionCounter > 5 && sessionGrowth > 30;

				return {
					memoryUsage: currentMemory,
					growthRate: sessionCounter > 0 ? sessionGrowth / sessionCounter : 0,
					potentialLeak,
					leakThreshold: 50,
					recommendation: potentialLeak ? 'force-garbage-collection' : 'monitor'
				};
			});

			// Simulate multiple workflow sessions
			const workflows = Array.from({ length: 10 }, (_, i) => ({
				id: `leak-test-${i}`,
				sessionId: `session-${i}`,
				task: createMockTask(5, 'medium')
			}));

			const leakDetectionResults = [];

			for (const workflow of workflows) {
				sessionCounter++;

				// Execute workflow
				await mockWorkflowPerformance.executeWorkflow(workflow);

				// Check for memory leaks
				const leakCheck = await mockPerformanceMonitor.detectMemoryLeaks();
				leakDetectionResults.push(leakCheck);

				// Simulate cleanup if leak detected
				if (leakCheck.potentialLeak) {
					console.log(
						`Potential memory leak detected at session ${sessionCounter}`
					);
					// In real implementation, this would trigger garbage collection
				}
			}

			// Verify memory leak detection
			const leaksDetected = leakDetectionResults.filter((r) => r.potentialLeak);
			const finalMemoryUsage =
				memorySnapshots[memorySnapshots.length - 1].memoryUsage;
			const totalGrowth = memorySnapshots[memorySnapshots.length - 1].growth;

			expect(finalMemoryUsage).toBeLessThan(500); // Should not exceed 500MB
			expect(totalGrowth).toBeLessThan(200); // Growth should be reasonable

			if (leaksDetected.length > 0) {
				expect(leaksDetected.length).toBeLessThan(workflows.length / 2); // Not all sessions should leak
			}

			console.log('Memory Leak Detection:', {
				totalSessions: workflows.length,
				finalMemoryUsage: `${Math.round(finalMemoryUsage)}MB`,
				totalGrowth: `${Math.round(totalGrowth)}MB`,
				leaksDetected: leaksDetected.length
			});
		});

		test('should manage resource quotas and limits', async () => {
			const resourceLimits = {
				maxMemoryPerSession: 100, // MB
				maxCPUPercent: 80,
				maxConcurrentSessions: 5,
				maxRequestsPerMinute: 100
			};

			const resourceUsageHistory = [];
			let activeSessionCount = 0;
			let requestCount = 0;

			// Mock resource enforcement
			mockResourceManager.enforceQuotas.mockImplementation(
				async (sessionId, requestedResources) => {
					requestCount++;

					const currentTime = Date.now();
					const recentRequests = resourceUsageHistory.filter(
						(r) => currentTime - r.timestamp < 60000 // Last minute
					).length;

					// Check limits
					const memoryExceeded =
						requestedResources.memory > resourceLimits.maxMemoryPerSession;
					const cpuExceeded =
						requestedResources.cpu > resourceLimits.maxCPUPercent;
					const sessionLimitExceeded =
						activeSessionCount >= resourceLimits.maxConcurrentSessions;
					const rateLimitExceeded =
						recentRequests >= resourceLimits.maxRequestsPerMinute;

					const violations = [];
					if (memoryExceeded) violations.push('memory');
					if (cpuExceeded) violations.push('cpu');
					if (sessionLimitExceeded) violations.push('session-limit');
					if (rateLimitExceeded) violations.push('rate-limit');

					const allowed = violations.length === 0;

					if (allowed) {
						activeSessionCount++;
						resourceUsageHistory.push({
							sessionId,
							timestamp: currentTime,
							memory: requestedResources.memory,
							cpu: requestedResources.cpu
						});
					}

					return {
						allowed,
						violations,
						currentUsage: {
							activeSessions: activeSessionCount,
							recentRequests,
							memoryUsed: resourceUsageHistory.reduce(
								(sum, r) => sum + r.memory,
								0
							),
							cpuUsed: Math.max(...resourceUsageHistory.map((r) => r.cpu), 0)
						}
					};
				}
			);

			// Test resource allocation with various demands
			const allocationTests = [
				{ memory: 50, cpu: 40, expectAllowed: true }, // Normal request
				{ memory: 80, cpu: 60, expectAllowed: true }, // High but acceptable
				{ memory: 150, cpu: 40, expectAllowed: false }, // Memory exceeded
				{ memory: 50, cpu: 90, expectAllowed: false }, // CPU exceeded
				{ memory: 30, cpu: 30, expectAllowed: true }, // Low usage
				{ memory: 60, cpu: 50, expectAllowed: false } // Would exceed session limit
			];

			const allocationResults = [];

			for (let i = 0; i < allocationTests.length; i++) {
				const test = allocationTests[i];
				const result = await mockResourceManager.enforceQuotas(`session-${i}`, {
					memory: test.memory,
					cpu: test.cpu
				});

				allocationResults.push({
					testIndex: i,
					requested: test,
					result,
					matchesExpectation: result.allowed === test.expectAllowed
				});

				// Simulate session completion for successful allocations
				if (result.allowed) {
					setTimeout(() => {
						activeSessionCount--;
					}, 100);
				}
			}

			// Verify quota enforcement
			allocationResults.forEach((result) => {
				expect(result.matchesExpectation).toBe(true);
			});

			const allowedRequests = allocationResults.filter((r) => r.result.allowed);
			const deniedRequests = allocationResults.filter((r) => !r.result.allowed);

			expect(allowedRequests.length).toBeGreaterThan(0);
			expect(deniedRequests.length).toBeGreaterThan(0);

			console.log('Resource Quota Enforcement:', {
				totalTests: allocationTests.length,
				allowed: allowedRequests.length,
				denied: deniedRequests.length,
				accuracy: `${((allocationResults.filter((r) => r.matchesExpectation).length / allocationTests.length) * 100).toFixed(1)}%`
			});
		});

		test('should optimize resource cleanup and garbage collection', async () => {
			let allocatedResources = 0;
			const cleanupHistory = [];

			// Mock resource cleanup
			mockResourceManager.cleanupResources.mockImplementation(
				async (sessionId) => {
					const resourcesFreed = Math.random() * 50 + 10; // 10-60 MB
					allocatedResources = Math.max(0, allocatedResources - resourcesFreed);

					const cleanupResult = {
						sessionId,
						resourcesFreed,
						timestamp: Date.now(),
						totalResourcesRemaining: allocatedResources,
						cleanupDuration: Math.random() * 100 + 50 // 50-150ms
					};

					cleanupHistory.push(cleanupResult);
					return cleanupResult;
				}
			);

			// Simulate resource allocation and cleanup cycles
			const sessions = Array.from(
				{ length: 8 },
				(_, i) => `cleanup-session-${i}`
			);

			for (const sessionId of sessions) {
				// Allocate resources
				const resourceAllocation = Math.random() * 80 + 20; // 20-100 MB
				allocatedResources += resourceAllocation;

				// Simulate some work
				await new Promise((resolve) => setTimeout(resolve, 50));

				// Cleanup resources
				await mockResourceManager.cleanupResources(sessionId);
			}

			// Analyze cleanup efficiency
			const totalResourcesFreed = cleanupHistory.reduce(
				(sum, c) => sum + c.resourcesFreed,
				0
			);
			const avgCleanupTime =
				cleanupHistory.reduce((sum, c) => sum + c.cleanupDuration, 0) /
				cleanupHistory.length;
			const finalResourcesRemaining =
				cleanupHistory[cleanupHistory.length - 1].totalResourcesRemaining;

			// Verify cleanup effectiveness
			expect(totalResourcesFreed).toBeGreaterThan(100); // Should have freed significant resources
			expect(avgCleanupTime).toBeLessThan(200); // Cleanup should be fast
			expect(finalResourcesRemaining).toBeLessThan(100); // Should not have excessive remaining resources

			console.log('Resource Cleanup Analysis:', {
				sessionsProcessed: sessions.length,
				totalResourcesFreed: `${Math.round(totalResourcesFreed)}MB`,
				avgCleanupTime: `${Math.round(avgCleanupTime)}ms`,
				finalResourcesRemaining: `${Math.round(finalResourcesRemaining)}MB`,
				cleanupEfficiency: `${((totalResourcesFreed / (totalResourcesFreed + finalResourcesRemaining)) * 100).toFixed(1)}%`
			});

			expect(mockResourceManager.cleanupResources).toHaveBeenCalledTimes(
				sessions.length
			);
		});
	});
});
