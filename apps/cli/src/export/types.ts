/**
 * @fileoverview Types for the export workflow
 */

/**
 * Task data for export selection
 */
export interface ExportableTask {
	id: string;
	title: string;
	description?: string;
	status: string;
	priority?: string;
	dependencies?: string[];
	subtasks?: ExportableTask[];
	dueDate?: string;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Mapped task ready for Hamster API
 */
export interface MappedTask {
	externalId: string;
	title: string;
	description?: string;
	status: 'todo' | 'in_progress' | 'done' | 'blocked';
	priority: 'low' | 'medium' | 'high' | 'urgent';
	dependencies?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Validation result for a task
 */
export interface TaskValidationResult {
	taskId: string;
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Overall validation result
 */
export interface ExportValidationResult {
	isValid: boolean;
	totalTasks: number;
	validTasks: number;
	invalidTasks: number;
	taskResults: TaskValidationResult[];
	errors: string[];
	warnings: string[];
}

/**
 * Selection result from task selector
 */
export interface TaskSelectionResult {
	selectedTasks: ExportableTask[];
	totalAvailable: number;
	cancelled: boolean;
}

/**
 * Export preview data
 */
export interface ExportPreview {
	taskCount: number;
	tasks: Array<{
		id: string;
		title: string;
		mappedStatus: string;
		mappedPriority: string;
	}>;
	destinationBrief?: string;
	destinationOrg?: string;
}
