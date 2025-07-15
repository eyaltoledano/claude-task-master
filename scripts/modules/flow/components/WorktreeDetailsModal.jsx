import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { Select, Alert, Spinner, ConfirmInput } from '@inkjs/ui';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';
import { backgroundOperations } from '../shared/services/BackgroundOperationsManager.js';

export default function WorktreeDetailsModal({
	worktree,
	backend,
	onClose,
	onDelete,
	onNavigateToTask
}) {
	const [loading, setLoading] = useState(true);
	const [details, setDetails] = useState(null);
	const [linkedTasks, setLinkedTasks] = useState([]);
	const [error, setError] = useState(null);
	const [showLinkTasksModal, setShowLinkTasksModal] = useState(false);
	const [showClaudeModal, setShowClaudeModal] = useState(false);
	const [viewMode, setViewMode] = useState('details'); // 'details', 'tasks', 'jump', 'workflow', or 'quickActions'
	const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const detailContentRef = useRef([]);
	const [isCreatingPR, setIsCreatingPR] = useState(false);
	const [isProcessingWorkflow, setIsProcessingWorkflow] = useState(false);
	const [prResult, setPrResult] = useState(null);
	const [showQuickActions, setShowQuickActions] = useState(false);
	const [workflowResult, setWorkflowResult] = useState(null);
	const [gitStatus, setGitStatus] = useState(null);
	const [workflowOptions, setWorkflowOptions] = useState(null);
	const [showTaskStatusModal, setShowTaskStatusModal] = useState(false);
	const [selectedTaskForStatus, setSelectedTaskForStatus] = useState(null);
	const theme = useComponentTheme('modal');

	// Constants for scrolling
	const VISIBLE_ROWS = 20;

	// Load worktree details
	useEffect(() => {
		loadDetails();

		// Listen for background operation completion to refresh data
		const handleOperationCompleted = (operationId, result) => {
			// Check if this operation was related to this worktree
			const operation = backgroundOperations.getOperation(operationId);
			if (operation && operation.operation.metadata) {
				const metadata = operation.operation.metadata;
				// If the operation was for this worktree, refresh the details
				if (
					metadata.worktreePath === worktree.path ||
					metadata.worktreeName === worktree.name
				) {
					console.log(
						`🔄 [WorktreeDetailsModal] Refreshing after operation completion: ${operationId}`
					);
					loadDetails();
				}
			}
		};

		// Add listener
		backgroundOperations.on('operation-completed', handleOperationCompleted);

		// Cleanup listener on unmount
		return () => {
			backgroundOperations.off('operation-completed', handleOperationCompleted);
		};

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [worktree.path, worktree.name]);

	const loadDetails = async () => {
		setLoading(true);
		try {
			const [info, tasks] = await Promise.all([
				backend.getWorktreeDetails(worktree.path),
				backend.getWorktreeTasks(worktree.name)
			]);
			setDetails(info);
			setLinkedTasks(tasks || []);

			// Load git status for workflow integration
			await loadGitStatus();
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const loadGitStatus = async () => {
		try {
			// Get git status through backend
			const status = await backend.getWorktreeGitStatus(worktree.path);
			setGitStatus(status);
		} catch (err) {
			console.warn('Failed to load git status:', err.message);
			setGitStatus(null);
		}
	};

	const handleWorkflowChoice = async (choice) => {
		if (isProcessingWorkflow) return;

		setIsProcessingWorkflow(true);
		setError(null);
		setWorkflowResult(null);

		try {
			// Find the primary task/subtask for this worktree
			const primaryTask =
				linkedTasks.find(
					(task) => task.status === 'done' || task.status === 'in-progress'
				) || linkedTasks[0];

			if (!primaryTask) {
				throw new Error('No suitable task found for workflow completion');
			}

			// Call the enhanced completeSubtask method with workflow choice
			const result = await backend.completeSubtask(worktree.name, {
				workflowChoice: choice,
				autoCommit: choice === 'create-pr' || choice === 'merge-local', // Auto-commit for both workflows
				prTitle: primaryTask.parentId
					? `Task ${primaryTask.parentId}.${primaryTask.id}: ${primaryTask.title}`
					: `Task ${primaryTask.id}: ${primaryTask.title}`,
				prDescription: `Implemented ${primaryTask.parentId ? 'subtask' : 'task'} ${primaryTask.id}: ${primaryTask.title}

## Changes Made
- ${details.status.added > 0 ? `${details.status.added} files added` : ''}
- ${details.status.modified > 0 ? `${details.status.modified} files modified` : ''}
- ${details.status.deleted > 0 ? `${details.status.deleted} files deleted` : ''}

## Worktree Details
- Branch: ${worktree.branch}
- Source: ${details.sourceBranch || 'main'}
- Path: ${worktree.path}

Completed via Task Master Flow.`
			});

			setWorkflowResult(result);

			if (result.success) {
				// Refresh details after successful workflow
				await loadDetails();
			} else if (result.reason === 'workflow-choice-needed') {
				// Show workflow options
				setWorkflowOptions(result.options);
				setViewMode('workflow');
			}
		} catch (error) {
			setError(error.message);
		} finally {
			setIsProcessingWorkflow(false);
		}
	};

	// Legacy PR creation method (keep for backward compatibility)
	const handleCreatePR = async () => {
		await handleWorkflowChoice('create-pr');
	};

	// Manual fallback for completing workflow when automatic process didn't work
	const handleCompleteWorkflow = async () => {
		if (isProcessingWorkflow) return;

		setIsProcessingWorkflow(true);
		setError(null);
		setWorkflowResult(null);

		try {
			// Find the primary task/subtask for this worktree
			const primaryTask =
				linkedTasks.find(
					(task) => task.status === 'done' || task.status === 'in-progress'
				) || linkedTasks[0];

			if (!primaryTask) {
				throw new Error('No suitable task found for workflow completion');
			}

			// Execute the complete workflow: commit + merge locally + cleanup
			const result = await backend.completeSubtask(worktree.name, {
				workflowChoice: 'merge-local',
				autoCommit: true,
				prTitle: primaryTask.parentId
					? `Task ${primaryTask.parentId}.${primaryTask.id}: ${primaryTask.title}`
					: `Task ${primaryTask.id}: ${primaryTask.title}`,
				prDescription: `Implemented ${primaryTask.parentId ? 'subtask' : 'task'} ${primaryTask.id}: ${primaryTask.title}

## Changes Made
- ${details.status.added > 0 ? `${details.status.added} files added` : ''}
- ${details.status.modified > 0 ? `${details.status.modified} files modified` : ''}
- ${details.status.deleted > 0 ? `${details.status.deleted} files deleted` : ''}

## Worktree Details
- Branch: ${worktree.branch}
- Source: ${details.sourceBranch || 'main'}
- Path: ${worktree.path}

Completed via Task Master Flow automated workflow.`
			});

			setWorkflowResult(result);

			if (result.success) {
				// Mark task as done if not already
				if (primaryTask.status !== 'done') {
					await handleSetTaskStatus(primaryTask.id, 'done');
				}

				// Ensure worktree config cleanup (safety net)
				try {
					await backend.cleanupWorktreeLinks(worktree.name);
				} catch (cleanupError) {
					console.warn(
						'Worktree config cleanup warning:',
						cleanupError.message
					);
					// Don't fail the whole operation for cleanup issues
				}

				// Close the modal after a short delay to show success
				setTimeout(() => {
					onClose();
				}, 2000);
			}
		} catch (error) {
			setError(error.message);
		} finally {
			setIsProcessingWorkflow(false);
		}
	};

	const handleSetTaskStatus = async (taskId, newStatus) => {
		try {
			const result = await backend.setSubtaskStatus(taskId, newStatus);
			if (result.success) {
				// Refresh the tasks
				await loadDetails();
				setShowTaskStatusModal(false);
				setSelectedTaskForStatus(null);
			} else {
				setError(result.error || 'Failed to update task status');
			}
		} catch (error) {
			setError(error.message);
		}
	};

	const getPrimaryTask = () => {
		// Since we have one subtask per worktree, just get the first (and only) linked task
		return linkedTasks.length > 0 ? linkedTasks[0] : null;
	};

	const getModalProps = () => {
		const baseProps = {
			onClose,
			width: '90%',
			height: '90%'
		};

		switch (viewMode) {
			case 'tasks':
				return {
					...baseProps,
					title: `Linked Tasks: ${worktree.name}`,
					preset: 'default',
					keyboardHints:
						linkedTasks.length > 0 && onNavigateToTask
							? [
									'↑↓ navigate',
									'j/k vim nav',
									'ENTER open task',
									'ESC back to details'
								]
							: ['ESC back to details']
				};
			case 'jump':
				return {
					...baseProps,
					title: `Jump to Task: ${worktree.name}`,
					preset: 'info',
					keyboardHints:
						linkedTasks.length > 0
							? [
									'↑↓ navigate',
									'j/k vim nav',
									'ENTER jump to task',
									'ESC cancel'
								]
							: ['ESC cancel']
				};
			case 'workflow':
				return {
					...baseProps,
					title: `Workflow Options: ${worktree.name}`,
					preset: 'info',
					keyboardHints: [
						'↑↓ navigate',
						'j/k vim nav',
						'ENTER select',
						'ESC back to details'
					]
				};
			case 'quickActions':
				return {
					...baseProps,
					title: `Quick Actions: ${worktree.name}`,
					preset: 'info',
					keyboardHints: [
						'↑↓ navigate',
						'j/k vim nav',
						'ENTER select',
						'ESC back to details'
					]
				};

			default: {
				const hints = [
					'TAB quick actions',
					'c launch Claude',
					's set status',
					'w workflow',
					'g jump to task'
				];

				// Add subtask-specific hint if this worktree is linked to a subtask
				const hasSubtask = linkedTasks.some((task) => task.parentId);
				if (hasSubtask) {
					hints.push('t jump to subtask');
				}

				// Add complete workflow hint if there are changes
				const hasChanges =
					details?.status &&
					(details.status.total > 0 ||
						details.status.modified > 0 ||
						details.status.added > 0 ||
						details.status.deleted > 0 ||
						details.status.untracked > 0);
				if (hasChanges && linkedTasks.length > 0) {
					hints.push('x manual complete');
				}

				hints.push('ESC close');

				return {
					...baseProps,
					title: `Worktree: ${worktree.name}`,
					preset: 'default',
					keyboardHints: hints
				};
			}
		}
	};

	const keyHandlers = {
		escape: () => {
			if (
				viewMode === 'tasks' ||
				viewMode === 'jump' ||
				viewMode === 'workflow' ||
				viewMode === 'quickActions'
			) {
				setViewMode('details');
			} else if (showTaskStatusModal) {
				setShowTaskStatusModal(false);
				setSelectedTaskForStatus(null);
			} else {
				onClose();
			}
		},

		// Navigation for all modes
		up: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (viewMode === 'workflow') {
				// Workflow handled by Select component
			} else if (viewMode === 'details') {
				setScrollOffset((prev) => Math.max(0, prev - 1));
			}
		},

		down: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(
					Math.min(linkedTasks.length - 1, selectedTaskIndex + 1)
				);
			} else if (viewMode === 'workflow') {
				// Workflow handled by Select component
			} else if (viewMode === 'details') {
				setScrollOffset((prev) => {
					const totalLines = detailContentRef.current.length;
					const maxOffset = Math.max(0, totalLines - VISIBLE_ROWS);
					return Math.min(maxOffset, prev + 1);
				});
			}
		},

		// Vim-style navigation
		j: () => keyHandlers.down(),
		k: () => keyHandlers.up(),

		// Page navigation for details view
		pageDown: () => {
			if (viewMode === 'details') {
				setScrollOffset((prev) => prev + 10);
			}
		},

		pageUp: () => {
			if (viewMode === 'details') {
				setScrollOffset((prev) => Math.max(0, prev - 10));
			}
		},

		return: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				if (linkedTasks.length > 0 && onNavigateToTask) {
					const selectedTask = linkedTasks[selectedTaskIndex];
					onNavigateToTask(selectedTask);
				}
			} else if (viewMode === 'workflow') {
				// Workflow selection handled by Select component
			}
		},

		// Open Quick Actions menu
		tab: () => {
			if (viewMode === 'details') {
				setViewMode('quickActions');
			}
		},

		// Keep individual action keys for power users (legacy support)
		c: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				setShowClaudeModal(true);
			}
		},

		s: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const primaryTask = getPrimaryTask();
				if (primaryTask) {
					setShowTaskStatusModal(true);
					setSelectedTaskForStatus(primaryTask);
				}
			}
		},

		w: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const hasChanges =
					details?.status &&
					(details.status.total > 0 ||
						details.status.modified > 0 ||
						details.status.added > 0 ||
						details.status.deleted > 0 ||
						details.status.untracked > 0);
				if (hasChanges) {
					setViewMode('workflow');
				}
			}
		},

		t: () => {
			if (
				viewMode === 'details' &&
				onNavigateToTask &&
				linkedTasks.length > 0
			) {
				// Find the first subtask in the linked tasks
				const subtask = linkedTasks.find((task) => task.parentId);
				if (subtask) {
					// Create a task object that represents the subtask
					const subtaskNavData = {
						id: subtask.id,
						parentId: subtask.parentId,
						title: subtask.title
					};
					onNavigateToTask(subtaskNavData);
				}
			}
		},

		// Additional legacy keys
		g: () => {
			if (
				viewMode === 'details' &&
				linkedTasks.length > 0 &&
				onNavigateToTask
			) {
				setViewMode('jump');
				setSelectedTaskIndex(0);
			}
		},

		x: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const hasChanges =
					details?.status &&
					(details.status.total > 0 ||
						details.status.modified > 0 ||
						details.status.added > 0 ||
						details.status.deleted > 0 ||
						details.status.untracked > 0);
				if (hasChanges) {
					handleCompleteWorkflow();
				}
			}
		}
	};

	useKeypress(keyHandlers);

	// Show link tasks modal
	if (showLinkTasksModal) {
		return (
			<LinkTasksModal
				worktree={worktree}
				backend={backend}
				onClose={() => {
					setShowLinkTasksModal(false);
					loadDetails(); // Refresh details after linking
				}}
			/>
		);
	}

	// Show Claude launcher modal
	if (showClaudeModal) {
		return (
			<Box
				flexDirection="column"
				height="100%"
				alignItems="center"
				justifyContent="center"
			>
				<ClaudeWorktreeLauncherModal
					backend={backend}
					worktree={worktree}
					tasks={linkedTasks}
					onClose={() => setShowClaudeModal(false)}
					onSuccess={(message) => {
						setShowClaudeModal(false);
						// Optionally show success message
					}}
				/>
			</Box>
		);
	}

	// Show task status modal using Ink UI Select
	if (showTaskStatusModal && selectedTaskForStatus) {
		const statusOptions = [
			{
				value: 'pending',
				label: 'Pending',
				description: 'Ready to be worked on'
			},
			{
				value: 'in-progress',
				label: 'In Progress',
				description: 'Currently being implemented'
			},
			{ value: 'done', label: 'Done', description: 'Completed and verified' },
			{ value: 'review', label: 'Review', description: 'Ready for review' },
			{
				value: 'deferred',
				label: 'Deferred',
				description: 'Postponed for later'
			},
			{
				value: 'cancelled',
				label: 'Cancelled',
				description: 'No longer needed'
			}
		];

		const handleStatusSelect = (selectedValue) => {
			handleSetTaskStatus(selectedTaskForStatus.id, selectedValue);
		};

		return (
			<BaseModal
				title={`Set Status: ${selectedTaskForStatus.title}`}
				preset="info"
				width="60%"
				height="60%"
				keyboardHints={['↑↓ navigate', 'ENTER select', 'ESC cancel']}
				onClose={() => {
					setShowTaskStatusModal(false);
					setSelectedTaskForStatus(null);
				}}
			>
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.text}>
							Current status:{' '}
							<Text color={theme.accent}>{selectedTaskForStatus.status}</Text>
						</Text>
						<Text color={theme.muted} marginTop={1}>
							Choose a new status for this task:
						</Text>
					</Box>

					<Select
						options={statusOptions.map((option) => ({
							label: `${option.label}`,
							value: option.value
						}))}
						onChange={handleStatusSelect}
					/>

					<Box marginTop={2}>
						<Text color={theme.muted} bold>
							Status Descriptions:
						</Text>
						{statusOptions.map((option) => (
							<Box key={option.value} marginTop={1}>
								<Text color={theme.muted}>
									• {option.label}: {option.description}
								</Text>
							</Box>
						))}
					</Box>
				</Box>
			</BaseModal>
		);
	}

	// Loading state
	if (loading) {
		return (
			<BaseModal {...getModalProps()}>
				<LoadingSpinner message="Loading worktree details..." />
			</BaseModal>
		);
	}

	// Workflow options view - using Ink UI Select component
	if (viewMode === 'workflow') {
		const defaultOptions = [
			{
				value: 'create-pr',
				label: 'Create Pull Request',
				description: 'Push changes and create a GitHub PR'
			},
			{
				value: 'merge-local',
				label: 'Merge Locally',
				description: 'Merge changes to main branch locally'
			}
		];

		const options = workflowOptions || defaultOptions;

		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text bold color={theme.accent}>
							Workflow Options
						</Text>
						<Text color={theme.muted}>
							Choose how to handle your completed work:
						</Text>
					</Box>

					{isProcessingWorkflow && (
						<Box marginBottom={2}>
							<LoadingSpinner message="Processing workflow..." />
						</Box>
					)}

					{workflowResult && !workflowResult.success && (
						<Box
							marginBottom={2}
							borderStyle="round"
							borderColor={theme.error}
							padding={1}
						>
							<Text color={theme.error}>
								{workflowResult.message || 'Workflow failed'}
							</Text>
						</Box>
					)}

					{workflowResult && workflowResult.success && (
						<Box
							marginBottom={2}
							borderStyle="round"
							borderColor={theme.success}
							padding={1}
						>
							<Text color={theme.success}>
								{workflowResult.message || 'Workflow completed successfully'}
							</Text>
							{workflowResult.prUrl && (
								<Text color={theme.text}>PR: {workflowResult.prUrl}</Text>
							)}
						</Box>
					)}

					<Box marginBottom={2}>
						<Select
							options={options.map((option) => ({
								label: `${option.label}`,
								value: option.value
							}))}
							onChange={(selectedValue) => {
								handleWorkflowChoice(selectedValue);
								setViewMode('details');
							}}
						/>
					</Box>

					<Box>
						<Text color={theme.muted} bold>
							💡 Options:
						</Text>
						{options.map((option) => (
							<Box key={option.value} marginTop={1}>
								<Text color={theme.muted}>
									• {option.label}: {option.description}
								</Text>
							</Box>
						))}
					</Box>
				</Box>
			</BaseModal>
		);
	}

	// Task list view
	if (viewMode === 'tasks') {
		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column">
					{/* Task List */}
					{linkedTasks.length === 0 ? (
						<Box paddingLeft={2}>
							<Text color={theme.muted}>No tasks linked to this worktree</Text>
						</Box>
					) : (
						<Box flexDirection="column">
							{linkedTasks.map((task, index) => (
								<Box
									key={task.id}
									backgroundColor={
										index === selectedTaskIndex
											? theme.backgroundHighlight
											: undefined
									}
									paddingLeft={1}
									paddingRight={1}
								>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{task.parentId ? '└─ ' : '• '}
									</Text>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{task.parentId ? `${task.id}` : `${task.id}`}
									</Text>
									<Text color={theme.muted}> │ </Text>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{task.title.length > 50
											? task.title.substring(0, 50) + '...'
											: task.title}
									</Text>
									{task.status === 'done' && (
										<Text color={theme.success}> ✓</Text>
									)}
									{task.status === 'in-progress' && (
										<Text color={theme.warning}> ⚡</Text>
									)}
								</Box>
							))}
						</Box>
					)}
				</Box>
			</BaseModal>
		);
	}

	// Jump to task view
	if (viewMode === 'jump') {
		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column">
					{/* Task List for jumping */}
					{linkedTasks.length === 0 ? (
						<Box paddingLeft={2}>
							<Text color={theme.muted}>No tasks linked to this worktree</Text>
						</Box>
					) : (
						<Box flexDirection="column">
							{linkedTasks.map((task, index) => (
								<Box
									key={task.id}
									backgroundColor={
										index === selectedTaskIndex
											? theme.backgroundHighlight
											: undefined
									}
									paddingLeft={1}
									paddingRight={1}
								>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{index === selectedTaskIndex ? '▸ ' : '  '}
									</Text>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`}
									</Text>
									<Text color={theme.muted}> - </Text>
									<Text
										color={
											index === selectedTaskIndex ? theme.accent : theme.text
										}
									>
										{task.title}
									</Text>
								</Box>
							))}
						</Box>
					)}
				</Box>
			</BaseModal>
		);
	}

	// Quick Actions view
	if (viewMode === 'quickActions') {
		const quickActionsOptions = [];

		// Always available actions
		if (linkedTasks.length > 0) {
			quickActionsOptions.push({
				value: 'claude',
				label: '💡 Launch Claude Code',
				description: 'Start a Claude Code session for this worktree'
			});

			quickActionsOptions.push({
				value: 'status',
				label: '📊 Set Task Status',
				description: 'Update the status of the linked task'
			});
		}

		// Workflow actions (only if there are changes)
		const hasUncommittedChanges = gitStatus && gitStatus.hasUncommittedChanges;
		const hasCommitsToShare = gitStatus && gitStatus.ahead > 0;

		if (hasUncommittedChanges || hasCommitsToShare) {
			quickActionsOptions.push({
				value: 'workflow',
				label: '🔄 Commit & Workflow',
				description: 'Commit changes and choose workflow (PR or merge)'
			});

			if (hasUncommittedChanges) {
				quickActionsOptions.push({
					value: 'complete',
					label: '⚡ Auto Complete',
					description: 'Automatically commit, merge locally, and close'
				});
			}
		}

		// Navigation actions
		if (linkedTasks.length > 0 && onNavigateToTask) {
			const subtask = linkedTasks.find((task) => task.parentId);
			if (subtask) {
				quickActionsOptions.push({
					value: 'jump-subtask',
					label: '🎯 Jump to Subtask',
					description: `Go to subtask ${subtask.id}: ${subtask.title}`
				});
			}

			quickActionsOptions.push({
				value: 'view-tasks',
				label: '📋 View All Tasks',
				description: 'See all tasks linked to this worktree'
			});
		}

		// Additional actions
		quickActionsOptions.push({
			value: 'link-tasks',
			label: '🔗 Link Tasks',
			description: 'Link additional tasks to this worktree'
		});

		if (!worktree.isCurrent && onDelete) {
			quickActionsOptions.push({
				value: 'delete',
				label: '🗑️ Delete Worktree',
				description: 'Permanently delete this worktree'
			});
		}

		const handleQuickActionSelect = (selectedValue) => {
			switch (selectedValue) {
				case 'claude':
					setShowClaudeModal(true);
					setViewMode('details');
					break;
				case 'status': {
					const primaryTask = getPrimaryTask();
					if (primaryTask) {
						setShowTaskStatusModal(true);
						setSelectedTaskForStatus(primaryTask);
					}
					setViewMode('details');
					break;
				}
				case 'workflow':
					setViewMode('workflow');
					break;
				case 'complete':
					handleCompleteWorkflow();
					setViewMode('details');
					break;
				case 'jump-subtask': {
					const subtask = linkedTasks.find((task) => task.parentId);
					if (subtask && onNavigateToTask) {
						const subtaskNavData = {
							id: subtask.id,
							parentId: subtask.parentId,
							title: subtask.title
						};
						onNavigateToTask(subtaskNavData);
					}
					break;
				}
				case 'view-tasks':
					setViewMode('tasks');
					setSelectedTaskIndex(0);
					break;
				case 'link-tasks':
					setShowLinkTasksModal(true);
					setViewMode('details');
					break;
				case 'delete':
					if (onDelete) {
						onDelete();
					}
					break;
				default:
					setViewMode('details');
			}
		};

		return (
			<BaseModal {...getModalProps()}>
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text bold color={theme.accent}>
							Quick Actions
						</Text>
						<Text color={theme.muted} marginTop={1}>
							Choose an action to perform on this worktree:
						</Text>
					</Box>

					{quickActionsOptions.length > 0 ? (
						<Select
							options={quickActionsOptions}
							onChange={handleQuickActionSelect}
						/>
					) : (
						<Box marginTop={2}>
							<Text color={theme.muted}>No actions available</Text>
						</Box>
					)}

					<Box marginTop={2}>
						<Text color={theme.muted} fontSize="small">
							💡 Tip: You can also use individual keys (c, s, w, t) for quick
							access
						</Text>
					</Box>
				</Box>
			</BaseModal>
		);
	}

	// Build content for scrollable details view
	const detailContent = [];

	// Basic Info
	detailContent.push({ type: 'text', content: `Path: ${worktree.path}` });
	detailContent.push({
		type: 'text',
		content: `Branch: ${worktree.isDetached ? '(detached HEAD)' : worktree.branch || 'N/A'}`,
		color: worktree.isDetached ? theme.warning : theme.text
	});
	detailContent.push({
		type: 'text',
		content: `HEAD: ${worktree.head || 'N/A'}`
	});

	// Status line
	const statusText =
		'Status: ' +
		(worktree.isCurrent ? '[CURRENT] ' : '') +
		(worktree.isLocked ? '[LOCKED] ' : '') +
		(worktree.isBare ? '[BARE] ' : '');
	detailContent.push({ type: 'text', content: statusText });

	// Linked Subtask - show early in the modal for visibility
	console.log('🔍 [WorktreeDetailsModal] linkedTasks:', linkedTasks);
	const linkedSubtask = linkedTasks.find((task) => task.parentId);
	console.log('🔍 [WorktreeDetailsModal] linkedSubtask found:', linkedSubtask);

	detailContent.push({ type: 'blank' });
	detailContent.push({
		type: 'header',
		content: 'Linked Subtask:'
	});

	if (!linkedSubtask) {
		detailContent.push({
			type: 'text',
			content: '  No subtask linked to this worktree',
			color: theme.warning,
			indent: 2
		});

		// Debug: show what tasks we do have
		if (linkedTasks.length > 0) {
			detailContent.push({
				type: 'text',
				content: `  Debug: Found ${linkedTasks.length} linked tasks`,
				color: theme.muted,
				indent: 2
			});
			linkedTasks.forEach((task, index) => {
				detailContent.push({
					type: 'text',
					content: `    ${index}: id=${task.id}, parentId=${task.parentId}, title=${task.title}`,
					color: theme.muted,
					indent: 2
				});
			});
		}
	} else {
		const statusIcon =
			linkedSubtask.status === 'done'
				? ' ✓'
				: linkedSubtask.status === 'in-progress'
					? ' ⚡'
					: '';

		detailContent.push({
			type: 'text',
			content: `  🎯 Subtask ${linkedSubtask.id}: ${linkedSubtask.title}${statusIcon}`,
			color: theme.accent,
			indent: 2
		});

		if (linkedSubtask.description) {
			detailContent.push({
				type: 'text',
				content: `     ${linkedSubtask.description}`,
				color: theme.textDim,
				indent: 2
			});
		}

		// Show a truncated version of details if available
		if (linkedSubtask.details) {
			const detailsPreview =
				linkedSubtask.details.length > 100
					? linkedSubtask.details.substring(0, 100) + '...'
					: linkedSubtask.details;
			detailContent.push({
				type: 'text',
				content: `     Details: ${detailsPreview}`,
				color: theme.textDim,
				indent: 2
			});
		}
	}

	// Add Git Status section (new)
	if (gitStatus) {
		detailContent.push({ type: 'blank' });
		detailContent.push({ type: 'header', content: 'Git Status:' });

		if (gitStatus.hasUncommittedChanges) {
			detailContent.push({
				type: 'text',
				content: `  ⚠️  Uncommitted changes detected`,
				color: theme.warning,
				indent: 2
			});

			if (gitStatus.staged > 0) {
				detailContent.push({
					type: 'text',
					content: `  📝 ${gitStatus.staged} staged files`,
					color: theme.success,
					indent: 2
				});
			}

			if (gitStatus.modified > 0) {
				detailContent.push({
					type: 'text',
					content: `  📄 ${gitStatus.modified} modified files`,
					color: theme.warning,
					indent: 2
				});
			}

			if (gitStatus.untracked > 0) {
				detailContent.push({
					type: 'text',
					content: `  ❓ ${gitStatus.untracked} untracked files`,
					color: theme.muted,
					indent: 2
				});
			}
		} else {
			detailContent.push({
				type: 'text',
				content: `  ✅ Working directory clean`,
				color: theme.success,
				indent: 2
			});
		}

		if (gitStatus.ahead > 0 || gitStatus.behind > 0) {
			let trackingStatus = '  ';
			if (gitStatus.ahead > 0) trackingStatus += `↑ ${gitStatus.ahead} ahead `;
			if (gitStatus.behind > 0)
				trackingStatus += `↓ ${gitStatus.behind} behind`;
			detailContent.push({
				type: 'text',
				content: trackingStatus,
				color: gitStatus.ahead > 0 ? theme.success : theme.warning,
				indent: 2
			});
		}
	}

	// Show workflow status if available
	if (workflowResult) {
		detailContent.push({ type: 'blank' });
		detailContent.push({ type: 'header', content: 'Workflow Status:' });

		if (workflowResult.success) {
			detailContent.push({
				type: 'text',
				content: `  ✅ ${workflowResult.message}`,
				color: theme.success,
				indent: 2
			});

			if (workflowResult.prUrl) {
				detailContent.push({
					type: 'text',
					content: `  🔗 PR: ${workflowResult.prUrl}`,
					color: theme.accent,
					indent: 2
				});
			}

			if (workflowResult.mergeCommit) {
				detailContent.push({
					type: 'text',
					content: `  🔀 Merge: ${workflowResult.mergeCommit.substring(0, 8)}`,
					color: theme.accent,
					indent: 2
				});
			}
		} else {
			detailContent.push({
				type: 'text',
				content: `  ❌ ${workflowResult.message}`,
				color: theme.error,
				indent: 2
			});
		}
	}

	// Add workflow guidance section
	if (viewMode === 'details') {
		const primaryTask = getPrimaryTask();
		const hasUncommittedChanges = gitStatus && gitStatus.hasUncommittedChanges;
		const hasRemote =
			gitStatus && gitStatus.remotes && gitStatus.remotes.length > 0;

		detailContent.push({ type: 'blank' });
		detailContent.push({ type: 'header', content: 'Next Steps:' });

		if (primaryTask) {
			// **PRIORITY 1: Check for uncommitted changes first** - this indicates Claude has done work
			if (hasUncommittedChanges) {
				detailContent.push({
					type: 'text',
					content: `  💾 You have uncommitted changes from Claude Code session`,
					color: theme.info,
					indent: 2
				});
				detailContent.push({
					type: 'text',
					content: `  🔄 Press 'w' to commit and continue workflow`,
					color: theme.accent,
					indent: 2
				});
				detailContent.push({
					type: 'text',
					content: `  ⚡ Press 'x' to manually trigger commit, merge & close`,
					color: theme.success,
					indent: 2
				});
				detailContent.push({
					type: 'text',
					content: `  📋 Press 'p' to create PR or 'm' to merge locally`,
					color: theme.accent,
					indent: 2
				});
			}
			// **PRIORITY 2: Task status guidance (only if no uncommitted changes)**
			else if (primaryTask.status === 'pending') {
				detailContent.push({
					type: 'text',
					content: `  📝 Task is ready to work on`,
					color: theme.info,
					indent: 2
				});
				detailContent.push({
					type: 'text',
					content: `  💡 Press 'c' to launch Claude Code session`,
					color: theme.accent,
					indent: 2
				});
			} else if (primaryTask.status === 'in-progress') {
				detailContent.push({
					type: 'text',
					content: `  🚧 Task is currently in progress`,
					color: theme.warning,
					indent: 2
				});
				detailContent.push({
					type: 'text',
					content: `  ✅ Ready to mark as done (Press 's' to update status)`,
					color: theme.success,
					indent: 2
				});
			} else if (primaryTask.status === 'done') {
				detailContent.push({
					type: 'text',
					content: `  ✅ Task completed successfully`,
					color: theme.success,
					indent: 2
				});

				// Add note about automatic workflow
				detailContent.push({
					type: 'text',
					content: `  💡 Workflow normally happens automatically after Claude sessions`,
					color: theme.textDim,
					indent: 2
				});

				// Check if there are committed changes ready for PR/merge
				if (hasRemote) {
					// Check if branch is ahead of remote (has commits to push)
					const hasCommitsToShare = gitStatus && gitStatus.ahead > 0;

					if (hasCommitsToShare) {
						detailContent.push({
							type: 'text',
							content: `  🚀 Ready to create PR or merge (${gitStatus.ahead} commits ahead)`,
							color: theme.accent,
							indent: 2
						});
						detailContent.push({
							type: 'text',
							content: `  📋 Press 'p' to create PR or 'm' to merge`,
							color: theme.accent,
							indent: 2
						});
						detailContent.push({
							type: 'text',
							content: `  ⚡ Press 'x' to manually trigger merge & close`,
							color: theme.success,
							indent: 2
						});
					} else {
						detailContent.push({
							type: 'text',
							content: `  🎯 All changes have been integrated`,
							color: theme.success,
							indent: 2
						});
					}
				} else {
					detailContent.push({
						type: 'text',
						content: `  📦 Local changes committed (no remote configured)`,
						color: theme.info,
						indent: 2
					});
				}
			}
		} else {
			detailContent.push({
				type: 'text',
				content: `  ⚠️  No task linked to this worktree`,
				color: theme.warning,
				indent: 2
			});
		}

		// Git status guidance
		if (gitStatus) {
			detailContent.push({ type: 'blank' });

			// Show commit status
			if (gitStatus.ahead > 0) {
				detailContent.push({
					type: 'text',
					content: `  📊 Branch Status: ${gitStatus.ahead} commits ahead of remote`,
					color: theme.info,
					indent: 2
				});
			}

			// Show working directory status
			if (hasUncommittedChanges) {
				detailContent.push({
					type: 'text',
					content: `  📊 Working Directory: ${gitStatus.modified} modified, ${gitStatus.staged} staged`,
					color: theme.info,
					indent: 2
				});
			} else {
				detailContent.push({
					type: 'text',
					content: `  📊 Working Directory: Clean`,
					color: theme.success,
					indent: 2
				});
			}
		}

		// Quick actions reminder
		detailContent.push({ type: 'blank' });
		const hasChanges =
			details?.status &&
			(details.status.total > 0 ||
				details.status.modified > 0 ||
				details.status.added > 0 ||
				details.status.deleted > 0 ||
				details.status.untracked > 0);
		const quickActions = ['c Claude', 's Status', 'w Workflow', 't Tasks'];
		if (hasChanges && linkedTasks.length > 0) {
			quickActions.push('x Manual Complete');
		}
		detailContent.push({
			type: 'text',
			content: `  🎯 Quick Actions: ${quickActions.join(' • ')}`,
			color: theme.textDim,
			indent: 2
		});
	}

	// Add error display
	if (error) {
		detailContent.push({ type: 'blank' });
		detailContent.push({
			type: 'text',
			content: `Error: ${error}`,
			color: theme.error
		});
		detailContent.push({ type: 'blank' });
	}

	// Add processing indicator
	if (isProcessingWorkflow) {
		detailContent.push({ type: 'blank' });
		detailContent.push({
			type: 'text',
			content: `⚡ Processing workflow...`,
			color: theme.warning
		});
		detailContent.push({ type: 'blank' });
	}

	// Add PR creation indicator
	if (isCreatingPR) {
		detailContent.push({ type: 'blank' });
		detailContent.push({
			type: 'text',
			content: `⚡ Creating pull request...`,
			color: theme.warning
		});
		detailContent.push({ type: 'blank' });
	}

	// Show PR result
	if (prResult) {
		detailContent.push({ type: 'blank' });
		if (prResult.success) {
			detailContent.push({
				type: 'text',
				content: `✅ PR created: ${prResult.prUrl}`,
				color: theme.success
			});
		} else {
			detailContent.push({
				type: 'text',
				content: `❌ PR creation failed: ${prResult.error}`,
				color: theme.error
			});
		}
		detailContent.push({ type: 'blank' });
	}

	// Note: Git status information is already displayed in the "Git Status:" section above
	// No need to duplicate the changes information here

	// Store content in ref for key handlers
	detailContentRef.current = detailContent;

	// Calculate visible content based on scroll offset
	const visibleContent = detailContent.slice(
		scrollOffset,
		scrollOffset + VISIBLE_ROWS
	);
	const totalLines = detailContent.length;

	// Calculate if we actually have scrollable content
	// If all content fits in the visible area, don't show scroll indicators
	const actualVisibleItems = visibleContent.length;
	const hasMoreContentBelow =
		actualVisibleItems === VISIBLE_ROWS &&
		scrollOffset + VISIBLE_ROWS < totalLines;
	const hasMoreContentAbove = scrollOffset > 0;
	const showScrollIndicators = hasMoreContentBelow || hasMoreContentAbove;

	// Main render (details view)
	const modalProps = getModalProps();
	const { hints, ...baseModalProps } = modalProps;

	return (
		<BaseModal {...baseModalProps} keyboardHints={hints}>
			<Box flexDirection="column">
				{/* Render visible content */}
				{visibleContent.map((item, index) => {
					const actualIndex = scrollOffset + index;
					switch (item.type) {
						case 'header':
							return (
								<Box key={actualIndex} marginBottom={0.5}>
									<Text bold color={theme.accent}>
										{item.content}
									</Text>
								</Box>
							);
						case 'text':
							return (
								<Box key={actualIndex} paddingLeft={item.indent || 0}>
									<Text color={item.color || theme.text}>{item.content}</Text>
								</Box>
							);
						case 'task':
							return (
								<Box key={actualIndex} paddingLeft={item.indent || 0}>
									<Text
										color={
											item.status === 'done'
												? theme.success
												: item.status === 'in-progress'
													? theme.warning
													: theme.text
										}
									>
										{item.content}
									</Text>
								</Box>
							);
						case 'blank':
							return <Box key={actualIndex} height={1} />;
						default:
							return null;
					}
				})}

				{/* Scroll indicators */}
				{showScrollIndicators && (
					<Box marginTop={1} justifyContent="center">
						<Text color={theme.muted}>
							{hasMoreContentAbove && '↑ '}
							Line {Math.min(scrollOffset + 1, totalLines)}-
							{Math.min(scrollOffset + actualVisibleItems, totalLines)} of{' '}
							{totalLines}
							{hasMoreContentBelow && ' ↓'}
						</Text>
					</Box>
				)}
			</Box>
		</BaseModal>
	);
}
