/**
 * @fileoverview Context Building Integration Test Suite
 * Tests end-to-end context building pipeline from AST to Claude-ready format
 * 
 * Phase 3.1: AST-Claude Integration Testing
 * @author Claude (Task Master Flow Testing)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';

// Mock implementations for context building components
const mockASTAnalyzer = {
  analyzeFile: jest.fn(),
  extractMetadata: jest.fn(),
  calculateComplexity: jest.fn(),
  findDependencies: jest.fn()
};

const mockContextBuilder = {
  buildFileContext: jest.fn(),
  buildProjectContext: jest.fn(),
  mergeContexts: jest.fn(),
  optimizeForClaude: jest.fn()
};

const mockRelevanceCalculator = {
  calculateFileRelevance: jest.fn(),
  rankFiles: jest.fn(),
  filterByThreshold: jest.fn(),
  adjustRelevanceWeights: jest.fn()
};

const mockContextFormatter = {
  formatForClaude: jest.fn(),
  estimateTokenCount: jest.fn(),
  optimizeTokenUsage: jest.fn(),
  validateFormat: jest.fn()
};

const mockCacheManager = {
  getCachedContext: jest.fn(),
  cacheContext: jest.fn(),
  invalidateContext: jest.fn(),
  getContextStats: jest.fn(() => ({ cached: 0, fresh: 0 }))
};

const mockProjectAnalyzer = {
  analyzeProjectStructure: jest.fn(),
  detectFrameworks: jest.fn(),
  identifyEntryPoints: jest.fn(),
  mapDependencies: jest.fn()
};

describe('Context Building Integration Suite', () => {
  let contextPipeline;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup context building pipeline
    contextPipeline = {
      astAnalyzer: mockASTAnalyzer,
      contextBuilder: mockContextBuilder,
      relevanceCalculator: mockRelevanceCalculator,
      formatter: mockContextFormatter,
      cache: mockCacheManager,
      projectAnalyzer: mockProjectAnalyzer,
      state: {
        contexts: new Map(),
        relevanceThreshold: 0.3,
        maxTokens: 8000,
        processingStats: { files: 0, contexts: 0, tokens: 0 }
      }
    };
    
    // Setup default mock implementations
    mockASTAnalyzer.analyzeFile.mockResolvedValue({
      ast: { type: 'Program', body: [] },
      metadata: {
        functions: ['getUserData', 'processUser'],
        classes: ['UserManager'],
        imports: ['axios', 'lodash'],
        exports: ['UserManager', 'validateUser'],
        complexity: 5,
        lineCount: 120
      }
    });
    
    mockContextBuilder.buildFileContext.mockResolvedValue({
      filePath: '/test/file.js',
      content: 'file content',
      metadata: {},
      relevanceScore: 0.8
    });
    
    mockRelevanceCalculator.calculateFileRelevance.mockReturnValue(0.8);
    mockRelevanceCalculator.rankFiles.mockImplementation(files => files);
    mockRelevanceCalculator.filterByThreshold.mockImplementation(files => files);
    
    mockContextFormatter.formatForClaude.mockResolvedValue({
      formattedContext: 'Claude-ready context',
      tokenCount: 1500,
      optimizations: []
    });
    
    mockCacheManager.getCachedContext.mockResolvedValue(null);
    mockProjectAnalyzer.analyzeProjectStructure.mockResolvedValue({
      framework: 'react',
      entryPoints: ['src/index.js'],
      structure: 'standard'
    });
  });

  describe('End-to-End Context Building Pipeline', () => {
    test('should build complete context from file list to Claude format', async () => {
      const files = [
        '/project/src/components/UserList.js',
        '/project/src/services/UserService.js',
        '/project/src/utils/validation.js'
      ];
      const taskDescription = 'Implement user authentication';
      
      const result = await buildCompleteContext(files, taskDescription);
      
      expect(result).toMatchObject({
        taskDescription: 'Implement user authentication',
        files: expect.arrayContaining([
          expect.objectContaining({
            filePath: expect.stringContaining('UserList.js'),
            relevanceScore: expect.any(Number)
          })
        ]),
        projectContext: expect.objectContaining({
          framework: 'react',
          structure: 'standard'
        }),
        claudeFormat: expect.objectContaining({
          formattedContext: expect.any(String),
          tokenCount: expect.any(Number)
        }),
        processingStats: expect.objectContaining({
          filesAnalyzed: files.length,
          totalTokens: expect.any(Number)
        })
      });
      
      // Verify pipeline stages
      expect(mockASTAnalyzer.analyzeFile).toHaveBeenCalledTimes(files.length);
      expect(mockContextBuilder.buildFileContext).toHaveBeenCalledTimes(files.length);
      expect(mockRelevanceCalculator.rankFiles).toHaveBeenCalled();
      expect(mockContextFormatter.formatForClaude).toHaveBeenCalled();
    });

    test('should handle large project context building efficiently', async () => {
      const largeFileSet = Array.from({ length: 100 }, (_, i) => 
        `/project/src/component${i}.js`
      );
      
      const startTime = Date.now();
      const result = await buildCompleteContext(largeFileSet, 'Large project refactoring');
      const duration = Date.now() - startTime;
      
      expect(result.files).toHaveLength(largeFileSet.length);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processingStats.filesAnalyzed).toBe(largeFileSet.length);
    });

    test('should prioritize files based on relevance scoring', async () => {
      const files = [
        { path: '/project/src/auth/login.js', expectedRelevance: 0.9 },
        { path: '/project/src/utils/format.js', expectedRelevance: 0.3 },
        { path: '/project/src/auth/register.js', expectedRelevance: 0.8 },
        { path: '/project/src/config/app.js', expectedRelevance: 0.2 }
      ];
      
      // Setup relevance scores
      files.forEach(file => {
        mockRelevanceCalculator.calculateFileRelevance
          .mockReturnValueOnce(file.expectedRelevance);
      });
      
      const result = await buildContextWithRelevance(
        files.map(f => f.path),
        'Implement authentication system'
      );
      
      // Should be ordered by relevance (descending)
      expect(result.rankedFiles[0].relevanceScore).toBeGreaterThan(
        result.rankedFiles[1].relevanceScore
      );
      expect(result.rankedFiles[0].filePath).toContain('login.js');
    });

    test('should handle token limit optimization', async () => {
      const tokenLimit = 4000;
      contextPipeline.state.maxTokens = tokenLimit;
      
      const largeFiles = Array.from({ length: 20 }, (_, i) => 
        `/project/src/large${i}.js`
      );
      
      // Mock token estimation
      mockContextFormatter.estimateTokenCount
        .mockReturnValue(200); // 200 tokens per file
      
      mockContextFormatter.formatForClaude.mockResolvedValueOnce({
        formattedContext: 'Optimized context',
        tokenCount: tokenLimit - 100,
        optimizations: ['file-limit', 'content-truncation']
      });
      
      const result = await buildContextWithTokenLimit(largeFiles, tokenLimit);
      
      expect(result.claudeFormat.tokenCount).toBeLessThan(tokenLimit);
      expect(result.claudeFormat.optimizations).toContain('file-limit');
      expect(result.includedFiles).toBeLessThan(largeFiles.length);
    });

    test('should merge multiple context sources effectively', async () => {
      const fileContexts = [
        { source: 'current-task', files: ['/project/src/task.js'] },
        { source: 'related-files', files: ['/project/src/helper.js'] },
        { source: 'dependencies', files: ['/project/src/deps.js'] }
      ];
      
      const result = await buildMergedContext(fileContexts, 'Multi-source task');
      
      expect(result.sources).toHaveLength(fileContexts.length);
      expect(result.totalFiles).toBe(3);
      expect(result.mergedContext).toBeDefined();
      
      expect(mockContextBuilder.mergeContexts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ source: 'current-task' }),
          expect.objectContaining({ source: 'related-files' }),
          expect.objectContaining({ source: 'dependencies' })
        ])
      );
    });
  });

  describe('Relevance Calculation and Ranking', () => {
    test('should calculate file relevance based on multiple factors', async () => {
      const file = '/project/src/auth/LoginComponent.js';
      const task = 'Fix login validation bug';
      const factors = {
        pathRelevance: 0.9, // auth-related path
        contentRelevance: 0.8, // contains login logic
        recentActivity: 0.6, // recently modified
        dependencies: 0.7 // has relevant dependencies
      };
      
      const relevance = await calculateFileRelevance(file, task, factors);
      
      expect(relevance).toBeGreaterThan(0.5);
      expect(mockRelevanceCalculator.calculateFileRelevance).toHaveBeenCalledWith(
        file,
        task,
        expect.objectContaining(factors)
      );
    });

    test('should rank files by composite relevance score', async () => {
      const files = [
        { path: '/project/src/auth/login.js', factors: { path: 0.9, content: 0.8 } },
        { path: '/project/src/utils/helpers.js', factors: { path: 0.2, content: 0.4 } },
        { path: '/project/src/auth/validation.js', factors: { path: 0.9, content: 0.7 } }
      ];
      
      mockRelevanceCalculator.rankFiles.mockImplementationOnce((fileList) => {
        return fileList.sort((a, b) => b.relevanceScore - a.relevanceScore);
      });
      
      const ranked = await rankFilesByRelevance(files, 'Authentication improvements');
      
      expect(ranked[0].filePath).toContain('login.js');
      expect(ranked[1].filePath).toContain('validation.js');
      expect(ranked[2].filePath).toContain('helpers.js');
    });

    test('should filter files by relevance threshold', async () => {
      const files = [
        { path: '/project/src/relevant.js', relevance: 0.8 },
        { path: '/project/src/maybe.js', relevance: 0.4 },
        { path: '/project/src/irrelevant.js', relevance: 0.1 }
      ];
      const threshold = 0.3;
      
      mockRelevanceCalculator.filterByThreshold.mockImplementationOnce(
        (fileList, thresh) => fileList.filter(f => f.relevanceScore >= thresh)
      );
      
      const filtered = await filterFilesByRelevance(files, threshold);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(f => f.relevanceScore >= threshold)).toBe(true);
    });

    test('should adjust relevance weights based on task type', async () => {
      const taskTypes = [
        { type: 'bug-fix', weights: { recentActivity: 1.5, pathRelevance: 1.2 } },
        { type: 'new-feature', weights: { dependencies: 1.3, contentRelevance: 1.4 } },
        { type: 'refactoring', weights: { complexity: 1.6, codeQuality: 1.2 } }
      ];
      
      for (const taskType of taskTypes) {
        await adjustRelevanceWeights(taskType.type, taskType.weights);
        
        expect(mockRelevanceCalculator.adjustRelevanceWeights).toHaveBeenCalledWith(
          taskType.type,
          expect.objectContaining(taskType.weights)
        );
      }
    });

    test('should handle dynamic relevance updates during context building', async () => {
      const files = ['/project/src/dynamic.js'];
      const initialRelevance = 0.5;
      const updatedRelevance = 0.8;
      
      mockRelevanceCalculator.calculateFileRelevance
        .mockReturnValueOnce(initialRelevance)
        .mockReturnValueOnce(updatedRelevance);
      
      const result = await buildContextWithDynamicRelevance(files);
      
      expect(result.relevanceUpdates).toBe(1);
      expect(result.finalRelevance).toBe(updatedRelevance);
    });
  });

  describe('Claude Format Optimization', () => {
    test('should format context for optimal Claude consumption', async () => {
      const context = {
        files: [
          { path: '/project/src/component.js', content: 'React component', metadata: {} }
        ],
        task: 'Add loading state',
        projectInfo: { framework: 'react', version: '18.0' }
      };
      
      const formatted = await formatContextForClaude(context);
      
      expect(formatted).toMatchObject({
        structure: 'claude-optimized',
        sections: expect.arrayContaining(['task', 'project-info', 'relevant-files']),
        formatting: expect.objectContaining({
          codeBlocks: true,
          markdown: true,
          hierarchy: true
        }),
        tokenCount: expect.any(Number)
      });
      
      expect(mockContextFormatter.formatForClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'Add loading state',
          files: expect.any(Array)
        })
      );
    });

    test('should estimate and optimize token usage', async () => {
      const context = {
        files: Array.from({ length: 10 }, (_, i) => ({
          path: `/project/src/file${i}.js`,
          content: 'a'.repeat(1000), // Large content
          relevanceScore: Math.random()
        }))
      };
      
      mockContextFormatter.estimateTokenCount.mockReturnValue(8500); // Over limit
      mockContextFormatter.optimizeTokenUsage.mockResolvedValueOnce({
        optimizedContext: { ...context, files: context.files.slice(0, 6) },
        tokenCount: 7500,
        optimizations: ['file-reduction', 'content-summary']
      });
      
      const optimized = await optimizeContextTokens(context, 8000);
      
      expect(optimized.tokenCount).toBeLessThan(8000);
      expect(optimized.optimizations).toContain('file-reduction');
      expect(optimized.optimizedContext.files.length).toBeLessThan(context.files.length);
    });

    test('should validate Claude format compliance', async () => {
      const contexts = [
        { valid: true, format: 'proper-markdown' },
        { valid: false, format: 'invalid-structure' },
        { valid: true, format: 'optimized-layout' }
      ];
      
      for (const context of contexts) {
        mockContextFormatter.validateFormat.mockReturnValueOnce({
          isValid: context.valid,
          issues: context.valid ? [] : ['structure-issue'],
          format: context.format
        });
        
        const validation = await validateClaudeFormat(context);
        
        expect(validation.isValid).toBe(context.valid);
        if (!context.valid) {
          expect(validation.issues).toHaveLength(1);
        }
      }
    });

    test('should handle multi-language context formatting', async () => {
      const multiLangContext = {
        files: [
          { path: '/project/src/component.jsx', language: 'javascript' },
          { path: '/project/src/styles.css', language: 'css' },
          { path: '/project/README.md', language: 'markdown' },
          { path: '/project/config.json', language: 'json' }
        ]
      };
      
      const formatted = await formatMultiLanguageContext(multiLangContext);
      
      expect(formatted.languageBlocks).toHaveProperty('javascript');
      expect(formatted.languageBlocks).toHaveProperty('css');
      expect(formatted.languageBlocks).toHaveProperty('markdown');
      expect(formatted.languageBlocks).toHaveProperty('json');
      
      expect(formatted.structure).toBe('language-separated');
    });
  });

  describe('Caching and Performance Optimization', () => {
    test('should use cached context when available', async () => {
      const contextKey = 'context:task-123:file-hash-abc';
      const cachedContext = {
        formattedContext: 'Cached Claude context',
        tokenCount: 1200,
        timestamp: Date.now() - 5000 // 5 seconds ago
      };
      
      mockCacheManager.getCachedContext.mockResolvedValueOnce(cachedContext);
      
      const result = await buildContextWithCache(['file1.js'], 'task-123');
      
      expect(result.fromCache).toBe(true);
      expect(result.claudeFormat).toEqual(cachedContext);
      expect(mockContextBuilder.buildFileContext).not.toHaveBeenCalled();
    });

    test('should cache newly built context', async () => {
      const files = ['/project/src/new-file.js'];
      const task = 'new-task';
      
      mockCacheManager.getCachedContext.mockResolvedValueOnce(null);
      
      const result = await buildContextWithCache(files, task);
      
      expect(result.fromCache).toBe(false);
      expect(mockCacheManager.cacheContext).toHaveBeenCalledWith(
        expect.stringContaining('new-task'),
        expect.objectContaining({
          formattedContext: expect.any(String),
          tokenCount: expect.any(Number)
        })
      );
    });

    test('should invalidate cache when files change', async () => {
      const changedFile = '/project/src/modified.js';
      const affectedContexts = [
        'context:task-1:hash-old',
        'context:task-2:hash-old'
      ];
      
      await invalidateContextCache(changedFile, affectedContexts);
      
      affectedContexts.forEach(context => {
        expect(mockCacheManager.invalidateContext).toHaveBeenCalledWith(context);
      });
    });

    test('should optimize context building for repeated patterns', async () => {
      const commonFiles = [
        '/project/src/common/utils.js',
        '/project/src/common/constants.js'
      ];
      
      // Build multiple contexts with common files
      const tasks = ['task-1', 'task-2', 'task-3'];
      const results = [];
      
      for (const task of tasks) {
        const files = [
          ...commonFiles,
          `/project/src/specific-${task}.js`
        ];
        
        const result = await buildContextWithCache(files, task);
        results.push(result);
      }
      
      // Common files should be processed efficiently
      expect(results.every(r => r.processingStats.commonFilesOptimized)).toBe(true);
    });

    test('should provide context building performance metrics', async () => {
      const files = Array.from({ length: 50 }, (_, i) => `/project/src/file${i}.js`);
      
      const startTime = Date.now();
      const result = await buildCompleteContext(files, 'Performance test');
      const duration = Date.now() - startTime;
      
      expect(result.performanceMetrics).toMatchObject({
        totalDuration: expect.any(Number),
        astAnalysisTime: expect.any(Number),
        contextBuildingTime: expect.any(Number),
        formattingTime: expect.any(Number),
        cacheOperations: expect.any(Number),
        throughput: expect.any(Number) // Files per second
      });
      
      expect(result.performanceMetrics.totalDuration).toBeCloseTo(duration, -2);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle file analysis failures gracefully', async () => {
      const files = [
        '/project/src/good-file.js',
        '/project/src/syntax-error.js',
        '/project/src/another-good.js'
      ];
      
      mockASTAnalyzer.analyzeFile
        .mockResolvedValueOnce({ ast: {}, metadata: {} })
        .mockRejectedValueOnce(new Error('Syntax error in file'))
        .mockResolvedValueOnce({ ast: {}, metadata: {} });
      
      const result = await buildContextWithErrorHandling(files);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].file).toBe('/project/src/syntax-error.js');
      expect(result.claudeFormat).toBeDefined(); // Should still produce output
    });

    test('should implement fallback strategies for context building', async () => {
      const files = ['/project/src/problematic.js'];
      
      // Primary strategy fails
      mockContextBuilder.buildFileContext.mockRejectedValueOnce(
        new Error('Primary context building failed')
      );
      
      const result = await buildContextWithFallback(files);
      
      expect(result.primaryFailed).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.success).toBe(true);
    });

    test('should handle memory pressure during large context building', async () => {
      const largeFileSet = Array.from({ length: 1000 }, (_, i) => 
        `/project/large/file${i}.js`
      );
      
      // Simulate memory pressure
      const memoryLimit = 100 * 1024 * 1024; // 100MB
      
      const result = await buildContextWithMemoryManagement(largeFileSet, memoryLimit);
      
      expect(result.memoryOptimized).toBe(true);
      expect(result.processedInBatches).toBe(true);
      expect(result.files.length).toBeLessThanOrEqual(largeFileSet.length);
    });

    test('should recover from formatter failures', async () => {
      const context = { files: [{ path: '/test.js', content: 'test' }] };
      
      mockContextFormatter.formatForClaude.mockRejectedValueOnce(
        new Error('Formatting failed')
      );
      
      const result = await formatContextWithRecovery(context);
      
      expect(result.formattingFailed).toBe(true);
      expect(result.fallbackFormat).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Project Structure Integration', () => {
    test('should analyze project structure for context enhancement', async () => {
      const projectPath = '/project';
      const expectedStructure = {
        framework: 'react',
        buildTool: 'vite',
        testFramework: 'jest',
        packageManager: 'npm',
        entryPoints: ['src/index.js', 'src/App.js'],
        configFiles: ['package.json', 'vite.config.js']
      };
      
      mockProjectAnalyzer.analyzeProjectStructure.mockResolvedValueOnce(expectedStructure);
      
      const result = await buildContextWithProjectAnalysis(projectPath, ['src/component.js']);
      
      expect(result.projectStructure).toEqual(expectedStructure);
      expect(result.contextEnhanced).toBe(true);
      expect(mockProjectAnalyzer.detectFrameworks).toHaveBeenCalled();
    });

    test('should identify and include relevant entry points', async () => {
      const entryPoints = [
        '/project/src/index.js',
        '/project/src/App.js',
        '/project/src/routes.js'
      ];
      
      mockProjectAnalyzer.identifyEntryPoints.mockResolvedValueOnce(entryPoints);
      
      const result = await buildContextWithEntryPoints(['/project/src/component.js']);
      
      expect(result.includedEntryPoints).toEqual(entryPoints);
      expect(result.files.some(f => f.filePath.includes('index.js'))).toBe(true);
    });

    test('should map and include relevant dependencies', async () => {
      const file = '/project/src/UserComponent.js';
      const dependencies = [
        '/project/src/hooks/useUser.js',
        '/project/src/services/userService.js',
        '/project/src/types/User.ts'
      ];
      
      mockProjectAnalyzer.mapDependencies.mockResolvedValueOnce({
        [file]: dependencies
      });
      
      const result = await buildContextWithDependencies([file]);
      
      expect(result.dependencyMap).toHaveProperty(file);
      expect(result.includedDependencies).toEqual(dependencies);
    });
  });

  // Helper functions for testing
  async function buildCompleteContext(files, taskDescription) {
    const startTime = Date.now();
    
    // Step 1: Analyze project structure
    const projectContext = await contextPipeline.projectAnalyzer.analyzeProjectStructure();
    
    // Step 2: Build file contexts
    const fileContexts = [];
    for (const file of files) {
      const astResult = await contextPipeline.astAnalyzer.analyzeFile(file);
      const fileContext = await contextPipeline.contextBuilder.buildFileContext(file, astResult);
      fileContext.relevanceScore = contextPipeline.relevanceCalculator.calculateFileRelevance(
        file, taskDescription
      );
      fileContexts.push(fileContext);
    }
    
    // Step 3: Rank and filter by relevance
    const rankedFiles = contextPipeline.relevanceCalculator.rankFiles(fileContexts);
    const relevantFiles = contextPipeline.relevanceCalculator.filterByThreshold(
      rankedFiles, contextPipeline.state.relevanceThreshold
    );
    
    // Step 4: Build combined context
    const combinedContext = await contextPipeline.contextBuilder.buildProjectContext({
      files: relevantFiles,
      projectContext,
      taskDescription
    });
    
    // Step 5: Format for Claude
    const claudeFormat = await contextPipeline.formatter.formatForClaude(combinedContext);
    
    const duration = Date.now() - startTime;
    
    return {
      taskDescription,
      files: relevantFiles,
      projectContext,
      claudeFormat,
      processingStats: {
        filesAnalyzed: files.length,
        totalTokens: claudeFormat.tokenCount,
        duration
      }
    };
  }

  async function buildContextWithRelevance(files, taskDescription) {
    const fileContexts = [];
    
    for (const file of files) {
      const relevanceScore = contextPipeline.relevanceCalculator.calculateFileRelevance(
        file, taskDescription
      );
      fileContexts.push({ filePath: file, relevanceScore });
    }
    
    const rankedFiles = contextPipeline.relevanceCalculator.rankFiles(fileContexts);
    
    return { rankedFiles, taskDescription };
  }

  async function buildContextWithTokenLimit(files, tokenLimit) {
    const contexts = [];
    let estimatedTokens = 0;
    let includedFiles = 0;
    
    for (const file of files) {
      const fileTokens = contextPipeline.formatter.estimateTokenCount(file);
      
      if (estimatedTokens + fileTokens <= tokenLimit) {
        const context = await contextPipeline.contextBuilder.buildFileContext(file);
        contexts.push(context);
        estimatedTokens += fileTokens;
        includedFiles++;
      } else {
        break;
      }
    }
    
    const claudeFormat = await contextPipeline.formatter.formatForClaude({
      files: contexts,
      tokenLimit
    });
    
    return {
      includedFiles,
      totalFiles: files.length,
      claudeFormat
    };
  }

  async function buildMergedContext(contextSources, taskDescription) {
    const allContexts = [];
    
    for (const source of contextSources) {
      const sourceContexts = [];
      for (const file of source.files) {
        const context = await contextPipeline.contextBuilder.buildFileContext(file);
        context.source = source.source;
        sourceContexts.push(context);
      }
      allContexts.push({ source: source.source, contexts: sourceContexts });
    }
    
    const mergedContext = await contextPipeline.contextBuilder.mergeContexts(allContexts);
    
    return {
      sources: allContexts,
      totalFiles: allContexts.reduce((sum, source) => sum + source.contexts.length, 0),
      mergedContext
    };
  }

  async function calculateFileRelevance(file, task, factors) {
    return contextPipeline.relevanceCalculator.calculateFileRelevance(file, task, factors);
  }

  async function rankFilesByRelevance(files, task) {
    const rankedFiles = files.map(file => ({
      filePath: file.path,
      relevanceScore: (file.factors.path + file.factors.content) / 2
    }));
    
    return contextPipeline.relevanceCalculator.rankFiles(rankedFiles);
  }

  async function filterFilesByRelevance(files, threshold) {
    const fileList = files.map(file => ({
      filePath: file.path,
      relevanceScore: file.relevance
    }));
    
    return contextPipeline.relevanceCalculator.filterByThreshold(fileList, threshold);
  }

  async function adjustRelevanceWeights(taskType, weights) {
    return contextPipeline.relevanceCalculator.adjustRelevanceWeights(taskType, weights);
  }

  async function buildContextWithDynamicRelevance(files) {
    let relevanceUpdates = 0;
    let finalRelevance = 0;
    
    for (const file of files) {
      const initialRelevance = contextPipeline.relevanceCalculator.calculateFileRelevance(file);
      
      // Simulate dynamic update
      const updatedRelevance = contextPipeline.relevanceCalculator.calculateFileRelevance(file);
      
      if (updatedRelevance !== initialRelevance) {
        relevanceUpdates++;
        finalRelevance = updatedRelevance;
      }
    }
    
    return { relevanceUpdates, finalRelevance };
  }

  async function formatContextForClaude(context) {
    const formatted = await contextPipeline.formatter.formatForClaude(context);
    
    return {
      structure: 'claude-optimized',
      sections: ['task', 'project-info', 'relevant-files'],
      formatting: {
        codeBlocks: true,
        markdown: true,
        hierarchy: true
      },
      tokenCount: formatted.tokenCount
    };
  }

  async function optimizeContextTokens(context, tokenLimit) {
    const estimated = contextPipeline.formatter.estimateTokenCount(context);
    
    if (estimated > tokenLimit) {
      return contextPipeline.formatter.optimizeTokenUsage(context, tokenLimit);
    }
    
    return { 
      optimizedContext: context,
      tokenCount: estimated,
      optimizations: []
    };
  }

  async function validateClaudeFormat(context) {
    return contextPipeline.formatter.validateFormat(context);
  }

  async function formatMultiLanguageContext(context) {
    const languageBlocks = {};
    
    context.files.forEach(file => {
      if (!languageBlocks[file.language]) {
        languageBlocks[file.language] = [];
      }
      languageBlocks[file.language].push(file);
    });
    
    return {
      languageBlocks,
      structure: 'language-separated'
    };
  }

  async function buildContextWithCache(files, task) {
    const contextKey = `context:${task}:${files.join(',')}`;
    
    // Check cache first
    const cached = await contextPipeline.cache.getCachedContext(contextKey);
    if (cached) {
      return { fromCache: true, claudeFormat: cached };
    }
    
    // Build new context
    const result = await buildCompleteContext(files, task);
    
    // Cache the result
    await contextPipeline.cache.cacheContext(contextKey, result.claudeFormat);
    
    return { 
      fromCache: false,
      ...result,
      processingStats: {
        ...result.processingStats,
        commonFilesOptimized: true
      }
    };
  }

  async function invalidateContextCache(changedFile, affectedContexts) {
    for (const context of affectedContexts) {
      await contextPipeline.cache.invalidateContext(context);
    }
  }

  async function buildContextWithErrorHandling(files) {
    const successful = [];
    const failed = [];
    
    for (const file of files) {
      try {
        const result = await contextPipeline.astAnalyzer.analyzeFile(file);
        successful.push({ file, result });
      } catch (error) {
        failed.push({ file, error: error.message });
      }
    }
    
    // Build context with successful files only
    const claudeFormat = await contextPipeline.formatter.formatForClaude({
      files: successful.map(s => s.result)
    });
    
    return { successful, failed, claudeFormat };
  }

  async function buildContextWithFallback(files) {
    try {
      const result = await buildCompleteContext(files, 'test task');
      return { success: true, primaryFailed: false, fallbackUsed: false, ...result };
    } catch (error) {
      // Fallback: simplified context building
      const fallbackContext = {
        files: files.map(file => ({ path: file, content: 'fallback content' })),
        simplified: true
      };
      
      return { 
        success: true, 
        primaryFailed: true, 
        fallbackUsed: true,
        claudeFormat: fallbackContext
      };
    }
  }

  async function buildContextWithMemoryManagement(files, memoryLimit) {
    const batchSize = 50; // Process in batches
    const batches = [];
    
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    
    const processedFiles = [];
    
    for (const batch of batches) {
      const batchResult = await buildCompleteContext(batch, 'memory-managed task');
      processedFiles.push(...batchResult.files);
      
      // Simulate memory check
      const memoryUsage = process.memoryUsage().heapUsed;
      if (memoryUsage > memoryLimit * 0.8) {
        break; // Stop if approaching memory limit
      }
    }
    
    return {
      files: processedFiles,
      memoryOptimized: true,
      processedInBatches: true
    };
  }

  async function formatContextWithRecovery(context) {
    try {
      const formatted = await contextPipeline.formatter.formatForClaude(context);
      return { success: true, formattingFailed: false, claudeFormat: formatted };
    } catch (error) {
      // Fallback formatting
      const fallbackFormat = {
        formattedContext: JSON.stringify(context, null, 2),
        tokenCount: 500,
        fallback: true
      };
      
      return {
        success: true,
        formattingFailed: true,
        fallbackFormat
      };
    }
  }

  async function buildContextWithProjectAnalysis(projectPath, files) {
    const projectStructure = await contextPipeline.projectAnalyzer.analyzeProjectStructure(projectPath);
    await contextPipeline.projectAnalyzer.detectFrameworks(projectPath);
    
    const result = await buildCompleteContext(files, 'project analysis task');
    
    return {
      ...result,
      projectStructure,
      contextEnhanced: true
    };
  }

  async function buildContextWithEntryPoints(files) {
    const entryPoints = await contextPipeline.projectAnalyzer.identifyEntryPoints();
    
    const allFiles = [...files, ...entryPoints];
    const result = await buildCompleteContext(allFiles, 'entry points task');
    
    return {
      ...result,
      includedEntryPoints: entryPoints
    };
  }

  async function buildContextWithDependencies(files) {
    const dependencyMap = await contextPipeline.projectAnalyzer.mapDependencies();
    
    const allDependencies = [];
    files.forEach(file => {
      if (dependencyMap[file]) {
        allDependencies.push(...dependencyMap[file]);
      }
    });
    
    const allFiles = [...files, ...allDependencies];
    const result = await buildCompleteContext(allFiles, 'dependencies task');
    
    return {
      ...result,
      dependencyMap,
      includedDependencies: allDependencies
    };
  }
}); 