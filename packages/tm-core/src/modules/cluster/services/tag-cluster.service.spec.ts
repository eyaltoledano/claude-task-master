import { describe, it, expect } from 'vitest';
import { TagClusterService } from './tag-cluster.service.js';

describe('TagClusterService', () => {
	const service = new TagClusterService();

	it('returns empty result for no tags', () => {
		const result = service.clusterTags([]);

		expect(result.totalTags).toBe(0);
		expect(result.totalClusters).toBe(0);
		expect(result.clusters).toEqual([]);
	});

	it('puts all independent tags into a single level-0 cluster', () => {
		const result = service.clusterTags([
			{ tag: 'auth', dependencies: [] },
			{ tag: 'logging', dependencies: [] },
			{ tag: 'config', dependencies: [] }
		]);

		expect(result.totalTags).toBe(3);
		expect(result.totalClusters).toBe(1);
		expect(result.clusters[0].level).toBe(0);
		expect(result.clusters[0].tags).toEqual(['auth', 'config', 'logging']);
		expect(result.clusters[0].dependsOn).toEqual([]);
	});

	it('creates sequential levels based on dependency chains', () => {
		const result = service.clusterTags([
			{ tag: 'base', dependencies: [] },
			{ tag: 'auth', dependencies: ['base'] },
			{ tag: 'ui', dependencies: ['auth'] }
		]);

		expect(result.totalClusters).toBe(3);
		expect(result.clusters[0]).toEqual({
			level: 0,
			tags: ['base'],
			dependsOn: []
		});
		expect(result.clusters[1]).toEqual({
			level: 1,
			tags: ['auth'],
			dependsOn: [0]
		});
		expect(result.clusters[2]).toEqual({
			level: 2,
			tags: ['ui'],
			dependsOn: [1]
		});
	});

	it('groups parallel tags at the same dependency level', () => {
		const result = service.clusterTags([
			{ tag: 'base', dependencies: [] },
			{ tag: 'auth', dependencies: ['base'] },
			{ tag: 'logging', dependencies: ['base'] },
			{ tag: 'dashboard', dependencies: ['auth', 'logging'] }
		]);

		expect(result.totalClusters).toBe(3);

		// Level 0: base
		expect(result.clusters[0].tags).toEqual(['base']);

		// Level 1: auth and logging (both depend on base only)
		expect(result.clusters[1].tags).toEqual(['auth', 'logging']);
		expect(result.clusters[1].dependsOn).toEqual([0]);

		// Level 2: dashboard (depends on auth + logging → level 1 max + 1)
		expect(result.clusters[2].tags).toEqual(['dashboard']);
		expect(result.clusters[2].dependsOn).toEqual([1]);
	});

	it('ignores dependencies referencing unknown tags', () => {
		const result = service.clusterTags([
			{ tag: 'auth', dependencies: ['nonexistent'] },
			{ tag: 'logging', dependencies: [] }
		]);

		// 'nonexistent' is filtered out → auth has no valid deps → level 0
		expect(result.totalClusters).toBe(1);
		expect(result.clusters[0].tags).toEqual(['auth', 'logging']);
	});

	it('throws on circular dependencies with cycle path', () => {
		expect(() =>
			service.clusterTags([
				{ tag: 'a', dependencies: ['b'] },
				{ tag: 'b', dependencies: ['a'] }
			])
		).toThrow(/Circular dependency detected.*a.*b.*a/);
	});

	it('sorts tags alphabetically within each cluster', () => {
		const result = service.clusterTags([
			{ tag: 'zebra', dependencies: [] },
			{ tag: 'apple', dependencies: [] },
			{ tag: 'mango', dependencies: [] }
		]);

		expect(result.clusters[0].tags).toEqual(['apple', 'mango', 'zebra']);
	});

	it('handles a single tag', () => {
		const result = service.clusterTags([{ tag: 'solo', dependencies: [] }]);

		expect(result.totalTags).toBe(1);
		expect(result.totalClusters).toBe(1);
		expect(result.clusters[0]).toEqual({
			level: 0,
			tags: ['solo'],
			dependsOn: []
		});
	});
});
