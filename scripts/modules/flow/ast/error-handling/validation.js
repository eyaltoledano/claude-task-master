/**
 * AST Validation - Phase 4.3
 * 
 * Fast, simple validation system for AST parsing output.
 * Prioritizes speed and development workflow over exhaustive checking.
 * 
 * Key Features:
 * - Quick AST structure validation
 * - Development-friendly quality checks
 * - Fast consistency verification
 * - Simple confidence scoring
 * 
 * @author Task Master Flow
 * @version 4.3.0
 */

import { EventEmitter } from 'events';

/**
 * AST Validation System
 * 
 * Provides fast validation of AST parsing results.
 * Optimized for speed and development workflow.
 */
export class ASTValidator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enableStructureValidation: true,
            enableContentValidation: true,
            enableConsistencyChecks: true,
            maxValidationTime: 25, // 25ms max for validation
            minConfidenceScore: 0.3,
            ...options
        };
        
        // Validation statistics
        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            averageConfidence: 0,
            fastestValidation: Infinity,
            slowestValidation: 0
        };
        
        // Validation rules
        this.rules = this.initializeValidationRules();
        
        console.log('ASTValidator initialized for fast development quality assurance');
    }
    
    /**
     * Validate AST parsing result
     */
    async validateAST(result, filePath, originalContent, language) {
        const startTime = Date.now();
        this.stats.totalValidations++;
        
        try {
            const validation = await Promise.race([
                this.performValidation(result, filePath, originalContent, language),
                this.timeout(this.config.maxValidationTime)
            ]);
            
            const duration = Date.now() - startTime;
            this.stats.fastestValidation = Math.min(this.stats.fastestValidation, duration);
            this.stats.slowestValidation = Math.max(this.stats.slowestValidation, duration);
            
            if (validation.isValid) {
                this.stats.passedValidations++;
            } else {
                this.stats.failedValidations++;
            }
            
            // Update average confidence
            this.stats.averageConfidence = (
                (this.stats.averageConfidence * (this.stats.totalValidations - 1) + validation.confidence) /
                this.stats.totalValidations
            );
            
            this.emit('validation', {
                filePath,
                language,
                isValid: validation.isValid,
                confidence: validation.confidence,
                duration
            });
            
            return validation;
            
        } catch (error) {
            this.stats.failedValidations++;
            return {
                isValid: false,
                confidence: 0,
                errors: [error.message],
                warnings: [],
                suggestions: ['Validation timed out or failed']
            };
        }
    }
    
    /**
     * Perform comprehensive validation
     */
    async performValidation(result, filePath, originalContent, language) {
        const validation = {
            isValid: true,
            confidence: 1.0,
            errors: [],
            warnings: [],
            suggestions: [],
            checks: {}
        };
        
        // Structure validation
        if (this.config.enableStructureValidation) {
            const structureCheck = await this.validateStructure(result);
            validation.checks.structure = structureCheck;
            this.mergeValidationResult(validation, structureCheck);
        }
        
        // Content validation
        if (this.config.enableContentValidation) {
            const contentCheck = await this.validateContent(result, originalContent, language);
            validation.checks.content = contentCheck;
            this.mergeValidationResult(validation, contentCheck);
        }
        
        // Consistency validation
        if (this.config.enableConsistencyChecks) {
            const consistencyCheck = await this.validateConsistency(result, filePath, language);
            validation.checks.consistency = consistencyCheck;
            this.mergeValidationResult(validation, consistencyCheck);
        }
        
        // Calculate final confidence score
        validation.confidence = this.calculateConfidenceScore(validation.checks);
        validation.isValid = validation.confidence >= this.config.minConfidenceScore;
        
        return validation;
    }
    
    /**
     * Validate AST structure
     */
    async validateStructure(result) {
        const check = {
            isValid: true,
            confidence: 1.0,
            errors: [],
            warnings: [],
            details: {}
        };
        
        // Check required fields
        const requiredFields = ['functions', 'classes', 'imports', 'complexity'];
        for (const field of requiredFields) {
            if (!(field in result)) {
                check.errors.push(`Missing required field: ${field}`);
                check.confidence -= 0.2;
            } else if (!Array.isArray(result[field]) && field !== 'complexity') {
                check.errors.push(`Field ${field} should be an array`);
                check.confidence -= 0.15;
            }
        }
        
        // Validate functions structure
        if (result.functions) {
            const funcValidation = this.validateFunctions(result.functions);
            check.details.functions = funcValidation;
            if (!funcValidation.isValid) {
                check.warnings.push('Some function entries have issues');
                check.confidence -= 0.1;
            }
        }
        
        // Validate classes structure
        if (result.classes) {
            const classValidation = this.validateClasses(result.classes);
            check.details.classes = classValidation;
            if (!classValidation.isValid) {
                check.warnings.push('Some class entries have issues');
                check.confidence -= 0.1;
            }
        }
        
        // Validate imports structure
        if (result.imports) {
            const importValidation = this.validateImports(result.imports);
            check.details.imports = importValidation;
            if (!importValidation.isValid) {
                check.warnings.push('Some import entries have issues');
                check.confidence -= 0.05;
            }
        }
        
        // Validate complexity
        if (result.complexity !== undefined) {
            if (typeof result.complexity !== 'number' || result.complexity < 1) {
                check.warnings.push('Complexity should be a number >= 1');
                check.confidence -= 0.05;
            }
        }
        
        check.isValid = check.errors.length === 0;
        return check;
    }
    
    /**
     * Validate functions array
     */
    validateFunctions(functions) {
        const validation = {
            isValid: true,
            validCount: 0,
            invalidCount: 0,
            issues: []
        };
        
        if (!Array.isArray(functions)) {
            validation.isValid = false;
            validation.issues.push('Functions is not an array');
            return validation;
        }
        
        for (const func of functions) {
            const funcIssues = [];
            
            if (!func.name || typeof func.name !== 'string') {
                funcIssues.push('Missing or invalid function name');
            }
            
            if (func.lineStart !== undefined && (typeof func.lineStart !== 'number' || func.lineStart < 1)) {
                funcIssues.push('Invalid lineStart value');
            }
            
            if (func.complexity !== undefined && (typeof func.complexity !== 'number' || func.complexity < 1)) {
                funcIssues.push('Invalid complexity value');
            }
            
            if (funcIssues.length > 0) {
                validation.invalidCount++;
                validation.issues.push(`Function ${func.name || 'unknown'}: ${funcIssues.join(', ')}`);
            } else {
                validation.validCount++;
            }
        }
        
        validation.isValid = validation.invalidCount === 0;
        return validation;
    }
    
    /**
     * Validate classes array
     */
    validateClasses(classes) {
        const validation = {
            isValid: true,
            validCount: 0,
            invalidCount: 0,
            issues: []
        };
        
        if (!Array.isArray(classes)) {
            validation.isValid = false;
            validation.issues.push('Classes is not an array');
            return validation;
        }
        
        for (const cls of classes) {
            const classIssues = [];
            
            if (!cls.name || typeof cls.name !== 'string') {
                classIssues.push('Missing or invalid class name');
            }
            
            if (cls.methods !== undefined && !Array.isArray(cls.methods)) {
                classIssues.push('Methods should be an array');
            }
            
            if (classIssues.length > 0) {
                validation.invalidCount++;
                validation.issues.push(`Class ${cls.name || 'unknown'}: ${classIssues.join(', ')}`);
            } else {
                validation.validCount++;
            }
        }
        
        validation.isValid = validation.invalidCount === 0;
        return validation;
    }
    
    /**
     * Validate imports array
     */
    validateImports(imports) {
        const validation = {
            isValid: true,
            validCount: 0,
            invalidCount: 0,
            issues: []
        };
        
        if (!Array.isArray(imports)) {
            validation.isValid = false;
            validation.issues.push('Imports is not an array');
            return validation;
        }
        
        for (const imp of imports) {
            const importIssues = [];
            
            if (!imp.source || typeof imp.source !== 'string') {
                importIssues.push('Missing or invalid import source');
            }
            
            if (imp.type !== undefined && typeof imp.type !== 'string') {
                importIssues.push('Invalid import type');
            }
            
            if (importIssues.length > 0) {
                validation.invalidCount++;
                validation.issues.push(`Import ${imp.source || 'unknown'}: ${importIssues.join(', ')}`);
            } else {
                validation.validCount++;
            }
        }
        
        validation.isValid = validation.invalidCount === 0;
        return validation;
    }
    
    /**
     * Validate content against original
     */
    async validateContent(result, originalContent, language) {
        const check = {
            isValid: true,
            confidence: 1.0,
            errors: [],
            warnings: [],
            details: {}
        };
        
        // Quick content analysis
        const analysis = this.analyzeContent(originalContent, language);
        check.details.analysis = analysis;
        
        // Compare function counts
        if (result.functions) {
            const parsedCount = result.functions.length;
            const estimatedCount = analysis.estimatedFunctions;
            
            if (parsedCount < estimatedCount * 0.5) {
                check.warnings.push(`Parsed ${parsedCount} functions, estimated ${estimatedCount} - may be missing functions`);
                check.confidence -= 0.2;
            } else if (parsedCount > estimatedCount * 2) {
                check.warnings.push(`Parsed ${parsedCount} functions, estimated ${estimatedCount} - may have false positives`);
                check.confidence -= 0.1;
            }
        }
        
        // Compare class counts
        if (result.classes) {
            const parsedCount = result.classes.length;
            const estimatedCount = analysis.estimatedClasses;
            
            if (parsedCount < estimatedCount * 0.7) {
                check.warnings.push(`Parsed ${parsedCount} classes, estimated ${estimatedCount} - may be missing classes`);
                check.confidence -= 0.15;
            }
        }
        
        // Compare import counts
        if (result.imports) {
            const parsedCount = result.imports.length;
            const estimatedCount = analysis.estimatedImports;
            
            if (parsedCount < estimatedCount * 0.5) {
                check.warnings.push(`Parsed ${parsedCount} imports, estimated ${estimatedCount} - may be missing imports`);
                check.confidence -= 0.1;
            }
        }
        
        // Check complexity reasonableness
        if (result.complexity) {
            const estimatedComplexity = analysis.estimatedComplexity;
            if (result.complexity < estimatedComplexity * 0.3 || result.complexity > estimatedComplexity * 3) {
                check.warnings.push(`Complexity ${result.complexity} seems unusual (estimated ${estimatedComplexity})`);
                check.confidence -= 0.05;
            }
        }
        
        check.isValid = check.errors.length === 0;
        return check;
    }
    
    /**
     * Analyze original content for comparison
     */
    analyzeContent(content, language) {
        const lines = content.split('\n');
        const analysis = {
            totalLines: lines.length,
            codeLines: lines.filter(line => line.trim() && !this.isComment(line, language)).length,
            estimatedFunctions: 0,
            estimatedClasses: 0,
            estimatedImports: 0,
            estimatedComplexity: 1
        };
        
        // Language-specific estimation
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
                analysis.estimatedFunctions = (content.match(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>))/g) || []).length;
                analysis.estimatedClasses = (content.match(/class\s+\w+/g) || []).length;
                analysis.estimatedImports = (content.match(/import\s+.*from|require\s*\(/g) || []).length;
                break;
                
            case 'python':
                analysis.estimatedFunctions = (content.match(/def\s+\w+/g) || []).length;
                analysis.estimatedClasses = (content.match(/class\s+\w+/g) || []).length;
                analysis.estimatedImports = (content.match(/(?:from\s+\w+\s+import|import\s+\w+)/g) || []).length;
                break;
                
            case 'go':
                analysis.estimatedFunctions = (content.match(/func\s+(?:\([^)]*\)\s+)?\w+/g) || []).length;
                analysis.estimatedClasses = (content.match(/type\s+\w+\s+struct/g) || []).length;
                analysis.estimatedImports = (content.match(/import\s+(?:\(\s*[^)]+\s*\)|"[^"]+")/) || []).length;
                break;
                
            default:
                // Generic estimation
                analysis.estimatedFunctions = (content.match(/(function|def|func)\s+\w+/g) || []).length;
                analysis.estimatedClasses = (content.match(/(class|struct|type)\s+\w+/g) || []).length;
                analysis.estimatedImports = (content.match(/(import|include|require)/g) || []).length;
        }
        
        // Estimate complexity
        analysis.estimatedComplexity = Math.max(1, Math.floor(
            analysis.estimatedFunctions * 0.3 +
            analysis.estimatedClasses * 0.5 +
            (analysis.codeLines / 100)
        ));
        
        return analysis;
    }
    
    /**
     * Check if line is a comment
     */
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
                return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*');
        }
    }
    
    /**
     * Validate internal consistency
     */
    async validateConsistency(result, filePath, language) {
        const check = {
            isValid: true,
            confidence: 1.0,
            errors: [],
            warnings: [],
            details: {}
        };
        
        // Check for duplicate function names
        if (result.functions && result.functions.length > 0) {
            const names = result.functions.map(f => f.name).filter(Boolean);
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            
            if (duplicates.length > 0) {
                check.warnings.push(`Duplicate function names: ${[...new Set(duplicates)].join(', ')}`);
                check.confidence -= 0.1;
            }
        }
        
        // Check for duplicate class names
        if (result.classes && result.classes.length > 0) {
            const names = result.classes.map(c => c.name).filter(Boolean);
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            
            if (duplicates.length > 0) {
                check.warnings.push(`Duplicate class names: ${[...new Set(duplicates)].join(', ')}`);
                check.confidence -= 0.1;
            }
        }
        
        // Check for reasonable line numbers
        if (result.functions) {
            const invalidLines = result.functions.filter(f => f.lineStart && f.lineStart < 1);
            if (invalidLines.length > 0) {
                check.warnings.push(`${invalidLines.length} functions have invalid line numbers`);
                check.confidence -= 0.05;
            }
        }
        
        // Check complexity consistency
        if (result.complexity && result.functions) {
            const funcComplexity = result.functions.reduce((sum, f) => sum + (f.complexity || 1), 0);
            if (result.complexity < funcComplexity * 0.5 || result.complexity > funcComplexity * 3) {
                check.warnings.push(`Overall complexity (${result.complexity}) inconsistent with function complexities (${funcComplexity})`);
                check.confidence -= 0.05;
            }
        }
        
        check.isValid = check.errors.length === 0;
        return check;
    }
    
    /**
     * Merge validation results
     */
    mergeValidationResult(target, source) {
        target.errors.push(...source.errors);
        target.warnings.push(...source.warnings);
        target.confidence = Math.min(target.confidence, source.confidence);
    }
    
    /**
     * Calculate overall confidence score
     */
    calculateConfidenceScore(checks) {
        const weights = {
            structure: 0.5,
            content: 0.3,
            consistency: 0.2
        };
        
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const [checkName, checkResult] of Object.entries(checks)) {
            if (checkResult && weights[checkName]) {
                weightedSum += checkResult.confidence * weights[checkName];
                totalWeight += weights[checkName];
            }
        }
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    
    /**
     * Initialize validation rules
     */
    initializeValidationRules() {
        return {
            requiredFields: ['functions', 'classes', 'imports', 'complexity'],
            functionFields: ['name'],
            classFields: ['name'],
            importFields: ['source'],
            minComplexity: 1,
            maxComplexity: 100
        };
    }
    
    /**
     * Quick validation for development
     */
    async quickValidate(result) {
        if (!result || typeof result !== 'object') {
            return { isValid: false, confidence: 0, message: 'Invalid result object' };
        }
        
        // Basic structure check
        const hasRequiredFields = this.rules.requiredFields.every(field => field in result);
        if (!hasRequiredFields) {
            return { isValid: false, confidence: 0.2, message: 'Missing required fields' };
        }
        
        // Basic type checks
        if (!Array.isArray(result.functions) || !Array.isArray(result.classes) || !Array.isArray(result.imports)) {
            return { isValid: false, confidence: 0.3, message: 'Invalid field types' };
        }
        
        // Basic complexity check
        if (typeof result.complexity !== 'number' || result.complexity < 1) {
            return { isValid: false, confidence: 0.4, message: 'Invalid complexity' };
        }
        
        return { isValid: true, confidence: 0.8, message: 'Quick validation passed' };
    }
    
    /**
     * Helper methods
     */
    timeout(ms) {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout')), ms)
        );
    }
    
    /**
     * Get validation statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalValidations > 0 ? 
                (this.stats.passedValidations / this.stats.totalValidations) * 100 : 0,
            averageValidationTime: this.stats.totalValidations > 0 ? 
                (this.stats.slowestValidation + this.stats.fastestValidation) / 2 : 0
        };
    }
    
    /**
     * Reset statistics
     */
    resetStatistics() {
        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            averageConfidence: 0,
            fastestValidation: Infinity,
            slowestValidation: 0
        };
    }
}

/**
 * Factory function for creating AST validator
 */
export function createASTValidator(options = {}) {
    return new ASTValidator(options);
}

export default ASTValidator; 