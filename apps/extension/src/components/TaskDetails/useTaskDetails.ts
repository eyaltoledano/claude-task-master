import { useMemo } from 'react';
import { useTaskDetails as useTaskDetailsQuery } from '../../webview/hooks/useTaskQueries';
import type { TaskMasterTask } from '../../webview/types';

interface TaskFileData {
	details?: string;
	testStrategy?: string;
}

interface UseTaskDetailsProps {
	taskId: string;
	sendMessage: (message: any) => Promise<any>;
	tasks: TaskMasterTask[];
}

export const useTaskDetails = ({
	taskId,
	sendMessage,
	tasks
}: UseTaskDetailsProps) => {
	// Parse task ID to determine if it's a subtask (e.g., "13.2")
	const { isSubtask, parentId, subtaskIndex, taskIdForFetch } = useMemo(() => {
		// Ensure taskId is a string
		const taskIdStr = String(taskId);
		const parts = taskIdStr.split('.');
		if (parts.length === 2) {
			return {
				isSubtask: true,
				parentId: parts[0],
				subtaskIndex: parseInt(parts[1]) - 1, // Convert to 0-based index
				taskIdForFetch: parts[0] // Always fetch parent task for subtasks
			};
		}
		return {
			isSubtask: false,
			parentId: taskIdStr,
			subtaskIndex: -1,
			taskIdForFetch: taskIdStr
		};
	}, [taskId]);

	// Use React Query to fetch full task details
	const { data: fullTaskData, error: taskDetailsError } =
		useTaskDetailsQuery(taskIdForFetch);

	// Find current task from local state for immediate display
	const { currentTask, parentTask } = useMemo(() => {
		if (isSubtask) {
			const parent = tasks.find((t) => t.id === parentId);
			if (parent && parent.subtasks && parent.subtasks[subtaskIndex]) {
				const subtask = parent.subtasks[subtaskIndex];
				return { currentTask: subtask, parentTask: parent };
			}
		} else {
			const task = tasks.find((t) => t.id === String(taskId));
			if (task) {
				return { currentTask: task, parentTask: null };
			}
		}
		return { currentTask: null, parentTask: null };
	}, [taskId, tasks, isSubtask, parentId, subtaskIndex]);

	// Merge full task data from React Query with local state
	const mergedCurrentTask = useMemo(() => {
		if (!currentTask || !fullTaskData) return currentTask;

		if (isSubtask && fullTaskData.subtasks) {
			// Find the specific subtask in the full data
			const subtaskData = fullTaskData.subtasks.find(
				(st: any) =>
					st.id === currentTask.id || st.id === parseInt(currentTask.id as any)
			);
			if (subtaskData) {
				return { ...currentTask, ...subtaskData };
			}
		} else if (!isSubtask) {
			// Merge parent task data
			return { ...currentTask, ...fullTaskData };
		}

		return currentTask;
	}, [currentTask, fullTaskData, isSubtask]);

	// Extract task file data
	const taskFileData: TaskFileData = useMemo(() => {
		if (!mergedCurrentTask) return {};
		return {
			details: mergedCurrentTask.details || '',
			testStrategy: mergedCurrentTask.testStrategy || ''
		};
	}, [mergedCurrentTask]);

	// Get complexity score
	const complexity = useMemo(() => {
		if (mergedCurrentTask?.complexityScore !== undefined) {
			return { score: mergedCurrentTask.complexityScore };
		}
		return null;
	}, [mergedCurrentTask]);

	// Function to refresh data after AI operations
	const refreshComplexityAfterAI = () => {
		// React Query will automatically refetch when mutations invalidate the query
		// No need for manual refresh
	};

	return {
		currentTask: mergedCurrentTask,
		parentTask,
		isSubtask,
		taskFileData,
		taskFileDataError: taskDetailsError ? 'Failed to load task details' : null,
		complexity,
		refreshComplexityAfterAI
	};
};
