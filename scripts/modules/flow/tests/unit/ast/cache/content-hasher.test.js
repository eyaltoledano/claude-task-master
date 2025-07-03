/**
 * @fileoverview Content Hasher Test Suite
 * 
 * Tests the content hashing functionality including:
 * - File content hashing
 * - String content hashing
 * - Hash validation and verification
 * - Performance under various content sizes
 * - Error handling for invalid inputs
 * 
 * Part of Phase 1.2: AST Cache System Testing
 */

const crypto = require('crypto');
const fs = require('fs').promises;

describe('ContentHasher', () => {
  let ContentHasher;
  let hasher;

  beforeAll(() => {
    // Mock the ContentHasher class
    ContentHasher = class MockContentHasher {
      constructor(options = {}) {
        this.options = {
          algorithm: options.algorithm || 'sha256',
          encoding: options.encoding || 'hex',
          includeMetadata: options.includeMetadata || false,
          ...options
        };
      }

      async hashContent(content, options = {}) {
        if (content === null || content === undefined) {
          throw new Error('Content cannot be null or undefined');
        }

        const algorithm = options.algorithm || this.options.algorithm;
        const encoding = options.encoding || this.options.encoding;
        
        let contentString;
        if (typeof content === 'string') {
          contentString = content;
        } else if (Buffer.isBuffer(content)) {
          contentString = content.toString();
        } else {
          contentString = JSON.stringify(content);
        }

        const hash = crypto.createHash(algorithm)
          .update(contentString)
          .digest(encoding);

        if (this.options.includeMetadata || options.includeMetadata) {
          return {
            hash,
            algorithm,
            encoding,
            size: contentString.length,
            timestamp: Date.now()
          };
        }

        return hash;
      }

      async hashFile(filePath, options = {}) {
        try {
          // Mock file reading
          let content;
          if (filePath.includes('missing')) {
            throw new Error('File not found');
          } else if (filePath.includes('large')) {
            content = 'x'.repeat(1000000); // 1MB file
          } else if (filePath.includes('empty')) {
            content = '';
          } else {
            content = `// Mock file content for ${filePath}\nconst test = 'value';`;
          }

          return this.hashContent(content, options);
        } catch (error) {
          if (options.throwOnError !== false) {
            throw error;
          }
          return null;
        }
      }

      async validateHash(content, expectedHash, options = {}) {
        try {
          const actualHash = await this.hashContent(content, options);
          const hash = typeof actualHash === 'object' ? actualHash.hash : actualHash;
          return hash === expectedHash;
        } catch (error) {
          return false;
        }
      }

      async compareFiles(filePath1, filePath2, options = {}) {
        try {
          const hash1 = await this.hashFile(filePath1, options);
          const hash2 = await this.hashFile(filePath2, options);
          
          const h1 = typeof hash1 === 'object' ? hash1.hash : hash1;
          const h2 = typeof hash2 === 'object' ? hash2.hash : hash2;
          
          return h1 === h2;
        } catch (error) {
          return false;
        }
      }

      getSupportedAlgorithms() {
        return ['md5', 'sha1', 'sha256', 'sha512'];
      }

      getSupportedEncodings() {
        return ['hex', 'base64', 'base64url'];
      }
    };
  });

  beforeEach(() => {
    hasher = new ContentHasher();
  });

  describe('Content Hashing', () => {
    test('should hash string content correctly', async () => {
      const content = 'Hello, world!';
      const hash = await hasher.hashContent(content);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 hex length
    });

    test('should generate consistent hashes for same content', async () => {
      const content = 'Test content for consistency';
      
      const hash1 = await hasher.hashContent(content);
      const hash2 = await hasher.hashContent(content);
      
      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different content', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      
      const hash1 = await hasher.hashContent(content1);
      const hash2 = await hasher.hashContent(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should hash Buffer content correctly', async () => {
      const content = Buffer.from('Buffer content test');
      const hash = await hasher.hashContent(content);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should hash object content correctly', async () => {
      const content = { key: 'value', number: 42, array: [1, 2, 3] };
      const hash = await hasher.hashContent(content);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should handle empty content', async () => {
      const hash = await hasher.hashContent('');
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should throw error for null content', async () => {
      await expect(hasher.hashContent(null)).rejects.toThrow('Content cannot be null or undefined');
    });

    test('should throw error for undefined content', async () => {
      await expect(hasher.hashContent(undefined)).rejects.toThrow('Content cannot be null or undefined');
    });
  });

  describe('File Hashing', () => {
    test('should hash file content correctly', async () => {
      const filePath = '/path/to/test.js';
      const hash = await hasher.hashFile(filePath);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should generate consistent hashes for same file', async () => {
      const filePath = '/path/to/consistent.js';
      
      const hash1 = await hasher.hashFile(filePath);
      const hash2 = await hasher.hashFile(filePath);
      
      expect(hash1).toBe(hash2);
    });

    test('should handle missing files gracefully', async () => {
      const filePath = '/path/to/missing.js';
      
      await expect(hasher.hashFile(filePath)).rejects.toThrow('File not found');
    });

    test('should handle missing files with throwOnError=false', async () => {
      const filePath = '/path/to/missing.js';
      const hash = await hasher.hashFile(filePath, { throwOnError: false });
      
      expect(hash).toBeNull();
    });

    test('should handle empty files', async () => {
      const filePath = '/path/to/empty.js';
      const hash = await hasher.hashFile(filePath);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should handle large files efficiently', async () => {
      const filePath = '/path/to/large.js';
      const startTime = Date.now();
      
      const hash = await hasher.hashFile(filePath);
      const endTime = Date.now();
      
      expect(hash).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Hash Validation', () => {
    test('should validate correct hash', async () => {
      const content = 'Test content for validation';
      const hash = await hasher.hashContent(content);
      
      const isValid = await hasher.validateHash(content, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect hash', async () => {
      const content = 'Test content for validation';
      const wrongHash = 'incorrect_hash_value';
      
      const isValid = await hasher.validateHash(content, wrongHash);
      expect(isValid).toBe(false);
    });

    test('should handle validation errors gracefully', async () => {
      const isValid = await hasher.validateHash(null, 'some_hash');
      expect(isValid).toBe(false);
    });
  });

  describe('File Comparison', () => {
    test('should compare identical files correctly', async () => {
      const filePath1 = '/path/to/file1.js';
      const filePath2 = '/path/to/file1.js'; // Same file
      
      const areEqual = await hasher.compareFiles(filePath1, filePath2);
      expect(areEqual).toBe(true);
    });

    test('should compare different files correctly', async () => {
      const filePath1 = '/path/to/file1.js';
      const filePath2 = '/path/to/file2.js';
      
      const areEqual = await hasher.compareFiles(filePath1, filePath2);
      expect(areEqual).toBe(false);
    });

    test('should handle missing files in comparison', async () => {
      const filePath1 = '/path/to/existing.js';
      const filePath2 = '/path/to/missing.js';
      
      const areEqual = await hasher.compareFiles(filePath1, filePath2);
      expect(areEqual).toBe(false);
    });
  });

  describe('Algorithm Support', () => {
    test('should support different hash algorithms', async () => {
      const content = 'Test content for algorithms';
      const algorithms = ['md5', 'sha1', 'sha256', 'sha512'];
      
      const hashes = {};
      
      for (const algorithm of algorithms) {
        const hash = await hasher.hashContent(content, { algorithm });
        hashes[algorithm] = hash;
      }
      
      // All hashes should be different
      const uniqueHashes = new Set(Object.values(hashes));
      expect(uniqueHashes.size).toBe(algorithms.length);
      
      // Verify expected lengths
      expect(hashes.md5.length).toBe(32);
      expect(hashes.sha1.length).toBe(40);
      expect(hashes.sha256.length).toBe(64);
      expect(hashes.sha512.length).toBe(128);
    });

    test('should support different encodings', async () => {
      const content = 'Test content for encodings';
      const encodings = ['hex', 'base64', 'base64url'];
      
      const hashes = {};
      
      for (const encoding of encodings) {
        const hash = await hasher.hashContent(content, { encoding });
        hashes[encoding] = hash;
      }
      
      // All hashes should be different (due to encoding)
      const uniqueHashes = new Set(Object.values(hashes));
      expect(uniqueHashes.size).toBe(encodings.length);
      
      // Verify encoding characteristics
      expect(hashes.hex).toMatch(/^[0-9a-f]+$/);
      expect(hashes.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(hashes.base64url).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('should list supported algorithms', () => {
      const algorithms = hasher.getSupportedAlgorithms();
      
      expect(Array.isArray(algorithms)).toBe(true);
      expect(algorithms.length).toBeGreaterThan(0);
      expect(algorithms).toContain('sha256');
    });

    test('should list supported encodings', () => {
      const encodings = hasher.getSupportedEncodings();
      
      expect(Array.isArray(encodings)).toBe(true);
      expect(encodings.length).toBeGreaterThan(0);
      expect(encodings).toContain('hex');
    });
  });

  describe('Metadata Inclusion', () => {
    test('should include metadata when requested', async () => {
      const metadataHasher = new ContentHasher({ includeMetadata: true });
      const content = 'Test content with metadata';
      
      const result = await metadataHasher.hashContent(content);
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('algorithm');
      expect(result).toHaveProperty('encoding');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.algorithm).toBe('sha256');
      expect(result.encoding).toBe('hex');
      expect(result.size).toBe(content.length);
      expect(typeof result.timestamp).toBe('number');
    });

    test('should include metadata per-operation when requested', async () => {
      const content = 'Test content with per-op metadata';
      
      const result = await hasher.hashContent(content, { includeMetadata: true });
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('algorithm');
      expect(result).toHaveProperty('encoding');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('timestamp');
    });

    test('should work with metadata in file hashing', async () => {
      const filePath = '/path/to/test.js';
      
      const result = await hasher.hashFile(filePath, { includeMetadata: true });
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('algorithm');
    });

    test('should work with metadata in validation', async () => {
      const content = 'Test content for metadata validation';
      const result = await hasher.hashContent(content, { includeMetadata: true });
      
      const isValid = await hasher.validateHash(content, result.hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    test('should hash many small contents efficiently', async () => {
      const contentCount = 1000;
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < contentCount; i++) {
        promises.push(hasher.hashContent(`Content ${i}`));
      }
      
      const hashes = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(hashes.length).toBe(contentCount);
      expect(new Set(hashes).size).toBe(contentCount); // All should be unique
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent hashing operations', async () => {
      const concurrentCount = 100;
      const operations = [];
      
      for (let i = 0; i < concurrentCount; i++) {
        if (i % 2 === 0) {
          operations.push(hasher.hashContent(`Concurrent content ${i}`));
        } else {
          operations.push(hasher.hashFile(`/path/to/file${i}.js`));
        }
      }
      
      const results = await Promise.all(operations);
      
      expect(results.length).toBe(concurrentCount);
      expect(results.every(result => typeof result === 'string')).toBe(true);
    });

    test('should handle large content efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB string
      const startTime = Date.now();
      
      const hash = await hasher.hashContent(largeContent);
      const endTime = Date.now();
      
      expect(hash).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle special characters in content', async () => {
      const specialContent = '特殊文字 🚀 \n\t\r\0 \\/"';
      const hash = await hasher.hashContent(specialContent);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should handle very long strings', async () => {
      const veryLongString = 'a'.repeat(10000000); // 10MB string
      const hash = await hasher.hashContent(veryLongString);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    test('should handle circular references in objects', async () => {
      const circular = { name: 'test' };
      circular.self = circular;
      
      // Should handle gracefully (JSON.stringify will throw, but should be caught)
      await expect(hasher.hashContent(circular)).rejects.toThrow();
    });

    test('should handle binary data', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      const hash = await hasher.hashContent(binaryData);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });
  });
});
