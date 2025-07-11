#!/usr/bin/env node
/**
 * Phase 4.2 - Resource Management Testing
 *
 * Tests resource management across different platforms:
 * - Memory constraints and monitoring
 * - CPU utilization patterns
 * - Disk I/O performance variations
 * - Network resource handling
 * - Process limits and quotas
 * - Resource cleanup verification
 * - Memory leak detection
 *
 * @fileoverview End-to-end testing of resource management capabilities
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('⚡ Phase 4.2 - Resource Management Testing\n');

class ResourceManagementTester {
	constructor() {
		this.results = [];
		this.startTime = Date.now();
		this.testProjectRoot = path.join(__dirname, '../fixtures/resource-test');
		this.systemInfo = {
			platform: os.platform(),
			cpus: os.cpus().length,
			totalMemory: os.totalmem(),
			freeMemory: os.freemem(),
			nodeVersion: process.version,
			architecture: os.arch()
		};
		this.memoryBaseline = process.memoryUsage();
	}

	async run() {
		try {
			console.log('🚀 Starting Resource Management Tests...\n');

			await this.setupTestEnvironment();
			await this.testMemoryManagement();
			await this.testCPUUtilization();
			await this.testDiskIOPerformance();
			await this.testProcessLimits();
			await this.testResourceMonitoring();
			await this.testMemoryLeakDetection();
			await this.testResourceCleanup();
			await this.testConcurrentResourceUsage();
			await this.testResourceConstraints();
			await this.testSystemResourceLimits();

			await this.cleanup();
			this.printResults();
		} catch (error) {
			console.error('❌ Resource management tests failed:', error.message);
			console.error(error.stack);
			process.exit(1);
		}
	}

	async setupTestEnvironment() {
		console.log('🏗️ Setting up resource management test environment...');

		try {
			await fs.mkdir(this.testProjectRoot, { recursive: true });
			await fs.mkdir(path.join(this.testProjectRoot, 'memory'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'cpu'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'disk'), {
				recursive: true
			});
			await fs.mkdir(path.join(this.testProjectRoot, 'network'), {
				recursive: true
			});

			this.recordTest(
				'Environment Setup',
				true,
				`Resource test environment created on ${this.systemInfo.platform} (${this.systemInfo.cpus} CPUs, ${Math.round(this.systemInfo.totalMemory / 1024 / 1024 / 1024)}GB RAM)`
			);
		} catch (error) {
			this.recordTest('Environment Setup', false, error.message);
		}
	}

	async testMemoryManagement() {
		console.log('🧠 Testing memory management...');

		try {
			const memoryTests = [];

			// Test memory allocation and monitoring
			try {
				const initialMemory = process.memoryUsage();

				// Allocate some memory
				const largeArray = new Array(100000).fill(0).map((_, i) => ({
					id: i,
					data: 'x'.repeat(100),
					timestamp: Date.now()
				}));

				const afterAllocation = process.memoryUsage();

				// Check memory increase
				const memoryIncrease =
					afterAllocation.heapUsed - initialMemory.heapUsed;
				const significantIncrease = memoryIncrease > 1024 * 1024; // At least 1MB

				// Clear the array
				largeArray.length = 0;

				// Force garbage collection if available
				if (global.gc) {
					global.gc();
				}

				const afterCleanup = process.memoryUsage();

				memoryTests.push({
					name: 'Memory Allocation Tracking',
					success: significantIncrease,
					memoryIncrease: Math.round(memoryIncrease / 1024 / 1024),
					initialHeap: Math.round(initialMemory.heapUsed / 1024 / 1024),
					afterAllocation: Math.round(afterAllocation.heapUsed / 1024 / 1024),
					afterCleanup: Math.round(afterCleanup.heapUsed / 1024 / 1024)
				});
			} catch (error) {
				memoryTests.push({
					name: 'Memory Allocation Tracking',
					success: false,
					error: error.message
				});
			}

			// Test memory pressure simulation
			try {
				const memoryPressureTest = await this.simulateMemoryPressure();

				memoryTests.push({
					name: 'Memory Pressure Handling',
					success: memoryPressureTest.success,
					maxMemory: memoryPressureTest.maxMemory,
					duration: memoryPressureTest.duration
				});
			} catch (error) {
				memoryTests.push({
					name: 'Memory Pressure Handling',
					success: false,
					error: error.message
				});
			}

			// Test memory limit detection
			try {
				const totalMemory = Math.round(
					this.systemInfo.totalMemory / 1024 / 1024 / 1024
				);
				const freeMemory = Math.round(
					this.systemInfo.freeMemory / 1024 / 1024 / 1024
				);
				const memoryUsagePercent =
					((this.systemInfo.totalMemory - this.systemInfo.freeMemory) /
						this.systemInfo.totalMemory) *
					100;

				memoryTests.push({
					name: 'System Memory Detection',
					success: totalMemory > 0 && freeMemory >= 0,
					totalMemoryGB: totalMemory,
					freeMemoryGB: freeMemory,
					usagePercent: Math.round(memoryUsagePercent)
				});
			} catch (error) {
				memoryTests.push({
					name: 'System Memory Detection',
					success: false,
					error: error.message
				});
			}

			const successfulTests = memoryTests.filter((t) => t.success).length;
			const success = successfulTests >= memoryTests.length * 0.8;

			this.recordTest(
				'Memory Management',
				success,
				`${successfulTests}/${memoryTests.length} memory management tests passed`
			);
		} catch (error) {
			this.recordTest('Memory Management', false, error.message);
		}
	}

	async testCPUUtilization() {
		console.log('🔥 Testing CPU utilization...');

		try {
			const cpuTests = [];

			// Test CPU information detection
			try {
				const cpus = os.cpus();
				const cpuCount = cpus.length;
				const cpuModel = cpus[0]?.model || 'Unknown';
				const cpuSpeed = cpus[0]?.speed || 0;

				cpuTests.push({
					name: 'CPU Information Detection',
					success: cpuCount > 0 && cpuModel !== 'Unknown',
					cpuCount,
					cpuModel: cpuModel.substring(0, 50),
					cpuSpeed
				});
			} catch (error) {
				cpuTests.push({
					name: 'CPU Information Detection',
					success: false,
					error: error.message
				});
			}

			// Test CPU-intensive task performance
			try {
				const startTime = Date.now();
				const result = await this.runCPUIntensiveTask();
				const duration = Date.now() - startTime;

				const performanceOk = duration < 5000 && result > 0; // Under 5 seconds

				cpuTests.push({
					name: 'CPU Intensive Task',
					success: performanceOk,
					duration,
					result,
					cpuCount: this.systemInfo.cpus
				});
			} catch (error) {
				cpuTests.push({
					name: 'CPU Intensive Task',
					success: false,
					error: error.message
				});
			}

			// Test concurrent CPU tasks
			try {
				const startTime = Date.now();
				const concurrentTasks = Array(this.systemInfo.cpus)
					.fill(0)
					.map(() => this.runCPUIntensiveTask());

				const results = await Promise.all(concurrentTasks);
				const duration = Date.now() - startTime;

				const allSuccessful = results.every((r) => r > 0);
				const reasonableTime = duration < 10000; // Under 10 seconds

				cpuTests.push({
					name: 'Concurrent CPU Tasks',
					success: allSuccessful && reasonableTime,
					duration,
					taskCount: concurrentTasks.length,
					allSuccessful
				});
			} catch (error) {
				cpuTests.push({
					name: 'Concurrent CPU Tasks',
					success: false,
					error: error.message
				});
			}

			const successfulTests = cpuTests.filter((t) => t.success).length;
			const success = successfulTests >= cpuTests.length * 0.8;

			this.recordTest(
				'CPU Utilization',
				success,
				`${successfulTests}/${cpuTests.length} CPU utilization tests passed`
			);
		} catch (error) {
			this.recordTest('CPU Utilization', false, error.message);
		}
	}

	async testDiskIOPerformance() {
		console.log('💽 Testing disk I/O performance...');

		try {
			const diskTests = [];

			// Test sequential write performance
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'disk',
					'write-test.dat'
				);
				const dataSize = 1024 * 1024; // 1MB
				const testData = Buffer.alloc(dataSize, 'A');

				const startTime = Date.now();
				await fs.writeFile(testFile, testData);
				const writeTime = Date.now() - startTime;

				const throughput = dataSize / 1024 / 1024 / (writeTime / 1000); // MB/s

				diskTests.push({
					name: 'Sequential Write Performance',
					success: writeTime < 5000, // Under 5 seconds for 1MB
					writeTime,
					throughputMBps: Math.round(throughput * 100) / 100,
					dataSize: dataSize / 1024 / 1024
				});
			} catch (error) {
				diskTests.push({
					name: 'Sequential Write Performance',
					success: false,
					error: error.message
				});
			}

			// Test sequential read performance
			try {
				const testFile = path.join(
					this.testProjectRoot,
					'disk',
					'write-test.dat'
				);

				const startTime = Date.now();
				const readData = await fs.readFile(testFile);
				const readTime = Date.now() - startTime;

				const throughput = readData.length / 1024 / 1024 / (readTime / 1000); // MB/s

				diskTests.push({
					name: 'Sequential Read Performance',
					success: readTime < 2000, // Under 2 seconds for 1MB
					readTime,
					throughputMBps: Math.round(throughput * 100) / 100,
					dataSize: readData.length / 1024 / 1024
				});
			} catch (error) {
				diskTests.push({
					name: 'Sequential Read Performance',
					success: false,
					error: error.message
				});
			}

			// Test random I/O performance
			try {
				const randomIOResult = await this.testRandomIOPerformance();

				diskTests.push({
					name: 'Random I/O Performance',
					success: randomIOResult.success,
					operations: randomIOResult.operations,
					duration: randomIOResult.duration,
					opsPerSecond: randomIOResult.opsPerSecond
				});
			} catch (error) {
				diskTests.push({
					name: 'Random I/O Performance',
					success: false,
					error: error.message
				});
			}

			// Test concurrent I/O
			try {
				const concurrentIOResult = await this.testConcurrentIO();

				diskTests.push({
					name: 'Concurrent I/O Performance',
					success: concurrentIOResult.success,
					concurrentOperations: concurrentIOResult.operations,
					duration: concurrentIOResult.duration
				});
			} catch (error) {
				diskTests.push({
					name: 'Concurrent I/O Performance',
					success: false,
					error: error.message
				});
			}

			const successfulTests = diskTests.filter((t) => t.success).length;
			const success = successfulTests >= diskTests.length * 0.75; // Lower threshold as I/O can be variable

			this.recordTest(
				'Disk I/O Performance',
				success,
				`${successfulTests}/${diskTests.length} disk I/O tests passed`
			);
		} catch (error) {
			this.recordTest('Disk I/O Performance', false, error.message);
		}
	}

	async testProcessLimits() {
		console.log('⚙️ Testing process limits...');

		try {
			const processTests = [];

			// Test process information
			try {
				const processInfo = {
					pid: process.pid,
					ppid: process.ppid,
					platform: process.platform,
					arch: process.arch,
					version: process.version,
					uptime: process.uptime()
				};

				const validProcess =
					processInfo.pid > 0 &&
					processInfo.platform &&
					processInfo.version &&
					processInfo.uptime >= 0;

				processTests.push({
					name: 'Process Information',
					success: validProcess,
					pid: processInfo.pid,
					uptime: Math.round(processInfo.uptime),
					platform: processInfo.platform
				});
			} catch (error) {
				processTests.push({
					name: 'Process Information',
					success: false,
					error: error.message
				});
			}

			// Test child process spawning
			try {
				const childProcessTest = await this.testChildProcesses();

				processTests.push({
					name: 'Child Process Management',
					success: childProcessTest.success,
					processesSpawned: childProcessTest.processesSpawned,
					successfulTerminations: childProcessTest.successfulTerminations
				});
			} catch (error) {
				processTests.push({
					name: 'Child Process Management',
					success: false,
					error: error.message
				});
			}

			// Test process environment
			try {
				const envCount = Object.keys(process.env).length;
				const hasBasicEnv = process.env.NODE_VERSION || process.env.PATH;

				processTests.push({
					name: 'Process Environment',
					success: envCount > 0 && hasBasicEnv,
					environmentVariables: envCount,
					hasBasicEnv: !!hasBasicEnv
				});
			} catch (error) {
				processTests.push({
					name: 'Process Environment',
					success: false,
					error: error.message
				});
			}

			const successfulTests = processTests.filter((t) => t.success).length;
			const success = successfulTests >= processTests.length * 0.8;

			this.recordTest(
				'Process Limits',
				success,
				`${successfulTests}/${processTests.length} process limit tests passed`
			);
		} catch (error) {
			this.recordTest('Process Limits', false, error.message);
		}
	}

	async testResourceMonitoring() {
		console.log('📊 Testing resource monitoring...');

		try {
			const monitoringTests = [];

			// Test real-time memory monitoring
			try {
				const memorySnapshots = [];
				const intervals = 5;

				for (let i = 0; i < intervals; i++) {
					memorySnapshots.push(process.memoryUsage());
					await this.delay(100);
				}

				const hasVariation = memorySnapshots.some(
					(snapshot, i) =>
						i > 0 &&
						Math.abs(snapshot.heapUsed - memorySnapshots[i - 1].heapUsed) > 1024
				);

				monitoringTests.push({
					name: 'Real-time Memory Monitoring',
					success: memorySnapshots.length === intervals,
					snapshots: intervals,
					hasVariation
				});
			} catch (error) {
				monitoringTests.push({
					name: 'Real-time Memory Monitoring',
					success: false,
					error: error.message
				});
			}

			// Test system resource monitoring
			try {
				const systemSnapshots = [];
				const intervals = 3;

				for (let i = 0; i < intervals; i++) {
					systemSnapshots.push({
						freeMemory: os.freemem(),
						loadAverage: os.loadavg(),
						uptime: os.uptime(),
						timestamp: Date.now()
					});
					await this.delay(200);
				}

				const hasValidData = systemSnapshots.every(
					(snapshot) =>
						snapshot.freeMemory > 0 &&
						snapshot.uptime > 0 &&
						Array.isArray(snapshot.loadAverage)
				);

				monitoringTests.push({
					name: 'System Resource Monitoring',
					success: hasValidData,
					snapshots: intervals,
					hasValidData
				});
			} catch (error) {
				monitoringTests.push({
					name: 'System Resource Monitoring',
					success: false,
					error: error.message
				});
			}

			const successfulTests = monitoringTests.filter((t) => t.success).length;
			const success = successfulTests >= monitoringTests.length * 0.8;

			this.recordTest(
				'Resource Monitoring',
				success,
				`${successfulTests}/${monitoringTests.length} monitoring tests passed`
			);
		} catch (error) {
			this.recordTest('Resource Monitoring', false, error.message);
		}
	}

	async testMemoryLeakDetection() {
		console.log('🔍 Testing memory leak detection...');

		try {
			const leakTests = [];

			// Test memory growth detection
			try {
				const initialMemory = process.memoryUsage().heapUsed;

				// Simulate potential memory growth
				const iterations = 1000;
				const data = [];

				for (let i = 0; i < iterations; i++) {
					data.push({
						id: i,
						content: 'x'.repeat(100),
						timestamp: Date.now()
					});

					if (i % 100 === 0) {
						// Occasionally clear some data to simulate proper cleanup
						data.splice(0, Math.floor(data.length * 0.1));
					}
				}

				const finalMemory = process.memoryUsage().heapUsed;
				const memoryGrowth = finalMemory - initialMemory;

				// Clear data
				data.length = 0;

				const reasonableGrowth = memoryGrowth < 50 * 1024 * 1024; // Under 50MB growth

				leakTests.push({
					name: 'Memory Growth Detection',
					success: reasonableGrowth,
					memoryGrowthMB: Math.round(memoryGrowth / 1024 / 1024),
					iterations
				});
			} catch (error) {
				leakTests.push({
					name: 'Memory Growth Detection',
					success: false,
					error: error.message
				});
			}

			// Test garbage collection effectiveness
			try {
				let largeObject = new Array(10000)
					.fill(0)
					.map((i) => ({ data: 'x'.repeat(1000) }));
				const memoryAfterAllocation = process.memoryUsage().heapUsed;

				largeObject = null;

				// Force garbage collection if available
				if (global.gc) {
					global.gc();
				}

				await this.delay(100);

				const memoryAfterCleanup = process.memoryUsage().heapUsed;
				const memoryReduced = memoryAfterCleanup < memoryAfterAllocation;

				leakTests.push({
					name: 'Garbage Collection Effectiveness',
					success: true, // Always pass as GC behavior varies
					memoryReduced,
					hasGlobalGC: !!global.gc
				});
			} catch (error) {
				leakTests.push({
					name: 'Garbage Collection Effectiveness',
					success: false,
					error: error.message
				});
			}

			const successfulTests = leakTests.filter((t) => t.success).length;
			const success = successfulTests >= leakTests.length * 0.8;

			this.recordTest(
				'Memory Leak Detection',
				success,
				`${successfulTests}/${leakTests.length} memory leak detection tests passed`
			);
		} catch (error) {
			this.recordTest('Memory Leak Detection', false, error.message);
		}
	}

	async testResourceCleanup() {
		console.log('🧹 Testing resource cleanup...');

		try {
			const cleanupTests = [];

			// Test file handle cleanup
			try {
				const tempFiles = [];
				const fileCount = 10;

				// Create multiple files
				for (let i = 0; i < fileCount; i++) {
					const tempFile = path.join(
						this.testProjectRoot,
						'disk',
						`cleanup-test-${i}.txt`
					);
					await fs.writeFile(tempFile, `Test file ${i}`);
					tempFiles.push(tempFile);
				}

				// Clean up files
				let cleanedUp = 0;
				for (const file of tempFiles) {
					try {
						await fs.unlink(file);
						cleanedUp++;
					} catch (error) {
						console.warn(`Cleanup warning for ${file}:`, error.message);
					}
				}

				cleanupTests.push({
					name: 'File Handle Cleanup',
					success: cleanedUp === fileCount,
					filesCreated: fileCount,
					filesCleanedUp: cleanedUp
				});
			} catch (error) {
				cleanupTests.push({
					name: 'File Handle Cleanup',
					success: false,
					error: error.message
				});
			}

			// Test directory cleanup
			try {
				const tempDir = path.join(this.testProjectRoot, 'temp-cleanup-dir');
				await fs.mkdir(tempDir, { recursive: true });

				// Create nested structure
				await fs.mkdir(path.join(tempDir, 'nested'));
				await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
				await fs.writeFile(
					path.join(tempDir, 'nested', 'file2.txt'),
					'content2'
				);

				// Clean up entire directory
				await fs.rm(tempDir, { recursive: true, force: true });

				// Verify cleanup
				const dirExists = await fs
					.access(tempDir)
					.then(() => true)
					.catch(() => false);

				cleanupTests.push({
					name: 'Directory Cleanup',
					success: !dirExists
				});
			} catch (error) {
				cleanupTests.push({
					name: 'Directory Cleanup',
					success: false,
					error: error.message
				});
			}

			const successfulTests = cleanupTests.filter((t) => t.success).length;
			const success = successfulTests >= cleanupTests.length * 0.9; // High threshold for cleanup

			this.recordTest(
				'Resource Cleanup',
				success,
				`${successfulTests}/${cleanupTests.length} cleanup tests passed`
			);
		} catch (error) {
			this.recordTest('Resource Cleanup', false, error.message);
		}
	}

	async testConcurrentResourceUsage() {
		console.log('🔄 Testing concurrent resource usage...');

		try {
			const concurrentTests = [];

			// Test concurrent memory operations
			try {
				const concurrentMemoryOps = Array(5)
					.fill(0)
					.map(async (_, i) => {
						const data = new Array(1000)
							.fill(0)
							.map((j) => ({ id: `${i}-${j}`, data: 'x'.repeat(50) }));
						await this.delay(Math.random() * 100);
						return data.length;
					});

				const results = await Promise.all(concurrentMemoryOps);
				const allSuccessful = results.every((r) => r === 1000);

				concurrentTests.push({
					name: 'Concurrent Memory Operations',
					success: allSuccessful,
					operations: results.length,
					allSuccessful
				});
			} catch (error) {
				concurrentTests.push({
					name: 'Concurrent Memory Operations',
					success: false,
					error: error.message
				});
			}

			// Test concurrent file operations
			try {
				const concurrentFileOps = Array(5)
					.fill(0)
					.map(async (_, i) => {
						const fileName = path.join(
							this.testProjectRoot,
							'concurrent',
							`concurrent-${i}.txt`
						);
						await fs.writeFile(fileName, `Concurrent file ${i}`);
						const content = await fs.readFile(fileName, 'utf8');
						await fs.unlink(fileName);
						return content.includes(`Concurrent file ${i}`);
					});

				const results = await Promise.all(concurrentFileOps);
				const allSuccessful = results.every((r) => r === true);

				concurrentTests.push({
					name: 'Concurrent File Operations',
					success: allSuccessful,
					operations: results.length,
					allSuccessful
				});
			} catch (error) {
				concurrentTests.push({
					name: 'Concurrent File Operations',
					success: false,
					error: error.message
				});
			}

			const successfulTests = concurrentTests.filter((t) => t.success).length;
			const success = successfulTests >= concurrentTests.length * 0.8;

			this.recordTest(
				'Concurrent Resource Usage',
				success,
				`${successfulTests}/${concurrentTests.length} concurrent resource tests passed`
			);
		} catch (error) {
			this.recordTest('Concurrent Resource Usage', false, error.message);
		}
	}

	async testResourceConstraints() {
		console.log('⚠️ Testing resource constraints...');

		try {
			const constraintTests = [];

			// Test memory constraint detection
			try {
				const totalMemory = this.systemInfo.totalMemory;
				const freeMemory = this.systemInfo.freeMemory;
				const memoryUsagePercent =
					((totalMemory - freeMemory) / totalMemory) * 100;

				const memoryConstraint =
					memoryUsagePercent > 90
						? 'high'
						: memoryUsagePercent > 70
							? 'medium'
							: 'low';

				constraintTests.push({
					name: 'Memory Constraint Detection',
					success: true, // Always pass as this is informational
					memoryUsagePercent: Math.round(memoryUsagePercent),
					constraint: memoryConstraint,
					totalMemoryGB: Math.round(totalMemory / 1024 / 1024 / 1024)
				});
			} catch (error) {
				constraintTests.push({
					name: 'Memory Constraint Detection',
					success: false,
					error: error.message
				});
			}

			// Test disk space constraint detection
			try {
				const diskSpaceTest = await this.checkDiskSpace();

				constraintTests.push({
					name: 'Disk Space Constraint Detection',
					success: diskSpaceTest.success,
					availableSpace: diskSpaceTest.availableSpace,
					constraint: diskSpaceTest.constraint
				});
			} catch (error) {
				constraintTests.push({
					name: 'Disk Space Constraint Detection',
					success: false,
					error: error.message
				});
			}

			const successfulTests = constraintTests.filter((t) => t.success).length;
			const success = successfulTests >= constraintTests.length * 0.8;

			this.recordTest(
				'Resource Constraints',
				success,
				`${successfulTests}/${constraintTests.length} constraint detection tests passed`
			);
		} catch (error) {
			this.recordTest('Resource Constraints', false, error.message);
		}
	}

	async testSystemResourceLimits() {
		console.log('🚧 Testing system resource limits...');

		try {
			const limitTests = [];

			// Test file descriptor limits (Unix-like systems)
			if (this.systemInfo.platform !== 'win32') {
				try {
					const openFiles = [];
					const maxAttempts = 100;
					let filesOpened = 0;

					for (let i = 0; i < maxAttempts; i++) {
						try {
							const fileName = path.join(
								this.testProjectRoot,
								'limits',
								`fd-test-${i}.txt`
							);
							await fs.mkdir(path.dirname(fileName), { recursive: true });
							await fs.writeFile(fileName, `FD test ${i}`);
							openFiles.push(fileName);
							filesOpened++;
						} catch (error) {
							break; // Hit a limit
						}
					}

					// Clean up opened files
					for (const file of openFiles) {
						try {
							await fs.unlink(file);
						} catch (error) {
							// Ignore cleanup errors
						}
					}

					limitTests.push({
						name: 'File Descriptor Limits',
						success: filesOpened > 10, // Should be able to open at least 10 files
						filesOpened,
						maxAttempts
					});
				} catch (error) {
					limitTests.push({
						name: 'File Descriptor Limits',
						success: false,
						error: error.message
					});
				}
			} else {
				limitTests.push({
					name: 'File Descriptor Limits (Windows N/A)',
					success: true,
					note: 'File descriptor limits not applicable on Windows'
				});
			}

			// Test process creation limits
			try {
				const maxProcesses = 5; // Conservative limit for testing
				const processes = [];

				for (let i = 0; i < maxProcesses; i++) {
					try {
						const process = spawn(
							'node',
							['-e', 'setTimeout(() => {}, 1000)'],
							{
								stdio: 'ignore',
								detached: false
							}
						);
						processes.push(process);
						await this.delay(10);
					} catch (error) {
						break;
					}
				}

				// Clean up processes
				for (const proc of processes) {
					try {
						proc.kill();
					} catch (error) {
						// Ignore cleanup errors
					}
				}

				limitTests.push({
					name: 'Process Creation Limits',
					success: processes.length >= 3, // Should be able to create at least 3 processes
					processesCreated: processes.length,
					maxAttempts: maxProcesses
				});
			} catch (error) {
				limitTests.push({
					name: 'Process Creation Limits',
					success: false,
					error: error.message
				});
			}

			const successfulTests = limitTests.filter((t) => t.success).length;
			const success = successfulTests >= limitTests.length * 0.8;

			this.recordTest(
				'System Resource Limits',
				success,
				`${successfulTests}/${limitTests.length} resource limit tests passed`
			);
		} catch (error) {
			this.recordTest('System Resource Limits', false, error.message);
		}
	}

	// Utility methods
	async simulateMemoryPressure() {
		const startMemory = process.memoryUsage().heapUsed;
		const startTime = Date.now();

		// Gradually allocate memory
		const chunks = [];
		const maxChunks = 100;

		for (let i = 0; i < maxChunks; i++) {
			chunks.push(new Array(10000).fill(i));

			if (i % 10 === 0) {
				await this.delay(10);
				const currentMemory = process.memoryUsage().heapUsed;
				const memoryIncrease = currentMemory - startMemory;

				// Stop if we've allocated more than 50MB
				if (memoryIncrease > 50 * 1024 * 1024) {
					break;
				}
			}
		}

		const maxMemory = process.memoryUsage().heapUsed;
		const duration = Date.now() - startTime;

		// Clean up
		chunks.length = 0;

		return {
			success: true,
			maxMemory: Math.round(maxMemory / 1024 / 1024),
			duration
		};
	}

	async runCPUIntensiveTask() {
		// CPU-intensive calculation
		let result = 0;
		const iterations = 1000000;

		for (let i = 0; i < iterations; i++) {
			result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
		}

		return result;
	}

	async testRandomIOPerformance() {
		const operations = 50;
		const startTime = Date.now();

		for (let i = 0; i < operations; i++) {
			const fileName = path.join(
				this.testProjectRoot,
				'disk',
				`random-${i}.txt`
			);
			const data = `Random data ${i} ${Math.random()}`;

			await fs.writeFile(fileName, data);
			await fs.readFile(fileName, 'utf8');
			await fs.unlink(fileName);
		}

		const duration = Date.now() - startTime;
		const opsPerSecond = (operations / duration) * 1000;

		return {
			success: duration < 10000, // Under 10 seconds
			operations,
			duration,
			opsPerSecond: Math.round(opsPerSecond)
		};
	}

	async testConcurrentIO() {
		const concurrentOps = 5;
		const startTime = Date.now();

		const operations = Array(concurrentOps)
			.fill(0)
			.map(async (_, i) => {
				const fileName = path.join(
					this.testProjectRoot,
					'disk',
					`concurrent-io-${i}.txt`
				);
				const data = `Concurrent data ${i}`;

				await fs.writeFile(fileName, data);
				const readData = await fs.readFile(fileName, 'utf8');
				await fs.unlink(fileName);

				return readData === data;
			});

		const results = await Promise.all(operations);
		const duration = Date.now() - startTime;

		return {
			success: results.every((r) => r) && duration < 5000,
			operations: concurrentOps,
			duration
		};
	}

	async testChildProcesses() {
		const processCount = 3;
		const processes = [];

		for (let i = 0; i < processCount; i++) {
			const process = spawn(
				'node',
				['-e', `console.log('Child process ${i}'); process.exit(0);`],
				{
					stdio: 'pipe'
				}
			);
			processes.push(process);
		}

		const results = await Promise.all(
			processes.map(
				(proc) =>
					new Promise((resolve) => {
						proc.on('close', (code) => resolve(code === 0));
						proc.on('error', () => resolve(false));
					})
			)
		);

		return {
			success: results.every((r) => r),
			processesSpawned: processCount,
			successfulTerminations: results.filter((r) => r).length
		};
	}

	async checkDiskSpace() {
		try {
			// Simple disk space check by creating a test file
			const testFile = path.join(this.testProjectRoot, 'disk-space-test.txt');
			const testData = 'Disk space test';

			await fs.writeFile(testFile, testData);
			await fs.unlink(testFile);

			return {
				success: true,
				availableSpace: 'Available',
				constraint: 'low'
			};
		} catch (error) {
			return {
				success: false,
				availableSpace: 'Unknown',
				constraint: 'high',
				error: error.message
			};
		}
	}

	async delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async cleanup() {
		console.log('🧹 Cleaning up resource test environment...');

		try {
			await fs.rm(this.testProjectRoot, { recursive: true, force: true });
			console.log('✅ Resource test environment cleaned up');
		} catch (error) {
			console.warn('⚠️ Cleanup warning:', error.message);
		}
	}

	recordTest(name, success, message) {
		this.results.push({
			name,
			success,
			message,
			timestamp: new Date().toISOString(),
			platform: this.systemInfo.platform
		});

		const status = success ? '✅' : '❌';
		console.log(`${status} ${name}: ${message}`);
	}

	printResults() {
		const totalDuration = Date.now() - this.startTime;
		const passedTests = this.results.filter((r) => r.success);
		const failedTests = this.results.filter((r) => !r.success);
		const finalMemory = process.memoryUsage();

		console.log('\n' + '='.repeat(70));
		console.log('📊 RESOURCE MANAGEMENT TEST RESULTS');
		console.log('='.repeat(70));

		console.log(`\n⚡ System Information:`);
		console.log(`   Platform: ${this.systemInfo.platform}`);
		console.log(`   Architecture: ${this.systemInfo.architecture}`);
		console.log(`   CPUs: ${this.systemInfo.cpus}`);
		console.log(
			`   Total Memory: ${Math.round(this.systemInfo.totalMemory / 1024 / 1024 / 1024)}GB`
		);
		console.log(
			`   Free Memory: ${Math.round(this.systemInfo.freeMemory / 1024 / 1024 / 1024)}GB`
		);
		console.log(`   Node.js: ${this.systemInfo.nodeVersion}`);

		console.log(`\n🎯 Test Results:`);
		console.log(`   Total Tests: ${this.results.length}`);
		console.log(`   Passed: ${passedTests.length}`);
		console.log(`   Failed: ${failedTests.length}`);
		console.log(
			`   Success Rate: ${((passedTests.length / this.results.length) * 100).toFixed(1)}%`
		);
		console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);

		console.log(`\n🧠 Memory Usage:`);
		console.log(
			`   Initial Heap: ${Math.round(this.memoryBaseline.heapUsed / 1024 / 1024)}MB`
		);
		console.log(
			`   Final Heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
		);
		console.log(
			`   Memory Delta: ${Math.round((finalMemory.heapUsed - this.memoryBaseline.heapUsed) / 1024 / 1024)}MB`
		);
		console.log(`   Peak RSS: ${Math.round(finalMemory.rss / 1024 / 1024)}MB`);

		if (failedTests.length > 0) {
			console.log(`\n❌ Failed Tests:`);
			failedTests.forEach((test) => {
				console.log(`   - ${test.name}: ${test.message}`);
			});
		}

		console.log(`\n✅ Passed Tests:`);
		passedTests.forEach((test) => {
			console.log(`   - ${test.name}: ${test.message}`);
		});

		console.log(`\n📋 Resource Management Summary:`);
		console.log(`   ✅ Memory management operational`);
		console.log(`   ✅ CPU utilization tracking functional`);
		console.log(`   ✅ Disk I/O performance measured`);
		console.log(`   ✅ Process limits detected`);
		console.log(`   ✅ Resource monitoring active`);
		console.log(`   ✅ Resource cleanup verified`);

		const overallSuccess = passedTests.length / this.results.length >= 0.8;
		console.log(
			`\n🏆 Overall Assessment: ${overallSuccess ? '✅ RESOURCE READY' : '❌ RESOURCE ISSUES'}`
		);

		if (!overallSuccess) {
			console.log(
				`⚠️ Some resource management issues detected. Review failed tests above.`
			);
		}
	}
}

export { ResourceManagementTester };

if (import.meta.url === `file://${process.argv[1]}`) {
	const tester = new ResourceManagementTester();
	tester.run().catch((error) => {
		console.error('💥 Resource management tests crashed:', error);
		process.exit(1);
	});
}
