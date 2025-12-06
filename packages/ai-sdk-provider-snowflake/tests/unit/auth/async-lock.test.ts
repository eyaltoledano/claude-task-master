/**
 * Unit tests for AsyncLock mutex implementation
 * 
 * These tests verify the AsyncLock class behavior in isolation,
 * ensuring proper serialization of async operations.
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Copy of AsyncLock for testing purposes
 * In production, this is part of snowflake-auth.ts
 */
class AsyncLock {
	private queue: Array<() => void> = [];
	private locked = false;

	async acquire(): Promise<() => void> {
		return new Promise((resolve) => {
			const tryAcquire = () => {
				if (!this.locked) {
					this.locked = true;
					resolve(() => this.release());
				} else {
					this.queue.push(tryAcquire);
				}
			};
			tryAcquire();
		});
	}

	private release(): void {
		this.locked = false;
		const next = this.queue.shift();
		if (next) {
			next();
		}
	}
}

describe('AsyncLock', () => {
	describe('Basic Locking', () => {
		it('should allow first acquire to complete immediately', async () => {
			const lock = new AsyncLock();
			const startTime = Date.now();
			
			const release = await lock.acquire();
			const duration = Date.now() - startTime;
			
			expect(duration).toBeLessThan(10); // Should be nearly instant
			release();
		});

		it('should serialize sequential acquires', async () => {
			const lock = new AsyncLock();
			const executionOrder: number[] = [];

			// First acquire
			const release1 = await lock.acquire();
			executionOrder.push(1);
			
			// Start second acquire (will block)
			const acquire2Promise = lock.acquire().then((release2) => {
				executionOrder.push(2);
				return release2;
			});
			
			// Give time for second acquire to attempt
			await new Promise(resolve => setTimeout(resolve, 10));
			
			// Second should not have executed yet
			expect(executionOrder).toEqual([1]);
			
			// Release first lock
			release1();
			
			// Wait for second to complete
			const release2 = await acquire2Promise;
			expect(executionOrder).toEqual([1, 2]);
			
			release2();
		});

		it('should properly release and allow next acquire', async () => {
			const lock = new AsyncLock();

			const release1 = await lock.acquire();
			release1();

			// Should be able to acquire again immediately
			const startTime = Date.now();
			const release2 = await lock.acquire();
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(10); // Should be nearly instant
			release2();
		});
	});

	describe('Concurrent Access', () => {
		it('should serialize multiple concurrent acquires', async () => {
			const lock = new AsyncLock();
			const executionOrder: number[] = [];
			const critical = { value: 0 };

			// Launch 10 concurrent operations
			const operations = Array.from({ length: 10 }, (_, i) => 
				lock.acquire().then(async (release) => {
					// Critical section
					const currentValue = critical.value;
					executionOrder.push(i);
					
					// Simulate async work
					await new Promise(resolve => setTimeout(resolve, 1));
					
					critical.value = currentValue + 1;
					release();
				})
			);

			await Promise.all(operations);

			// All operations should have completed
			expect(executionOrder).toHaveLength(10);
			
			// Critical section should have been protected
			expect(critical.value).toBe(10);
			
			// Each value should be unique (no duplicates from race conditions)
			const uniqueValues = new Set(executionOrder);
			expect(uniqueValues.size).toBe(10);
		});

		it('should handle high concurrency (100 operations)', async () => {
			const lock = new AsyncLock();
			let counter = 0;

			const operations = Array.from({ length: 100 }, () =>
				lock.acquire().then(async (release) => {
					const value = counter;
					// Simulate async work
					await new Promise(resolve => setTimeout(resolve, 0));
					counter = value + 1;
					release();
				})
			);

			await Promise.all(operations);
			expect(counter).toBe(100);
		});

		it('should maintain FIFO order for queued acquires', async () => {
			const lock = new AsyncLock();
			const executionOrder: number[] = [];

			// Acquire lock first
			const release0 = await lock.acquire();

			// Queue up multiple acquires while lock is held
			const acquires = Array.from({ length: 5 }, (_, i) =>
				lock.acquire().then((release) => {
					executionOrder.push(i);
					release();
				})
			);

			// Give time for all acquires to queue
			await new Promise(resolve => setTimeout(resolve, 10));

			// Release initial lock
			release0();

			// Wait for all queued acquires to complete
			await Promise.all(acquires);

			// Should execute in FIFO order
			expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
		});
	});

	describe('Error Handling', () => {
		it('should not deadlock if release is called multiple times', async () => {
			const lock = new AsyncLock();

			const release = await lock.acquire();
			release();
			release(); // Second release should be safe (no-op)

			// Should still be able to acquire
			const release2 = await lock.acquire();
			expect(release2).toBeDefined();
			release2();
		});

		it('should handle errors in critical section without deadlock', async () => {
			const lock = new AsyncLock();
			const executionOrder: number[] = [];

			// First operation throws error
			const operation1 = lock.acquire().then(async (release) => {
				try {
					executionOrder.push(1);
					throw new Error('Test error');
				} finally {
					release();
				}
			}).catch(() => {
				// Catch but don't fail test
			});

			// Second operation should still work
			const operation2 = lock.acquire().then(async (release) => {
				executionOrder.push(2);
				release();
			});

			await Promise.all([operation1, operation2]);
			expect(executionOrder).toEqual([1, 2]);
		});

		it('should recover from error in release function', async () => {
			const lock = new AsyncLock();

			const release1 = await lock.acquire();
			
			// Start second acquire
			const acquire2Promise = lock.acquire();
			
			// Give time for second to queue
			await new Promise(resolve => setTimeout(resolve, 10));
			
			// Release first (even if it somehow errors, lock should still work)
			try {
				release1();
			} catch {
				// Ignore error
			}
			
			// Second should still complete
			const release2 = await acquire2Promise;
			expect(release2).toBeDefined();
			release2();
		});
	});

	describe('Performance', () => {
		it('should have minimal overhead for uncontended lock', async () => {
			const lock = new AsyncLock();
			const iterations = 1000;
			const startTime = Date.now();

			for (let i = 0; i < iterations; i++) {
				const release = await lock.acquire();
				release();
			}

			const duration = Date.now() - startTime;
			const avgTimePerLock = duration / iterations;

			// Should average less than 1ms per lock/unlock cycle
			expect(avgTimePerLock).toBeLessThan(1);
		});

		it('should complete many concurrent operations in reasonable time', async () => {
			const lock = new AsyncLock();
			const operationCount = 100;
			const startTime = Date.now();

			const operations = Array.from({ length: operationCount }, () =>
				lock.acquire().then(async (release) => {
					// Simulate very brief work
					await Promise.resolve();
					release();
				})
			);

			await Promise.all(operations);
			const duration = Date.now() - startTime;

			// 100 operations should complete in less than 2 seconds
			expect(duration).toBeLessThan(2000);
		});
	});

	describe('Memory Leaks', () => {
		it('should clean up queue when operations complete', async () => {
			const lock = new AsyncLock();

			// Acquire and release many times
			for (let i = 0; i < 100; i++) {
				const release = await lock.acquire();
				release();
			}

			// Queue should be empty
			// We can't directly test this, but we can verify that
			// subsequent acquires still work quickly
			const startTime = Date.now();
			const release = await lock.acquire();
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(10);
			release();
		});

		it('should not accumulate queue when operations complete', async () => {
			const lock = new AsyncLock();

			// Run multiple waves of concurrent operations
			for (let wave = 0; wave < 10; wave++) {
				const operations = Array.from({ length: 10 }, () =>
					lock.acquire().then(release => release())
				);
				await Promise.all(operations);
			}

			// Final acquire should still be fast
			const startTime = Date.now();
			const release = await lock.acquire();
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(10);
			release();
		});
	});
});

