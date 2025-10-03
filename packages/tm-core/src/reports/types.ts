/**
 * @fileoverview Type definitions for complexity analysis reports
 */

/**
 * Analysis result for a single task
 */
export interface ComplexityAnalysis {
	/** Task ID being analyzed */
	taskId: string | number;
	/** Task title */
	taskTitle: string;
	/** Complexity score (1-10 scale) */
	complexityScore: number;
	/** Recommended number of subtasks */
	recommendedSubtasks: number;
	/** AI-generated prompt for task expansion */
	expansionPrompt: string;
	/** Reasoning behind the complexity assessment */
	complexityReasoning: string;
}

/**
 * Metadata about the complexity report
 */
export interface ComplexityReportMetadata {
	/** When the report was generated */
	generatedAt: string;
	/** Number of tasks analyzed in this run */
	tasksAnalyzed: number;
	/** Total number of tasks in the file */
	totalTasks?: number;
	/** Total analyses in the report (across all runs) */
	analysisCount?: number;
	/** Complexity threshold score used */
	thresholdScore: number;
	/** Project name */
	projectName?: string;
	/** Whether research mode was used */
	usedResearch: boolean;
}

/**
 * Complete complexity analysis report
 */
export interface ComplexityReport {
	/** Report metadata */
	meta: ComplexityReportMetadata;
	/** Array of complexity analyses */
	complexityAnalysis: ComplexityAnalysis[];
}

/**
 * Complexity data to be attached to a Task
 */
export interface TaskComplexityData {
	/** Complexity score (1-10 scale) */
	complexityScore?: number;
	/** Recommended number of subtasks */
	recommendedSubtasks?: number;
	/** AI-generated expansion prompt */
	expansionPrompt?: string;
	/** Reasoning behind the assessment */
	complexityReasoning?: string;
}
