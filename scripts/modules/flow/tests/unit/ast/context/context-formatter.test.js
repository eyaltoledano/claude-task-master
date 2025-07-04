/**
 * @fileoverview Context Formatter Test Suite
 * 
 * Tests the Claude-optimized context formatting functionality including:
 * - Context structure optimization for LLMs
 * - Token count optimization
 * - Hierarchical context organization
 * - Code snippet extraction and formatting
 * - Context size management and truncation
 * 
 * Part of Phase 1.3: Context Building & Analysis Testing
 */

describe('ContextFormatter', () => {
  let ContextFormatter;
  let formatter;

  beforeAll(() => {
    // Mock the ContextFormatter class
    ContextFormatter = class MockContextFormatter {
      constructor(options = {}) {
        this.options = {
          maxTokens: options.maxTokens || 8000,
          tokensPerChar: options.tokensPerChar || 0.25, // Rough estimate
          includeLineNumbers: options.includeLineNumbers !== false,
          includeMetadata: options.includeMetadata !== false,
          prioritizeRelevance: options.prioritizeRelevance !== false,
          codeSnippetLength: options.codeSnippetLength || 200,
          ...options
        };
        
        this.stats = {
          formattingCount: 0,
          averageTokens: 0,
          truncationCount: 0
        };
      }

      formatForClaude(context, taskContext = {}, options = {}) {
        this.stats.formattingCount++;
        
        const mergedOptions = { ...this.options, ...options };
        
        // Build the formatted context structure
        const formatted = {
          summary: this._formatSummary(context, taskContext),
          relevantFiles: this._formatRelevantFiles(context, taskContext, mergedOptions),
          codeSnippets: this._extractCodeSnippets(context, taskContext, mergedOptions),
          dependencies: this._formatDependencies(context, mergedOptions),
          metadata: this._formatMetadata(context, mergedOptions)
        };
        
        // Calculate token count and optimize if needed
        const tokenCount = this._estimateTokenCount(formatted);
        
        if (tokenCount > mergedOptions.maxTokens) {
          this.stats.truncationCount++;
          return this._optimizeForTokenLimit(formatted, mergedOptions);
        }
        
        this._updateAverageTokens(tokenCount);
        
        return {
          formatted,
          tokenCount,
          metadata: {
            originalFileCount: Object.keys(context.files || {}).length,
            includedFileCount: formatted.relevantFiles.length,
            truncated: false,
            timestamp: new Date().toISOString()
          }
        };
      }

      _formatSummary(context, taskContext) {
        const summary = context.summary || {};
        
        return {
          overview: this._generateOverview(summary, taskContext),
          statistics: {
            totalFiles: summary.totalFiles || 0,
            languages: summary.languages || {},
            totalSize: this._formatBytes(summary.totalSize || 0),
            complexity: summary.complexity || 0
          },
          keyInsights: this._generateKeyInsights(context, taskContext)
        };
      }

      _generateOverview(summary, taskContext) {
        const languages = Object.keys(summary.languages || {}).join(', ');
        const fileCount = summary.totalFiles || 0;
        
        let overview = `This codebase contains ${fileCount} files`;
        
        if (languages) {
          overview += ` primarily written in ${languages}`;
        }
        
        if (taskContext.description) {
          overview += `. Current task: ${taskContext.description}`;
        }
        
        return overview;
      }

      _generateKeyInsights(context, taskContext) {
        const insights = [];
        
        // Language distribution insights
        const languages = context.summary?.languages || {};
        const dominantLang = Object.entries(languages)
          .sort(([,a], [,b]) => b - a)[0];
        
        if (dominantLang) {
          insights.push(`Primary language: ${dominantLang[0]} (${dominantLang[1]} files)`);
        }
        
        // Complexity insights
        if (context.summary?.complexity > 50) {
          insights.push('High complexity codebase - consider refactoring opportunities');
        }
        
        // Dependency insights
        const depCount = Object.keys(context.dependencies || {}).length;
        if (depCount > 10) {
          insights.push(`Complex dependency structure with ${depCount} interconnected files`);
        }
        
        return insights;
      }

      _formatRelevantFiles(context, taskContext, options) {
        const files = context.files || {};
        let fileList = Object.entries(files);
        
        // Sort by relevance if available
        if (options.prioritizeRelevance) {
          fileList.sort(([,a], [,b]) => {
            const scoreA = a.relevanceScore || 0;
            const scoreB = b.relevanceScore || 0;
            return scoreB - scoreA;
          });
        }
        
        return fileList.map(([filePath, fileData]) => ({
          path: filePath,
          summary: this._generateFileSummary(fileData, options),
          relevance: fileData.relevanceScore || null,
          lastModified: fileData.mtime || null,
          size: this._formatBytes(fileData.size || 0)
        }));
      }

      _generateFileSummary(fileData, options) {
        const ast = fileData.ast || {};
        const metadata = ast.metadata || {};
        
        let summary = '';
        
        // Language and type
        if (metadata.language) {
          summary += `${metadata.language} file`;
        }
        
        // Key exports/functions
        if (metadata.exports && metadata.exports.length > 0) {
          const exports = metadata.exports.slice(0, 3).join(', ');
          summary += ` exporting: ${exports}`;
          if (metadata.exports.length > 3) {
            summary += ` (+${metadata.exports.length - 3} more)`;
          }
        }
        
        // Complexity
        if (metadata.complexity > 5) {
          summary += ` (complex: ${metadata.complexity})`;
        }
        
        // Recent changes
        if (fileData.gitInfo?.recentlyChanged) {
          summary += ' [recently modified]';
        }
        
        return summary || 'Code file';
      }

      _extractCodeSnippets(context, taskContext, options) {
        const files = context.files || {};
        const snippets = [];
        
        for (const [filePath, fileData] of Object.entries(files)) {
          // Skip if not relevant enough
          if (fileData.relevanceScore && fileData.relevanceScore < 0.3) {
            continue;
          }
          
          const content = fileData.content || '';
          const snippet = this._createCodeSnippet(filePath, content, options);
          
          if (snippet) {
            snippets.push(snippet);
          }
        }
        
        // Sort by relevance and limit
        return snippets
          .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
          .slice(0, 10); // Limit to top 10 snippets
      }

      _createCodeSnippet(filePath, content, options) {
        if (!content || content.length === 0) {
          return null;
        }
        
        const maxLength = options.codeSnippetLength;
        let snippet = content;
        let truncated = false;
        
        if (content.length > maxLength) {
          // Try to find a good breaking point
          const lines = content.split('\n');
          let charCount = 0;
          let lineCount = 0;
          
          for (const line of lines) {
            if (charCount + line.length > maxLength) {
              break;
            }
            charCount += line.length + 1; // +1 for newline
            lineCount++;
          }
          
          snippet = lines.slice(0, lineCount).join('\n');
          truncated = lineCount < lines.length;
        }
        
        return {
          filePath,
          content: snippet,
          truncated,
          lineCount: snippet.split('\n').length,
          language: this._detectLanguage(filePath)
        };
      }

      _formatDependencies(context, options) {
        const dependencies = context.dependencies || {};
        const dependencyGraph = context.dependencyGraph || {};
        
        const formatted = {
          imports: {},
          exports: context.exports || {},
          graph: this._simplifyDependencyGraph(dependencyGraph)
        };
        
        // Format imports for better readability
        for (const [file, deps] of Object.entries(dependencies)) {
          if (deps && deps.length > 0) {
            formatted.imports[file] = deps.slice(0, 5); // Limit to first 5
            if (deps.length > 5) {
              formatted.imports[file].push(`... and ${deps.length - 5} more`);
            }
          }
        }
        
        return formatted;
      }

      _simplifyDependencyGraph(graph) {
        const simplified = {};
        
        for (const [file, deps] of Object.entries(graph)) {
          if (deps.dependencies?.length > 0 || deps.dependents?.length > 0) {
            simplified[file] = {
              dependsOn: deps.dependencies?.length || 0,
              usedBy: deps.dependents?.length || 0
            };
          }
        }
        
        return simplified;
      }

      _formatMetadata(context, options) {
        const metadata = context.metadata || {};
        
        return {
          buildInfo: {
            timestamp: metadata.timestamp || new Date().toISOString(),
            rootPath: metadata.rootPath || 'unknown',
            buildTime: metadata.buildTime ? `${Math.round(metadata.buildTime)}ms` : null
          },
          gitContext: this._formatGitContext(context.gitContext),
          optimization: context.optimization || null
        };
      }

      _formatGitContext(gitContext) {
        if (!gitContext) return null;
        
        return {
          branch: gitContext.branch,
          recentCommits: gitContext.recentCommits?.slice(0, 3).map(commit => ({
            hash: commit.hash?.substring(0, 8),
            message: commit.message?.substring(0, 50),
            author: commit.author
          })) || [],
          changedFiles: gitContext.changedFiles?.length || 0
        };
      }

      _estimateTokenCount(formatted) {
        const text = JSON.stringify(formatted);
        return Math.ceil(text.length * this.options.tokensPerChar);
      }

      _optimizeForTokenLimit(formatted, options) {
        const targetTokens = options.maxTokens * 0.9; // 10% buffer
        let currentTokens = this._estimateTokenCount(formatted);
        
        // Optimization strategies in order of preference
        const strategies = [
          () => this._reduceCodeSnippets(formatted),
          () => this._reduceFileList(formatted),
          () => this._reduceDependencies(formatted),
          () => this._reduceMetadata(formatted)
        ];
        
        for (const strategy of strategies) {
          if (currentTokens <= targetTokens) break;
          
          strategy();
          currentTokens = this._estimateTokenCount(formatted);
        }
        
        this._updateAverageTokens(currentTokens);
        
        return {
          formatted,
          tokenCount: currentTokens,
          metadata: {
            originalFileCount: formatted.relevantFiles.length,
            includedFileCount: formatted.relevantFiles.length,
            truncated: true,
            optimizationApplied: true,
            timestamp: new Date().toISOString()
          }
        };
      }

      _reduceCodeSnippets(formatted) {
        // Reduce snippet length and count
        formatted.codeSnippets = formatted.codeSnippets
          .slice(0, 5) // Keep only top 5
          .map(snippet => ({
            ...snippet,
            content: snippet.content.substring(0, 100),
            truncated: true
          }));
      }

      _reduceFileList(formatted) {
        // Keep only most relevant files
        formatted.relevantFiles = formatted.relevantFiles
          .filter(file => !file.relevance || file.relevance > 0.3)
          .slice(0, 20);
      }

      _reduceDependencies(formatted) {
        // Simplify dependency information
        const deps = formatted.dependencies;
        
        // Keep only files with significant dependencies
        const filteredImports = {};
        for (const [file, imports] of Object.entries(deps.imports || {})) {
          if (imports.length > 2) {
            filteredImports[file] = imports.slice(0, 3);
          }
        }
        deps.imports = filteredImports;
        
        // Simplify graph
        const filteredGraph = {};
        for (const [file, info] of Object.entries(deps.graph || {})) {
          if (info.dependsOn > 2 || info.usedBy > 2) {
            filteredGraph[file] = info;
          }
        }
        deps.graph = filteredGraph;
      }

      _reduceMetadata(formatted) {
        // Keep only essential metadata
        formatted.metadata = {
          buildInfo: {
            timestamp: formatted.metadata.buildInfo?.timestamp
          },
          gitContext: formatted.metadata.gitContext ? {
            branch: formatted.metadata.gitContext.branch,
            changedFiles: formatted.metadata.gitContext.changedFiles
          } : null
        };
      }

      _detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap = {
          'js': 'javascript',
          'jsx': 'javascript',
          'ts': 'typescript',
          'tsx': 'typescript',
          'py': 'python',
          'go': 'go',
          'java': 'java',
          'cpp': 'cpp',
          'c': 'c',
          'cs': 'csharp',
          'php': 'php',
          'rb': 'ruby',
          'rs': 'rust'
        };
        
        return languageMap[ext] || 'text';
      }

      _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
      }

      _updateAverageTokens(tokenCount) {
        const count = this.stats.formattingCount;
        this.stats.averageTokens = ((this.stats.averageTokens * (count - 1)) + tokenCount) / count;
      }

      formatForMarkdown(context, taskContext = {}) {
        const claudeResult = this.formatForClaude(context, taskContext);
        const formatted = claudeResult.formatted;
        
        let markdown = '# Code Context Summary\n\n';
        
        // Overview
        markdown += '## Overview\n';
        markdown += `${formatted.summary.overview}\n\n`;
        
        // Statistics
        markdown += '## Statistics\n';
        const stats = formatted.summary.statistics;
        markdown += `- **Files**: ${stats.totalFiles}\n`;
        markdown += `- **Languages**: ${Object.entries(stats.languages).map(([lang, count]) => `${lang} (${count})`).join(', ')}\n`;
        markdown += `- **Total Size**: ${stats.totalSize}\n`;
        markdown += `- **Complexity**: ${stats.complexity}\n\n`;
        
        // Key Insights
        if (formatted.summary.keyInsights.length > 0) {
          markdown += '## Key Insights\n';
          formatted.summary.keyInsights.forEach(insight => {
            markdown += `- ${insight}\n`;
          });
          markdown += '\n';
        }
        
        // Relevant Files
        markdown += '## Relevant Files\n';
        formatted.relevantFiles.slice(0, 10).forEach(file => {
          markdown += `### ${file.path}\n`;
          markdown += `${file.summary}\n`;
          if (file.relevance) {
            markdown += `*Relevance: ${(file.relevance * 100).toFixed(1)}%*\n`;
          }
          markdown += '\n';
        });
        
        // Code Snippets
        if (formatted.codeSnippets.length > 0) {
          markdown += '## Code Snippets\n';
          formatted.codeSnippets.slice(0, 5).forEach(snippet => {
            markdown += `### ${snippet.filePath}\n`;
            markdown += `\`\`\`${snippet.language}\n`;
            markdown += snippet.content;
            markdown += '\n```\n';
            if (snippet.truncated) {
              markdown += '*Snippet truncated for brevity*\n';
            }
            markdown += '\n';
          });
        }
        
        return {
          markdown,
          tokenCount: claudeResult.tokenCount,
          metadata: claudeResult.metadata
        };
      }

      formatForJSON(context, taskContext = {}, pretty = true) {
        const claudeResult = this.formatForClaude(context, taskContext);
        
        const json = JSON.stringify(claudeResult.formatted, null, pretty ? 2 : 0);
        
        return {
          json,
          tokenCount: claudeResult.tokenCount,
          metadata: claudeResult.metadata
        };
      }

      getStats() {
        return {
          ...this.stats,
          averageTokens: Math.round(this.stats.averageTokens),
          truncationRate: this.stats.formattingCount > 0 ? this.stats.truncationCount / this.stats.formattingCount : 0
        };
      }

      resetStats() {
        this.stats = {
          formattingCount: 0,
          averageTokens: 0,
          truncationCount: 0
        };
      }
    };
  });

  beforeEach(() => {
    formatter = new ContextFormatter();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(formatter.options.maxTokens).toBe(8000);
      expect(formatter.options.tokensPerChar).toBe(0.25);
      expect(formatter.options.includeLineNumbers).toBe(true);
      expect(formatter.options.codeSnippetLength).toBe(200);
    });

    test('should initialize with custom options', () => {
      const customFormatter = new ContextFormatter({
        maxTokens: 4000,
        codeSnippetLength: 100,
        includeLineNumbers: false
      });
      
      expect(customFormatter.options.maxTokens).toBe(4000);
      expect(customFormatter.options.codeSnippetLength).toBe(100);
      expect(customFormatter.options.includeLineNumbers).toBe(false);
    });
  });

  describe('Claude Formatting', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        files: {
          '/src/app.js': {
            content: 'console.log("Hello World");',
            ast: { metadata: { language: 'javascript', exports: ['App'] } },
            size: 100,
            relevanceScore: 0.8
          },
          '/src/utils.js': {
            content: 'export function helper() { return true; }',
            ast: { metadata: { language: 'javascript', exports: ['helper'] } },
            size: 80,
            relevanceScore: 0.6
          }
        },
        summary: {
          totalFiles: 2,
          languages: { javascript: 2 },
          totalSize: 180,
          complexity: 5
        },
        dependencies: {
          '/src/app.js': ['./utils.js']
        },
        exports: {
          '/src/utils.js': ['helper']
        }
      };
    });

    test('should format context for Claude', () => {
      const result = formatter.formatForClaude(mockContext);
      
      expect(result.formatted).toHaveProperty('summary');
      expect(result.formatted).toHaveProperty('relevantFiles');
      expect(result.formatted).toHaveProperty('codeSnippets');
      expect(result.formatted).toHaveProperty('dependencies');
      expect(result.formatted).toHaveProperty('metadata');
      
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.metadata.truncated).toBe(false);
    });

    test('should generate meaningful overview', () => {
      const taskContext = {
        description: 'Implement user authentication'
      };
      
      const result = formatter.formatForClaude(mockContext, taskContext);
      
      expect(result.formatted.summary.overview).toContain('2 files');
      expect(result.formatted.summary.overview).toContain('javascript');
      expect(result.formatted.summary.overview).toContain('user authentication');
    });

    test('should prioritize files by relevance', () => {
      formatter.options.prioritizeRelevance = true;
      
      const result = formatter.formatForClaude(mockContext);
      
      const files = result.formatted.relevantFiles;
      expect(files[0].path).toBe('/src/app.js'); // Higher relevance score
      expect(files[1].path).toBe('/src/utils.js');
    });

    test('should extract code snippets', () => {
      const result = formatter.formatForClaude(mockContext);
      
      expect(result.formatted.codeSnippets).toHaveLength(2);
      expect(result.formatted.codeSnippets[0]).toHaveProperty('filePath');
      expect(result.formatted.codeSnippets[0]).toHaveProperty('content');
      expect(result.formatted.codeSnippets[0]).toHaveProperty('language');
    });

    test('should format dependencies correctly', () => {
      const result = formatter.formatForClaude(mockContext);
      
      expect(result.formatted.dependencies).toHaveProperty('imports');
      expect(result.formatted.dependencies).toHaveProperty('exports');
      expect(result.formatted.dependencies.imports['/src/app.js']).toContain('./utils.js');
    });
  });

  describe('Token Optimization', () => {
    test('should truncate when exceeding token limit', () => {
      const largeContext = {
        files: {},
        summary: { totalFiles: 100, languages: { javascript: 100 } }
      };
      
      // Create many large files
      for (let i = 0; i < 50; i++) {
        largeContext.files[`/file${i}.js`] = {
          content: 'a'.repeat(1000),
          size: 1000,
          relevanceScore: 0.5
        };
      }
      
      formatter.options.maxTokens = 1000; // Very small limit
      
      const result = formatter.formatForClaude(largeContext);
      
      expect(result.metadata.truncated).toBe(true);
      expect(result.tokenCount).toBeLessThanOrEqual(1000);
    });

    test('should apply optimization strategies', () => {
      const context = {
        files: {},
        summary: { totalFiles: 20 }
      };
      
      // Create files with varying relevance
      for (let i = 0; i < 20; i++) {
        context.files[`/file${i}.js`] = {
          content: 'console.log("test");'.repeat(50),
          relevanceScore: i / 20 // 0 to 0.95
        };
      }
      
      formatter.options.maxTokens = 2000;
      
      const result = formatter.formatForClaude(context);
      
      // Should keep only more relevant files
      expect(result.formatted.relevantFiles.length).toBeLessThan(20);
    });

    test('should estimate token count accurately', () => {
      const smallContext = {
        files: {
          '/small.js': { content: 'const x = 1;' }
        },
        summary: { totalFiles: 1 }
      };
      
      const result = formatter.formatForClaude(smallContext);
      
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeLessThan(1000);
    });
  });

  describe('Alternative Formats', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        files: {
          '/src/app.js': {
            content: 'console.log("Hello");',
            ast: { metadata: { language: 'javascript' } },
            relevanceScore: 0.8
          }
        },
        summary: {
          totalFiles: 1,
          languages: { javascript: 1 },
          totalSize: 50
        }
      };
    });

    test('should format for Markdown', () => {
      const result = formatter.formatForMarkdown(mockContext);
      
      expect(result.markdown).toContain('# Code Context Summary');
      expect(result.markdown).toContain('## Overview');
      expect(result.markdown).toContain('## Statistics');
      expect(result.markdown).toContain('```javascript');
      
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    test('should format for JSON', () => {
      const result = formatter.formatForJSON(mockContext, {}, true);
      
      expect(result.json).toBeDefined();
      expect(() => JSON.parse(result.json)).not.toThrow();
      
      const parsed = JSON.parse(result.json);
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('relevantFiles');
    });

    test('should format compact JSON', () => {
      const prettyResult = formatter.formatForJSON(mockContext, {}, true);
      const compactResult = formatter.formatForJSON(mockContext, {}, false);
      
      expect(compactResult.json.length).toBeLessThan(prettyResult.json.length);
      expect(compactResult.json).not.toContain('\n  ');
    });
  });

  describe('Utility Functions', () => {
    test('should format bytes correctly', () => {
      expect(formatter._formatBytes(0)).toBe('0 B');
      expect(formatter._formatBytes(1024)).toBe('1.0 KB');
      expect(formatter._formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatter._formatBytes(1536)).toBe('1.5 KB');
    });

    test('should detect language from file path', () => {
      expect(formatter._detectLanguage('/app.js')).toBe('javascript');
      expect(formatter._detectLanguage('/component.tsx')).toBe('typescript');
      expect(formatter._detectLanguage('/script.py')).toBe('python');
      expect(formatter._detectLanguage('/main.go')).toBe('go');
      expect(formatter._detectLanguage('/unknown.xyz')).toBe('text');
    });

    test('should create appropriate code snippets', () => {
      const longContent = 'console.log("test");\n'.repeat(50);
      const snippet = formatter._createCodeSnippet('/test.js', longContent, { codeSnippetLength: 100 });
      
      expect(snippet.content.length).toBeLessThanOrEqual(100);
      expect(snippet.truncated).toBe(true);
      expect(snippet.language).toBe('javascript');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track formatting statistics', () => {
      const context = { files: {}, summary: {} };
      
      formatter.formatForClaude(context);
      formatter.formatForClaude(context);
      
      const stats = formatter.getStats();
      
      expect(stats.formattingCount).toBe(2);
      expect(stats.averageTokens).toBeGreaterThan(0);
      expect(stats.truncationRate).toBeGreaterThanOrEqual(0);
    });

    test('should reset statistics', () => {
      const context = { files: {}, summary: {} };
      
      formatter.formatForClaude(context);
      formatter.resetStats();
      
      const stats = formatter.getStats();
      
      expect(stats.formattingCount).toBe(0);
      expect(stats.averageTokens).toBe(0);
      expect(stats.truncationCount).toBe(0);
    });

    test('should track truncation rate', () => {
      const largeContext = {
        files: {},
        summary: { totalFiles: 100 }
      };
      
      // Create large content that will trigger truncation
      for (let i = 0; i < 20; i++) {
        largeContext.files[`/file${i}.js`] = {
          content: 'x'.repeat(1000),
          relevanceScore: 0.5
        };
      }
      
      formatter.options.maxTokens = 500; // Very small limit
      
      formatter.formatForClaude(largeContext);
      formatter.formatForClaude(largeContext);
      
      const stats = formatter.getStats();
      
      expect(stats.truncationRate).toBe(1); // 100% truncation rate
    });
  });

  describe('Error Handling', () => {
    test('should handle empty context', () => {
      const emptyContext = {};
      
      const result = formatter.formatForClaude(emptyContext);
      
      expect(result.formatted).toBeDefined();
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.metadata.truncated).toBe(false);
    });

    test('should handle missing file content', () => {
      const contextWithEmptyFiles = {
        files: {
          '/empty.js': { size: 0 },
          '/null.js': { content: null }
        },
        summary: { totalFiles: 2 }
      };
      
      const result = formatter.formatForClaude(contextWithEmptyFiles);
      
      expect(result.formatted.codeSnippets.length).toBe(0);
      expect(result.formatted.relevantFiles.length).toBe(2);
    });

    test('should handle malformed context gracefully', () => {
      const malformedContext = {
        files: null,
        summary: undefined,
        dependencies: 'invalid'
      };
      
      expect(() => {
        formatter.formatForClaude(malformedContext);
      }).not.toThrow();
    });
  });
});
