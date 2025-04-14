import { jest } from '@jest/globals';
import { ContextManager } from '../context-manager.js';

describe('ContextManager', () => {
	let contextManager;

	beforeEach(() => {
		contextManager = new ContextManager({
			maxCacheSize: 10,
			ttl: 1000, // 1 second for testing
			maxContextSize: 1000
		});
	});

	describe('getContext', () => {
		it('should create a new context when not in cache', async () => {
			const context = await contextManager.getContext('test-id', {
				test: true
			});
			expect(context.id).toBe('test-id');
			expect(context.metadata.test).toBe(true);
			expect(contextManager.stats.misses).toBe(1);
			expect(contextManager.stats.hits).toBe(0);
		});

		it('should return cached context when available', async () => {
			// First call creates the context
			await contextManager.getContext('test-id', { test: true });

			// Second call should hit cache
			const context = await contextManager.getContext('test-id', {
				test: true
			});
			expect(context.id).toBe('test-id');
			expect(context.metadata.test).toBe(true);
			expect(contextManager.stats.hits).toBe(1);
			expect(contextManager.stats.misses).toBe(1);
		});

		it('should respect TTL settings', async () => {
			// Create context
			await contextManager.getContext('test-id', { test: true });

			// Wait for TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Should create new context
			await contextManager.getContext('test-id', { test: true });
			expect(contextManager.stats.misses).toBe(2);
			expect(contextManager.stats.hits).toBe(0);
		});
	});

	describe('updateContext', () => {
		it('should update existing context metadata', async () => {
			await contextManager.getContext('test-id', { initial: true });
			const updated = await contextManager.updateContext('test-id', {
				updated: true
			});

			expect(updated.metadata.initial).toBe(true);
			expect(updated.metadata.updated).toBe(true);
		});
	});

	describe('invalidateContext', () => {
		it('should remove context from cache', async () => {
			await contextManager.getContext('test-id', { test: true });
			contextManager.invalidateContext('test-id', { test: true });

			// Should be a cache miss
			await contextManager.getContext('test-id', { test: true });
			expect(contextManager.stats.invalidations).toBe(1);
			expect(contextManager.stats.misses).toBe(2);
		});
	});

	describe('getStats', () => {
		it('should return current cache statistics', async () => {
			await contextManager.getContext('test-id', { test: true });
			const stats = contextManager.getStats();

			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(1);
			expect(stats.invalidations).toBe(0);
			expect(stats.size).toBe(1);
			expect(stats.maxSize).toBe(10);
			expect(stats.ttl).toBe(1000);
		});
	});
});
