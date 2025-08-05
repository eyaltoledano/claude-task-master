/**
 * Main Kanban Board Component
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import {
	type DragEndEvent,
	KanbanBoard,
	KanbanCards,
	KanbanHeader,
	KanbanProvider
} from '@/components/ui/shadcn-io/kanban';
import { TaskCard } from './TaskCard';
import { TaskEditModal } from './TaskEditModal';
import { PollingStatus } from './PollingStatus';
import { TagDropdown } from './TagDropdown';
import { EmptyState } from './EmptyState';
import { useVSCodeContext } from '../contexts/VSCodeContext';
import {
	useTasks,
	useUpdateTaskStatus,
	useUpdateTask,
	taskKeys
} from '../hooks/useTaskQueries';
import { kanbanStatuses, HEADER_HEIGHT } from '../constants';
import type { TaskMasterTask, TaskUpdates } from '../types';

export const TaskMasterKanban: React.FC = () => {
	const { state, dispatch, sendMessage, availableHeight } = useVSCodeContext();
	const queryClient = useQueryClient();
	const {
		error: legacyError,
		editingTask,
		polling,
		currentTag,
		availableTags
	} = state;
	const [activeTask, setActiveTask] = useState<TaskMasterTask | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Use React Query to fetch tasks
	const {
		data: serverTasks = [],
		isLoading,
		error,
		isFetching,
		isSuccess
	} = useTasks({ tag: currentTag });
	const updateTaskStatus = useUpdateTaskStatus();
	const updateTask = useUpdateTask();

	// Debug logging
	console.log('🔍 TaskMasterKanban Query State:', {
		isLoading,
		isFetching,
		isSuccess,
		tasksCount: serverTasks?.length,
		error
	});

	// Temporary state only for active drag operations
	const [tempReorderedTasks, setTempReorderedTasks] = useState<
		TaskMasterTask[] | null
	>(null);

	// Use temp tasks only if actively set, otherwise use server tasks
	const tasks = tempReorderedTasks ?? serverTasks;

	// Calculate header height for proper kanban board sizing
	const kanbanHeight = availableHeight - HEADER_HEIGHT;

	// Group tasks by status
	const tasksByStatus = kanbanStatuses.reduce(
		(acc, status) => {
			acc[status.id] = tasks.filter((task) => task.status === status.id);
			return acc;
		},
		{} as Record<string, TaskMasterTask[]>
	);

	// Debug logging
	console.log('TaskMasterKanban render:', {
		tasksCount: tasks.length,
		currentTag,
		tasksByStatus: Object.entries(tasksByStatus).map(([status, tasks]) => ({
			status,
			count: tasks.length,
			taskIds: tasks.map((t) => t.id)
		})),
		allTaskIds: tasks.map((t) => ({ id: t.id, title: t.title }))
	});

	// Handle task update
	const handleUpdateTask = async (taskId: string, updates: TaskUpdates) => {
		console.log(`🔄 Updating task ${taskId} content:`, updates);

		try {
			await updateTask.mutateAsync({
				taskId,
				updates,
				options: { append: false, research: false }
			});

			console.log(`✅ Task ${taskId} content updated successfully`);

			// Close the edit modal
			dispatch({
				type: 'SET_EDITING_TASK',
				payload: { taskId: null }
			});
		} catch (error) {
			console.error(`❌ Failed to update task ${taskId}:`, error);
			dispatch({
				type: 'SET_ERROR',
				payload: `Failed to update task: ${error}`
			});
		}
	};

	// Handle drag start
	const handleDragStart = useCallback(
		(event: DragEndEvent) => {
			const taskId = event.active.id as string;
			const task = tasks.find((t) => t.id === taskId);
			if (task) {
				setActiveTask(task);
			}
		},
		[tasks]
	);

	// Handle drag cancel
	const handleDragCancel = useCallback(() => {
		setActiveTask(null);
		// Clear any temporary state
		setTempReorderedTasks(null);
	}, []);

	// Handle drag end
	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;

			// Reset active task
			setActiveTask(null);

			if (!over || active.id === over.id) {
				// Clear any temp state if drag was cancelled
				setTempReorderedTasks(null);
				return;
			}

			const taskId = active.id as string;
			const newStatus = over.id as TaskMasterTask['status'];

			// Find the task
			const task = tasks.find((t) => t.id === taskId);
			if (!task || task.status === newStatus) {
				// Clear temp state if no change needed
				setTempReorderedTasks(null);
				return;
			}

			// Create the optimistically reordered tasks
			const reorderedTasks = tasks.map((t) =>
				t.id === taskId ? { ...t, status: newStatus } : t
			);

			// Set temporary state to show immediate visual feedback
			setTempReorderedTasks(reorderedTasks);

			try {
				// Update on server - React Query will handle optimistic updates
				await updateTaskStatus.mutateAsync({ taskId, newStatus });
				// Clear temp state after mutation starts successfully
				setTempReorderedTasks(null);
			} catch (error) {
				// On error, clear temp state - React Query will revert optimistic update
				setTempReorderedTasks(null);
				dispatch({
					type: 'SET_ERROR',
					payload: `Failed to update task status: ${error}`
				});
			}
		},
		[tasks, updateTaskStatus, dispatch]
	);

	// Handle retry connection
	const handleRetry = useCallback(() => {
		sendMessage({ type: 'retryConnection' });
	}, [sendMessage]);

	// Handle refresh
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			// Invalidate all task queries
			await queryClient.invalidateQueries({ queryKey: taskKeys.all });
		} finally {
			// Reset after a short delay to show the animation
			setTimeout(() => setIsRefreshing(false), 500);
		}
	}, [queryClient]);

	// Handle tag switching
	const handleTagSwitch = useCallback(
		async (tagName: string) => {
			console.log('Switching to tag:', tagName);
			await sendMessage({ type: 'switchTag', data: { tagName } });
			dispatch({
				type: 'SET_TAG_DATA',
				payload: { currentTag: tagName, availableTags }
			});
		},
		[sendMessage, dispatch, availableTags]
	);

	// Use React Query loading state
	const displayError = error
		? error instanceof Error
			? error.message
			: String(error)
		: legacyError;

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center"
				style={{ height: `${kanbanHeight}px` }}
			>
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-foreground mx-auto mb-4" />
					<p className="text-sm text-vscode-foreground/70">Loading tasks...</p>
				</div>
			</div>
		);
	}

	if (displayError) {
		return (
			<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 m-4">
				<p className="text-red-400 text-sm">Error: {displayError}</p>
				<button
					onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Dismiss
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col" style={{ height: `${availableHeight}px` }}>
				<div className="flex-shrink-0 p-4 bg-vscode-sidebar-background border-b border-vscode-border">
					<div className="flex items-center justify-between">
						<h1 className="text-lg font-semibold text-vscode-foreground">
							TaskMaster Kanban
						</h1>
						<div className="flex items-center gap-4">
							<TagDropdown
								currentTag={currentTag}
								availableTags={availableTags}
								onTagSwitch={handleTagSwitch}
								sendMessage={sendMessage}
								dispatch={dispatch}
							/>
							<button
								onClick={handleRefresh}
								disabled={isRefreshing}
								className="p-1.5 rounded hover:bg-vscode-button-hoverBackground transition-colors"
								title="Refresh tasks"
							>
								<RefreshCw
									className={`w-4 h-4 text-vscode-foreground/70 ${isRefreshing ? 'animate-spin' : ''}`}
								/>
							</button>
							<PollingStatus polling={polling} onRetry={handleRetry} />
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-400' : 'bg-red-400'}`}
								/>
								<span className="text-xs text-vscode-foreground/70">
									{state.connectionStatus}
								</span>
							</div>
							<button
								onClick={() => dispatch({ type: 'NAVIGATE_TO_CONFIG' })}
								className="p-1.5 rounded hover:bg-vscode-button-hoverBackground transition-colors"
								title="TaskMaster Configuration"
							>
								<svg
									className="w-4 h-4 text-vscode-foreground/70"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>

				<div
					className="flex-1 px-4 py-4 overflow-hidden"
					style={{ height: `${kanbanHeight}px` }}
				>
					{tasks.length === 0 ? (
						<EmptyState currentTag={currentTag} />
					) : (
						<KanbanProvider
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={handleDragCancel}
							className="kanban-container w-full h-full overflow-x-auto overflow-y-hidden"
							dragOverlay={
								activeTask ? <TaskCard task={activeTask} dragging /> : null
							}
						>
							<div className="flex gap-4 h-full min-w-fit">
								{kanbanStatuses.map((status) => {
									const statusTasks = tasksByStatus[status.id] || [];
									const hasScrollbar = statusTasks.length > 4;

									return (
										<KanbanBoard
											key={status.id}
											id={status.id}
											className={`
												w-80 flex flex-col
												border border-vscode-border/30
												rounded-lg
												bg-vscode-sidebar-background/50
											`}
										>
											<KanbanHeader
												name={`${status.title} (${statusTasks.length})`}
												color={status.color}
												className="px-3 py-3 text-sm font-medium flex-shrink-0 border-b border-vscode-border/30"
											/>
											<div
												className={`
													flex flex-col gap-2 
													overflow-y-auto overflow-x-hidden
													p-2
													scrollbar-thin scrollbar-track-transparent
													${hasScrollbar ? 'pr-1' : ''}
												`}
												style={{
													maxHeight: `${kanbanHeight - 80}px`
												}}
											>
												<KanbanCards>
													{statusTasks.map((task) => (
														<TaskCard
															key={task.id}
															task={task}
															onViewDetails={(taskId) => {
																console.log(
																	'🔍 Navigating to task details:',
																	taskId
																);
																dispatch({
																	type: 'NAVIGATE_TO_TASK',
																	payload: taskId
																});
															}}
														/>
													))}
												</KanbanCards>
											</div>
										</KanbanBoard>
									);
								})}
							</div>
						</KanbanProvider>
					)}
				</div>
			</div>

			{/* Task Edit Modal */}
			{editingTask?.taskId && editingTask.editData && (
				<TaskEditModal
					task={editingTask.editData}
					onSave={handleUpdateTask}
					onCancel={() => {
						dispatch({
							type: 'SET_EDITING_TASK',
							payload: { taskId: null }
						});
					}}
				/>
			)}
		</>
	);
};
