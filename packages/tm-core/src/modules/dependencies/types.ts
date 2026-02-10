/**
 * Dependency management types
 */

/**
 * Dependency graph node
 */
export interface DependencyNode {
	taskId: string;
	dependencies: string[];
	visited: boolean;
	inStack: boolean;
}

/**
 * Circular dependency detection result
 */
export interface CircularDependencyResult {
	/** Whether a circular dependency was detected */
	hasCircle: boolean;
	/** Path showing the circular dependency (e.g., ["1", "2", "3", "1"]) */
	circlePath?: string[];
	/** Human-readable error message */
	message?: string;
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult {
	/** Whether all dependencies are valid */
	valid: boolean;
	/** List of validation issues found */
	issues: DependencyIssue[];
}

/**
 * Dependency issue type
 */
export type DependencyIssueType =
	| 'circular'
	| 'self'
	| 'missing'
	| 'invalid';

/**
 * Dependency validation issue
 */
export interface DependencyIssue {
	/** Type of issue */
	type: DependencyIssueType;
	/** Task ID with the issue */
	taskId: string;
	/** Dependency ID causing the issue (if applicable) */
	dependencyId?: string;
	/** Human-readable message */
	message: string;
}

/**
 * Dependency graph representation
 */
export interface DependencyGraph {
	/** Map of task ID to node */
	nodes: Map<string, DependencyNode>;
	/** Adjacency list (task ID -> dependent task IDs) */
	adjacencyList: Map<string, string[]>;
	/** Reverse adjacency list (task ID -> tasks that depend on it) */
	reverseAdjacencyList: Map<string, string[]>;
}
