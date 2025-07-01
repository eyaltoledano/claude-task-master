/**
 * Advanced AST Analysis Components - Phase 5.1
 * Exports all advanced analysis features for comprehensive code understanding
 */

export { CrossLanguageAnalyzer, CrossLanguageAnalysisError } from './cross-language-analysis.js';
export { RefactoringSuggestionEngine, RefactoringSuggestionError } from './refactoring-suggestions.js';
export { PatternDetectionEngine, PatternDetectionError } from './pattern-detection.js';
export { DocumentationGenerator, DocumentationGenerationError } from './documentation-generator.js';

// Import classes for internal use
import { CrossLanguageAnalyzer } from './cross-language-analysis.js';
import { RefactoringSuggestionEngine } from './refactoring-suggestions.js';
import { PatternDetectionEngine } from './pattern-detection.js';
import { DocumentationGenerator } from './documentation-generator.js';

// Integrated analysis engine that combines all components
export class AdvancedAnalysisEngine {
    constructor(parserRegistry, dependencyMapper, analyzers, options = {}) {
        this.crossLanguageAnalyzer = new CrossLanguageAnalyzer(parserRegistry, dependencyMapper, analyzers, options.crossLanguage);
        this.refactoringSuggestionEngine = new RefactoringSuggestionEngine(analyzers, options.refactoring);
        this.patternDetectionEngine = new PatternDetectionEngine(analyzers, options.patterns);
        this.documentationGenerator = new DocumentationGenerator(analyzers, options.documentation);
        
        this.options = {
            enableCrossLanguage: true,
            enableRefactoring: true,
            enablePatterns: true,
            enableDocumentation: true,
            ...options
        };
    }

    /**
     * Run comprehensive analysis on a project
     */
    async analyzeProject(projectPath) {
        const results = {
            projectPath,
            crossLanguage: null,
            refactoring: [],
            patterns: [],
            documentation: null,
            summary: {
                analysisTimestamp: new Date().toISOString(),
                enabledFeatures: []
            }
        };

        try {
            // Cross-language analysis
            if (this.options.enableCrossLanguage) {
                results.crossLanguage = await this.crossLanguageAnalyzer.analyzeCrossLanguageProject(projectPath);
                results.summary.enabledFeatures.push('cross-language');
            }

            // Documentation generation for project
            if (this.options.enableDocumentation && results.crossLanguage) {
                const astResults = results.crossLanguage.astResults || [];
                results.documentation = await this.documentationGenerator.generateProjectDocumentation(projectPath, astResults);
                results.summary.enabledFeatures.push('documentation');
            }

            return results;

        } catch (error) {
            throw new AdvancedAnalysisError(`Project analysis failed: ${error.message}`, error);
        }
    }

    /**
     * Run comprehensive analysis on a single file
     */
    async analyzeFile(filePath, ast, language) {
        const results = {
            filePath,
            language,
            refactoring: null,
            patterns: null,
            documentation: null,
            summary: {
                analysisTimestamp: new Date().toISOString(),
                enabledFeatures: []
            }
        };

        try {
            // Refactoring suggestions
            if (this.options.enableRefactoring) {
                results.refactoring = await this.refactoringSuggestionEngine.analyzeFileForRefactoring(filePath, ast, language);
                results.summary.enabledFeatures.push('refactoring');
            }

            // Pattern detection
            if (this.options.enablePatterns) {
                results.patterns = await this.patternDetectionEngine.analyzePatterns(filePath, ast, language);
                results.summary.enabledFeatures.push('patterns');
            }

            // Documentation generation
            if (this.options.enableDocumentation) {
                results.documentation = await this.documentationGenerator.generateFileDocumentation(filePath, ast, language);
                results.summary.enabledFeatures.push('documentation');
            }

            return results;

        } catch (error) {
            throw new AdvancedAnalysisError(`File analysis failed: ${error.message}`, error);
        }
    }
}

/**
 * Custom error class for advanced analysis
 */
export class AdvancedAnalysisError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'AdvancedAnalysisError';
        this.cause = cause;
    }
}

export default AdvancedAnalysisEngine;
