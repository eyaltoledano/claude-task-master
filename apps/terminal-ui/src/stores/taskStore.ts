import { createTmCore } from '@tm/core';
import type { Task } from '@tm/core';
import fs from 'fs/promises';
import path from 'path';

/**
 * Task Store - Data provider for Task Master tasks
 *
 * This store abstracts the data source from the UI.
 * Loads tasks from the .taskmaster directory using the core API.
 */

export interface ComplexityReport {
	meta: {
		generatedAt: string;
		tasksAnalyzed: number;
		totalTasks: number;
		analysisCount: number;
		thresholdScore: number;
		projectName: string;
		usedResearch: boolean;
	};
	complexityAnalysis: Array<{
		taskId: number;
		taskTitle: string;
		complexityScore: number;
		recommendedSubtasks: number;
		expansionPrompt: string;
		reasoning: string;
	}>;
}

export interface TaskStore {
	loadTasks: (projectPath: string) => Promise<Task[]>;
	loadComplexityReport: (
		projectPath: string
	) => Promise<Map<string, number> | null>;
	getPendingTasks: (tasks: Task[]) => Task[];
	getInProgressTasks: (tasks: Task[]) => Task[];
	getAllTasks: (tasks: Task[]) => Task[];
	getTaskById: (tasks: Task[], id: string) => Task | undefined;
}

/**
 * Task Master Task Store
 * Loads tasks from .taskmaster directory
 */
export const createTaskMasterStore = (): TaskStore => {
	return {
		loadTasks: async (projectPath: string): Promise<Task[]> => {
			try {
				const tmCore = await createTmCore({ projectPath });
				const result = await tmCore.tasks.list({
					includeSubtasks: true
				});
				return result.tasks as Task[];
			} catch (error: any) {
				console.error('Failed to load tasks:', error.message);
				return [];
			}
		},

		loadComplexityReport: async (
			projectPath: string
		): Promise<Map<string, number> | null> => {
			try {
				const reportPath = path.join(
					projectPath,
					'.taskmaster',
					'reports',
					'task-complexity-report.json'
				);
				const content = await fs.readFile(reportPath, 'utf-8');
				const report: ComplexityReport = JSON.parse(content);

				// Create a map of taskId -> complexityScore
				const complexityMap = new Map<string, number>();
				report.complexityAnalysis.forEach((analysis) => {
					complexityMap.set(String(analysis.taskId), analysis.complexityScore);
				});

				return complexityMap;
			} catch (error: any) {
				// Report doesn't exist or couldn't be loaded - this is not an error
				return null;
			}
		},

		getPendingTasks: (tasks: Task[]): Task[] => {
			return tasks.filter((task) => task.status === 'pending');
		},

		getInProgressTasks: (tasks: Task[]): Task[] => {
			return tasks.filter((task) => task.status === 'in-progress');
		},

		getAllTasks: (tasks: Task[]): Task[] => {
			return tasks;
		},

		getTaskById: (tasks: Task[], id: string): Task | undefined => {
			return tasks.find((task) => task.id === id);
		}
	};
};

// Export default store
export const taskStore = createTaskMasterStore();
