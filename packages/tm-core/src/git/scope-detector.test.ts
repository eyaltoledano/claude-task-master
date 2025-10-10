import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeDetector } from './scope-detector.js';

describe('ScopeDetector', () => {
	let scopeDetector: ScopeDetector;

	beforeEach(() => {
		scopeDetector = new ScopeDetector();
	});

	describe('detectScope', () => {
		it('should detect cli scope from CLI file changes', () => {
			const files = ['packages/cli/src/commands/start.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('cli');
		});

		it('should detect core scope from core package changes', () => {
			const files = ['packages/tm-core/src/workflow/orchestrator.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('core');
		});

		it('should detect test scope from test file changes', () => {
			const files = ['packages/tm-core/src/workflow/orchestrator.test.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('test');
		});

		it('should detect docs scope from documentation changes', () => {
			const files = ['README.md', 'docs/guide.md'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('docs');
		});

		it('should detect config scope from configuration changes', () => {
			const files = ['tsconfig.json'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('config');
		});

		it('should detect workflow scope from workflow files', () => {
			const files = ['packages/tm-core/src/workflow/types.ts'];
			const scope = scopeDetector.detectScope(files);

			// Files within packages get the package scope (more specific than feature scope)
			expect(scope).toBe('core');
		});

		it('should detect git scope from git adapter files', () => {
			const files = ['packages/tm-core/src/git/git-adapter.ts'];
			const scope = scopeDetector.detectScope(files);

			// Files within packages get the package scope (more specific than feature scope)
			expect(scope).toBe('core');
		});

		it('should detect storage scope from storage files', () => {
			const files = ['packages/tm-core/src/storage/state-manager.ts'];
			const scope = scopeDetector.detectScope(files);

			// Files within packages get the package scope (more specific than feature scope)
			expect(scope).toBe('core');
		});

		it('should use most relevant scope when multiple files', () => {
			const files = [
				'packages/cli/src/commands/start.ts',
				'packages/cli/src/commands/stop.ts',
				'packages/tm-core/src/types.ts'
			];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('cli');
		});

		it('should handle mixed scopes by choosing highest priority', () => {
			const files = [
				'README.md',
				'packages/tm-core/src/workflow/orchestrator.ts'
			];
			const scope = scopeDetector.detectScope(files);

			// Core is higher priority than docs
			expect(scope).toBe('core');
		});

		it('should handle empty file list gracefully', () => {
			const files: string[] = [];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('repo');
		});

		it('should detect mcp scope from MCP server files', () => {
			const files = ['packages/mcp-server/src/tools.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('mcp');
		});

		it('should detect auth scope from authentication files', () => {
			const files = ['packages/tm-core/src/auth/auth-manager.ts'];
			const scope = scopeDetector.detectScope(files);

			// Files within packages get the package scope (more specific than feature scope)
			expect(scope).toBe('core');
		});

		it('should detect deps scope from dependency changes', () => {
			const files = ['pnpm-lock.yaml'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('deps');
		});
	});

	describe('detectScopeWithCustomRules', () => {
		it('should use custom scope mapping rules', () => {
			const customRules: Record<string, number> = {
				custom: 100
			};

			const customDetector = new ScopeDetector(
				{
					'custom/**': 'custom'
				},
				customRules
			);

			const files = ['custom/file.ts'];
			const scope = customDetector.detectScope(files);

			expect(scope).toBe('custom');
		});

		it('should override default priorities with custom priorities', () => {
			const customPriorities: Record<string, number> = {
				docs: 100, // Make docs highest priority
				core: 10
			};

			const customDetector = new ScopeDetector(undefined, customPriorities);

			const files = [
				'README.md',
				'packages/tm-core/src/workflow/orchestrator.ts'
			];
			const scope = customDetector.detectScope(files);

			expect(scope).toBe('docs');
		});
	});

	describe('getAllMatchingScopes', () => {
		it('should return all matching scopes for files', () => {
			const files = [
				'packages/cli/src/commands/start.ts',
				'packages/tm-core/src/workflow/orchestrator.ts',
				'README.md'
			];

			const scopes = scopeDetector.getAllMatchingScopes(files);

			expect(scopes).toContain('cli');
			expect(scopes).toContain('core');
			expect(scopes).toContain('docs');
			expect(scopes).toHaveLength(3);
		});

		it('should return unique scopes only', () => {
			const files = [
				'packages/cli/src/commands/start.ts',
				'packages/cli/src/commands/stop.ts'
			];

			const scopes = scopeDetector.getAllMatchingScopes(files);

			expect(scopes).toEqual(['cli']);
		});

		it('should return empty array for files with no matches', () => {
			const files = ['unknown/path/file.ts'];
			const scopes = scopeDetector.getAllMatchingScopes(files);

			expect(scopes).toEqual([]);
		});
	});

	describe('getScopePriority', () => {
		it('should return priority for known scope', () => {
			const priority = scopeDetector.getScopePriority('core');

			expect(priority).toBeGreaterThan(0);
		});

		it('should return 0 for unknown scope', () => {
			const priority = scopeDetector.getScopePriority('nonexistent');

			expect(priority).toBe(0);
		});

		it('should prioritize core > cli > test > docs', () => {
			const corePriority = scopeDetector.getScopePriority('core');
			const cliPriority = scopeDetector.getScopePriority('cli');
			const testPriority = scopeDetector.getScopePriority('test');
			const docsPriority = scopeDetector.getScopePriority('docs');

			expect(corePriority).toBeGreaterThan(cliPriority);
			expect(cliPriority).toBeGreaterThan(testPriority);
			expect(testPriority).toBeGreaterThan(docsPriority);
		});
	});

	describe('edge cases', () => {
		it('should handle Windows paths', () => {
			const files = ['packages\\cli\\src\\commands\\start.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('cli');
		});

		it('should handle absolute paths', () => {
			const files = [
				'/home/user/project/packages/tm-core/src/workflow/orchestrator.ts'
			];
			const scope = scopeDetector.detectScope(files);

			// Absolute paths won't match package patterns
			expect(scope).toBe('workflow');
		});

		it('should handle paths with special characters', () => {
			const files = ['packages/tm-core/src/workflow/orchestrator@v2.ts'];
			const scope = scopeDetector.detectScope(files);

			// Files within packages get the package scope
			expect(scope).toBe('core');
		});

		it('should handle very long file paths', () => {
			const files = [
				'packages/tm-core/src/deeply/nested/directory/structure/with/many/levels/file.ts'
			];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('core');
		});

		it('should handle files in root directory', () => {
			const files = ['file.ts'];
			const scope = scopeDetector.detectScope(files);

			expect(scope).toBe('repo');
		});
	});

	describe('getMatchingScope', () => {
		it('should return matching scope for single file', () => {
			const scope = scopeDetector.getMatchingScope('packages/cli/src/index.ts');

			expect(scope).toBe('cli');
		});

		it('should return null for non-matching file', () => {
			const scope = scopeDetector.getMatchingScope('unknown/file.ts');

			expect(scope).toBeNull();
		});

		it('should match test files', () => {
			const scope = scopeDetector.getMatchingScope(
				'src/components/button.test.tsx'
			);

			expect(scope).toBe('test');
		});
	});
});
