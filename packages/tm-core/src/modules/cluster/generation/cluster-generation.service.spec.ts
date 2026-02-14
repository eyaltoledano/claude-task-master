import { describe, it, expect, vi } from 'vitest';
import type { ITagSemanticAnalyzer } from './tag-semantic-analyzer.interface.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { ITagDependencySynthesizer } from './tag-dependency-synthesizer.interface.js';
import type { DependencySuggestion } from './tag-dependency-synthesizer.types.js';
import type { AIPrimitiveResult } from '../../ai/types/primitives.types.js';
import {
	ClusterGenerationService,
	type TagAnalysisInput,
	type ClusterGenerationProgress
} from './cluster-generation.service.js';
import {
	TagAnalysisCache,
	type CacheFile,
	type CacheStorage
} from './tag-analysis-cache.js';

function createMockAnalysis(domain: string): SemanticAnalysis {
	return {
		summary: `Summary for ${domain}`,
		themes: [`${domain}-theme`],
		capabilities: [`${domain}-capability`],
		technicalDomain: domain,
		keyEntities: [`${domain}-entity`]
	};
}

function wrapResult<T>(data: T): AIPrimitiveResult<T> {
	return {
		data,
		usage: {
			inputTokens: 100,
			outputTokens: 50,
			model: 'test-model',
			provider: 'test-provider',
			duration: 500
		}
	};
}

function createMockAnalyzer(
	analysisMap: Record<string, SemanticAnalysis>
): ITagSemanticAnalyzer {
	return {
		analyze: vi.fn(async (_content: string, context: string) => {
			const match = context.match(/Tag "([^"]+)"/);
			const tagName = match?.[1] ?? 'unknown';
			const analysis = analysisMap[tagName] ?? createMockAnalysis('unknown');
			return wrapResult(analysis);
		})
	};
}

function createMockSynthesizer(
	deps: readonly DependencySuggestion[]
): ITagDependencySynthesizer {
	return {
		synthesize: vi.fn(async () => wrapResult(deps))
	};
}

const sampleTags: readonly TagAnalysisInput[] = [
	{
		name: 'auth',
		description: 'Authentication module',
		tasks: [
			{ title: 'Login flow', description: 'Implement login', dependencies: [] },
			{ title: 'JWT tokens', description: 'Add JWT support', dependencies: [] }
		]
	},
	{
		name: 'core',
		tasks: [
			{
				title: 'Config loader',
				description: 'Load project config',
				dependencies: []
			}
		]
	},
	{
		name: 'api',
		description: 'API endpoints',
		tasks: [
			{
				title: 'REST endpoints',
				description: 'Build REST API',
				dependencies: ['1']
			}
		]
	}
];

describe('ClusterGenerationService', () => {
	it('analyzes all tags and produces cluster suggestion', async () => {
		const analysisMap: Record<string, SemanticAnalysis> = {
			auth: createMockAnalysis('authentication'),
			core: createMockAnalysis('infrastructure'),
			api: createMockAnalysis('api')
		};

		const deps: DependencySuggestion[] = [
			{
				from: 'auth',
				to: 'core',
				reason: 'Auth needs config',
				confidence: 'high'
			},
			{
				from: 'api',
				to: 'auth',
				reason: 'API needs auth',
				confidence: 'medium'
			}
		];

		const analyzer = createMockAnalyzer(analysisMap);
		const synthesizer = createMockSynthesizer(deps);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const result = await service.generate(sampleTags);

		expect(result.clusters).toHaveLength(3);
		expect(result.clusters[0]).toEqual({ level: 0, tags: ['core'] });
		expect(result.clusters[1]).toEqual({ level: 1, tags: ['auth'] });
		expect(result.clusters[2]).toEqual({ level: 2, tags: ['api'] });

		expect(result.dependencies).toHaveLength(2);
		expect(result.reasoning).toContain('auth');
		expect(result.reasoning).toContain('core');
	});

	it('groups independent tags at the same level', async () => {
		const analysisMap: Record<string, SemanticAnalysis> = {
			auth: createMockAnalysis('auth'),
			logging: createMockAnalysis('logging'),
			config: createMockAnalysis('config')
		};

		const analyzer = createMockAnalyzer(analysisMap);
		const synthesizer = createMockSynthesizer([]);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const tags: TagAnalysisInput[] = [
			{
				name: 'auth',
				tasks: [{ title: 'Auth', description: 'Auth', dependencies: [] }]
			},
			{
				name: 'logging',
				tasks: [{ title: 'Log', description: 'Log', dependencies: [] }]
			},
			{
				name: 'config',
				tasks: [{ title: 'Cfg', description: 'Cfg', dependencies: [] }]
			}
		];

		const result = await service.generate(tags);

		expect(result.clusters).toHaveLength(1);
		expect(result.clusters[0].level).toBe(0);
		expect(result.clusters[0].tags).toEqual(['auth', 'config', 'logging']);
	});

	it('filters out invalid dependency suggestions', async () => {
		const analysisMap: Record<string, SemanticAnalysis> = {
			auth: createMockAnalysis('auth'),
			api: createMockAnalysis('api')
		};

		const deps: DependencySuggestion[] = [
			{ from: 'auth', to: 'nonexistent', reason: 'invalid', confidence: 'low' },
			{ from: 'auth', to: 'auth', reason: 'self-dep', confidence: 'low' },
			{ from: 'api', to: 'auth', reason: 'valid dep', confidence: 'high' }
		];

		const analyzer = createMockAnalyzer(analysisMap);
		const synthesizer = createMockSynthesizer(deps);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const tags: TagAnalysisInput[] = [
			{
				name: 'auth',
				tasks: [{ title: 'A', description: 'A', dependencies: [] }]
			},
			{
				name: 'api',
				tasks: [{ title: 'B', description: 'B', dependencies: [] }]
			}
		];

		const result = await service.generate(tags);

		expect(result.dependencies).toHaveLength(1);
		expect(result.dependencies[0].from).toBe('api');
		expect(result.dependencies[0].to).toBe('auth');
	});

	it('reports progress through callback', async () => {
		const analysisMap: Record<string, SemanticAnalysis> = {
			a: createMockAnalysis('a'),
			b: createMockAnalysis('b')
		};

		const analyzer = createMockAnalyzer(analysisMap);
		const synthesizer = createMockSynthesizer([]);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const tags: TagAnalysisInput[] = [
			{
				name: 'a',
				tasks: [{ title: 'A', description: 'A', dependencies: [] }]
			},
			{ name: 'b', tasks: [{ title: 'B', description: 'B', dependencies: [] }] }
		];

		const progressUpdates: ClusterGenerationProgress[] = [];
		await service.generate(tags, (p) => progressUpdates.push(p));

		expect(progressUpdates.length).toBeGreaterThanOrEqual(4);
		expect(progressUpdates[0].phase).toBe('analyzing');
		expect(progressUpdates[0].tagName).toBe('a');

		const synthPhase = progressUpdates.find((p) => p.phase === 'synthesizing');
		expect(synthPhase).toBeDefined();

		const completePhase = progressUpdates.find((p) => p.phase === 'complete');
		expect(completePhase).toBeDefined();
	});

	it('calls analyzer once per tag', async () => {
		const analysisMap: Record<string, SemanticAnalysis> = {
			x: createMockAnalysis('x'),
			y: createMockAnalysis('y'),
			z: createMockAnalysis('z')
		};

		const analyzer = createMockAnalyzer(analysisMap);
		const synthesizer = createMockSynthesizer([]);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const tags: TagAnalysisInput[] = [
			{
				name: 'x',
				tasks: [{ title: 'X', description: 'X', dependencies: [] }]
			},
			{
				name: 'y',
				tasks: [{ title: 'Y', description: 'Y', dependencies: [] }]
			},
			{ name: 'z', tasks: [{ title: 'Z', description: 'Z', dependencies: [] }] }
		];

		await service.generate(tags);

		expect(analyzer.analyze).toHaveBeenCalledTimes(3);
		expect(synthesizer.synthesize).toHaveBeenCalledTimes(1);
	});

	it('handles empty tag list', async () => {
		const analyzer = createMockAnalyzer({});
		const synthesizer = createMockSynthesizer([]);
		const service = new ClusterGenerationService(analyzer, synthesizer);

		const result = await service.generate([]);

		expect(result.clusters).toHaveLength(0);
		expect(result.dependencies).toHaveLength(0);
		expect(analyzer.analyze).not.toHaveBeenCalled();
	});

	describe('with cache', () => {
		function createInMemoryStorage(): CacheStorage & {
			data: CacheFile | null;
		} {
			const store: { data: CacheFile | null } = { data: null };
			return {
				get data() {
					return store.data;
				},
				set data(v) {
					store.data = v;
				},
				load: async () => store.data,
				save: async (file) => {
					store.data = file;
				}
			};
		}

		it('skips AI calls for cached tags (all hits)', async () => {
			const tags: TagAnalysisInput[] = [
				{
					name: 'auth',
					tasks: [{ title: 'A', description: 'A', dependencies: [] }]
				},
				{
					name: 'api',
					tasks: [{ title: 'B', description: 'B', dependencies: [] }]
				}
			];

			const authAnalysis = createMockAnalysis('authentication');
			const apiAnalysis = createMockAnalysis('api');

			// Pre-populate cache
			const storage = createInMemoryStorage();
			const cache = new TagAnalysisCache(storage);
			await cache.set(
				'auth',
				TagAnalysisCache.computeHash(tags[0]),
				authAnalysis
			);
			await cache.set(
				'api',
				TagAnalysisCache.computeHash(tags[1]),
				apiAnalysis
			);

			const analyzer = createMockAnalyzer({});
			const synthesizer = createMockSynthesizer([]);
			const service = new ClusterGenerationService(
				analyzer,
				synthesizer,
				cache
			);

			await service.generate(tags);

			expect(analyzer.analyze).not.toHaveBeenCalled();
		});

		it('calls AI only for uncached tags (mixed hits/misses)', async () => {
			const tags: TagAnalysisInput[] = [
				{
					name: 'auth',
					tasks: [{ title: 'A', description: 'A', dependencies: [] }]
				},
				{
					name: 'api',
					tasks: [{ title: 'B', description: 'B', dependencies: [] }]
				},
				{
					name: 'core',
					tasks: [{ title: 'C', description: 'C', dependencies: [] }]
				}
			];

			const authAnalysis = createMockAnalysis('authentication');

			// Only cache 'auth'
			const storage = createInMemoryStorage();
			const cache = new TagAnalysisCache(storage);
			await cache.set(
				'auth',
				TagAnalysisCache.computeHash(tags[0]),
				authAnalysis
			);

			const analysisMap: Record<string, SemanticAnalysis> = {
				api: createMockAnalysis('api'),
				core: createMockAnalysis('core')
			};

			const analyzer = createMockAnalyzer(analysisMap);
			const synthesizer = createMockSynthesizer([]);
			const service = new ClusterGenerationService(
				analyzer,
				synthesizer,
				cache
			);

			const result = await service.generate(tags);

			// Only 2 AI calls (api + core), not 3
			expect(analyzer.analyze).toHaveBeenCalledTimes(2);
			// All 3 tags still appear in results
			const tagNames = result.clusters.flatMap((c) => [...c.tags]).sort();
			expect(tagNames).toEqual(['api', 'auth', 'core']);
		});

		it('makes all AI calls when nothing is cached (all misses)', async () => {
			const tags: TagAnalysisInput[] = [
				{
					name: 'x',
					tasks: [{ title: 'X', description: 'X', dependencies: [] }]
				},
				{
					name: 'y',
					tasks: [{ title: 'Y', description: 'Y', dependencies: [] }]
				}
			];

			const storage = createInMemoryStorage();
			const cache = new TagAnalysisCache(storage);

			const analysisMap: Record<string, SemanticAnalysis> = {
				x: createMockAnalysis('x'),
				y: createMockAnalysis('y')
			};

			const analyzer = createMockAnalyzer(analysisMap);
			const synthesizer = createMockSynthesizer([]);
			const service = new ClusterGenerationService(
				analyzer,
				synthesizer,
				cache
			);

			await service.generate(tags);

			expect(analyzer.analyze).toHaveBeenCalledTimes(2);
		});

		it('writes fresh AI results back to cache', async () => {
			const tags: TagAnalysisInput[] = [
				{
					name: 'auth',
					tasks: [{ title: 'A', description: 'A', dependencies: [] }]
				}
			];

			const storage = createInMemoryStorage();
			const cache = new TagAnalysisCache(storage);

			const analysisMap: Record<string, SemanticAnalysis> = {
				auth: createMockAnalysis('authentication')
			};

			const analyzer = createMockAnalyzer(analysisMap);
			const synthesizer = createMockSynthesizer([]);
			const service = new ClusterGenerationService(
				analyzer,
				synthesizer,
				cache
			);

			await service.generate(tags);

			// Cache should now have the result
			const hash = TagAnalysisCache.computeHash(tags[0]);
			const cached = await cache.get('auth', hash);
			expect(cached).toEqual(createMockAnalysis('authentication'));
		});

		it('reports cached count in progress callback', async () => {
			const tags: TagAnalysisInput[] = [
				{
					name: 'auth',
					tasks: [{ title: 'A', description: 'A', dependencies: [] }]
				},
				{
					name: 'api',
					tasks: [{ title: 'B', description: 'B', dependencies: [] }]
				}
			];

			const authAnalysis = createMockAnalysis('authentication');

			// Cache 'auth' only
			const storage = createInMemoryStorage();
			const cache = new TagAnalysisCache(storage);
			await cache.set(
				'auth',
				TagAnalysisCache.computeHash(tags[0]),
				authAnalysis
			);

			const analysisMap: Record<string, SemanticAnalysis> = {
				api: createMockAnalysis('api')
			};

			const analyzer = createMockAnalyzer(analysisMap);
			const synthesizer = createMockSynthesizer([]);
			const service = new ClusterGenerationService(
				analyzer,
				synthesizer,
				cache
			);

			const progressUpdates: ClusterGenerationProgress[] = [];
			await service.generate(tags, (p) => progressUpdates.push(p));

			const analyzingPhases = progressUpdates.filter(
				(p) => p.phase === 'analyzing'
			);
			// Only 1 AI call (api), so 1 analyzing progress
			expect(analyzingPhases).toHaveLength(1);
			expect(analyzingPhases[0].tagName).toBe('api');
			expect(analyzingPhases[0].cached).toBe(1);
			expect(analyzingPhases[0].total).toBe(1);
		});
	});
});
