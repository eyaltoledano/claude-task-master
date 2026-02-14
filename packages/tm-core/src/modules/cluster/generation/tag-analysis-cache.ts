/**
 * @fileoverview Cache for per-tag semantic analysis results
 * Pure logic class with injected storage — no file I/O, no path resolution.
 */

import { createHash } from 'node:crypto';

import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { TagAnalysisInput } from './cluster-generation.service.js';

export interface CacheStorage {
	readonly load: () => Promise<CacheFile | null>;
	readonly save: (data: CacheFile) => Promise<void>;
}

export interface CachedEntry {
	readonly contentHash: string;
	readonly analysis: SemanticAnalysis;
	readonly analyzedAt: string;
}

export interface CacheFile {
	readonly version: 1;
	readonly entries: Readonly<Record<string, CachedEntry>>;
}

export class TagAnalysisCache {
	constructor(private readonly storage: CacheStorage) {}

	async get(tagName: string, contentHash: string): Promise<SemanticAnalysis | null> {
		const file = await this.storage.load();
		if (!file) return null;

		const entry = file.entries[tagName];
		if (!entry || entry.contentHash !== contentHash) return null;

		return entry.analysis;
	}

	async set(tagName: string, contentHash: string, analysis: SemanticAnalysis): Promise<void> {
		const file = await this.storage.load();
		const existing = file?.entries ?? {};

		const newEntry: CachedEntry = {
			contentHash,
			analysis,
			analyzedAt: new Date().toISOString()
		};

		await this.storage.save({
			version: 1,
			entries: { ...existing, [tagName]: newEntry }
		});
	}

	static computeHash(input: TagAnalysisInput): string {
		const serialized = JSON.stringify({
			description: input.description,
			name: input.name,
			tasks: [...input.tasks]
				.sort((a, b) => a.title.localeCompare(b.title))
				.map((t) => ({
					dependencies: [...t.dependencies].sort(),
					description: t.description,
					title: t.title
				}))
		});

		return createHash('sha256').update(serialized).digest('hex');
	}
}
