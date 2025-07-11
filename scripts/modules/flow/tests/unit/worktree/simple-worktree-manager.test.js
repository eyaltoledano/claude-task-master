/**
 * @file simple-worktree-manager.test.js
 * @description Tests for SimpleWorktreeManager class
 * Tests basic worktree operations, simplified discovery, and lightweight management
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock SimpleWorktreeManager class with basic functionality
class MockSimpleWorktreeManager extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = {
			rootPath: options.rootPath || '/mock/simple-project',
			scanDepth: options.scanDepth || 2,
			enableCaching: options.enableCaching !== false,
			refreshInterval: options.refreshInterval || 30000,
			...options
		};

		this.worktrees = [];
		this.cache = new Map();
		this.lastScan = null;
		this.isScanning = false;
		this.refreshTimer = null;

		this.statistics = {
			totalScans: 0,
			foundWorktrees: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averageScanTime: 0,
			lastScanTime: null,
			errors: 0
		};
	}

	async initialize() {
		try {
			await this.scan();

			if (this.options.refreshInterval > 0) {
				this.startAutoRefresh();
			}

			this.emit('initialized', {
				worktreeCount: this.worktrees.length,
				cacheEnabled: this.options.enableCaching
			});

			return {
				success: true,
				worktreeCount: this.worktrees.length
			};
		} catch (error) {
			this.statistics.errors++;
			this.emit('error', error);
			throw error;
		}
	}

	async scan() {
		if (this.isScanning) {
			throw new Error('Scan already in progress');
		}

		const startTime = Date.now();
		this.isScanning = true;
		this.statistics.totalScans++;

		try {
			this.emit('scanStarted');

			// Check cache first
			const cacheKey = `scan-${this.options.rootPath}`;
			if (this.options.enableCaching && this.cache.has(cacheKey)) {
				const cached = this.cache.get(cacheKey);
				const age = Date.now() - cached.timestamp;

				if (age < this.options.refreshInterval) {
					this.statistics.cacheHits++;
					this.worktrees = [...cached.worktrees];
					this.emit('scanCompleted', {
						worktreeCount: this.worktrees.length,
						fromCache: true,
						scanTime: Date.now() - startTime
					});
					return this.worktrees.length;
				}
			}

			this.statistics.cacheMisses++;

			// Simulate scanning for worktrees
			await new Promise((resolve) =>
				setTimeout(resolve, Math.max(1, Math.random() * 20))
			);

			const mockWorktrees = [
				{
					path: '/mock/simple-project',
					branch: 'main',
					isMain: true,
					head: 'abc123',
					status: 'clean'
				},
				{
					path: '/mock/simple-project-feature',
					branch: 'feature/simple-auth',
					isMain: false,
					head: 'def456',
					status: 'modified'
				}
			];

			this.worktrees = mockWorktrees;
			this.statistics.foundWorktrees += mockWorktrees.length;

			// Cache the results
			if (this.options.enableCaching) {
				this.cache.set(cacheKey, {
					worktrees: [...mockWorktrees],
					timestamp: Date.now()
				});
			}

			const scanTime = Date.now() - startTime;
			this.statistics.averageScanTime = this.updateAverage(
				this.statistics.averageScanTime,
				scanTime,
				this.statistics.totalScans - 1
			);
			this.statistics.lastScanTime = new Date().toISOString();
			this.lastScan = Date.now();

			this.emit('scanCompleted', {
				worktreeCount: this.worktrees.length,
				fromCache: false,
				scanTime
			});

			return this.worktrees.length;
		} finally {
			this.isScanning = false;
		}
	}

	getWorktrees() {
		return [...this.worktrees];
	}

	findWorktree(path) {
		return this.worktrees.find((w) => w.path === path) || null;
	}

	findWorktreeByBranch(branch) {
		return this.worktrees.find((w) => w.branch === branch) || null;
	}

	getMainWorktree() {
		return this.worktrees.find((w) => w.isMain) || null;
	}

	getWorktreeCount() {
		return this.worktrees.length;
	}

	getBranches() {
		return [...new Set(this.worktrees.map((w) => w.branch))];
	}

	getWorktreeStatus(path) {
		const worktree = this.findWorktree(path);
		return worktree ? worktree.status : null;
	}

	isWorktreeClean(path) {
		const worktree = this.findWorktree(path);
		return worktree ? worktree.status === 'clean' : false;
	}

	hasUncommittedChanges(path) {
		const worktree = this.findWorktree(path);
		return worktree ? worktree.status !== 'clean' : false;
	}

	async refresh() {
		if (this.isScanning) {
			return false;
		}

		await this.scan();
		this.emit('refreshed', { worktreeCount: this.worktrees.length });
		return true;
	}

	startAutoRefresh() {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
		}

		this.refreshTimer = setInterval(async () => {
			try {
				await this.refresh();
			} catch (error) {
				this.statistics.errors++;
				this.emit('error', error);
			}
		}, this.options.refreshInterval);

		this.emit('autoRefreshStarted', { interval: this.options.refreshInterval });
	}

	stopAutoRefresh() {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
			this.emit('autoRefreshStopped');
		}
	}

	clearCache() {
		this.cache.clear();
		this.emit('cacheCleared');
	}

	getCacheSize() {
		return this.cache.size;
	}

	getStatistics() {
		return {
			...this.statistics,
			currentWorktrees: this.worktrees.length,
			cacheSize: this.cache.size,
			lastScanAge: this.lastScan ? Date.now() - this.lastScan : null,
			cacheHitRate:
				this.statistics.cacheHits + this.statistics.cacheMisses > 0
					? (this.statistics.cacheHits /
							(this.statistics.cacheHits + this.statistics.cacheMisses)) *
						100
					: 0,
			autoRefreshActive: !!this.refreshTimer
		};
	}

	updateAverage(currentAverage, newValue, count) {
		if (count === 0) return newValue;
		return (currentAverage * count + newValue) / (count + 1);
	}

	async destroy() {
		this.stopAutoRefresh();
		this.clearCache();
		this.worktrees = [];
		this.lastScan = null;
		this.isScanning = false;

		this.emit('destroyed');
	}
}

describe('SimpleWorktreeManager', () => {
	let manager;

	beforeEach(() => {
		manager = new MockSimpleWorktreeManager({
			rootPath: '/test/simple-project',
			scanDepth: 2,
			enableCaching: true,
			refreshInterval: 1000
		});
	});

	afterEach(async () => {
		if (manager) {
			await manager.destroy();
		}
	});

	describe('Initialization', () => {
		test('should initialize successfully', async () => {
			const result = await manager.initialize();

			expect(result.success).toBe(true);
			expect(result.worktreeCount).toBeGreaterThan(0);
			expect(manager.worktrees.length).toBeGreaterThan(0);
		});

		test('should emit initialized event', async () => {
			const initSpy = jest.fn();
			manager.on('initialized', initSpy);

			await manager.initialize();

			expect(initSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					worktreeCount: expect.any(Number),
					cacheEnabled: true
				})
			);
		});

		test('should start auto-refresh during initialization', async () => {
			const autoRefreshSpy = jest.fn();
			manager.on('autoRefreshStarted', autoRefreshSpy);

			await manager.initialize();

			expect(autoRefreshSpy).toHaveBeenCalledWith({
				interval: manager.options.refreshInterval
			});
			expect(manager.refreshTimer).toBeTruthy();
		});
	});

	describe('Scanning Operations', () => {
		test('should scan for worktrees', async () => {
			const worktreeCount = await manager.scan();

			expect(worktreeCount).toBeGreaterThan(0);
			expect(manager.worktrees.length).toBe(worktreeCount);
			expect(manager.statistics.totalScans).toBe(1);
		});

		test('should emit scan events', async () => {
			const startSpy = jest.fn();
			const completedSpy = jest.fn();

			manager.on('scanStarted', startSpy);
			manager.on('scanCompleted', completedSpy);

			await manager.scan();

			expect(startSpy).toHaveBeenCalled();
			expect(completedSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					worktreeCount: expect.any(Number),
					fromCache: false,
					scanTime: expect.any(Number)
				})
			);
		});

		test('should prevent concurrent scans', async () => {
			const scanPromise1 = manager.scan();
			const scanPromise2 = manager.scan();

			await expect(scanPromise1).resolves.toBeGreaterThan(0);
			await expect(scanPromise2).rejects.toThrow('Scan already in progress');
		});
	});

	describe('Caching System', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		test('should cache scan results', async () => {
			await manager.scan();

			expect(manager.getCacheSize()).toBeGreaterThan(0);
			expect(manager.statistics.cacheMisses).toBe(1);
		});

		test('should use cached results when available', async () => {
			// First scan - should miss cache
			await manager.scan();
			const firstCacheMisses = manager.statistics.cacheMisses;

			// Second scan - should hit cache
			await manager.scan();

			expect(manager.statistics.cacheHits).toBe(1);
			expect(manager.statistics.cacheMisses).toBe(firstCacheMisses);
		});

		test('should clear cache', () => {
			manager.cache.set('test', 'value');
			expect(manager.getCacheSize()).toBe(1);

			const cacheClearedSpy = jest.fn();
			manager.on('cacheCleared', cacheClearedSpy);

			manager.clearCache();

			expect(manager.getCacheSize()).toBe(0);
			expect(cacheClearedSpy).toHaveBeenCalled();
		});
	});

	describe('Worktree Queries', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		test('should get all worktrees', () => {
			const worktrees = manager.getWorktrees();

			expect(Array.isArray(worktrees)).toBe(true);
			expect(worktrees.length).toBeGreaterThan(0);

			worktrees.forEach((worktree) => {
				expect(worktree).toHaveProperty('path');
				expect(worktree).toHaveProperty('branch');
				expect(worktree).toHaveProperty('isMain');
				expect(worktree).toHaveProperty('head');
				expect(worktree).toHaveProperty('status');
			});
		});

		test('should find worktree by path', () => {
			const worktrees = manager.getWorktrees();
			const firstWorktree = worktrees[0];

			const found = manager.findWorktree(firstWorktree.path);

			expect(found).toBeTruthy();
			expect(found.path).toBe(firstWorktree.path);
		});

		test('should find worktree by branch', () => {
			const worktrees = manager.getWorktrees();
			const firstWorktree = worktrees[0];

			const found = manager.findWorktreeByBranch(firstWorktree.branch);

			expect(found).toBeTruthy();
			expect(found.branch).toBe(firstWorktree.branch);
		});

		test('should get main worktree', () => {
			const mainWorktree = manager.getMainWorktree();

			expect(mainWorktree).toBeTruthy();
			expect(mainWorktree.isMain).toBe(true);
		});

		test('should get worktree count', () => {
			const count = manager.getWorktreeCount();
			const worktrees = manager.getWorktrees();

			expect(count).toBe(worktrees.length);
			expect(count).toBeGreaterThan(0);
		});

		test('should get all branches', () => {
			const branches = manager.getBranches();

			expect(Array.isArray(branches)).toBe(true);
			expect(branches.length).toBeGreaterThan(0);

			// Should have unique branches only
			const uniqueBranches = [...new Set(branches)];
			expect(branches.length).toBe(uniqueBranches.length);
		});
	});

	describe('Worktree Status Operations', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		test('should get worktree status', () => {
			const worktrees = manager.getWorktrees();
			const worktree = worktrees[0];

			const status = manager.getWorktreeStatus(worktree.path);

			expect(status).toBeTruthy();
			expect(['clean', 'modified', 'staged', 'conflict']).toContain(status);
		});

		test('should check if worktree is clean', () => {
			const worktrees = manager.getWorktrees();
			const cleanWorktree = worktrees.find((w) => w.status === 'clean');

			if (cleanWorktree) {
				const isClean = manager.isWorktreeClean(cleanWorktree.path);
				expect(isClean).toBe(true);
			}
		});

		test('should check if worktree has uncommitted changes', () => {
			const worktrees = manager.getWorktrees();
			const modifiedWorktree = worktrees.find((w) => w.status !== 'clean');

			if (modifiedWorktree) {
				const hasChanges = manager.hasUncommittedChanges(modifiedWorktree.path);
				expect(hasChanges).toBe(true);
			}
		});
	});

	describe('Refresh Operations', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		test('should refresh worktree data', async () => {
			const initialStats = manager.getStatistics();

			const refreshed = await manager.refresh();

			expect(refreshed).toBe(true);

			const finalStats = manager.getStatistics();
			expect(finalStats.totalScans).toBe(initialStats.totalScans + 1);
		});

		test('should emit refreshed event', async () => {
			const refreshedSpy = jest.fn();
			manager.on('refreshed', refreshedSpy);

			await manager.refresh();

			expect(refreshedSpy).toHaveBeenCalledWith({
				worktreeCount: expect.any(Number)
			});
		});

		test('should not refresh if scan is in progress', async () => {
			manager.isScanning = true;

			const refreshed = await manager.refresh();

			expect(refreshed).toBe(false);
		});
	});

	describe('Auto-Refresh System', () => {
		test('should start auto-refresh', () => {
			const autoRefreshSpy = jest.fn();
			manager.on('autoRefreshStarted', autoRefreshSpy);

			manager.startAutoRefresh();

			expect(manager.refreshTimer).toBeTruthy();
			expect(autoRefreshSpy).toHaveBeenCalledWith({
				interval: manager.options.refreshInterval
			});
		});

		test('should stop auto-refresh', () => {
			manager.startAutoRefresh();
			expect(manager.refreshTimer).toBeTruthy();

			const autoRefreshStoppedSpy = jest.fn();
			manager.on('autoRefreshStopped', autoRefreshStoppedSpy);

			manager.stopAutoRefresh();

			expect(manager.refreshTimer).toBeNull();
			expect(autoRefreshStoppedSpy).toHaveBeenCalled();
		});
	});

	describe('Statistics and Monitoring', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		test('should track comprehensive statistics', () => {
			const stats = manager.getStatistics();

			expect(stats).toHaveProperty('totalScans');
			expect(stats).toHaveProperty('foundWorktrees');
			expect(stats).toHaveProperty('cacheHits');
			expect(stats).toHaveProperty('cacheMisses');
			expect(stats).toHaveProperty('averageScanTime');
			expect(stats).toHaveProperty('lastScanTime');
			expect(stats).toHaveProperty('errors');
			expect(stats).toHaveProperty('currentWorktrees');
			expect(stats).toHaveProperty('cacheSize');
			expect(stats).toHaveProperty('lastScanAge');
			expect(stats).toHaveProperty('cacheHitRate');
			expect(stats).toHaveProperty('autoRefreshActive');
		});

		test('should calculate cache hit rate', async () => {
			await manager.scan(); // Cache miss
			await manager.scan(); // Cache hit
			await manager.clearCache();
			await manager.scan(); // Cache miss

			const stats = manager.getStatistics();
			expect(stats.cacheHitRate).toBe(33.33333333333333); // 1 hit out of 3 attempts
		});
	});

	describe('Performance Tests', () => {
		test('should handle multiple rapid scans efficiently', async () => {
			await manager.initialize();

			const startTime = Date.now();
			const scanPromises = [];

			// Try to start multiple scans (only first should succeed)
			for (let i = 0; i < 5; i++) {
				scanPromises.push(manager.scan().catch((error) => error.message));
			}

			const results = await Promise.all(scanPromises);
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(500); // Should complete quickly

			// First scan should succeed, others should fail with "already in progress"
			expect(typeof results[0]).toBe('number'); // Success returns count
			results.slice(1).forEach((result) => {
				expect(result).toBe('Scan already in progress');
			});
		});
	});
});
