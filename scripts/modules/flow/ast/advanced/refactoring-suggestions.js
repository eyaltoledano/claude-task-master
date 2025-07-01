/**
 * Refactoring Suggestions Component
 * Analyzes AST patterns and suggests code improvements using modern techniques
 */

import { EventEmitter } from 'events';

export class RefactoringSuggestionEngine extends EventEmitter {
    constructor(analyzers, options = {}) {
        super();
        this.analyzers = analyzers;
        this.options = {
            suggestionConfidenceThreshold: 0.6,
            maxSuggestionsPerFile: 10,
            ...options
        };
    }

    async analyzeFileForRefactoring(filePath, ast, language) {
        this.emit('analysis:start', { filePath, language });

        try {
            const suggestions = [];
            
            // Analyze complexity
            if (ast.functions) {
                for (const func of ast.functions) {
                    const complexity = this.calculateComplexity(func);
                    
                    if (complexity > 10) {
                        suggestions.push({
                            type: 'complexity',
                            title: `High Complexity Function: ${func.name}`,
                            description: `Function has complexity of ${complexity}`,
                            priority: complexity > 20 ? 'high' : 'medium',
                            confidence: 0.9,
                            suggestion: 'Break down into smaller functions'
                        });
                    }
                }
            }

            // Analyze code smells
            suggestions.push(...this.detectCodeSmells(ast, language));

            return {
                filePath,
                language,
                suggestions: suggestions.slice(0, this.options.maxSuggestionsPerFile),
                summary: {
                    totalSuggestions: suggestions.length,
                    highPriority: suggestions.filter(s => s.priority === 'high').length
                }
            };

        } catch (error) {
            this.emit('analysis:error', error);
            throw error;
        }
    }

    calculateComplexity(func) {
        let complexity = 1;
        if (func.conditionals) complexity += func.conditionals.length;
        if (func.loops) complexity += func.loops.length;
        return complexity;
    }

    detectCodeSmells(ast, language) {
        const smells = [];
        
        if (ast.functions) {
            for (const func of ast.functions) {
                const lineCount = func.location?.endLine - func.location?.startLine;
                if (lineCount > 50) {
                    smells.push({
                        type: 'code-smell',
                        title: 'Long Method',
                        description: `Method ${func.name} has ${lineCount} lines`,
                        priority: 'medium',
                        confidence: 0.9,
                        suggestion: 'Break method into smaller parts'
                    });
                }
            }
        }

        return smells;
    }
}

export default RefactoringSuggestionEngine;

/**
 * Custom error class for refactoring suggestions
 */
export class RefactoringSuggestionError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "RefactoringSuggestionError";
        this.cause = cause;
    }
}
