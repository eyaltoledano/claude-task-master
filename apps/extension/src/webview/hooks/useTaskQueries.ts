import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVSCodeContext } from '../contexts/VSCodeContext';
import type { TaskMasterTask, TaskUpdates } from '../types';

// Query keys factory
export const taskKeys = {
	all: ['tasks'] as const,
	lists: () => [...taskKeys.all, 'list'] as const,
	list: (filters: { tag?: string; status?: string }) =>
		[...taskKeys.lists(), filters] as const,
	details: () => [...taskKeys.all, 'detail'] as const,
	detail: (id: string) => [...taskKeys.details(), id] as const
};

// Hook to fetch all tasks
export function useTasks(options?: { tag?: string; status?: string }) {
	const { sendMessage } = useVSCodeContext();

	return useQuery({
		queryKey: taskKeys.list(options || {}),
		queryFn: async () => {
			console.log('🔍 Fetching tasks with options:', options);
			const response = await sendMessage({
				type: 'getTasks',
				data: {
					tag: options?.tag,
					withSubtasks: true
				}
			});
			console.log('📋 Tasks fetched:', response);
			return response as TaskMasterTask[];
		},
		staleTime: 0 // Consider data stale immediately
	});
}

// Hook to fetch a single task with full details
export function useTaskDetails(taskId: string) {
	const { sendMessage } = useVSCodeContext();

	return useQuery({
		queryKey: taskKeys.detail(taskId),
		queryFn: async () => {
			const response = await sendMessage({
				type: 'mcpRequest',
				tool: 'get_task',
				params: {
					id: taskId
				}
			});

			// Parse the MCP response
			let fullTaskData = null;
			if (response?.data?.content?.[0]?.text) {
				try {
					const parsed = JSON.parse(response.data.content[0].text);
					fullTaskData = parsed.data;
				} catch (e) {
					console.error('Failed to parse MCP response:', e);
				}
			} else if (response?.data?.data) {
				fullTaskData = response.data.data;
			}

			return fullTaskData as TaskMasterTask;
		},
		enabled: !!taskId
	});
}

// Hook to update task status
export function useUpdateTaskStatus() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			newStatus
		}: {
			taskId: string;
			newStatus: TaskMasterTask['status'];
		}) => {
			const response = await sendMessage({
				type: 'updateTaskStatus',
				data: { taskId, newStatus }
			});
			return { taskId, newStatus, response };
		},
		// Optimistic update to prevent snap-back
		onMutate: async ({ taskId, newStatus }) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey: taskKeys.all });

			// Snapshot the previous value
			const previousTasks = queryClient.getQueriesData({
				queryKey: taskKeys.all
			});

			// Optimistically update all task queries
			queryClient.setQueriesData({ queryKey: taskKeys.all }, (old: any) => {
				if (!old) return old;

				// Handle both array and object responses
				if (Array.isArray(old)) {
					return old.map((task: TaskMasterTask) =>
						task.id === taskId ? { ...task, status: newStatus } : task
					);
				}

				return old;
			});

			// Return a context object with the snapshot
			return { previousTasks };
		},
		// If the mutation fails, roll back to the previous value
		onError: (err, variables, context) => {
			if (context?.previousTasks) {
				context.previousTasks.forEach(([queryKey, data]) => {
					queryClient.setQueryData(queryKey, data);
				});
			}
		},
		// Always refetch after error or success to ensure consistency
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: taskKeys.all });
		}
	});
}

// Hook to update task content
export function useUpdateTask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			updates,
			options = {}
		}: {
			taskId: string;
			updates: TaskUpdates | { description: string };
			options?: { append?: boolean; research?: boolean };
		}) => {
			console.log('🔄 Updating task:', taskId, updates, options);

			const response = await sendMessage({
				type: 'updateTask',
				data: { taskId, updates, options }
			});

			console.log('📥 Update task response:', response);

			// Check for error in response
			if (response && typeof response === 'object' && 'error' in response) {
				throw new Error(response.error || 'Failed to update task');
			}

			return response;
		},
		onSuccess: async (data, variables) => {
			console.log('✅ Task update successful, invalidating all task queries');
			console.log('Response data:', data);
			console.log('Task ID:', variables.taskId);

			// Invalidate ALL task-related queries (same as handleRefresh)
			await queryClient.invalidateQueries({
				queryKey: taskKeys.all
			});

			console.log(
				'🔄 All task queries invalidated for task:',
				variables.taskId
			);
		}
	});
}

// Hook to update subtask
export function useUpdateSubtask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			prompt,
			options = {}
		}: {
			taskId: string;
			prompt: string;
			options?: { research?: boolean };
		}) => {
			console.log('🔄 Updating subtask:', taskId, prompt, options);

			const response = await sendMessage({
				type: 'updateSubtask',
				data: { taskId, prompt, options }
			});

			console.log('📥 Update subtask response:', response);

			// Check for error in response
			if (response && typeof response === 'object' && 'error' in response) {
				throw new Error(response.error || 'Failed to update subtask');
			}

			return response;
		},
		onSuccess: async (data, variables) => {
			console.log(
				'✅ Subtask update successful, invalidating all task queries'
			);
			console.log('Subtask ID:', variables.taskId);

			// Invalidate ALL task-related queries (same as handleRefresh)
			await queryClient.invalidateQueries({
				queryKey: taskKeys.all
			});

			console.log(
				'🔄 All task queries invalidated for subtask:',
				variables.taskId
			);
		}
	});
}

// Hook to scope up task complexity
export function useScopeUpTask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			strength = 'regular',
			prompt,
			options = {}
		}: {
			taskId: string;
			strength?: 'light' | 'regular' | 'heavy';
			prompt?: string;
			options?: { research?: boolean };
		}) => {
			console.log('🔄 Scoping up task:', taskId, strength, prompt, options);

			const response = await sendMessage({
				type: 'mcpRequest',
				tool: 'scope_up_task',
				params: {
					id: String(taskId),
					strength,
					prompt,
					research: options.research || false
				}
			});

			console.log('📥 Scope up task response:', response);

			// Check for error in response
			if (response && typeof response === 'object' && 'error' in response) {
				throw new Error(response.error || 'Failed to scope up task');
			}

			return response;
		},
		onSuccess: async (data, variables) => {
			console.log('✅ Task scope up successful, invalidating all task queries');
			console.log('Task ID:', variables.taskId);

			// Invalidate ALL task-related queries
			await queryClient.invalidateQueries({
				queryKey: taskKeys.all
			});

			console.log(
				'🔄 All task queries invalidated for scoped up task:',
				variables.taskId
			);
		}
	});
}

// Hook to scope down task complexity
export function useScopeDownTask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			strength = 'regular',
			prompt,
			options = {}
		}: {
			taskId: string;
			strength?: 'light' | 'regular' | 'heavy';
			prompt?: string;
			options?: { research?: boolean };
		}) => {
			console.log('🔄 Scoping down task:', taskId, strength, prompt, options);

			const response = await sendMessage({
				type: 'mcpRequest',
				tool: 'scope_down_task',
				params: {
					id: String(taskId),
					strength,
					prompt,
					research: options.research || false
				}
			});

			console.log('📥 Scope down task response:', response);

			// Check for error in response
			if (response && typeof response === 'object' && 'error' in response) {
				throw new Error(response.error || 'Failed to scope down task');
			}

			return response;
		},
		onSuccess: async (data, variables) => {
			console.log(
				'✅ Task scope down successful, invalidating all task queries'
			);
			console.log('Task ID:', variables.taskId);

			// Invalidate ALL task-related queries
			await queryClient.invalidateQueries({
				queryKey: taskKeys.all
			});

			console.log(
				'🔄 All task queries invalidated for scoped down task:',
				variables.taskId
			);
		}
	});
}
