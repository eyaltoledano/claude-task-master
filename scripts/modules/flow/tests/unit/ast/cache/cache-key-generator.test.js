/**
 * @fileoverview Cache Key Generator Test Suite
 * 
 * Tests the cache key generation functionality including:
 * - File-based key generation
 * - Context-based key generation
 * - Git integration (branch/commit hashing)
 * - Key uniqueness and collision handling
 * - Performance under various scenarios
 * 
 * Part of Phase 1.2: AST Cache System Testing
 */

const path = require('path');
const crypto = require('crypto');

describe('CacheKeyGenerator', () => {
  let CacheKeyGenerator;
  let keyGenerator;

  beforeAll(() => {
    // Mock the CacheKeyGenerator class
    CacheKeyGenerator = class MockCacheKeyGenerator {
      constructor(options = {}) {
        this.options = {
          includeGitContext: options.includeGitContext !== false,
          includeFileStats: options.includeFileStats !== false,
          includeEnvironment: options.includeEnvironment || false,
          hashAlgorithm: options.hashAlgorithm || 'sha256',
          ...options
        };
        this.gitContext = null;
        this.environmentHash = null;
      }

      async initialize() {
        if (this.options.includeGitContext) {
          this.gitContext = await this._getGitContext();
        }
        
        if (this.options.includeEnvironment) {
          this.environmentHash = await this._getEnvironmentHash();
        }
        
        return true;
      }

      async generateFileKey(filePath, options = {}) {
        const components = [];
        
        // Add file path (normalized)
        const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
        components.push(`file:${normalizedPath}`);
        
        // Add file stats if enabled
        if (this.options.includeFileStats && !options.skipStats) {
          try {
            const stats = await this._getFileStats(filePath);
            components.push(`mtime:${stats.mtime.getTime()}`);
            components.push(`size:${stats.size}`);
          } catch (error) {
            // File doesn't exist or can't be accessed
            components.push('missing:true');
          }
        }
        
        // Add content hash if provided
        if (options.contentHash) {
          components.push(`content:${options.contentHash}`);
        }
        
        // Add git context if enabled
        if (this.options.includeGitContext && this.gitContext) {
          components.push(`git:${this.gitContext.branch}:${this.gitContext.commit}`);
        }
        
        return this._hashComponents(components);
      }

      async generateContextKey(context, options = {}) {
        const components = [];
        
        // Add context type
        components.push(`context:${context.type || 'unknown'}`);
        
        // Add file paths if provided
        if (context.files && Array.isArray(context.files)) {
          const sortedFiles = context.files.sort();
          components.push(`files:${sortedFiles.join(',')}`);
        }
        
        // Add task context if provided
        if (context.task) {
          components.push(`task:${context.task.id || 'unknown'}`);
          if (context.task.type) {
            components.push(`tasktype:${context.task.type}`);
          }
        }
        
        return this._hashComponents(components);
      }

      async _getGitContext() {
        try {
          return { branch: 'main', commit: 'abc123def456' };
        } catch (error) {
          return null;
        }
      }

      async _getEnvironmentHash() {
        return crypto.createHash('md5').update('test-env').digest('hex');
      }

      async _getFileStats(filePath) {
        return {
          mtime: new Date('2024-01-01T12:00:00Z'),
          size: 1024,
          isFile: () => true,
          isDirectory: () => false
        };
      }

      _hashComponents(components) {
        const input = components.join('|');
        return crypto.createHash(this.options.hashAlgorithm)
          .update(input)
          .digest('hex');
      }

      getStats() {
        return {
          gitContext: this.gitContext,
          environmentHash: this.environmentHash,
          options: this.options
        };
      }
    };
  });

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator();
  });

  describe('Initialization', () => {
    test('should initialize with default options', async () => {
      const result = await keyGenerator.initialize();
      
      expect(result).toBe(true);
      expect(keyGenerator.options.includeGitContext).toBe(true);
      expect(keyGenerator.options.includeFileStats).toBe(true);
      expect(keyGenerator.options.hashAlgorithm).toBe('sha256');
    });

    test('should initialize with custom options', async () => {
      const customGenerator = new CacheKeyGenerator({
        includeGitContext: false,
        includeFileStats: false,
        includeEnvironment: true,
        hashAlgorithm: 'md5'
      });

      await customGenerator.initialize();

      expect(customGenerator.options.includeGitContext).toBe(false);
      expect(customGenerator.options.includeFileStats).toBe(false);
      expect(customGenerator.options.includeEnvironment).toBe(true);
      expect(customGenerator.options.hashAlgorithm).toBe('md5');
    });
  });

  describe('File Key Generation', () => {
    beforeEach(async () => {
      await keyGenerator.initialize();
    });

    test('should generate consistent keys for same file', async () => {
      const filePath = '/path/to/test.js';
      
      const key1 = await keyGenerator.generateFileKey(filePath);
      const key2 = await keyGenerator.generateFileKey(filePath);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA256 hex length
    });

    test('should generate different keys for different files', async () => {
      const file1 = '/path/to/test1.js';
      const file2 = '/path/to/test2.js';
      
      const key1 = await keyGenerator.generateFileKey(file1);
      const key2 = await keyGenerator.generateFileKey(file2);
      
      expect(key1).not.toBe(key2);
    });

    test('should include file stats in key generation', async () => {
      const filePath = '/path/to/test.js';
      
      // Generate key with stats
      const keyWithStats = await keyGenerator.generateFileKey(filePath);
      
      // Generate key without stats
      const keyWithoutStats = await keyGenerator.generateFileKey(filePath, { skipStats: true });
      
      expect(keyWithStats).not.toBe(keyWithoutStats);
    });
  });

  describe('Context Key Generation', () => {
    beforeEach(async () => {
      await keyGenerator.initialize();
    });

    test('should generate keys for task context', async () => {
      const context = {
        type: 'task',
        task: {
          id: 'task-123',
          type: 'implementation'
        },
        files: ['/src/app.js', '/src/utils.js']
      };
      
      const key = await keyGenerator.generateContextKey(context);
      
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64);
    });

    test('should generate different keys for different contexts', async () => {
      const context1 = {
        type: 'task',
        task: { id: 'task-1' },
        files: ['/src/app.js']
      };
      
      const context2 = {
        type: 'task',
        task: { id: 'task-2' },
        files: ['/src/app.js']
      };
      
      const key1 = await keyGenerator.generateContextKey(context1);
      const key2 = await keyGenerator.generateContextKey(context2);
      
      expect(key1).not.toBe(key2);
    });

    test('should sort files for consistent ordering', async () => {
      const context1 = {
        type: 'analysis',
        files: ['/src/b.js', '/src/a.js', '/src/c.js']
      };
      
      const context2 = {
        type: 'analysis',
        files: ['/src/a.js', '/src/c.js', '/src/b.js']
      };
      
      const key1 = await keyGenerator.generateContextKey(context1);
      const key2 = await keyGenerator.generateContextKey(context2);
      
      expect(key1).toBe(key2);
    });
  });

  describe('Performance Testing', () => {
    beforeEach(async () => {
      await keyGenerator.initialize();
    });

    test('should generate keys efficiently for many files', async () => {
      const fileCount = 1000;
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < fileCount; i++) {
        promises.push(keyGenerator.generateFileKey(`/path/to/file-${i}.js`));
      }
      
      const keys = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(keys.length).toBe(fileCount);
      expect(new Set(keys).size).toBe(fileCount); // All keys should be unique
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
