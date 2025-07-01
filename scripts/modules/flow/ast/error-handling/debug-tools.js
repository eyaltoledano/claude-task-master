/**
 * Debug Tools - Phase 4.3
 * 
 * Fast, self-contained debugging tools for AST parsing.
 * Prioritizes speed and development workflow with local debugging.
 * 
 * Key Features:
 * - Fast parsing diagnosis and debugging
 * - Self-contained under @/flow architecture
 * - Development-friendly debug output
 * - Quick issue identification
 * - CLI debugging commands
 * 
 * @author Task Master Flow
 * @version 4.3.0
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

/**
 * Debug Tools System
 * 
 * Provides fast debugging tools for AST parsing issues.
 * Optimized for speed and development workflow.
 */
export class ASTDebugTools extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enableFileOutput: true,
            enableConsoleOutput: true,
            maxDebugTime: 100, // 100ms max for debug operations
            debugOutputDir: './.taskmaster/debug/ast',
            verboseMode: false,
            ...options
        };
        
        // Debug session tracking
        this.session = {
            startTime: Date.now(),
            totalDebugs: 0,
            issuesFound: 0,
            filesAnalyzed: new Set(),
            errorPatterns: new Map()
        };
        
        // Initialize debug output directory
        this.initializeDebugDir();
        
        console.log('ASTDebugTools initialized for fast development debugging');
    }
    
    /**
     * Debug parsing failure
     */
    async debugParsingFailure(error, filePath, content, language, options = {}) {
        const debugId = this.generateDebugId();
        const startTime = Date.now();
        
        try {
            const debug = await Promise.race([
                this.performDebugging(error, filePath, content, language, debugId, options),
                this.timeout(this.config.maxDebugTime)
            ]);
            
            const duration = Date.now() - startTime;
            
            this.session.totalDebugs++;
            this.session.filesAnalyzed.add(filePath);
            
            if (debug.issues.length > 0) {
                this.session.issuesFound += debug.issues.length;
            }
            
            // Track error patterns
            const errorType = this.classifyError(error);
            const count = this.session.errorPatterns.get(errorType) || 0;
            this.session.errorPatterns.set(errorType, count + 1);
            
            // Output debug results
            if (this.config.enableConsoleOutput) {
                this.outputToConsole(debug, filePath, duration);
            }
            
            if (this.config.enableFileOutput) {
                await this.outputToFile(debug, debugId);
            }
            
            this.emit('debug', {
                debugId,
                filePath,
                language,
                issuesFound: debug.issues.length,
                duration
            });
            
            return debug;
            
        } catch (debugError) {
            return {
                debugId,
                success: false,
                error: debugError.message,
                issues: [],
                suggestions: ['Debug operation failed or timed out'],
                analysis: {}
            };
        }
    }
    
    /**
     * Perform comprehensive debugging
     */
    async performDebugging(error, filePath, content, language, debugId, options) {
        const debug = {
            debugId,
            timestamp: new Date().toISOString(),
            filePath,
            language,
            success: true,
            error: {
                message: error.message,
                type: this.classifyError(error),
                stack: error.stack
            },
            issues: [],
            suggestions: [],
            analysis: {}
        };
        
        // Quick syntax analysis
        debug.analysis.syntax = await this.analyzeSyntax(content, language);
        
        // Structure analysis
        debug.analysis.structure = await this.analyzeStructure(content, language);
        
        // Content analysis
        debug.analysis.content = await this.analyzeContent(content, filePath);
        
        // Error-specific analysis
        debug.analysis.errorSpecific = await this.analyzeError(error, content, language);
        
        // Generate issues and suggestions
        this.generateIssuesAndSuggestions(debug);
        
        return debug;
    }
    
    /**
     * Analyze syntax issues
     */
    async analyzeSyntax(content, language) {
        const analysis = {
            issues: [],
            stats: {}
        };
        
        const lines = content.split('\n');
        analysis.stats.totalLines = lines.length;
        analysis.stats.emptyLines = lines.filter(line => !line.trim()).length;
        analysis.stats.codeLines = lines.filter(line => line.trim() && !this.isComment(line, language)).length;
        
        // Check for common syntax issues
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
                this.analyzeJavaScriptSyntax(content, analysis);
                break;
                
            case 'python':
                this.analyzePythonSyntax(content, analysis);
                break;
                
            case 'go':
                this.analyzeGoSyntax(content, analysis);
                break;
                
            default:
                this.analyzeGenericSyntax(content, analysis);
        }
        
        return analysis;
    }
    
    /**
     * Analyze JavaScript/TypeScript syntax
     */
    analyzeJavaScriptSyntax(content, analysis) {
        // Bracket matching
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
            analysis.issues.push({
                type: 'bracket_mismatch',
                message: `Brace mismatch: ${openBraces} open, ${closeBraces} close`,
                severity: 'high'
            });
        }
        
        // Parentheses matching
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            analysis.issues.push({
                type: 'paren_mismatch',
                message: `Parentheses mismatch: ${openParens} open, ${closeParens} close`,
                severity: 'high'
            });
        }
        
        // Quote matching (basic check)
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const singleQuotes = (line.match(/'/g) || []).length;
            const doubleQuotes = (line.match(/"/g) || []).length;
            
            if (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1) {
                analysis.issues.push({
                    type: 'quote_mismatch',
                    message: `Possible unmatched quotes on line ${i + 1}`,
                    line: i + 1,
                    severity: 'medium'
                });
            }
        }
        
        // Common syntax patterns
        if (content.includes('function') || content.includes('=>')) {
            analysis.stats.hasFunctions = true;
        }
        if (content.includes('class ')) {
            analysis.stats.hasClasses = true;
        }
        if (content.includes('import ') || content.includes('require(')) {
            analysis.stats.hasImports = true;
        }
    }
    
    /**
     * Analyze Python syntax
     */
    analyzePythonSyntax(content, analysis) {
        const lines = content.split('\n');
        
        // Indentation analysis
        const indentLevels = new Set();
        let indentIssues = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim()) {
                const indent = line.length - line.trimStart().length;
                indentLevels.add(indent);
                
                // Check for mixed spaces/tabs
                if (line.includes('\t') && line.includes('  ')) {
                    analysis.issues.push({
                        type: 'mixed_indentation',
                        message: `Mixed spaces and tabs on line ${i + 1}`,
                        line: i + 1,
                        severity: 'medium'
                    });
                    indentIssues++;
                }
            }
        }
        
        analysis.stats.indentLevels = indentLevels.size;
        analysis.stats.indentIssues = indentIssues;
        
        // Check for common patterns
        if (content.includes('def ')) {
            analysis.stats.hasFunctions = true;
        }
        if (content.includes('class ')) {
            analysis.stats.hasClasses = true;
        }
        if (content.includes('import ') || content.includes('from ')) {
            analysis.stats.hasImports = true;
        }
    }
    
    /**
     * Analyze Go syntax
     */
    analyzeGoSyntax(content, analysis) {
        // Package declaration
        if (!content.includes('package ')) {
            analysis.issues.push({
                type: 'missing_package',
                message: 'No package declaration found',
                severity: 'high'
            });
        }
        
        // Bracket matching (same as JS)
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
            analysis.issues.push({
                type: 'bracket_mismatch',
                message: `Brace mismatch: ${openBraces} open, ${closeBraces} close`,
                severity: 'high'
            });
        }
        
        // Check for common patterns
        if (content.includes('func ')) {
            analysis.stats.hasFunctions = true;
        }
        if (content.includes('type ') && content.includes('struct')) {
            analysis.stats.hasStructs = true;
        }
        if (content.includes('import ')) {
            analysis.stats.hasImports = true;
        }
    }
    
    /**
     * Analyze generic syntax
     */
    analyzeGenericSyntax(content, analysis) {
        // Basic bracket matching
        const brackets = { '{': '}', '(': ')', '[': ']' };
        const stack = [];
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (brackets[char]) {
                stack.push({ char, pos: i });
            } else if (Object.values(brackets).includes(char)) {
                if (stack.length === 0) {
                    analysis.issues.push({
                        type: 'unmatched_bracket',
                        message: `Unmatched closing bracket '${char}' at position ${i}`,
                        severity: 'high'
                    });
                } else {
                    const last = stack.pop();
                    if (brackets[last.char] !== char) {
                        analysis.issues.push({
                            type: 'bracket_mismatch',
                            message: `Mismatched brackets: '${last.char}' at ${last.pos} and '${char}' at ${i}`,
                            severity: 'high'
                        });
                    }
                }
            }
        }
        
        // Remaining unclosed brackets
        for (const item of stack) {
            analysis.issues.push({
                type: 'unclosed_bracket',
                message: `Unclosed bracket '${item.char}' at position ${item.pos}`,
                severity: 'high'
            });
        }
    }
    
    /**
     * Analyze code structure
     */
    async analyzeStructure(content, language) {
        const analysis = {
            complexity: 1,
            nesting: 0,
            patterns: {},
            issues: []
        };
        
        // Calculate nesting depth
        let currentDepth = 0;
        let maxDepth = 0;
        
        for (const char of content) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth--;
            }
        }
        
        analysis.nesting = maxDepth;
        
        // Check for excessive nesting
        if (maxDepth > 10) {
            analysis.issues.push({
                type: 'excessive_nesting',
                message: `Very deep nesting (${maxDepth} levels) - may cause parsing issues`,
                severity: 'medium'
            });
        }
        
        // Estimate complexity
        const lines = content.split('\n');
        const codeLines = lines.filter(line => line.trim() && !this.isComment(line, language)).length;
        analysis.complexity = Math.max(1, Math.floor(codeLines / 10) + maxDepth);
        
        return analysis;
    }
    
    /**
     * Analyze content characteristics
     */
    async analyzeContent(content, filePath) {
        const analysis = {
            size: content.length,
            lines: content.split('\n').length,
            encoding: 'unknown',
            issues: []
        };
        
        // Check file size
        if (analysis.size > 1000000) { // 1MB
            analysis.issues.push({
                type: 'large_file',
                message: `Very large file (${Math.round(analysis.size / 1024)}KB) - may cause parsing issues`,
                severity: 'medium'
            });
        }
        
        // Check for non-ASCII characters
        const nonAsciiCount = (content.match(/[^\x00-\x7F]/g) || []).length;
        if (nonAsciiCount > 0) {
            analysis.issues.push({
                type: 'non_ascii_chars',
                message: `Contains ${nonAsciiCount} non-ASCII characters - may cause encoding issues`,
                severity: 'low'
            });
        }
        
        // Check encoding (basic)
        try {
            const encoded = Buffer.from(content, 'utf8').toString('utf8');
            analysis.encoding = encoded === content ? 'utf8' : 'unknown';
        } catch (error) {
            analysis.encoding = 'invalid';
            analysis.issues.push({
                type: 'encoding_error',
                message: 'Invalid UTF-8 encoding detected',
                severity: 'high'
            });
        }
        
        return analysis;
    }
    
    /**
     * Analyze specific error
     */
    async analyzeError(error, content, language) {
        const analysis = {
            type: this.classifyError(error),
            location: null,
            context: null,
            relatedIssues: []
        };
        
        // Try to extract location from error message
        const locationMatch = error.message.match(/line\s+(\d+)|position\s+(\d+)|at\s+(\d+)/i);
        if (locationMatch) {
            const lineNum = parseInt(locationMatch[1] || locationMatch[2] || locationMatch[3]);
            if (!isNaN(lineNum)) {
                analysis.location = { line: lineNum };
                analysis.context = this.getErrorContext(content, lineNum);
            }
        }
        
        // Error-specific analysis
        switch (analysis.type) {
            case 'syntax_error':
                analysis.relatedIssues = this.findSyntaxRelatedIssues(content, language);
                break;
                
            case 'parse_error':
                analysis.relatedIssues = this.findParseRelatedIssues(content, language);
                break;
                
            case 'timeout_error':
                analysis.relatedIssues = this.findPerformanceIssues(content);
                break;
        }
        
        return analysis;
    }
    
    /**
     * Generate issues and suggestions from analysis
     */
    generateIssuesAndSuggestions(debug) {
        const allAnalysis = [
            debug.analysis.syntax,
            debug.analysis.structure,
            debug.analysis.content,
            debug.analysis.errorSpecific
        ];
        
        // Collect all issues
        for (const analysis of allAnalysis) {
            if (analysis.issues) {
                debug.issues.push(...analysis.issues);
            }
        }
        
        // Generate suggestions based on error type and issues
        debug.suggestions = this.generateSuggestions(debug.error.type, debug.issues);
        
        // Add quick fixes
        debug.quickFixes = this.generateQuickFixes(debug.issues);
    }
    
    /**
     * Generate suggestions for issues
     */
    generateSuggestions(errorType, issues) {
        const suggestions = [];
        
        // Error-type specific suggestions
        switch (errorType) {
            case 'syntax_error':
                suggestions.push('Check for missing brackets, parentheses, or quotes');
                suggestions.push('Verify proper indentation (especially for Python)');
                suggestions.push('Use an IDE with syntax highlighting');
                break;
                
            case 'parse_error':
                suggestions.push('Validate file encoding (should be UTF-8)');
                suggestions.push('Check for invalid characters or formatting');
                suggestions.push('Try parsing smaller sections of the file');
                break;
                
            case 'timeout_error':
                suggestions.push('File may be too complex or large');
                suggestions.push('Consider breaking into smaller files');
                suggestions.push('Use partial parsing for large files');
                break;
        }
        
        // Issue-specific suggestions
        const issueTypes = new Set(issues.map(issue => issue.type));
        
        if (issueTypes.has('bracket_mismatch')) {
            suggestions.push('Use auto-formatting to fix bracket alignment');
        }
        
        if (issueTypes.has('quote_mismatch')) {
            suggestions.push('Use consistent quote style throughout file');
        }
        
        if (issueTypes.has('large_file')) {
            suggestions.push('Consider using streaming or chunked parsing');
        }
        
        if (issueTypes.has('excessive_nesting')) {
            suggestions.push('Refactor deeply nested code into smaller functions');
        }
        
        return [...new Set(suggestions)]; // Remove duplicates
    }
    
    /**
     * Generate quick fixes
     */
    generateQuickFixes(issues) {
        const fixes = [];
        
        for (const issue of issues) {
            switch (issue.type) {
                case 'bracket_mismatch':
                    fixes.push({
                        type: 'auto_format',
                        description: 'Auto-format code to fix bracket alignment',
                        command: 'Use IDE auto-format or prettier'
                    });
                    break;
                    
                case 'mixed_indentation':
                    fixes.push({
                        type: 'fix_indentation',
                        description: 'Convert all indentation to spaces',
                        command: 'Replace tabs with spaces'
                    });
                    break;
                    
                case 'non_ascii_chars':
                    fixes.push({
                        type: 'fix_encoding',
                        description: 'Remove or replace non-ASCII characters',
                        command: 'Save file with UTF-8 encoding'
                    });
                    break;
            }
        }
        
        return fixes;
    }
    
    /**
     * Helper methods
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('syntax')) return 'syntax_error';
        if (message.includes('parse')) return 'parse_error';
        if (message.includes('timeout')) return 'timeout_error';
        if (message.includes('memory')) return 'memory_error';
        if (message.includes('encoding')) return 'encoding_error';
        
        return 'unknown_error';
    }
    
    isComment(line, language) {
        const trimmed = line.trim();
        
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
            case 'go':
                return trimmed.startsWith('//') || trimmed.startsWith('/*');
                
            case 'python':
                return trimmed.startsWith('#');
                
            default:
                return trimmed.startsWith('//') || trimmed.startsWith('#');
        }
    }
    
    getErrorContext(content, lineNum) {
        const lines = content.split('\n');
        const start = Math.max(0, lineNum - 3);
        const end = Math.min(lines.length, lineNum + 2);
        
        return {
            lineNumber: lineNum,
            contextLines: lines.slice(start, end),
            startLine: start + 1
        };
    }
    
    findSyntaxRelatedIssues(content, language) {
        // Implementation for finding syntax-related issues
        return [];
    }
    
    findParseRelatedIssues(content, language) {
        // Implementation for finding parse-related issues
        return [];
    }
    
    findPerformanceIssues(content) {
        const issues = [];
        
        if (content.length > 500000) {
            issues.push({
                type: 'large_file_size',
                message: 'File is very large, may cause performance issues'
            });
        }
        
        const lines = content.split('\n');
        if (lines.length > 10000) {
            issues.push({
                type: 'many_lines',
                message: 'File has many lines, may slow parsing'
            });
        }
        
        return issues;
    }
    
    generateDebugId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Output methods
     */
    outputToConsole(debug, filePath, duration) {
        console.log(`\n🔍 AST Debug Report - ${debug.debugId}`);
        console.log(`📁 File: ${filePath}`);
        console.log(`⚡ Duration: ${duration}ms`);
        console.log(`❌ Error: ${debug.error.type} - ${debug.error.message}`);
        
        if (debug.issues.length > 0) {
            console.log(`\n🚨 Issues Found (${debug.issues.length}):`);
            debug.issues.forEach((issue, i) => {
                const severity = issue.severity === 'high' ? '🔴' : 
                               issue.severity === 'medium' ? '🟡' : '🔵';
                console.log(`  ${i + 1}. ${severity} ${issue.message}`);
            });
        }
        
        if (debug.suggestions.length > 0) {
            console.log(`\n💡 Suggestions:`);
            debug.suggestions.forEach((suggestion, i) => {
                console.log(`  ${i + 1}. ${suggestion}`);
            });
        }
        
        if (this.config.verboseMode && debug.quickFixes.length > 0) {
            console.log(`\n🔧 Quick Fixes:`);
            debug.quickFixes.forEach((fix, i) => {
                console.log(`  ${i + 1}. ${fix.description}: ${fix.command}`);
            });
        }
    }
    
    async outputToFile(debug, debugId) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `debug_${timestamp}_${debugId}.json`;
            const filepath = path.join(this.config.debugOutputDir, filename);
            
            await fs.promises.writeFile(filepath, JSON.stringify(debug, null, 2));
            
            if (this.config.verboseMode) {
                console.log(`💾 Debug report saved: ${filepath}`);
            }
            
        } catch (error) {
            console.warn('Failed to save debug report:', error.message);
        }
    }
    
    initializeDebugDir() {
        try {
            if (!fs.existsSync(this.config.debugOutputDir)) {
                fs.mkdirSync(this.config.debugOutputDir, { recursive: true });
            }
        } catch (error) {
            console.warn('Failed to create debug directory:', error.message);
            this.config.enableFileOutput = false;
        }
    }
    
    timeout(ms) {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Debug timeout')), ms)
        );
    }
    
    /**
     * Get debug statistics
     */
    getStatistics() {
        const runtime = Date.now() - this.session.startTime;
        
        return {
            sessionRuntime: runtime,
            totalDebugs: this.session.totalDebugs,
            issuesFound: this.session.issuesFound,
            filesAnalyzed: this.session.filesAnalyzed.size,
            errorPatterns: Object.fromEntries(this.session.errorPatterns),
            averageIssuesPerFile: this.session.filesAnalyzed.size > 0 ? 
                this.session.issuesFound / this.session.filesAnalyzed.size : 0
        };
    }
    
    /**
     * CLI integration methods
     */
    async runDiagnostic(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const language = this.detectLanguage(filePath);
            
            // Simulate parsing error for diagnostic
            const simulatedError = new Error('Diagnostic analysis');
            
            return await this.debugParsingFailure(simulatedError, filePath, content, language, {
                diagnostic: true
            });
            
        } catch (error) {
            throw new Error(`Failed to run diagnostic: ${error.message}`);
        }
    }
    
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.js':
            case '.jsx':
                return 'javascript';
            case '.ts':
            case '.tsx':
                return 'typescript';
            case '.py':
                return 'python';
            case '.go':
                return 'go';
            default:
                return 'unknown';
        }
    }
    
    /**
     * Reset debug session
     */
    resetSession() {
        this.session = {
            startTime: Date.now(),
            totalDebugs: 0,
            issuesFound: 0,
            filesAnalyzed: new Set(),
            errorPatterns: new Map()
        };
    }
}

/**
 * Factory function for creating debug tools
 */
export function createASTDebugTools(options = {}) {
    return new ASTDebugTools(options);
}

export default ASTDebugTools; 