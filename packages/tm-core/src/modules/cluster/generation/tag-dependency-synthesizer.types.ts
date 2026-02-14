/**
 * @fileoverview Types for inter-tag dependency synthesis
 */

export interface DependencySuggestion {
	readonly from: string;
	readonly to: string;
	readonly reason: string;
	readonly confidence: 'high' | 'medium' | 'low';
}
