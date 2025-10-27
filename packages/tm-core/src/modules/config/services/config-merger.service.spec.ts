/**
 * @fileoverview Unit tests for ConfigMerger service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigMerger, CONFIG_PRECEDENCE } from './config-merger.service.js';

describe('ConfigMerger', () => {
	let merger: ConfigMerger;

	beforeEach(() => {
		merger = new ConfigMerger();
	});

	describe('addSource', () => {
		it('should add configuration source', () => {
			const source = {
				name: 'test',
				config: { test: true },
				precedence: 1
			};

			merger.addSource(source);
			const sources = merger.getSources();

			expect(sources).toHaveLength(1);
			expect(sources[0]).toEqual(source);
		});

		it('should add multiple sources', () => {
			merger.addSource({ name: 'source1', config: {}, precedence: 1 });
			merger.addSource({ name: 'source2', config: {}, precedence: 2 });

			expect(merger.getSources()).toHaveLength(2);
		});
	});

	describe('clearSources', () => {
		it('should remove all configuration sources', () => {
			merger.addSource({ name: 'test', config: {}, precedence: 1 });
			merger.clearSources();

			expect(merger.getSources()).toHaveLength(0);
		});
	});

	describe('merge', () => {
		it('should merge configurations based on precedence', () => {
			merger.addSource({
				name: 'low',
				config: { a: 1, b: 2 },
				precedence: 1
			});

			merger.addSource({
				name: 'high',
				config: { a: 3, c: 4 },
				precedence: 2
			});

			const result = merger.merge();

			expect(result).toEqual({
				a: 3, // High precedence wins
				b: 2, // Only in low
				c: 4 // Only in high
			});
		});

		it('should deep merge nested objects', () => {
			merger.addSource({
				name: 'base',
				config: {
					models: { main: 'model1', fallback: 'model2' },
					storage: { type: 'file' as const }
				},
				precedence: 1
			});

			merger.addSource({
				name: 'override',
				config: {
					models: { main: 'model3' },
					storage: { encoding: 'utf8' as const }
				},
				precedence: 2
			});

			const result = merger.merge();

			expect(result).toEqual({
				models: {
					main: 'model3', // Overridden
					fallback: 'model2' // Preserved
				},
				storage: {
					type: 'file', // Preserved
					encoding: 'utf8' // Added
				}
			});
		});

		it('should handle arrays by replacement', () => {
			merger.addSource({
				name: 'base',
				config: { items: [1, 2, 3] },
				precedence: 1
			});

			merger.addSource({
				name: 'override',
				config: { items: [4, 5] },
				precedence: 2
			});

			const result = merger.merge();

			expect(result.items).toEqual([4, 5]); // Arrays are replaced, not merged
		});

		it('should ignore null and undefined values', () => {
			merger.addSource({
				name: 'base',
				config: { a: 1, b: 2 },
				precedence: 1
			});

			merger.addSource({
				name: 'override',
				config: { a: null, b: undefined, c: 3 } as any,
				precedence: 2
			});

			const result = merger.merge();

			expect(result).toEqual({
				a: 1, // null ignored
				b: 2, // undefined ignored
				c: 3 // new value added
			});
		});

		it('should return empty object when no sources', () => {
			const result = merger.merge();
			expect(result).toEqual({});
		});

		it('should use CONFIG_PRECEDENCE constants correctly', () => {
			merger.addSource({
				name: 'defaults',
				config: { level: 'default' },
				precedence: CONFIG_PRECEDENCE.DEFAULTS
			});

			merger.addSource({
				name: 'local',
				config: { level: 'local' },
				precedence: CONFIG_PRECEDENCE.LOCAL
			});

			merger.addSource({
				name: 'environment',
				config: { level: 'env' },
				precedence: CONFIG_PRECEDENCE.ENVIRONMENT
			});

			const result = merger.merge();

			expect(result.level).toBe('env'); // Highest precedence wins
		});
	});

	describe('getSources', () => {
		it('should return sources sorted by precedence (highest first)', () => {
			merger.addSource({ name: 'low', config: {}, precedence: 1 });
			merger.addSource({ name: 'high', config: {}, precedence: 3 });
			merger.addSource({ name: 'medium', config: {}, precedence: 2 });

			const sources = merger.getSources();

			expect(sources[0].name).toBe('high');
			expect(sources[1].name).toBe('medium');
			expect(sources[2].name).toBe('low');
		});

		it('should return a copy of sources array', () => {
			merger.addSource({ name: 'test', config: {}, precedence: 1 });

			const sources1 = merger.getSources();
			const sources2 = merger.getSources();

			expect(sources1).not.toBe(sources2); // Different array instances
			expect(sources1).toEqual(sources2); // Same content
		});
	});

	describe('hasSource', () => {
		it('should return true when source exists', () => {
			merger.addSource({ name: 'test', config: {}, precedence: 1 });

			expect(merger.hasSource('test')).toBe(true);
		});

		it('should return false when source does not exist', () => {
			expect(merger.hasSource('nonexistent')).toBe(false);
		});
	});

	describe('removeSource', () => {
		it('should remove source by name and return true', () => {
			merger.addSource({ name: 'test', config: {}, precedence: 1 });
			merger.addSource({ name: 'keep', config: {}, precedence: 2 });

			const removed = merger.removeSource('test');

			expect(removed).toBe(true);
			expect(merger.hasSource('test')).toBe(false);
			expect(merger.hasSource('keep')).toBe(true);
		});

		it('should return false when source does not exist', () => {
			const removed = merger.removeSource('nonexistent');

			expect(removed).toBe(false);
		});

		it('should handle removing all sources', () => {
			merger.addSource({ name: 'test1', config: {}, precedence: 1 });
			merger.addSource({ name: 'test2', config: {}, precedence: 2 });

			merger.removeSource('test1');
			merger.removeSource('test2');

			expect(merger.getSources()).toHaveLength(0);
		});
	});
});
