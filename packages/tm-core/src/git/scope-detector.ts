/**
 * ScopeDetector - Intelligent scope detection from changed files
 *
 * Automatically determines conventional commit scopes based on file paths
 * using configurable pattern matching and priority-based resolution.
 * // TODO: remove this
 */

export interface ScopeMapping {
	[pattern: string]: string;
}

export interface ScopePriority {
	[scope: string]: number;
}

// Ordered from most specific to least specific
const DEFAULT_SCOPE_MAPPINGS: Array<[string, string]> = [
	// Special file types (check first - most specific)
	['**/*.test.*', 'test'],
	['**/*.spec.*', 'test'],
	['**/test/**', 'test'],
	['**/tests/**', 'test'],
	['**/__tests__/**', 'test'],

	// Dependencies (specific files)
	['**/package-lock.json', 'deps'],
	['package-lock.json', 'deps'],
	['**/pnpm-lock.yaml', 'deps'],
	['pnpm-lock.yaml', 'deps'],
	['**/yarn.lock', 'deps'],
	['yarn.lock', 'deps'],

	// Configuration files (before packages so root configs don't match package patterns)
	['**/package.json', 'config'],
	['package.json', 'config'],
	['**/tsconfig*.json', 'config'],
	['tsconfig*.json', 'config'],
	['**/.eslintrc*', 'config'],
	['.eslintrc*', 'config'],
	['**/vite.config.*', 'config'],
	['vite.config.*', 'config'],
	['**/vitest.config.*', 'config'],
	['vitest.config.*', 'config'],

	// Package-level scopes (more specific than feature-level)
	['packages/cli/**', 'cli'],
	['packages/tm-core/**', 'core'],
	['packages/mcp-server/**', 'mcp'],

	// Feature-level scopes (within any package)
	['**/workflow/**', 'workflow'],
	['**/git/**', 'git'],
	['**/storage/**', 'storage'],
	['**/auth/**', 'auth'],
	['**/config/**', 'config'],

	// Documentation (least specific)
	['**/*.md', 'docs'],
	['**/docs/**', 'docs'],
	['README*', 'docs'],
	['CHANGELOG*', 'docs']
];

const DEFAULT_SCOPE_PRIORITIES: ScopePriority = {
	core: 100,
	cli: 90,
	mcp: 85,
	workflow: 80,
	git: 75,
	storage: 70,
	auth: 65,
	config: 60,
	test: 50,
	docs: 30,
	deps: 20,
	repo: 10
};

export class ScopeDetector {
	private scopeMappings: Array<[string, string]>;
	private scopePriorities: ScopePriority;

	constructor(customMappings?: ScopeMapping, customPriorities?: ScopePriority) {
		// Start with default mappings
		this.scopeMappings = [...DEFAULT_SCOPE_MAPPINGS];

		// Add custom mappings at the start (highest priority)
		if (customMappings) {
			const customEntries = Object.entries(customMappings);
			this.scopeMappings = [...customEntries, ...this.scopeMappings];
		}

		this.scopePriorities = {
			...DEFAULT_SCOPE_PRIORITIES,
			...customPriorities
		};
	}

	/**
	 * Detect the most relevant scope from a list of changed files
	 * Returns the scope with the highest priority
	 */
	detectScope(files: string[]): string {
		if (files.length === 0) {
			return 'repo';
		}

		const scopeCounts = new Map<string, number>();

		// Count occurrences of each scope
		for (const file of files) {
			const scope = this.getMatchingScope(file);
			if (scope) {
				scopeCounts.set(scope, (scopeCounts.get(scope) || 0) + 1);
			}
		}

		// If no scopes matched, default to 'repo'
		if (scopeCounts.size === 0) {
			return 'repo';
		}

		// Find scope with highest priority (considering both priority and count)
		let bestScope = 'repo';
		let bestScore = 0;

		for (const [scope, count] of scopeCounts) {
			const priority = this.getScopePriority(scope);
			// Score = priority * count (files in that scope)
			const score = priority * count;

			if (score > bestScore) {
				bestScore = score;
				bestScope = scope;
			}
		}

		return bestScope;
	}

	/**
	 * Get all matching scopes for the given files
	 */
	getAllMatchingScopes(files: string[]): string[] {
		const scopes = new Set<string>();

		for (const file of files) {
			const scope = this.getMatchingScope(file);
			if (scope) {
				scopes.add(scope);
			}
		}

		return Array.from(scopes);
	}

	/**
	 * Get the matching scope for a single file
	 * Returns the first matching scope (order matters!)
	 */
	getMatchingScope(file: string): string | null {
		// Normalize path separators
		const normalizedFile = file.replace(/\\/g, '/');

		for (const [pattern, scope] of this.scopeMappings) {
			if (this.matchesPattern(normalizedFile, pattern)) {
				return scope;
			}
		}

		return null;
	}

	/**
	 * Get the priority of a scope
	 */
	getScopePriority(scope: string): number {
		return this.scopePriorities[scope] || 0;
	}

	/**
	 * Match a file path against a glob-like pattern
	 * Supports:
	 * - ** for multi-level directory matching
	 * - * for single-level matching
	 */
	private matchesPattern(filePath: string, pattern: string): boolean {
		// Replace ** first with a unique placeholder
		let regexPattern = pattern.replace(/\*\*/g, '§GLOBSTAR§');

		// Escape special regex characters (but not our placeholder or *)
		regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

		// Replace single * with [^/]* (matches anything except /)
		regexPattern = regexPattern.replace(/\*/g, '[^/]*');

		// Replace placeholder with .* (matches anything including /)
		regexPattern = regexPattern.replace(/§GLOBSTAR§/g, '.*');

		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(filePath);
	}
}
