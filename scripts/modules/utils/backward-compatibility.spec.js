/**
 * @jest-environment node
 */

/**
 * Backward Compatibility Tests
 *
 * These tests ensure that the old import paths still work during the transition period.
 * The old files should re-export from @tm/core to maintain backward compatibility.
 */

describe('Backward Compatibility - Old Import Paths', () => {
	describe('contextGatherer.js', () => {
		it('should export ContextGatherer class from old path', async () => {
			const { ContextGatherer } = await import('./contextGatherer.js');

			expect(ContextGatherer).toBeDefined();
			expect(typeof ContextGatherer).toBe('function');
		});

		it('should export createContextGatherer function from old path', async () => {
			const { createContextGatherer } = await import('./contextGatherer.js');

			expect(createContextGatherer).toBeDefined();
			expect(typeof createContextGatherer).toBe('function');
		});

		it('should be able to instantiate ContextGatherer from old path', async () => {
			const { ContextGatherer } = await import('./contextGatherer.js');

			expect(() => {
				new ContextGatherer('/fake/path', 'test-tag');
			}).not.toThrow();
		});
	});

	describe('fuzzyTaskSearch.js', () => {
		it('should export FuzzyTaskSearch class from old path', async () => {
			const { FuzzyTaskSearch } = await import('./fuzzyTaskSearch.js');

			expect(FuzzyTaskSearch).toBeDefined();
			expect(typeof FuzzyTaskSearch).toBe('function');
		});

		it('should export createFuzzyTaskSearch function from old path', async () => {
			const { createFuzzyTaskSearch } = await import('./fuzzyTaskSearch.js');

			expect(createFuzzyTaskSearch).toBeDefined();
			expect(typeof createFuzzyTaskSearch).toBe('function');
		});

		it('should export findRelevantTaskIds function from old path', async () => {
			const { findRelevantTaskIds } = await import('./fuzzyTaskSearch.js');

			expect(findRelevantTaskIds).toBeDefined();
			expect(typeof findRelevantTaskIds).toBe('function');
		});

		it('should be able to instantiate FuzzyTaskSearch from old path', async () => {
			const { FuzzyTaskSearch } = await import('./fuzzyTaskSearch.js');

			const testTasks = [
				{
					id: 1,
					title: 'Test Task',
					description: 'Test description',
					status: 'pending',
					dependencies: []
				}
			];

			expect(() => {
				new FuzzyTaskSearch(testTasks);
			}).not.toThrow();
		});
	});

	describe('Cross-compatibility', () => {
		it('should export the same ContextGatherer from both paths', async () => {
			const { ContextGatherer: OldContextGatherer } = await import('./contextGatherer.js');
			const { ContextGatherer: NewContextGatherer } = await import('@tm/core');

			// They should be the exact same class reference
			expect(OldContextGatherer).toBe(NewContextGatherer);
		});

		it('should export the same FuzzyTaskSearch from both paths', async () => {
			const { FuzzyTaskSearch: OldFuzzyTaskSearch } = await import('./fuzzyTaskSearch.js');
			const { FuzzyTaskSearch: NewFuzzyTaskSearch } = await import('@tm/core');

			// They should be the exact same class reference
			expect(OldFuzzyTaskSearch).toBe(NewFuzzyTaskSearch);
		});
	});
});
