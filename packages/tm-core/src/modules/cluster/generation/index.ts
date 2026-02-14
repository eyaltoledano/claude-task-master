/**
 * @fileoverview Barrel export for AI-powered cluster generation
 */

// Service
export {
	ClusterGenerationService,
	type TagAnalysisInput,
	type ClusterGenerationProgress,
	type ProgressCallback,
	type ClusterLevel,
	type ClusterSuggestion
} from './cluster-generation.service.js';

// Cache
export {
	TagAnalysisCache,
	type CacheStorage,
	type CacheFile,
	type CachedEntry
} from './tag-analysis-cache.js';

// Tag Semantic Analyzer
export type { ITagSemanticAnalyzer } from './tag-semantic-analyzer.interface.js';
export type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
export { BridgedTagSemanticAnalyzer } from './tag-semantic-analyzer.js';

// Tag Dependency Synthesizer
export type { ITagDependencySynthesizer } from './tag-dependency-synthesizer.interface.js';
export type { DependencySuggestion } from './tag-dependency-synthesizer.types.js';
export { BridgedTagDependencySynthesizer } from './tag-dependency-synthesizer.js';
