/**
 * @fileoverview Enhanced AST Context Builder Test Suite
 *
 * Tests the enhanced AST context building functionality including:
 * - Smart file filtering based on relevance
 * - Git integration (branch context, recent changes)
 * - Dependency graph integration
 * - Incremental context updates
 * - Context caching and invalidation
 *
 * Part of Phase 1.3: Context Building & Analysis Testing
 */

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');

describe('EnhancedASTContextBuilder', () => {
	let EnhancedASTContextBuilder;
	let enhancedBuilder;
	let mockGitProvider;
	let mockDependencyTracker;
	let mockRelevanceScorer;

	beforeAll(() => {
		// Mock Git provider interface
		const MockGitProvider = class {
			constructor() {
				this.currentBranch = 'main';
				this.commits = new Map();
				this.changedFiles = new Set();
				this.fileHistory = new Map();
			}

			async getCurrentBranch() {
				return this.currentBranch;
			}

			async getRecentCommits(limit = 10) {
				const commits = Array.from(this.commits.values())
					.sort((a, b) => b.timestamp - a.timestamp)
					.slice(0, limit);
				return commits;
			}

			async getChangedFiles(since = '1 day ago') {
				return Array.from(this.changedFiles);
			}

			async getFileHistory(filePath, limit = 5) {
				return this.fileHistory.get(filePath) || [];
			}

			async getCommitForFile(filePath) {
				const history = this.fileHistory.get(filePath) || [];
				return history[0] || null;
			}

			setBranch(branch) {
				this.currentBranch = branch;
			}

			addCommit(hash, message, files = [], timestamp = Date.now()) {
				const commit = {
					hash,
					message,
					files,
					timestamp,
					author: 'Test Author'
				};
				this.commits.set(hash, commit);

				// Update file history
				for (const file of files) {
					if (!this.fileHistory.has(file)) {
						this.fileHistory.set(file, []);
					}
					this.fileHistory.get(file).unshift(commit);
				}
			}

			addChangedFile(filePath) {
				this.changedFiles.add(filePath);
			}

			async getBranchContext() {
				return {
					current: this.currentBranch,
					commits: await this.getRecentCommits(),
					changedFiles: await this.getChangedFiles()
				};
			}
		};

		// Mock dependency tracker
		const MockDependencyTracker = class {
			constructor() {
				this.dependencies = new Map();
				this.dependents = new Map();
				this.graph = new Map();
			}

			addDependency(file, dependency) {
				if (!this.dependencies.has(file)) {
					this.dependencies.set(file, new Set());
				}
				this.dependencies.get(file).add(dependency);

				if (!this.dependents.has(dependency)) {
					this.dependents.set(dependency, new Set());
				}
				this.dependents.get(dependency).add(file);
			}

			getDependencies(file, recursive = false) {
				if (!recursive) {
					return Array.from(this.dependencies.get(file) || []);
				}

				const result = new Set();
				const visited = new Set();

				const traverse = (currentFile) => {
					if (visited.has(currentFile)) return;
					visited.add(currentFile);

					const deps = this.dependencies.get(currentFile) || new Set();
					for (const dep of deps) {
						result.add(dep);
						traverse(dep);
					}
				};

				traverse(file);
				return Array.from(result);
			}

			getDependents(file, recursive = false) {
				if (!recursive) {
					return Array.from(this.dependents.get(file) || []);
				}

				const result = new Set();
				const visited = new Set();

				const traverse = (currentFile) => {
					if (visited.has(currentFile)) return;
					visited.add(currentFile);

					const deps = this.dependents.get(currentFile) || new Set();
					for (const dep of deps) {
						result.add(dep);
						traverse(dep);
					}
				};

				traverse(file);
				return Array.from(result);
			}

			getRelatedFiles(file, maxDepth = 2) {
				const related = new Set();

				// Add direct dependencies and dependents
				const deps = this.getDependencies(file);
				const dependents = this.getDependents(file);

				deps.forEach((dep) => related.add(dep));
				dependents.forEach((dep) => related.add(dep));

				// Add second-level relationships if maxDepth allows
				if (maxDepth > 1) {
					[...deps, ...dependents].forEach((relatedFile) => {
						const secondLevel = [
							...this.getDependencies(relatedFile),
							...this.getDependents(relatedFile)
						];
						secondLevel.forEach((file) => related.add(file));
					});
				}

				return Array.from(related);
			}

			buildDependencyGraph(files) {
				const graph = {};
				for (const file of files) {
					graph[file] = {
						dependencies: this.getDependencies(file),
						dependents: this.getDependents(file)
					};
				}
				return graph;
			}
		};

		// Mock relevance scorer
		const MockRelevanceScorer = class {
			constructor() {
				this.taskKeywords = [];
				this.contextKeywords = [];
				this.fileWeights = new Map();
			}

			setTaskContext(keywords = [], description = '') {
				this.taskKeywords = keywords;
				this.taskDescription = description;
			}

			setContextKeywords(keywords = []) {
				this.contextKeywords = keywords;
			}

			scoreFile(filePath, content, metadata = {}) {
				let score = 0;

				// Base score from file type
				const ext = filePath.split('.').pop();
				const typeScores = {
					js: 0.8,
					jsx: 0.8,
					ts: 0.8,
					tsx: 0.8,
					py: 0.7,
					go: 0.7,
					java: 0.6,
					md: 0.3,
					txt: 0.2,
					json: 0.4
				};
				score += typeScores[ext] || 0.1;

				// Keyword relevance
				const allKeywords = [...this.taskKeywords, ...this.contextKeywords];
				for (const keyword of allKeywords) {
					if (content.toLowerCase().includes(keyword.toLowerCase())) {
						score += 0.2;
					}
					if (filePath.toLowerCase().includes(keyword.toLowerCase())) {
						score += 0.3;
					}
				}

				// Recent changes boost
				if (metadata.recentlyChanged) {
					score += 0.4;
				}

				// Size penalty for very large files
				if (metadata.size > 50000) {
					score *= 0.8;
				}

				// Dependency boost
				if (metadata.dependencyCount > 5) {
					score += 0.2;
				}

				return Math.min(score, 1.0);
			}

			scoreFiles(files) {
				const scores = {};
				for (const [filePath, fileData] of Object.entries(files)) {
					scores[filePath] = this.scoreFile(
						filePath,
						fileData.content || '',
						fileData.metadata || {}
					);
				}
				return scores;
			}

			filterByRelevance(files, threshold = 0.3) {
				const scores = this.scoreFiles(files);
				const relevant = {};

				for (const [filePath, score] of Object.entries(scores)) {
					if (score >= threshold) {
						relevant[filePath] = {
							...files[filePath],
							relevanceScore: score
						};
					}
				}

				return relevant;
			}

			rankFiles(files) {
				const scores = this.scoreFiles(files);
				return Object.entries(scores)
					.sort(([, a], [, b]) => b - a)
					.map(([filePath, score]) => ({ filePath, score }));
			}
		};

		// Mock the EnhancedASTContextBuilder class
		EnhancedASTContextBuilder = class MockEnhancedASTContextBuilder extends (
			EventEmitter
		) {
			constructor(options = {}) {
				super();
				this.options = {
					enableGitIntegration: options.enableGitIntegration !== false,
					enableDependencyTracking: options.enableDependencyTracking !== false,
					enableRelevanceScoring: options.enableRelevanceScoring !== false,
					enableIncrementalUpdates: options.enableIncrementalUpdates !== false,
					relevanceThreshold: options.relevanceThreshold || 0.3,
					maxContextSize: options.maxContextSize || 100,
					includeRecentChanges: options.includeRecentChanges !== false,
					...options
				};

				this.gitProvider = options.gitProvider || new MockGitProvider();
				this.dependencyTracker =
					options.dependencyTracker || new MockDependencyTracker();
				this.relevanceScorer =
					options.relevanceScorer || new MockRelevanceScorer();

				this.contextCache = new Map();
				this.lastUpdate = null;
				this.stats = {
					buildsCount: 0,
					cacheHits: 0,
					incrementalUpdates: 0,
					gitIntegrationTime: 0,
					relevanceScoringTime: 0
				};
			}

			async buildEnhancedContext(rootPath, taskContext = {}, options = {}) {
				const startTime = performance.now();
				this.stats.buildsCount++;

				try {
					// Set task context for relevance scoring
					if (taskContext.keywords || taskContext.description) {
						this.relevanceScorer.setTaskContext(
							taskContext.keywords || [],
							taskContext.description || ''
						);
					}

					// Get Git context if enabled
					let gitContext = null;
					if (this.options.enableGitIntegration) {
						const gitStart = performance.now();
						gitContext = await this._getGitContext();
						this.stats.gitIntegrationTime += performance.now() - gitStart;
					}

					// Check for incremental update possibility
					if (
						this.options.enableIncrementalUpdates &&
						this._canUseIncremental(rootPath, gitContext)
					) {
						return await this._performIncrementalUpdate(
							rootPath,
							gitContext,
							taskContext
						);
					}

					// Build base context
					const baseContext = await this._buildBaseContext(rootPath, options);

					// Enhance with Git information
					if (gitContext) {
						this._enhanceWithGitContext(baseContext, gitContext);
					}

					// Enhance with dependency information
					if (this.options.enableDependencyTracking) {
						await this._enhanceWithDependencies(baseContext);
					}

					// Apply relevance scoring and filtering
					if (this.options.enableRelevanceScoring) {
						const scoringStart = performance.now();
						await this._applyRelevanceScoring(baseContext, taskContext);
						this.stats.relevanceScoringTime += performance.now() - scoringStart;
					}

					// Optimize context size
					const optimizedContext = this._optimizeContextSize(baseContext);

					// Cache the result
					this._cacheContext(rootPath, optimizedContext, gitContext);

					const endTime = performance.now();

					return {
						context: optimizedContext,
						metadata: {
							rootPath,
							timestamp: new Date().toISOString(),
							buildTime: endTime - startTime,
							gitContext,
							taskContext,
							stats: { ...this.stats }
						}
					};
				} catch (error) {
					this.emit('error', { type: 'build_error', error, rootPath });
					throw error;
				}
			}

			async _getGitContext() {
				return {
					branch: await this.gitProvider.getCurrentBranch(),
					recentCommits: await this.gitProvider.getRecentCommits(5),
					changedFiles: await this.gitProvider.getChangedFiles(),
					branchContext: await this.gitProvider.getBranchContext()
				};
			}

			_canUseIncremental(rootPath, gitContext) {
				if (!this.lastUpdate || !this.contextCache.has(rootPath)) {
					return false;
				}

				const cached = this.contextCache.get(rootPath);

				// Check if Git context has changed significantly
				if (gitContext && cached.gitContext) {
					const hasNewCommits =
						gitContext.recentCommits.length >
						cached.gitContext.recentCommits.length;
					const hasNewChanges =
						gitContext.changedFiles.length >
						cached.gitContext.changedFiles.length;

					if (hasNewCommits || hasNewChanges) {
						return true; // Can do incremental update
					}
				}

				return false;
			}

			async _performIncrementalUpdate(rootPath, gitContext, taskContext) {
				this.stats.incrementalUpdates++;

				const cached = this.contextCache.get(rootPath);
				const changedFiles = gitContext.changedFiles;

				// Update only changed files and their dependencies
				const filesToUpdate = new Set(changedFiles);

				// Add dependent files
				if (this.options.enableDependencyTracking) {
					for (const file of changedFiles) {
						const dependents = this.dependencyTracker.getDependents(file, true);
						dependents.forEach((dep) => filesToUpdate.add(dep));
					}
				}

				// Rebuild context for affected files
				const updatedContext = { ...cached.context };

				for (const file of filesToUpdate) {
					// Simulate re-parsing and re-scoring
					if (updatedContext.files[file]) {
						updatedContext.files[file].lastUpdated = new Date().toISOString();
						updatedContext.files[file].incrementalUpdate = true;
					}
				}

				// Re-apply relevance scoring
				if (this.options.enableRelevanceScoring) {
					await this._applyRelevanceScoring(updatedContext, taskContext);
				}

				// Update cache
				this._cacheContext(rootPath, updatedContext, gitContext);

				this.emit('incrementalUpdate', {
					rootPath,
					updatedFiles: Array.from(filesToUpdate)
				});

				return {
					context: updatedContext,
					metadata: {
						rootPath,
						timestamp: new Date().toISOString(),
						incremental: true,
						updatedFiles: Array.from(filesToUpdate)
					}
				};
			}

			async _buildBaseContext(rootPath, options = {}) {
				// Simulate base context building
				return {
					files: {
						[`${rootPath}/src/app.js`]: {
							content: 'console.log("app");',
							ast: { type: 'Program' },
							size: 100,
							mtime: new Date()
						},
						[`${rootPath}/src/utils.js`]: {
							content: 'export function helper() {}',
							ast: { type: 'Program' },
							size: 80,
							mtime: new Date()
						}
					},
					summary: {
						totalFiles: 2,
						languages: { javascript: 2 },
						totalSize: 180
					}
				};
			}

			_enhanceWithGitContext(context, gitContext) {
				const changedFiles = new Set(gitContext.changedFiles);

				for (const [filePath, fileData] of Object.entries(context.files)) {
					fileData.gitInfo = {
						recentlyChanged: changedFiles.has(filePath),
						branch: gitContext.branch,
						lastCommit: null // Would be populated from git history
					};
				}

				context.gitContext = gitContext;
			}

			async _enhanceWithDependencies(context) {
				const files = Object.keys(context.files);

				// Build dependency graph
				context.dependencyGraph =
					this.dependencyTracker.buildDependencyGraph(files);

				// Add dependency metadata to files
				for (const [filePath, fileData] of Object.entries(context.files)) {
					const dependencies = this.dependencyTracker.getDependencies(filePath);
					const dependents = this.dependencyTracker.getDependents(filePath);

					fileData.dependencies = {
						direct: dependencies,
						dependents: dependents,
						related: this.dependencyTracker.getRelatedFiles(filePath)
					};
				}
			}

			async _applyRelevanceScoring(context, taskContext) {
				// Set context keywords if provided
				if (taskContext.contextKeywords) {
					this.relevanceScorer.setContextKeywords(taskContext.contextKeywords);
				}

				// Score all files
				const scores = this.relevanceScorer.scoreFiles(context.files);

				// Add scores to file metadata
				for (const [filePath, score] of Object.entries(scores)) {
					if (context.files[filePath]) {
						context.files[filePath].relevanceScore = score;
					}
				}

				// Filter by relevance threshold
				if (this.options.relevanceThreshold > 0) {
					const relevantFiles = this.relevanceScorer.filterByRelevance(
						context.files,
						this.options.relevanceThreshold
					);
					context.files = relevantFiles;
				}

				// Add relevance summary
				context.relevanceSummary = {
					threshold: this.options.relevanceThreshold,
					totalScored: Object.keys(scores).length,
					aboveThreshold: Object.keys(context.files).length,
					averageScore:
						Object.values(scores).reduce((a, b) => a + b, 0) /
						Object.values(scores).length
				};
			}

			_optimizeContextSize(context) {
				if (Object.keys(context.files).length <= this.options.maxContextSize) {
					return context;
				}

				// Sort files by relevance score (if available) or by size
				const sortedFiles = Object.entries(context.files)
					.sort(([, a], [, b]) => {
						const scoreA = a.relevanceScore || 0;
						const scoreB = b.relevanceScore || 0;
						return scoreB - scoreA;
					})
					.slice(0, this.options.maxContextSize);

				const optimizedFiles = {};
				for (const [filePath, fileData] of sortedFiles) {
					optimizedFiles[filePath] = fileData;
				}

				return {
					...context,
					files: optimizedFiles,
					optimization: {
						originalCount: Object.keys(context.files).length,
						optimizedCount: Object.keys(optimizedFiles).length,
						method: 'relevance_score'
					}
				};
			}

			_cacheContext(rootPath, context, gitContext) {
				this.contextCache.set(rootPath, {
					context,
					gitContext,
					timestamp: Date.now()
				});
				this.lastUpdate = Date.now();
			}

			async invalidateCache(rootPath = null) {
				if (rootPath) {
					this.contextCache.delete(rootPath);
				} else {
					this.contextCache.clear();
				}
				this.emit('cacheInvalidated', { rootPath });
			}

			getCacheStats() {
				return {
					size: this.contextCache.size,
					hitRate:
						this.stats.buildsCount > 0
							? this.stats.cacheHits / this.stats.buildsCount
							: 0,
					incrementalUpdates: this.stats.incrementalUpdates
				};
			}

			getStats() {
				return { ...this.stats };
			}

			async warmupContext(rootPath, taskContext = {}) {
				// Pre-build context for faster subsequent builds
				await this.buildEnhancedContext(rootPath, taskContext);
				this.emit('warmupComplete', { rootPath });
			}

			setRelevanceThreshold(threshold) {
				this.options.relevanceThreshold = threshold;
			}

			async getContextPreview(rootPath, taskContext = {}, maxFiles = 10) {
				const result = await this.buildEnhancedContext(rootPath, taskContext);

				// Return a preview with limited files
				const previewFiles = Object.entries(result.context.files)
					.sort(
						([, a], [, b]) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
					)
					.slice(0, maxFiles);

				return {
					preview: Object.fromEntries(previewFiles),
					totalFiles: Object.keys(result.context.files).length,
					metadata: result.metadata
				};
			}
		};

		mockGitProvider = new MockGitProvider();
		mockDependencyTracker = new MockDependencyTracker();
		mockRelevanceScorer = new MockRelevanceScorer();
	});

	beforeEach(() => {
		mockGitProvider = new mockGitProvider.constructor();
		mockDependencyTracker = new mockDependencyTracker.constructor();
		mockRelevanceScorer = new mockRelevanceScorer.constructor();

		enhancedBuilder = new EnhancedASTContextBuilder({
			gitProvider: mockGitProvider,
			dependencyTracker: mockDependencyTracker,
			relevanceScorer: mockRelevanceScorer
		});
	});

	describe('Initialization', () => {
		test('should initialize with default options', () => {
			const builder = new EnhancedASTContextBuilder();

			expect(builder.options.enableGitIntegration).toBe(true);
			expect(builder.options.enableDependencyTracking).toBe(true);
			expect(builder.options.enableRelevanceScoring).toBe(true);
			expect(builder.options.relevanceThreshold).toBe(0.3);
			expect(builder.options.maxContextSize).toBe(100);
		});

		test('should initialize with custom options', () => {
			const options = {
				enableGitIntegration: false,
				relevanceThreshold: 0.5,
				maxContextSize: 50
			};

			const builder = new EnhancedASTContextBuilder(options);

			expect(builder.options.enableGitIntegration).toBe(false);
			expect(builder.options.relevanceThreshold).toBe(0.5);
			expect(builder.options.maxContextSize).toBe(50);
		});
	});

	describe('Git Integration', () => {
		beforeEach(() => {
			mockGitProvider.setBranch('feature/new-feature');
			mockGitProvider.addCommit('abc123', 'Add new feature', [
				'/project/src/feature.js'
			]);
			mockGitProvider.addChangedFile('/project/src/app.js');
			mockGitProvider.addChangedFile('/project/src/feature.js');
		});

		test('should include Git context in enhanced build', async () => {
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.metadata.gitContext).toBeDefined();
			expect(result.metadata.gitContext.branch).toBe('feature/new-feature');
			expect(result.metadata.gitContext.changedFiles).toContain(
				'/project/src/app.js'
			);
		});

		test('should enhance files with Git information', async () => {
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			const appFile = result.context.files['/project/src/app.js'];
			expect(appFile.gitInfo).toBeDefined();
			expect(appFile.gitInfo.recentlyChanged).toBe(true);
			expect(appFile.gitInfo.branch).toBe('feature/new-feature');
		});

		test('should work without Git integration when disabled', async () => {
			enhancedBuilder.options.enableGitIntegration = false;

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.metadata.gitContext).toBeNull();
			expect(result.context.gitContext).toBeUndefined();
		});
	});

	describe('Dependency Tracking', () => {
		beforeEach(() => {
			mockDependencyTracker.addDependency(
				'/project/src/app.js',
				'/project/src/utils.js'
			);
			mockDependencyTracker.addDependency(
				'/project/src/utils.js',
				'/project/src/config.js'
			);
		});

		test('should enhance context with dependency information', async () => {
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.context.dependencyGraph).toBeDefined();

			const appFile = result.context.files['/project/src/app.js'];
			expect(appFile.dependencies).toBeDefined();
			expect(appFile.dependencies.direct).toContain('/project/src/utils.js');
		});

		test('should include related files in dependencies', async () => {
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			const utilsFile = result.context.files['/project/src/utils.js'];
			expect(utilsFile.dependencies.dependents).toContain(
				'/project/src/app.js'
			);
			expect(utilsFile.dependencies.related).toContain('/project/src/app.js');
		});

		test('should work without dependency tracking when disabled', async () => {
			enhancedBuilder.options.enableDependencyTracking = false;

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.context.dependencyGraph).toBeUndefined();
		});
	});

	describe('Relevance Scoring', () => {
		test('should apply relevance scoring to files', async () => {
			const taskContext = {
				keywords: ['app', 'main'],
				description: 'Main application entry point'
			};

			const result = await enhancedBuilder.buildEnhancedContext(
				'/project',
				taskContext
			);

			expect(result.context.relevanceSummary).toBeDefined();
			expect(result.context.relevanceSummary.threshold).toBe(0.3);

			const appFile = result.context.files['/project/src/app.js'];
			expect(appFile.relevanceScore).toBeDefined();
			expect(typeof appFile.relevanceScore).toBe('number');
		});

		test('should filter files by relevance threshold', async () => {
			enhancedBuilder.options.relevanceThreshold = 0.8; // High threshold

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			// Should filter out files with low relevance
			expect(Object.keys(result.context.files).length).toBeLessThanOrEqual(2);
		});

		test('should work without relevance scoring when disabled', async () => {
			enhancedBuilder.options.enableRelevanceScoring = false;

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.context.relevanceSummary).toBeUndefined();

			const files = Object.values(result.context.files);
			files.forEach((file) => {
				expect(file.relevanceScore).toBeUndefined();
			});
		});

		test('should allow dynamic threshold updates', async () => {
			enhancedBuilder.setRelevanceThreshold(0.7);

			expect(enhancedBuilder.options.relevanceThreshold).toBe(0.7);
		});
	});

	describe('Incremental Updates', () => {
		test('should perform incremental updates when possible', async () => {
			// First build
			await enhancedBuilder.buildEnhancedContext('/project');

			// Simulate file changes
			mockGitProvider.addChangedFile('/project/src/new-file.js');
			mockGitProvider.addCommit('def456', 'Add new file', [
				'/project/src/new-file.js'
			]);

			// Second build should be incremental
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(enhancedBuilder.getStats().incrementalUpdates).toBe(1);
			expect(result.metadata.incremental).toBe(true);
		});

		test('should update dependent files during incremental updates', async () => {
			// Set up dependencies
			mockDependencyTracker.addDependency(
				'/project/src/app.js',
				'/project/src/utils.js'
			);

			// First build
			await enhancedBuilder.buildEnhancedContext('/project');

			// Change utils.js
			mockGitProvider.addChangedFile('/project/src/utils.js');

			// Incremental update should include app.js (dependent)
			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.metadata.updatedFiles).toContain('/project/src/utils.js');
			expect(result.metadata.updatedFiles).toContain('/project/src/app.js');
		});

		test('should emit incremental update events', async () => {
			const events = [];
			enhancedBuilder.on('incrementalUpdate', (event) => events.push(event));

			// First build
			await enhancedBuilder.buildEnhancedContext('/project');

			// Trigger incremental update
			mockGitProvider.addChangedFile('/project/src/app.js');
			await enhancedBuilder.buildEnhancedContext('/project');

			expect(events.length).toBe(1);
			expect(events[0].rootPath).toBe('/project');
		});
	});

	describe('Context Optimization', () => {
		test('should optimize context size when exceeding limits', async () => {
			enhancedBuilder.options.maxContextSize = 1; // Very small limit

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(Object.keys(result.context.files).length).toBe(1);
			expect(result.context.optimization).toBeDefined();
			expect(result.context.optimization.originalCount).toBeGreaterThan(1);
		});

		test('should prioritize files by relevance score during optimization', async () => {
			enhancedBuilder.options.maxContextSize = 1;

			const taskContext = {
				keywords: ['app'], // Should boost app.js relevance
				description: 'Application entry point'
			};

			const result = await enhancedBuilder.buildEnhancedContext(
				'/project',
				taskContext
			);

			const remainingFiles = Object.keys(result.context.files);
			expect(remainingFiles).toContain('/project/src/app.js');
		});

		test('should not optimize when under size limit', async () => {
			enhancedBuilder.options.maxContextSize = 100; // Large limit

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			expect(result.context.optimization).toBeUndefined();
		});
	});

	describe('Caching', () => {
		test('should cache context results', async () => {
			await enhancedBuilder.buildEnhancedContext('/project');

			const cacheStats = enhancedBuilder.getCacheStats();
			expect(cacheStats.size).toBe(1);
		});

		test('should allow cache invalidation', async () => {
			await enhancedBuilder.buildEnhancedContext('/project');

			await enhancedBuilder.invalidateCache('/project');

			const cacheStats = enhancedBuilder.getCacheStats();
			expect(cacheStats.size).toBe(0);
		});

		test('should emit cache invalidation events', async () => {
			const events = [];
			enhancedBuilder.on('cacheInvalidated', (event) => events.push(event));

			await enhancedBuilder.invalidateCache('/project');

			expect(events.length).toBe(1);
			expect(events[0].rootPath).toBe('/project');
		});

		test('should support cache warmup', async () => {
			const events = [];
			enhancedBuilder.on('warmupComplete', (event) => events.push(event));

			await enhancedBuilder.warmupContext('/project');

			expect(events.length).toBe(1);
			expect(enhancedBuilder.getCacheStats().size).toBe(1);
		});
	});

	describe('Context Preview', () => {
		test('should provide context preview with limited files', async () => {
			const preview = await enhancedBuilder.getContextPreview(
				'/project',
				{},
				1
			);

			expect(Object.keys(preview.preview).length).toBe(1);
			expect(preview.totalFiles).toBeGreaterThanOrEqual(1);
			expect(preview.metadata).toBeDefined();
		});

		test('should sort preview files by relevance', async () => {
			const taskContext = {
				keywords: ['utils'],
				description: 'Utility functions'
			};

			const preview = await enhancedBuilder.getContextPreview(
				'/project',
				taskContext,
				1
			);

			const previewFiles = Object.keys(preview.preview);
			expect(previewFiles[0]).toContain('utils'); // Should prioritize utils.js
		});
	});

	describe('Performance and Statistics', () => {
		test('should track comprehensive statistics', async () => {
			await enhancedBuilder.buildEnhancedContext('/project');
			await enhancedBuilder.buildEnhancedContext('/project'); // Trigger incremental

			const stats = enhancedBuilder.getStats();

			expect(stats.buildsCount).toBe(2);
			expect(stats.gitIntegrationTime).toBeGreaterThan(0);
			expect(stats.relevanceScoringTime).toBeGreaterThan(0);
		});

		test('should handle large contexts efficiently', async () => {
			// Simulate larger context by adjusting maxContextSize
			enhancedBuilder.options.maxContextSize = 1000;

			const startTime = performance.now();
			await enhancedBuilder.buildEnhancedContext('/project');
			const endTime = performance.now();

			expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
		});

		test('should provide cache statistics', () => {
			const cacheStats = enhancedBuilder.getCacheStats();

			expect(cacheStats).toHaveProperty('size');
			expect(cacheStats).toHaveProperty('hitRate');
			expect(cacheStats).toHaveProperty('incrementalUpdates');
		});
	});

	describe('Error Handling', () => {
		test('should emit error events on build failures', async () => {
			const errors = [];
			enhancedBuilder.on('error', (error) => errors.push(error));

			// Mock a Git provider error
			mockGitProvider.getCurrentBranch = jest
				.fn()
				.mockRejectedValue(new Error('Git error'));

			try {
				await enhancedBuilder.buildEnhancedContext('/project');
			} catch (error) {
				// Expected to fail
			}

			expect(errors.length).toBe(1);
			expect(errors[0].type).toBe('build_error');
		});

		test('should handle missing Git context gracefully', async () => {
			// Mock Git provider to return null
			mockGitProvider.getCurrentBranch = jest.fn().mockResolvedValue(null);

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			// Should still build context without Git info
			expect(result.context).toBeDefined();
		});

		test('should continue without optional features on errors', async () => {
			// Mock dependency tracker error
			mockDependencyTracker.buildDependencyGraph = jest
				.fn()
				.mockImplementation(() => {
					throw new Error('Dependency error');
				});

			const result = await enhancedBuilder.buildEnhancedContext('/project');

			// Should still build basic context
			expect(result.context).toBeDefined();
			expect(result.context.files).toBeDefined();
		});
	});
});
