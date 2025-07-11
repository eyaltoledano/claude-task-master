/**
 * @fileoverview Streaming State Manager Testing
 * Tests for real-time state management, streaming operations, and event handling
 * Part of Phase 2.1: Background Service Testing
 */

import { EventEmitter } from 'events';

// Mock StreamingStateManager class
class MockStreamingStateManager extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = {
			maxStateHistory: 100,
			syncInterval: 1000,
			compressionThreshold: 1000,
			...options
		};
		this.state = new Map();
		this.stateHistory = [];
		this.subscribers = new Map();
		this.isActive = false;
		this.stats = {
			stateUpdates: 0,
			syncOperations: 0,
			compressionEvents: 0,
			errors: 0
		};
	}

	async start() {
		if (this.isActive) throw new Error('StreamingStateManager already active');
		this.isActive = true;
		this.emit('manager:started');
		return { success: true, timestamp: Date.now() };
	}

	async stop() {
		if (!this.isActive) throw new Error('StreamingStateManager not active');
		this.isActive = false;
		this.clearState();
		this.emit('manager:stopped');
		return { success: true, timestamp: Date.now() };
	}

	async setState(key, value, options = {}) {
		if (!this.isActive) throw new Error('StreamingStateManager not active');

		const timestamp = Date.now();
		const previousValue = this.state.get(key);
		const stateUpdate = { key, value, previousValue, timestamp, options };

		this.state.set(key, value);
		this.addToHistory(stateUpdate);
		this.stats.stateUpdates++;

		await this.notifySubscribers(key, stateUpdate);
		this.emit('state:updated', stateUpdate);

		return { success: true, key, timestamp };
	}

	getState(key) {
		if (!this.isActive) throw new Error('StreamingStateManager not active');
		return this.state.get(key);
	}

	getAllState() {
		if (!this.isActive) throw new Error('StreamingStateManager not active');
		return Object.fromEntries(this.state);
	}

	subscribe(key, callback, options = {}) {
		if (!this.isActive) throw new Error('StreamingStateManager not active');

		const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		if (!this.subscribers.has(key)) {
			this.subscribers.set(key, new Map());
		}

		const subscription = {
			id: subscriptionId,
			callback,
			options,
			createdAt: Date.now(),
			callCount: 0
		};
		this.subscribers.get(key).set(subscriptionId, subscription);

		this.emit('subscription:created', { key, subscriptionId, options });

		// Send current value if requested
		if (options.immediate && this.state.has(key)) {
			setImmediate(() => {
				this.notifySubscriber(subscription, key, {
					key,
					value: this.state.get(key),
					timestamp: Date.now(),
					type: 'immediate'
				});
			});
		}

		return subscriptionId;
	}

	unsubscribe(subscriptionId) {
		if (!this.isActive) throw new Error('StreamingStateManager not active');

		for (const [key, keySubscribers] of this.subscribers) {
			if (keySubscribers.has(subscriptionId)) {
				keySubscribers.delete(subscriptionId);
				if (keySubscribers.size === 0) {
					this.subscribers.delete(key);
				}
				this.emit('subscription:removed', { key, subscriptionId });
				return { success: true, subscriptionId };
			}
		}

		throw new Error(`Subscription ${subscriptionId} not found`);
	}

	async notifySubscribers(key, stateUpdate) {
		const keySubscribers = this.subscribers.get(key);
		if (!keySubscribers) return;

		for (const subscription of keySubscribers.values()) {
			await this.notifySubscriber(subscription, key, stateUpdate);
		}
	}

	async notifySubscriber(subscription, key, stateUpdate) {
		try {
			subscription.callCount++;
			if (
				subscription.options.filter &&
				!subscription.options.filter(stateUpdate)
			)
				return;
			await subscription.callback(stateUpdate);
		} catch (error) {
			this.stats.errors++;
			this.emit('subscription:error', {
				subscriptionId: subscription.id,
				key,
				error: error.message
			});
		}
	}

	addToHistory(stateUpdate) {
		this.stateHistory.push(stateUpdate);
		if (this.stateHistory.length > this.options.maxStateHistory) {
			this.stateHistory.shift();
		}
	}

	clearState() {
		this.state.clear();
		this.stateHistory = [];
		this.subscribers.clear();
	}

	getStats() {
		return {
			...this.stats,
			state: {
				activeKeys: this.state.size,
				historyLength: this.stateHistory.length,
				subscriberCount: Array.from(this.subscribers.values()).reduce(
					(total, keySubscribers) => total + keySubscribers.size,
					0
				)
			}
		};
	}

	async healthCheck() {
		return {
			status: this.isActive ? 'active' : 'inactive',
			stateKeys: this.state.size,
			subscribers: Array.from(this.subscribers.values()).reduce(
				(total, keySubscribers) => total + keySubscribers.size,
				0
			),
			historyLength: this.stateHistory.length,
			timestamp: Date.now()
		};
	}
}

describe('StreamingStateManager Service', () => {
	let manager;
	let eventLog;

	beforeEach(() => {
		manager = new MockStreamingStateManager();
		eventLog = [];
		manager.on('manager:started', (data) =>
			eventLog.push({ event: 'manager:started', data })
		);
		manager.on('manager:stopped', (data) =>
			eventLog.push({ event: 'manager:stopped', data })
		);
		manager.on('state:updated', (data) =>
			eventLog.push({ event: 'state:updated', data })
		);
		manager.on('subscription:created', (data) =>
			eventLog.push({ event: 'subscription:created', data })
		);
		manager.on('subscription:removed', (data) =>
			eventLog.push({ event: 'subscription:removed', data })
		);
		manager.on('subscription:error', (data) =>
			eventLog.push({ event: 'subscription:error', data })
		);
	});

	afterEach(async () => {
		if (manager.isActive) await manager.stop();
	});

	describe('Manager Lifecycle', () => {
		test('should start manager successfully', async () => {
			const result = await manager.start();
			expect(result.success).toBe(true);
			expect(manager.isActive).toBe(true);
			expect(eventLog.some((e) => e.event === 'manager:started')).toBe(true);
		});

		test('should stop manager successfully', async () => {
			await manager.start();
			const result = await manager.stop();
			expect(result.success).toBe(true);
			expect(manager.isActive).toBe(false);
			expect(eventLog.some((e) => e.event === 'manager:stopped')).toBe(true);
		});

		test('should handle double start attempt', async () => {
			await manager.start();
			await expect(manager.start()).rejects.toThrow(
				'StreamingStateManager already active'
			);
		});

		test('should perform health check', async () => {
			const healthBefore = await manager.healthCheck();
			expect(healthBefore.status).toBe('inactive');

			await manager.start();
			const healthAfter = await manager.healthCheck();
			expect(healthAfter.status).toBe('active');
		});
	});

	describe('State Management', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should set and get state successfully', async () => {
			const key = 'test-key';
			const value = { data: 'test-value', timestamp: Date.now() };

			const result = await manager.setState(key, value);
			expect(result.success).toBe(true);
			expect(result.key).toBe(key);

			const retrievedValue = manager.getState(key);
			expect(retrievedValue).toEqual(value);
			expect(eventLog.some((e) => e.event === 'state:updated')).toBe(true);
		});

		test('should get all state', async () => {
			await manager.setState('key1', 'value1');
			await manager.setState('key2', 'value2');

			const allState = manager.getAllState();
			expect(allState).toEqual({ key1: 'value1', key2: 'value2' });
		});

		test('should track state history', async () => {
			await manager.setState('history-key', 'value1');
			await manager.setState('history-key', 'value2');
			await manager.setState('history-key', 'value3');

			expect(manager.stateHistory).toHaveLength(3);
			expect(manager.stateHistory[0].value).toBe('value1');
			expect(manager.stateHistory[2].value).toBe('value3');
		});

		test('should handle operations when not active', async () => {
			await manager.stop();

			await expect(manager.setState('key', 'value')).rejects.toThrow(
				'StreamingStateManager not active'
			);
			expect(() => manager.getState('key')).toThrow(
				'StreamingStateManager not active'
			);
			expect(() => manager.getAllState()).toThrow(
				'StreamingStateManager not active'
			);
		});
	});

	describe('Subscription Management', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should create and manage subscriptions', async () => {
			const key = 'sub-key';
			const updates = [];

			const callback = (update) => {
				updates.push(update);
			};
			const subscriptionId = manager.subscribe(key, callback);

			expect(subscriptionId).toBeDefined();
			expect(eventLog.some((e) => e.event === 'subscription:created')).toBe(
				true
			);

			await manager.setState(key, 'test-value');

			// Wait for async notification
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(updates).toHaveLength(1);
			expect(updates[0].key).toBe(key);
			expect(updates[0].value).toBe('test-value');
		});

		test('should unsubscribe successfully', async () => {
			const key = 'unsub-key';
			const updates = [];

			const callback = (update) => {
				updates.push(update);
			};
			const subscriptionId = manager.subscribe(key, callback);
			const result = manager.unsubscribe(subscriptionId);

			expect(result.success).toBe(true);
			expect(eventLog.some((e) => e.event === 'subscription:removed')).toBe(
				true
			);

			await manager.setState(key, 'test-value');
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(updates).toHaveLength(0);
		});

		test('should handle immediate subscription option', async () => {
			const key = 'immediate-key';
			const value = 'existing-value';

			await manager.setState(key, value);

			const updates = [];
			const callback = (update) => {
				updates.push(update);
			};

			manager.subscribe(key, callback, { immediate: true });

			// Wait for immediate notification
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(updates).toHaveLength(1);
			expect(updates[0].value).toBe(value);
			expect(updates[0].type).toBe('immediate');
		});

		test('should handle subscription filters', async () => {
			const key = 'filter-key';
			const updates = [];

			const filter = (update) => update.value > 5;
			const callback = (update) => {
				updates.push(update);
			};

			manager.subscribe(key, callback, { filter });

			await manager.setState(key, 3);
			await manager.setState(key, 7);
			await manager.setState(key, 2);
			await manager.setState(key, 10);

			// Wait for notifications
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(updates).toHaveLength(2);
			expect(updates[0].value).toBe(7);
			expect(updates[1].value).toBe(10);
		});

		test('should handle subscription errors', async () => {
			const key = 'error-key';

			const errorCallback = () => {
				throw new Error('Subscription callback error');
			};

			manager.subscribe(key, errorCallback);
			await manager.setState(key, 'test-value');

			// Wait for error handling
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(eventLog.some((e) => e.event === 'subscription:error')).toBe(true);
			expect(manager.getStats().errors).toBeGreaterThan(0);
		});

		test('should handle nonexistent subscription removal', () => {
			expect(() => manager.unsubscribe('nonexistent')).toThrow(
				'Subscription nonexistent not found'
			);
		});
	});

	describe('Performance and Statistics', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should track statistics accurately', async () => {
			const key = 'stats-key';
			const callback = () => {};

			manager.subscribe(key, callback);

			for (let i = 0; i < 5; i++) {
				await manager.setState(`key${i}`, `value${i}`);
			}

			const stats = manager.getStats();

			expect(stats.stateUpdates).toBe(5);
			expect(stats.state.activeKeys).toBe(5);
			expect(stats.state.historyLength).toBe(5);
			expect(stats.state.subscriberCount).toBe(1);
		});

		test('should handle concurrent state updates', async () => {
			const key = 'concurrent-key';
			const promises = [];

			for (let i = 0; i < 10; i++) {
				promises.push(manager.setState(key, `value${i}`));
			}

			const results = await Promise.all(promises);

			expect(results).toHaveLength(10);
			results.forEach((result) => {
				expect(result.success).toBe(true);
			});
		});

		test('should clean up resources on stop', async () => {
			const key = 'cleanup-key';
			const callback = () => {};

			manager.subscribe(key, callback);
			await manager.setState(key, 'value');

			expect(manager.state.size).toBeGreaterThan(0);
			expect(manager.subscribers.size).toBeGreaterThan(0);

			await manager.stop();

			expect(manager.state.size).toBe(0);
			expect(manager.subscribers.size).toBe(0);
			expect(manager.stateHistory).toHaveLength(0);
		});
	});
});
