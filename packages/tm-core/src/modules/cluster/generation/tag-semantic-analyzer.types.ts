/**
 * @fileoverview Types for semantic analysis of project tags
 */

export interface SemanticAnalysis {
	readonly summary: string;
	readonly themes: readonly string[];
	readonly capabilities: readonly string[];
	readonly technicalDomain: string;
	readonly keyEntities: readonly string[];
}
