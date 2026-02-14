import { describe, it, expect } from 'vitest';
import { TagAnalysisCache, type CacheFile, type CacheStorage } from './tag-analysis-cache.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { TagAnalysisInput } from './cluster-generation.service.js';

function createInMemoryStorage(): CacheStorage & { data: CacheFile | null } {
	const store: { data: CacheFile | null } = { data: null };
	return {
		get data() { return store.data; },
		set data(v) { store.data = v; },
		load: async () => store.data,
		save: async (file) => { store.data = file; }
	};
}

const sampleAnalysis: SemanticAnalysis = {
	summary: 'Auth module summary',
	themes: ['security'],
	capabilities: ['login'],
	technicalDomain: 'authentication',
	keyEntities: ['user']
};

const sampleInput: TagAnalysisInput = {
	name: 'auth',
	description: 'Authentication module',
	tasks: [
		{ title: 'Login flow', description: 'Implement login', dependencies: [] },
		{ title: 'JWT tokens', description: 'Add JWT support', dependencies: ['1'] }
	]
};

describe('TagAnalysisCache', () => {
	it('returns null on empty storage', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);

		const result = await cache.get('auth', 'some-hash');

		expect(result).toBeNull();
	});

	it('returns cached analysis when hash matches', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);
		const hash = TagAnalysisCache.computeHash(sampleInput);

		await cache.set('auth', hash, sampleAnalysis);
		const result = await cache.get('auth', hash);

		expect(result).toEqual(sampleAnalysis);
	});

	it('returns null when hash differs (content changed)', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);

		await cache.set('auth', 'old-hash', sampleAnalysis);
		const result = await cache.get('auth', 'new-hash');

		expect(result).toBeNull();
	});

	it('returns null for unknown tag name', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);

		await cache.set('auth', 'hash-1', sampleAnalysis);
		const result = await cache.get('api', 'hash-1');

		expect(result).toBeNull();
	});

	it('preserves entries for other tags when setting a new one', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);
		const otherAnalysis: SemanticAnalysis = {
			...sampleAnalysis,
			summary: 'API module summary'
		};

		await cache.set('auth', 'hash-a', sampleAnalysis);
		await cache.set('api', 'hash-b', otherAnalysis);

		expect(await cache.get('auth', 'hash-a')).toEqual(sampleAnalysis);
		expect(await cache.get('api', 'hash-b')).toEqual(otherAnalysis);
	});

	it('overwrites existing entry for same tag', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);
		const updatedAnalysis: SemanticAnalysis = {
			...sampleAnalysis,
			summary: 'Updated summary'
		};

		await cache.set('auth', 'hash-v1', sampleAnalysis);
		await cache.set('auth', 'hash-v2', updatedAnalysis);

		expect(await cache.get('auth', 'hash-v1')).toBeNull();
		expect(await cache.get('auth', 'hash-v2')).toEqual(updatedAnalysis);
	});

	it('stores version and analyzedAt in cache file', async () => {
		const storage = createInMemoryStorage();
		const cache = new TagAnalysisCache(storage);

		await cache.set('auth', 'hash-1', sampleAnalysis);

		expect(storage.data?.version).toBe(1);
		expect(storage.data?.entries['auth'].analyzedAt).toBeDefined();
		expect(new Date(storage.data!.entries['auth'].analyzedAt).getTime()).not.toBeNaN();
	});
});

describe('TagAnalysisCache.computeHash', () => {
	it('produces same hash for identical input', () => {
		const hash1 = TagAnalysisCache.computeHash(sampleInput);
		const hash2 = TagAnalysisCache.computeHash(sampleInput);

		expect(hash1).toBe(hash2);
	});

	it('produces different hash when tasks change', () => {
		const modified: TagAnalysisInput = {
			...sampleInput,
			tasks: [
				{ title: 'Login flow', description: 'Changed description', dependencies: [] }
			]
		};

		const hash1 = TagAnalysisCache.computeHash(sampleInput);
		const hash2 = TagAnalysisCache.computeHash(modified);

		expect(hash1).not.toBe(hash2);
	});

	it('produces different hash when description changes', () => {
		const modified: TagAnalysisInput = {
			...sampleInput,
			description: 'Different description'
		};

		const hash1 = TagAnalysisCache.computeHash(sampleInput);
		const hash2 = TagAnalysisCache.computeHash(modified);

		expect(hash1).not.toBe(hash2);
	});

	it('produces same hash regardless of task order', () => {
		const input1: TagAnalysisInput = {
			name: 'test',
			tasks: [
				{ title: 'B task', description: 'B', dependencies: [] },
				{ title: 'A task', description: 'A', dependencies: [] }
			]
		};

		const input2: TagAnalysisInput = {
			name: 'test',
			tasks: [
				{ title: 'A task', description: 'A', dependencies: [] },
				{ title: 'B task', description: 'B', dependencies: [] }
			]
		};

		expect(TagAnalysisCache.computeHash(input1)).toBe(TagAnalysisCache.computeHash(input2));
	});

	it('produces same hash regardless of dependency order', () => {
		const input1: TagAnalysisInput = {
			name: 'test',
			tasks: [
				{ title: 'Task', description: 'Desc', dependencies: ['2', '1', '3'] }
			]
		};

		const input2: TagAnalysisInput = {
			name: 'test',
			tasks: [
				{ title: 'Task', description: 'Desc', dependencies: ['1', '2', '3'] }
			]
		};

		expect(TagAnalysisCache.computeHash(input1)).toBe(TagAnalysisCache.computeHash(input2));
	});

	it('returns a 64-char hex string (SHA-256)', () => {
		const hash = TagAnalysisCache.computeHash(sampleInput);

		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});
});
