/**
 * Cross-Language Analysis Component
 * Analyzes dependencies, patterns, and relationships across multiple programming languages
 * Builds on existing AST infrastructure for comprehensive multi-language project analysis
 */

import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

/**
 * Cross-Language Analyzer for multi-language project analysis
 */
export class CrossLanguageAnalyzer extends EventEmitter {
    constructor(parserRegistry, dependencyMapper, analyzers, options = {}) {
        super();
        
        this.parserRegistry = parserRegistry;
        this.dependencyMapper = dependencyMapper;
        this.analyzers = analyzers;
        
        this.supportedLanguages = ['javascript', 'typescript', 'python', 'go'];
        this.interfaceDetectors = new Map();
        this.crossLanguageGraph = new Map();
        
        this.options = {
            maxDepth: 10,
            includeExternal: true,
            detectAPIs: true,
            analyzeServices: true,
            ...options
        };

        this._initializeInterfaceDetectors();
    }

    /**
     * Initialize language-specific interface detectors
     */
    _initializeInterfaceDetectors() {
        this.interfaceDetectors.set('javascript', new JavaScriptInterfaceDetector());
        this.interfaceDetectors.set('typescript', new TypeScriptInterfaceDetector());
        this.interfaceDetectors.set('python', new PythonInterfaceDetector());
        this.interfaceDetectors.set('go', new GoInterfaceDetector());
    }

    /**
     * Analyze cross-language dependencies and patterns in a project
     */
    async analyzeCrossLanguageProject(projectPath) {
        this.emit('analysis:start', { projectPath });

        try {
            // 1. Discover and categorize all source files
            const sourceFiles = await this.discoverSourceFiles(projectPath);
            this.emit('analysis:discovery', { fileCount: sourceFiles.length });

            // 2. Parse all files with language-specific parsers
            const astResults = await this.parseAllLanguages(sourceFiles);
            this.emit('analysis:parsing', { parsedCount: astResults.length });

            // 3. Extract language-specific interfaces and APIs
            const interfaces = await this.extractInterfaces(astResults);
            this.emit('analysis:interfaces', { interfaceCount: interfaces.length });

            // 4. Build comprehensive cross-language dependency graph
            const dependencyGraph = await this.buildCrossLanguageGraph(astResults, interfaces);
            this.emit('analysis:dependencies', { nodeCount: dependencyGraph.nodes.size });

            // 5. Analyze cross-language patterns and relationships
            const patterns = await this.analyzeCrossLanguagePatterns(dependencyGraph, astResults);
            this.emit('analysis:patterns', { patternCount: patterns.length });

            // 6. Generate recommendations for improvement
            const recommendations = await this.generateRecommendations(dependencyGraph, patterns, interfaces);

            const result = {
                summary: {
                    projectPath,
                    languages: this.getLanguageDistribution(astResults),
                    totalFiles: sourceFiles.length,
                    crossLanguageDependencies: dependencyGraph.crossLanguageEdges.length,
                    interfaceCount: interfaces.length,
                    patternCount: patterns.length
                },
                dependencies: this.serializeDependencyGraph(dependencyGraph),
                interfaces,
                patterns,
                recommendations,
                metadata: {
                    analysisTimestamp: new Date().toISOString(),
                    analyzerVersion: '5.1.0',
                    options: this.options
                }
            };

            this.emit('analysis:complete', result.summary);
            return result;

        } catch (error) {
            this.emit('analysis:error', error);
            throw new CrossLanguageAnalysisError(`Analysis failed: ${error.message}`, error);
        }
    }

    /**
     * Discover source files across all supported languages
     */
    async discoverSourceFiles(projectPath) {
        const files = [];
        const extensions = {
            javascript: ['.js', '.jsx', '.mjs'],
            typescript: ['.ts', '.tsx'],
            python: ['.py', '.pyi'],
            go: ['.go']
        };

        const allExtensions = Object.values(extensions).flat();
        
        async function walkDirectory(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && 
                    !['node_modules', '__pycache__', 'vendor'].includes(entry.name)) {
                    await walkDirectory(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (allExtensions.includes(ext)) {
                        const language = Object.keys(extensions).find(lang => 
                            extensions[lang].includes(ext)
                        );
                        files.push({
                            path: fullPath,
                            relativePath: path.relative(projectPath, fullPath),
                            language,
                            extension: ext
                        });
                    }
                }
            }
        }

        await walkDirectory(projectPath);
        return files;
    }

    /**
     * Parse all discovered files using appropriate language parsers
     */
    async parseAllLanguages(sourceFiles) {
        const results = [];
        const parsePromises = sourceFiles.map(async (file) => {
            try {
                const parser = this.parserRegistry.getParser(file.language);
                if (!parser) {
                    return null;
                }

                const content = await fs.readFile(file.path, 'utf-8');
                const ast = await parser.parse(content, file.path);
                
                return {
                    file,
                    ast,
                    language: file.language,
                    parseSuccess: true
                };
            } catch (error) {
                return {
                    file,
                    ast: null,
                    language: file.language,
                    parseSuccess: false,
                    error: error.message
                };
            }
        });

        const parseResults = await Promise.allSettled(parsePromises);
        
        for (const result of parseResults) {
            if (result.status === 'fulfilled' && result.value) {
                results.push(result.value);
            }
        }

        return results;
    }

    /**
     * Extract interfaces and API definitions from parsed ASTs
     */
    async extractInterfaces(astResults) {
        const interfaces = [];

        for (const result of astResults) {
            if (!result.parseSuccess || !result.ast) continue;

            const detector = this.interfaceDetectors.get(result.language);
            if (detector) {
                try {
                    const fileInterfaces = await detector.extractInterfaces(result.ast, result.file);
                    interfaces.push(...fileInterfaces);
                } catch (error) {
                    // Log error but continue processing
                    console.warn(`Interface extraction failed for ${result.file.path}:`, error.message);
                }
            }
        }

        return interfaces;
    }

    /**
     * Build cross-language dependency graph
     */
    async buildCrossLanguageGraph(astResults, interfaces) {
        const graph = {
            nodes: new Map(),
            edges: new Map(),
            crossLanguageEdges: [],
            clusters: new Map()
        };

        // Build nodes from AST results
        for (const result of astResults) {
            if (!result.parseSuccess || !result.ast) continue;

            const nodeId = result.file.relativePath;
            graph.nodes.set(nodeId, {
                id: nodeId,
                file: result.file,
                language: result.language,
                ast: result.ast,
                exports: await this.extractExports(result.ast, result.language),
                imports: await this.extractImports(result.ast, result.language)
            });
        }

        // Build edges from dependencies
        for (const [nodeId, node] of graph.nodes) {
            const edges = [];
            
            for (const importInfo of node.imports) {
                const targetNode = this.resolveImport(importInfo, node, graph.nodes);
                if (targetNode) {
                    const edge = {
                        source: nodeId,
                        target: targetNode.id,
                        type: 'import',
                        importInfo,
                        crossLanguage: node.language !== targetNode.language
                    };
                    
                    edges.push(edge);
                    
                    if (edge.crossLanguage) {
                        graph.crossLanguageEdges.push(edge);
                    }
                }
            }
            
            graph.edges.set(nodeId, edges);
        }

        // Add interface-based connections
        this.addInterfaceConnections(graph, interfaces);

        return graph;
    }

    /**
     * Analyze cross-language patterns and architectural decisions
     */
    async analyzeCrossLanguagePatterns(dependencyGraph, astResults) {
        const patterns = [];

        // 1. Microservices pattern detection
        patterns.push(...await this.detectMicroservicesPattern(dependencyGraph));

        // 2. API layer pattern detection
        patterns.push(...await this.detectAPILayerPattern(dependencyGraph, astResults));

        // 3. Shared library pattern detection
        patterns.push(...await this.detectSharedLibraryPattern(dependencyGraph));

        // 4. Cross-language communication patterns
        patterns.push(...await this.detectCommunicationPatterns(dependencyGraph));

        // 5. Architecture anti-patterns
        patterns.push(...await this.detectArchitecturalAntiPatterns(dependencyGraph));

        return patterns;
    }

    /**
     * Extract exports from AST based on language
     */
    async extractExports(ast, language) {
        const exports = [];
        
        if (!ast || !ast.functions) return exports;

        // Extract function exports
        for (const func of ast.functions) {
            if (func.exported) {
                exports.push({
                    type: 'function',
                    name: func.name,
                    signature: func.signature,
                    async: func.async,
                    language
                });
            }
        }

        // Extract class exports
        if (ast.classes) {
            for (const cls of ast.classes) {
                if (cls.exported) {
                    exports.push({
                        type: 'class',
                        name: cls.name,
                        methods: cls.methods?.map(m => m.name) || [],
                        language
                    });
                }
            }
        }

        return exports;
    }

    /**
     * Extract imports from AST based on language
     */
    async extractImports(ast, language) {
        return ast.imports || [];
    }

    /**
     * Resolve import to target node
     */
    resolveImport(importInfo, sourceNode, allNodes) {
        // Simplified resolution - in practice, this would be more sophisticated
        for (const [nodeId, node] of allNodes) {
            if (node.file.relativePath.includes(importInfo.source) ||
                node.file.path.includes(importInfo.source)) {
                return node;
            }
        }
        return null;
    }

    /**
     * Add interface-based connections to the dependency graph
     */
    addInterfaceConnections(graph, interfaces) {
        // Group interfaces by type (REST API, GraphQL, gRPC, etc.)
        const interfacesByType = new Map();
        
        for (const iface of interfaces) {
            if (!interfacesByType.has(iface.type)) {
                interfacesByType.set(iface.type, []);
            }
            interfacesByType.get(iface.type).push(iface);
        }

        // Connect nodes that implement or consume the same interfaces
        for (const [type, typeInterfaces] of interfacesByType) {
            for (let i = 0; i < typeInterfaces.length; i++) {
                for (let j = i + 1; j < typeInterfaces.length; j++) {
                    const iface1 = typeInterfaces[i];
                    const iface2 = typeInterfaces[j];
                    
                    if (this.areInterfacesRelated(iface1, iface2)) {
                        const edge = {
                            source: iface1.file,
                            target: iface2.file,
                            type: 'interface',
                            interfaceType: type,
                            crossLanguage: iface1.language !== iface2.language
                        };
                        
                        const sourceEdges = graph.edges.get(iface1.file) || [];
                        sourceEdges.push(edge);
                        graph.edges.set(iface1.file, sourceEdges);
                        
                        if (edge.crossLanguage) {
                            graph.crossLanguageEdges.push(edge);
                        }
                    }
                }
            }
        }
    }

    /**
     * Detect microservices architectural pattern
     */
    async detectMicroservicesPattern(graph) {
        const patterns = [];
        
        // Look for clusters of nodes with minimal cross-cluster dependencies
        const clusters = this.findClusters(graph);
        
        if (clusters.length > 1) {
            const crossClusterDeps = graph.crossLanguageEdges.filter(edge => {
                const sourceLang = graph.nodes.get(edge.source)?.language;
                const targetLang = graph.nodes.get(edge.target)?.language;
                return sourceLang !== targetLang;
            });

            if (crossClusterDeps.length > 0) {
                patterns.push({
                    type: 'microservices',
                    confidence: this.calculateMicroservicesConfidence(clusters, crossClusterDeps),
                    description: 'Microservices architecture detected with language-separated services',
                    clusters: clusters.length,
                    crossLanguageDependencies: crossClusterDeps.length,
                    recommendation: 'Consider API documentation and service contracts'
                });
            }
        }

        return patterns;
    }

    /**
     * Detect API layer architectural pattern
     */
    async detectAPILayerPattern(graph, astResults) {
        const patterns = [];
        const apiFiles = [];

        // Look for files with high incoming dependency counts (potential API layers)
        for (const [nodeId, node] of graph.nodes) {
            const incomingEdges = Array.from(graph.edges.values()).flat()
                .filter(edge => edge.target === nodeId);
            
            if (incomingEdges.length > 3) {
                const crossLanguageIncoming = incomingEdges.filter(edge => edge.crossLanguage);
                
                if (crossLanguageIncoming.length > 0) {
                    apiFiles.push({
                        file: nodeId,
                        language: node.language,
                        incomingCount: incomingEdges.length,
                        crossLanguageCount: crossLanguageIncoming.length
                    });
                }
            }
        }

        if (apiFiles.length > 0) {
            patterns.push({
                type: 'api-layer',
                confidence: Math.min(0.9, apiFiles.length * 0.3),
                description: 'API layer pattern detected with cross-language dependencies',
                apiFiles: apiFiles.length,
                recommendation: 'Ensure proper API documentation and versioning'
            });
        }

        return patterns;
    }

    /**
     * Detect shared library pattern
     */
    async detectSharedLibraryPattern(graph) {
        const patterns = [];
        
        // Look for nodes with high outgoing dependency counts
        for (const [nodeId, edges] of graph.edges) {
            const crossLanguageOutgoing = edges.filter(edge => edge.crossLanguage);
            
            if (crossLanguageOutgoing.length > 2) {
                patterns.push({
                    type: 'shared-library',
                    confidence: Math.min(0.9, crossLanguageOutgoing.length * 0.2),
                    description: `Shared library pattern detected in ${nodeId}`,
                    file: nodeId,
                    crossLanguageDependents: crossLanguageOutgoing.length,
                    recommendation: 'Consider packaging as a proper library with clear interfaces'
                });
            }
        }

        return patterns;
    }

    /**
     * Detect cross-language communication patterns
     */
    async detectCommunicationPatterns(graph) {
        const patterns = [];
        const communicationTypes = new Map();

        for (const edge of graph.crossLanguageEdges) {
            const key = `${edge.source}-${edge.target}`;
            if (!communicationTypes.has(edge.type)) {
                communicationTypes.set(edge.type, []);
            }
            communicationTypes.get(edge.type).push(edge);
        }

        for (const [type, edges] of communicationTypes) {
            if (edges.length > 1) {
                patterns.push({
                    type: 'communication-pattern',
                    subtype: type,
                    confidence: 0.8,
                    description: `${type} communication pattern detected across languages`,
                    connectionCount: edges.length,
                    recommendation: 'Document communication protocols and error handling'
                });
            }
        }

        return patterns;
    }

    /**
     * Detect architectural anti-patterns
     */
    async detectArchitecturalAntiPatterns(graph) {
        const antiPatterns = [];

        // Circular dependencies across languages
        const cycles = this.detectCycles(graph);
        for (const cycle of cycles) {
            if (cycle.some(edge => edge.crossLanguage)) {
                antiPatterns.push({
                    type: 'cross-language-circular-dependency',
                    confidence: 0.9,
                    description: 'Circular dependency detected across language boundaries',
                    cycle: cycle.map(edge => `${edge.source} -> ${edge.target}`),
                    severity: 'high',
                    recommendation: 'Break circular dependencies by introducing interfaces or event-driven patterns'
                });
            }
        }

        return antiPatterns;
    }

    /**
     * Generate recommendations based on analysis
     */
    async generateRecommendations(dependencyGraph, patterns, interfaces) {
        const recommendations = [];

        // Cross-language dependency recommendations
        if (dependencyGraph.crossLanguageEdges.length > 10) {
            recommendations.push({
                type: 'architecture',
                priority: 'high',
                title: 'Consider Cross-Language Dependency Reduction',
                description: `Found ${dependencyGraph.crossLanguageEdges.length} cross-language dependencies. Consider consolidating related functionality within language boundaries.`,
                action: 'Refactor to reduce cross-language coupling'
            });
        }

        // Interface standardization recommendations
        const interfaceTypes = new Set(interfaces.map(i => i.type));
        if (interfaceTypes.size > 3) {
            recommendations.push({
                type: 'standardization',
                priority: 'medium',
                title: 'Standardize Cross-Language Interfaces',
                description: `Multiple interface types detected: ${Array.from(interfaceTypes).join(', ')}. Consider standardizing on fewer interface types.`,
                action: 'Define consistent API standards across languages'
            });
        }

        // Pattern-based recommendations
        for (const pattern of patterns) {
            if (pattern.recommendation) {
                recommendations.push({
                    type: 'pattern',
                    priority: pattern.severity || 'medium',
                    title: `${pattern.type} Pattern Recommendation`,
                    description: pattern.recommendation,
                    action: `Apply ${pattern.type} best practices`
                });
            }
        }

        return recommendations;
    }

    /**
     * Utility methods
     */
    getLanguageDistribution(astResults) {
        const distribution = {};
        for (const result of astResults) {
            if (!result.parseSuccess) continue;
            distribution[result.language] = (distribution[result.language] || 0) + 1;
        }
        return distribution;
    }

    serializeDependencyGraph(graph) {
        return {
            nodeCount: graph.nodes.size,
            edgeCount: Array.from(graph.edges.values()).flat().length,
            crossLanguageEdgeCount: graph.crossLanguageEdges.length,
            languages: Array.from(new Set(Array.from(graph.nodes.values()).map(n => n.language)))
        };
    }

    findClusters(graph) {
        // Simplified clustering - in practice, use more sophisticated algorithms
        const clusters = [];
        const visited = new Set();

        for (const [nodeId, node] of graph.nodes) {
            if (!visited.has(nodeId)) {
                const cluster = this.dfsCluster(nodeId, graph, visited);
                if (cluster.length > 1) {
                    clusters.push(cluster);
                }
            }
        }

        return clusters;
    }

    dfsCluster(nodeId, graph, visited) {
        const cluster = [nodeId];
        visited.add(nodeId);

        const edges = graph.edges.get(nodeId) || [];
        for (const edge of edges) {
            if (!visited.has(edge.target) && !edge.crossLanguage) {
                cluster.push(...this.dfsCluster(edge.target, graph, visited));
            }
        }

        return cluster;
    }

    calculateMicroservicesConfidence(clusters, crossClusterDeps) {
        const baseConfidence = Math.min(0.8, clusters.length * 0.2);
        const depPenalty = Math.min(0.3, crossClusterDeps.length * 0.05);
        return Math.max(0.1, baseConfidence - depPenalty);
    }

    detectCycles(graph) {
        // Simplified cycle detection
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();

        for (const nodeId of graph.nodes.keys()) {
            if (!visited.has(nodeId)) {
                this.dfsCycles(nodeId, graph, visited, recursionStack, [], cycles);
            }
        }

        return cycles;
    }

    dfsCycles(nodeId, graph, visited, recursionStack, path, cycles) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const edges = graph.edges.get(nodeId) || [];
        for (const edge of edges) {
            if (recursionStack.has(edge.target)) {
                // Found a cycle
                const cycleStart = path.indexOf(edge.target);
                cycles.push(path.slice(cycleStart).map(nodeId => ({ source: nodeId, target: edge.target })));
            } else if (!visited.has(edge.target)) {
                this.dfsCycles(edge.target, graph, visited, recursionStack, path, cycles);
            }
        }

        recursionStack.delete(nodeId);
        path.pop();
    }

    areInterfacesRelated(iface1, iface2) {
        // Simplified interface relationship detection
        return iface1.type === iface2.type || 
               (iface1.endpoints && iface2.endpoints && 
                iface1.endpoints.some(e1 => iface2.endpoints.some(e2 => e1.path === e2.path)));
    }
}

/**
 * Interface detector base class
 */
class InterfaceDetector {
    async extractInterfaces(ast, file) {
        throw new Error('extractInterfaces must be implemented by subclass');
    }
}

/**
 * JavaScript-specific interface detector
 */
class JavaScriptInterfaceDetector extends InterfaceDetector {
    async extractInterfaces(ast, file) {
        const interfaces = [];

        // Detect Express.js routes
        if (ast.functions) {
            for (const func of ast.functions) {
                if (this.isExpressRoute(func)) {
                    interfaces.push({
                        type: 'rest-api',
                        language: 'javascript',
                        file: file.relativePath,
                        method: func.name,
                        framework: 'express'
                    });
                }
            }
        }

        return interfaces;
    }

    isExpressRoute(func) {
        return func.calls && func.calls.some(call => 
            ['get', 'post', 'put', 'delete', 'patch'].includes(call.function)
        );
    }
}

/**
 * TypeScript-specific interface detector
 */
class TypeScriptInterfaceDetector extends JavaScriptInterfaceDetector {
    async extractInterfaces(ast, file) {
        const interfaces = await super.extractInterfaces(ast, file);

        // Add TypeScript-specific interface detection
        if (ast.interfaces) {
            for (const iface of ast.interfaces) {
                interfaces.push({
                    type: 'typescript-interface',
                    language: 'typescript',
                    file: file.relativePath,
                    name: iface.name,
                    properties: iface.properties || []
                });
            }
        }

        return interfaces;
    }
}

/**
 * Python-specific interface detector
 */
class PythonInterfaceDetector extends InterfaceDetector {
    async extractInterfaces(ast, file) {
        const interfaces = [];

        // Detect Flask/FastAPI routes
        if (ast.functions) {
            for (const func of ast.functions) {
                if (this.isFlaskRoute(func) || this.isFastAPIRoute(func)) {
                    interfaces.push({
                        type: 'rest-api',
                        language: 'python',
                        file: file.relativePath,
                        method: func.name,
                        framework: this.detectFramework(func)
                    });
                }
            }
        }

        return interfaces;
    }

    isFlaskRoute(func) {
        return func.decorators && func.decorators.some(dec => 
            dec.includes('route') || dec.includes('app.')
        );
    }

    isFastAPIRoute(func) {
        return func.decorators && func.decorators.some(dec => 
            ['get', 'post', 'put', 'delete', 'patch'].some(method => 
                dec.includes(`@app.${method}`) || dec.includes(`@${method}`)
            )
        );
    }

    detectFramework(func) {
        if (this.isFlaskRoute(func)) return 'flask';
        if (this.isFastAPIRoute(func)) return 'fastapi';
        return 'unknown';
    }
}

/**
 * Go-specific interface detector
 */
class GoInterfaceDetector extends InterfaceDetector {
    async extractInterfaces(ast, file) {
        const interfaces = [];

        // Detect HTTP handlers and gRPC services
        if (ast.functions) {
            for (const func of ast.functions) {
                if (this.isHTTPHandler(func)) {
                    interfaces.push({
                        type: 'rest-api',
                        language: 'go',
                        file: file.relativePath,
                        method: func.name,
                        framework: 'standard-http'
                    });
                }
            }
        }

        return interfaces;
    }

    isHTTPHandler(func) {
        return func.signature && 
               func.signature.parameters &&
               func.signature.parameters.some(param => 
                   param.includes('http.ResponseWriter') || param.includes('*http.Request')
               );
    }
}

/**
 * Custom error class for cross-language analysis
 */
export class CrossLanguageAnalysisError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'CrossLanguageAnalysisError';
        this.cause = cause;
    }
}

export default CrossLanguageAnalyzer; 