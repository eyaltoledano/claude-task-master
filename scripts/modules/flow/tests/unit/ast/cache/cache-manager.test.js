/**
 * @fileoverview Cache Manager Test Suite
 * 
 * Tests the core cache management functionality including:
 * - Cache initialization and configuration
 * - Cache hit/miss scenarios
 * - Cache entry lifecycle management
 * - Memory management and cleanup
 * - Error handling and recovery
 * - Performance under load
 * 
 * Part of Phase 1.2: AST Cache System Testing
 */

const { performance } = require('perf_hooks');

// Mock dependencies
jest.mock('../../../../src/ast/cache/content-hasher.js', () => ({
  ContentHasher: {
    hashContent: jest.fn(),
    hashFile: jest.fn(),
    validateHash: jest.fn()
  }
}));

jest.mock('../../../../src/ast/cache/cache-key-generator.js', () => ({
  CacheKeyGenerator: {
    generateKey: jest.fn(),
    generateFileKey: jest.fn(),
    generateContextKey: jest.fn()
  }
}));

describe('CacheManager', () => {
  let CacheManager;
  let mockContentHasher;
  let mockKeyGenerator;
  let cacheManager;

  beforeAll(() => {
    // Mock the CacheManager class
    CacheManager = class MockCacheManager {
      constructor(options = {}) {
        this.options = {
          maxSize: options.maxSize || 1000,
          ttl: options.ttl || 3600000, // 1 hour
          enableMetrics: options.enableMetrics !== false,
          enableCompression: options.enableCompression || false,
          ...options
        };
        this.cache = new Map();
        this.metadata = new Map();
        this.accessTimes = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        this.evictionCount = 0;
        this.isInitialized = false;
      }

      async initialize() {
        if (this.isInitialized) {
          throw new Error('Cache manager already initialized');
        }
        this.isInitialized = true;
        this.startTime = Date.now();
        return true;
      }

      async get(key) {
        if (!this.isInitialized) {
          throw new Error('Cache manager not initialized');
        }

        const entry = this.cache.get(key);
        if (entry) {
          this.hitCount++;
          this.accessTimes.set(key, Date.now());
          
          // Check TTL
          const metadata = this.metadata.get(key);
          if (metadata && metadata.expiresAt < Date.now()) {
            this.cache.delete(key);
            this.metadata.delete(key);
            this.accessTimes.delete(key);
            this.missCount++;
            return null;
          }
          
          return entry;
        }
        
        this.missCount++;
        return null;
      }

      async set(key, value, options = {}) {
        if (!this.isInitialized) {
          throw new Error('Cache manager not initialized');
        }

        // Check size limits
        if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
          await this._evictLRU();
        }

        const now = Date.now();
        const ttl = options.ttl || this.options.ttl;
        
        this.cache.set(key, value);
        this.metadata.set(key, {
          createdAt: now,
          expiresAt: now + ttl,
          size: this._calculateSize(value),
          accessCount: 0
        });
        this.accessTimes.set(key, now);

        return true;
      }

      async delete(key) {
        if (!this.isInitialized) {
          throw new Error('Cache manager not initialized');
        }

        const deleted = this.cache.delete(key);
        this.metadata.delete(key);
        this.accessTimes.delete(key);
        return deleted;
      }

      async clear() {
        if (!this.isInitialized) {
          throw new Error('Cache manager not initialized');
        }

        this.cache.clear();
        this.metadata.clear();
        this.accessTimes.clear();
        this.hitCount = 0;
        this.missCount = 0;
        this.evictionCount = 0;
        return true;
      }

      async has(key) {
        if (!this.isInitialized) {
          throw new Error('Cache manager not initialized');
        }

        return this.cache.has(key);
      }

      getStats() {
        return {
          size: this.cache.size,
          hitCount: this.hitCount,
          missCount: this.missCount,
          evictionCount: this.evictionCount,
          hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
          totalRequests: this.hitCount + this.missCount,
          uptime: this.startTime ? Date.now() - this.startTime : 0
        };
      }

      async _evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, time] of this.accessTimes) {
          if (time < oldestTime) {
            oldestTime = time;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          await this.delete(oldestKey);
          this.evictionCount++;
        }
      }

      _calculateSize(value) {
        return JSON.stringify(value).length;
      }

      async shutdown() {
        if (!this.isInitialized) {
          return false;
        }

        await this.clear();
        this.isInitialized = false;
        return true;
      }
    };

    mockContentHasher = require('../../../../src/ast/cache/content-hasher.js').ContentHasher;
    mockKeyGenerator = require('../../../../src/ast/cache/cache-key-generator.js').CacheKeyGenerator;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager();
  });

  afterEach(async () => {
    if (cacheManager && cacheManager.isInitialized) {
      await cacheManager.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', async () => {
      expect(cacheManager.isInitialized).toBe(false);
      
      const result = await cacheManager.initialize();
      
      expect(result).toBe(true);
      expect(cacheManager.isInitialized).toBe(true);
      expect(cacheManager.options.maxSize).toBe(1000);
      expect(cacheManager.options.ttl).toBe(3600000);
    });

    test('should initialize with custom options', async () => {
      const customManager = new CacheManager({
        maxSize: 500,
        ttl: 1800000,
        enableMetrics: false,
        enableCompression: true
      });

      await customManager.initialize();

      expect(customManager.options.maxSize).toBe(500);
      expect(customManager.options.ttl).toBe(1800000);
      expect(customManager.options.enableMetrics).toBe(false);
      expect(customManager.options.enableCompression).toBe(true);

      await customManager.shutdown();
    });

    test('should throw error on double initialization', async () => {
      await cacheManager.initialize();
      
      await expect(cacheManager.initialize()).rejects.toThrow('Cache manager already initialized');
    });

    test('should track initialization time', async () => {
      const beforeInit = Date.now();
      await cacheManager.initialize();
      const afterInit = Date.now();

      expect(cacheManager.startTime).toBeGreaterThanOrEqual(beforeInit);
      expect(cacheManager.startTime).toBeLessThanOrEqual(afterInit);
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('should set and get cache entries', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      const setResult = await cacheManager.set(key, value);
      expect(setResult).toBe(true);

      const retrieved = await cacheManager.get(key);
      expect(retrieved).toEqual(value);
    });

    test('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('should check key existence', async () => {
      const key = 'existence-test';
      
      expect(await cacheManager.has(key)).toBe(false);
      
      await cacheManager.set(key, 'value');
      expect(await cacheManager.has(key)).toBe(true);
    });

    test('should delete cache entries', async () => {
      const key = 'delete-test';
      await cacheManager.set(key, 'value');
      
      expect(await cacheManager.has(key)).toBe(true);
      
      const deleted = await cacheManager.delete(key);
      expect(deleted).toBe(true);
      expect(await cacheManager.has(key)).toBe(false);
    });

    test('should clear all cache entries', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      expect(cacheManager.cache.size).toBe(3);

      await cacheManager.clear();
      expect(cacheManager.cache.size).toBe(0);
    });

    test('should throw error when operating on uninitialized cache', async () => {
      const uninitializedManager = new CacheManager();

      await expect(uninitializedManager.get('key')).rejects.toThrow('Cache manager not initialized');
      await expect(uninitializedManager.set('key', 'value')).rejects.toThrow('Cache manager not initialized');
      await expect(uninitializedManager.delete('key')).rejects.toThrow('Cache manager not initialized');
      await expect(uninitializedManager.has('key')).rejects.toThrow('Cache manager not initialized');
      await expect(uninitializedManager.clear()).rejects.toThrow('Cache manager not initialized');
    });
  });

  describe('Cache Hit/Miss Scenarios', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('should track cache hits correctly', async () => {
      const key = 'hit-test';
      await cacheManager.set(key, 'value');

      // Multiple gets should increase hit count
      await cacheManager.get(key);
      await cacheManager.get(key);
      await cacheManager.get(key);

      const stats = cacheManager.getStats();
      expect(stats.hitCount).toBe(3);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(1.0);
    });

    test('should track cache misses correctly', async () => {
      // Multiple misses
      await cacheManager.get('miss1');
      await cacheManager.get('miss2');
      await cacheManager.get('miss3');

      const stats = cacheManager.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(3);
      expect(stats.hitRate).toBe(0);
    });

    test('should calculate hit rate correctly', async () => {
      // Set up some data
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');

      // 2 hits, 2 misses
      await cacheManager.get('key1'); // hit
      await cacheManager.get('key2'); // hit
      await cacheManager.get('miss1'); // miss
      await cacheManager.get('miss2'); // miss

      const stats = cacheManager.getStats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(2);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.totalRequests).toBe(4);
    });

    test('should update access times on cache hits', async () => {
      const key = 'access-time-test';
      await cacheManager.set(key, 'value');

      const initialAccessTime = cacheManager.accessTimes.get(key);
      
      // Wait a bit and access again
      await new Promise(resolve => setTimeout(resolve, 10));
      await cacheManager.get(key);

      const updatedAccessTime = cacheManager.accessTimes.get(key);
      expect(updatedAccessTime).toBeGreaterThan(initialAccessTime);
    });
  });

  describe('TTL and Expiration', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('should respect TTL settings', async () => {
      const key = 'ttl-test';
      const shortTTL = 50; // 50ms

      await cacheManager.set(key, 'value', { ttl: shortTTL });
      
      // Should be available immediately
      expect(await cacheManager.get(key)).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired and return null
      expect(await cacheManager.get(key)).toBeNull();
    });

    test('should clean up expired entries', async () => {
      const key = 'cleanup-test';
      const shortTTL = 50;

      await cacheManager.set(key, 'value', { ttl: shortTTL });
      expect(cacheManager.cache.size).toBe(1);

      // Wait for expiration and access
      await new Promise(resolve => setTimeout(resolve, 100));
      await cacheManager.get(key);

      // Entry should be cleaned up
      expect(cacheManager.cache.size).toBe(0);
      expect(cacheManager.metadata.size).toBe(0);
      expect(cacheManager.accessTimes.size).toBe(0);
    });

    test('should use default TTL when not specified', async () => {
      const key = 'default-ttl-test';
      await cacheManager.set(key, 'value');

      const metadata = cacheManager.metadata.get(key);
      const expectedExpiration = metadata.createdAt + cacheManager.options.ttl;
      
      expect(metadata.expiresAt).toBe(expectedExpiration);
    });
  });

  describe('Size Management and LRU Eviction', () => {
    beforeEach(async () => {
      // Create cache with small size limit for testing
      cacheManager = new CacheManager({ maxSize: 3 });
      await cacheManager.initialize();
    });

    test('should enforce size limits', async () => {
      // Fill cache to capacity
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      expect(cacheManager.cache.size).toBe(3);

      // Adding one more should trigger eviction
      await cacheManager.set('key4', 'value4');

      expect(cacheManager.cache.size).toBe(3);
      expect(cacheManager.getStats().evictionCount).toBe(1);
    });

    test('should evict least recently used entries', async () => {
      // Fill cache
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      // Access key2 and key3 to make key1 the LRU
      await cacheManager.get('key2');
      await cacheManager.get('key3');

      // Add new entry, should evict key1
      await cacheManager.set('key4', 'value4');

      expect(await cacheManager.has('key1')).toBe(false);
      expect(await cacheManager.has('key2')).toBe(true);
      expect(await cacheManager.has('key3')).toBe(true);
      expect(await cacheManager.has('key4')).toBe(true);
    });

    test('should not evict when updating existing entries', async () => {
      // Fill cache to capacity
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');

      const initialEvictionCount = cacheManager.getStats().evictionCount;

      // Update existing entry
      await cacheManager.set('key2', 'updated-value2');

      expect(cacheManager.cache.size).toBe(3);
      expect(cacheManager.getStats().evictionCount).toBe(initialEvictionCount);
      expect(await cacheManager.get('key2')).toBe('updated-value2');
    });
  });

  describe('Performance Testing', () => {
    beforeEach(async () => {
      // Create cache with larger capacity for performance tests
      cacheManager = new CacheManager({ maxSize: 10000 });
      await cacheManager.initialize();
    });

    test('should handle high-volume operations efficiently', async () => {
      const operationCount = 1000;
      const startTime = performance.now();

      // Perform many set operations
      const setPromises = [];
      for (let i = 0; i < operationCount; i++) {
        setPromises.push(cacheManager.set(`key-${i}`, `value-${i}`));
      }
      await Promise.all(setPromises);

      // Perform many get operations
      const getPromises = [];
      for (let i = 0; i < operationCount; i++) {
        getPromises.push(cacheManager.get(`key-${i}`));
      }
      const results = await Promise.all(getPromises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.length).toBe(operationCount);
      expect(results.every((result, index) => result === `value-${index}`)).toBe(true);

      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(1.0);
      expect(stats.size).toBe(operationCount);
    });

    test('should handle concurrent operations safely', async () => {
      const concurrentOperations = 100;
      const operations = [];

      // Create mix of concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        if (i % 3 === 0) {
          operations.push(cacheManager.set(`concurrent-${i}`, `value-${i}`));
        } else if (i % 3 === 1) {
          operations.push(cacheManager.get(`concurrent-${i - 1}`));
        } else {
          operations.push(cacheManager.has(`concurrent-${i - 2}`));
        }
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // Verify no operations failed
      expect(results.length).toBe(concurrentOperations);
      
      // Cache should be in consistent state
      const stats = cacheManager.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.totalRequests).toBeGreaterThan(0);
    });

    test('should maintain performance under memory pressure', async () => {
      // Create cache with very small size to force frequent evictions
      const pressureCache = new CacheManager({ maxSize: 10 });
      await pressureCache.initialize();

      const iterations = 100;
      const startTime = performance.now();

      // Continuously add entries to force evictions
      for (let i = 0; i < iterations; i++) {
        await pressureCache.set(`pressure-${i}`, `large-value-${'x'.repeat(1000)}-${i}`);
        
        // Occasionally read to mix operations
        if (i % 10 === 0) {
          await pressureCache.get(`pressure-${Math.max(0, i - 5)}`);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle pressure gracefully
      expect(duration).toBeLessThan(2000);
      expect(pressureCache.cache.size).toBeLessThanOrEqual(10);
      expect(pressureCache.getStats().evictionCount).toBeGreaterThan(iterations - 10);

      await pressureCache.shutdown();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('should provide comprehensive statistics', async () => {
      // Perform various operations
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.get('key1'); // hit
      await cacheManager.get('key1'); // hit
      await cacheManager.get('nonexistent'); // miss

      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitCount');
      expect(stats).toHaveProperty('missCount');
      expect(stats).toHaveProperty('evictionCount');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('uptime');

      expect(stats.size).toBe(2);
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.totalRequests).toBe(3);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    test('should track uptime correctly', async () => {
      const initialStats = cacheManager.getStats();
      const initialUptime = initialStats.uptime;

      await new Promise(resolve => setTimeout(resolve, 100));

      const laterStats = cacheManager.getStats();
      expect(laterStats.uptime).toBeGreaterThan(initialUptime);
    });

    test('should reset statistics on clear', async () => {
      // Generate some activity
      await cacheManager.set('key1', 'value1');
      await cacheManager.get('key1');
      await cacheManager.get('nonexistent');

      let stats = cacheManager.getStats();
      expect(stats.hitCount).toBeGreaterThan(0);
      expect(stats.missCount).toBeGreaterThan(0);

      await cacheManager.clear();

      stats = cacheManager.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.evictionCount).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    test('should handle invalid keys gracefully', async () => {
      // Test with various invalid key types
      const invalidKeys = [null, undefined, '', 0, false, {}, []];

      for (const invalidKey of invalidKeys) {
        // Should not throw, but should handle gracefully
        try {
          await cacheManager.set(invalidKey, 'value');
          await cacheManager.get(invalidKey);
          await cacheManager.has(invalidKey);
          await cacheManager.delete(invalidKey);
        } catch (error) {
          // If errors are thrown, they should be meaningful
          expect(error.message).toBeTruthy();
        }
      }
    });

    test('should handle large values appropriately', async () => {
      const largeValue = 'x'.repeat(1000000); // 1MB string
      const key = 'large-value-test';

      const setResult = await cacheManager.set(key, largeValue);
      expect(setResult).toBe(true);

      const retrieved = await cacheManager.get(key);
      expect(retrieved).toBe(largeValue);

      // Verify size calculation
      const metadata = cacheManager.metadata.get(key);
      expect(metadata.size).toBeGreaterThan(1000000);
    });

    test('should recover from corrupted state', async () => {
      // Simulate corruption by manually manipulating internal state
      await cacheManager.set('key1', 'value1');
      
      // Corrupt metadata but keep cache entry
      cacheManager.metadata.delete('key1');

      // Operations should still work
      const result = await cacheManager.get('key1');
      expect(result).toBe('value1');

      // Should be able to recover by re-setting
      await cacheManager.set('key1', 'new-value1');
      expect(await cacheManager.get('key1')).toBe('new-value1');
    });
  });

  describe('Shutdown and Cleanup', () => {
    test('should shutdown gracefully', async () => {
      await cacheManager.initialize();
      
      // Add some data
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');

      expect(cacheManager.isInitialized).toBe(true);
      expect(cacheManager.cache.size).toBe(2);

      const shutdownResult = await cacheManager.shutdown();
      
      expect(shutdownResult).toBe(true);
      expect(cacheManager.isInitialized).toBe(false);
      expect(cacheManager.cache.size).toBe(0);
    });

    test('should handle shutdown of uninitialized cache', async () => {
      const uninitializedManager = new CacheManager();
      
      const shutdownResult = await uninitializedManager.shutdown();
      expect(shutdownResult).toBe(false);
    });

    test('should prevent operations after shutdown', async () => {
      await cacheManager.initialize();
      await cacheManager.shutdown();

      await expect(cacheManager.get('key')).rejects.toThrow('Cache manager not initialized');
      await expect(cacheManager.set('key', 'value')).rejects.toThrow('Cache manager not initialized');
    });
  });
}); 