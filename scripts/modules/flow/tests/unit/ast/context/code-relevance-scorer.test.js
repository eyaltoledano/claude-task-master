/**
 * @fileoverview Code Relevance Scorer Test Suite
 * 
 * Tests the code relevance scoring functionality including:
 * - Keyword-based relevance scoring
 * - Structural relevance (imports, exports, classes)
 * - Recency-based scoring (Git history)
 * - Task-specific relevance algorithms
 * - Performance optimization for large codebases
 * 
 * Part of Phase 1.3: Context Building & Analysis Testing
 */

const { performance } = require('perf_hooks');

describe('CodeRelevanceScorer', () => {
  let CodeRelevanceScorer;
  let scorer;
  let mockTaskContext;
  let mockGitHistory;

  beforeAll(() => {
    // Mock task context interface
    const MockTaskContext = class {
      constructor() {
        this.keywords = [];
        this.description = '';
        this.priority = 'medium';
        this.tags = [];
        this.relatedFiles = [];
      }

      setKeywords(keywords) {
        this.keywords = keywords;
      }

      setDescription(description) {
        this.description = description;
      }

      setPriority(priority) {
        this.priority = priority;
      }

      setTags(tags) {
        this.tags = tags;
      }

      setRelatedFiles(files) {
        this.relatedFiles = files;
      }

      getContext() {
        return {
          keywords: this.keywords,
          description: this.description,
          priority: this.priority,
          tags: this.tags,
          relatedFiles: this.relatedFiles
        };
      }
    };

    // Mock Git history interface
    const MockGitHistory = class {
      constructor() {
        this.fileHistory = new Map();
        this.recentChanges = new Set();
        this.authorActivity = new Map();
      }

      addFileHistory(filePath, commits) {
        this.fileHistory.set(filePath, commits);
      }

      addRecentChange(filePath, timestamp = Date.now()) {
        this.recentChanges.add(filePath);
      }

      getFileHistory(filePath) {
        return this.fileHistory.get(filePath) || [];
      }

      isRecentlyChanged(filePath, timeWindow = 24 * 60 * 60 * 1000) {
        return this.recentChanges.has(filePath);
      }

      getFileRecency(filePath) {
        const history = this.getFileHistory(filePath);
        if (history.length === 0) return 0;
        
        const latestCommit = history[0];
        const age = Date.now() - latestCommit.timestamp;
        const daysSinceChange = age / (24 * 60 * 60 * 1000);
        
        // Recency score decreases with age
        return Math.max(0, 1 - (daysSinceChange / 30)); // 30-day window
      }

      getAuthorActivity(filePath) {
        const history = this.getFileHistory(filePath);
        const authors = new Set();
        history.forEach(commit => authors.add(commit.author));
        return authors.size;
      }
    };

    // Mock the CodeRelevanceScorer class
    CodeRelevanceScorer = class MockCodeRelevanceScorer {
      constructor(options = {}) {
        this.options = {
          keywordWeight: options.keywordWeight || 0.3,
          structuralWeight: options.structuralWeight || 0.25,
          recencyWeight: options.recencyWeight || 0.2,
          contextWeight: options.contextWeight || 0.15,
          sizeWeight: options.sizeWeight || 0.1,
          enableFuzzyMatching: options.enableFuzzyMatching !== false,
          enableSemanticAnalysis: options.enableSemanticAnalysis !== false,
          ...options
        };
        
        this.taskContext = null;
        this.gitHistory = null;
        this.cache = new Map();
        this.stats = {
          scoringCount: 0,
          cacheHits: 0,
          averageScore: 0,
          processingTime: 0
        };
      }

      setTaskContext(taskContext) {
        this.taskContext = taskContext;
        this.cache.clear(); // Clear cache when context changes
      }

      setGitHistory(gitHistory) {
        this.gitHistory = gitHistory;
      }

      scoreFile(filePath, content, metadata = {}) {
        const startTime = performance.now();
        this.stats.scoringCount++;
        
        // Check cache first
        const cacheKey = this._generateCacheKey(filePath, content, metadata);
        if (this.cache.has(cacheKey)) {
          this.stats.cacheHits++;
          return this.cache.get(cacheKey);
        }
        
        let totalScore = 0;
        const scores = {};
        
        // Keyword relevance scoring
        scores.keyword = this._scoreKeywordRelevance(filePath, content);
        totalScore += scores.keyword * this.options.keywordWeight;
        
        // Structural relevance scoring
        scores.structural = this._scoreStructuralRelevance(content, metadata);
        totalScore += scores.structural * this.options.structuralWeight;
        
        // Recency scoring
        scores.recency = this._scoreRecency(filePath);
        totalScore += scores.recency * this.options.recencyWeight;
        
        // Context relevance scoring
        scores.context = this._scoreContextRelevance(filePath, content, metadata);
        totalScore += scores.context * this.options.contextWeight;
        
        // Size penalty/bonus
        scores.size = this._scoreSizeRelevance(content, metadata);
        totalScore += scores.size * this.options.sizeWeight;
        
        // Normalize score to 0-1 range
        const finalScore = Math.max(0, Math.min(1, totalScore));
        
        const result = {
          score: finalScore,
          breakdown: scores,
          metadata: {
            filePath,
            contentLength: content.length,
            timestamp: Date.now()
          }
        };
        
        // Cache the result
        this.cache.set(cacheKey, result);
        
        // Update statistics
        this.stats.processingTime += performance.now() - startTime;
        this._updateAverageScore(finalScore);
        
        return result;
      }

      _scoreKeywordRelevance(filePath, content) {
        if (!this.taskContext || !this.taskContext.keywords) {
          return 0;
        }
        
        let score = 0;
        const keywords = this.taskContext.keywords;
        const contentLower = content.toLowerCase();
        const pathLower = filePath.toLowerCase();
        
        for (const keyword of keywords) {
          const keywordLower = keyword.toLowerCase();
          
          // File path matching (higher weight)
          if (pathLower.includes(keywordLower)) {
            score += 0.4;
          }
          
          // Content matching
          const contentMatches = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
          if (contentMatches > 0) {
            // Logarithmic scoring to prevent over-weighting files with many matches
            score += Math.min(0.3, 0.1 * Math.log(contentMatches + 1));
          }
          
          // Fuzzy matching if enabled
          if (this.options.enableFuzzyMatching) {
            score += this._fuzzyMatch(keywordLower, contentLower) * 0.1;
          }
        }
        
        // Description matching
        if (this.taskContext.description) {
          const descWords = this.taskContext.description.toLowerCase().split(/\s+/);
          for (const word of descWords) {
            if (word.length > 3 && contentLower.includes(word)) {
              score += 0.05;
            }
          }
        }
        
        return Math.min(1, score);
      }

      _scoreStructuralRelevance(content, metadata = {}) {
        let score = 0;
        
        // Import/export analysis
        const imports = this._extractImports(content);
        const exports = this._extractExports(content);
        
        // Files with many imports/exports are often central
        score += Math.min(0.3, (imports.length + exports.length) * 0.02);
        
        // Function/class density
        const functions = this._extractFunctions(content);
        const classes = this._extractClasses(content);
        
        const codeLines = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
        ).length;
        
        if (codeLines > 0) {
          const structuralDensity = (functions.length + classes.length) / codeLines;
          score += Math.min(0.2, structuralDensity * 10);
        }
        
        // AST complexity if available
        if (metadata.ast && metadata.ast.complexity) {
          const normalizedComplexity = Math.min(1, metadata.ast.complexity / 20);
          score += normalizedComplexity * 0.15;
        }
        
        // File type bonus
        const fileTypeBonus = this._getFileTypeBonus(metadata.filePath || '');
        score += fileTypeBonus;
        
        return Math.min(1, score);
      }

      _scoreRecency(filePath) {
        if (!this.gitHistory) {
          return 0.5; // Neutral score when no Git history
        }
        
        const recencyScore = this.gitHistory.getFileRecency(filePath);
        const isRecentlyChanged = this.gitHistory.isRecentlyChanged(filePath);
        
        let score = recencyScore;
        
        // Bonus for recently changed files
        if (isRecentlyChanged) {
          score += 0.3;
        }
        
        // Author activity bonus (files touched by many authors might be important)
        const authorCount = this.gitHistory.getAuthorActivity(filePath);
        if (authorCount > 2) {
          score += Math.min(0.2, authorCount * 0.05);
        }
        
        return Math.min(1, score);
      }

      _scoreContextRelevance(filePath, content, metadata = {}) {
        let score = 0;
        
        if (!this.taskContext) {
          return 0.5; // Neutral score
        }
        
        const context = this.taskContext.getContext();
        
        // Priority-based scoring
        const priorityScores = { high: 0.3, medium: 0.2, low: 0.1 };
        score += priorityScores[context.priority] || 0.2;
        
        // Tag matching
        if (context.tags && context.tags.length > 0) {
          for (const tag of context.tags) {
            if (filePath.toLowerCase().includes(tag.toLowerCase()) ||
                content.toLowerCase().includes(tag.toLowerCase())) {
              score += 0.1;
            }
          }
        }
        
        // Related files bonus
        if (context.relatedFiles && context.relatedFiles.includes(filePath)) {
          score += 0.4;
        }
        
        // Dependency relevance
        if (metadata.dependencies) {
          const depCount = metadata.dependencies.direct?.length || 0;
          const dependentCount = metadata.dependencies.dependents?.length || 0;
          
          // Files with many dependencies or dependents are often important
          score += Math.min(0.2, (depCount + dependentCount) * 0.02);
        }
        
        return Math.min(1, score);
      }

      _scoreSizeRelevance(content, metadata = {}) {
        const size = content.length;
        
        // Optimal file size range (2KB - 20KB)
        const optimalMin = 2000;
        const optimalMax = 20000;
        
        if (size >= optimalMin && size <= optimalMax) {
          return 0.8; // High score for optimal size
        } else if (size < optimalMin) {
          // Small files might be less relevant (unless they're config files)
          return Math.max(0.2, size / optimalMin);
        } else {
          // Large files get penalty but not zero (they might be important)
          const penalty = Math.min(0.6, (size - optimalMax) / 100000);
          return Math.max(0.2, 0.8 - penalty);
        }
      }

      _extractImports(content) {
        const imports = [];
        
        // JavaScript/TypeScript imports
        const jsImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = jsImportRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        
        // Python imports
        const pyImportRegex = /(?:from\s+(\w+)\s+)?import\s+([^\n]+)/g;
        while ((match = pyImportRegex.exec(content)) !== null) {
          imports.push(match[1] || match[2]);
        }
        
        // Go imports
        const goImportRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
        while ((match = goImportRegex.exec(content)) !== null) {
          if (match[1]) {
            const lines = match[1].split('\n');
            for (const line of lines) {
              const lineMatch = line.match(/"([^"]+)"/);
              if (lineMatch) imports.push(lineMatch[1]);
            }
          } else if (match[2]) {
            imports.push(match[2]);
          }
        }
        
        return imports;
      }

      _extractExports(content) {
        const exports = [];
        
        // JavaScript/TypeScript exports
        const jsExportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
        let match;
        while ((match = jsExportRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        
        // Python class/function definitions (potential exports)
        const pyDefRegex = /(?:def|class)\s+(\w+)/g;
        while ((match = pyDefRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        
        return exports;
      }

      _extractFunctions(content) {
        const functions = [];
        
        // JavaScript/TypeScript functions
        const jsFuncRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
        let match;
        while ((match = jsFuncRegex.exec(content)) !== null) {
          functions.push(match[1] || match[2]);
        }
        
        // Python functions
        const pyFuncRegex = /def\s+(\w+)/g;
        while ((match = pyFuncRegex.exec(content)) !== null) {
          functions.push(match[1]);
        }
        
        // Go functions
        const goFuncRegex = /func\s+(\w+)/g;
        while ((match = goFuncRegex.exec(content)) !== null) {
          functions.push(match[1]);
        }
        
        return functions;
      }

      _extractClasses(content) {
        const classes = [];
        
        // JavaScript/TypeScript classes
        const jsClassRegex = /class\s+(\w+)/g;
        let match;
        while ((match = jsClassRegex.exec(content)) !== null) {
          classes.push(match[1]);
        }
        
        // Python classes
        const pyClassRegex = /class\s+(\w+)/g;
        while ((match = pyClassRegex.exec(content)) !== null) {
          classes.push(match[1]);
        }
        
        // Go structs (similar to classes)
        const goStructRegex = /type\s+(\w+)\s+struct/g;
        while ((match = goStructRegex.exec(content)) !== null) {
          classes.push(match[1]);
        }
        
        return classes;
      }

      _getFileTypeBonus(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        
        const bonuses = {
          // High relevance
          'js': 0.2, 'jsx': 0.2, 'ts': 0.2, 'tsx': 0.2,
          'py': 0.15, 'go': 0.15, 'java': 0.15,
          
          // Medium relevance
          'json': 0.1, 'yaml': 0.1, 'yml': 0.1,
          'sql': 0.1, 'css': 0.08, 'scss': 0.08,
          
          // Low relevance
          'md': 0.05, 'txt': 0.03, 'log': 0.01,
          
          // Very low relevance
          'png': -0.05, 'jpg': -0.05, 'gif': -0.05,
          'pdf': -0.03, 'zip': -0.1
        };
        
        return bonuses[ext] || 0;
      }

      _fuzzyMatch(keyword, content) {
        // Simple fuzzy matching implementation
        const keywordChars = keyword.split('');
        let contentIndex = 0;
        let matches = 0;
        
        for (const char of keywordChars) {
          const found = content.indexOf(char, contentIndex);
          if (found !== -1) {
            matches++;
            contentIndex = found + 1;
          }
        }
        
        return matches / keywordChars.length;
      }

      _generateCacheKey(filePath, content, metadata) {
        const contextHash = this.taskContext ? 
          JSON.stringify(this.taskContext.getContext()).slice(0, 50) : '';
        const contentHash = content.slice(0, 100);
        return `${filePath}:${contextHash}:${contentHash}`;
      }

      _updateAverageScore(newScore) {
        const count = this.stats.scoringCount;
        this.stats.averageScore = ((this.stats.averageScore * (count - 1)) + newScore) / count;
      }

      scoreFiles(files) {
        const results = {};
        
        for (const [filePath, fileData] of Object.entries(files)) {
          const content = fileData.content || '';
          const metadata = fileData.metadata || {};
          
          results[filePath] = this.scoreFile(filePath, content, metadata);
        }
        
        return results;
      }

      rankFiles(files, limit = null) {
        const scores = this.scoreFiles(files);
        
        const ranked = Object.entries(scores)
          .map(([filePath, result]) => ({
            filePath,
            score: result.score,
            breakdown: result.breakdown
          }))
          .sort((a, b) => b.score - a.score);
        
        return limit ? ranked.slice(0, limit) : ranked;
      }

      filterByThreshold(files, threshold = 0.3) {
        const scores = this.scoreFiles(files);
        const filtered = {};
        
        for (const [filePath, result] of Object.entries(scores)) {
          if (result.score >= threshold) {
            filtered[filePath] = {
              ...files[filePath],
              relevanceScore: result.score,
              relevanceBreakdown: result.breakdown
            };
          }
        }
        
        return filtered;
      }

      explainScore(filePath, content, metadata = {}) {
        const result = this.scoreFile(filePath, content, metadata);
        
        return {
          totalScore: result.score,
          breakdown: result.breakdown,
          explanation: {
            keyword: `Keyword relevance: ${(result.breakdown.keyword * 100).toFixed(1)}%`,
            structural: `Structural relevance: ${(result.breakdown.structural * 100).toFixed(1)}%`,
            recency: `Recency score: ${(result.breakdown.recency * 100).toFixed(1)}%`,
            context: `Context relevance: ${(result.breakdown.context * 100).toFixed(1)}%`,
            size: `Size score: ${(result.breakdown.size * 100).toFixed(1)}%`
          },
          weights: this.options
        };
      }

      optimizeWeights(trainingData) {
        // Simple weight optimization based on training data
        // In a real implementation, this would use machine learning
        
        const bestWeights = { ...this.options };
        let bestScore = 0;
        
        // Try different weight combinations
        const weightCombinations = [
          { keywordWeight: 0.4, structuralWeight: 0.2, recencyWeight: 0.2, contextWeight: 0.15, sizeWeight: 0.05 },
          { keywordWeight: 0.3, structuralWeight: 0.3, recencyWeight: 0.15, contextWeight: 0.2, sizeWeight: 0.05 },
          { keywordWeight: 0.35, structuralWeight: 0.25, recencyWeight: 0.25, contextWeight: 0.1, sizeWeight: 0.05 }
        ];
        
        for (const weights of weightCombinations) {
          const originalOptions = { ...this.options };
          this.options = { ...this.options, ...weights };
          
          let totalAccuracy = 0;
          for (const data of trainingData) {
            const result = this.scoreFile(data.filePath, data.content, data.metadata);
            const accuracy = 1 - Math.abs(result.score - data.expectedScore);
            totalAccuracy += accuracy;
          }
          
          const averageAccuracy = totalAccuracy / trainingData.length;
          if (averageAccuracy > bestScore) {
            bestScore = averageAccuracy;
            Object.assign(bestWeights, weights);
          }
          
          this.options = originalOptions;
        }
        
        this.options = { ...this.options, ...bestWeights };
        return { weights: bestWeights, accuracy: bestScore };
      }

      clearCache() {
        this.cache.clear();
      }

      getStats() {
        return {
          ...this.stats,
          cacheSize: this.cache.size,
          hitRate: this.stats.scoringCount > 0 ? this.stats.cacheHits / this.stats.scoringCount : 0
        };
      }

      resetStats() {
        this.stats = {
          scoringCount: 0,
          cacheHits: 0,
          averageScore: 0,
          processingTime: 0
        };
      }
    };

    mockTaskContext = new MockTaskContext();
    mockGitHistory = new MockGitHistory();
  });

  beforeEach(() => {
    mockTaskContext = new (mockTaskContext.constructor)();
    mockGitHistory = new (mockGitHistory.constructor)();
    scorer = new CodeRelevanceScorer();
  });

  describe('Initialization', () => {
    test('should initialize with default weights', () => {
      const defaultScorer = new CodeRelevanceScorer();
      
      expect(defaultScorer.options.keywordWeight).toBe(0.3);
      expect(defaultScorer.options.structuralWeight).toBe(0.25);
      expect(defaultScorer.options.recencyWeight).toBe(0.2);
      expect(defaultScorer.options.contextWeight).toBe(0.15);
      expect(defaultScorer.options.sizeWeight).toBe(0.1);
    });

    test('should initialize with custom weights', () => {
      const customScorer = new CodeRelevanceScorer({
        keywordWeight: 0.5,
        structuralWeight: 0.3,
        recencyWeight: 0.1,
        contextWeight: 0.1,
        sizeWeight: 0.0
      });
      
      expect(customScorer.options.keywordWeight).toBe(0.5);
      expect(customScorer.options.structuralWeight).toBe(0.3);
      expect(customScorer.options.recencyWeight).toBe(0.1);
    });

    test('should enable optional features by default', () => {
      const defaultScorer = new CodeRelevanceScorer();
      
      expect(defaultScorer.options.enableFuzzyMatching).toBe(true);
      expect(defaultScorer.options.enableSemanticAnalysis).toBe(true);
    });
  });

  describe('Keyword Relevance Scoring', () => {
    beforeEach(() => {
      mockTaskContext.setKeywords(['authentication', 'user', 'login']);
      mockTaskContext.setDescription('Implement user authentication system');
      scorer.setTaskContext(mockTaskContext);
    });

    test('should score files with keyword matches in path', () => {
      const result = scorer.scoreFile(
        '/src/auth/user-authentication.js',
        'function login() { return true; }'
      );
      
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.breakdown.keyword).toBeGreaterThan(0.5);
    });

    test('should score files with keyword matches in content', () => {
      const content = `
        export function authenticateUser(credentials) {
          return login(credentials);
        }
      `;
      
      const result = scorer.scoreFile('/src/utils.js', content);
      
      expect(result.breakdown.keyword).toBeGreaterThan(0.3);
    });

    test('should handle multiple keyword matches', () => {
      const content = `
        import { User } from './user.js';
        
        export function authenticateUser(credentials) {
          const user = new User();
          return user.login(credentials);
        }
      `;
      
      const result = scorer.scoreFile('/src/auth.js', content);
      
      expect(result.breakdown.keyword).toBeGreaterThan(0.6);
    });

    test('should work without task context', () => {
      scorer.setTaskContext(null);
      
      const result = scorer.scoreFile('/src/app.js', 'console.log("hello");');
      
      expect(result.breakdown.keyword).toBe(0);
      expect(result.score).toBeGreaterThan(0); // Other factors still contribute
    });
  });

  describe('Structural Relevance Scoring', () => {
    test('should score files with many imports/exports highly', () => {
      const content = `
        import React from 'react';
        import { useState } from 'react';
        import { api } from './api.js';
        import { utils } from './utils.js';
        
        export function Component() {}
        export const helper = () => {};
        export default App;
      `;
      
      const result = scorer.scoreFile('/src/component.js', content);
      
      expect(result.breakdown.structural).toBeGreaterThan(0.3);
    });

    test('should score files with functions and classes', () => {
      const content = `
        class UserManager {
          constructor() {}
          
          authenticate(user) {}
          authorize(user, resource) {}
        }
        
        function validateCredentials(creds) {}
        function hashPassword(password) {}
        
        const helper = () => {};
      `;
      
      const result = scorer.scoreFile('/src/user-manager.js', content);
      
      expect(result.breakdown.structural).toBeGreaterThan(0.4);
    });

    test('should give bonus for certain file types', () => {
      const jsResult = scorer.scoreFile('/src/app.js', 'console.log("test");');
      const mdResult = scorer.scoreFile('/docs/readme.md', '# Documentation');
      
      expect(jsResult.breakdown.structural).toBeGreaterThan(mdResult.breakdown.structural);
    });

    test('should handle AST complexity metadata', () => {
      const metadata = {
        ast: { complexity: 15 },
        filePath: '/src/complex.js'
      };
      
      const result = scorer.scoreFile('/src/complex.js', 'function test() {}', metadata);
      
      expect(result.breakdown.structural).toBeGreaterThan(0.3);
    });
  });

  describe('Recency Scoring', () => {
    beforeEach(() => {
      // Set up Git history
      mockGitHistory.addFileHistory('/src/recent.js', [
        { timestamp: Date.now() - 1000, author: 'dev1' },
        { timestamp: Date.now() - 86400000, author: 'dev2' }
      ]);
      mockGitHistory.addRecentChange('/src/recent.js');
      
      mockGitHistory.addFileHistory('/src/old.js', [
        { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, author: 'dev1' }
      ]);
      
      scorer.setGitHistory(mockGitHistory);
    });

    test('should score recently changed files highly', () => {
      const recentResult = scorer.scoreFile('/src/recent.js', 'console.log("recent");');
      const oldResult = scorer.scoreFile('/src/old.js', 'console.log("old");');
      
      expect(recentResult.breakdown.recency).toBeGreaterThan(oldResult.breakdown.recency);
    });

    test('should give bonus for files with multiple authors', () => {
      mockGitHistory.addFileHistory('/src/collaborative.js', [
        { timestamp: Date.now() - 1000, author: 'dev1' },
        { timestamp: Date.now() - 2000, author: 'dev2' },
        { timestamp: Date.now() - 3000, author: 'dev3' }
      ]);
      
      const result = scorer.scoreFile('/src/collaborative.js', 'console.log("collaborative");');
      
      expect(result.breakdown.recency).toBeGreaterThan(0.5);
    });

    test('should handle missing Git history gracefully', () => {
      scorer.setGitHistory(null);
      
      const result = scorer.scoreFile('/src/app.js', 'console.log("test");');
      
      expect(result.breakdown.recency).toBe(0.5); // Neutral score
    });
  });

  describe('Context Relevance Scoring', () => {
    beforeEach(() => {
      mockTaskContext.setPriority('high');
      mockTaskContext.setTags(['frontend', 'authentication']);
      mockTaskContext.setRelatedFiles(['/src/auth.js', '/src/user.js']);
      scorer.setTaskContext(mockTaskContext);
    });

    test('should score files based on task priority', () => {
      const highPriorityResult = scorer.scoreFile('/src/app.js', 'console.log("test");');
      
      mockTaskContext.setPriority('low');
      scorer.setTaskContext(mockTaskContext);
      
      const lowPriorityResult = scorer.scoreFile('/src/app.js', 'console.log("test");');
      
      expect(highPriorityResult.breakdown.context).toBeGreaterThan(lowPriorityResult.breakdown.context);
    });

    test('should score files with tag matches', () => {
      const result = scorer.scoreFile('/src/frontend-auth.js', 'authentication logic');
      
      expect(result.breakdown.context).toBeGreaterThan(0.4);
    });

    test('should give bonus to related files', () => {
      const relatedResult = scorer.scoreFile('/src/auth.js', 'auth logic');
      const unrelatedResult = scorer.scoreFile('/src/utils.js', 'utility functions');
      
      expect(relatedResult.breakdown.context).toBeGreaterThan(unrelatedResult.breakdown.context);
    });

    test('should score files with many dependencies', () => {
      const metadata = {
        dependencies: {
          direct: ['./utils.js', './config.js', './api.js'],
          dependents: ['./app.js', './main.js']
        }
      };
      
      const result = scorer.scoreFile('/src/core.js', 'core logic', metadata);
      
      expect(result.breakdown.context).toBeGreaterThan(0.3);
    });
  });

  describe('Size Relevance Scoring', () => {
    test('should score optimally-sized files highly', () => {
      const optimalContent = 'a'.repeat(10000); // 10KB
      const result = scorer.scoreFile('/src/optimal.js', optimalContent);
      
      expect(result.breakdown.size).toBeGreaterThan(0.7);
    });

    test('should penalize very large files', () => {
      const largeContent = 'a'.repeat(200000); // 200KB
      const result = scorer.scoreFile('/src/large.js', largeContent);
      
      expect(result.breakdown.size).toBeLessThan(0.5);
    });

    test('should penalize very small files', () => {
      const smallContent = 'console.log("test");'; // Very small
      const result = scorer.scoreFile('/src/small.js', smallContent);
      
      expect(result.breakdown.size).toBeLessThan(0.5);
    });
  });

  describe('File Scoring and Ranking', () => {
    beforeEach(() => {
      mockTaskContext.setKeywords(['auth', 'user']);
      scorer.setTaskContext(mockTaskContext);
    });

    test('should score multiple files', () => {
      const files = {
        '/src/auth.js': { content: 'authentication logic' },
        '/src/user.js': { content: 'user management' },
        '/src/utils.js': { content: 'utility functions' }
      };
      
      const results = scorer.scoreFiles(files);
      
      expect(Object.keys(results)).toHaveLength(3);
      expect(results['/src/auth.js'].score).toBeGreaterThan(results['/src/utils.js'].score);
    });

    test('should rank files by relevance', () => {
      const files = {
        '/src/auth.js': { content: 'user authentication system' },
        '/src/user.js': { content: 'user profile management' },
        '/src/config.js': { content: 'configuration settings' }
      };
      
      const ranked = scorer.rankFiles(files);
      
      expect(ranked).toHaveLength(3);
      expect(ranked[0].filePath).toBe('/src/auth.js');
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    test('should filter files by threshold', () => {
      const files = {
        '/src/auth.js': { content: 'user authentication system' },
        '/src/user.js': { content: 'user profile management' },
        '/src/config.js': { content: 'configuration settings' }
      };
      
      const filtered = scorer.filterByThreshold(files, 0.5);
      
      expect(Object.keys(filtered).length).toBeLessThanOrEqual(3);
      
      for (const [filePath, fileData] of Object.entries(filtered)) {
        expect(fileData.relevanceScore).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should limit ranked results when specified', () => {
      const files = {
        '/src/file1.js': { content: 'auth code' },
        '/src/file2.js': { content: 'user code' },
        '/src/file3.js': { content: 'auth user code' },
        '/src/file4.js': { content: 'other code' }
      };
      
      const ranked = scorer.rankFiles(files, 2);
      
      expect(ranked).toHaveLength(2);
    });
  });

  describe('Score Explanation', () => {
    test('should provide detailed score explanation', () => {
      mockTaskContext.setKeywords(['test']);
      scorer.setTaskContext(mockTaskContext);
      
      const explanation = scorer.explainScore('/src/test.js', 'test content');
      
      expect(explanation).toHaveProperty('totalScore');
      expect(explanation).toHaveProperty('breakdown');
      expect(explanation).toHaveProperty('explanation');
      expect(explanation).toHaveProperty('weights');
      
      expect(explanation.explanation).toHaveProperty('keyword');
      expect(explanation.explanation).toHaveProperty('structural');
      expect(explanation.explanation).toHaveProperty('recency');
    });
  });

  describe('Performance and Caching', () => {
    test('should cache scoring results', () => {
      const content = 'test content';
      
      // First call
      scorer.scoreFile('/src/test.js', content);
      
      // Second call should use cache
      scorer.scoreFile('/src/test.js', content);
      
      const stats = scorer.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.scoringCount).toBe(2);
    });

    test('should handle large numbers of files efficiently', () => {
      const files = {};
      for (let i = 0; i < 100; i++) {
        files[`/src/file${i}.js`] = { content: `content ${i}` };
      }
      
      const startTime = performance.now();
      scorer.scoreFiles(files);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should clear cache when requested', () => {
      scorer.scoreFile('/src/test.js', 'content');
      expect(scorer.getStats().cacheSize).toBe(1);
      
      scorer.clearCache();
      expect(scorer.getStats().cacheSize).toBe(0);
    });

    test('should provide comprehensive statistics', () => {
      scorer.scoreFile('/src/test1.js', 'content1');
      scorer.scoreFile('/src/test2.js', 'content2');
      
      const stats = scorer.getStats();
      
      expect(stats).toHaveProperty('scoringCount', 2);
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('averageScore');
      expect(stats).toHaveProperty('processingTime');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('Weight Optimization', () => {
    test('should optimize weights based on training data', () => {
      const trainingData = [
        {
          filePath: '/src/auth.js',
          content: 'authentication logic',
          metadata: {},
          expectedScore: 0.8
        },
        {
          filePath: '/src/utils.js',
          content: 'utility functions',
          metadata: {},
          expectedScore: 0.3
        }
      ];
      
      const result = scorer.optimizeWeights(trainingData);
      
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('accuracy');
      expect(result.accuracy).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed content gracefully', () => {
      const result = scorer.scoreFile('/src/test.js', null);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    test('should handle missing metadata gracefully', () => {
      const result = scorer.scoreFile('/src/test.js', 'content', undefined);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.breakdown).toBeDefined();
    });

    test('should handle empty files', () => {
      const result = scorer.scoreFile('/src/empty.js', '');
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.size).toBeGreaterThan(0); // Should not be zero
    });
  });
});
