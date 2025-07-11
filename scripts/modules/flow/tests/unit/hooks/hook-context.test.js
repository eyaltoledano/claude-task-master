/**
 * @fileoverview Hook Context Tests
 * Tests for hook context management including data passing, context isolation,
 * and context lifecycle management.
 *
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock HookContext class with comprehensive context management
class MockHookContext extends EventEmitter {
	// Static counter for active contexts across all instances
	static globalStatistics = {
		activeContexts: 0
	};

	constructor(initialData = {}) {
		super();
		this.data = new Map();
		this.metadata = new Map();
		this.sharedData = new Map();
		this.isolatedContexts = new Map();
		this.contextHistory = [];
		this.statistics = {
			totalContexts: 0,
			activeContexts: 0,
			dataOperations: 0,
			isolationViolations: 0
		};
		this.config = {
			enableIsolation: true,
			enableHistory: true,
			maxHistorySize: 100,
			enableDataValidation: true,
			allowCrossContextAccess: false
		};

		// Initialize with provided data
		if (initialData && typeof initialData === 'object') {
			Object.entries(initialData).forEach(([key, value]) => {
				this.set(key, value);
			});
		}

		this.statistics.totalContexts++;
		MockHookContext.globalStatistics.activeContexts++;
		this.statistics.activeContexts =
			MockHookContext.globalStatistics.activeContexts;
		this.contextId = this.generateContextId();
		this.createdAt = new Date();

		this.emit('contextCreated', { contextId: this.contextId, initialData });
	}

	// Context ID generation
	generateContextId() {
		return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// Data management
	set(key, value, options = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error('Context key must be a non-empty string');
		}

		const oldValue = this.data.get(key);

		// Data validation if enabled
		if (this.config.enableDataValidation && options.validate) {
			this.validateData(key, value, options.validate);
		}

		this.data.set(key, value);
		this.statistics.dataOperations++;

		// Store metadata
		this.metadata.set(key, {
			setAt: new Date(),
			type: typeof value,
			size: this.calculateDataSize(value),
			options: { ...options }
		});

		// Add to history if enabled
		if (this.config.enableHistory) {
			this.addToHistory('set', key, { oldValue, newValue: value, options });
		}

		this.emit('dataSet', {
			contextId: this.contextId,
			key,
			value,
			oldValue,
			options
		});

		return this;
	}

	get(key, defaultValue = undefined) {
		if (!key || typeof key !== 'string') {
			throw new Error('Context key must be a non-empty string');
		}

		this.statistics.dataOperations++;

		if (this.data.has(key)) {
			const value = this.data.get(key);

			// Add to history if enabled
			if (this.config.enableHistory) {
				this.addToHistory('get', key, { value });
			}

			this.emit('dataAccessed', {
				contextId: this.contextId,
				key,
				value,
				found: true
			});

			return value;
		}

		this.emit('dataAccessed', {
			contextId: this.contextId,
			key,
			value: defaultValue,
			found: false
		});

		return defaultValue;
	}

	has(key) {
		if (!key || typeof key !== 'string') {
			throw new Error('Context key must be a non-empty string');
		}

		return this.data.has(key);
	}

	delete(key) {
		if (!key || typeof key !== 'string') {
			throw new Error('Context key must be a non-empty string');
		}

		const existed = this.data.has(key);
		const oldValue = existed ? this.data.get(key) : undefined;

		this.data.delete(key);
		this.metadata.delete(key);
		this.statistics.dataOperations++;

		// Add to history if enabled
		if (this.config.enableHistory && existed) {
			this.addToHistory('delete', key, { oldValue });
		}

		this.emit('dataDeleted', {
			contextId: this.contextId,
			key,
			oldValue,
			existed
		});

		return existed;
	}

	clear() {
		const keysCleared = Array.from(this.data.keys());

		this.data.clear();
		this.metadata.clear();
		this.statistics.dataOperations++;

		// Add to history if enabled
		if (this.config.enableHistory) {
			this.addToHistory('clear', null, { keysCleared });
		}

		this.emit('dataCleared', {
			contextId: this.contextId,
			keysCleared
		});

		return this;
	}

	// Shared data management
	setShared(key, value, options = {}) {
		if (!key || typeof key !== 'string') {
			throw new Error('Shared context key must be a non-empty string');
		}

		const oldValue = this.sharedData.get(key);
		this.sharedData.set(key, value);

		this.emit('sharedDataSet', {
			contextId: this.contextId,
			key,
			value,
			oldValue,
			options
		});

		return this;
	}

	getShared(key, defaultValue = undefined) {
		if (!key || typeof key !== 'string') {
			throw new Error('Shared context key must be a non-empty string');
		}

		const value = this.sharedData.has(key)
			? this.sharedData.get(key)
			: defaultValue;

		this.emit('sharedDataAccessed', {
			contextId: this.contextId,
			key,
			value,
			found: this.sharedData.has(key)
		});

		return value;
	}

	// Context isolation
	createIsolatedContext(contextName, initialData = {}) {
		if (!contextName || typeof contextName !== 'string') {
			throw new Error('Isolated context name must be a non-empty string');
		}

		if (this.isolatedContexts.has(contextName)) {
			throw new Error(`Isolated context '${contextName}' already exists`);
		}

		const isolatedContext = new MockHookContext(initialData);
		isolatedContext.parentContextId = this.contextId;
		isolatedContext.contextName = contextName;

		this.isolatedContexts.set(contextName, isolatedContext);

		this.emit('isolatedContextCreated', {
			parentContextId: this.contextId,
			contextName,
			childContextId: isolatedContext.contextId,
			initialData
		});

		return isolatedContext;
	}

	getIsolatedContext(contextName) {
		if (!contextName || typeof contextName !== 'string') {
			throw new Error('Isolated context name must be a non-empty string');
		}

		return this.isolatedContexts.get(contextName);
	}

	destroyIsolatedContext(contextName) {
		if (!contextName || typeof contextName !== 'string') {
			throw new Error('Isolated context name must be a non-empty string');
		}

		const context = this.isolatedContexts.get(contextName);
		if (!context) {
			throw new Error(`Isolated context '${contextName}' not found`);
		}

		context.destroy();
		this.isolatedContexts.delete(contextName);

		this.emit('isolatedContextDestroyed', {
			parentContextId: this.contextId,
			contextName,
			childContextId: context.contextId
		});

		return true;
	}

	// Cross-context access (if allowed)
	accessContext(contextId, operation, key, value = undefined) {
		if (!this.config.allowCrossContextAccess) {
			this.statistics.isolationViolations++;
			throw new Error('Cross-context access is not allowed');
		}

		// Mock implementation for testing
		this.emit('crossContextAccess', {
			sourceContextId: this.contextId,
			targetContextId: contextId,
			operation,
			key,
			value
		});

		return `cross-context-${operation}-result`;
	}

	// Data validation
	validateData(key, value, validator) {
		if (typeof validator === 'function') {
			const isValid = validator(value, key, this);
			if (!isValid) {
				throw new Error(`Data validation failed for key '${key}'`);
			}
		} else if (validator && typeof validator === 'object' && validator.type) {
			if (typeof value !== validator.type) {
				throw new Error(
					`Expected ${validator.type} for key '${key}', got ${typeof value}`
				);
			}
		}
	}

	// History management
	addToHistory(operation, key, details) {
		if (!this.config.enableHistory) return;

		const historyEntry = {
			timestamp: new Date(),
			operation,
			key,
			details,
			contextId: this.contextId
		};

		this.contextHistory.push(historyEntry);

		// Limit history size
		if (this.contextHistory.length > this.config.maxHistorySize) {
			this.contextHistory.shift();
		}

		this.emit('historyAdded', historyEntry);
	}

	getHistory(filter = {}) {
		let history = [...this.contextHistory];

		if (filter.operation) {
			history = history.filter((entry) => entry.operation === filter.operation);
		}

		if (filter.key) {
			history = history.filter((entry) => entry.key === filter.key);
		}

		if (filter.since) {
			history = history.filter((entry) => entry.timestamp >= filter.since);
		}

		return history;
	}

	clearHistory() {
		const entriesCleared = this.contextHistory.length;
		this.contextHistory = [];

		this.emit('historyCleared', {
			contextId: this.contextId,
			entriesCleared
		});

		return entriesCleared;
	}

	// Utility methods
	calculateDataSize(value) {
		if (value === null || value === undefined) return 0;
		if (typeof value === 'string') return value.length;
		if (typeof value === 'object') return JSON.stringify(value).length;
		return String(value).length;
	}

	keys() {
		return Array.from(this.data.keys());
	}

	values() {
		return Array.from(this.data.values());
	}

	entries() {
		return Array.from(this.data.entries());
	}

	size() {
		return this.data.size;
	}

	// Context serialization
	toJSON() {
		return {
			contextId: this.contextId,
			createdAt: this.createdAt,
			data: Object.fromEntries(this.data),
			metadata: Object.fromEntries(this.metadata),
			sharedData: Object.fromEntries(this.sharedData),
			isolatedContexts: Array.from(this.isolatedContexts.keys()),
			statistics: this.statistics,
			config: this.config
		};
	}

	fromJSON(jsonData) {
		if (!jsonData || typeof jsonData !== 'object') {
			throw new Error('Invalid JSON data for context restoration');
		}

		this.contextId = jsonData.contextId || this.contextId;
		this.createdAt = new Date(jsonData.createdAt) || this.createdAt;

		if (jsonData.data) {
			this.data = new Map(Object.entries(jsonData.data));
		}

		if (jsonData.metadata) {
			this.metadata = new Map(Object.entries(jsonData.metadata));
		}

		if (jsonData.sharedData) {
			this.sharedData = new Map(Object.entries(jsonData.sharedData));
		}

		if (jsonData.statistics) {
			this.statistics = { ...this.statistics, ...jsonData.statistics };
		}

		if (jsonData.config) {
			this.config = { ...this.config, ...jsonData.config };
		}

		this.emit('contextRestored', { contextId: this.contextId, jsonData });

		return this;
	}

	// Context merging
	merge(otherContext, options = {}) {
		if (!(otherContext instanceof MockHookContext)) {
			throw new Error('Can only merge with another HookContext instance');
		}

		const conflicts = [];
		const strategy = options.strategy || 'overwrite'; // 'overwrite', 'keep', 'merge'

		for (const [key, value] of otherContext.data.entries()) {
			if (this.data.has(key)) {
				conflicts.push(key);

				if (strategy === 'keep') {
					continue; // Keep existing value
				} else if (
					strategy === 'merge' &&
					typeof value === 'object' &&
					typeof this.data.get(key) === 'object'
				) {
					this.data.set(key, { ...this.data.get(key), ...value });
				} else {
					this.data.set(key, value); // Overwrite
				}
			} else {
				this.data.set(key, value);
			}
		}

		this.emit('contextMerged', {
			sourceContextId: otherContext.contextId,
			targetContextId: this.contextId,
			conflicts,
			strategy
		});

		return { conflicts, merged: true };
	}

	// Statistics and monitoring
	getStatistics() {
		return {
			...this.statistics,
			activeContexts: MockHookContext.globalStatistics.activeContexts,
			dataSize: this.data.size,
			metadataSize: this.metadata.size,
			sharedDataSize: this.sharedData.size,
			isolatedContextsCount: this.isolatedContexts.size,
			historySize: this.contextHistory.length,
			totalDataSize: Array.from(this.data.values()).reduce(
				(total, value) => total + this.calculateDataSize(value),
				0
			)
		};
	}

	// Context cleanup and destruction
	destroy() {
		// Destroy all isolated contexts first
		for (const [name, context] of this.isolatedContexts) {
			context.destroy();
		}

		this.data.clear();
		this.metadata.clear();
		this.sharedData.clear();
		this.isolatedContexts.clear();
		this.contextHistory = [];
		MockHookContext.globalStatistics.activeContexts--;

		this.emit('contextDestroyed', { contextId: this.contextId });
		this.removeAllListeners();
	}
}

describe('Hook Context System', () => {
	let context;

	beforeEach(() => {
		context = new MockHookContext();
	});

	afterEach(() => {
		if (context) {
			context.destroy();
		}
	});

	describe('Context Creation and Initialization', () => {
		test('should create context with default values', () => {
			expect(context.contextId).toBeDefined();
			expect(context.createdAt).toBeInstanceOf(Date);
			expect(context.size()).toBe(0);
			expect(context.getStatistics().activeContexts).toBe(1);
		});

		test('should create context with initial data', () => {
			const initialData = { key1: 'value1', key2: 'value2' };
			const ctx = new MockHookContext(initialData);

			expect(ctx.get('key1')).toBe('value1');
			expect(ctx.get('key2')).toBe('value2');
			expect(ctx.size()).toBe(2);

			ctx.destroy();
		});

		test('should emit contextCreated event', () => {
			// Test that the contextCreated event is emitted by spying on the emit method
			const emitSpy = jest.spyOn(MockHookContext.prototype, 'emit');

			const ctx2 = new MockHookContext({ test: 'data' });

			expect(emitSpy).toHaveBeenCalledWith('contextCreated', {
				contextId: ctx2.contextId,
				initialData: { test: 'data' }
			});

			emitSpy.mockRestore();
			ctx2.destroy();
		});

		test('should generate unique context IDs', () => {
			const ctx1 = new MockHookContext();
			const ctx2 = new MockHookContext();

			expect(ctx1.contextId).not.toBe(ctx2.contextId);
			expect(ctx1.contextId).toMatch(/^ctx-\d+-[a-z0-9]{9}$/);

			ctx1.destroy();
			ctx2.destroy();
		});
	});

	describe('Data Management', () => {
		test('should set and get data successfully', () => {
			context.set('testKey', 'testValue');

			expect(context.get('testKey')).toBe('testValue');
			expect(context.has('testKey')).toBe(true);
			expect(context.size()).toBe(1);
		});

		test('should return default value for non-existent keys', () => {
			expect(context.get('nonExistent')).toBeUndefined();
			expect(context.get('nonExistent', 'default')).toBe('default');
		});

		test('should emit dataSet event', () => {
			const eventSpy = jest.fn();
			context.on('dataSet', eventSpy);

			context.set('eventKey', 'eventValue');

			expect(eventSpy).toHaveBeenCalledWith({
				contextId: context.contextId,
				key: 'eventKey',
				value: 'eventValue',
				oldValue: undefined,
				options: {}
			});
		});

		test('should emit dataAccessed event', () => {
			const eventSpy = jest.fn();
			context.on('dataAccessed', eventSpy);

			context.set('accessKey', 'accessValue');
			context.get('accessKey');

			expect(eventSpy).toHaveBeenCalledWith({
				contextId: context.contextId,
				key: 'accessKey',
				value: 'accessValue',
				found: true
			});
		});

		test('should handle data updates with old values', () => {
			const eventSpy = jest.fn();
			context.on('dataSet', eventSpy);

			context.set('updateKey', 'oldValue');
			context.set('updateKey', 'newValue');

			expect(eventSpy).toHaveBeenLastCalledWith({
				contextId: context.contextId,
				key: 'updateKey',
				value: 'newValue',
				oldValue: 'oldValue',
				options: {}
			});
		});

		test('should delete data successfully', () => {
			context.set('deleteKey', 'deleteValue');

			expect(context.delete('deleteKey')).toBe(true);
			expect(context.has('deleteKey')).toBe(false);
			expect(context.delete('nonExistent')).toBe(false);
		});

		test('should emit dataDeleted event', () => {
			const eventSpy = jest.fn();
			context.on('dataDeleted', eventSpy);

			context.set('deleteKey', 'deleteValue');
			context.delete('deleteKey');

			expect(eventSpy).toHaveBeenCalledWith({
				contextId: context.contextId,
				key: 'deleteKey',
				oldValue: 'deleteValue',
				existed: true
			});
		});

		test('should clear all data', () => {
			context.set('key1', 'value1');
			context.set('key2', 'value2');

			expect(context.size()).toBe(2);

			context.clear();

			expect(context.size()).toBe(0);
			expect(context.has('key1')).toBe(false);
			expect(context.has('key2')).toBe(false);
		});

		test('should emit dataCleared event', () => {
			const eventSpy = jest.fn();
			context.on('dataCleared', eventSpy);

			context.set('key1', 'value1');
			context.set('key2', 'value2');
			context.clear();

			expect(eventSpy).toHaveBeenCalledWith({
				contextId: context.contextId,
				keysCleared: ['key1', 'key2']
			});
		});

		test('should reject invalid keys', () => {
			expect(() => context.set('', 'value')).toThrow(
				'Context key must be a non-empty string'
			);
			expect(() => context.set(null, 'value')).toThrow(
				'Context key must be a non-empty string'
			);
			expect(() => context.get('')).toThrow(
				'Context key must be a non-empty string'
			);
			expect(() => context.has(null)).toThrow(
				'Context key must be a non-empty string'
			);
			expect(() => context.delete('')).toThrow(
				'Context key must be a non-empty string'
			);
		});
	});

	describe('Data Validation', () => {
		test('should validate data with function validator', () => {
			const validator = jest.fn().mockReturnValue(true);

			context.set('validatedKey', 'validValue', { validate: validator });

			expect(validator).toHaveBeenCalledWith(
				'validValue',
				'validatedKey',
				context
			);
			expect(context.get('validatedKey')).toBe('validValue');
		});

		test('should reject invalid data with function validator', () => {
			const validator = jest.fn().mockReturnValue(false);

			expect(() => {
				context.set('invalidKey', 'invalidValue', { validate: validator });
			}).toThrow("Data validation failed for key 'invalidKey'");
		});

		test('should validate data with type validator', () => {
			context.set('stringKey', 'stringValue', { validate: { type: 'string' } });
			context.set('numberKey', 42, { validate: { type: 'number' } });

			expect(context.get('stringKey')).toBe('stringValue');
			expect(context.get('numberKey')).toBe(42);
		});

		test('should reject invalid data with type validator', () => {
			expect(() => {
				context.set('stringKey', 123, { validate: { type: 'string' } });
			}).toThrow("Expected string for key 'stringKey', got number");
		});
	});

	describe('Shared Data Management', () => {
		test('should set and get shared data', () => {
			context.setShared('sharedKey', 'sharedValue');

			expect(context.getShared('sharedKey')).toBe('sharedValue');
			expect(context.getShared('nonExistent', 'default')).toBe('default');
		});

		test('should emit shared data events', () => {
			const setSpy = jest.fn();
			const accessSpy = jest.fn();

			context.on('sharedDataSet', setSpy);
			context.on('sharedDataAccessed', accessSpy);

			context.setShared('sharedKey', 'sharedValue');
			context.getShared('sharedKey');

			expect(setSpy).toHaveBeenCalled();
			expect(accessSpy).toHaveBeenCalled();
		});

		test('should reject invalid shared keys', () => {
			expect(() => context.setShared('', 'value')).toThrow(
				'Shared context key must be a non-empty string'
			);
			expect(() => context.getShared(null)).toThrow(
				'Shared context key must be a non-empty string'
			);
		});
	});

	describe('Context Isolation', () => {
		test('should create isolated context', () => {
			const isolated = context.createIsolatedContext('testIsolated', {
				isolatedKey: 'isolatedValue'
			});

			expect(isolated).toBeInstanceOf(MockHookContext);
			expect(isolated.parentContextId).toBe(context.contextId);
			expect(isolated.contextName).toBe('testIsolated');
			expect(isolated.get('isolatedKey')).toBe('isolatedValue');
		});

		test('should emit isolatedContextCreated event', () => {
			const eventSpy = jest.fn();
			context.on('isolatedContextCreated', eventSpy);

			const isolated = context.createIsolatedContext('eventTest');

			expect(eventSpy).toHaveBeenCalledWith({
				parentContextId: context.contextId,
				contextName: 'eventTest',
				childContextId: isolated.contextId,
				initialData: {}
			});
		});

		test('should get isolated context', () => {
			const isolated = context.createIsolatedContext('getTest');

			expect(context.getIsolatedContext('getTest')).toBe(isolated);
			expect(context.getIsolatedContext('nonExistent')).toBeUndefined();
		});

		test('should destroy isolated context', () => {
			const isolated = context.createIsolatedContext('destroyTest');
			const destroySpy = jest.spyOn(isolated, 'destroy');

			expect(context.destroyIsolatedContext('destroyTest')).toBe(true);
			expect(destroySpy).toHaveBeenCalled();
			expect(context.getIsolatedContext('destroyTest')).toBeUndefined();
		});

		test('should emit isolatedContextDestroyed event', () => {
			const eventSpy = jest.fn();
			context.on('isolatedContextDestroyed', eventSpy);

			const isolated = context.createIsolatedContext('eventDestroy');
			context.destroyIsolatedContext('eventDestroy');

			expect(eventSpy).toHaveBeenCalledWith({
				parentContextId: context.contextId,
				contextName: 'eventDestroy',
				childContextId: isolated.contextId
			});
		});

		test('should reject duplicate isolated context names', () => {
			context.createIsolatedContext('duplicate');

			expect(() => {
				context.createIsolatedContext('duplicate');
			}).toThrow("Isolated context 'duplicate' already exists");
		});

		test('should reject invalid isolated context names', () => {
			expect(() => context.createIsolatedContext('')).toThrow(
				'Isolated context name must be a non-empty string'
			);
			expect(() => context.getIsolatedContext(null)).toThrow(
				'Isolated context name must be a non-empty string'
			);
			expect(() => context.destroyIsolatedContext('')).toThrow(
				'Isolated context name must be a non-empty string'
			);
		});
	});

	describe('Cross-Context Access', () => {
		test('should reject cross-context access when disabled', () => {
			context.config.allowCrossContextAccess = false;

			expect(() => {
				context.accessContext('other-ctx', 'get', 'key');
			}).toThrow('Cross-context access is not allowed');

			expect(context.getStatistics().isolationViolations).toBe(1);
		});

		test('should allow cross-context access when enabled', () => {
			context.config.allowCrossContextAccess = true;

			const result = context.accessContext('other-ctx', 'get', 'key');

			expect(result).toBe('cross-context-get-result');
		});

		test('should emit crossContextAccess event', () => {
			const eventSpy = jest.fn();
			context.on('crossContextAccess', eventSpy);
			context.config.allowCrossContextAccess = true;

			context.accessContext('target-ctx', 'set', 'key', 'value');

			expect(eventSpy).toHaveBeenCalledWith({
				sourceContextId: context.contextId,
				targetContextId: 'target-ctx',
				operation: 'set',
				key: 'key',
				value: 'value'
			});
		});
	});

	describe('History Management', () => {
		beforeEach(() => {
			context.config.enableHistory = true;
		});

		test('should record data operations in history', () => {
			context.set('historyKey', 'value1');
			context.set('historyKey', 'value2');
			context.get('historyKey');
			context.delete('historyKey');

			const history = context.getHistory();

			expect(history).toHaveLength(4);
			expect(history[0].operation).toBe('set');
			expect(history[1].operation).toBe('set');
			expect(history[2].operation).toBe('get');
			expect(history[3].operation).toBe('delete');
		});

		test('should filter history by operation', () => {
			context.set('key1', 'value1');
			context.get('key1');
			context.set('key2', 'value2');

			const setHistory = context.getHistory({ operation: 'set' });
			const getHistory = context.getHistory({ operation: 'get' });

			expect(setHistory).toHaveLength(2);
			expect(getHistory).toHaveLength(1);
		});

		test('should filter history by key', () => {
			context.set('key1', 'value1');
			context.set('key2', 'value2');
			context.get('key1');

			const key1History = context.getHistory({ key: 'key1' });

			expect(key1History).toHaveLength(2);
			expect(key1History.every((entry) => entry.key === 'key1')).toBe(true);
		});

		test('should filter history by timestamp', () => {
			const beforeTime = new Date();

			setTimeout(() => {
				context.set('afterKey', 'afterValue');

				const recentHistory = context.getHistory({ since: beforeTime });

				expect(recentHistory).toHaveLength(1);
				expect(recentHistory[0].key).toBe('afterKey');
			}, 10);
		});

		test('should limit history size', () => {
			context.config.maxHistorySize = 3;

			context.set('key1', 'value1');
			context.set('key2', 'value2');
			context.set('key3', 'value3');
			context.set('key4', 'value4'); // Should remove first entry

			const history = context.getHistory();

			expect(history).toHaveLength(3);
			expect(history[0].key).toBe('key2'); // First entry removed
		});

		test('should clear history', () => {
			context.set('key1', 'value1');
			context.set('key2', 'value2');

			expect(context.getHistory()).toHaveLength(2);

			const cleared = context.clearHistory();

			expect(cleared).toBe(2);
			expect(context.getHistory()).toHaveLength(0);
		});

		test('should emit historyAdded event', () => {
			const eventSpy = jest.fn();
			context.on('historyAdded', eventSpy);

			context.set('historyKey', 'historyValue');

			expect(eventSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: 'set',
					key: 'historyKey',
					contextId: context.contextId
				})
			);
		});

		test('should not record history when disabled', () => {
			context.config.enableHistory = false;

			context.set('noHistoryKey', 'noHistoryValue');

			expect(context.getHistory()).toHaveLength(0);
		});
	});

	describe('Context Utilities', () => {
		test('should return keys, values, and entries', () => {
			context.set('key1', 'value1');
			context.set('key2', 'value2');

			expect(context.keys()).toEqual(['key1', 'key2']);
			expect(context.values()).toEqual(['value1', 'value2']);
			expect(context.entries()).toEqual([
				['key1', 'value1'],
				['key2', 'value2']
			]);
		});

		test('should calculate data size correctly', () => {
			expect(context.calculateDataSize('test')).toBe(4);
			expect(context.calculateDataSize(123)).toBe(3);
			expect(context.calculateDataSize({ key: 'value' })).toBe(15);
			expect(context.calculateDataSize(null)).toBe(0);
		});
	});

	describe('Context Serialization', () => {
		test('should serialize context to JSON', () => {
			context.set('serializeKey', 'serializeValue');
			context.setShared('sharedKey', 'sharedValue');

			const json = context.toJSON();

			expect(json.contextId).toBe(context.contextId);
			expect(json.data.serializeKey).toBe('serializeValue');
			expect(json.sharedData.sharedKey).toBe('sharedValue');
			expect(json.statistics).toBeDefined();
			expect(json.config).toBeDefined();
		});

		test('should restore context from JSON', () => {
			const jsonData = {
				contextId: 'restored-ctx-123',
				createdAt: new Date().toISOString(),
				data: { restoredKey: 'restoredValue' },
				sharedData: { sharedKey: 'sharedValue' },
				statistics: { totalExecutions: 5 },
				config: { enableHistory: false }
			};

			context.fromJSON(jsonData);

			expect(context.contextId).toBe('restored-ctx-123');
			expect(context.get('restoredKey')).toBe('restoredValue');
			expect(context.getShared('sharedKey')).toBe('sharedValue');
			expect(context.statistics.totalExecutions).toBe(5);
			expect(context.config.enableHistory).toBe(false);
		});

		test('should emit contextRestored event', () => {
			const eventSpy = jest.fn();
			context.on('contextRestored', eventSpy);

			const jsonData = { contextId: 'test-restore' };
			context.fromJSON(jsonData);

			expect(eventSpy).toHaveBeenCalledWith({
				contextId: 'test-restore',
				jsonData
			});
		});

		test('should reject invalid JSON data', () => {
			expect(() => context.fromJSON(null)).toThrow(
				'Invalid JSON data for context restoration'
			);
			expect(() => context.fromJSON('not-object')).toThrow(
				'Invalid JSON data for context restoration'
			);
		});
	});

	describe('Context Merging', () => {
		test('should merge contexts with overwrite strategy', () => {
			const otherContext = new MockHookContext();

			context.set('key1', 'value1');
			context.set('common', 'original');

			otherContext.set('key2', 'value2');
			otherContext.set('common', 'updated');

			const result = context.merge(otherContext, { strategy: 'overwrite' });

			expect(result.merged).toBe(true);
			expect(result.conflicts).toEqual(['common']);
			expect(context.get('key1')).toBe('value1');
			expect(context.get('key2')).toBe('value2');
			expect(context.get('common')).toBe('updated');

			otherContext.destroy();
		});

		test('should merge contexts with keep strategy', () => {
			const otherContext = new MockHookContext();

			context.set('common', 'original');
			otherContext.set('common', 'updated');

			const result = context.merge(otherContext, { strategy: 'keep' });

			expect(result.conflicts).toEqual(['common']);
			expect(context.get('common')).toBe('original');

			otherContext.destroy();
		});

		test('should merge contexts with merge strategy for objects', () => {
			const otherContext = new MockHookContext();

			context.set('object', { a: 1, b: 2 });
			otherContext.set('object', { b: 3, c: 4 });

			const result = context.merge(otherContext, { strategy: 'merge' });

			expect(context.get('object')).toEqual({ a: 1, b: 3, c: 4 });

			otherContext.destroy();
		});

		test('should emit contextMerged event', () => {
			const eventSpy = jest.fn();
			context.on('contextMerged', eventSpy);

			const otherContext = new MockHookContext();
			context.merge(otherContext);

			expect(eventSpy).toHaveBeenCalledWith({
				sourceContextId: otherContext.contextId,
				targetContextId: context.contextId,
				conflicts: [],
				strategy: 'overwrite'
			});

			otherContext.destroy();
		});

		test('should reject merging with non-context objects', () => {
			expect(() => {
				context.merge({ not: 'context' });
			}).toThrow('Can only merge with another HookContext instance');
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track comprehensive statistics', () => {
			context.set('key1', 'value1');
			context.set('key2', 'value2');
			context.get('key1');
			context.setShared('shared', 'value');

			const stats = context.getStatistics();

			expect(stats.dataSize).toBe(2);
			expect(stats.sharedDataSize).toBe(1);
			expect(stats.dataOperations).toBeGreaterThan(0);
			expect(stats.totalDataSize).toBeGreaterThan(0);
		});

		test('should track isolation violations', () => {
			context.config.allowCrossContextAccess = false;

			try {
				context.accessContext('other', 'get', 'key');
			} catch (error) {
				// Expected to fail
			}

			expect(context.getStatistics().isolationViolations).toBe(1);
		});
	});

	describe('Context Destruction and Cleanup', () => {
		test('should destroy context and clean up resources', () => {
			const isolated = context.createIsolatedContext('cleanup-test');
			const destroySpy = jest.spyOn(isolated, 'destroy');

			context.set('key', 'value');
			context.setShared('shared', 'value');

			expect(context.size()).toBe(1);
			expect(context.isolatedContexts.size).toBe(1);

			context.destroy();

			expect(destroySpy).toHaveBeenCalled();
			expect(context.size()).toBe(0);
			expect(context.isolatedContexts.size).toBe(0);
		});

		test('should emit contextDestroyed event', () => {
			const eventSpy = jest.fn();
			context.on('contextDestroyed', eventSpy);

			const contextId = context.contextId;
			context.destroy();

			expect(eventSpy).toHaveBeenCalledWith({ contextId });
		});

		test('should update active contexts count on destruction', () => {
			const initialCount = context.getStatistics().activeContexts;

			context.destroy();

			// Create new context to check the count
			const newContext = new MockHookContext();
			expect(newContext.getStatistics().activeContexts).toBe(initialCount);

			newContext.destroy();
		});
	});

	describe('Performance Benchmarks', () => {
		test('should handle large datasets efficiently', () => {
			const startTime = Date.now();

			for (let i = 0; i < 1000; i++) {
				context.set(`key-${i}`, `value-${i}`);
			}

			const setTime = Date.now() - startTime;
			expect(setTime).toBeLessThan(100); // Should complete within 100ms

			const getStartTime = Date.now();

			for (let i = 0; i < 1000; i++) {
				context.get(`key-${i}`);
			}

			const getTime = Date.now() - getStartTime;
			expect(getTime).toBeLessThan(50); // Should complete within 50ms
		});

		test('should handle concurrent operations efficiently', async () => {
			const operations = [];

			for (let i = 0; i < 100; i++) {
				operations.push(
					Promise.resolve().then(() => {
						context.set(`concurrent-${i}`, `value-${i}`);
						return context.get(`concurrent-${i}`);
					})
				);
			}

			const startTime = Date.now();
			await Promise.all(operations);
			const totalTime = Date.now() - startTime;

			expect(totalTime).toBeLessThan(100); // Should complete within 100ms
			expect(context.size()).toBe(100);
		});
	});
});
