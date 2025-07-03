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
	const [viewMode, setViewMode] = useState('details'); // 'details', 'tasks', or 'jump'
	const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [isCreatingPR, setIsCreatingPR] = useState(false);
	const [prResult, setPrResult] = useState(null);
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
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleCreatePR = async () => {
		if (isCreatingPR) return;

		setIsCreatingPR(true);
		setError(null);
		setPrResult(null);

		try {
			// Find the primary task/subtask for this worktree
			const primaryTask = linkedTasks.find(task => 
				task.status === 'done' || task.status === 'in-progress'
			) || linkedTasks[0];

			if (!primaryTask) {
				throw new Error('No suitable task found for PR creation');
			}

			// Generate PR title and description
			const prTitle = primaryTask.parentId 
				? `Task ${primaryTask.parentId}.${primaryTask.id}: ${primaryTask.title}`
				: `Task ${primaryTask.id}: ${primaryTask.title}`;
			
			const prDescription = `Implemented ${primaryTask.parentId ? 'subtask' : 'task'} ${primaryTask.id}: ${primaryTask.title}

## Changes Made
- ${details.status.added > 0 ? `${details.status.added} files added` : ''}
- ${details.status.modified > 0 ? `${details.status.modified} files modified` : ''}
- ${details.status.deleted > 0 ? `${details.status.deleted} files deleted` : ''}

## Worktree Details
- Branch: ${worktree.branch}
- Source: ${details.sourceBranch || 'main'}
- Path: ${worktree.path}

Completed via Task Master Flow.`;

			// Create PR using backend
			let result;
			if (primaryTask.parentId) {
				// This is a subtask
				result = await backend.completeSubtaskWithPR(worktree.name, {
					createPR: true,
					prTitle,
					prDescription: prDescription
				});
			} else {
				// This is a main task - create PR manually using gh CLI
				try {
					const { exec } = await import('child_process');
					const { promisify } = await import('util');
					const execAsync = promisify(exec);

					// Check if gh cli is available
					await execAsync('gh --version', { stdio: 'ignore' });

					// First, commit any uncommitted changes
					try {
						await execAsync('git add .', { cwd: worktree.path });
						await execAsync(`git commit -m "${prTitle}"`, { cwd: worktree.path });
					} catch (commitError) {
						// It's okay if there's nothing to commit
						console.log('No changes to commit or commit failed:', commitError.message);
					}

					// Push the branch to remote (this handles the "must first push" error)
					const branchName = worktree.branch || `task-${primaryTask.id}`;
					try {
						await execAsync(`git push origin "${branchName}"`, { cwd: worktree.path });
					} catch (pushError) {
						// Try to set upstream and push
						await execAsync(`git push --set-upstream origin "${branchName}"`, { cwd: worktree.path });
					}

					// Create PR using gh cli - always use --head flag
					const sourceBranch = details.sourceBranch || worktree.sourceBranch || 'main';
					const prCommand = `gh pr create --title "${prTitle}" --body "${prDescription}" --base ${sourceBranch} --head ${branchName}`;
					
					const prResult = await execAsync(prCommand, { 
						cwd: worktree.path, 
						encoding: 'utf8' 
					});

					// Extract PR URL from output
					const prUrl = prResult.stdout.trim().split('\n').pop();
					
					result = {
						success: true,
						prUrl: prUrl
					};
				} catch (ghError) {
					if (ghError.message.includes('gh: command not found') || ghError.code === 'ENOENT') {
						throw new Error('GitHub CLI (gh) is not installed. Please install it to create PRs automatically.');
					}
					throw new Error(`Failed to create PR: ${ghError.message}`);
				}
			}

			if (result && (result.success || result.prUrl)) {
				setPrResult({
					success: true,
					prUrl: result.prUrl,
					prTitle
				});
			} else {
				throw new Error(result?.error || 'Failed to create PR');
			}
		} catch (err) {
			console.error('Error creating PR:', err);
			setError(`Failed to create PR: ${err.message}`);
		} finally {
			setIsCreatingPR(false);
		}
	};

	// Dynamic modal props based on current mode
	const getModalProps = () => {
		if (loading) {
			return {
				title: 'Loading Worktree Details',
				preset: 'info',
				width: 80,
				height: 10,
				onClose
			};
		}

		const baseProps = {
			width: 80,
			height: VISIBLE_ROWS + 6,
			onClose
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
			default: {
				// details
				const hints = ['ESC close'];
				// Note: We'll check content length after building detailContent, not here
				if (linkedTasks.length > 0 && onNavigateToTask) {
					hints.unshift('v view tasks', 'g jump to task');
				}
				hints.unshift('l link/manage tasks');
				if (linkedTasks.length > 0) hints.unshift('c launch Claude');
				// Add PR creation hint if there are changes and linked tasks
				const hasChanges = details?.status && (
					details.status.total > 0 || 
					details.status.modified > 0 || 
					details.status.added > 0 || 
					details.status.deleted > 0 || 
					details.status.untracked > 0
				);
				console.log('🔍 [WorktreeDetailsModal] PR hint condition:', {
					linkedTasksLength: linkedTasks.length,
					detailsStatus: details?.status,
					hasChanges,
					willShowPRHint: linkedTasks.length > 0 && hasChanges
				});
				if (linkedTasks.length > 0 && hasChanges) {
					hints.unshift('p create PR');
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
			if (viewMode === 'tasks' || viewMode === 'jump') {
				setViewMode('details');
			} else {
				onClose();
			}
		},

		// Navigation for all modes
		up: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
			} else if (viewMode === 'details') {
				setScrollOffset((prev) => Math.max(0, prev - 1));
			}
		},

		down: () => {
			if (viewMode === 'jump' || viewMode === 'tasks') {
				setSelectedTaskIndex(
					Math.min(linkedTasks.length - 1, selectedTaskIndex + 1)
				);
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
			if (
				(viewMode === 'jump' || viewMode === 'tasks') &&
				linkedTasks.length > 0 &&
				onNavigateToTask
			) {
				const selectedTask = linkedTasks[selectedTaskIndex];
				onNavigateToTask(selectedTask);
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
					handleCreatePR();
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

	detailContent.push({
		type: 'text',
		content: `Disk Usage: ${worktree.diskUsage || 'Unknown'}`
	});
	detailContent.push({ type: 'blank' });

	// Additional details
	if (details) {
		if (details.latestCommit) {
			detailContent.push({ type: 'header', content: 'Latest Commit:' });
			detailContent.push({
				type: 'text',
				content: `  ${details.latestCommit.hash} - ${details.latestCommit.subject}`,
				indent: 2
			});
			detailContent.push({
				type: 'text',
				content: `  by ${details.latestCommit.author} (${details.latestCommit.date})`,
				dimColor: true,
				indent: 2
			});
			detailContent.push({ type: 'blank' });
		}

		if (details.status) {
			detailContent.push({ type: 'header', content: 'Working Tree Status:' });
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
			if (details.status.total === 0) {
				detailContent.push({
					type: 'text',
					content: '  Clean (no changes)',
					color: theme.success,
					indent: 2
				});
			}
			detailContent.push({ type: 'blank' });
		}

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
		<BaseModal 
			{...baseModalProps}
			showCloseHint={false} // We'll show our own hints
			footer={
				hints && hints.length > 0 && (
					<Box justifyContent="center">
						<Text color={theme.textDim}>
							{hints.join(' • ')}
						</Text>
					</Box>
				)
			}
		>
			<Box flexDirection="column">
				{/* Scrollable content */}
				<Box flexDirection="column" height={VISIBLE_ROWS}>
					{visibleContent.map((line, index) => {
						const lineKey = `${line.type}-${scrollOffset + index}-${line.content?.substring(0, 20) || index}`;

						if (line.type === 'blank') {
							return <Box key={lineKey} height={1} />;
						} else if (line.type === 'header') {
							return (
								<Text key={lineKey} bold color={theme.primary}>
									{line.content}
								</Text>
							);
						} else if (line.type === 'task') {
							return (
								<Text
									key={lineKey}
									color={line.status === 'done' ? theme.success : theme.text}
								>
									{line.content}
								</Text>
							);
						} else {
							return (
								<Text
									key={lineKey}
									color={line.color || theme.text}
									dimColor={line.dimColor}
								>
									{line.content}
								</Text>
							);
						}
					})}
				</Box>

				{/* Scroll indicator */}
				{totalLines > VISIBLE_ROWS && (
					<Box marginTop={1}>
						<Text color={theme.muted}>
							Lines {scrollOffset + 1}-
							{Math.min(scrollOffset + VISIBLE_ROWS, totalLines)} of{' '}
							{totalLines}
						</Text>
					</Box>
				)}

				{/* PR Creation Status */}
				{isCreatingPR && (
					<Box marginTop={1}>
						<Text color={theme.warning}>⚡ Creating pull request...</Text>
					</Box>
				)}

				{/* PR Creation Result */}
				{prResult && (
					<Box marginTop={1} flexDirection="column">
						<Text color={theme.success}>✓ Pull request created successfully!</Text>
						<Text color={theme.muted}>PR: {prResult.prTitle}</Text>
						<Text color={theme.accent}>URL: {prResult.prUrl}</Text>
					</Box>
				)}

				{/* Error Message */}
				{error && (
					<Box marginTop={1}>
						<Text color="red">✗ {error}</Text>
					</Box>
				)}
			</Box>
		</BaseModal>
	);
}
