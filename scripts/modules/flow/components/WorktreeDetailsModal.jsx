import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';

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
	const theme = useComponentTheme('modal');

	// Constants for scrolling
	const VISIBLE_ROWS = 20;

	// Load worktree details
	useEffect(() => {
		loadDetails();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
				// details
				const hints = ['ESC close'];
				
				if (linkedTasks.length > 0 && onNavigateToTask) {
					hints.unshift('v view tasks', 'g jump to task');
				}
				hints.unshift('l link/manage tasks');
				if (linkedTasks.length > 0) hints.unshift('c launch Claude');
				
				// Enhanced workflow hints based on git status
				const hasChanges = details?.status && (
					details.status.total > 0 || 
					details.status.modified > 0 || 
					details.status.added > 0 || 
					details.status.deleted > 0 || 
					details.status.untracked > 0
				);
				
				if (linkedTasks.length > 0 && hasChanges) {
					hints.unshift('w workflow options', 'p create PR', 'm merge locally');
				}
				
				if (!worktree.isCurrent) hints.unshift('d delete');

				return {
					...baseProps,
					title: `Worktree Details: ${worktree.name}`,
					preset: error ? 'error' : 'default',
					hints: hints
				};
			}
		}
	};

	const keyHandlers = {
		escape: () => {
			if (viewMode === 'tasks' || viewMode === 'jump' || viewMode === 'workflow') {
				setViewMode('details');
			} else {
				onClose();
			}
		},

		// Navigation for all modes
		up: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (viewMode === 'workflow') {
				setSelectedWorkflowOption(Math.max(0, selectedWorkflowOption - 1));
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
			if (viewMode === 'jump' || viewMode === 'tasks') {
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

	// Linked Tasks - show all of them
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
		linkedTasks.forEach((task) => {
			const prefix = task.parentId ? '  └─ ' : '  • ';
			const taskType = task.parentId ? `Subtask ${task.id}` : `Task ${task.id}`;
			let line = `${prefix}${taskType}: ${task.title}`;
			if (task.status === 'done') line += ' ✓';
			if (task.status === 'in-progress') line += ' ⚡';

			detailContent.push({
				type: 'task',
				content: line,
				status: task.status,
				indent: 2
			});
		});
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
