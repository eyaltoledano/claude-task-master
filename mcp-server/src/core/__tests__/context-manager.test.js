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

	describe('Cache Key Bug Detection', () => {
		it('should expose the cache key mismatch bug in updateContext', async () => {
			// Create initial context with metadata
			const initialContext = await contextManager.getContext('test-id', {
				initial: true,
				other: 'value'
			});

			// Verify initial context was cached (should be a cache miss)
			expect(contextManager.stats.misses).toBe(1);
			expect(contextManager.stats.hits).toBe(0);

			// Now call updateContext - this should find the existing context
			const updatedContext = await contextManager.updateContext('test-id', {
				updated: true
			});

			// BUG: updateContext calls getContext without metadata, creating new cache key
			// This means it creates a NEW context instead of updating the existing one

			// The bug is exposed here - original metadata is lost
			expect(updatedContext.metadata.initial).toBe(true); // This will fail
			expect(updatedContext.metadata.other).toBe('value'); // This will fail
			expect(updatedContext.metadata.updated).toBe(true); // This will pass

			// Additional evidence: updateContext should NOT increment misses
			// But due to the bug, it creates a new context (cache miss)
			expect(contextManager.stats.misses).toBe(1); // Should stay 1, but bug makes it 2
		});

		it('should demonstrate that contexts with different metadata create different cache entries', async () => {
			// Create two contexts with same ID but different metadata
			const context1 = await contextManager.getContext('same-id', {
				type: 'first'
			});
			const context2 = await contextManager.getContext('same-id', {
				type: 'second'
			});

			// These should be different objects due to different cache keys
			expect(context1).not.toBe(context2);
			expect(context1.metadata.type).toBe('first');
			expect(context2.metadata.type).toBe('second');

			// Both should be cache misses
			expect(contextManager.stats.misses).toBe(2);
			expect(contextManager.stats.hits).toBe(0);
		});
	});
});
