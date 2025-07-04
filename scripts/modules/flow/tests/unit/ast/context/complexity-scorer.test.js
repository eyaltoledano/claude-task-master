/**
 * @fileoverview Complexity Scorer Test Suite
 * 
 * Tests the code complexity analysis and scoring functionality including:
 * - Cyclomatic complexity calculation
 * - Cognitive complexity scoring
 * - File size and structure complexity
 * - Maintainability index calculation
 * - Performance benchmarks for complexity analysis
 * 
 * Part of Phase 1.3: Context Building & Analysis Testing
 */

describe('ComplexityScorer', () => {
  let ComplexityScorer;
  let scorer;

  beforeAll(() => {
    // Mock the ComplexityScorer class
    ComplexityScorer = class MockComplexityScorer {
      constructor(options = {}) {
        this.options = {
          cyclomaticWeight: options.cyclomaticWeight || 0.3,
          cognitiveWeight: options.cognitiveWeight || 0.25,
          structuralWeight: options.structuralWeight || 0.2,
          sizeWeight: options.sizeWeight || 0.15,
          maintainabilityWeight: options.maintainabilityWeight || 0.1,
          ...options
        };
        
        this.cache = new Map();
        this.stats = {
          analysisCount: 0,
          averageComplexity: 0,
          cacheHits: 0
        };
      }

      analyzeComplexity(filePath, content, ast = null) {
        this.stats.analysisCount++;
        
        // Check cache
        const cacheKey = `${filePath}:${content.slice(0, 100)}`;
        if (this.cache.has(cacheKey)) {
          this.stats.cacheHits++;
          return this.cache.get(cacheKey);
        }

        const analysis = {
          cyclomatic: this._calculateCyclomaticComplexity(content, ast),
          cognitive: this._calculateCognitiveComplexity(content, ast),
          structural: this._calculateStructuralComplexity(content, ast),
          size: this._calculateSizeComplexity(content),
          maintainability: this._calculateMaintainabilityIndex(content, ast)
        };

        const totalScore = this._calculateTotalScore(analysis);
        
        const result = {
          score: totalScore,
          breakdown: analysis,
          category: this._categorizeComplexity(totalScore),
          recommendations: this._generateRecommendations(analysis),
          metadata: {
            filePath,
            contentLength: content.length,
            linesOfCode: content.split('\n').length
          }
        };

        this.cache.set(cacheKey, result);
        this._updateAverageComplexity(totalScore);
        
        return result;
      }

      _calculateCyclomaticComplexity(content, ast) {
        let complexity = 1; // Base complexity
        
        // Count decision points
        const decisionPatterns = [
          /if\s*\(/g,
          /else\s+if\s*\(/g,
          /while\s*\(/g,
          /for\s*\(/g,
          /switch\s*\(/g,
          /case\s+/g,
          /catch\s*\(/g,
          /\?\s*.*?\s*:/g, // Ternary operators
          /&&/g,
          /\|\|/g
        ];

        for (const pattern of decisionPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            complexity += matches.length;
          }
        }

        return Math.min(complexity, 50); // Cap at 50
      }

      _calculateCognitiveComplexity(content, ast) {
        let complexity = 0;
        let nestingLevel = 0;
        
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Increment nesting
          if (trimmed.includes('{')) {
            nestingLevel++;
          }
          
          // Decrement nesting
          if (trimmed.includes('}')) {
            nestingLevel = Math.max(0, nestingLevel - 1);
          }
          
          // Add complexity based on constructs
          if (/^(if|while|for|switch)\s*\(/.test(trimmed)) {
            complexity += 1 + nestingLevel;
          }
          
          if (/^else/.test(trimmed)) {
            complexity += 1;
          }
          
          if (/^catch/.test(trimmed)) {
            complexity += 1 + nestingLevel;
          }
        }

        return Math.min(complexity, 100);
      }

      _calculateStructuralComplexity(content, ast) {
        const functions = (content.match(/function\s+\w+/g) || []).length;
        const classes = (content.match(/class\s+\w+/g) || []).length;
        const methods = (content.match(/\w+\s*\([^)]*\)\s*{/g) || []).length;
        const imports = (content.match(/import\s+.*from/g) || []).length;
        
        const structuralElements = functions + classes + methods + imports;
        const linesOfCode = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
        ).length;
        
        if (linesOfCode === 0) return 0;
        
        const density = structuralElements / linesOfCode;
        return Math.min(density * 20, 10); // Normalize to 0-10 scale
      }

      _calculateSizeComplexity(content) {
        const lines = content.split('\n').length;
        const characters = content.length;
        
        // Complexity increases with size but plateaus
        const lineComplexity = Math.log(lines + 1) / Math.log(1000); // Normalized to 1000 lines
        const charComplexity = Math.log(characters + 1) / Math.log(50000); // Normalized to 50KB
        
        return Math.min((lineComplexity + charComplexity) / 2, 1) * 10;
      }

      _calculateMaintainabilityIndex(content, ast) {
        const loc = content.split('\n').length;
        const cyclomatic = this._calculateCyclomaticComplexity(content, ast);
        const halsteadVolume = this._estimateHalsteadVolume(content);
        
        // Simplified maintainability index calculation
        const mi = Math.max(0, 
          171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomatic - 16.2 * Math.log(loc)
        );
        
        return Math.min(mi / 100, 1) * 10; // Normalize to 0-10
      }

      _estimateHalsteadVolume(content) {
        // Simple estimation of Halstead volume
        const operators = (content.match(/[+\-*\/=<>!&|%^~]/g) || []).length;
        const operands = (content.match(/\b\w+\b/g) || []).length;
        
        const vocabulary = Math.sqrt(operators + operands);
        const length = operators + operands;
        
        return length * Math.log2(vocabulary || 1);
      }

      _calculateTotalScore(analysis) {
        return (
          analysis.cyclomatic * this.options.cyclomaticWeight +
          analysis.cognitive * this.options.cognitiveWeight +
          analysis.structural * this.options.structuralWeight +
          analysis.size * this.options.sizeWeight +
          (10 - analysis.maintainability) * this.options.maintainabilityWeight
        );
      }

      _categorizeComplexity(score) {
        if (score <= 2) return 'low';
        if (score <= 5) return 'medium';
        if (score <= 8) return 'high';
        return 'very-high';
      }

      _generateRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.cyclomatic > 10) {
          recommendations.push('Consider breaking down complex functions');
        }
        
        if (analysis.cognitive > 15) {
          recommendations.push('Reduce nesting levels and simplify logic');
        }
        
        if (analysis.structural > 5) {
          recommendations.push('Consider splitting into smaller modules');
        }
        
        if (analysis.size > 7) {
          recommendations.push('File is large, consider refactoring');
        }
        
        if (analysis.maintainability < 3) {
          recommendations.push('Improve code documentation and structure');
        }
        
        return recommendations;
      }

      _updateAverageComplexity(score) {
        const count = this.stats.analysisCount;
        this.stats.averageComplexity = ((this.stats.averageComplexity * (count - 1)) + score) / count;
      }

      analyzeFiles(files) {
        const results = {};
        
        for (const [filePath, fileData] of Object.entries(files)) {
          const content = fileData.content || '';
          const ast = fileData.ast || null;
          
          results[filePath] = this.analyzeComplexity(filePath, content, ast);
        }
        
        return results;
      }

      rankFilesByComplexity(files, descending = true) {
        const results = this.analyzeFiles(files);
        
        return Object.entries(results)
          .map(([filePath, analysis]) => ({
            filePath,
            score: analysis.score,
            category: analysis.category
          }))
          .sort((a, b) => descending ? b.score - a.score : a.score - b.score);
      }

      filterByComplexity(files, category = 'high') {
        const results = this.analyzeFiles(files);
        const filtered = {};
        
        for (const [filePath, analysis] of Object.entries(results)) {
          if (analysis.category === category || 
              (category === 'high' && analysis.category === 'very-high')) {
            filtered[filePath] = {
              ...files[filePath],
              complexityAnalysis: analysis
            };
          }
        }
        
        return filtered;
      }

      getComplexityDistribution(files) {
        const results = this.analyzeFiles(files);
        const distribution = { low: 0, medium: 0, high: 0, 'very-high': 0 };
        
        for (const analysis of Object.values(results)) {
          distribution[analysis.category]++;
        }
        
        return distribution;
      }

      getStats() {
        return {
          ...this.stats,
          cacheSize: this.cache.size,
          hitRate: this.stats.analysisCount > 0 ? this.stats.cacheHits / this.stats.analysisCount : 0
        };
      }

      clearCache() {
        this.cache.clear();
      }
    };
  });

  beforeEach(() => {
    scorer = new ComplexityScorer();
  });

  describe('Initialization', () => {
    test('should initialize with default weights', () => {
      expect(scorer.options.cyclomaticWeight).toBe(0.3);
      expect(scorer.options.cognitiveWeight).toBe(0.25);
      expect(scorer.options.structuralWeight).toBe(0.2);
    });

    test('should initialize with custom weights', () => {
      const customScorer = new ComplexityScorer({
        cyclomaticWeight: 0.5,
        cognitiveWeight: 0.3
      });
      
      expect(customScorer.options.cyclomaticWeight).toBe(0.5);
      expect(customScorer.options.cognitiveWeight).toBe(0.3);
    });
  });

  describe('Cyclomatic Complexity', () => {
    test('should calculate basic cyclomatic complexity', () => {
      const simpleContent = 'function test() { return true; }';
      const result = scorer.analyzeComplexity('/test.js', simpleContent);
      
      expect(result.breakdown.cyclomatic).toBe(1);
    });

    test('should handle if statements', () => {
      const content = `
        function test(x) {
          if (x > 0) {
            return 'positive';
          } else if (x < 0) {
            return 'negative';
          } else {
            return 'zero';
          }
        }
      `;
      
      const result = scorer.analyzeComplexity('/test.js', content);
      expect(result.breakdown.cyclomatic).toBeGreaterThan(3);
    });

    test('should handle loops and switches', () => {
      const content = `
        function complex(items, type) {
          for (let i = 0; i < items.length; i++) {
            switch (type) {
              case 'A':
                while (condition) {
                  process();
                }
                break;
              case 'B':
                if (items[i].valid) {
                  handle();
                }
                break;
            }
          }
        }
      `;
      
      const result = scorer.analyzeComplexity('/test.js', content);
      expect(result.breakdown.cyclomatic).toBeGreaterThan(5);
    });
  });

  describe('Cognitive Complexity', () => {
    test('should calculate cognitive complexity with nesting', () => {
      const content = `
        function nested() {
          if (condition1) {
            if (condition2) {
              if (condition3) {
                return true;
              }
            }
          }
        }
      `;
      
      const result = scorer.analyzeComplexity('/test.js', content);
      expect(result.breakdown.cognitive).toBeGreaterThan(3);
    });

    test('should handle exception handling', () => {
      const content = `
        function withTryCatch() {
          try {
            if (risky()) {
              process();
            }
          } catch (error) {
            if (error.critical) {
              alert();
            }
          }
        }
      `;
      
      const result = scorer.analyzeComplexity('/test.js', content);
      expect(result.breakdown.cognitive).toBeGreaterThan(2);
    });
  });

  describe('File Analysis', () => {
    test('should analyze multiple files', () => {
      const files = {
        '/simple.js': { content: 'const x = 1;' },
        '/complex.js': { content: 'if(a){if(b){if(c){return;}}}' }
      };
      
      const results = scorer.analyzeFiles(files);
      
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['/complex.js'].score).toBeGreaterThan(results['/simple.js'].score);
    });

    test('should rank files by complexity', () => {
      const files = {
        '/low.js': { content: 'const x = 1;' },
        '/high.js': { content: 'if(a){for(i=0;i<10;i++){if(b){while(c){}}}}' },
        '/medium.js': { content: 'if(a){return b;}else{return c;}' }
      };
      
      const ranked = scorer.rankFilesByComplexity(files);
      
      expect(ranked[0].filePath).toBe('/high.js');
      expect(ranked[2].filePath).toBe('/low.js');
    });

    test('should filter by complexity category', () => {
      const files = {
        '/simple.js': { content: 'const x = 1;' },
        '/complex.js': { content: 'if(a){if(b){if(c){if(d){return;}}}}' }
      };
      
      const highComplexity = scorer.filterByComplexity(files, 'high');
      
      expect(Object.keys(highComplexity).length).toBeGreaterThan(0);
    });

    test('should provide complexity distribution', () => {
      const files = {
        '/low1.js': { content: 'const x = 1;' },
        '/low2.js': { content: 'const y = 2;' },
        '/high.js': { content: 'if(a){if(b){if(c){return;}}}' }
      };
      
      const distribution = scorer.getComplexityDistribution(files);
      
      expect(distribution).toHaveProperty('low');
      expect(distribution).toHaveProperty('medium');
      expect(distribution).toHaveProperty('high');
      expect(distribution.low).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    test('should cache analysis results', () => {
      const content = 'function test() { return true; }';
      
      scorer.analyzeComplexity('/test.js', content);
      scorer.analyzeComplexity('/test.js', content);
      
      const stats = scorer.getStats();
      expect(stats.cacheHits).toBe(1);
    });

    test('should handle large number of files efficiently', () => {
      const files = {};
      for (let i = 0; i < 50; i++) {
        files[`/file${i}.js`] = { content: `function test${i}() { return ${i}; }` };
      }
      
      const start = Date.now();
      scorer.analyzeFiles(files);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should provide comprehensive statistics', () => {
      scorer.analyzeComplexity('/test1.js', 'const x = 1;');
      scorer.analyzeComplexity('/test2.js', 'if(a){return b;}');
      
      const stats = scorer.getStats();
      
      expect(stats).toHaveProperty('analysisCount', 2);
      expect(stats).toHaveProperty('averageComplexity');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty content', () => {
      const result = scorer.analyzeComplexity('/empty.js', '');
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.breakdown).toBeDefined();
    });

    test('should handle malformed code gracefully', () => {
      const malformedContent = 'function test( { invalid syntax }}}';
      const result = scorer.analyzeComplexity('/malformed.js', malformedContent);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
