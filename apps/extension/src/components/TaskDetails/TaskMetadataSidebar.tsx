import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';
import type { TaskMasterTask } from '../../webview/types';
import { useVSCodeContext } from '../../webview/contexts/VSCodeContext';

interface TaskMetadataSidebarProps {
	currentTask: TaskMasterTask;
	tasks: TaskMasterTask[];
	complexity: any;
	isSubtask: boolean;
	onStatusChange: (status: TaskMasterTask['status']) => void;
	onDependencyClick: (depId: string) => void;
	isRegenerating?: boolean;
	isAppending?: boolean;
}

export const TaskMetadataSidebar: React.FC<TaskMetadataSidebarProps> = ({
	currentTask,
	tasks,
	complexity,
	isSubtask,
	onStatusChange,
	onDependencyClick,
	isRegenerating = false,
	isAppending = false
}) => {
	const { sendMessage } = useVSCodeContext();
	const [isLoadingComplexity, setIsLoadingComplexity] = useState(false);
	const [mcpComplexityScore, setMcpComplexityScore] = useState<
		number | undefined
	>(undefined);
	const [isStartingTask, setIsStartingTask] = useState(false);

	// Get complexity score from task
	const currentComplexityScore = complexity?.score;

	// Display logic - use MCP score if available, otherwise use current score
	const displayComplexityScore =
		mcpComplexityScore !== undefined
			? mcpComplexityScore
			: currentComplexityScore;

	// Fetch complexity from MCP when needed
	const fetchComplexityFromMCP = async (force = false) => {
		if (!currentTask || (!force && currentComplexityScore !== undefined)) {
			return;
		}
		setIsLoadingComplexity(true);
		try {
			const complexityResult = await sendMessage({
				type: 'mcpRequest',
				tool: 'complexity_report',
				params: {}
			});
			if (complexityResult?.data?.report?.complexityAnalysis) {
				const taskComplexity =
					complexityResult.data.report.complexityAnalysis.tasks?.find(
						(t: any) => t.id === currentTask.id
					);
				if (taskComplexity) {
					setMcpComplexityScore(taskComplexity.complexityScore);
				}
			}
		} catch (error) {
			console.error('Failed to fetch complexity from MCP:', error);
		} finally {
			setIsLoadingComplexity(false);
		}
	};

	// Handle running complexity analysis for a task
	const handleRunComplexityAnalysis = async () => {
		if (!currentTask) {
			return;
		}
		setIsLoadingComplexity(true);
		try {
			// Run complexity analysis on this specific task
			await sendMessage({
				type: 'mcpRequest',
				tool: 'analyze_project_complexity',
				params: {
					ids: currentTask.id.toString(),
					research: false
				}
			});
			// After analysis, fetch the updated complexity report
			setTimeout(() => {
				fetchComplexityFromMCP(true);
			}, 1000);
		} catch (error) {
			console.error('Failed to run complexity analysis:', error);
		} finally {
			setIsLoadingComplexity(false);
		}
	};

	// Handle starting a task
	const handleStartTask = async () => {
		if (!currentTask || isStartingTask) {
			return;
		}

		setIsStartingTask(true);

		try {
			// Send message to extension to open terminal
			const result = await sendMessage({
				type: 'openTerminal',
				data: {
					taskId: currentTask.id,
					taskTitle: currentTask.title
				}
			});

			// Handle the response
			if (result && !result.success) {
				console.error('Terminal execution failed:', result.error);
				// The extension will show VS Code error notification and webview toast
			} else if (result && result.success) {
				console.log('Terminal started successfully:', result.terminalName);
			}
		} catch (error) {
			console.error('Failed to start task:', error);
			// This handles network/communication errors
		} finally {
			// Reset loading state
			setIsStartingTask(false);
		}
	};

	// Effect to handle complexity on task change
	useEffect(() => {
		if (currentTask?.id) {
			setMcpComplexityScore(undefined);
			if (currentComplexityScore === undefined) {
				fetchComplexityFromMCP();
			}
		}
	}, [currentTask?.id, currentComplexityScore]);

	return (
		<div className="md:col-span-1 border-l border-textSeparator-foreground">
			<div className="p-6">
				<div className="space-y-6">
					<div>
						<h3 className="text-sm font-medium text-vscode-foreground/70 mb-3">
							Properties
						</h3>
					</div>

					<div className="space-y-4">
						{/* Status */}
						<div className="flex items-center justify-between">
							<span className="text-sm text-vscode-foreground/70">Status</span>
							<select
								value={currentTask.status}
								onChange={(e) =>
									onStatusChange(e.target.value as TaskMasterTask['status'])
								}
								className="border rounded-md px-3 py-1 text-sm font-medium focus:ring-1 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
								style={{
									backgroundColor:
										currentTask.status === 'pending'
											? 'rgba(156, 163, 175, 0.2)'
											: currentTask.status === 'in-progress'
												? 'rgba(245, 158, 11, 0.2)'
												: currentTask.status === 'review'
													? 'rgba(59, 130, 246, 0.2)'
													: currentTask.status === 'done'
														? 'rgba(34, 197, 94, 0.2)'
														: currentTask.status === 'deferred'
															? 'rgba(239, 68, 68, 0.2)'
															: 'var(--vscode-input-background)',
									color:
										currentTask.status === 'pending'
											? 'var(--vscode-foreground)'
											: currentTask.status === 'in-progress'
												? '#d97706'
												: currentTask.status === 'review'
													? '#2563eb'
													: currentTask.status === 'done'
														? '#16a34a'
														: currentTask.status === 'deferred'
															? '#dc2626'
															: 'var(--vscode-foreground)',
									borderColor:
										currentTask.status === 'pending'
											? 'rgba(156, 163, 175, 0.4)'
											: currentTask.status === 'in-progress'
												? 'rgba(245, 158, 11, 0.4)'
												: currentTask.status === 'review'
													? 'rgba(59, 130, 246, 0.4)'
													: currentTask.status === 'done'
														? 'rgba(34, 197, 94, 0.4)'
														: currentTask.status === 'deferred'
															? 'rgba(239, 68, 68, 0.4)'
															: 'var(--vscode-input-border)'
								}}
							>
								<option value="pending">To do</option>
								<option value="in-progress">In Progress</option>
								<option value="review">Review</option>
								<option value="done">Done</option>
								<option value="deferred">Deferred</option>
							</select>
						</div>

						{/* Priority */}
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Priority</span>
							<PriorityBadge priority={currentTask.priority} />
						</div>

						{/* Complexity Score */}
						<div className="space-y-2">
							<label className="text-sm font-medium text-[var(--vscode-foreground)]">
								Complexity Score
							</label>
							{isLoadingComplexity ? (
								<div className="flex items-center gap-2">
									<Loader2 className="w-4 h-4 animate-spin text-[var(--vscode-descriptionForeground)]" />
									<span className="text-sm text-[var(--vscode-descriptionForeground)]">
										Loading...
									</span>
								</div>
							) : displayComplexityScore !== undefined ? (
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-[var(--vscode-foreground)]">
										{displayComplexityScore}/10
									</span>
									<div
										className={`flex-1 rounded-full h-2 ${
											displayComplexityScore >= 7
												? 'bg-red-500/20'
												: displayComplexityScore >= 4
													? 'bg-yellow-500/20'
													: 'bg-green-500/20'
										}`}
									>
										<div
											className={`h-2 rounded-full transition-all duration-300 ${
												displayComplexityScore >= 7
													? 'bg-red-500'
													: displayComplexityScore >= 4
														? 'bg-yellow-500'
														: 'bg-green-500'
											}`}
											style={{
												width: `${(displayComplexityScore || 0) * 10}%`
											}}
										/>
									</div>
								</div>
							) : currentTask?.status === 'done' ||
								currentTask?.status === 'deferred' ||
								currentTask?.status === 'review' ? (
								<div className="text-sm text-[var(--vscode-descriptionForeground)]">
									N/A
								</div>
							) : (
								<>
									<div className="text-sm text-[var(--vscode-descriptionForeground)]">
										No complexity score available
									</div>
									<div className="mt-3">
										<Button
											onClick={() => handleRunComplexityAnalysis()}
											variant="outline"
											size="sm"
											className="text-xs"
											disabled={isRegenerating || isAppending}
										>
											Run Complexity Analysis
										</Button>
									</div>
								</>
							)}
						</div>
					</div>
					<div className="border-b border-textSeparator-foreground" />

					{/* Dependencies */}
					{currentTask.dependencies && currentTask.dependencies.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-vscode-foreground/70 mb-3">
								Dependencies
							</h4>
							<div className="space-y-2">
								{currentTask.dependencies.map((depId) => {
									// Convert both to string for comparison since depId might be string or number
									const depTask = tasks.find(
										(t) => String(t.id) === String(depId)
									);
									const fullTitle = `Task ${depId}: ${depTask?.title || 'Unknown Task'}`;
									const truncatedTitle =
										fullTitle.length > 40
											? fullTitle.substring(0, 37) + '...'
											: fullTitle;
									return (
										<div
											key={depId}
											className="text-sm text-link cursor-pointer hover:text-link-hover"
											onClick={() => onDependencyClick(depId)}
											title={fullTitle}
										>
											{truncatedTitle}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Divider after Dependencies */}
					{currentTask.dependencies && currentTask.dependencies.length > 0 && (
						<div className="border-b border-textSeparator-foreground" />
					)}

					{/* Start Task Button */}
					<div className="mt-4">
						<Button
							onClick={handleStartTask}
							variant="default"
							size="sm"
							className="w-full text-xs"
							disabled={
								isRegenerating ||
								isAppending ||
								isStartingTask ||
								currentTask?.status === 'done' ||
								currentTask?.status === 'in-progress'
							}
						>
							{isStartingTask ? (
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Play className="w-4 h-4 mr-2" />
							)}
							{isStartingTask ? 'Starting...' : 'Start Task'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};
