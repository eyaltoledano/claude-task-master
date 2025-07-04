import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';
import { backgroundOperations } from '../services/BackgroundOperationsManager.js';

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
	const [viewMode, setViewMode] = useState('details'); // 'details', 'tasks', 'jump', or 'workflow'
	const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [isCreatingPR, setIsCreatingPR] = useState(false);
	const [isProcessingWorkflow, setIsProcessingWorkflow] = useState(false);
	const [prResult, setPrResult] = useState(null);
	const [workflowResult, setWorkflowResult] = useState(null);
	const [gitStatus, setGitStatus] = useState(null);
	const [workflowOptions, setWorkflowOptions] = useState(null);
	const [selectedWorkflowOption, setSelectedWorkflowOption] = useState(0);
	const [showTaskStatusModal, setShowTaskStatusModal] = useState(false);
	const [selectedTaskForStatus, setSelectedTaskForStatus] = useState(null);
	const [selectedStatusIndex, setSelectedStatusIndex] = useState(0);
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
				if (metadata.worktreePath === worktree.path || 
					metadata.worktreeName === worktree.name) {
					console.log(`🔄 [WorktreeDetailsModal] Refreshing after operation completion: ${operationId}`);
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
			const primaryTask = linkedTasks.find(task => 
				task.status === 'done' || task.status === 'in-progress'
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
			
			default: {
				const hints = [
					'c launch Claude',
					's set status',
					'w workflow',
					'g jump to task'
				];
				
				// Add subtask-specific hint if this worktree is linked to a subtask
				const hasSubtask = linkedTasks.some(task => task.parentId);
				if (hasSubtask) {
					hints.push('t jump to subtask');
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
			if (viewMode === 'tasks' || viewMode === 'jump' || viewMode === 'workflow') {
				setViewMode('details');
			} else if (showTaskStatusModal) {
				setShowTaskStatusModal(false);
				setSelectedTaskForStatus(null);
				setSelectedStatusIndex(0);
			} else {
				onClose();
			}
		},

		// Navigation for all modes
		up: () => {
			if (showTaskStatusModal) {
				setSelectedStatusIndex(Math.max(0, selectedStatusIndex - 1));
			} else if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (viewMode === 'workflow') {
				setSelectedWorkflowOption(Math.max(0, selectedWorkflowOption - 1));
			} else if (viewMode === 'details') {
				setScrollOffset((prev) => Math.max(0, prev - 1));
			}
		},

		down: () => {
			if (showTaskStatusModal) {
				const statusOptions = [
					{ value: 'pending', label: 'Pending' },
					{ value: 'in-progress', label: 'In Progress' },
					{ value: 'done', label: 'Done' },
					{ value: 'review', label: 'Review' },
					{ value: 'deferred', label: 'Deferred' },
					{ value: 'cancelled', label: 'Cancelled' }
				];
				setSelectedStatusIndex(Math.min(statusOptions.length - 1, selectedStatusIndex + 1));
			} else if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(
					Math.min(linkedTasks.length - 1, selectedTaskIndex + 1)
				);
			} else if (viewMode === 'workflow') {
				const maxOptions = workflowOptions ? workflowOptions.length - 1 : 0;
				setSelectedWorkflowOption(Math.min(maxOptions, selectedWorkflowOption + 1));
			} else if (viewMode === 'details') {
				setScrollOffset((prev) => prev + 1);
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
			if (showTaskStatusModal && selectedTaskForStatus) {
				const statusOptions = [
					{ value: 'pending', label: 'Pending' },
					{ value: 'in-progress', label: 'In Progress' },
					{ value: 'done', label: 'Done' },
					{ value: 'review', label: 'Review' },
					{ value: 'deferred', label: 'Deferred' },
					{ value: 'cancelled', label: 'Cancelled' }
				];
				const selectedStatus = statusOptions[selectedStatusIndex];
				if (selectedStatus) {
					handleSetTaskStatus(selectedTaskForStatus.id, selectedStatus.value);
				}
			} else if (viewMode === 'jump' || viewMode === 'tasks') {
				if (linkedTasks.length > 0 && onNavigateToTask) {
					const selectedTask = linkedTasks[selectedTaskIndex];
					onNavigateToTask(selectedTask);
				}
			} else if (viewMode === 'workflow') {
				if (workflowOptions && workflowOptions[selectedWorkflowOption]) {
					const selectedOption = workflowOptions[selectedWorkflowOption];
					handleWorkflowChoice(selectedOption.value);
					setViewMode('details');
				}
			}
		},

		// Action keys (details view only)
		d: () => {
			if (viewMode === 'details' && !worktree.isCurrent && onDelete) {
				onDelete();
			}
		},

		l: () => {
			if (viewMode === 'details') {
				setShowLinkTasksModal(true);
			}
		},

		v: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				setViewMode('tasks');
				setSelectedTaskIndex(0);
			}
		},

		// Use 'g' for jump to avoid conflict with 'j' vim navigation
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

		// Use 't' for direct jump to subtask (if this worktree is linked to a subtask)
		t: () => {
			if (viewMode === 'details' && onNavigateToTask && linkedTasks.length > 0) {
				// Find the first subtask in the linked tasks
				const subtask = linkedTasks.find(task => task.parentId);
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

		c: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				setShowClaudeModal(true);
			}
		},

		// Enhanced workflow keys
		w: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const hasChanges = details?.status && (
					details.status.total > 0 || 
					details.status.modified > 0 || 
					details.status.added > 0 || 
					details.status.deleted > 0 || 
					details.status.untracked > 0
				);
				if (hasChanges) {
					setViewMode('workflow');
					setSelectedWorkflowOption(0);
				}
			}
		},

		p: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const hasChanges = details?.status && (
					details.status.total > 0 || 
					details.status.modified > 0 || 
					details.status.added > 0 || 
					details.status.deleted > 0 || 
					details.status.untracked > 0
				);
				if (hasChanges) {
					handleWorkflowChoice('create-pr');
				}
			}
		},

		m: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const hasChanges = details?.status && (
					details.status.total > 0 || 
					details.status.modified > 0 || 
					details.status.added > 0 || 
					details.status.deleted > 0 || 
					details.status.untracked > 0
				);
				if (hasChanges) {
					handleWorkflowChoice('merge-local');
				}
			}
		},

		s: () => {
			if (viewMode === 'details' && linkedTasks.length > 0) {
				const primaryTask = getPrimaryTask();
				if (primaryTask) {
					setShowTaskStatusModal(true);
					setSelectedTaskForStatus(primaryTask);
					setSelectedStatusIndex(0);
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

	// Show task status modal
	if (showTaskStatusModal && selectedTaskForStatus) {
		const statusOptions = [
			{ value: 'pending', label: 'Pending', description: 'Ready to be worked on' },
			{ value: 'in-progress', label: 'In Progress', description: 'Currently being implemented' },
			{ value: 'done', label: 'Done', description: 'Completed and verified' },
			{ value: 'review', label: 'Review', description: 'Ready for review' },
			{ value: 'deferred', label: 'Deferred', description: 'Postponed for later' },
			{ value: 'cancelled', label: 'Cancelled', description: 'No longer needed' }
		];

		return (
			<BaseModal
				title={`Set Status: ${selectedTaskForStatus.title}`}
				preset="info"
				width="60%"
				height="50%"
				keyboardHints={['↑↓ navigate', 'ENTER select', 'ESC cancel']}
				onClose={() => {
					setShowTaskStatusModal(false);
					setSelectedTaskForStatus(null);
				}}
			>
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color={theme.text}>
							Current status: <Text color={theme.accent}>{selectedTaskForStatus.status}</Text>
						</Text>
					</Box>
					
					{statusOptions.map((option, index) => (
						<Box
							key={option.value}
							backgroundColor={
								index === selectedStatusIndex
									? theme.backgroundHighlight
									: undefined
							}
							paddingLeft={1}
							paddingRight={1}
						>
							<Text
								color={
									index === selectedStatusIndex ? theme.accent : theme.text
								}
							>
								{index === selectedStatusIndex ? '▸ ' : '  '}
								{option.label}
							</Text>
							<Text color={theme.muted}> - {option.description}</Text>
						</Box>
					))}
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

	// Workflow options view
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
						<Text bold color={theme.accent}>Workflow Options</Text>
					</Box>
					
					{isProcessingWorkflow && (
						<Box marginBottom={2}>
							<LoadingSpinner message="Processing workflow..." />
						</Box>
					)}
					
					{workflowResult && !workflowResult.success && (
						<Box marginBottom={2} borderStyle="round" borderColor={theme.error} padding={1}>
							<Text color={theme.error}>
								{workflowResult.message || 'Workflow failed'}
							</Text>
						</Box>
					)}
					
					{workflowResult && workflowResult.success && (
						<Box marginBottom={2} borderStyle="round" borderColor={theme.success} padding={1}>
							<Text color={theme.success}>
								{workflowResult.message || 'Workflow completed successfully'}
							</Text>
							{workflowResult.prUrl && (
								<Text color={theme.text}>PR: {workflowResult.prUrl}</Text>
							)}
						</Box>
					)}

					<Box flexDirection="column">
						{options.map((option, index) => (
							<Box
								key={option.value}
								marginBottom={1}
								backgroundColor={
									index === selectedWorkflowOption ? theme.backgroundHighlight : undefined
								}
								paddingX={1}
								paddingY={0}
							>
								<Text
									color={index === selectedWorkflowOption ? theme.accent : theme.text}
								>
									{index === selectedWorkflowOption ? '▸ ' : '  '}
									{option.label}
								</Text>
								{index === selectedWorkflowOption && option.description && (
									<Box marginLeft={4} marginTop={0}>
										<Text color={theme.muted}>{option.description}</Text>
									</Box>
								)}
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
			if (gitStatus.behind > 0) trackingStatus += `↓ ${gitStatus.behind} behind`;
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
		const hasUncommittedChanges = gitStatus && (gitStatus.modified.length > 0 || gitStatus.staged.length > 0);
		const hasRemote = gitStatus && gitStatus.remotes && gitStatus.remotes.length > 0;
		
		detailContent.push({ type: 'blank' });
		detailContent.push({ type: 'header', content: 'Next Steps:' });
		
		if (primaryTask) {
			// Task status guidance
			if (primaryTask.status === 'pending') {
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
				if (hasUncommittedChanges) {
					detailContent.push({
						type: 'text',
						content: `  💾 You have uncommitted changes`,
						color: theme.info,
						indent: 2
					});
					detailContent.push({
						type: 'text',
						content: `  🔄 Press 'w' to commit and continue workflow`,
						color: theme.accent,
						indent: 2
					});
				} else {
					detailContent.push({
						type: 'text',
						content: `  ✅ Ready to mark as done (Press 's' to update status)`,
						color: theme.success,
						indent: 2
					});
				}
			} else if (primaryTask.status === 'done') {
				detailContent.push({
					type: 'text',
					content: `  ✅ Task completed successfully`,
					color: theme.success,
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
				
				// Show any uncommitted changes that might exist
				if (hasUncommittedChanges) {
					detailContent.push({
						type: 'text',
						content: `  ⚠️  Additional uncommitted changes detected`,
						color: theme.warning,
						indent: 2
					});
					detailContent.push({
						type: 'text',
						content: `  🔄 Press 'w' to commit these changes`,
						color: theme.accent,
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
					content: `  📊 Working Directory: ${gitStatus.modified.length} modified, ${gitStatus.staged.length} staged`,
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
		detailContent.push({
			type: 'text',
			content: `  🎯 Quick Actions: 'c' Claude • 's' Status • 'w' Workflow • 't' Tasks`,
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

	// Git Status Information
	if (details && details.status) {
		detailContent.push({ type: 'header', content: 'Changes:' });
		if (details.status.total === 0) {
			detailContent.push({
				type: 'text',
				content: '  No changes',
				color: theme.muted,
				indent: 2
			});
		} else {
			if (details.status.modified > 0) {
				detailContent.push({
					type: 'text',
					content: `  Modified: ${details.status.modified}`,
					color: theme.warning,
					indent: 2
				});
			}
			if (details.status.added > 0) {
				detailContent.push({
					type: 'text',
					content: `  Added: ${details.status.added}`,
					color: theme.success,
					indent: 2
				});
			}
			if (details.status.deleted > 0) {
				detailContent.push({
					type: 'text',
					content: `  Deleted: ${details.status.deleted}`,
					color: theme.error,
					indent: 2
				});
			}
			if (details.status.untracked > 0) {
				detailContent.push({
					type: 'text',
					content: `  Untracked: ${details.status.untracked}`,
					color: theme.muted,
					indent: 2
				});
			}
		}
		detailContent.push({ type: 'blank' });

		if (details.trackingBranch) {
			detailContent.push({ type: 'header', content: 'Tracking:' });
			detailContent.push({
				type: 'text',
				content: `  ${details.trackingBranch}`,
				indent: 2
			});
			if (details.ahead > 0 || details.behind > 0) {
				let trackingStatus = '  ';
				if (details.ahead > 0) trackingStatus += `↑ ${details.ahead} ahead `;
				if (details.behind > 0) trackingStatus += `↓ ${details.behind} behind`;
				detailContent.push({
					type: 'text',
					content: trackingStatus,
					color: details.ahead > 0 ? theme.success : theme.warning,
					indent: 2
				});
			}
			detailContent.push({ type: 'blank' });
		}
	}

	// Linked Tasks - show all of them with subtask prominence
	const subtasks = linkedTasks.filter(task => task.parentId);
	const parentTasks = linkedTasks.filter(task => !task.parentId);
	
	detailContent.push({
		type: 'header',
		content: `Linked Tasks (${linkedTasks.length}):`
	});
	
	if (linkedTasks.length === 0) {
		detailContent.push({
			type: 'text',
			content: '  No tasks linked to this worktree',
			color: theme.muted,
			indent: 2
		});
	} else {
		// Show primary subtask first (most common case)
		if (subtasks.length > 0) {
			const primarySubtask = subtasks[0]; // First subtask is primary
			const statusIcon = primarySubtask.status === 'done' ? ' ✓' : 
							   primarySubtask.status === 'in-progress' ? ' ⚡' : '';
			
			detailContent.push({
				type: 'text',
				content: `  🎯 Primary: Subtask ${primarySubtask.id} - ${primarySubtask.title}${statusIcon}`,
				color: theme.accent,
				indent: 2
			});
			
			// Show additional subtasks if any
			if (subtasks.length > 1) {
				subtasks.slice(1).forEach((task) => {
					const statusIcon = task.status === 'done' ? ' ✓' : 
									   task.status === 'in-progress' ? ' ⚡' : '';
					detailContent.push({
						type: 'task',
						content: `  └─ Subtask ${task.id}: ${task.title}${statusIcon}`,
						status: task.status,
						indent: 2
					});
				});
			}
		}
		
		// Show parent tasks
		if (parentTasks.length > 0) {
			if (subtasks.length > 0) {
				detailContent.push({ type: 'blank' });
			}
			parentTasks.forEach((task) => {
				const statusIcon = task.status === 'done' ? ' ✓' : 
								   task.status === 'in-progress' ? ' ⚡' : '';
				detailContent.push({
					type: 'task',
					content: `  • Task ${task.id}: ${task.title}${statusIcon}`,
					status: task.status,
					indent: 2
				});
			});
		}
	}

	// Calculate visible content based on scroll offset
	const visibleContent = detailContent.slice(
		scrollOffset,
		scrollOffset + VISIBLE_ROWS
	);
	const totalLines = detailContent.length;

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
				{totalLines > VISIBLE_ROWS && (
					<Box marginTop={1} justifyContent="center">
						<Text color={theme.muted}>
							{scrollOffset > 0 && '↑ '}
							Line {Math.min(scrollOffset + 1, totalLines)}-
							{Math.min(scrollOffset + VISIBLE_ROWS, totalLines)} of {totalLines}
							{scrollOffset + VISIBLE_ROWS < totalLines && ' ↓'}
						</Text>
					</Box>
				)}
			</Box>
		</BaseModal>
	);
}
