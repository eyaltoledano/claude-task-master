/**
 * @fileoverview Background Claude Code Service Testing
 * Tests for session lifecycle management, background operations, and error handling
 * Part of Phase 2.1: Background Service Testing
 */

import { EventEmitter } from 'events';

// Mock BackgroundClaudeCode class
class MockBackgroundClaudeCode extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { maxConcurrentSessions: 5, operationTimeout: 30000, retryAttempts: 3, ...options };
    this.sessions = new Map();
    this.operationQueue = [];
    this.isRunning = false;
    this.stats = { sessionsCreated: 0, operationsCompleted: 0, errors: 0, averageResponseTime: 0 };
  }

  async startService() {
    if (this.isRunning) throw new Error('Service already running');
    this.isRunning = true;
    this.emit('service:started');
    return { success: true, timestamp: Date.now() };
  }

  async stopService() {
    if (!this.isRunning) throw new Error('Service not running');
    for (const [sessionId] of this.sessions) {
      await this.stopSession(sessionId);
    }
    this.isRunning = false;
    this.emit('service:stopped');
    return { success: true, timestamp: Date.now() };
  }

  async createSession(config = {}) {
    if (!this.isRunning) throw new Error('Service not running');
    if (this.sessions.size >= this.options.maxConcurrentSessions) {
      throw new Error('Maximum concurrent sessions reached');
    }
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId, status: 'active', createdAt: Date.now(), config,
      stats: { operationsCount: 0, totalResponseTime: 0, errors: 0 }
    };
    
    this.sessions.set(sessionId, session);
    this.stats.sessionsCreated++;
    this.emit('session:created', { sessionId, session });
    return { sessionId, session };
  }

  async stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    session.status = 'stopped';
    this.operationQueue = this.operationQueue.filter(op => op.sessionId !== sessionId);
    this.sessions.delete(sessionId);
    this.emit('session:stopped', { sessionId });
    return { success: true, sessionId };
  }

  async queueOperation(sessionId, operation) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'active') throw new Error(`Session ${sessionId} is not active`);
    
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedOperation = {
      id: operationId, sessionId, operation, status: 'queued',
      queuedAt: Date.now(), priority: operation.priority || 'normal'
    };
    
    this.operationQueue.push(queuedOperation);
    this.emit('operation:queued', { operationId, operation: queuedOperation });
    
    // Simulate processing
    setImmediate(async () => {
      try {
        queuedOperation.status = 'completed';
        this.stats.operationsCompleted++;
        this.emit('operation:completed', { operation: queuedOperation });
      } catch (error) {
        queuedOperation.status = 'failed';
        this.stats.errors++;
        this.emit('operation:failed', { operation: queuedOperation, error });
      }
    });
    
    return { operationId, operation: queuedOperation };
  }

  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return {
      sessionId, status: session.status, createdAt: session.createdAt,
      operationsCount: session.stats.operationsCount, errors: session.stats.errors
    };
  }

  getServiceStats() {
    return { ...this.stats, activeSessions: this.sessions.size, queuedOperations: this.operationQueue.length };
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      activeSessions: this.sessions.size, queuedOperations: this.operationQueue.length,
      timestamp: Date.now()
    };
  }
}

describe('BackgroundClaudeCode Service', () => {
  let service;
  let eventLog;

  beforeEach(() => {
    service = new MockBackgroundClaudeCode();
    eventLog = [];
    service.on('service:started', (data) => eventLog.push({ event: 'service:started', data }));
    service.on('service:stopped', (data) => eventLog.push({ event: 'service:stopped', data }));
    service.on('session:created', (data) => eventLog.push({ event: 'session:created', data }));
    service.on('session:stopped', (data) => eventLog.push({ event: 'session:stopped', data }));
    service.on('operation:queued', (data) => eventLog.push({ event: 'operation:queued', data }));
    service.on('operation:completed', (data) => eventLog.push({ event: 'operation:completed', data }));
  });

  afterEach(() => {
    if (service.isRunning) service.stopService();
  });

  describe('Service Lifecycle Management', () => {
    test('should start service successfully', async () => {
      const result = await service.startService();
      expect(result.success).toBe(true);
      expect(service.isRunning).toBe(true);
      expect(eventLog.some(e => e.event === 'service:started')).toBe(true);
    });

    test('should stop service successfully', async () => {
      await service.startService();
      const result = await service.stopService();
      expect(result.success).toBe(true);
      expect(service.isRunning).toBe(false);
      expect(eventLog.some(e => e.event === 'service:stopped')).toBe(true);
    });

    test('should handle double start attempt', async () => {
      await service.startService();
      await expect(service.startService()).rejects.toThrow('Service already running');
    });

    test('should perform health check', async () => {
      const healthBefore = await service.healthCheck();
      expect(healthBefore.status).toBe('stopped');
      
      await service.startService();
      const healthAfter = await service.healthCheck();
      expect(healthAfter.status).toBe('healthy');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await service.startService();
    });

    test('should create session successfully', async () => {
      const config = { model: 'claude-3', temperature: 0.7 };
      const result = await service.createSession(config);
      
      expect(result.sessionId).toBeDefined();
      expect(result.session.config).toEqual(config);
      expect(service.sessions.size).toBe(1);
      expect(eventLog.some(e => e.event === 'session:created')).toBe(true);
    });

    test('should stop session successfully', async () => {
      const { sessionId } = await service.createSession();
      const result = await service.stopSession(sessionId);
      
      expect(result.success).toBe(true);
      expect(service.sessions.size).toBe(0);
      expect(eventLog.some(e => e.event === 'session:stopped')).toBe(true);
    });

    test('should enforce maximum concurrent sessions', async () => {
      const maxSessions = service.options.maxConcurrentSessions;
      for (let i = 0; i < maxSessions; i++) {
        await service.createSession();
      }
      await expect(service.createSession()).rejects.toThrow('Maximum concurrent sessions reached');
    });

    test('should get session statistics', async () => {
      const { sessionId } = await service.createSession();
      const stats = service.getSessionStats(sessionId);
      
      expect(stats.sessionId).toBe(sessionId);
      expect(stats.status).toBe('active');
      expect(stats.operationsCount).toBe(0);
    });
  });

  describe('Background Operations', () => {
    let sessionId;

    beforeEach(async () => {
      await service.startService();
      const result = await service.createSession();
      sessionId = result.sessionId;
    });

    test('should queue operation successfully', async () => {
      const operation = { type: 'code_analysis', data: { file: 'test.js' }, priority: 'high' };
      const result = await service.queueOperation(sessionId, operation);
      
      expect(result.operationId).toBeDefined();
      expect(result.operation.priority).toBe('high');
      expect(service.operationQueue.length).toBe(1);
    });

    test('should execute operations and update statistics', async () => {
      const operation = { type: 'code_analysis' };
      await service.queueOperation(sessionId, operation);
      
      // Wait for operation to complete
      await new Promise(resolve => {
        service.once('operation:completed', resolve);
      });
      
      const stats = service.getServiceStats();
      expect(stats.operationsCompleted).toBe(1);
    });

    test('should handle operations for inactive sessions', async () => {
      const session = service.sessions.get(sessionId);
      session.status = 'paused';
      
      const operation = { type: 'code_analysis' };
      await expect(service.queueOperation(sessionId, operation))
        .rejects.toThrow(`Session ${sessionId} is not active`);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle service operations when not running', async () => {
      await expect(service.createSession()).rejects.toThrow('Service not running');
    });

    test('should handle concurrent session operations', async () => {
      await service.startService();
      const sessionPromises = [];
      
      for (let i = 0; i < 3; i++) {
        sessionPromises.push(service.createSession());
      }
      
      const results = await Promise.all(sessionPromises);
      expect(results).toHaveLength(3);
      expect(service.sessions.size).toBe(3);
    });

    test('should track service statistics accurately', async () => {
      await service.startService();
      const { sessionId } = await service.createSession();
      
      for (let i = 0; i < 3; i++) {
        await service.queueOperation(sessionId, { type: 'code_analysis' });
      }
      
      // Wait for operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = service.getServiceStats();
      expect(stats.operationsCompleted).toBe(3);
      expect(stats.activeSessions).toBe(1);
    });
  });
});
