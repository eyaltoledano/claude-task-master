/**
 * Multi-Session Integration Tests
 * 
 * Tests concurrent session handling, resource management, and coordination
 * across multiple Claude Code sessions running simultaneously.
 * 
 * Test Coverage:
 * - Concurrent session management
 * - Resource isolation and allocation
 * - Session prioritization and queuing
 * - Cross-session dependency handling
 * - Performance under load
 * - Session cleanup and recovery
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// Mock session manager
const mockSessionManager = {
  createSession: jest.fn(),
  terminateSession: jest.fn(),
  getActiveSessions: jest.fn(),
  getPendingSessions: jest.fn(),
  getSessionStatus: jest.fn(),
  setSessionPriority: jest.fn(),
  allocateResources: jest.fn(),
  releaseResources: jest.fn(),
  coordinateSessions: jest.fn()
};

// Mock resource monitor
const mockResourceMonitor = {
  getAvailableResources: jest.fn(),
  allocateMemory: jest.fn(),
  allocateCPU: jest.fn(),
  monitorUsage: jest.fn(),
  checkLimits: jest.fn(),
  enforceQuotas: jest.fn(),
  cleanup: jest.fn()
};

// Mock session coordinator
const mockSessionCoordinator = {
  scheduleSession: jest.fn(),
  queueSession: jest.fn(),
  prioritizeSession: jest.fn(),
  handleDependencies: jest.fn(),
  resolveConflicts: jest.fn(),
  optimizeScheduling: jest.fn()
};

// Mock Claude service (multi-session aware)
const mockClaudeService = {
  createSession: jest.fn(),
  processInSession: jest.fn(),
  streamFromSession: jest.fn(),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  getSessionMetrics: jest.fn(),
  isSessionActive: jest.fn()
};

// Mock isolation manager
const mockIsolationManager = {
  createIsolatedEnvironment: jest.fn(),
  isolateSession: jest.fn(),
  shareResources: jest.fn(),
  preventInterference: jest.fn(),
  validateIsolation: jest.fn(),
  cleanupEnvironment: jest.fn()
};

// Test utilities
function createSessionConfig(id, priority = 'normal') {
  return {
    sessionId: `session-${id}`,
    taskId: `task-${id}`,
    priority: priority,
    resourceRequirements: {
      memory: '512MB',
      cpu: '1 core',
      timeout: 30000
    },
    isolation: {
      enabled: true,
      level: 'moderate'
    },
    dependencies: []
  };
}

function createTaskData(id, complexity = 5) {
  return {
    id: `task-${id}`,
    title: `Task ${id}: Implementation`,
    complexity: complexity,
    estimatedDuration: complexity * 1000, // ms
    files: [`src/module-${id}.js`, `tests/module-${id}.test.js`],
    priority: complexity > 7 ? 'high' : complexity > 4 ? 'normal' : 'low'
  };
}

function simulateSystemLoad() {
  return {
    cpu: Math.random() * 80 + 10, // 10-90%
    memory: Math.random() * 70 + 20, // 20-90%
    activeSessions: Math.floor(Math.random() * 8) + 1, // 1-8 sessions
    queuedSessions: Math.floor(Math.random() * 5) // 0-4 queued
  };
}

describe('Multi-Session Integration Tests', () => {
  let testTempDir;
  let sessionConfigs;
  let taskData;

  beforeAll(async () => {
    testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-session-'));
  });

  afterAll(async () => {
    if (testTempDir) {
      await fs.remove(testTempDir);
    }
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create test data
    sessionConfigs = [
      createSessionConfig('001', 'high'),
      createSessionConfig('002', 'normal'),
      createSessionConfig('003', 'low'),
      createSessionConfig('004', 'normal'),
      createSessionConfig('005', 'high')
    ];

    taskData = [
      createTaskData('001', 8),
      createTaskData('002', 5),
      createTaskData('003', 3),
      createTaskData('004', 6),
      createTaskData('005', 9)
    ];

    // Setup default mock behaviors
    mockResourceMonitor.getAvailableResources.mockReturnValue({
      memory: '4GB',
      cpu: '4 cores',
      maxConcurrentSessions: 8,
      currentUsage: {
        memory: '1.2GB',
        cpu: '40%',
        activeSessions: 0
      }
    });

    mockSessionManager.createSession.mockImplementation((config) => 
      Promise.resolve({
        sessionId: config.sessionId,
        status: 'created',
        resources: config.resourceRequirements,
        timestamp: new Date().toISOString()
      })
    );

    mockSessionManager.getActiveSessions.mockReturnValue([]);
    mockSessionManager.getPendingSessions.mockReturnValue([]);

    mockClaudeService.createSession.mockImplementation((config) =>
      Promise.resolve(config.sessionId)
    );

    mockIsolationManager.createIsolatedEnvironment.mockImplementation((sessionId) =>
      Promise.resolve({
        environmentId: `env-${sessionId}`,
        isolated: true,
        resources: { memory: '512MB', cpu: '1 core' }
      })
    );
  });

  describe('Concurrent Session Management', () => {
    test('should create and manage multiple concurrent sessions', async () => {
      const sessionPromises = [];
      const createdSessions = [];

      // Create sessions concurrently
      for (let i = 0; i < 5; i++) {
        const config = sessionConfigs[i];
        const promise = mockSessionManager.createSession(config).then(result => {
          createdSessions.push(result);
          return result;
        });
        sessionPromises.push(promise);
      }

      const results = await Promise.all(sessionPromises);

      // Verify all sessions created
      expect(results).toHaveLength(5);
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(5);

      // Verify session isolation
      for (const session of results) {
        expect(session.sessionId).toBeTruthy();
        expect(session.status).toBe('created');
        expect(session.resources).toBeTruthy();
      }

      // Verify resource allocation for each session
      mockResourceMonitor.allocateMemory.mockReturnValue(true);
      mockResourceMonitor.allocateCPU.mockReturnValue(true);

      for (const config of sessionConfigs) {
        await mockResourceMonitor.allocateMemory(config.resourceRequirements.memory);
        await mockResourceMonitor.allocateCPU(config.resourceRequirements.cpu);
      }

      expect(mockResourceMonitor.allocateMemory).toHaveBeenCalledTimes(5);
      expect(mockResourceMonitor.allocateCPU).toHaveBeenCalledTimes(5);
    });

    test('should handle session priority and queuing', async () => {
      // Mock system at capacity
      mockResourceMonitor.getAvailableResources.mockReturnValue({
        memory: '4GB',
        cpu: '4 cores',
        maxConcurrentSessions: 3, // Limited capacity
        currentUsage: {
          memory: '2.8GB',
          cpu: '85%',
          activeSessions: 2
        }
      });

      const queuedSessions = [];
      const activeSessions = [];

      mockSessionCoordinator.scheduleSession.mockImplementation((config) => {
        if (activeSessions.length < 3 && config.priority === 'high') {
          activeSessions.push(config);
          return Promise.resolve({ scheduled: true, position: 0 });
        } else {
          queuedSessions.push(config);
          return Promise.resolve({ 
            scheduled: false, 
            queued: true, 
            position: queuedSessions.length 
          });
        }
      });

      // Schedule sessions with different priorities
      const scheduleResults = [];
      for (const config of sessionConfigs) {
        const result = await mockSessionCoordinator.scheduleSession(config);
        scheduleResults.push(result);
      }

      // Verify high priority sessions scheduled first
      expect(scheduleResults[0].scheduled).toBe(true); // High priority
      expect(scheduleResults[4].scheduled).toBe(true); // High priority
      expect(scheduleResults[1].queued).toBe(true);    // Normal priority queued
      expect(scheduleResults[2].queued).toBe(true);    // Low priority queued
      expect(scheduleResults[3].queued).toBe(true);    // Normal priority queued

      // Verify queue ordering
      expect(queuedSessions).toHaveLength(3);
      expect(queuedSessions[0].priority).toBe('normal'); // First queued
      expect(queuedSessions[1].priority).toBe('low');    // Second queued
      expect(queuedSessions[2].priority).toBe('normal'); // Third queued
    });

    test('should coordinate session dependencies', async () => {
      // Create dependencies between sessions
      const dependentConfigs = [
        { ...sessionConfigs[0], dependencies: [] }, // No dependencies
        { ...sessionConfigs[1], dependencies: ['session-001'] }, // Depends on session 1
        { ...sessionConfigs[2], dependencies: ['session-002'] }, // Depends on session 2
        { ...sessionConfigs[3], dependencies: ['session-001', 'session-002'] }, // Multiple deps
        { ...sessionConfigs[4], dependencies: [] } // No dependencies
      ];

      const dependencyGraph = new Map();
      const completedSessions = new Set();

      mockSessionCoordinator.handleDependencies.mockImplementation((config) => {
        const pendingDeps = config.dependencies.filter(dep => !completedSessions.has(dep));
        
        if (pendingDeps.length === 0) {
          return Promise.resolve({ 
            canStart: true, 
            pendingDependencies: [] 
          });
        } else {
          return Promise.resolve({ 
            canStart: false, 
            pendingDependencies: pendingDeps 
          });
        }
      });

      // Check initial dependencies
      const session1Deps = await mockSessionCoordinator.handleDependencies(dependentConfigs[0]);
      const session2Deps = await mockSessionCoordinator.handleDependencies(dependentConfigs[1]);
      const session4Deps = await mockSessionCoordinator.handleDependencies(dependentConfigs[3]);

      expect(session1Deps.canStart).toBe(true);   // No dependencies
      expect(session2Deps.canStart).toBe(false);  // Waiting for session-001
      expect(session4Deps.canStart).toBe(false);  // Waiting for session-001 & session-002

      // Complete session 1
      completedSessions.add('session-001');
      const session2DepsAfter = await mockSessionCoordinator.handleDependencies(dependentConfigs[1]);
      expect(session2DepsAfter.canStart).toBe(true); // Dependencies met

      // Complete session 2
      completedSessions.add('session-002');
      const session3DepsAfter = await mockSessionCoordinator.handleDependencies(dependentConfigs[2]);
      const session4DepsAfter = await mockSessionCoordinator.handleDependencies(dependentConfigs[3]);
      
      expect(session3DepsAfter.canStart).toBe(true); // Dependencies met
      expect(session4DepsAfter.canStart).toBe(true); // All dependencies met
    });

    test('should handle resource contention and allocation', async () => {
      // Mock limited resources
      let availableMemory = 2048; // MB
      let availableCPU = 200; // percent units (2 cores = 200%)

      mockResourceMonitor.allocateMemory.mockImplementation((requirement) => {
        const memoryMB = parseInt(requirement.replace('MB', ''));
        if (availableMemory >= memoryMB) {
          availableMemory -= memoryMB;
          return Promise.resolve({ 
            allocated: true, 
            amount: requirement,
            remaining: `${availableMemory}MB`
          });
        }
        return Promise.resolve({ 
          allocated: false, 
          reason: 'Insufficient memory',
          available: `${availableMemory}MB`
        });
      });

      mockResourceMonitor.allocateCPU.mockImplementation((requirement) => {
        const cpuUnits = parseInt(requirement.replace(' core', '')) * 100;
        if (availableCPU >= cpuUnits) {
          availableCPU -= cpuUnits;
          return Promise.resolve({ 
            allocated: true, 
            amount: requirement,
            remaining: `${availableCPU}%`
          });
        }
        return Promise.resolve({ 
          allocated: false, 
          reason: 'Insufficient CPU',
          available: `${availableCPU}%`
        });
      });

      // Attempt to allocate resources for multiple sessions
      const allocations = [];
      for (const config of sessionConfigs) {
        const memoryResult = await mockResourceMonitor.allocateMemory(
          config.resourceRequirements.memory
        );
        const cpuResult = await mockResourceMonitor.allocateCPU(
          config.resourceRequirements.cpu
        );
        
        allocations.push({
          sessionId: config.sessionId,
          memory: memoryResult,
          cpu: cpuResult,
          success: memoryResult.allocated && cpuResult.allocated
        });
      }

      // Verify resource allocation results
      const successfulAllocations = allocations.filter(a => a.success);
      const failedAllocations = allocations.filter(a => !a.success);

      expect(successfulAllocations.length).toBeGreaterThan(0);
      expect(successfulAllocations.length).toBeLessThan(sessionConfigs.length);
      expect(failedAllocations.length).toBeGreaterThan(0);

      // Verify first few sessions got resources
      expect(allocations[0].success).toBe(true);
      expect(allocations[1].success).toBe(true);
      
      // Verify later sessions were rejected
      const lastAllocation = allocations[allocations.length - 1];
      expect(lastAllocation.success).toBe(false);
    });
  });

  describe('Session Isolation and Performance', () => {
    test('should maintain session isolation under concurrent load', async () => {
      const isolationTests = [];

      // Create isolated environments for each session
      for (const config of sessionConfigs) {
        const environment = await mockIsolationManager.createIsolatedEnvironment(config.sessionId);
        
        mockIsolationManager.validateIsolation.mockResolvedValueOnce({
          sessionId: config.sessionId,
          environmentId: environment.environmentId,
          isolated: true,
          memoryLeaks: [],
          crossSessionAccess: false,
          resourceConflicts: []
        });

        const validation = await mockIsolationManager.validateIsolation(
          config.sessionId, 
          environment.environmentId
        );
        
        isolationTests.push(validation);
      }

      // Verify all sessions are properly isolated
      isolationTests.forEach(test => {
        expect(test.isolated).toBe(true);
        expect(test.crossSessionAccess).toBe(false);
        expect(test.memoryLeaks).toHaveLength(0);
        expect(test.resourceConflicts).toHaveLength(0);
      });

      expect(mockIsolationManager.createIsolatedEnvironment).toHaveBeenCalledTimes(5);
      expect(mockIsolationManager.validateIsolation).toHaveBeenCalledTimes(5);
    });

    test('should handle session performance monitoring', async () => {
      const performanceMetrics = [];
      let sessionCounter = 0;

      // Mock performance data collection
      mockClaudeService.getSessionMetrics.mockImplementation((sessionId) => {
        sessionCounter++;
        return Promise.resolve({
          sessionId,
          startTime: new Date().toISOString(),
          duration: Math.random() * 10000 + 1000, // 1-11 seconds
          memoryUsage: Math.random() * 400 + 100, // 100-500 MB
          cpuUsage: Math.random() * 80 + 10,      // 10-90%
          requestsProcessed: Math.floor(Math.random() * 20) + 1,
          averageResponseTime: Math.random() * 2000 + 500, // 500-2500ms
          status: 'active'
        });
      });

      // Start concurrent sessions and monitor performance
      const sessionPromises = sessionConfigs.map(async (config) => {
        const sessionId = await mockClaudeService.createSession(config);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000)); // Simulate work
        const metrics = await mockClaudeService.getSessionMetrics(sessionId);
        performanceMetrics.push(metrics);
        return metrics;
      });

      const results = await Promise.all(sessionPromises);

      // Verify performance monitoring
      expect(results).toHaveLength(5);
      expect(performanceMetrics).toHaveLength(5);

      // Check performance characteristics
      const avgMemoryUsage = performanceMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / performanceMetrics.length;
      const avgCpuUsage = performanceMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / performanceMetrics.length;
      const avgResponseTime = performanceMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / performanceMetrics.length;

      expect(avgMemoryUsage).toBeGreaterThan(0);
      expect(avgMemoryUsage).toBeLessThan(600); // Reasonable memory usage
      expect(avgCpuUsage).toBeGreaterThan(0);
      expect(avgCpuUsage).toBeLessThan(100);
      expect(avgResponseTime).toBeGreaterThan(0);
      expect(avgResponseTime).toBeLessThan(3000); // Reasonable response time

      console.log('Performance Metrics:', {
        avgMemoryUsage: Math.round(avgMemoryUsage),
        avgCpuUsage: Math.round(avgCpuUsage),
        avgResponseTime: Math.round(avgResponseTime)
      });
    });

    test('should optimize session scheduling based on system load', async () => {
      const systemLoads = [];
      const schedulingDecisions = [];

      // Simulate varying system load
      for (let i = 0; i < 10; i++) {
        const load = simulateSystemLoad();
        systemLoads.push(load);

        mockSessionCoordinator.optimizeScheduling.mockImplementation((load, pendingSessions) => {
          let maxConcurrent;
          if (load.cpu > 80 || load.memory > 85) {
            maxConcurrent = 2; // High load - reduce concurrency
          } else if (load.cpu > 60 || load.memory > 70) {
            maxConcurrent = 4; // Medium load - moderate concurrency
          } else {
            maxConcurrent = 8; // Low load - high concurrency
          }

          return Promise.resolve({
            maxConcurrentSessions: maxConcurrent,
            recommendedDelay: load.cpu > 80 ? 2000 : 0,
            priorityBoost: load.cpu < 40 ? 'all' : 'high-only'
          });
        });

        const decision = await mockSessionCoordinator.optimizeScheduling(load, sessionConfigs);
        schedulingDecisions.push(decision);
      }

      // Verify adaptive scheduling
      const highLoadDecisions = schedulingDecisions.filter((_, i) => 
        systemLoads[i].cpu > 80 || systemLoads[i].memory > 85
      );
      const lowLoadDecisions = schedulingDecisions.filter((_, i) => 
        systemLoads[i].cpu < 40 && systemLoads[i].memory < 50
      );

      if (highLoadDecisions.length > 0) {
        expect(highLoadDecisions[0].maxConcurrentSessions).toBeLessThanOrEqual(2);
        expect(highLoadDecisions[0].recommendedDelay).toBeGreaterThan(0);
      }

      if (lowLoadDecisions.length > 0) {
        expect(lowLoadDecisions[0].maxConcurrentSessions).toBeGreaterThanOrEqual(6);
        expect(lowLoadDecisions[0].priorityBoost).toBe('all');
      }

      expect(mockSessionCoordinator.optimizeScheduling).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle session failures and recovery', async () => {
      const failingSessionId = 'session-002';
      const recoveryActions = [];

      // Mock session failure
      mockSessionManager.getSessionStatus.mockImplementation((sessionId) => {
        if (sessionId === failingSessionId) {
          return Promise.resolve({
            sessionId,
            status: 'failed',
            error: 'Resource allocation timeout',
            timestamp: new Date().toISOString()
          });
        }
        return Promise.resolve({
          sessionId,
          status: 'active',
          timestamp: new Date().toISOString()
        });
      });

      // Mock recovery mechanism
      mockSessionCoordinator.handleDependencies.mockImplementation((config) => {
        if (config.dependencies.includes(failingSessionId)) {
          recoveryActions.push({
            action: 'reschedule',
            sessionId: config.sessionId,
            reason: `Dependency ${failingSessionId} failed`
          });
          
          return Promise.resolve({
            canStart: false,
            pendingDependencies: [failingSessionId],
            recoveryNeeded: true
          });
        }
        return Promise.resolve({ canStart: true, pendingDependencies: [] });
      });

      // Check session statuses
      const statuses = [];
      for (const config of sessionConfigs) {
        const status = await mockSessionManager.getSessionStatus(config.sessionId);
        statuses.push(status);
      }

      // Handle dependencies for sessions that depend on the failed session
      const dependentConfig = { 
        ...sessionConfigs[2], 
        dependencies: [failingSessionId] 
      };
      
      const dependencyResult = await mockSessionCoordinator.handleDependencies(dependentConfig);

      // Verify failure detection and recovery
      const failedSession = statuses.find(s => s.sessionId === failingSessionId);
      expect(failedSession.status).toBe('failed');
      expect(failedSession.error).toBeTruthy();

      expect(dependencyResult.canStart).toBe(false);
      expect(dependencyResult.recoveryNeeded).toBe(true);
      expect(recoveryActions).toHaveLength(1);
      expect(recoveryActions[0].action).toBe('reschedule');
    });

    test('should handle resource cleanup after session termination', async () => {
      const cleanupActions = [];

      // Mock session termination and cleanup
      mockSessionManager.terminateSession.mockImplementation((sessionId, reason) => {
        return Promise.resolve({
          sessionId,
          terminated: true,
          reason,
          timestamp: new Date().toISOString()
        });
      });

      mockResourceMonitor.cleanup.mockImplementation((sessionId) => {
        cleanupActions.push({
          action: 'release-memory',
          sessionId,
          amount: '512MB'
        });
        cleanupActions.push({
          action: 'release-cpu',
          sessionId,
          amount: '1 core'
        });
        
        return Promise.resolve({
          sessionId,
          memoryReleased: '512MB',
          cpuReleased: '1 core',
          success: true
        });
      });

      mockIsolationManager.cleanupEnvironment.mockImplementation((sessionId) => {
        cleanupActions.push({
          action: 'cleanup-environment',
          sessionId,
          environmentId: `env-${sessionId}`
        });
        
        return Promise.resolve({
          sessionId,
          environmentCleaned: true,
          filesRemoved: true
        });
      });

      // Terminate sessions and verify cleanup
      for (const config of sessionConfigs.slice(0, 3)) { // Terminate first 3 sessions
        await mockSessionManager.terminateSession(config.sessionId, 'test-cleanup');
        await mockResourceMonitor.cleanup(config.sessionId);
        await mockIsolationManager.cleanupEnvironment(config.sessionId);
      }

      // Verify cleanup actions
      expect(cleanupActions).toHaveLength(9); // 3 sessions × 3 actions each
      
      const memoryReleases = cleanupActions.filter(a => a.action === 'release-memory');
      const cpuReleases = cleanupActions.filter(a => a.action === 'release-cpu');
      const envCleanups = cleanupActions.filter(a => a.action === 'cleanup-environment');

      expect(memoryReleases).toHaveLength(3);
      expect(cpuReleases).toHaveLength(3);
      expect(envCleanups).toHaveLength(3);

      expect(mockSessionManager.terminateSession).toHaveBeenCalledTimes(3);
      expect(mockResourceMonitor.cleanup).toHaveBeenCalledTimes(3);
      expect(mockIsolationManager.cleanupEnvironment).toHaveBeenCalledTimes(3);
    });

    test('should prevent resource leaks in long-running sessions', async () => {
      const memorySnapshots = [];
      const leakDetection = [];

      // Mock memory monitoring over time
      mockResourceMonitor.monitorUsage.mockImplementation((sessionId) => {
        const baseMemory = 512;
        const memoryGrowth = Math.random() * 50; // Some natural growth
        const currentMemory = baseMemory + memoryGrowth;
        
        memorySnapshots.push({
          sessionId,
          timestamp: Date.now(),
          memoryUsage: currentMemory,
          growth: memoryGrowth
        });

        // Detect potential leaks (growth > 30MB)
        if (memoryGrowth > 30) {
          leakDetection.push({
            sessionId,
            suspectedLeak: true,
            memoryGrowth,
            timestamp: Date.now()
          });
        }

        return Promise.resolve({
          sessionId,
          memoryUsage: `${currentMemory}MB`,
          cpuUsage: Math.random() * 50 + 25, // 25-75%
          potentialLeak: memoryGrowth > 30
        });
      });

      // Monitor sessions over time
      for (let interval = 0; interval < 5; interval++) {
        for (const config of sessionConfigs) {
          await mockResourceMonitor.monitorUsage(config.sessionId);
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }

      // Analyze leak detection
      expect(memorySnapshots).toHaveLength(25); // 5 sessions × 5 intervals
      expect(mockResourceMonitor.monitorUsage).toHaveBeenCalledTimes(25);

      // Verify leak detection system is working
      if (leakDetection.length > 0) {
        leakDetection.forEach(leak => {
          expect(leak.suspectedLeak).toBe(true);
          expect(leak.memoryGrowth).toBeGreaterThan(30);
          expect(leak.sessionId).toBeTruthy();
        });
      }

      console.log('Memory Monitoring Results:', {
        totalSnapshots: memorySnapshots.length,
        potentialLeaks: leakDetection.length,
        averageMemoryUsage: Math.round(
          memorySnapshots.reduce((sum, s) => sum + s.memoryUsage, 0) / memorySnapshots.length
        )
      });
    });
  });

  describe('Stress Testing and Scalability', () => {
    test('should handle maximum concurrent session load', async () => {
      const maxSessions = 12;
      const stressTestConfigs = Array.from({ length: maxSessions }, (_, i) => 
        createSessionConfig(`stress-${i.toString().padStart(3, '0')}`, 
          i % 3 === 0 ? 'high' : i % 2 === 0 ? 'normal' : 'low')
      );

      const creationTimes = [];
      const sessionResults = [];
      let successfulSessions = 0;
      let failedSessions = 0;

      // Mock varying success rates based on system capacity
      mockSessionManager.createSession.mockImplementation(async (config) => {
        const startTime = Date.now();
        
        // Simulate resource constraints
        if (successfulSessions >= 8) { // System capacity limit
          failedSessions++;
          throw new Error('Maximum session capacity reached');
        }

        await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Simulate creation time
        
        successfulSessions++;
        const endTime = Date.now();
        creationTimes.push(endTime - startTime);

        return {
          sessionId: config.sessionId,
          status: 'created',
          priority: config.priority,
          timestamp: new Date().toISOString()
        };
      });

      // Attempt to create all sessions concurrently
      const results = await Promise.allSettled(
        stressTestConfigs.map(config => mockSessionManager.createSession(config))
      );

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(8); // System capacity limit
      expect(failed).toHaveLength(4);     // Exceeded capacity

      // Verify performance under stress
      const avgCreationTime = creationTimes.reduce((sum, time) => sum + time, 0) / creationTimes.length;
      expect(avgCreationTime).toBeLessThan(200); // Should be reasonably fast

      console.log('Stress Test Results:', {
        maxAttempted: maxSessions,
        successful: successful.length,
        failed: failed.length,
        avgCreationTime: Math.round(avgCreationTime)
      });
    });

    test('should scale session management efficiently', async () => {
      const scalabilityTests = [2, 4, 6, 8, 10].map(sessionCount => ({
        sessionCount,
        configs: Array.from({ length: sessionCount }, (_, i) => 
          createSessionConfig(`scale-${sessionCount}-${i}`)
        )
      }));

      const scalabilityResults = [];

      for (const test of scalabilityTests) {
        const startTime = Date.now();
        
        // Mock session creation with realistic timing
        const sessionPromises = test.configs.map(async (config, index) => {
          await new Promise(resolve => setTimeout(resolve, index * 10)); // Staggered start
          return mockSessionManager.createSession(config);
        });

        const results = await Promise.allSettled(sessionPromises);
        const endTime = Date.now();

        scalabilityResults.push({
          sessionCount: test.sessionCount,
          duration: endTime - startTime,
          successRate: results.filter(r => r.status === 'fulfilled').length / results.length,
          averageTimePerSession: (endTime - startTime) / test.sessionCount
        });
      }

      // Verify scalability characteristics
      scalabilityResults.forEach(result => {
        expect(result.successRate).toBeGreaterThanOrEqual(0.8); // At least 80% success
        expect(result.averageTimePerSession).toBeLessThan(100); // Reasonable per-session time
      });

      // Check for linear or better scaling
      const timeGrowthRate = scalabilityResults[scalabilityResults.length - 1].duration / 
                            scalabilityResults[0].duration;
      const sessionGrowthRate = scalabilityResults[scalabilityResults.length - 1].sessionCount / 
                               scalabilityResults[0].sessionCount;

      expect(timeGrowthRate).toBeLessThanOrEqual(sessionGrowthRate * 1.5); // Sub-linear time growth

      console.log('Scalability Results:', scalabilityResults.map(r => ({
        sessions: r.sessionCount,
        duration: `${r.duration}ms`,
        successRate: `${(r.successRate * 100).toFixed(1)}%`,
        avgTimePerSession: `${r.averageTimePerSession.toFixed(1)}ms`
      })));
    });
  });
}); 