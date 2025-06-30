/**
 * Advanced Dependency Mapper for AST Integration Phase 2.1
 * 
 * Builds sophisticated dependency graphs and relationship analysis
 * beyond basic import statements. Tracks function calls, inheritance,
 * and cross-file relationships for better code understanding.
 * 
 * @author Task Master Flow
 * @version 2.1.0
 */

import path from 'path';

/**
 * Advanced dependency mapping and relationship analysis
 */
export class DependencyMapper {
    constructor(options = {}) {
        this.options = {
            enableFunctionCallAnalysis: true,
            enableInheritanceAnalysis: true,
            enableCircularDependencyDetection: true,
            enableCrossFileAnalysis: true,
            maxDepth: 5, // Maximum depth for dependency traversal
            ...options
        };
        
        // Storage for analysis results
        this.dependencyGraph = new Map();
        this.functionCallGraph = new Map();
        this.inheritanceGraph = new Map();
        this.circularDependencies = [];
    }

    /**
     * Build comprehensive dependency graph for project files
     * @param {Map} projectFiles - Map of file paths to AST data
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Complete dependency analysis
     */
    async buildDependencyGraph(projectFiles, options = {}) {
        try {
            // Reset analysis state
            this.reset();
            
            const analysis = {
                timestamp: new Date().toISOString(),
                totalFiles: projectFiles.size,
                dependencies: {},
                functionCalls: {},
                inheritance: {},
                circularDependencies: [],
                dependencyTypes: {},
                impactAnalysis: {},
                statistics: {}
            };

            // Phase 1: Build basic import/export graph
            analysis.dependencies = this.buildImportExportGraph(projectFiles);

            // Phase 2: Analyze function call relationships
            if (this.options.enableFunctionCallAnalysis) {
                analysis.functionCalls = this.analyzeFunctionCalls(projectFiles);
            }

            // Phase 3: Analyze inheritance relationships
            if (this.options.enableInheritanceAnalysis) {
                analysis.inheritance = this.analyzeInheritance(projectFiles);
            }

            // Phase 4: Detect circular dependencies
            if (this.options.enableCircularDependencyDetection) {
                analysis.circularDependencies = this.detectCircularDependencies();
            }

            // Phase 5: Classify dependency types
            analysis.dependencyTypes = this.classifyDependencies(analysis.dependencies);

            // Phase 6: Generate impact analysis
            analysis.impactAnalysis = this.generateImpactAnalysis();

            // Phase 7: Calculate statistics
            analysis.statistics = this.calculateStatistics(analysis);

            return analysis;
        } catch (error) {
            console.error('Dependency mapping failed:', error.message);
            return this.createErrorAnalysis(error);
        }
    }

    /**
     * Build basic import/export dependency graph
     * @param {Map} projectFiles - Map of file paths to AST data
     * @returns {Object} Import/export relationships
     */
    buildImportExportGraph(projectFiles) {
        const graph = {};

        for (const [filePath, astData] of projectFiles) {
            graph[filePath] = {
                imports: [],
                exports: [],
                importedBy: [],
                internalDependencies: [],
                externalDependencies: []
            };

            const imports = astData.imports || [];
            const functions = astData.functions || [];
            const classes = astData.classes || [];

            // Process imports
            imports.forEach(imp => {
                const dependency = {
                    source: imp.source,
                    imports: imp.imports || [],
                    defaultImport: imp.defaultImport,
                    namespaceImport: imp.namespaceImport,
                    lineNumber: imp.lineNumber,
                    isRelative: this.isRelativeImport(imp.source),
                    isExternal: this.isExternalPackage(imp.source)
                };

                graph[filePath].imports.push(dependency);

                // Classify dependency type
                if (dependency.isExternal) {
                    graph[filePath].externalDependencies.push(dependency);
                } else {
                    graph[filePath].internalDependencies.push(dependency);
                }

                // Store in main dependency graph
                this.dependencyGraph.set(filePath, graph[filePath]);
            });

            // Process exports (functions and classes marked as exported)
            const exports = [];
            
            functions.forEach(func => {
                if (func.isExported) {
                    exports.push({
                        type: 'function',
                        name: func.name,
                        lineNumber: func.lineStart
                    });
                }
            });

            classes.forEach(cls => {
                if (cls.isExported) {
                    exports.push({
                        type: 'class',
                        name: cls.name,
                        lineNumber: cls.lineStart
                    });
                }
            });

            graph[filePath].exports = exports;
        }

        // Build reverse relationships (importedBy)
        this.buildReverseRelationships(graph);

        return graph;
    }

    /**
     * Analyze function call relationships across files
     * @param {Map} projectFiles - Map of file paths to AST data
     * @returns {Object} Function call relationships
     */
    analyzeFunctionCalls(projectFiles) {
        const callGraph = {};

        for (const [filePath, astData] of projectFiles) {
            callGraph[filePath] = {
                calls: [],
                calledBy: [],
                internalCalls: [],
                externalCalls: []
            };

            const functions = astData.functions || [];
            const content = astData.content || '';

            // Analyze function calls within each function
            functions.forEach(func => {
                const calls = this.extractFunctionCalls(content, func, projectFiles);
                callGraph[filePath].calls.push(...calls);

                // Classify calls
                calls.forEach(call => {
                    if (call.isExternal) {
                        callGraph[filePath].externalCalls.push(call);
                    } else {
                        callGraph[filePath].internalCalls.push(call);
                    }
                });
            });

            this.functionCallGraph.set(filePath, callGraph[filePath]);
        }

        // Build reverse relationships for function calls
        this.buildFunctionCallReverseRelationships(callGraph);

        return callGraph;
    }

    /**
     * Analyze class inheritance relationships
     * @param {Map} projectFiles - Map of file paths to AST data
     * @returns {Object} Inheritance relationships
     */
    analyzeInheritance(projectFiles) {
        const inheritanceGraph = {};

        for (const [filePath, astData] of projectFiles) {
            inheritanceGraph[filePath] = {
                extends: [],
                extendedBy: [],
                implements: [],
                implementedBy: []
            };

            const classes = astData.classes || [];
            const content = astData.content || '';

            classes.forEach(cls => {
                // Extract inheritance information
                const inheritance = this.extractInheritanceInfo(content, cls, projectFiles);
                
                if (inheritance.extends.length > 0) {
                    inheritanceGraph[filePath].extends.push(...inheritance.extends);
                }

                if (inheritance.implements.length > 0) {
                    inheritanceGraph[filePath].implements.push(...inheritance.implements);
                }
            });

            this.inheritanceGraph.set(filePath, inheritanceGraph[filePath]);
        }

        // Build reverse relationships for inheritance
        this.buildInheritanceReverseRelationships(inheritanceGraph);

        return inheritanceGraph;
    }

    /**
     * Detect circular dependencies in the dependency graph
     * @returns {Array} Array of circular dependency chains
     */
    detectCircularDependencies() {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];

        const detectCycle = (node, path = []) => {
            if (recursionStack.has(node)) {
                // Found a cycle
                const cycleStart = path.indexOf(node);
                const cycle = path.slice(cycleStart).concat([node]);
                cycles.push({
                    type: 'import_dependency',
                    cycle,
                    length: cycle.length - 1,
                    severity: this.calculateCycleSeverity(cycle)
                });
                return true;
            }

            if (visited.has(node)) {
                return false;
            }

            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            // Check dependencies
            const deps = this.dependencyGraph.get(node);
            if (deps) {
                for (const dep of deps.internalDependencies) {
                    const resolvedPath = this.resolveImportPath(dep.source, node);
                    if (resolvedPath && detectCycle(resolvedPath, [...path])) {
                        // Continue searching for more cycles
                    }
                }
            }

            recursionStack.delete(node);
            path.pop();
            return false;
        };

        // Check each file for cycles
        for (const filePath of this.dependencyGraph.keys()) {
            if (!visited.has(filePath)) {
                detectCycle(filePath);
            }
        }

        this.circularDependencies = cycles;
        return cycles;
    }

    /**
     * Classify dependencies by type and importance
     * @param {Object} dependencies - Dependency graph
     * @returns {Object} Classified dependencies
     */
    classifyDependencies(dependencies) {
        const classification = {
            core: [],           // Core business logic
            utilities: [],      // Utility functions
            external: [],       // External packages
            testing: [],        // Test dependencies
            infrastructure: [], // Build/config files
            ui: []             // UI components
        };

        for (const [filePath, deps] of Object.entries(dependencies)) {
            const fileType = this.classifyFileType(filePath, deps);
            
            const fileInfo = {
                filePath,
                type: fileType,
                importCount: deps.imports.length,
                exportCount: deps.exports.length,
                dependencyScore: this.calculateDependencyScore(deps)
            };

            classification[fileType].push(fileInfo);
        }

        return classification;
    }

    /**
     * Generate impact analysis for dependency changes
     * @returns {Object} Impact analysis results
     */
    generateImpactAnalysis() {
        const impact = {};

        for (const [filePath, deps] of this.dependencyGraph) {
            impact[filePath] = {
                directDependents: this.getDirectDependents(filePath),
                transitiveImpact: this.getTransitiveImpact(filePath),
                criticalityScore: this.calculateCriticalityScore(filePath),
                changeBlastRadius: this.calculateChangeBlastRadius(filePath)
            };
        }

        return impact;
    }

    /**
     * Calculate comprehensive statistics
     * @param {Object} analysis - Complete analysis results
     * @returns {Object} Statistics
     */
    calculateStatistics(analysis) {
        const stats = {
            totalFiles: analysis.totalFiles,
            totalDependencies: 0,
            averageDependenciesPerFile: 0,
            maxDependencies: 0,
            circularDependencyCount: analysis.circularDependencies.length,
            externalPackageCount: 0,
            mostConnectedFiles: [],
            dependencyComplexity: 'low'
        };

        let totalDeps = 0;
        let maxDeps = 0;
        const connectionCounts = [];

        for (const [filePath, deps] of Object.entries(analysis.dependencies)) {
            const depCount = deps.imports.length;
            totalDeps += depCount;
            maxDeps = Math.max(maxDeps, depCount);
            
            connectionCounts.push({
                filePath,
                connections: depCount + deps.importedBy.length
            });
        }

        stats.totalDependencies = totalDeps;
        stats.averageDependenciesPerFile = totalDeps / analysis.totalFiles;
        stats.maxDependencies = maxDeps;

        // Find most connected files
        stats.mostConnectedFiles = connectionCounts
            .sort((a, b) => b.connections - a.connections)
            .slice(0, 5);

        // Calculate complexity
        if (stats.averageDependenciesPerFile > 10 || stats.circularDependencyCount > 0) {
            stats.dependencyComplexity = 'high';
        } else if (stats.averageDependenciesPerFile > 5) {
            stats.dependencyComplexity = 'medium';
        }

        return stats;
    }

    // Helper methods

    /**
     * Reset analysis state
     */
    reset() {
        this.dependencyGraph.clear();
        this.functionCallGraph.clear();
        this.inheritanceGraph.clear();
        this.circularDependencies = [];
    }

    /**
     * Check if import is relative
     * @param {string} source - Import source
     * @returns {boolean} True if relative import
     */
    isRelativeImport(source) {
        return source.startsWith('./') || source.startsWith('../');
    }

    /**
     * Check if import is external package
     * @param {string} source - Import source
     * @returns {boolean} True if external package
     */
    isExternalPackage(source) {
        return !this.isRelativeImport(source) && !source.startsWith('/');
    }

    /**
     * Build reverse relationships (importedBy)
     * @param {Object} graph - Dependency graph
     */
    buildReverseRelationships(graph) {
        for (const [filePath, deps] of Object.entries(graph)) {
            deps.internalDependencies.forEach(dep => {
                const resolvedPath = this.resolveImportPath(dep.source, filePath);
                if (resolvedPath && graph[resolvedPath]) {
                    graph[resolvedPath].importedBy.push({
                        filePath,
                        imports: dep.imports
                    });
                }
            });
        }
    }

    /**
     * Resolve import path to absolute path
     * @param {string} importPath - Import path
     * @param {string} fromFile - Importing file path
     * @returns {string|null} Resolved absolute path
     */
    resolveImportPath(importPath, fromFile) {
        if (this.isRelativeImport(importPath)) {
            const dir = path.dirname(fromFile);
            return path.resolve(dir, importPath);
        }
        return null; // External package
    }

    /**
     * Extract function calls from content
     * @param {string} content - File content
     * @param {Object} func - Function AST data
     * @param {Map} projectFiles - All project files
     * @returns {Array} Function calls
     */
    extractFunctionCalls(content, func, projectFiles) {
        const calls = [];
        
        // Simple regex-based function call detection
        // This could be enhanced with proper AST traversal
        const functionCallRegex = /(\w+)\s*\(/g;
        let match;
        
        while ((match = functionCallRegex.exec(content)) !== null) {
            const calledFunction = match[1];
            
            // Skip common keywords
            if (['if', 'for', 'while', 'switch', 'return'].includes(calledFunction)) {
                continue;
            }
            
            calls.push({
                caller: func.name,
                callee: calledFunction,
                lineNumber: this.getLineNumber(content, match.index),
                isExternal: this.isExternalFunction(calledFunction, projectFiles)
            });
        }
        
        return calls;
    }

    /**
     * Extract inheritance information
     * @param {string} content - File content
     * @param {Object} cls - Class AST data
     * @param {Map} projectFiles - All project files
     * @returns {Object} Inheritance info
     */
    extractInheritanceInfo(content, cls, projectFiles) {
        const inheritance = {
            extends: [],
            implements: []
        };

        // Language-specific inheritance detection
        // JavaScript/TypeScript: class A extends B
        const extendsRegex = new RegExp(`class\\s+${cls.name}\\s+extends\\s+(\\w+)`, 'g');
        const extendsMatch = extendsRegex.exec(content);
        
        if (extendsMatch) {
            inheritance.extends.push({
                className: cls.name,
                parentClass: extendsMatch[1],
                lineNumber: cls.lineStart
            });
        }

        return inheritance;
    }

    /**
     * Classify file type based on path and dependencies
     * @param {string} filePath - File path
     * @param {Object} deps - Dependency info
     * @returns {string} File type classification
     */
    classifyFileType(filePath) {
        const lowerPath = filePath.toLowerCase();
        
        if (lowerPath.includes('test') || lowerPath.includes('spec')) {
            return 'testing';
        }
        if (lowerPath.includes('util') || lowerPath.includes('helper')) {
            return 'utilities';
        }
        if (lowerPath.includes('component') || lowerPath.includes('ui')) {
            return 'ui';
        }
        if (lowerPath.includes('config') || lowerPath.includes('build')) {
            return 'infrastructure';
        }
        
        return 'core';
    }

    /**
     * Calculate dependency score for a file
     * @param {Object} deps - Dependency info
     * @returns {number} Dependency score
     */
    calculateDependencyScore(deps) {
        const importWeight = 1;
        const exportWeight = 2;
        const importedByWeight = 3;
        
        return (deps.imports.length * importWeight) +
               (deps.exports.length * exportWeight) +
               (deps.importedBy.length * importedByWeight);
    }

    /**
     * Get direct dependents of a file
     * @param {string} filePath - File path
     * @returns {Array} Direct dependents
     */
    getDirectDependents(filePath) {
        const deps = this.dependencyGraph.get(filePath);
        return deps ? deps.importedBy.map(dep => dep.filePath) : [];
    }

    /**
     * Get transitive impact of changes to a file
     * @param {string} filePath - File path
     * @returns {Array} All files transitively affected
     */
    getTransitiveImpact(filePath, visited = new Set()) {
        if (visited.has(filePath)) {
            return [];
        }
        
        visited.add(filePath);
        const impact = [];
        const directDependents = this.getDirectDependents(filePath);
        
        directDependents.forEach(dependent => {
            impact.push(dependent);
            impact.push(...this.getTransitiveImpact(dependent, visited));
        });
        
        return [...new Set(impact)];
    }

    /**
     * Calculate criticality score for a file
     * @param {string} filePath - File path
     * @returns {number} Criticality score (0-10)
     */
    calculateCriticalityScore(filePath) {
        const directDependents = this.getDirectDependents(filePath).length;
        const transitiveImpact = this.getTransitiveImpact(filePath).length;
        
        // Score based on how many files depend on this one
        const score = Math.min(10, (directDependents * 2) + (transitiveImpact * 0.5));
        return Math.round(score * 10) / 10;
    }

    /**
     * Calculate change blast radius
     * @param {string} filePath - File path
     * @returns {number} Number of files affected by changes
     */
    calculateChangeBlastRadius(filePath) {
        return this.getTransitiveImpact(filePath).length;
    }

    /**
     * Calculate cycle severity
     * @param {Array} cycle - Circular dependency cycle
     * @returns {string} Severity level
     */
    calculateCycleSeverity(cycle) {
        if (cycle.length <= 3) return 'low';
        if (cycle.length <= 5) return 'medium';
        return 'high';
    }

    /**
     * Get line number from content offset
     * @param {string} content - File content
     * @param {number} offset - Character offset
     * @returns {number} Line number
     */
    getLineNumber(content, offset) {
        return content.substring(0, offset).split('\n').length;
    }

    /**
     * Check if function is external
     * @param {string} functionName - Function name
     * @param {Map} projectFiles - Project files
     * @returns {boolean} True if external
     */
    isExternalFunction(functionName, projectFiles) {
        // Simple check - could be enhanced
        return ['console', 'parseInt', 'parseFloat', 'setTimeout', 'setInterval'].includes(functionName);
    }

    /**
     * Build reverse relationships for function calls
     * @param {Object} callGraph - Function call graph
     */
    buildFunctionCallReverseRelationships(callGraph) {
        for (const [filePath, calls] of Object.entries(callGraph)) {
            calls.internalCalls.forEach(call => {
                // Find files containing the called function
                // This is simplified - would need proper cross-file analysis
            });
        }
    }

    /**
     * Build reverse relationships for inheritance
     * @param {Object} inheritanceGraph - Inheritance graph
     */
    buildInheritanceReverseRelationships(inheritanceGraph) {
        for (const [filePath, inheritance] of Object.entries(inheritanceGraph)) {
            inheritance.extends.forEach(ext => {
                // Find files containing the parent class
                // This is simplified - would need proper cross-file analysis
            });
        }
    }

    /**
     * Create error analysis result
     * @param {Error} error - Error that occurred
     * @returns {Object} Error analysis
     */
    createErrorAnalysis(error) {
        return {
            timestamp: new Date().toISOString(),
            error: true,
            errorMessage: error.message,
            dependencies: {},
            functionCalls: {},
            inheritance: {},
            circularDependencies: [],
            dependencyTypes: {},
            impactAnalysis: {},
            statistics: { error: true, message: error.message }
        };
    }
}

export default DependencyMapper;
