import React, { useState, useEffect, useContext, useCallback } from 'react';
import { VSCodeContext, TaskMasterTask } from '../webview/index';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
	ChevronRight,
	ChevronDown,
	Plus,
	Wand2,
	PlusCircle,
	Loader2
} from 'lucide-react';

interface TaskDetailsViewProps {
	taskId: string;
	onNavigateBack: () => void;
	onNavigateToTask: (taskId: string) => void;
}

// Markdown renderer component to handle code blocks
const MarkdownRenderer: React.FC<{ content: string; className?: string }> = ({
	content,
	className = ''
}) => {
	// Parse content to separate code blocks from regular text
	const parseMarkdown = (text: string) => {
		const parts = [];
		const lines = text.split('\n');
		let currentBlock = [];
		let inCodeBlock = false;
		let codeLanguage = '';

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.startsWith('```')) {
				if (inCodeBlock) {
					// End of code block
					if (currentBlock.length > 0) {
						parts.push({
							type: 'code',
							content: currentBlock.join('\n'),
							language: codeLanguage
						});
						currentBlock = [];
					}
					inCodeBlock = false;
					codeLanguage = '';
				} else {
					// Start of code block
					if (currentBlock.length > 0) {
						parts.push({
							type: 'text',
							content: currentBlock.join('\n')
						});
						currentBlock = [];
					}
					inCodeBlock = true;
					codeLanguage = line.substring(3).trim(); // Get language after ```
				}
			} else {
				currentBlock.push(line);
			}
		}

		// Handle remaining content
		if (currentBlock.length > 0) {
			parts.push({
				type: inCodeBlock ? 'code' : 'text',
				content: currentBlock.join('\n'),
				language: codeLanguage
			});
		}

		return parts;
	};

	const parts = parseMarkdown(content);

	return (
		<div className={className}>
			{parts.map((part, index) => {
				if (part.type === 'code') {
					return (
						<pre
							key={index}
							className="bg-code-snippet-background text-code-snippet-text font-[family-name:var(--font-editor-font)] text-[length:var(--font-editor-size)] p-3 rounded-md border border-widget-border my-2 overflow-x-auto"
						>
							{part.content}
						</pre>
					);
				} else {
					// Handle inline code (single backticks) in text blocks
					const textWithInlineCode = part.content
						.split(/(`[^`]+`)/g)
						.map((segment, segIndex) => {
							if (segment.startsWith('`') && segment.endsWith('`')) {
								const codeContent = segment.slice(1, -1);
								return (
									<code
										key={segIndex}
										className="bg-code-snippet-background text-code-snippet-text font-[family-name:var(--font-editor-font)] text-[length:var(--font-editor-size)] px-1 py-0.5 rounded border border-widget-border"
									>
										{codeContent}
									</code>
								);
							}
							return segment;
						});

					return (
						<div
							key={index}
							className="whitespace-pre-wrap text-sm text-vscode-foreground/80 my-1"
						>
							{textWithInlineCode}
						</div>
					);
				}
			})}
		</div>
	);
};

// Custom Priority Badge Component with theme-adaptive styling
const PriorityBadge: React.FC<{ priority: TaskMasterTask['priority'] }> = ({
	priority
}) => {
	const getPriorityColors = (priority: string) => {
		switch (priority) {
			case 'high':
				return {
					backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500 with opacity
					color: '#dc2626', // red-600 - works in both themes
					borderColor: 'rgba(239, 68, 68, 0.4)'
				};
			case 'medium':
				return {
					backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber-500 with opacity
					color: '#d97706', // amber-600 - works in both themes
					borderColor: 'rgba(245, 158, 11, 0.4)'
				};
			case 'low':
				return {
					backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500 with opacity
					color: '#16a34a', // green-600 - works in both themes
					borderColor: 'rgba(34, 197, 94, 0.4)'
				};
			default:
				return {
					backgroundColor: 'rgba(156, 163, 175, 0.2)',
					color: 'var(--vscode-foreground)',
					borderColor: 'rgba(156, 163, 175, 0.4)'
				};
		}
	};

	const colors = getPriorityColors(priority);

	return (
		<span
			className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium border min-w-[50px]"
			style={colors}
			title={priority}
		>
			{priority}
		</span>
	);
};

// Custom Status Badge Component with theme-adaptive styling
const StatusBadge: React.FC<{ status: TaskMasterTask['status'] }> = ({
	status
}) => {
	const getStatusColors = (status: string) => {
		// Use colors that work well in both light and dark themes
		switch (status) {
			case 'pending':
				return {
					backgroundColor: 'rgba(156, 163, 175, 0.2)', // gray-400 with opacity
					color: 'var(--vscode-foreground)',
					borderColor: 'rgba(156, 163, 175, 0.4)'
				};
			case 'in-progress':
				return {
					backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber-500 with opacity
					color: '#d97706', // amber-600 - works in both themes
					borderColor: 'rgba(245, 158, 11, 0.4)'
				};
			case 'review':
				return {
					backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500 with opacity
					color: '#2563eb', // blue-600 - works in both themes
					borderColor: 'rgba(59, 130, 246, 0.4)'
				};
			case 'done':
				return {
					backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500 with opacity
					color: '#16a34a', // green-600 - works in both themes
					borderColor: 'rgba(34, 197, 94, 0.4)'
				};
			case 'deferred':
				return {
					backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500 with opacity
					color: '#dc2626', // red-600 - works in both themes
					borderColor: 'rgba(239, 68, 68, 0.4)'
				};
			default:
				return {
					backgroundColor: 'rgba(156, 163, 175, 0.2)',
					color: 'var(--vscode-foreground)',
					borderColor: 'rgba(156, 163, 175, 0.4)'
				};
		}
	};

	const colors = getStatusColors(status);

	return (
		<span
			className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium border min-w-[60px]"
			style={colors}
			title={status}
		>
			{status === 'pending' ? 'todo' : status}
		</span>
	);
};

// Define the TaskFileData interface here since we're no longer importing it
interface TaskFileData {
	details?: string;
	testStrategy?: string;
}

interface CombinedTaskData {
	details?: string;
	testStrategy?: string;
	complexityScore?: number; // Only from MCP API
}

export const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({
	taskId,
	onNavigateBack,
	onNavigateToTask
}) => {
	const context = useContext(VSCodeContext);
	if (!context)
		{throw new Error('TaskDetailsView must be used within VSCodeContext');}

	const { state, sendMessage } = context;
	const { tasks } = state;

	const [currentTask, setCurrentTask] = useState<TaskMasterTask | null>(null);
	const [isSubtask, setIsSubtask] = useState(false);
	const [parentTask, setParentTask] = useState<TaskMasterTask | null>(null);

	// Collapsible section states
	const [isAiActionsExpanded, setIsAiActionsExpanded] = useState(true);
	const [isImplementationExpanded, setIsImplementationExpanded] =
		useState(false);
	const [isTestStrategyExpanded, setIsTestStrategyExpanded] = useState(false);
	const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);

	// AI Actions states
	const [prompt, setPrompt] = useState('');
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [isAppending, setIsAppending] = useState(false);

	// Add subtask states
	const [isAddingSubtask, setIsAddingSubtask] = useState(false);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
	const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
	const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

	// Task file data states (for implementation details, test strategy, and complexity score)
	const [taskFileData, setTaskFileData] = useState<CombinedTaskData>({
		details: undefined,
		testStrategy: undefined,
		complexityScore: undefined
	});
	const [isLoadingTaskFileData, setIsLoadingTaskFileData] = useState(false);
	const [taskFileDataError, setTaskFileDataError] = useState<string | null>(
		null
	);

	// Get complexity score from main task data immediately (no flash)
	const currentComplexityScore = currentTask?.complexityScore;

	// State for complexity data from MCP (only used for updates)
	const [mcpComplexityScore, setMcpComplexityScore] = useState<
		number | undefined
	>(undefined);
	const [isLoadingComplexity, setIsLoadingComplexity] = useState(false);

	// Use MCP complexity if available, otherwise use main task data
	const displayComplexityScore =
		mcpComplexityScore !== undefined
			? mcpComplexityScore
			: currentComplexityScore;

	// Fetch complexity from MCP when needed
	const fetchComplexityFromMCP = useCallback(
		async (force = false) => {
			if (!currentTask || (!force && currentComplexityScore !== undefined)) {
				return; // Don't fetch if we already have a score unless forced
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
						complexityResult.data.report.complexityAnalysis.find(
							(analysis: any) => analysis.taskId === currentTask.id
						);

					if (taskComplexity?.complexityScore !== undefined) {
						setMcpComplexityScore(taskComplexity.complexityScore);
					}
				}
			} catch (error) {
				console.error('Failed to fetch complexity from MCP:', error);
			} finally {
				setIsLoadingComplexity(false);
			}
		},
		[currentTask, currentComplexityScore, sendMessage]
	);

	// Refresh complexity after AI operations or when task changes
	useEffect(() => {
		if (currentTask) {
			// Reset MCP complexity when task changes
			setMcpComplexityScore(undefined);

			// Fetch from MCP if no complexity score in main data
			if (currentComplexityScore === undefined) {
				fetchComplexityFromMCP();
			}
		}
	}, [currentTask?.id, currentComplexityScore, fetchComplexityFromMCP]);

	// Refresh complexity after AI operations
	const refreshComplexityAfterAI = useCallback(() => {
		// Force refresh complexity after AI operations
		setTimeout(() => {
			fetchComplexityFromMCP(true);
		}, 2000); // Wait for AI operation to complete
	}, [fetchComplexityFromMCP]);

	// Handle running complexity analysis for a task
	const handleRunComplexityAnalysis = useCallback(async () => {
		if (!currentTask) {return;}

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
			}, 1000); // Wait for analysis to complete
		} catch (error) {
			console.error('Failed to run complexity analysis:', error);
		} finally {
			setIsLoadingComplexity(false);
		}
	}, [currentTask, sendMessage, fetchComplexityFromMCP]);

	// Parse task ID to determine if it's a subtask (e.g., "13.2")
	const parseTaskId = (id: string) => {
		const parts = id.split('.');
		if (parts.length === 2) {
			return {
				isSubtask: true,
				parentId: parts[0],
				subtaskIndex: parseInt(parts[1]) - 1 // Convert to 0-based index
			};
		}
		return {
			isSubtask: false,
			parentId: id,
			subtaskIndex: -1
		};
	};

	// Function to fetch task file data (implementation details and test strategy only)
	const fetchTaskFileData = async () => {
		if (!currentTask?.id) {return;}

		setIsLoadingTaskFileData(true);
		setTaskFileDataError(null);

		try {
			// For subtasks, construct the full dotted ID (e.g., "1.2")
			// For main tasks, use the task ID as-is
			const fileTaskId =
				isSubtask && parentTask
					? `${parentTask.id}.${currentTask.id}`
					: currentTask.id;

			console.log('📄 Fetching task file data for task:', fileTaskId);

			// Get implementation details and test strategy from file
			const fileData = await sendMessage({
				type: 'readTaskFileData',
				data: {
					taskId: fileTaskId,
					tag: 'master' // TODO: Make this configurable
				}
			});

			console.log('📄 Task file data response:', fileData);

			// Combine file data with complexity score from task data (already loaded)
			const combinedData = {
				details: fileData.details,
				testStrategy: fileData.testStrategy,
				complexityScore: currentTask.complexityScore // Use complexity score from already-loaded task data
			};

			console.log('📊 Combined task data:', combinedData);
			setTaskFileData(combinedData);
		} catch (error) {
			console.error('❌ Error fetching task file data:', error);
			setTaskFileDataError(
				error instanceof Error ? error.message : 'Failed to load task data'
			);
		} finally {
			setIsLoadingTaskFileData(false);
		}
	};

	// Find task or subtask by ID
	useEffect(() => {
		const {
			isSubtask: isSubtaskId,
			parentId,
			subtaskIndex
		} = parseTaskId(taskId);
		setIsSubtask(isSubtaskId);

		if (isSubtaskId) {
			// Find parent task
			const parent = tasks.find((task) => task.id === parentId);
			setParentTask(parent || null);

			// Find subtask
			if (
				parent &&
				parent.subtasks &&
				subtaskIndex >= 0 &&
				subtaskIndex < parent.subtasks.length
			) {
				const subtask = parent.subtasks[subtaskIndex];
				setCurrentTask(subtask);
				// Fetch file data for subtask
				fetchTaskFileData();
			} else {
				setCurrentTask(null);
			}
		} else {
			// Find main task
			const task = tasks.find((task) => task.id === parentId);
			setCurrentTask(task || null);
			setParentTask(null);
			// Fetch file data for main task
			if (task) {
				fetchTaskFileData();
			}
		}
	}, [taskId, tasks]);

	// Enhanced refresh logic for task file data when tasks are updated from polling
	useEffect(() => {
		if (currentTask) {
			// Create a comprehensive hash of task data to detect any changes
			const taskHash = JSON.stringify({
				id: currentTask.id,
				title: currentTask.title,
				description: currentTask.description,
				status: currentTask.status,
				priority: currentTask.priority,
				dependencies: currentTask.dependencies,
				subtasksCount: currentTask.subtasks?.length || 0,
				subtasksStatus: currentTask.subtasks?.map((st) => st.status) || [],
				lastUpdate: Date.now() // Include timestamp to ensure periodic refresh
			});

			// Small delay to ensure the tasks.json file has been updated
			const timeoutId = setTimeout(() => {
				console.log(
					'🔄 TaskDetailsView: Refreshing task file data due to task changes'
				);
				fetchTaskFileData();
			}, 500);

			return () => clearTimeout(timeoutId);
		}
	}, [currentTask, tasks, taskId]); // More comprehensive dependencies

	// Periodic refresh to ensure we have the latest data
	useEffect(() => {
		if (currentTask) {
			const intervalId = setInterval(() => {
				console.log('🔄 TaskDetailsView: Periodic refresh of task file data');
				fetchTaskFileData();
			}, 30000); // Refresh every 30 seconds

			return () => clearInterval(intervalId);
		}
	}, [currentTask, taskId]);

	// Handle AI Actions
	const handleRegenerate = async () => {
		if (!currentTask || !prompt.trim()) {return;}

		setIsRegenerating(true);
		try {
			if (isSubtask && parentTask) {
				await sendMessage({
					type: 'updateSubtask',
					data: {
						taskId: `${parentTask.id}.${currentTask.id}`,
						prompt: prompt,
						options: { research: false }
					}
				});
			} else {
				await sendMessage({
					type: 'updateTask',
					data: {
						taskId: currentTask.id,
						updates: { description: prompt },
						options: { append: false, research: false }
					}
				});
			}

			// Refresh both task file data and complexity after AI operation
			setTimeout(() => {
				console.log('🔄 TaskDetailsView: Refreshing after AI regeneration');
				fetchTaskFileData();
			}, 2000); // Wait 2 seconds for AI to finish processing

			// Refresh complexity after AI operation
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to regenerate task:', error);
		} finally {
			setIsRegenerating(false);
			setPrompt('');
		}
	};

	const handleAppend = async () => {
		if (!currentTask || !prompt.trim()) {return;}

		setIsAppending(true);
		try {
			if (isSubtask && parentTask) {
				await sendMessage({
					type: 'updateSubtask',
					data: {
						taskId: `${parentTask.id}.${currentTask.id}`,
						prompt: prompt,
						options: { research: false }
					}
				});
			} else {
				await sendMessage({
					type: 'updateTask',
					data: {
						taskId: currentTask.id,
						updates: { description: prompt },
						options: { append: true, research: false }
					}
				});
			}

			// Refresh both task file data and complexity after AI operation
			setTimeout(() => {
				console.log('🔄 TaskDetailsView: Refreshing after AI append');
				fetchTaskFileData();
			}, 2000); // Wait 2 seconds for AI to finish processing

			// Refresh complexity after AI operation
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to append to task:', error);
		} finally {
			setIsAppending(false);
			setPrompt('');
		}
	};

	// Handle adding a new subtask
	const handleAddSubtask = async () => {
		if (!currentTask || !newSubtaskTitle.trim() || isSubtask) {return;}

		setIsSubmittingSubtask(true);
		try {
			await sendMessage({
				type: 'addSubtask',
				data: {
					parentTaskId: currentTask.id,
					subtaskData: {
						title: newSubtaskTitle.trim(),
						description: newSubtaskDescription.trim() || undefined,
						status: 'pending'
					}
				}
			});

			// Reset form and close
			setNewSubtaskTitle('');
			setNewSubtaskDescription('');
			setIsAddingSubtask(false);

			// Refresh task data to show the new subtask
			setTimeout(() => {
				console.log('🔄 TaskDetailsView: Refreshing after adding subtask');
				fetchTaskFileData();
			}, 1000);
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to add subtask:', error);
		} finally {
			setIsSubmittingSubtask(false);
		}
	};

	const handleCancelAddSubtask = () => {
		setIsAddingSubtask(false);
		setNewSubtaskTitle('');
		setNewSubtaskDescription('');
	};

	// Handle dependency navigation
	const handleDependencyClick = (depId: string) => {
		onNavigateToTask(depId);
	};

	// Handle status change
	const handleStatusChange = async (newStatus: TaskMasterTask['status']) => {
		if (!currentTask) {return;}

		try {
			await sendMessage({
				type: 'updateTaskStatus',
				data: {
					taskId:
						isSubtask && parentTask
							? `${parentTask.id}.${currentTask.id}`
							: currentTask.id,
					newStatus: newStatus
				}
			});
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to update task status:', error);
		}
	};

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
			{/* Main content area with two-column layout */}
			<div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-auto">
				{/* Left column - Main content (2/3 width) */}
				<div className="md:col-span-2 space-y-6">
					{/* Breadcrumb navigation */}
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
									{currentTask.title}
								</span>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>

					{/* Task title */}
					<h1 className="text-2xl font-bold tracking-tight text-vscode-foreground">
						{currentTask.title}
					</h1>

					{/* Description (non-editable) */}
					<div className="mb-8">
						<p className="text-vscode-foreground/80 leading-relaxed">
							{currentTask.description || 'No description available.'}
						</p>
					</div>

					{/* AI Actions */}
					<div className="mb-8">
						<div className="flex items-center gap-2 mb-4">
							<Button
								variant="ghost"
								size="sm"
								className="p-0 h-auto text-vscode-foreground/80 hover:text-vscode-foreground"
								onClick={() => setIsAiActionsExpanded(!isAiActionsExpanded)}
							>
								{isAiActionsExpanded ? (
									<ChevronDown className="w-4 h-4 mr-1" />
								) : (
									<ChevronRight className="w-4 h-4 mr-1" />
								)}
								<Wand2 className="w-4 h-4 mr-1" />
								AI Actions
							</Button>
						</div>

						{isAiActionsExpanded && (
							<div className="bg-widget-background rounded-lg p-4 border border-widget-border">
								<div className="space-y-4">
									<div>
										<Label
											htmlFor="ai-prompt"
											className="block text-sm font-medium text-vscode-foreground/80 mb-2"
										>
											Enter your prompt
										</Label>
										<Textarea
											id="ai-prompt"
											placeholder={
												isSubtask
													? 'Describe implementation notes, progress updates, or findings to add to this subtask...'
													: 'Describe what you want to change or add to this task...'
											}
											value={prompt}
											onChange={(e) => setPrompt(e.target.value)}
											className="min-h-[100px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
											disabled={isRegenerating || isAppending}
										/>
									</div>

									<div className="flex gap-3">
										{/* Show regenerate button only for main tasks, not subtasks */}
										{!isSubtask && (
											<Button
												onClick={handleRegenerate}
												disabled={
													!prompt.trim() || isRegenerating || isAppending
												}
												className="bg-primary text-primary-foreground hover:bg-primary/90"
											>
												{isRegenerating ? (
													<>
														<Loader2 className="w-4 h-4 mr-2 animate-spin" />
														Regenerating...
													</>
												) : (
													<>
														<Wand2 className="w-4 h-4 mr-2" />
														Regenerate Task
													</>
												)}
											</Button>
										)}

										<Button
											onClick={handleAppend}
											disabled={!prompt.trim() || isRegenerating || isAppending}
											variant={isSubtask ? 'default' : 'outline'}
											className={
												isSubtask
													? 'bg-primary text-primary-foreground hover:bg-primary/90'
													: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 border-widget-border'
											}
										>
											{isAppending ? (
												<>
													<Loader2 className="w-4 h-4 mr-2 animate-spin" />
													{isSubtask ? 'Updating...' : 'Appending...'}
												</>
											) : (
												<>
													<PlusCircle className="w-4 h-4 mr-2" />
													{isSubtask
														? 'Add Notes to Subtask'
														: 'Append to Task'}
												</>
											)}
										</Button>
									</div>

									<div className="text-xs text-vscode-foreground/60 space-y-1">
										{isSubtask ? (
											<p>
												<strong>Add Notes:</strong> Appends timestamped
												implementation notes, progress updates, or findings to
												this subtask's details
											</p>
										) : (
											<>
												<p>
													<strong>Regenerate:</strong> Completely rewrites the
													task description and subtasks based on your prompt
												</p>
												<p>
													<strong>Append:</strong> Adds new content to the
													existing task description based on your prompt
												</p>
											</>
										)}
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Implementation Details */}
					<div className="mb-8">
						<div className="flex items-center gap-2 mb-4">
							<Button
								variant="ghost"
								size="sm"
								className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
								onClick={() =>
									setIsImplementationExpanded(!isImplementationExpanded)
								}
							>
								{isImplementationExpanded ? (
									<ChevronDown className="w-4 h-4 mr-1" />
								) : (
									<ChevronRight className="w-4 h-4 mr-1" />
								)}
								Implementation Details
							</Button>
							{isLoadingTaskFileData && (
								<Loader2 className="w-4 h-4 animate-spin text-vscode-foreground/50" />
							)}
						</div>

						{isImplementationExpanded && (
							<div className="bg-widget-background rounded-lg p-4 border border-widget-border">
								<div className="implementation-content">
									{isLoadingTaskFileData ? (
										<div className="flex items-center justify-center py-4">
											<Loader2 className="w-5 h-5 animate-spin text-vscode-foreground/50" />
											<span className="ml-2 text-sm text-vscode-foreground/70">
												Loading details...
											</span>
										</div>
									) : taskFileDataError ? (
										<div className="text-sm text-red-400 py-2">
											Error loading details: {taskFileDataError}
										</div>
									) : taskFileData.details ? (
										<MarkdownRenderer content={taskFileData.details} />
									) : (
										<div className="text-sm text-vscode-foreground/50 py-2">
											No implementation details available
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Test Strategy */}
					<div className="mb-8">
						<div className="flex items-center gap-2 mb-4">
							<Button
								variant="ghost"
								size="sm"
								className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
								onClick={() =>
									setIsTestStrategyExpanded(!isTestStrategyExpanded)
								}
							>
								{isTestStrategyExpanded ? (
									<ChevronDown className="w-4 h-4 mr-1" />
								) : (
									<ChevronRight className="w-4 h-4 mr-1" />
								)}
								Test Strategy
							</Button>
							{isLoadingTaskFileData && (
								<Loader2 className="w-4 h-4 animate-spin text-vscode-foreground/50" />
							)}
						</div>

						{isTestStrategyExpanded && (
							<div className="bg-widget-background rounded-lg p-4 border border-widget-border">
								<div className="test-strategy-content">
									{isLoadingTaskFileData ? (
										<div className="flex items-center justify-center py-4">
											<Loader2 className="w-5 h-5 animate-spin text-vscode-foreground/50" />
											<span className="ml-2 text-sm text-vscode-foreground/70">
												Loading strategy...
											</span>
										</div>
									) : taskFileDataError ? (
										<div className="text-sm text-red-400 py-2">
											Error loading strategy: {taskFileDataError}
										</div>
									) : taskFileData.testStrategy ? (
										<MarkdownRenderer content={taskFileData.testStrategy} />
									) : (
										<div className="text-sm text-vscode-foreground/50 py-2">
											No test strategy available
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Subtasks section */}
					{((currentTask.subtasks && currentTask.subtasks.length > 0) ||
						!isSubtask) && (
						<div className="mb-8">
							<div className="flex items-center gap-2 mb-4">
								<Button
									variant="ghost"
									size="sm"
									className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
									onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
								>
									{isSubtasksExpanded ? (
										<ChevronDown className="w-4 h-4 mr-1" />
									) : (
										<ChevronRight className="w-4 h-4 mr-1" />
									)}
									Sub-issues
								</Button>
								{currentTask.subtasks && currentTask.subtasks.length > 0 && (
									<span className="text-sm text-vscode-foreground/50">
										{
											currentTask.subtasks?.filter((st) => st.status === 'done')
												.length
										}
										/{currentTask.subtasks?.length}
									</span>
								)}
								{/* Only show add button for main tasks, not subtasks */}
								{!isSubtask && (
									<Button
										variant="ghost"
										size="sm"
										className="ml-auto p-1 h-6 w-6 hover:bg-vscode-button-hoverBackground"
										onClick={() => setIsAddingSubtask(true)}
										title="Add subtask"
									>
										<Plus className="w-4 h-4" />
									</Button>
								)}
							</div>

							{isSubtasksExpanded && (
								<div className="space-y-3">
									{/* Add Subtask Form */}
									{isAddingSubtask && (
										<div className="bg-widget-background rounded-lg p-4 border border-widget-border">
											<h4 className="text-sm font-medium text-vscode-foreground mb-3">
												Add New Subtask
											</h4>
											<div className="space-y-3">
												<div>
													<Label
														htmlFor="subtask-title"
														className="block text-sm text-vscode-foreground/80 mb-1"
													>
														Title*
													</Label>
													<input
														id="subtask-title"
														type="text"
														placeholder="Enter subtask title..."
														value={newSubtaskTitle}
														onChange={(e) => setNewSubtaskTitle(e.target.value)}
														className="w-full px-3 py-2 text-sm bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 rounded focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder"
														disabled={isSubmittingSubtask}
														autoFocus
													/>
												</div>

												<div>
													<Label
														htmlFor="subtask-description"
														className="block text-sm text-vscode-foreground/80 mb-1"
													>
														Description (Optional)
													</Label>
													<Textarea
														id="subtask-description"
														placeholder="Enter subtask description..."
														value={newSubtaskDescription}
														onChange={(e) =>
															setNewSubtaskDescription(e.target.value)
														}
														className="min-h-[80px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
														disabled={isSubmittingSubtask}
													/>
												</div>

												<div className="flex gap-3 pt-2">
													<Button
														onClick={handleAddSubtask}
														disabled={
															!newSubtaskTitle.trim() || isSubmittingSubtask
														}
														className="bg-primary text-primary-foreground hover:bg-primary/90"
													>
														{isSubmittingSubtask ? (
															<>
																<Loader2 className="w-4 h-4 mr-2 animate-spin" />
																Adding...
															</>
														) : (
															<>
																<PlusCircle className="w-4 h-4 mr-2" />
																Add Subtask
															</>
														)}
													</Button>

													<Button
														onClick={handleCancelAddSubtask}
														variant="outline"
														disabled={isSubmittingSubtask}
														className="bg-secondary text-secondary-foreground hover:bg-secondary/90 border-widget-border"
													>
														Cancel
													</Button>
												</div>
											</div>
										</div>
									)}

									{currentTask.subtasks?.map((subtask, index) => {
										const subtaskId = `${currentTask.id}.${index + 1}`;
										const getStatusDotColor = (status: string) => {
											switch (status) {
												case 'pending':
													return '#9ca3af'; // gray-400
												case 'in-progress':
													return '#f59e0b'; // amber-500
												case 'review':
													return '#3b82f6'; // blue-500
												case 'done':
													return '#22c55e'; // green-500
												case 'deferred':
													return '#ef4444'; // red-500
												default:
													return '#9ca3af';
											}
										};
										const getSubtaskStatusColors = (status: string) => {
											switch (status) {
												case 'pending':
													return {
														backgroundColor: 'rgba(156, 163, 175, 0.2)',
														color: 'var(--vscode-foreground)',
														borderColor: 'rgba(156, 163, 175, 0.4)'
													};
												case 'in-progress':
													return {
														backgroundColor: 'rgba(245, 158, 11, 0.2)',
														color: '#d97706',
														borderColor: 'rgba(245, 158, 11, 0.4)'
													};
												case 'review':
													return {
														backgroundColor: 'rgba(59, 130, 246, 0.2)',
														color: '#2563eb',
														borderColor: 'rgba(59, 130, 246, 0.4)'
													};
												case 'done':
													return {
														backgroundColor: 'rgba(34, 197, 94, 0.2)',
														color: '#16a34a',
														borderColor: 'rgba(34, 197, 94, 0.4)'
													};
												case 'deferred':
													return {
														backgroundColor: 'rgba(239, 68, 68, 0.2)',
														color: '#dc2626',
														borderColor: 'rgba(239, 68, 68, 0.4)'
													};
												default:
													return {
														backgroundColor: 'rgba(156, 163, 175, 0.2)',
														color: 'var(--vscode-foreground)',
														borderColor: 'rgba(156, 163, 175, 0.4)'
													};
											}
										};

										return (
											<div
												key={subtask.id}
												className="flex items-center gap-3 p-3 rounded-md border border-textSeparator-foreground hover:border-vscode-border/70 transition-colors cursor-pointer"
												onClick={() => onNavigateToTask(subtaskId)}
											>
												<div
													className="w-4 h-4 rounded-full flex items-center justify-center"
													style={{
														backgroundColor: getStatusDotColor(subtask.status)
													}}
												>
													<div className="w-2 h-2 bg-white rounded-full" />
												</div>
												<span className="flex-1 text-vscode-foreground">
													{subtask.title}
												</span>
												<Badge
													variant="secondary"
													className="border"
													style={getSubtaskStatusColors(subtask.status)}
												>
													{subtask.status === 'pending'
														? 'todo'
														: subtask.status}
												</Badge>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Right column - Properties sidebar (1/3 width) */}
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
									<span className="text-sm text-vscode-foreground/70">
										Status
									</span>
									<select
										value={currentTask.status}
										onChange={(e) =>
											handleStatusChange(
												e.target.value as TaskMasterTask['status']
											)
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
									<span className="text-sm text-muted-foreground">
										Priority
									</span>
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
							<div className="border-b border-textSeparator-foreground"></div>

							{/* Dependencies */}
							{currentTask.dependencies &&
								currentTask.dependencies.length > 0 && (
									<>
										<div>
											<h4 className="text-sm font-medium text-vscode-foreground/70 mb-3">
												Dependencies
											</h4>
											<div className="space-y-2">
												{currentTask.dependencies.map((depId) => {
													const depTask = tasks.find((t) => t.id === depId);
													const fullTitle = `Task ${depId}: ${depTask?.title || 'Unknown Task'}`;
													const truncatedTitle =
														fullTitle.length > 40
															? fullTitle.substring(0, 37) + '...'
															: fullTitle;
													return (
														<div
															key={depId}
															className="text-sm text-link cursor-pointer hover:text-link-hover"
															onClick={() => handleDependencyClick(depId)}
															title={fullTitle}
														>
															{truncatedTitle}
														</div>
													);
												})}
											</div>
										</div>
									</>
								)}

							{/* Divider after Dependencies */}
							{currentTask.dependencies &&
								currentTask.dependencies.length > 0 && (
									<div className="border-b border-textSeparator-foreground"></div>
								)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskDetailsView;
