/**
 * Generic Language Analyzer - Phase 2.2
 * 
 * Provides language-agnostic analysis patterns that work across multiple languages:
 * - Code structure analysis (functions, classes, modules)
 * - Comment and documentation patterns
 * - Complexity metrics (cyclomatic, cognitive)
 * - Code quality indicators (duplication, length, naming)
 * - Testing patterns (test files, assertions)
 * - Configuration patterns (env vars, config files)
 * 
 * Serves as fallback analyzer for unsupported languages and provides
 * universal analysis that complements language-specific analyzers.
 * 
 * @author Task Master Flow
 * @version 2.2.0
 */

import CodeAnalyzer from '../context/code-analyzer.js';
import ComplexityScorer from '../context/complexity-scorer.js';
import DependencyMapper from '../context/dependency-mapper.js';

/**
 * Generic analyzer for any programming language
 */
export class GenericAnalyzer {
    constructor(options = {}) {
        this.options = {
            enableStructuralAnalysis: true,
            enableQualityAnalysis: true,
            enableDocumentationAnalysis: true,
            enableTestingAnalysis: true,
            enableConfigurationAnalysis: true,
            ...options
        };

        // Initialize Phase 2.1 components
        this.codeAnalyzer = new CodeAnalyzer();
        this.complexityScorer = new ComplexityScorer();
        this.dependencyMapper = new DependencyMapper();
    }

    /**
     * Perform comprehensive generic analysis
     * @param {Object} astData - Parsed AST data
     * @param {string} filePath - File path for context
     * @param {string} content - Source code content
     * @param {string} language - Detected language
     * @returns {Promise<Object>} Comprehensive analysis results
     */
    async analyzeGeneric(astData, filePath, content, language = 'unknown') {
        const analysis = {
            language: language,
            fileType: this.detectFileType(filePath),
            structure: await this.analyzeStructure(astData, content),
            patterns: await this.analyzeGenericPatterns(astData, content, language),
            complexity: await this.analyzeComplexity(astData, content, language),
            codeQuality: await this.analyzeCodeQuality(astData, content, filePath),
            documentation: this.analyzeDocumentation(content),
            testing: this.analyzeTesting(content, filePath),
            configuration: this.analyzeConfiguration(content, filePath),
            recommendations: []
        };

        // Generate generic recommendations
        analysis.recommendations = this.generateGenericRecommendations(analysis);

        return analysis;
    }

    /**
     * Detect file type and purpose
     * @param {string} filePath - File path
     * @returns {Object} File type information
     */
    detectFileType(filePath) {
        const fileName = filePath.split('/').pop() || '';
        const extension = fileName.split('.').pop()?.toLowerCase() || '';

        const typeMapping = {
            // Source files
            'js': 'source', 'jsx': 'source', 'ts': 'source', 'tsx': 'source',
            'py': 'source', 'go': 'source', 'java': 'source', 'cs': 'source',
            'rb': 'source', 'php': 'source', 'cpp': 'source', 'c': 'source',
            
            // Test files
            'test.js': 'test', 'spec.js': 'test', 'test.py': 'test',
            'test.go': 'test', 'Test.java': 'test', 'test.cs': 'test',
            
            // Configuration files
            'json': 'config', 'yaml': 'config', 'yml': 'config', 'toml': 'config',
            'xml': 'config', 'ini': 'config', 'conf': 'config', 'env': 'config',
            
            // Documentation files
            'md': 'documentation', 'txt': 'documentation', 'rst': 'documentation',
            'adoc': 'documentation', 'org': 'documentation',
            
            // Build files
            'makefile': 'build', 'dockerfile': 'build', 'gradle': 'build',
            'maven': 'build', 'cmake': 'build'
        };

        // Check for test file patterns
        const isTestFile = /test|spec|__tests__|\.test\.|\.spec\.|_test\.|_spec\./i.test(fileName);
        
        // Check for config file patterns
        const isConfigFile = /config|settings|\.env|\.config\.|package\.json|tsconfig|webpack/i.test(fileName);

        // Check for documentation
        const isDocFile = /readme|changelog|license|contributing|docs?\//i.test(filePath);

        const type = isTestFile ? 'test' :
                     isConfigFile ? 'config' :
                     isDocFile ? 'documentation' :
                     typeMapping[extension] || 'unknown';

        return {
            extension,
            type,
            fileName,
            isTestFile,
            isConfigFile,
            isDocFile,
            purpose: this.detectFilePurpose(fileName, content)
        };
    }

    /**
     * Detect file purpose from name and content
     * @param {string} fileName - File name
     * @param {string} content - File content
     * @returns {string} File purpose
     */
    detectFilePurpose(fileName, content) {
        const name = fileName.toLowerCase();
        
        // Common file purposes
        if (name.includes('controller') || name.includes('handler')) return 'controller';
        if (name.includes('model') || name.includes('entity')) return 'model';
        if (name.includes('service') || name.includes('manager')) return 'service';
        if (name.includes('util') || name.includes('helper')) return 'utility';
        if (name.includes('component') || name.includes('widget')) return 'component';
        if (name.includes('view') || name.includes('template')) return 'view';
        if (name.includes('middleware') || name.includes('interceptor')) return 'middleware';
        if (name.includes('router') || name.includes('route')) return 'routing';
        if (name.includes('api') || name.includes('endpoint')) return 'api';
        if (name.includes('database') || name.includes('db')) return 'database';
        if (name.includes('auth') || name.includes('security')) return 'authentication';
        if (name.includes('test') || name.includes('spec')) return 'testing';
        if (name.includes('config') || name.includes('setting')) return 'configuration';
        if (name.includes('index') || name.includes('main')) return 'entry_point';

        // Content-based detection
        if (content) {
            if (/export\s+default|module\.exports|public\s+class/.test(content)) return 'module';
            if (/function\s+main|if\s+__name__\s*==\s*['""]__main__['""]/.test(content)) return 'entry_point';
            if (/import.*test|describe\s*\(|it\s*\(|def\s+test_/.test(content)) return 'testing';
        }

        return 'general';
    }

    /**
     * Analyze code structure
     * @param {Object} astData - AST data
     * @param {string} content - Source code
     * @returns {Promise<Object>} Structure analysis
     */
    async analyzeStructure(astData, content) {
        const structure = {
            functions: astData.functions?.length || 0,
            classes: astData.classes?.length || 0,
            imports: astData.imports?.length || 0,
            exports: astData.exports?.length || 0,
            lines: {
                total: content.split('\n').length,
                code: this.countCodeLines(content),
                comments: this.countCommentLines(content),
                blank: this.countBlankLines(content)
            },
            complexity: {
                average: 0,
                maximum: 0,
                distribution: []
            }
        };

        // Calculate complexity distribution
        if (astData.functions && astData.functions.length > 0) {
            const complexities = astData.functions
                .map(func => func.complexity || 1)
                .filter(c => c > 0);

            structure.complexity.average = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
            structure.complexity.maximum = Math.max(...complexities);
            structure.complexity.distribution = this.getComplexityDistribution(complexities);
        }

        return structure;
    }

    /**
     * Count code lines (non-comment, non-blank)
     * @param {string} content - Source code
     * @returns {number} Code line count
     */
    countCodeLines(content) {
        return content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && 
                   !trimmed.startsWith('//') && 
                   !trimmed.startsWith('#') &&
                   !trimmed.startsWith('/*') &&
                   !trimmed.startsWith('*');
        }).length;
    }

    /**
     * Count comment lines
     * @param {string} content - Source code
     * @returns {number} Comment line count
     */
    countCommentLines(content) {
        return content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('//') || 
                   trimmed.startsWith('#') ||
                   trimmed.startsWith('/*') ||
                   trimmed.startsWith('*') ||
                   trimmed.startsWith('"""') ||
                   trimmed.startsWith("'''");
        }).length;
    }

    /**
     * Count blank lines
     * @param {string} content - Source code
     * @returns {number} Blank line count
     */
    countBlankLines(content) {
        return content.split('\n').filter(line => line.trim().length === 0).length;
    }

    /**
     * Get complexity distribution
     * @param {Array} complexities - Array of complexity values
     * @returns {Object} Complexity distribution
     */
    getComplexityDistribution(complexities) {
        const distribution = { low: 0, medium: 0, high: 0, veryHigh: 0 };
        
        complexities.forEach(complexity => {
            if (complexity <= 3) distribution.low++;
            else if (complexity <= 6) distribution.medium++;
            else if (complexity <= 10) distribution.high++;
            else distribution.veryHigh++;
        });

        return distribution;
    }

    /**
     * Analyze generic patterns
     * @param {Object} astData - AST data
     * @param {string} content - Source code
     * @param {string} language - Programming language
     * @returns {Promise<Object>} Pattern analysis
     */
    async analyzeGenericPatterns(astData, content, language) {
        // Use Phase 2.1 CodeAnalyzer for base analysis
        const basePatterns = await this.codeAnalyzer.analyzePatterns(astData, language, null, content);

        // Add generic patterns
        const genericPatterns = {
            ...basePatterns,
            naming: this.analyzeNamingPatterns(astData, content),
            duplication: this.analyzeDuplication(content),
            structure: this.analyzeStructuralPatterns(content),
            errorHandling: this.analyzeGenericErrorHandling(content),
            logging: this.analyzeLoggingPatterns(content),
            security: this.analyzeSecurityPatterns(content)
        };

        return genericPatterns;
    }

    /**
     * Analyze naming patterns
     * @param {Object} astData - AST data
     * @param {string} content - Source code
     * @returns {Array} Naming patterns
     */
    analyzeNamingPatterns(astData, content) {
        const patterns = [];
        const functions = astData.functions || [];

        // Analyze function naming conventions
        const namingStyles = {
            camelCase: functions.filter(f => /^[a-z][a-zA-Z0-9]*$/.test(f.name)),
            PascalCase: functions.filter(f => /^[A-Z][a-zA-Z0-9]*$/.test(f.name)),
            snake_case: functions.filter(f => /^[a-z][a-z0-9_]*$/.test(f.name)),
            kebab_case: functions.filter(f => /^[a-z][a-z0-9-]*$/.test(f.name))
        };

        Object.entries(namingStyles).forEach(([style, funcs]) => {
            if (funcs.length > 0) {
                patterns.push({
                    type: `${style.toLowerCase()}_naming`,
                    count: funcs.length,
                    description: `${style} naming convention`,
                    confidence: 0.8
                });
            }
        });

        // Check for descriptive names
        const shortNames = functions.filter(f => f.name && f.name.length < 4);
        if (shortNames.length > 0) {
            patterns.push({
                type: 'short_names',
                count: shortNames.length,
                description: 'Functions with very short names',
                confidence: 0.7,
                quality: 'poor'
            });
        }

        return patterns;
    }

    /**
     * Analyze code duplication
     * @param {string} content - Source code
     * @returns {Array} Duplication patterns
     */
    analyzeDuplication(content) {
        const patterns = [];
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 10);
        
        // Simple duplication detection (identical lines)
        const lineCount = {};
        lines.forEach(line => {
            lineCount[line] = (lineCount[line] || 0) + 1;
        });

        const duplicatedLines = Object.entries(lineCount).filter(([line, count]) => count > 1);
        
        if (duplicatedLines.length > 0) {
            const totalDuplication = duplicatedLines.reduce((sum, [line, count]) => sum + count - 1, 0);
            patterns.push({
                type: 'line_duplication',
                count: duplicatedLines.length,
                totalDuplication,
                description: 'Duplicated code lines detected',
                confidence: 0.8,
                quality: 'poor'
            });
        }

        return patterns;
    }

    /**
     * Analyze structural patterns
     * @param {string} content - Source code
     * @returns {Array} Structural patterns
     */
    analyzeStructuralPatterns(content) {
        const patterns = [];

        // Analyze nesting depth
        const maxDepth = this.calculateMaxNestingDepth(content);
        if (maxDepth > 4) {
            patterns.push({
                type: 'deep_nesting',
                depth: maxDepth,
                description: 'Deep nesting detected',
                confidence: 0.9,
                quality: 'poor'
            });
        }

        // Analyze long lines
        const longLines = content.split('\n').filter(line => line.length > 120);
        if (longLines.length > 0) {
            patterns.push({
                type: 'long_lines',
                count: longLines.length,
                description: 'Lines exceeding 120 characters',
                confidence: 0.8,
                quality: 'poor'
            });
        }

        return patterns;
    }

    /**
     * Calculate maximum nesting depth
     * @param {string} content - Source code
     * @returns {number} Maximum nesting depth
     */
    calculateMaxNestingDepth(content) {
        let maxDepth = 0;
        let currentDepth = 0;

        const lines = content.split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            
            // Count opening braces/blocks
            const opens = (trimmed.match(/[{([]|\bif\b|\bfor\b|\bwhile\b|\btry\b/g) || []).length;
            const closes = (trimmed.match(/[})\]]/g) || []).length;
            
            currentDepth += opens - closes;
            maxDepth = Math.max(maxDepth, currentDepth);
            
            // Ensure depth doesn't go negative
            currentDepth = Math.max(0, currentDepth);
        });

        return maxDepth;
    }

    /**
     * Analyze generic error handling patterns
     * @param {string} content - Source code
     * @returns {Array} Error handling patterns
     */
    analyzeGenericErrorHandling(content) {
        const patterns = [];

        // Try-catch patterns
        const tryCatchCount = (content.match(/try\s*{|except\s*:|catch\s*\(/g) || []).length;
        if (tryCatchCount > 0) {
            patterns.push({
                type: 'try_catch_blocks',
                count: tryCatchCount,
                description: 'Try-catch error handling blocks',
                confidence: 0.9
            });
        }

        // Error throwing patterns
        const throwCount = (content.match(/throw\s+|raise\s+|panic\s*\(/g) || []).length;
        if (throwCount > 0) {
            patterns.push({
                type: 'error_throwing',
                count: throwCount,
                description: 'Error throwing statements',
                confidence: 0.8
            });
        }

        return patterns;
    }

    /**
     * Analyze logging patterns
     * @param {string} content - Source code
     * @returns {Array} Logging patterns
     */
    analyzeLoggingPatterns(content) {
        const patterns = [];

        // Console/print logging
        const consoleCount = (content.match(/console\.|print\s*\(|log\.|logger\./g) || []).length;
        if (consoleCount > 0) {
            patterns.push({
                type: 'logging_statements',
                count: consoleCount,
                description: 'Logging and print statements',
                confidence: 0.8
            });
        }

        // Debug statements
        const debugCount = (content.match(/debug|DEBUG|console\.debug/g) || []).length;
        if (debugCount > 0) {
            patterns.push({
                type: 'debug_statements',
                count: debugCount,
                description: 'Debug logging statements',
                confidence: 0.7
            });
        }

        return patterns;
    }

    /**
     * Analyze security patterns
     * @param {string} content - Source code
     * @returns {Array} Security patterns
     */
    analyzeSecurityPatterns(content) {
        const patterns = [];

        // Password/secret handling
        const secretPatterns = (content.match(/password|secret|key|token|auth/gi) || []).length;
        if (secretPatterns > 2) {
            patterns.push({
                type: 'secret_references',
                count: secretPatterns,
                description: 'References to passwords, secrets, or auth tokens',
                confidence: 0.6,
                security: 'review_needed'
            });
        }

        // SQL injection patterns
        if (/sql.*\+|query.*\+|\$.*sql|exec\s*\(.*\+/.test(content)) {
            patterns.push({
                type: 'potential_sql_injection',
                description: 'Potential SQL injection vulnerability',
                confidence: 0.7,
                security: 'high_risk'
            });
        }

        return patterns;
    }

    /**
     * Analyze documentation
     * @param {string} content - Source code
     * @returns {Object} Documentation analysis
     */
    analyzeDocumentation(content) {
        const analysis = {
            hasComments: false,
            commentDensity: 0,
            hasDocstrings: false,
            hasInlineComments: false,
            patterns: []
        };

        const lines = content.split('\n');
        const commentLines = this.countCommentLines(content);
        const codeLines = this.countCodeLines(content);

        analysis.hasComments = commentLines > 0;
        analysis.commentDensity = codeLines > 0 ? (commentLines / codeLines) * 100 : 0;

        // Check for docstrings/documentation blocks
        analysis.hasDocstrings = /\/\*\*|"""|\'\'\'/g.test(content);

        // Check for inline comments
        analysis.hasInlineComments = /\/\/.*\S|#.*\S/.test(content);

        // Analyze comment patterns
        if (analysis.commentDensity > 20) {
            analysis.patterns.push({
                type: 'well_documented',
                description: 'Good comment coverage',
                confidence: 0.8,
                quality: 'good'
            });
        } else if (analysis.commentDensity < 5) {
            analysis.patterns.push({
                type: 'under_documented',
                description: 'Low comment coverage',
                confidence: 0.8,
                quality: 'poor'
            });
        }

        return analysis;
    }

    /**
     * Analyze testing patterns
     * @param {string} content - Source code
     * @param {string} filePath - File path
     * @returns {Object} Testing analysis
     */
    analyzeTesting(content, filePath) {
        const analysis = {
            isTestFile: false,
            hasTests: false,
            testFramework: 'unknown',
            patterns: []
        };

        // Detect if this is a test file
        analysis.isTestFile = /test|spec|__tests__|\.test\.|\.spec\.|_test\.|_spec\./i.test(filePath);

        // Common testing patterns
        const testPatterns = [
            { pattern: /describe\s*\(|it\s*\(|test\s*\(/, framework: 'jest/mocha', name: 'describe_it_blocks' },
            { pattern: /def\s+test_|class.*Test|@test/i, framework: 'pytest/unittest', name: 'python_tests' },
            { pattern: /func\s+Test\w+|t\s*\*testing\.T/, framework: 'go_testing', name: 'go_tests' },
            { pattern: /\[Test\]|Assert\.|Should\./, framework: 'nunit/xunit', name: 'dotnet_tests' },
            { pattern: /expect\s*\(|assert\s*\(|should\s*\(/, framework: 'assertion_library', name: 'assertions' }
        ];

        testPatterns.forEach(({ pattern, framework, name }) => {
            if (pattern.test(content)) {
                analysis.hasTests = true;
                if (analysis.testFramework === 'unknown') {
                    analysis.testFramework = framework;
                }
                analysis.patterns.push({
                    type: name,
                    description: `${framework} testing patterns`,
                    confidence: 0.8
                });
            }
        });

        return analysis;
    }

    /**
     * Analyze configuration patterns
     * @param {string} content - Source code
     * @param {string} filePath - File path
     * @returns {Object} Configuration analysis
     */
    analyzeConfiguration(content, filePath) {
        const analysis = {
            isConfigFile: false,
            configType: 'unknown',
            hasEnvironmentVars: false,
            patterns: []
        };

        // Detect configuration files
        const fileName = filePath.split('/').pop() || '';
        analysis.isConfigFile = /config|settings|\.env|package\.json|tsconfig|webpack|babel/i.test(fileName);

        // Detect configuration types
        if (fileName.endsWith('.json')) analysis.configType = 'json';
        else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) analysis.configType = 'yaml';
        else if (fileName.endsWith('.toml')) analysis.configType = 'toml';
        else if (fileName.endsWith('.ini')) analysis.configType = 'ini';
        else if (fileName.includes('.env')) analysis.configType = 'env';

        // Check for environment variable usage
        analysis.hasEnvironmentVars = /process\.env|os\.environ|ENV\[|getenv\(/i.test(content);

        // Configuration patterns
        if (analysis.hasEnvironmentVars) {
            analysis.patterns.push({
                type: 'environment_variables',
                description: 'Uses environment variables for configuration',
                confidence: 0.9
            });
        }

        if (analysis.isConfigFile) {
            analysis.patterns.push({
                type: 'configuration_file',
                description: `${analysis.configType.toUpperCase()} configuration file`,
                confidence: 0.95
            });
        }

        return analysis;
    }

    /**
     * Analyze complexity using Phase 2.1 components
     * @param {Object} astData - AST data
     * @param {string} content - Source code
     * @param {string} language - Programming language
     * @returns {Promise<Object>} Complexity analysis
     */
    async analyzeComplexity(astData, content, language) {
        return await this.complexityScorer.calculateComplexity(astData, language, content);
    }

    /**
     * Analyze code quality
     * @param {Object} astData - AST data
     * @param {string} content - Source code
     * @param {string} filePath - File path
     * @returns {Promise<Object>} Code quality analysis
     */
    async analyzeCodeQuality(astData, content, filePath) {
        const quality = {
            score: 10,
            issues: [],
            suggestions: []
        };

        const structure = await this.analyzeStructure(astData, content);

        // Check line count
        if (structure.lines.total > 500) {
            quality.score -= 0.5;
            quality.issues.push({
                type: 'large_file',
                severity: 'low',
                lineCount: structure.lines.total,
                message: 'File is quite large'
            });
            quality.suggestions.push('Consider splitting large files into smaller, focused modules');
        }

        // Check comment density
        const commentDensity = structure.lines.code > 0 ? 
            (structure.lines.comments / structure.lines.code) * 100 : 0;

        if (commentDensity < 5) {
            quality.score -= 0.8;
            quality.issues.push({
                type: 'low_documentation',
                severity: 'medium',
                density: Math.round(commentDensity),
                message: 'Low comment density'
            });
            quality.suggestions.push('Add more comments to explain complex logic and intent');
        }

        // Check complexity distribution
        if (structure.complexity.maximum > 10) {
            quality.score -= 1.0;
            quality.issues.push({
                type: 'high_complexity',
                severity: 'high',
                maxComplexity: structure.complexity.maximum,
                message: 'Very high complexity functions detected'
            });
            quality.suggestions.push('Refactor complex functions into smaller, simpler ones');
        }

        // Check for potential issues from patterns
        const patterns = await this.analyzeGenericPatterns(astData, content, 'unknown');
        
        if (patterns.duplication && patterns.duplication.length > 0) {
            quality.score -= 0.5;
            quality.issues.push({
                type: 'code_duplication',
                severity: 'medium',
                message: 'Code duplication detected'
            });
            quality.suggestions.push('Extract duplicated code into reusable functions or constants');
        }

        return quality;
    }

    /**
     * Generate generic recommendations
     * @param {Object} analysis - Complete analysis results
     * @returns {Array} Recommendations
     */
    generateGenericRecommendations(analysis) {
        const recommendations = [];

        // File organization recommendations
        if (analysis.structure.lines.total > 500) {
            recommendations.push({
                type: 'file_organization',
                priority: 'medium',
                message: 'Consider splitting large files',
                details: [
                    'Break down large files into smaller, focused modules',
                    'Use clear naming conventions for split modules',
                    'Maintain logical separation of concerns',
                    `Current file has ${analysis.structure.lines.total} lines`
                ]
            });
        }

        // Documentation recommendations
        if (analysis.documentation.commentDensity < 10) {
            recommendations.push({
                type: 'documentation',
                priority: 'medium',
                message: 'Improve code documentation',
                details: [
                    'Add comments to explain complex logic',
                    'Document function parameters and return values',
                    'Include examples for non-obvious behavior',
                    `Current comment density: ${Math.round(analysis.documentation.commentDensity)}%`
                ]
            });
        }

        // Complexity recommendations
        if (analysis.complexity.overall && analysis.complexity.overall.average > 6) {
            recommendations.push({
                type: 'complexity_reduction',
                priority: 'high',
                message: 'Reduce code complexity',
                details: [
                    'Break down complex functions into smaller ones',
                    'Extract repeated logic into helper functions',
                    'Use early returns to reduce nesting',
                    'Consider design patterns for complex operations'
                ]
            });
        }

        // Quality recommendations
        if (analysis.codeQuality.score < 7) {
            recommendations.push({
                type: 'code_quality',
                priority: 'high',
                message: 'Improve overall code quality',
                details: [
                    'Address code quality issues identified',
                    'Follow consistent naming conventions',
                    'Reduce code duplication',
                    'Improve error handling and logging'
                ]
            });
        }

        // Testing recommendations
        if (!analysis.testing.hasTests && analysis.fileType.type === 'source') {
            recommendations.push({
                type: 'testing',
                priority: 'medium',
                message: 'Add comprehensive tests',
                details: [
                    'Create unit tests for main functionality',
                    'Test both success and failure scenarios',
                    'Use appropriate testing framework for the language',
                    'Aim for good test coverage'
                ]
            });
        }

        // Security recommendations
        const securityPatterns = analysis.patterns.security || [];
        const hasSecurityConcerns = securityPatterns.some(p => p.security);
        
        if (hasSecurityConcerns) {
            recommendations.push({
                type: 'security',
                priority: 'high',
                message: 'Review security implications',
                details: [
                    'Review handling of sensitive data',
                    'Use parameterized queries to prevent injection',
                    'Validate and sanitize user inputs',
                    'Use secure methods for authentication'
                ]
            });
        }

        return recommendations;
    }
}

export default GenericAnalyzer;
