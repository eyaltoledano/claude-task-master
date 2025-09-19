import type React from 'react';
import { useContext, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { VSCodeContext } from '../webview/contexts/VSCodeContext';
import { AIActionsSection } from './TaskDetails/AIActionsSection';
import { SubtasksSection } from './TaskDetails/SubtasksSection';
import { TaskMetadataSidebar } from './TaskDetails/TaskMetadataSidebar';
import { DetailsSection } from './TaskDetails/DetailsSection';
import { useTaskDetails } from './TaskDetails/useTaskDetails';
import { useTasks, taskKeys } from '../webview/hooks/useTaskQueries';
import type { TaskMasterTask } from '../webview/types';

interface TaskDetailsViewProps {
	taskId: string;
	onNavigateBack: () => void;
	onNavigateToTask: (taskId: string) => void;
}

export const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({
	taskId,
	onNavigateBack,
	onNavigateToTask
}) => {
	const context = useContext(VSCodeContext);
	if (!context) {
		throw new Error('TaskDetailsView must be used within VSCodeProvider');
	}

	const { state, sendMessage } = context;
	const { currentTag } = state;
	const queryClient = useQueryClient();
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Use React Query to fetch all tasks
	const { data: allTasks = [] } = useTasks({ tag: currentTag });

	const {
		currentTask,
		parentTask,
		isSubtask,
		taskFileData,
		taskFileDataError,
		complexity,
		refreshComplexityAfterAI
	} = useTaskDetails({ taskId, sendMessage, tasks: allTasks });

	const displayId =
		isSubtask && parentTask
			? `${parentTask.id}.${currentTask?.id}`
			: currentTask?.id;

	const handleStatusChange = async (newStatus: TaskMasterTask['status']) => {
		if (!currentTask) return;

		try {
			await sendMessage({
				type: 'updateTaskStatus',
				data: {
					taskId: displayId,
					newStatus: newStatus
				}
			});
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to update task status:', error);
		}
	};

	const handleDependencyClick = (depId: string) => {
		onNavigateToTask(depId);
	};

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

	if (!currentTask) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<p className="text-lg text-vscode-foreground/70 mb-4">
						Task not found
					</p>
					<Button onClick={onNavigateBack} variant="outline">
						Back to Kanban Board
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			<div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-auto">
				{/* Left column - Main content (2/3 width) */}
				<div className="md:col-span-2 space-y-6">
					{/* Breadcrumb navigation */}
					<div className="flex items-center justify-between">
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink
										onClick={onNavigateBack}
										className="cursor-pointer hover:text-vscode-foreground text-link"
									>
										Kanban Board
									</BreadcrumbLink>
								</BreadcrumbItem>
								{isSubtask && parentTask && (
									<>
										<BreadcrumbSeparator />
										<BreadcrumbItem>
											<BreadcrumbLink
												onClick={() => onNavigateToTask(parentTask.id)}
												className="cursor-pointer hover:text-vscode-foreground"
											>
												{parentTask.title}
											</BreadcrumbLink>
										</BreadcrumbItem>
									</>
								)}
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<span className="text-vscode-foreground">
										#{displayId} {currentTask.title}
									</span>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className="p-1.5 rounded hover:bg-vscode-button-hoverBackground transition-colors"
							title="Refresh task details"
						>
							<RefreshCw
								className={`w-4 h-4 text-vscode-foreground/70 ${isRefreshing ? 'animate-spin' : ''}`}
							/>
						</button>
					</div>

					{/* Task ID and title */}
					<h1 className="text-2xl font-bold tracking-tight text-vscode-foreground">
						#{displayId} {currentTask.title}
					</h1>

					{/* Description */}
					<div className="mb-8">
						<p className="text-vscode-foreground/80 leading-relaxed">
							{currentTask.description || 'No description available.'}
						</p>
					</div>

					{/* AI Actions */}
					<AIActionsSection
						currentTask={currentTask}
						isSubtask={isSubtask}
						parentTask={parentTask}
						sendMessage={sendMessage}
						refreshComplexityAfterAI={refreshComplexityAfterAI}
					/>

					{/* Implementation Details */}
					<DetailsSection
						title="Implementation Details"
						content={taskFileData.details}
						error={taskFileDataError}
						emptyMessage="No implementation details available"
						defaultExpanded={false}
					/>

					{/* Test Strategy */}
					<DetailsSection
						title="Test Strategy"
						content={taskFileData.testStrategy}
						error={taskFileDataError}
						emptyMessage="No test strategy available"
						defaultExpanded={false}
					/>

					{/* Subtasks */}
					<SubtasksSection
						currentTask={currentTask}
						isSubtask={isSubtask}
						sendMessage={sendMessage}
						onNavigateToTask={onNavigateToTask}
					/>
				</div>

				{/* Right column - Metadata (1/3 width) */}
				<TaskMetadataSidebar
					currentTask={currentTask}
					tasks={allTasks}
					complexity={complexity}
					isSubtask={isSubtask}
					onStatusChange={handleStatusChange}
					onDependencyClick={handleDependencyClick}
				/>
			</div>
		</div>
	);
};

export default TaskDetailsView;
