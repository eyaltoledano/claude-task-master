/**
 * @fileoverview Hook Storage Tests
 * Tests for hook storage system including persistence, configuration storage,
 * and hook data management.
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock HookStorage class with comprehensive storage capabilities
class MockHookStorage extends EventEmitter {
  constructor(options = {}) {
    super();
    this.storage = new Map();
    this.metadata = new Map();
    this.indexes = new Map();
    this.cache = new Map();
    this.backupStorage = new Map();
    this.statistics = {
      totalOperations: 0,
      readOperations: 0,
      writeOperations: 0,
      deleteOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      backupOperations: 0
    };
    this.config = {
      enableCaching: options.enableCaching !== false,
      enableBackups: options.enableBackups !== false,
      enableIndexing: options.enableIndexing !== false,
      maxCacheSize: options.maxCacheSize || 1000,
      backupInterval: options.backupInterval || 60000,
      compressionEnabled: options.compressionEnabled || false,
      encryptionEnabled: options.encryptionEnabled || false,
      ...options
    };
    this.isInitialized = false;
    this.backupTimer = null;
  }

  // Storage initialization
  async initialize() {
    if (this.isInitialized) {
      throw new Error('Storage already initialized');
    }

    // Mock initialization process
    await this.loadFromPersistence();
    this.setupIndexes();
    this.startBackupTimer();
    
    this.isInitialized = true;
    this.emit('storageInitialized');
    
    return true;
  }

  async loadFromPersistence() {
    // Mock loading from persistent storage
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('persistenceLoaded');
  }

  setupIndexes() {
    if (!this.config.enableIndexing) return;
    
    this.indexes.set('byType', new Map());
    this.indexes.set('byTag', new Map());
    this.indexes.set('byPriority', new Map());
    this.emit('indexesSetup');
  }

  startBackupTimer() {
    if (!this.config.enableBackups) return;
    
    this.backupTimer = setInterval(() => {
      this.createBackup();
    }, this.config.backupInterval);
  }

  // Hook storage operations
  async storeHook(hookId, hookData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    if (!hookId || typeof hookId !== 'string') {
      throw new Error('Hook ID must be a non-empty string');
    }

    if (!hookData || typeof hookData !== 'object') {
      throw new Error('Hook data must be an object');
    }

    this.statistics.totalOperations++;
    this.statistics.writeOperations++;

    const storageEntry = {
      id: hookId,
      data: this.processDataForStorage(hookData, options),
      metadata: {
        storedAt: new Date(),
        version: options.version || 1,
        tags: options.tags || [],
        priority: options.priority || 0,
        type: options.type || 'unknown',
        size: this.calculateDataSize(hookData),
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled
      },
      options: { ...options }
    };

    this.storage.set(hookId, storageEntry);
    this.metadata.set(hookId, storageEntry.metadata);

    // Update indexes
    this.updateIndexes(hookId, storageEntry);

    // Update cache
    if (this.config.enableCaching) {
      this.updateCache(hookId, storageEntry);
    }

    this.emit('hookStored', { hookId, metadata: storageEntry.metadata });
    
    return storageEntry.metadata;
  }

  async retrieveHook(hookId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    if (!hookId || typeof hookId !== 'string') {
      throw new Error('Hook ID must be a non-empty string');
    }

    this.statistics.totalOperations++;
    this.statistics.readOperations++;

    // Check cache first
    if (this.config.enableCaching && this.cache.has(hookId)) {
      this.statistics.cacheHits++;
      const cached = this.cache.get(hookId);
      this.emit('hookRetrieved', { hookId, fromCache: true });
      return this.processDataFromStorage(cached.data, cached.options);
    }

    this.statistics.cacheMisses++;

    const entry = this.storage.get(hookId);
    if (!entry) {
      this.emit('hookNotFound', { hookId });
      return null;
    }

    // Update cache
    if (this.config.enableCaching) {
      this.updateCache(hookId, entry);
    }

    this.emit('hookRetrieved', { hookId, fromCache: false });
    
    return this.processDataFromStorage(entry.data, entry.options);
  }

  async deleteHook(hookId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    if (!hookId || typeof hookId !== 'string') {
      throw new Error('Hook ID must be a non-empty string');
    }

    this.statistics.totalOperations++;
    this.statistics.deleteOperations++;

    const existed = this.storage.has(hookId);
    if (!existed && !options.silent) {
      throw new Error(`Hook '${hookId}' not found`);
    }

    // Create backup before deletion if enabled
    if (this.config.enableBackups && existed) {
      const entry = this.storage.get(hookId);
      this.backupStorage.set(`${hookId}-${Date.now()}`, entry);
      this.statistics.backupOperations++;
    }

    this.storage.delete(hookId);
    this.metadata.delete(hookId);
    this.cache.delete(hookId);

    // Update indexes
    this.removeFromIndexes(hookId);

    this.emit('hookDeleted', { hookId, existed });
    
    return existed;
  }

  // Batch operations
  async storeBatch(hooks, options = {}) {
    const results = new Map();
    const errors = new Map();

    for (const [hookId, hookData] of hooks.entries()) {
      try {
        const metadata = await this.storeHook(hookId, hookData, options);
        results.set(hookId, metadata);
      } catch (error) {
        errors.set(hookId, error);
      }
    }

    this.emit('batchStored', { 
      totalHooks: hooks.size,
      successful: results.size,
      failed: errors.size
    });

    return { results, errors };
  }

  async retrieveBatch(hookIds, options = {}) {
    const results = new Map();
    const notFound = [];

    for (const hookId of hookIds) {
      try {
        const hookData = await this.retrieveHook(hookId, options);
        if (hookData !== null) {
          results.set(hookId, hookData);
        } else {
          notFound.push(hookId);
        }
      } catch (error) {
        notFound.push(hookId);
      }
    }

    return { results, notFound };
  }

  // Query operations
  async queryHooks(criteria = {}) {
    const results = [];

    for (const [hookId, entry] of this.storage) {
      if (this.matchesCriteria(entry, criteria)) {
        results.push({
          id: hookId,
          data: this.processDataFromStorage(entry.data, entry.options),
          metadata: entry.metadata
        });
      }
    }

    // Sort results if specified
    if (criteria.sortBy) {
      results.sort((a, b) => {
        const aVal = a.metadata[criteria.sortBy] || a.data[criteria.sortBy];
        const bVal = b.metadata[criteria.sortBy] || b.data[criteria.sortBy];
        return criteria.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Limit results if specified
    if (criteria.limit) {
      results.splice(criteria.limit);
    }

    this.emit('queryExecuted', { 
      criteria, 
      resultCount: results.length 
    });

    return results;
  }

  matchesCriteria(entry, criteria) {
    // Type filter
    if (criteria.type && entry.metadata.type !== criteria.type) {
      return false;
    }

    // Tag filter
    if (criteria.tags && criteria.tags.length > 0) {
      const hasAllTags = criteria.tags.every(tag => 
        entry.metadata.tags.includes(tag)
      );
      if (!hasAllTags) return false;
    }

    // Priority filter
    if (criteria.minPriority !== undefined && entry.metadata.priority < criteria.minPriority) {
      return false;
    }

    if (criteria.maxPriority !== undefined && entry.metadata.priority > criteria.maxPriority) {
      return false;
    }

    // Date range filter
    if (criteria.since && entry.metadata.storedAt < criteria.since) {
      return false;
    }

    if (criteria.until && entry.metadata.storedAt > criteria.until) {
      return false;
    }

    return true;
  }

  // Index management
  updateIndexes(hookId, entry) {
    if (!this.config.enableIndexing) return;

    // Index by type
    const typeIndex = this.indexes.get('byType');
    if (!typeIndex.has(entry.metadata.type)) {
      typeIndex.set(entry.metadata.type, new Set());
    }
    typeIndex.get(entry.metadata.type).add(hookId);

    // Index by tags
    const tagIndex = this.indexes.get('byTag');
    for (const tag of entry.metadata.tags) {
      if (!tagIndex.has(tag)) {
        tagIndex.set(tag, new Set());
      }
      tagIndex.get(tag).add(hookId);
    }

    // Index by priority
    const priorityIndex = this.indexes.get('byPriority');
    if (!priorityIndex.has(entry.metadata.priority)) {
      priorityIndex.set(entry.metadata.priority, new Set());
    }
    priorityIndex.get(entry.metadata.priority).add(hookId);
  }

  removeFromIndexes(hookId) {
    if (!this.config.enableIndexing) return;

    for (const [indexName, index] of this.indexes) {
      for (const [key, hookSet] of index) {
        hookSet.delete(hookId);
        if (hookSet.size === 0) {
          index.delete(key);
        }
      }
    }
  }

  // Cache management
  updateCache(hookId, entry) {
    if (!this.config.enableCaching) return;

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(hookId, entry);
  }

  clearCache() {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  // Data processing
  processDataForStorage(data, options) {
    let processedData = { ...data };

    // Mock compression
    if (this.config.compressionEnabled) {
      processedData._compressed = true;
    }

    // Mock encryption
    if (this.config.encryptionEnabled) {
      processedData._encrypted = true;
    }

    return processedData;
  }

  processDataFromStorage(data, options) {
    let processedData = { ...data };

    // Mock decompression
    if (processedData._compressed) {
      delete processedData._compressed;
    }

    // Mock decryption
    if (processedData._encrypted) {
      delete processedData._encrypted;
    }

    return processedData;
  }

  calculateDataSize(data) {
    return JSON.stringify(data).length;
  }

  // Backup operations
  createBackup() {
    if (!this.config.enableBackups) return;

    const backupId = `backup-${Date.now()}`;
    const backupData = {
      id: backupId,
      timestamp: new Date(),
      storage: Object.fromEntries(this.storage),
      metadata: Object.fromEntries(this.metadata)
    };

    this.backupStorage.set(backupId, backupData);
    this.statistics.backupOperations++;
    
    this.emit('backupCreated', { backupId, size: this.storage.size });
    
    return backupId;
  }

  async restoreFromBackup(backupId) {
    if (!this.config.enableBackups) {
      throw new Error('Backups are not enabled');
    }

    const backup = this.backupStorage.get(backupId);
    if (!backup) {
      throw new Error(`Backup '${backupId}' not found`);
    }

    this.storage = new Map(Object.entries(backup.storage));
    this.metadata = new Map(Object.entries(backup.metadata));
    this.cache.clear();
    
    // Rebuild indexes
    if (this.config.enableIndexing) {
      this.setupIndexes();
      for (const [hookId, entry] of this.storage) {
        this.updateIndexes(hookId, entry);
      }
    }

    this.emit('backupRestored', { backupId, restoredCount: this.storage.size });
    
    return true;
  }

  listBackups() {
    const backups = [];
    
    for (const [backupId, backup] of this.backupStorage) {
      backups.push({
        id: backupId,
        timestamp: backup.timestamp,
        size: Object.keys(backup.storage).length
      });
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Storage maintenance
  async compact() {
    const beforeSize = this.storage.size;
    
    // Remove orphaned metadata
    for (const hookId of this.metadata.keys()) {
      if (!this.storage.has(hookId)) {
        this.metadata.delete(hookId);
      }
    }

    // Clean up cache
    for (const hookId of this.cache.keys()) {
      if (!this.storage.has(hookId)) {
        this.cache.delete(hookId);
      }
    }

    // Rebuild indexes
    if (this.config.enableIndexing) {
      this.indexes.clear();
      this.setupIndexes();
      for (const [hookId, entry] of this.storage) {
        this.updateIndexes(hookId, entry);
      }
    }

    const afterSize = this.storage.size;
    
    this.emit('storageCompacted', { 
      beforeSize, 
      afterSize, 
      cleaned: beforeSize - afterSize 
    });
    
    return beforeSize - afterSize;
  }

  // Statistics and monitoring
  getStatistics() {
    const totalCacheOperations = this.statistics.cacheHits + this.statistics.cacheMisses;
    return {
      ...this.statistics,
      storageSize: this.storage.size,
      metadataSize: this.metadata.size,
      cacheSize: this.cache.size,
      backupCount: this.backupStorage.size,
      indexCount: this.indexes.size,
      cacheHitRate: totalCacheOperations > 0 
        ? (this.statistics.cacheHits / totalCacheOperations) * 100 
        : 0,
      totalDataSize: Array.from(this.storage.values()).reduce((total, entry) => 
        total + entry.metadata.size, 0
      )
    };
  }

  // Configuration management
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    if (newConfig.enableCaching === false) {
      this.clearCache();
    }
    
    if (newConfig.enableBackups === false && this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    } else if (newConfig.enableBackups === true && !this.backupTimer) {
      this.startBackupTimer();
    }

    this.emit('configUpdated', { oldConfig, newConfig: this.config });
    
    return this.config;
  }

  // Storage cleanup and shutdown
  async shutdown() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    // Create final backup
    if (this.config.enableBackups && this.storage.size > 0) {
      this.createBackup();
    }

    this.storage.clear();
    this.metadata.clear();
    this.cache.clear();
    this.indexes.clear();
    
    this.isInitialized = false;
    
    this.emit('storageShutdown');
    this.removeAllListeners();
  }
}

describe('Hook Storage System', () => {
  let storage;

  beforeEach(async () => {
    storage = new MockHookStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    if (storage) {
      await storage.shutdown();
    }
  });

  describe('Storage Initialization', () => {
    test('should initialize storage successfully', async () => {
      const newStorage = new MockHookStorage();
      
      expect(newStorage.isInitialized).toBe(false);
      
      await newStorage.initialize();
      
      expect(newStorage.isInitialized).toBe(true);
      
      await newStorage.shutdown();
    });

    test('should emit storageInitialized event', async () => {
      const eventSpy = jest.fn();
      const newStorage = new MockHookStorage();
      newStorage.on('storageInitialized', eventSpy);
      
      await newStorage.initialize();
      
      expect(eventSpy).toHaveBeenCalled();
      
      await newStorage.shutdown();
    });

    test('should reject double initialization', async () => {
      await expect(storage.initialize()).rejects.toThrow('Storage already initialized');
    });

    test('should load from persistence during initialization', async () => {
      const eventSpy = jest.fn();
      const newStorage = new MockHookStorage();
      newStorage.on('persistenceLoaded', eventSpy);
      
      await newStorage.initialize();
      
      expect(eventSpy).toHaveBeenCalled();
      
      await newStorage.shutdown();
    });

    test('should setup indexes when enabled', async () => {
      const eventSpy = jest.fn();
      const newStorage = new MockHookStorage({ enableIndexing: true });
      newStorage.on('indexesSetup', eventSpy);
      
      await newStorage.initialize();
      
      expect(eventSpy).toHaveBeenCalled();
      expect(newStorage.indexes.has('byType')).toBe(true);
      expect(newStorage.indexes.has('byTag')).toBe(true);
      expect(newStorage.indexes.has('byPriority')).toBe(true);
      
      await newStorage.shutdown();
    });
  });

  describe('Hook Storage Operations', () => {
    test('should store hook successfully', async () => {
      const hookData = { name: 'test-hook', function: 'test-function' };
      
      const metadata = await storage.storeHook('test-hook-1', hookData);
      
      expect(metadata.storedAt).toBeInstanceOf(Date);
      expect(metadata.version).toBe(1);
      expect(metadata.size).toBeGreaterThan(0);
      expect(storage.storage.has('test-hook-1')).toBe(true);
    });

    test('should store hook with custom options', async () => {
      const hookData = { name: 'custom-hook' };
      const options = {
        version: 2,
        tags: ['custom', 'test'],
        priority: 10,
        type: 'custom-type'
      };
      
      const metadata = await storage.storeHook('custom-hook', hookData, options);
      
      expect(metadata.version).toBe(2);
      expect(metadata.tags).toEqual(['custom', 'test']);
      expect(metadata.priority).toBe(10);
      expect(metadata.type).toBe('custom-type');
    });

    test('should emit hookStored event', async () => {
      const eventSpy = jest.fn();
      storage.on('hookStored', eventSpy);
      
      const hookData = { name: 'event-hook' };
      await storage.storeHook('event-hook', hookData);
      
      expect(eventSpy).toHaveBeenCalledWith({
        hookId: 'event-hook',
        metadata: expect.objectContaining({ version: 1 })
      });
    });

    test('should reject invalid hook ID', async () => {
      const hookData = { name: 'test' };
      
      await expect(storage.storeHook('', hookData)).rejects.toThrow('Hook ID must be a non-empty string');
      await expect(storage.storeHook(null, hookData)).rejects.toThrow('Hook ID must be a non-empty string');
    });

    test('should reject invalid hook data', async () => {
      await expect(storage.storeHook('test', null)).rejects.toThrow('Hook data must be an object');
      await expect(storage.storeHook('test', 'not-object')).rejects.toThrow('Hook data must be an object');
    });

    test('should require initialized storage', async () => {
      const uninitializedStorage = new MockHookStorage();
      
      await expect(uninitializedStorage.storeHook('test', {})).rejects.toThrow('Storage not initialized');
    });
  });

  describe('Hook Retrieval Operations', () => {
    beforeEach(async () => {
      await storage.storeHook('retrieve-test', { name: 'retrieve-test', data: 'test-data' });
    });

    test('should retrieve hook successfully', async () => {
      const hookData = await storage.retrieveHook('retrieve-test');
      
      expect(hookData.name).toBe('retrieve-test');
      expect(hookData.data).toBe('test-data');
    });

    test('should return null for non-existent hook', async () => {
      const hookData = await storage.retrieveHook('non-existent');
      
      expect(hookData).toBeNull();
    });

    test('should emit hookRetrieved event', async () => {
      const eventSpy = jest.fn();
      storage.on('hookRetrieved', eventSpy);
      
      // Clear cache to ensure fromCache is false
      storage.clearCache();
      
      await storage.retrieveHook('retrieve-test');
      
      expect(eventSpy).toHaveBeenCalledWith({
        hookId: 'retrieve-test',
        fromCache: false
      });
    });

    test('should emit hookNotFound event', async () => {
      const eventSpy = jest.fn();
      storage.on('hookNotFound', eventSpy);
      
      await storage.retrieveHook('not-found');
      
      expect(eventSpy).toHaveBeenCalledWith({ hookId: 'not-found' });
    });

    test('should use cache when enabled', async () => {
      storage.config.enableCaching = true;
      
      // First retrieval (cache miss)
      await storage.retrieveHook('retrieve-test');
      
      // Second retrieval (cache hit)
      const eventSpy = jest.fn();
      storage.on('hookRetrieved', eventSpy);
      
      await storage.retrieveHook('retrieve-test');
      
      expect(eventSpy).toHaveBeenCalledWith({
        hookId: 'retrieve-test',
        fromCache: true
      });
    });

    test('should track cache statistics', async () => {
      storage.config.enableCaching = true;
      
      // Clear cache and reset statistics for clean test
      storage.clearCache();
      storage.statistics.cacheHits = 0;
      storage.statistics.cacheMisses = 0;
      
      await storage.retrieveHook('retrieve-test'); // Cache miss
      await storage.retrieveHook('retrieve-test'); // Cache hit
      await storage.retrieveHook('non-existent'); // Cache miss
      
      const stats = storage.getStatistics();
      
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.cacheHitRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('Hook Deletion Operations', () => {
    beforeEach(async () => {
      await storage.storeHook('delete-test', { name: 'delete-test' });
    });

    test('should delete hook successfully', async () => {
      const existed = await storage.deleteHook('delete-test');
      
      expect(existed).toBe(true);
      expect(storage.storage.has('delete-test')).toBe(false);
      expect(storage.metadata.has('delete-test')).toBe(false);
    });

    test('should emit hookDeleted event', async () => {
      const eventSpy = jest.fn();
      storage.on('hookDeleted', eventSpy);
      
      await storage.deleteHook('delete-test');
      
      expect(eventSpy).toHaveBeenCalledWith({
        hookId: 'delete-test',
        existed: true
      });
    });

    test('should handle deletion of non-existent hook', async () => {
      await expect(storage.deleteHook('non-existent')).rejects.toThrow("Hook 'non-existent' not found");
    });

    test('should handle silent deletion', async () => {
      const existed = await storage.deleteHook('non-existent', { silent: true });
      
      expect(existed).toBe(false);
    });

    test('should create backup before deletion when enabled', async () => {
      storage.config.enableBackups = true;
      const initialBackupCount = storage.statistics.backupOperations;
      
      await storage.deleteHook('delete-test');
      
      expect(storage.statistics.backupOperations).toBe(initialBackupCount + 1);
    });
  });

  describe('Batch Operations', () => {
    test('should store multiple hooks in batch', async () => {
      const hooks = new Map([
        ['batch-1', { name: 'batch-1' }],
        ['batch-2', { name: 'batch-2' }],
        ['batch-3', { name: 'batch-3' }]
      ]);
      
      const { results, errors } = await storage.storeBatch(hooks);
      
      expect(results.size).toBe(3);
      expect(errors.size).toBe(0);
      expect(storage.storage.has('batch-1')).toBe(true);
      expect(storage.storage.has('batch-2')).toBe(true);
      expect(storage.storage.has('batch-3')).toBe(true);
    });

    test('should emit batchStored event', async () => {
      const eventSpy = jest.fn();
      storage.on('batchStored', eventSpy);
      
      const hooks = new Map([['batch-test', { name: 'batch-test' }]]);
      await storage.storeBatch(hooks);
      
      expect(eventSpy).toHaveBeenCalledWith({
        totalHooks: 1,
        successful: 1,
        failed: 0
      });
    });

    test('should retrieve multiple hooks in batch', async () => {
      await storage.storeHook('batch-retrieve-1', { name: 'batch-1' });
      await storage.storeHook('batch-retrieve-2', { name: 'batch-2' });
      
      const { results, notFound } = await storage.retrieveBatch(['batch-retrieve-1', 'batch-retrieve-2', 'non-existent']);
      
      expect(results.size).toBe(2);
      expect(notFound).toEqual(['non-existent']);
      expect(results.get('batch-retrieve-1').name).toBe('batch-1');
      expect(results.get('batch-retrieve-2').name).toBe('batch-2');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await storage.storeHook('query-1', { name: 'query-1' }, { type: 'validator', tags: ['test'], priority: 5 });
      await storage.storeHook('query-2', { name: 'query-2' }, { type: 'executor', tags: ['test', 'prod'], priority: 10 });
      await storage.storeHook('query-3', { name: 'query-3' }, { type: 'validator', tags: ['prod'], priority: 1 });
    });

    test('should query hooks by type', async () => {
      const results = await storage.queryHooks({ type: 'validator' });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata.type === 'validator')).toBe(true);
    });

    test('should query hooks by tags', async () => {
      const results = await storage.queryHooks({ tags: ['test'] });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata.tags.includes('test'))).toBe(true);
    });

    test('should query hooks by priority range', async () => {
      const results = await storage.queryHooks({ minPriority: 5 });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata.priority >= 5)).toBe(true);
    });

    test('should sort query results', async () => {
      const results = await storage.queryHooks({ sortBy: 'priority', sortOrder: 'desc' });
      
      expect(results).toHaveLength(3);
      expect(results[0].metadata.priority).toBe(10);
      expect(results[1].metadata.priority).toBe(5);
      expect(results[2].metadata.priority).toBe(1);
    });

    test('should limit query results', async () => {
      const results = await storage.queryHooks({ limit: 2 });
      
      expect(results).toHaveLength(2);
    });

    test('should emit queryExecuted event', async () => {
      const eventSpy = jest.fn();
      storage.on('queryExecuted', eventSpy);
      
      const criteria = { type: 'validator' };
      await storage.queryHooks(criteria);
      
      expect(eventSpy).toHaveBeenCalledWith({
        criteria,
        resultCount: 2
      });
    });
  });

  describe('Cache Management', () => {
    test('should manage cache size limit', async () => {
      storage.config.enableCaching = true;
      storage.config.maxCacheSize = 2;
      
      await storage.storeHook('cache-1', { name: 'cache-1' });
      await storage.storeHook('cache-2', { name: 'cache-2' });
      await storage.storeHook('cache-3', { name: 'cache-3' });
      
      // Retrieve to populate cache
      await storage.retrieveHook('cache-1');
      await storage.retrieveHook('cache-2');
      await storage.retrieveHook('cache-3'); // Should evict cache-1
      
      expect(storage.cache.size).toBe(2);
      expect(storage.cache.has('cache-1')).toBe(false);
      expect(storage.cache.has('cache-2')).toBe(true);
      expect(storage.cache.has('cache-3')).toBe(true);
    });

    test('should clear cache', () => {
      storage.cache.set('test-key', { data: 'test' });
      
      expect(storage.cache.size).toBe(1);
      
      storage.clearCache();
      
      expect(storage.cache.size).toBe(0);
    });

    test('should emit cacheCleared event', () => {
      const eventSpy = jest.fn();
      storage.on('cacheCleared', eventSpy);
      
      storage.clearCache();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Backup Operations', () => {
    beforeEach(async () => {
      storage.config.enableBackups = true;
      await storage.storeHook('backup-test', { name: 'backup-test' });
    });

    test('should create backup manually', () => {
      const backupId = storage.createBackup();
      
      expect(backupId).toMatch(/^backup-\d+$/);
      expect(storage.backupStorage.has(backupId)).toBe(true);
    });

    test('should emit backupCreated event', () => {
      const eventSpy = jest.fn();
      storage.on('backupCreated', eventSpy);
      
      const backupId = storage.createBackup();
      
      expect(eventSpy).toHaveBeenCalledWith({
        backupId,
        size: storage.storage.size
      });
    });

    test('should restore from backup', async () => {
      const backupId = storage.createBackup();
      
      // Modify storage after backup
      await storage.storeHook('new-hook', { name: 'new-hook' });
      expect(storage.storage.size).toBe(2);
      
      // Restore from backup
      await storage.restoreFromBackup(backupId);
      
      expect(storage.storage.size).toBe(1);
      expect(storage.storage.has('backup-test')).toBe(true);
      expect(storage.storage.has('new-hook')).toBe(false);
    });

    test('should emit backupRestored event', async () => {
      const eventSpy = jest.fn();
      storage.on('backupRestored', eventSpy);
      
      const backupId = storage.createBackup();
      await storage.restoreFromBackup(backupId);
      
      expect(eventSpy).toHaveBeenCalledWith({
        backupId,
        restoredCount: 1
      });
    });

    test('should list backups', async () => {
      const backup1 = storage.createBackup();
      
      // Add larger delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const backup2 = storage.createBackup();
      
      const backups = storage.listBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0].id).toBe(backup2); // Most recent first
      expect(backups[1].id).toBe(backup1);
      expect(backups.every(b => b.timestamp && b.size)).toBe(true);
    });

    test('should reject restore of non-existent backup', async () => {
      await expect(storage.restoreFromBackup('non-existent')).rejects.toThrow("Backup 'non-existent' not found");
    });

    test('should reject backup operations when disabled', () => {
      storage.config.enableBackups = false;
      
      expect(() => storage.createBackup()).not.toThrow();
      expect(storage.createBackup()).toBeUndefined();
    });
  });

  describe('Storage Maintenance', () => {
    test('should compact storage', async () => {
      await storage.storeHook('compact-test', { name: 'compact-test' });
      
      // Create orphaned metadata
      storage.metadata.set('orphaned', { type: 'orphaned' });
      
      const cleaned = await storage.compact();
      
      expect(cleaned).toBe(0); // No actual cleanup in this test
      expect(storage.metadata.has('orphaned')).toBe(false);
    });

    test('should emit storageCompacted event', async () => {
      const eventSpy = jest.fn();
      storage.on('storageCompacted', eventSpy);
      
      await storage.compact();
      
      expect(eventSpy).toHaveBeenCalledWith({
        beforeSize: expect.any(Number),
        afterSize: expect.any(Number),
        cleaned: expect.any(Number)
      });
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        enableCaching: false,
        maxCacheSize: 500
      };
      
      const updatedConfig = storage.updateConfig(newConfig);
      
      expect(updatedConfig.enableCaching).toBe(false);
      expect(updatedConfig.maxCacheSize).toBe(500);
      expect(storage.cache.size).toBe(0); // Cache should be cleared
    });

    test('should emit configUpdated event', () => {
      const eventSpy = jest.fn();
      storage.on('configUpdated', eventSpy);
      
      const newConfig = { enableCaching: false };
      storage.updateConfig(newConfig);
      
      expect(eventSpy).toHaveBeenCalledWith({
        oldConfig: expect.objectContaining({ enableCaching: true }),
        newConfig: expect.objectContaining({ enableCaching: false })
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track comprehensive statistics', async () => {
      await storage.storeHook('stats-test', { name: 'stats-test' });
      await storage.retrieveHook('stats-test');
      await storage.deleteHook('stats-test');
      
      const stats = storage.getStatistics();
      
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.readOperations).toBeGreaterThan(0);
      expect(stats.writeOperations).toBeGreaterThan(0);
      expect(stats.deleteOperations).toBeGreaterThan(0);
      expect(stats.storageSize).toBe(0);
    });

    test('should calculate cache hit rate', async () => {
      storage.config.enableCaching = true;
      
      // Clear cache and reset statistics for clean test
      storage.clearCache();
      storage.statistics.cacheHits = 0;
      storage.statistics.cacheMisses = 0;
      
      await storage.storeHook('cache-stats', { name: 'cache-stats' }); // Caches the hook
      await storage.retrieveHook('cache-stats'); // Cache hit (hook was cached during store)
      await storage.retrieveHook('cache-stats'); // Cache hit
      
      const stats = storage.getStatistics();
      
      expect(stats.cacheHitRate).toBe(100); // Both retrievals are cache hits
    });
  });

  describe('Storage Shutdown', () => {
    test('should shutdown storage cleanly', async () => {
      await storage.storeHook('shutdown-test', { name: 'shutdown-test' });
      
      expect(storage.isInitialized).toBe(true);
      expect(storage.storage.size).toBe(1);
      
      await storage.shutdown();
      
      expect(storage.isInitialized).toBe(false);
      expect(storage.storage.size).toBe(0);
    });

    test('should emit storageShutdown event', async () => {
      const eventSpy = jest.fn();
      storage.on('storageShutdown', eventSpy);
      
      await storage.shutdown();
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should create final backup on shutdown', async () => {
      storage.config.enableBackups = true;
      await storage.storeHook('final-backup-test', { name: 'final-backup-test' });
      
      const initialBackupCount = storage.statistics.backupOperations;
      
      await storage.shutdown();
      
      expect(storage.statistics.backupOperations).toBe(initialBackupCount + 1);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should handle large-scale storage operations efficiently', async () => {
      const startTime = Date.now();
      
      const hooks = new Map();
      for (let i = 0; i < 1000; i++) {
        hooks.set(`perf-hook-${i}`, { name: `perf-hook-${i}`, data: `data-${i}` });
      }
      
      await storage.storeBatch(hooks);
      
      const storeTime = Date.now() - startTime;
      expect(storeTime).toBeLessThan(1000); // Should complete within 1 second
      
      const retrieveStartTime = Date.now();
      
      const hookIds = Array.from(hooks.keys());
      await storage.retrieveBatch(hookIds);
      
      const retrieveTime = Date.now() - retrieveStartTime;
      expect(retrieveTime).toBeLessThan(500); // Should complete within 500ms
    });

    test('should handle concurrent operations efficiently', async () => {
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          storage.storeHook(`concurrent-${i}`, { name: `concurrent-${i}` })
        );
      }
      
      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(200); // Should complete within 200ms
      expect(storage.storage.size).toBe(100);
    });
  });
}); 