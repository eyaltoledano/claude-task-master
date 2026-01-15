import { useState, useEffect } from 'react';
import { taskStore } from '../stores/taskStore.js';
import { TaskWatcher } from '@tm/core';
import type { Task } from '@tm/core';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Hook for accessing Task Master task data with file watching
 *
 * This provides a clean API for components to access task data
 * and automatically reloads when tasks.json changes using TaskWatcher.
 */
export const useTaskStore = (projectPath: string) => {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [complexityMap, setComplexityMap] = useState<Map<
		string,
		number
	> | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

	const loadTasks = async () => {
		try {
			setLoading(true);
			const loadedTasks = await taskStore.loadTasks(projectPath);
			const loadedComplexityMap =
				await taskStore.loadComplexityReport(projectPath);
			setTasks(loadedTasks);
			setComplexityMap(loadedComplexityMap);
			setError(null);
			setLastUpdate(new Date());
		} catch (err: any) {
			setError(err.message || 'Failed to load tasks');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadTasks();

		const taskMasterDir = join(projectPath, '.taskmaster');

		if (!existsSync(taskMasterDir)) {
			return;
		}

		const watcher = new TaskWatcher(taskMasterDir, {
			ignoreInitial: true,
			persistent: true,
			debounceDelay: 500,
			filePatterns: ['**/*.json'],
			ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**']
		});

		let watcherReady = false;

		const handleChange = () => {
			loadTasks();
		};

		watcher.onTaskFileChanged(handleChange);
		watcher.onTaskFileAdded(handleChange);
		watcher.onTaskFileDeleted(handleChange);

		watcher.onReady(() => {
			watcherReady = true;
		});

		const startWatcher = async () => {
			try {
				await watcher.start();
			} catch (err: any) {
				// Silently fail - watcher is optional
			}
		};

		startWatcher();

		return () => {
			if (watcherReady) {
				watcher.stop().catch(() => {
					// Ignore cleanup errors
				});
			}
		};
	}, [projectPath]);

	const datasets: [Task[], Task[], Task[]] = [
		taskStore.getPendingTasks(tasks),
		taskStore.getInProgressTasks(tasks),
		taskStore.getAllTasks(tasks)
	];

	const tableTitles: [string, string, string] = [
		'Pending Tasks',
		'In Progress',
		'All Tasks'
	];

	return {
		tasks,
		complexityMap,
		datasets,
		tableTitles,
		loading,
		error,
		lastUpdate,
		getTaskById: (id: string) => taskStore.getTaskById(tasks, id),
		reload: loadTasks
	};
};
