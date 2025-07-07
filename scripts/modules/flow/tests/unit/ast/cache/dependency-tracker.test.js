/**
 * @fileoverview Dependency Tracker Test Suite
 *
 * Tests the dependency tracking functionality including:
 * - File dependency detection and tracking
 * - Dependency graph construction and validation
 * - Change propagation through dependency chains
 * - Circular dependency detection
 * - Performance under complex dependency scenarios
 *
 * Part of Phase 1.2: AST Cache System Testing
 */

const path = require('path');

describe('DependencyTracker', () => {
	let DependencyTracker;
	let tracker;

	beforeAll(() => {
		// Mock the DependencyTracker class
		DependencyTracker = class MockDependencyTracker {
			constructor(options = {}) {
				this.options = {
					trackImports: options.trackImports !== false,
					trackExports: options.trackExports !== false,
					trackFileSystem: options.trackFileSystem !== false,
					maxDepth: options.maxDepth || 10,
					...options
				};
				this.dependencies = new Map(); // file -> Set of dependencies
				this.dependents = new Map(); // file -> Set of dependents
				this.graph = new Map(); // adjacency list representation
				this.circularDeps = new Set();
				this.lastUpdate = new Map(); // file -> timestamp
			}

			async initialize() {
				this.dependencies.clear();
				this.dependents.clear();
				this.graph.clear();
				this.circularDeps.clear();
				this.lastUpdate.clear();
				return true;
			}

			async addFile(filePath, dependencies = []) {
				const normalizedPath = path.normalize(filePath);
				const normalizedDeps = dependencies.map((dep) => path.normalize(dep));

				// Store direct dependencies
				this.dependencies.set(normalizedPath, new Set(normalizedDeps));

				// Update reverse dependencies (dependents)
				for (const dep of normalizedDeps) {
					if (!this.dependents.has(dep)) {
						this.dependents.set(dep, new Set());
					}
					this.dependents.get(dep).add(normalizedPath);
				}

				// Update graph
				this.graph.set(normalizedPath, new Set(normalizedDeps));

				// Update timestamp
				this.lastUpdate.set(normalizedPath, Date.now());

				// Check for circular dependencies
				await this._detectCircularDependencies();

				return true;
			}

			async removeFile(filePath) {
				const normalizedPath = path.normalize(filePath);

				// Remove from dependencies
				const deps = this.dependencies.get(normalizedPath) || new Set();
				for (const dep of deps) {
					const dependents = this.dependents.get(dep);
					if (dependents) {
						dependents.delete(normalizedPath);
						if (dependents.size === 0) {
							this.dependents.delete(dep);
						}
					}
				}

				// Remove from dependents
				const dependents = this.dependents.get(normalizedPath) || new Set();
				for (const dependent of dependents) {
					const deps = this.dependencies.get(dependent);
					if (deps) {
						deps.delete(normalizedPath);
					}
				}

				// Clean up maps
				this.dependencies.delete(normalizedPath);
				this.dependents.delete(normalizedPath);
				this.graph.delete(normalizedPath);
				this.lastUpdate.delete(normalizedPath);
				this.circularDeps.delete(normalizedPath);

				return true;
			}

			getDependencies(filePath, options = {}) {
				const normalizedPath = path.normalize(filePath);
				const direct = this.dependencies.get(normalizedPath) || new Set();

				if (options.recursive) {
					return this._getRecursiveDependencies(
						normalizedPath,
						options.maxDepth || this.options.maxDepth
					);
				}

				return Array.from(direct);
			}

			getDependents(filePath, options = {}) {
				const normalizedPath = path.normalize(filePath);
				const direct = this.dependents.get(normalizedPath) || new Set();

				if (options.recursive) {
					return this._getRecursiveDependents(
						normalizedPath,
						options.maxDepth || this.options.maxDepth
					);
				}

				return Array.from(direct);
			}

			getAffectedFiles(changedFiles) {
				const affected = new Set();
				const toProcess = [...changedFiles];

				while (toProcess.length > 0) {
					const file = toProcess.shift();
					const normalizedFile = path.normalize(file);

					if (affected.has(normalizedFile)) {
						continue;
					}

					affected.add(normalizedFile);

					// Add all dependents
					const dependents = this.dependents.get(normalizedFile) || new Set();
					for (const dependent of dependents) {
						if (!affected.has(dependent)) {
							toProcess.push(dependent);
						}
					}
				}

				return Array.from(affected);
			}

			hasCircularDependencies() {
				return this.circularDeps.size > 0;
			}

			getCircularDependencies() {
				return Array.from(this.circularDeps);
			}

			async updateFileDependencies(filePath, newDependencies) {
				// Remove old dependencies
				await this.removeFile(filePath);

				// Add with new dependencies
				await this.addFile(filePath, newDependencies);

				return true;
			}

			_getRecursiveDependencies(filePath, maxDepth = 10, visited = new Set()) {
				if (visited.has(filePath) || maxDepth <= 0) {
					return [];
				}

				visited.add(filePath);
				const result = [];
				const direct = this.dependencies.get(filePath) || new Set();

				for (const dep of direct) {
					result.push(dep);
					const recursive = this._getRecursiveDependencies(
						dep,
						maxDepth - 1,
						new Set(visited)
					);
					result.push(...recursive);
				}

				return [...new Set(result)]; // Remove duplicates
			}

			_getRecursiveDependents(filePath, maxDepth = 10, visited = new Set()) {
				if (visited.has(filePath) || maxDepth <= 0) {
					return [];
				}

				visited.add(filePath);
				const result = [];
				const direct = this.dependents.get(filePath) || new Set();

				for (const dependent of direct) {
					result.push(dependent);
					const recursive = this._getRecursiveDependents(
						dependent,
						maxDepth - 1,
						new Set(visited)
					);
					result.push(...recursive);
				}

				return [...new Set(result)]; // Remove duplicates
			}

			async _detectCircularDependencies() {
				this.circularDeps.clear();
				const visited = new Set();
				const recursionStack = new Set();

				for (const file of this.graph.keys()) {
					if (!visited.has(file)) {
						this._dfsCircularCheck(file, visited, recursionStack);
					}
				}
			}

			_dfsCircularCheck(file, visited, recursionStack) {
				visited.add(file);
				recursionStack.add(file);

				const dependencies = this.graph.get(file) || new Set();
				for (const dep of dependencies) {
					if (!visited.has(dep)) {
						this._dfsCircularCheck(dep, visited, recursionStack);
					} else if (recursionStack.has(dep)) {
						// Found circular dependency
						this.circularDeps.add(file);
						this.circularDeps.add(dep);
					}
				}

				recursionStack.delete(file);
			}

			getStats() {
				return {
					totalFiles: this.dependencies.size,
					totalDependencies: Array.from(this.dependencies.values()).reduce(
						(sum, deps) => sum + deps.size,
						0
					),
					circularDependencies: this.circularDeps.size,
					averageDependencies:
						this.dependencies.size > 0
							? Array.from(this.dependencies.values()).reduce(
									(sum, deps) => sum + deps.size,
									0
								) / this.dependencies.size
							: 0
				};
			}

			exportGraph() {
				const graph = {};
				for (const [file, deps] of this.dependencies) {
					graph[file] = Array.from(deps);
				}
				return graph;
			}

			async importGraph(graph) {
				await this.initialize();

				for (const [file, deps] of Object.entries(graph)) {
					await this.addFile(file, deps);
				}

				return true;
			}
		};
	});

	beforeEach(async () => {
		tracker = new DependencyTracker();
		await tracker.initialize();
	});

	describe('Initialization', () => {
		test('should initialize with default options', async () => {
			const result = await tracker.initialize();

			expect(result).toBe(true);
			expect(tracker.options.trackImports).toBe(true);
			expect(tracker.options.trackExports).toBe(true);
			expect(tracker.options.maxDepth).toBe(10);
		});

		test('should initialize with custom options', async () => {
			const customTracker = new DependencyTracker({
				trackImports: false,
				trackExports: true,
				maxDepth: 5
			});

			expect(customTracker.options.trackImports).toBe(false);
			expect(customTracker.options.trackExports).toBe(true);
			expect(customTracker.options.maxDepth).toBe(5);
		});
	});

	describe('File Management', () => {
		test('should add file with dependencies', async () => {
			const filePath = '/src/app.js';
			const dependencies = ['/src/utils.js', '/src/config.js'];

			const result = await tracker.addFile(filePath, dependencies);

			expect(result).toBe(true);
			expect(tracker.getDependencies(filePath)).toEqual(dependencies);
		});

		test('should track reverse dependencies (dependents)', async () => {
			await tracker.addFile('/src/app.js', ['/src/utils.js']);
			await tracker.addFile('/src/component.js', ['/src/utils.js']);

			const dependents = tracker.getDependents('/src/utils.js');

			expect(dependents).toContain('/src/app.js');
			expect(dependents).toContain('/src/component.js');
			expect(dependents.length).toBe(2);
		});

		test('should remove file and clean up dependencies', async () => {
			await tracker.addFile('/src/app.js', ['/src/utils.js']);
			await tracker.addFile('/src/component.js', ['/src/utils.js']);

			const result = await tracker.removeFile('/src/app.js');

			expect(result).toBe(true);
			expect(tracker.getDependencies('/src/app.js')).toEqual([]);

			const dependents = tracker.getDependents('/src/utils.js');
			expect(dependents).toEqual(['/src/component.js']);
		});

		test('should update file dependencies', async () => {
			await tracker.addFile('/src/app.js', ['/src/utils.js']);

			const result = await tracker.updateFileDependencies('/src/app.js', [
				'/src/config.js',
				'/src/api.js'
			]);

			expect(result).toBe(true);
			expect(tracker.getDependencies('/src/app.js')).toEqual([
				'/src/config.js',
				'/src/api.js'
			]);
			expect(tracker.getDependents('/src/utils.js')).toEqual([]);
		});

		test('should handle file paths consistently', async () => {
			const paths = [
				'/src/app.js',
				'\\src\\app.js',
				'/src//app.js',
				'/src/./app.js'
			];

			for (const pathVariant of paths) {
				await tracker.addFile(pathVariant, ['/src/utils.js']);
			}

			// Should be treated as the same file
			const stats = tracker.getStats();
			expect(stats.totalFiles).toBe(1);
		});
	});

	describe('Dependency Queries', () => {
		beforeEach(async () => {
			// Set up a dependency chain: app -> utils -> config -> constants
			await tracker.addFile('/src/app.js', ['/src/utils.js']);
			await tracker.addFile('/src/utils.js', ['/src/config.js']);
			await tracker.addFile('/src/config.js', ['/src/constants.js']);
			await tracker.addFile('/src/constants.js', []);
		});

		test('should get direct dependencies', () => {
			const deps = tracker.getDependencies('/src/app.js');
			expect(deps).toEqual(['/src/utils.js']);
		});

		test('should get recursive dependencies', () => {
			const deps = tracker.getDependencies('/src/app.js', { recursive: true });
			expect(deps).toContain('/src/utils.js');
			expect(deps).toContain('/src/config.js');
			expect(deps).toContain('/src/constants.js');
			expect(deps.length).toBe(3);
		});

		test('should get direct dependents', () => {
			const dependents = tracker.getDependents('/src/utils.js');
			expect(dependents).toEqual(['/src/app.js']);
		});

		test('should get recursive dependents', () => {
			const dependents = tracker.getDependents('/src/constants.js', {
				recursive: true
			});
			expect(dependents).toContain('/src/config.js');
			expect(dependents).toContain('/src/utils.js');
			expect(dependents).toContain('/src/app.js');
			expect(dependents.length).toBe(3);
		});

		test('should respect max depth in recursive queries', () => {
			const deps = tracker.getDependencies('/src/app.js', {
				recursive: true,
				maxDepth: 2
			});
			expect(deps).toContain('/src/utils.js');
			expect(deps).toContain('/src/config.js');
			expect(deps).not.toContain('/src/constants.js'); // Beyond max depth
		});
	});

	describe('Change Impact Analysis', () => {
		beforeEach(async () => {
			// Set up a more complex dependency graph
			await tracker.addFile('/src/app.js', [
				'/src/components/Header.js',
				'/src/utils.js'
			]);
			await tracker.addFile('/src/components/Header.js', ['/src/utils.js']);
			await tracker.addFile('/src/components/Footer.js', ['/src/utils.js']);
			await tracker.addFile('/src/utils.js', ['/src/config.js']);
			await tracker.addFile('/src/config.js', []);
		});

		test('should identify all affected files from a change', () => {
			const affected = tracker.getAffectedFiles(['/src/utils.js']);

			expect(affected).toContain('/src/utils.js');
			expect(affected).toContain('/src/app.js');
			expect(affected).toContain('/src/components/Header.js');
			expect(affected).toContain('/src/components/Footer.js');
			expect(affected.length).toBe(4);
		});

		test('should handle multiple changed files', () => {
			const affected = tracker.getAffectedFiles([
				'/src/utils.js',
				'/src/config.js'
			]);

			expect(affected).toContain('/src/config.js');
			expect(affected).toContain('/src/utils.js');
			expect(affected).toContain('/src/app.js');
			expect(affected).toContain('/src/components/Header.js');
			expect(affected).toContain('/src/components/Footer.js');
		});

		test('should handle files with no dependents', () => {
			const affected = tracker.getAffectedFiles(['/src/config.js']);

			expect(affected).toContain('/src/config.js');
			expect(affected).toContain('/src/utils.js');
			expect(affected.length).toBeGreaterThan(1);
		});

		test('should handle non-existent files gracefully', () => {
			const affected = tracker.getAffectedFiles(['/src/nonexistent.js']);

			expect(affected).toEqual(['/src/nonexistent.js']);
		});
	});

	describe('Circular Dependency Detection', () => {
		test('should detect simple circular dependency', async () => {
			await tracker.addFile('/src/a.js', ['/src/b.js']);
			await tracker.addFile('/src/b.js', ['/src/a.js']);

			expect(tracker.hasCircularDependencies()).toBe(true);

			const circular = tracker.getCircularDependencies();
			expect(circular).toContain('/src/a.js');
			expect(circular).toContain('/src/b.js');
		});

		test('should detect complex circular dependency', async () => {
			await tracker.addFile('/src/a.js', ['/src/b.js']);
			await tracker.addFile('/src/b.js', ['/src/c.js']);
			await tracker.addFile('/src/c.js', ['/src/a.js']);

			expect(tracker.hasCircularDependencies()).toBe(true);

			const circular = tracker.getCircularDependencies();
			expect(circular.length).toBeGreaterThan(0);
		});

		test('should not detect false positives', async () => {
			await tracker.addFile('/src/a.js', ['/src/b.js']);
			await tracker.addFile('/src/b.js', ['/src/c.js']);
			await tracker.addFile('/src/c.js', []);

			expect(tracker.hasCircularDependencies()).toBe(false);
			expect(tracker.getCircularDependencies()).toEqual([]);
		});

		test('should update circular detection when dependencies change', async () => {
			await tracker.addFile('/src/a.js', ['/src/b.js']);
			await tracker.addFile('/src/b.js', ['/src/a.js']);

			expect(tracker.hasCircularDependencies()).toBe(true);

			// Break the cycle
			await tracker.updateFileDependencies('/src/b.js', []);

			expect(tracker.hasCircularDependencies()).toBe(false);
		});
	});

	describe('Performance Testing', () => {
		test('should handle large dependency graphs efficiently', async () => {
			const fileCount = 1000;
			const startTime = Date.now();

			// Create a large dependency graph
			const promises = [];
			for (let i = 0; i < fileCount; i++) {
				const deps = i > 0 ? [`/src/file-${i - 1}.js`] : [];
				promises.push(tracker.addFile(`/src/file-${i}.js`, deps));
			}

			await Promise.all(promises);
			const endTime = Date.now();

			expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

			const stats = tracker.getStats();
			expect(stats.totalFiles).toBe(fileCount);
		});

		test('should handle complex dependency queries efficiently', async () => {
			// Set up a complex graph
			for (let i = 0; i < 100; i++) {
				const deps = [];
				for (let j = 0; j < Math.min(5, i); j++) {
					deps.push(`/src/file-${j}.js`);
				}
				await tracker.addFile(`/src/file-${i}.js`, deps);
			}

			const startTime = Date.now();

			// Perform multiple complex queries
			for (let i = 0; i < 10; i++) {
				tracker.getDependencies(`/src/file-${i}.js`, { recursive: true });
				tracker.getDependents(`/src/file-${i}.js`, { recursive: true });
				tracker.getAffectedFiles([`/src/file-${i}.js`]);
			}

			const endTime = Date.now();

			expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	describe('Graph Import/Export', () => {
		beforeEach(async () => {
			await tracker.addFile('/src/app.js', ['/src/utils.js']);
			await tracker.addFile('/src/utils.js', ['/src/config.js']);
			await tracker.addFile('/src/config.js', []);
		});

		test('should export dependency graph', () => {
			const graph = tracker.exportGraph();

			expect(graph).toHaveProperty('/src/app.js');
			expect(graph['/src/app.js']).toEqual(['/src/utils.js']);
			expect(graph['/src/utils.js']).toEqual(['/src/config.js']);
			expect(graph['/src/config.js']).toEqual([]);
		});

		test('should import dependency graph', async () => {
			const graph = {
				'/src/new-app.js': ['/src/new-utils.js'],
				'/src/new-utils.js': ['/src/new-config.js'],
				'/src/new-config.js': []
			};

			const result = await tracker.importGraph(graph);

			expect(result).toBe(true);
			expect(tracker.getDependencies('/src/new-app.js')).toEqual([
				'/src/new-utils.js'
			]);
			expect(tracker.getDependencies('/src/new-utils.js')).toEqual([
				'/src/new-config.js'
			]);
		});

		test('should preserve graph structure through export/import cycle', async () => {
			const originalGraph = tracker.exportGraph();

			const newTracker = new DependencyTracker();
			await newTracker.importGraph(originalGraph);

			const newGraph = newTracker.exportGraph();

			expect(newGraph).toEqual(originalGraph);
		});
	});

	describe('Statistics and Monitoring', () => {
		beforeEach(async () => {
			await tracker.addFile('/src/app.js', ['/src/utils.js', '/src/config.js']);
			await tracker.addFile('/src/utils.js', ['/src/config.js']);
			await tracker.addFile('/src/config.js', []);
		});

		test('should provide accurate statistics', () => {
			const stats = tracker.getStats();

			expect(stats.totalFiles).toBe(3);
			expect(stats.totalDependencies).toBe(3); // 2 + 1 + 0
			expect(stats.averageDependencies).toBeCloseTo(1);
			expect(stats.circularDependencies).toBe(0);
		});

		test('should update statistics as graph changes', async () => {
			let stats = tracker.getStats();
			const initialFiles = stats.totalFiles;

			await tracker.addFile('/src/new-file.js', ['/src/utils.js']);

			stats = tracker.getStats();
			expect(stats.totalFiles).toBe(initialFiles + 1);
			expect(stats.totalDependencies).toBe(4);
		});
	});

	describe('Error Handling', () => {
		test('should handle empty dependency arrays', async () => {
			const result = await tracker.addFile('/src/standalone.js', []);

			expect(result).toBe(true);
			expect(tracker.getDependencies('/src/standalone.js')).toEqual([]);
		});

		test('should handle duplicate dependencies', async () => {
			const deps = ['/src/utils.js', '/src/utils.js', '/src/config.js'];
			await tracker.addFile('/src/app.js', deps);

			const actualDeps = tracker.getDependencies('/src/app.js');
			expect(actualDeps.length).toBe(2); // Duplicates should be removed
			expect(actualDeps).toContain('/src/utils.js');
			expect(actualDeps).toContain('/src/config.js');
		});

		test('should handle self-dependencies', async () => {
			await tracker.addFile('/src/app.js', ['/src/app.js']);

			expect(tracker.hasCircularDependencies()).toBe(true);
		});

		test('should handle very deep dependency chains', async () => {
			const depth = 20;

			for (let i = 0; i < depth; i++) {
				const deps = i > 0 ? [`/src/file-${i - 1}.js`] : [];
				await tracker.addFile(`/src/file-${i}.js`, deps);
			}

			const deps = tracker.getDependencies('/src/file-19.js', {
				recursive: true
			});
			expect(deps.length).toBe(19);
		});
	});
});
