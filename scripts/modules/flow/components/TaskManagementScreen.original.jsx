import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { flushSync } from 'react-dom';
import { useAppContext } from '../app/index-root.jsx';
import { getTheme } from '../shared/theme/theme.js';
import { Toast } from '../shared/components/ui/Toast.jsx';
import { ExpandModal } from './ExpandModal.jsx';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';
import { SimpleTable } from './SimpleTable.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import TextInput from 'ink-text-input';
import { WorktreeBranchConflictModal } from './WorktreeBranchConflictModal.jsx';
import { StreamingModal } from './StreamingModal.jsx';
import { streamingStateManager } from '../infra/streaming/StreamingStateManager.js';

export function TaskManagementScreen() {
	const {
		backend,
		tasks,
		reloadTasks,
		setCurrentScreen,
		currentTag,
		navigationData
	} = useAppContext();
	const theme = getTheme();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [expandedTasks, setExpandedTasks] = useState(new Set());
	const [filter, setFilter] = useState('all'); // all, pending, done, in-progress
	const [filterMode, setFilterMode] = useState('status'); // status or priority
	const [priorityFilter, setPriorityFilter] = useState('all'); // all, high, medium, low
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewMode, setViewMode] = useState('list'); // list, detail, subtasks, or subtask-detail
	const [selectedTask, setSelectedTask] = useState(null);
	const [showExpandOptions, setShowExpandOptions] = useState(false);
	const [toast, setToast] = useState(null);
	const [isExpanding, setIsExpanding] = useState(false);
	const [expandError, setExpandError] = useState(null);
	const [isLaunchingClaude, setIsLaunchingClaude] = useState(false);
	const [detailScrollOffset, setDetailScrollOffset] = useState(0);
	const [taskWorktrees, setTaskWorktrees] = useState([]); // Add state for worktrees
	const [subtaskWorktrees, setSubtaskWorktrees] = useState(new Map()); // Add state for subtask worktrees
	const [complexityReport, setComplexityReport] = useState(null);
	const [loadingComplexity, setLoadingComplexity] = useState(false);
	const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState(0);
	const [subtasksScrollOffset, setSubtasksScrollOffset] = useState(0);
	const [selectedSubtask, setSelectedSubtask] = useState(null); // For subtask detail view
	const [showClaudeLauncherModal, setShowClaudeLauncherModal] = useState(false);
	const [claudeWorktree, setClaudeWorktree] = useState(null);
	const [showBranchConflictModal, setShowBranchConflictModal] = useState(false);
	const [branchConflictInfo, setBranchConflictInfo] = useState(null);
	const [showStreamingModal, setShowStreamingModal] = useState(false);

	// Constants for display
	const VISIBLE_ROWS = 15; // Reduced for better visibility
	const DETAIL_VISIBLE_ROWS = 20; // Visible rows in detail view

	// Memoize the task object for the modal to prevent re-renders
	const modalTaskData = useMemo(() => {
		if (!selectedTask || !selectedSubtask) return null;
		return [
			{
				id: `${selectedTask.id}.${selectedSubtask.id}`,
				title: selectedSubtask.title,
				description: selectedSubtask.description,
				details: selectedSubtask.details, // Include implementation details
				testStrategy: selectedSubtask.testStrategy, // Include test strategy
				status: selectedSubtask.status,
				dependencies: selectedSubtask.dependencies,
				parentId: selectedTask.id,
				parentTitle: selectedTask.title
			}
		];
	}, [selectedTask, selectedSubtask]);

	// Reload tasks on mount
	useEffect(() => {
		reloadTasks();
	}, [reloadTasks]);

	// Handle navigation data
	useEffect(() => {
		if (navigationData?.selectedTaskId && tasks.length > 0) {
			// Find the task in the list
			const taskIndex = tasks.findIndex(
				(task) => task.id === navigationData.selectedTaskId
			);
			if (taskIndex !== -1) {
				// Set the selected task index
				setSelectedIndex(taskIndex);
				const task = tasks[taskIndex];

				// Navigate to the task detail view
				showTaskDetail(task)
					.then((fullTask) => {
						setSelectedTask(fullTask);

						// If there's a selected subtask, navigate to it
						if (navigationData.selectedSubtaskId && fullTask.subtasks) {
							const subtaskIndex = fullTask.subtasks.findIndex(
								(subtask) =>
									`${fullTask.id}.${subtask.id}` ===
									navigationData.selectedSubtaskId
							);
							if (subtaskIndex !== -1) {
								setSelectedSubtaskIndex(subtaskIndex);
								// Go directly to subtask detail view
								setSelectedSubtask(fullTask.subtasks[subtaskIndex]);
								// Check if we have a specific view mode to navigate to
								if (navigationData.viewMode === 'subtask-detail') {
									setViewMode('subtask-detail');
								} else {
									// Default behavior - go to subtask detail
									setViewMode('subtask-detail');
								}
								setDetailScrollOffset(0);
							} else {
								// No subtask, show task detail
								setViewMode('detail');
								setDetailScrollOffset(0);
							}
						} else {
							// No subtask requested, show task detail
							setViewMode('detail');
							setDetailScrollOffset(0);
						}
					})
					.catch((error) => {
						console.error('Failed to navigate to task:', error);
						showToast('Failed to load task details', 'error');
					});
			}
		}
		// Note: showTaskDetail is defined later, so we rely on function hoisting
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [navigationData, tasks]);

	// Load complexity report when tag changes or on mount
	useEffect(() => {
		const loadComplexityReport = async () => {
			setLoadingComplexity(true);
			try {
				const report = await backend.getComplexityReport(currentTag);
				setComplexityReport(report);
			} catch (error) {
				// Silently fail - complexity report is optional
				console.debug('No complexity report available:', error.message);
				setComplexityReport(null);
			} finally {
				setLoadingComplexity(false);
			}
		};

		loadComplexityReport();
	}, [currentTag, backend]);

	// Filter tasks based on current filter and search
	const filteredTasks = tasks.filter((task) => {
		// Apply status filter
		if (filterMode === 'status' && filter !== 'all' && task.status !== filter) {
			return false;
		}

		// Apply priority filter
		if (
			filterMode === 'priority' &&
			priorityFilter !== 'all' &&
			task.priority !== priorityFilter
		) {
			return false;
		}

		// Apply search filter
		if (
			searchQuery &&
			!task.title.toLowerCase().includes(searchQuery.toLowerCase())
		) {
			return false;
		}

		return true;
	});

	// Build flat list of visible tasks (including expanded subtasks)
	const visibleTasks = [];
	filteredTasks.forEach((task) => {
		visibleTasks.push({ ...task, level: 0 });
		if (expandedTasks.has(task.id) && task.subtasks) {
			task.subtasks.forEach((subtask) => {
				visibleTasks.push({ ...subtask, level: 1, parentId: task.id });
			});
		}
	});

	// Handle keyboard input
	useInput((input, key) => {
		if (isSearching) {
			// Handle search mode input separately
			return;
		}

		// During streaming operations, keyboard input is handled by StreamingModal
		if (showStreamingModal) {
			return;
		}

		if (showExpandOptions) {
			// SelectInput handles its own input, but we still want ESC to work
			if (key.escape) {
				setShowExpandOptions(false);
			}
			return;
		}

		if (key.escape) {
			if (isExpanding) {
				// During expansion, ESC is disabled - must use Ctrl+X
				return;
			}
			if (viewMode === 'subtask-detail') {
				// Go back to subtasks view from subtask detail
				flushSync(() => {
					setViewMode('subtasks');
					setSelectedSubtask(null);
				});
			} else if (viewMode === 'subtasks') {
				// Go back to detail view from subtasks
				flushSync(() => {
					setViewMode('detail');
					setSelectedSubtaskIndex(0);
					setSubtasksScrollOffset(0);
				});
			} else if (viewMode === 'detail') {
				flushSync(() => {
					setViewMode('list');
					setSelectedTask(null);
					setShowExpandOptions(false);
					setDetailScrollOffset(0);
				});
			} else {
				setCurrentScreen('welcome');
			}
			return;
		}

		// Handle Ctrl+X to cancel expansion
		if (key.ctrl && input === 'x' && isExpanding) {
			setIsExpanding(false);
			setToast({
				message: 'Expansion cancelled',
				type: 'warning'
			});
			return;
		}

		// Subtasks view keyboard handling
		if (viewMode === 'subtasks') {
			if (key.downArrow) {
				const maxIndex = selectedTask.subtasks.length - 1;
				const newIndex = Math.min(selectedSubtaskIndex + 1, maxIndex);
				setSelectedSubtaskIndex(newIndex);

				// Adjust scroll if needed
				if (newIndex >= subtasksScrollOffset + VISIBLE_ROWS) {
					setSubtasksScrollOffset(newIndex - VISIBLE_ROWS + 1);
				}
			} else if (key.upArrow) {
				const newIndex = Math.max(selectedSubtaskIndex - 1, 0);
				setSelectedSubtaskIndex(newIndex);

				// Adjust scroll if needed
				if (newIndex < subtasksScrollOffset) {
					setSubtasksScrollOffset(newIndex);
				}
			} else if (key.return) {
				// Enter key - show subtask details
				const subtask = selectedTask.subtasks[selectedSubtaskIndex];
				setSelectedSubtask(subtask);
				setViewMode('subtask-detail');
				setDetailScrollOffset(0); // Reset scroll for subtask detail view
			} else if (input === 't') {
				// Cycle status of selected subtask
				const subtask = selectedTask.subtasks[selectedSubtaskIndex];
				const subtaskId = `${selectedTask.id}.${subtask.id}`;
				cycleTaskStatus({ ...subtask, id: subtaskId });
			}
			return;
		}

		if (viewMode === 'detail') {
			if (input === 'e' && selectedTask) {
				// Show expand options - always allow expand, modal will handle confirmation
				setShowExpandOptions(true);
			} else if (input === 's' && selectedTask?.subtasks?.length > 0) {
				// Switch to subtasks view if task has subtasks
				setViewMode('subtasks');
				setSelectedSubtaskIndex(0);
				setSubtasksScrollOffset(0);
			} else if (key.downArrow) {
				// Scroll down in detail view
				setDetailScrollOffset((prev) => prev + 1);
			} else if (key.upArrow) {
				// Scroll up in detail view
				setDetailScrollOffset((prev) => Math.max(0, prev - 1));
			} else if (key.pageDown) {
				// Page down in detail view
				setDetailScrollOffset((prev) => prev + 10);
			} else if (key.pageUp) {
				// Page up in detail view
				setDetailScrollOffset((prev) => Math.max(0, prev - 10));
			}
			return;
		}

		// Subtask detail view keyboard handling
		if (viewMode === 'subtask-detail') {
			if (key.downArrow) {
				// Scroll down in subtask detail view
				setDetailScrollOffset((prev) => prev + 1);
			} else if (key.upArrow) {
				// Scroll up in subtask detail view
				setDetailScrollOffset((prev) => Math.max(0, prev - 1));
			} else if (key.pageDown) {
				// Page down in subtask detail view
				setDetailScrollOffset((prev) => prev + 10);
			} else if (key.pageUp) {
				// Page up in subtask detail view
				setDetailScrollOffset((prev) => Math.max(0, prev - 10));
			} else if (input === 'w') {
				// Work on subtask - automatically create/use worktree and launch Claude
				handleWorkOnSubtask();
			} else if (input === 'g') {
				// Go to worktree (if exists)
				const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
				const worktrees = subtaskWorktrees.get(subtaskId) || [];
				if (worktrees.length > 0) {
					// Navigate to worktree detail page for the first linked worktree
					setCurrentScreen('worktrees', {
						selectedWorktree: worktrees[0],
						showDetails: true
					});
				} else {
					setToast({
						message: 'No worktrees linked to this subtask',
						type: 'warning'
					});
				}
			} else if (input === 'c' || input === 'C') {
				// Launch Claude Code session with subtask context
				handleClaudeSession();
			} else if (input === 'v' || input === 'V') {
				// View Claude Code sessions for this subtask
				const sessionIds = extractClaudeSessionIds(selectedSubtask.details);
				if (sessionIds.length > 0) {
					// Navigate to Claude Code screen with filter for this subtask
					setCurrentScreen('claude-code', {
						mode: 'list',
						filterSubtaskId: `${selectedTask.id}.${selectedSubtask.id}`,
						highlightSessionId: sessionIds[0], // Highlight the most recent session
						returnTo: 'tasks',
						returnData: {
							selectedTaskId: selectedTask.id,
							selectedSubtaskId: `${selectedTask.id}.${selectedSubtask.id}`,
							viewMode: 'subtask-detail'
						}
					});
				} else {
					setToast({
						message: 'No Claude Code sessions found for this subtask',
						type: 'warning'
					});
				}
			}
			return;
		}

		// List view keyboard handling
		if (key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, visibleTasks.length - 1);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex >= scrollOffset + VISIBLE_ROWS) {
				setScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex < scrollOffset) {
				setScrollOffset(newIndex);
			}
		} else if (key.pageDown) {
			// Page down
			const newIndex = Math.min(
				selectedIndex + VISIBLE_ROWS,
				visibleTasks.length - 1
			);
			setSelectedIndex(newIndex);
			setScrollOffset(
				Math.min(
					newIndex - VISIBLE_ROWS + 1,
					Math.max(0, visibleTasks.length - VISIBLE_ROWS)
				)
			);
		} else if (key.pageUp) {
			// Page up
			const newIndex = Math.max(selectedIndex - VISIBLE_ROWS, 0);
			setSelectedIndex(newIndex);
			setScrollOffset(Math.max(0, newIndex));
		} else if (key.return) {
			// Enter key - show task details
			const task = visibleTasks[selectedIndex];
			showTaskDetail(task);
		} else if (input === 'f') {
			// Switch filter mode between status and priority
			if (filterMode === 'status') {
				setFilterMode('priority');
				setPriorityFilter('all');
				setFilter('all');
			} else {
				setFilterMode('status');
				setFilter('all');
				setPriorityFilter('all');
			}
		} else if (input === 't') {
			// Cycle status of selected task
			const task = visibleTasks[selectedIndex];
			cycleTaskStatus(task);
		} else if (input === 'r') {
			// Cycle through priority filters
			if (filterMode !== 'priority') {
				// First switch to priority mode
				setFilterMode('priority');
				setFilter('all');
			}

			// Cycle through priority filters: all → high → medium → low → all
			const priorityOrder = ['all', 'high', 'medium', 'low'];
			const currentIndex = priorityOrder.indexOf(priorityFilter);
			const nextIndex = (currentIndex + 1) % priorityOrder.length;
			setPriorityFilter(priorityOrder[nextIndex]);
		} else if (input === '1') {
			if (filterMode === 'status') {
				setFilter('all');
			} else {
				setPriorityFilter('all');
			}
		} else if (input === '2') {
			if (filterMode === 'status') {
				setFilter('pending');
			} else {
				setPriorityFilter('high');
			}
		} else if (input === '3') {
			if (filterMode === 'status') {
				setFilter('in-progress');
			} else {
				setPriorityFilter('medium');
			}
		} else if (input === '4') {
			if (filterMode === 'status') {
				setFilter('done');
			} else {
				setPriorityFilter('low');
			}
		} else if (input === '/') {
			setIsSearching(true);
		}
	});

	const showTaskDetail = async (task) => {
		try {
			// Fetch full task details
			const fullTask = await backend.getTask(task.id);
			setSelectedTask(fullTask);

			// Fetch worktrees linked to this task
			try {
				const worktrees = await backend.getTaskWorktrees(task.id);
				setTaskWorktrees(worktrees || []);
			} catch (error) {
				console.error('Failed to load task worktrees:', error);
				setTaskWorktrees([]);
			}

			setViewMode('detail');
			setDetailScrollOffset(0); // Reset scroll position when opening a new task

			// Fetch subtask worktrees if task has subtasks
			if (fullTask.subtasks && fullTask.subtasks.length > 0) {
				const subtaskWorktreePromises = fullTask.subtasks.map(
					async (subtask) => {
						const subtaskId = `${fullTask.id}.${subtask.id}`;
						try {
							const subtaskWorktrees =
								await backend.getTaskWorktrees(subtaskId);
							return { subtaskId, worktrees: subtaskWorktrees || [] };
						} catch (error) {
							return { subtaskId, worktrees: [] };
						}
					}
				);

				// Wait for all subtask worktree fetches to complete
				const subtaskWorktreeResults = await Promise.all(
					subtaskWorktreePromises
				);
				const subtaskWorktreeMap = new Map(
					subtaskWorktreeResults.map((result) => [
						result.subtaskId,
						result.worktrees
					])
				);
				setSubtaskWorktrees(subtaskWorktreeMap);
			} else {
				setSubtaskWorktrees(new Map());
			}

			// Return the full task so callers can use it
			return fullTask;
		} catch (error) {
			console.error('Failed to load task details:', error);
			throw error;
		}
	};

	const expandTask = async (options) => {
		setShowExpandOptions(false);
		setShowStreamingModal(true);

		try {
			// Use streaming state manager for expansion
			await streamingStateManager.startOperation('expand_task', {
				execute: async (signal, callbacks) => {
					// Simulate thinking messages during expansion
					let thinkingIndex = 0;
					const config =
						streamingStateManager.getOperationConfig('expand_task');

					const thinkingInterval = setInterval(() => {
						if (config.thinkingMessages?.[thinkingIndex]) {
							callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
							thinkingIndex =
								(thinkingIndex + 1) % config.thinkingMessages.length;
						}
					}, 2000);

					try {
						const expandResult = await backend.expandTask(selectedTask.id, {
							research: options.research,
							force: options.force || false,
							num: options.num
						});

						clearInterval(thinkingInterval);
						return expandResult;
					} catch (error) {
						clearInterval(thinkingInterval);
						throw error;
					}
				}
			});

			// Reload tasks and refresh the detail view
			await reloadTasks();
			const updatedTask = await backend.getTask(selectedTask.id);
			setSelectedTask(updatedTask);

			setShowStreamingModal(false);
			setToast({
				message: `Task expanded into ${options.num} subtasks ${options.research ? 'with research' : 'without research'}`,
				type: 'success'
			});
		} catch (error) {
			setShowStreamingModal(false);
			if (error.message !== 'Operation cancelled') {
				setToast({
					message: `Failed to expand task: ${error.message}`,
					type: 'error'
				});
			} else {
				// User cancelled, show cancel message
				setToast({
					message: 'Task expansion cancelled',
					type: 'warning'
				});
			}
		} finally {
			setIsExpanding(false);
		}
	};

	const cycleTaskStatus = async (task) => {
		const statusOrder = [
			'pending',
			'in-progress',
			'review',
			'done',
			'deferred',
			'cancelled'
		];

		const currentIndex = statusOrder.indexOf(task.status || 'pending');
		const nextIndex = (currentIndex + 1) % statusOrder.length;
		const newStatus = statusOrder[nextIndex];

		try {
			await backend.setTaskStatus(task.id, newStatus);
			await reloadTasks();

			// If we're in detail view, refresh the task details
			if (
				viewMode === 'detail' &&
				selectedTask &&
				selectedTask.id === task.id
			) {
				const updatedTask = await backend.getTask(task.id);
				setSelectedTask(updatedTask);
			}

			setToast({
				message: `Task ${task.id} status changed to ${newStatus}`,
				type: 'success'
			});
		} catch (error) {
			setToast({
				message: `Failed to update task status: ${error.message}`,
				type: 'error'
			});
		}
	};

	const handleClaudeSession = async () => {
		if (!selectedTask || !selectedSubtask) return;

		try {
			// Check for existing worktrees for this subtask
			const worktrees = await backend.getTaskWorktrees(
				`${selectedTask.id}.${selectedSubtask.id}`
			);

			let worktreeToUse;

			if (worktrees && worktrees.length > 0) {
				// Use the first linked worktree
				worktreeToUse = worktrees[0];
			} else {
				// No linked worktree, create one automatically
				setToast({
					message: 'Creating worktree for subtask...',
					type: 'info'
				});

				// Get the current branch to use as source
				let sourceBranch = 'main'; // default fallback
				try {
					const { execSync } = await import('child_process');
					sourceBranch = execSync('git rev-parse --abbrev-ref HEAD', {
						cwd: backend.projectRoot,
						encoding: 'utf8'
					}).trim();
				} catch (error) {
					console.error('Failed to get current branch:', error);
					// Try 'master' as a secondary fallback
					sourceBranch = 'master';
				}

				// Get or create worktree
				const result = await backend.getOrCreateWorktreeForSubtask(
					selectedTask.id,
					selectedSubtask.id,
					{
						sourceBranch,
						subtaskTitle: selectedSubtask.title
					}
				);

				// Check if we need user decision for branch conflict
				if (result.needsUserDecision) {
					// Store info for the modal
					setBranchConflictInfo({
						branchName: result.branchName,
						branchInUseAt: result.branchInUseAt,
						taskId: selectedTask.id,
						subtaskId: selectedSubtask.id,
						subtaskTitle: selectedSubtask.title,
						sourceBranch
					});
					setShowBranchConflictModal(true);
					return;
				}

				if (!result.exists && result.created) {
					setToast({
						message: `Created worktree: ${result.worktree.name}`,
						type: 'success'
					});
				}

				worktreeToUse = result.worktree;

				// Update subtask worktrees state
				const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
				const updatedWorktrees = new Map(subtaskWorktrees);
				updatedWorktrees.set(subtaskId, [result.worktree]);
				setSubtaskWorktrees(updatedWorktrees);
			}

			// Set the worktree for Claude launcher
			setClaudeWorktree(worktreeToUse);

			// Show the Claude launcher modal in its new streamlined form
			setShowClaudeLauncherModal(true);
		} catch (error) {
			console.error('Failed to setup Claude session:', error);
			setToast({
				message: `✗ Failed to setup Claude: ${error.message}`,
				type: 'error'
			});
		}
	};

	const handleWorkOnSubtask = async () => {
		if (!selectedTask || !selectedSubtask) return;

		try {
			setIsExpanding(true); // Reuse loading state
			setToast({
				message: 'Setting up worktree for subtask...',
				type: 'info'
			});

			// Get the current branch to use as source
			let sourceBranch = 'main'; // default fallback
			try {
				const { execSync } = await import('child_process');
				sourceBranch = execSync('git rev-parse --abbrev-ref HEAD', {
					cwd: backend.projectRoot,
					encoding: 'utf8'
				}).trim();
			} catch (error) {
				console.error('Failed to get current branch:', error);
				// Try 'master' as a secondary fallback
				sourceBranch = 'master';
			}

			// Get or create worktree for this subtask
			const result = await backend.getOrCreateWorktreeForSubtask(
				selectedTask.id,
				selectedSubtask.id,
				{
					subtaskTitle: selectedSubtask.title,
					sourceBranch
				}
			);

			// Check if we need user decision for branch conflict
			if (result.needsUserDecision) {
				// Store info for the modal
				setBranchConflictInfo({
					branchName: result.branchName,
					branchInUseAt: result.branchInUseAt,
					taskId: selectedTask.id,
					subtaskId: selectedSubtask.id,
					subtaskTitle: selectedSubtask.title,
					sourceBranch,
					isWorkOnSubtask: true // Flag to indicate this is from 'w' key
				});
				setShowBranchConflictModal(true);
				setIsExpanding(false);
				return;
			}

			if (result.created) {
				setToast({
					message: `Created worktree: ${result.worktree.branch}`,
					type: 'success'
				});
			}

			// Update subtask worktrees state
			const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
			const updatedWorktrees = new Map(subtaskWorktrees);
			updatedWorktrees.set(subtaskId, [result.worktree]);
			setSubtaskWorktrees(updatedWorktrees);

			// Launch Claude in the worktree
			setClaudeWorktree(result.worktree);
			setShowClaudeLauncherModal(true);
		} catch (error) {
			console.error('Failed to setup worktree:', error);
			setToast({
				message: `Failed to setup worktree: ${error.message}`,
				type: 'error'
			});
		} finally {
			setIsExpanding(false);
		}
	};

	const handleClaudeLauncherSuccess = async (result) => {
		// Check if we need to exit Flow to launch Claude
		if (result.shouldExitFlow) {
			// Store launch information in navigation data and signal to exit
			setCurrentScreen('exit-for-claude', {
				launchCommand: `cd "${result.worktreePath}" && claude`,
				worktreePath: result.worktreePath,
				persona: result.persona,
				tasks: result.tasks
			});
			return;
		}

		// Handle other launch modes
		if (result.mode === 'interactive') {
			// Interactive mode - the modal has already launched Claude in a terminal
			setToast({
				message: `Claude launched in ${result.worktree} with persona: ${result.persona || 'none'}`,
				type: 'success'
			});
		} else if (result.mode === 'headless') {
			// Headless mode - gather context and navigate to ClaudeCodeScreen
			const worktreePath = claudeWorktree?.path || backend.projectRoot;
			await launchClaudeWithContext(worktreePath);
		} else if (
			result.mode === 'batch' ||
			result.mode === 'batch-multi-persona'
		) {
			// Batch mode - tasks processed
			setToast({
				message: `Batch processing completed for ${result.tasks?.length || 0} tasks`,
				type: 'success'
			});
		}

		// Close modal
		setShowClaudeLauncherModal(false);
		setClaudeWorktree(null);
	};

	const launchClaudeWithContext = async (worktreePath) => {
		try {
			setToast({
				message: 'Gathering context and running research...',
				type: 'info'
			});

			// Gather comprehensive context
			const context = await gatherSubtaskContext();

			// Don't wait for the navigation - do it immediately after context is ready
			setToast({
				message: 'Launching Claude Code with full context...',
				type: 'info'
			});

			console.log(
				'[TaskManagementScreen] Navigating to claude-code screen with context:',
				{
					mode: 'subtask-implementation',
					hasContext: !!context,
					hasResearch: !!context.researchContext,
					worktreePath
				}
			);

			// Navigate to Claude Code screen with context
			setCurrentScreen('claude-code', {
				mode: 'subtask-implementation',
				initialContext: {
					...context,
					worktreePath
				},
				returnTo: 'tasks',
				returnData: {
					selectedTaskId: selectedTask.id,
					selectedSubtaskId: `${selectedTask.id}.${selectedSubtask.id}`
				}
			});

			// Reset flag after successful navigation
			setIsLaunchingClaude(false);
		} catch (error) {
			console.error(
				'[TaskManagementScreen] Error in launchClaudeWithContext:',
				error
			);
			setToast({
				message: `Failed to gather context: ${error.message}`,
				type: 'error'
			});
			setIsLaunchingClaude(false);
		}
	};

	const gatherSubtaskContext = async () => {
		// Get immediate dependencies
		const dependencies = await Promise.all(
			(selectedTask.dependencies || []).map(async (depId) => {
				try {
					const depTask = await backend.getTask(depId);
					return {
						id: depTask.id,
						title: depTask.title,
						description: depTask.description,
						status: depTask.status,
						keyDecisions: extractKeyDecisions(depTask.details)
					};
				} catch (error) {
					console.error(`Failed to load dependency ${depId}:`, error);
					return null;
				}
			})
		);

		// Check if research has already been run
		const hasExistingResearch =
			selectedSubtask.details &&
			selectedSubtask.details.includes('<info added on');

		// Run automatic research only if it hasn't been done before
		const researchQuery = buildResearchQuery();
		let researchContext = null;

		if (!hasExistingResearch) {
			try {
				setToast({
					message: 'Running research for context...',
					type: 'info'
				});

				const researchResult = await backend.research({
					query: researchQuery,
					taskIds: [
						`${selectedTask.id}.${selectedSubtask.id}`,
						selectedTask.id,
						...dependencies.filter((d) => d).map((d) => d.id)
					],
					includeProjectTree: true,
					detailLevel: 'medium'
				});

				researchContext = researchResult.response || researchResult;

				// Save research results to subtask
				if (researchContext) {
					try {
						setToast({
							message: 'Saving research to subtask...',
							type: 'info'
						});

						const researchContent = `## Claude Code Research - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Query:** ${researchQuery}
**Detail Level:** medium
**Context:** Preparing for Claude Code implementation session

### Research Results

${researchContext}

---
`;

						await backend.updateSubtask({
							id: `${selectedTask.id}.${selectedSubtask.id}`,
							prompt: researchContent,
							research: false // Don't run research again, just append
						});

						setToast({
							message: 'Research saved to subtask',
							type: 'success'
						});
					} catch (saveError) {
						console.error('Failed to save research to subtask:', saveError);
						// Continue anyway - research is still in context
					}
				}
			} catch (error) {
				console.error('Research failed:', error);
				// Continue without research
			}
		} else {
			setToast({
				message: 'Using existing research from subtask details',
				type: 'info'
			});

			// Extract existing research from details if possible
			// This helps pass it along to the Claude context
			const detailLines = selectedSubtask.details.split('\n');
			let inResearchSection = false;
			const researchLines = [];

			for (const line of detailLines) {
				if (line.includes('### Research Results')) {
					inResearchSection = true;
					continue;
				}
				if (inResearchSection && line.startsWith('---')) {
					break;
				}
				if (inResearchSection) {
					researchLines.push(line);
				}
			}

			if (researchLines.length > 0) {
				researchContext = researchLines.join('\n').trim();
			}
		}

		return {
			currentSubtask: {
				id: `${selectedTask.id}.${selectedSubtask.id}`,
				title: selectedSubtask.title,
				description: selectedSubtask.description,
				details: selectedSubtask.details,
				status: selectedSubtask.status
			},
			parentTask: {
				id: selectedTask.id,
				title: selectedTask.title,
				description: selectedTask.description,
				subtasks: selectedTask.subtasks
			},
			dependencies: dependencies.filter(Boolean),
			tagContext: currentTag,
			researchContext
		};
	};

	const extractKeyDecisions = (details) => {
		if (!details) return '';

		const patterns = [
			/decided to use/i,
			/implementation approach/i,
			/chosen.*because/i,
			/architecture decision/i,
			/key insight/i,
			/important:/i
		];

		return details
			.split('\n')
			.filter((line) => patterns.some((p) => p.test(line)))
			.slice(0, 5)
			.join('\n');
	};

	const buildResearchQuery = () => {
		const techStack = extractTechStack(
			`${selectedSubtask.description || ''} ${selectedTask.description || ''}`
		);

		return `
Best practices and implementation guidance for: ${selectedSubtask.title}
Context: ${selectedTask.title}
${techStack ? `Technologies: ${techStack}` : ''}
Focus on: current industry standards, common pitfalls, security considerations
		`.trim();
	};

	const extractTechStack = (text) => {
		// Common technology patterns
		const techPatterns = [
			/\b(React|Vue|Angular|Svelte)\b/gi,
			/\b(Node\.?js|Express|Fastify|Koa)\b/gi,
			/\b(TypeScript|JavaScript|Python|Go|Rust)\b/gi,
			/\b(PostgreSQL|MySQL|MongoDB|Redis)\b/gi,
			/\b(AWS|Azure|GCP|Docker|Kubernetes)\b/gi,
			/\b(GraphQL|REST|gRPC|WebSocket)\b/gi
		];

		const matches = new Set();
		techPatterns.forEach((pattern) => {
			const found = text.match(pattern);
			if (found) {
				found.forEach((tech) => matches.add(tech));
			}
		});

		return Array.from(matches).join(', ');
	};

	const extractClaudeSessionIds = (details) => {
		if (!details) return [];

		const sessionIds = [];
		// Look for session IDs in multiple formats
		const patterns = [
			/<claude-session[^>]+sessionId="([^"]+)"[^>]*>/gi,
			/\*\*Session ID:\*\* ([a-f0-9-]+)/gi,
			/Session ID: ([a-f0-9-]+)/gi
		];

		patterns.forEach((pattern) => {
			let match;
			match = pattern.exec(details);
			while (match !== null) {
				if (match[1] && !sessionIds.includes(match[1])) {
					sessionIds.push(match[1]);
				}
				match = pattern.exec(details);
			}
		});

		return sessionIds;
	};

	const getStatusSymbol = (status) => {
		switch (status) {
			case 'done':
				return '✓';
			case 'in-progress':
				return '●';
			case 'pending':
				return '○';
			case 'review':
				return '◉';
			case 'blocked':
				return '⊗';
			case 'deferred':
				return '⊙';
			case 'cancelled':
				return '✗';
			default:
				return '?';
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case 'done':
				return theme.statusDone;
			case 'in-progress':
				return theme.statusInProgress;
			case 'pending':
				return theme.statusPending;
			case 'review':
				return theme.priorityMedium;
			case 'blocked':
				return theme.statusBlocked;
			case 'deferred':
				return theme.statusDeferred;
			case 'cancelled':
				return theme.statusBlocked;
			default:
				return theme.text;
		}
	};

	const getPriorityColor = (priority) => {
		switch (priority) {
			case 'high':
				return theme.priorityHigh;
			case 'medium':
				return theme.priorityMedium;
			case 'low':
				return theme.priorityLow;
			default:
				return theme.text;
		}
	};

	const formatDependencies = (dependencies) => {
		if (!dependencies || dependencies.length === 0) return '-';
		return dependencies.join(', ');
	};

	const handleBranchConflictDecision = async (decision) => {
		setShowBranchConflictModal(false);

		if (!branchConflictInfo) return;

		if (decision === 'cancel') {
			setToast({
				message: 'Worktree creation cancelled',
				type: 'info'
			});
			setBranchConflictInfo(null);
			return;
		}

		try {
			setIsExpanding(true);
			let result;

			if (decision === 'use-existing') {
				// Use the existing branch
				setToast({
					message: 'Using existing branch...',
					type: 'info'
				});

				result = await backend.useExistingBranchForSubtask(
					branchConflictInfo.taskId,
					branchConflictInfo.subtaskId,
					{
						subtaskTitle: branchConflictInfo.subtaskTitle,
						sourceBranch: branchConflictInfo.sourceBranch
					}
				);
			} else if (decision === 'recreate') {
				// Force recreate
				setToast({
					message: 'Removing existing branch and creating fresh...',
					type: 'info'
				});

				result = await backend.forceCreateWorktreeForSubtask(
					branchConflictInfo.taskId,
					branchConflictInfo.subtaskId,
					{
						subtaskTitle: branchConflictInfo.subtaskTitle,
						sourceBranch: branchConflictInfo.sourceBranch
					}
				);
			}

			if (result && result.worktree) {
				// Update subtask worktrees state
				const subtaskId = `${branchConflictInfo.taskId}.${branchConflictInfo.subtaskId}`;
				const updatedWorktrees = new Map(subtaskWorktrees);
				updatedWorktrees.set(subtaskId, [result.worktree]);
				setSubtaskWorktrees(updatedWorktrees);

				// Set the worktree for Claude launcher
				setClaudeWorktree(result.worktree);

				// Show the Claude launcher modal
				setShowClaudeLauncherModal(true);

				if (result.reusedBranch) {
					setToast({
						message: `Using existing branch: ${result.worktree.branch}`,
						type: 'success'
					});
				} else {
					setToast({
						message: `Created fresh worktree: ${result.worktree.branch}`,
						type: 'success'
					});
				}
			}
		} catch (error) {
			console.error('Failed to handle branch conflict:', error);
			setToast({
				message: `Failed: ${error.message}`,
				type: 'error'
			});
		} finally {
			setIsExpanding(false);
			setBranchConflictInfo(null);
		}
	};

	// Render task detail view
	if (viewMode === 'detail' && selectedTask) {
		// Determine default number of subtasks based on complexity report
		let defaultSubtaskNum = 5; // fallback default
		let fromComplexityReport = false;

		// First, try to get from complexity report
		if (complexityReport?.complexityAnalysis) {
			const taskAnalysis = complexityReport.complexityAnalysis.find(
				(analysis) => analysis.taskId === selectedTask.id
			);

			if (taskAnalysis?.recommendedSubtasks) {
				defaultSubtaskNum = taskAnalysis.recommendedSubtasks;
				fromComplexityReport = true;
			} else if (taskAnalysis?.complexityScore) {
				// Estimate based on complexity score if recommendedSubtasks not available
				const complexityScore = parseInt(taskAnalysis.complexityScore, 10);
				if (!Number.isNaN(complexityScore)) {
					// Higher complexity = more subtasks (3-10 range)
					defaultSubtaskNum = Math.min(
						10,
						Math.max(3, Math.round(complexityScore * 0.8))
					);
				}
			}
		} else if (selectedTask.complexity) {
			// Fallback to task's own complexity field if no report
			const complexityScore = parseInt(selectedTask.complexity, 10);
			if (!Number.isNaN(complexityScore)) {
				defaultSubtaskNum = Math.min(
					10,
					Math.max(3, Math.round(complexityScore * 0.8))
				);
			}
		}

		// Calculate total content lines for detail view
		const contentLines = [];

		// Add all the content that will be displayed (excluding ID and Title which are in the header)
		contentLines.push({
			type: 'field',
			label: 'Status:',
			value: `${getStatusSymbol(selectedTask.status)} ${selectedTask.status}`,
			color: getStatusColor(selectedTask.status)
		});
		contentLines.push({
			type: 'field',
			label: 'Priority:',
			value: selectedTask.priority,
			color: getPriorityColor(selectedTask.priority)
		});
		contentLines.push({
			type: 'field',
			label: 'Dependencies:',
			value:
				selectedTask.dependencies && selectedTask.dependencies.length > 0
					? selectedTask.dependencies
							.map((dep) => {
								const depTask = tasks.find((t) => t.id === dep);
								return depTask?.status === 'done' ? `✅ ${dep}` : `⏱️ ${dep}`;
							})
							.join(', ')
					: '-'
		});

		// Add worktree information
		contentLines.push({
			type: 'field',
			label: 'Git Worktrees:',
			value:
				taskWorktrees.length > 0
					? taskWorktrees.map((wt) => `🌳 ${wt.name}`).join(', ')
					: '-',
			color: taskWorktrees.length > 0 ? theme.success : theme.textDim
		});

		if (selectedTask.complexity) {
			contentLines.push({
				type: 'field',
				label: 'Complexity:',
				value: `● ${selectedTask.complexity}`,
				color: theme.priorityMedium
			});
		}

		contentLines.push({
			type: 'field',
			label: 'Description:',
			value: selectedTask.description
		});

		if (selectedTask.details) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: 'Implementation Details:' });
			// Split details into lines for proper scrolling
			const detailLines = selectedTask.details.split('\n');
			detailLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		if (selectedTask.testStrategy) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: 'Test Strategy:' });
			// Split test strategy into lines for proper scrolling
			const testLines = selectedTask.testStrategy.split('\n');
			testLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		if (selectedTask.subtasks && selectedTask.subtasks.length > 0) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({
				type: 'header',
				text: `Subtasks (${selectedTask.subtasks.length}):`
			});

			selectedTask.subtasks.forEach((subtask) => {
				const subtaskId = `${selectedTask.id}.${subtask.id}`;
				const worktrees = subtaskWorktrees.get(subtaskId) || [];
				const worktreeText =
					worktrees.length > 0
						? ` 🌳 ${worktrees.map((wt) => wt.name).join(', ')}`
						: '';

				contentLines.push({
					type: 'subtask',
					text: `${getStatusSymbol(subtask.status)} ${subtask.id}: ${subtask.title}${worktreeText}`,
					color: getStatusColor(subtask.status)
				});
			});
		} else {
			contentLines.push({ type: 'spacer' });
			contentLines.push({
				type: 'info',
				text: "No subtasks yet. Press 'e' to break down this task."
			});
		}

		// Calculate visible content based on scroll offset
		const visibleContent = contentLines.slice(
			detailScrollOffset,
			detailScrollOffset + DETAIL_VISIBLE_ROWS
		);

		return (
			<Box key="detail-view" flexDirection="column">
				{/* Header - Always visible at top */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Text color={theme.accent} bold>
						Task #{selectedTask.id} - {selectedTask.title}
					</Text>
				</Box>

				{/* Expand Options Dialog - Rendered at fixed position */}
				{showExpandOptions && (
					<Box marginBottom={1} marginLeft={2}>
						<ExpandModal
							onSelect={(options) => {
								setShowExpandOptions(false);
								expandTask(options);
							}}
							onClose={() => setShowExpandOptions(false)}
							defaultNum={defaultSubtaskNum}
							fromComplexityReport={fromComplexityReport}
							hasExistingSubtasks={
								selectedTask.subtasks && selectedTask.subtasks.length > 0
							}
						/>
					</Box>
				)}

				{/* Loading indicator */}
				{isExpanding && (
					<Box
						flexDirection="column"
						justifyContent="center"
						alignItems="center"
						width="100%"
						height={20}
						marginTop={2}
					>
						<Box
							borderStyle="round"
							borderColor={theme.accent}
							padding={2}
							backgroundColor={theme.background || '#000000'}
						>
							<LoadingSpinner message="Expanding task..." type="expand" />
						</Box>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
						</Text>
					</Box>
				)}

				{/* Task Details with scrolling - only show when not expanding */}
				{!isExpanding && !showExpandOptions && (
					<Box
						flexDirection="column"
						paddingLeft={2}
						paddingRight={2}
						height={DETAIL_VISIBLE_ROWS + 2}
						overflow="hidden"
					>
											{visibleContent.map((line, index) => {
						const uniqueKey = `${line.type}-${line.label || line.text || index}`;
						if (line.type === 'field') {
							return (
								<Box key={uniqueKey} flexDirection="row" marginBottom={1}>
									<Box key={`${uniqueKey}-label`} width={20}>
										<Text color={theme.textDim}>{line.label}</Text>
									</Box>
									<Box key={`${uniqueKey}-value`} flexGrow={1}>
										<Text color={line.color || theme.text}>{line.value}</Text>
									</Box>
								</Box>
							);
							} else if (line.type === 'header') {
								return (
									<Box key={uniqueKey} flexDirection="column" marginTop={1}>
										<Text color={theme.accent} bold>
											{line.text}
										</Text>
									</Box>
								);
							} else if (line.type === 'text') {
								return (
									<Box key={uniqueKey} marginTop={0.5} paddingLeft={2}>
										<Text color={theme.text}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'subtask') {
								return (
									<Box key={uniqueKey} marginTop={1} paddingLeft={2}>
										<Text color={line.color}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'warning') {
								return (
									<Box
										key={uniqueKey}
										borderStyle="round"
										borderColor={theme.warning}
										padding={1}
									>
										<Text color={theme.warning}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'info') {
								return (
									<Box key={index} paddingLeft={1}>
										<Text color={theme.textDim}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'hint') {
								return (
									<Box key={index} paddingLeft={1}>
										<Text color={theme.textDim}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'spacer') {
								return <Box key={index} height={1} />;
							}
							return null;
						})}

						{/* Scroll indicator */}
						{contentLines.length > DETAIL_VISIBLE_ROWS && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									Lines {detailScrollOffset + 1}-
									{Math.min(
										detailScrollOffset + DETAIL_VISIBLE_ROWS,
										contentLines.length
									)}{' '}
									of {contentLines.length} • ↑↓ scroll
								</Text>
							</Box>
						)}
					</Box>
				)}

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>
						{isExpanding ? (
							'Ctrl+X cancel'
						) : (
							<>
								{contentLines.length > DETAIL_VISIBLE_ROWS
									? '↑↓ scroll • '
									: ''}
								e expand •
								{selectedTask?.subtasks?.length > 0 ? 's subtasks • ' : ''}
								ESC back
							</>
						)}
					</Text>
				</Box>

				{toast && (
					<Toast
						message={toast.message}
						type={toast.type}
						onDismiss={() => setToast(null)}
					/>
				)}

				{showBranchConflictModal && branchConflictInfo && (
					<WorktreeBranchConflictModal
						branchName={branchConflictInfo.branchName}
						branchInUseAt={branchConflictInfo.branchInUseAt}
						onDecision={handleBranchConflictDecision}
						onClose={() => {
							setShowBranchConflictModal(false);
							setBranchConflictInfo(null);
						}}
					/>
				)}
			</Box>
		);
	}

	// Render subtasks view
	if (
		viewMode === 'subtasks' &&
		selectedTask &&
		selectedTask.subtasks?.length > 0
	) {
		const visibleSubtasks = selectedTask.subtasks.slice(
			subtasksScrollOffset,
			subtasksScrollOffset + VISIBLE_ROWS
		);

		return (
			<Box key="subtasks-view" flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Task #{selectedTask.id}</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Subtasks</Text>
					</Box>
					<Text color={theme.textDim}>[ESC back to details]</Text>
				</Box>

				{/* Subtasks List */}
				<Box
					flexGrow={1}
					flexDirection="column"
					paddingLeft={1}
					paddingRight={1}
				>
					<SimpleTable
						data={visibleSubtasks.map((subtask, displayIndex) => {
							const actualIndex = displayIndex + subtasksScrollOffset;
							const isSelected = actualIndex === selectedSubtaskIndex;
							const subtaskId = `${selectedTask.id}.${subtask.id}`;
							const worktrees = subtaskWorktrees.get(subtaskId) || [];

							return {
								' ': isSelected ? '→' : ' ',
								ID: subtaskId,
								Title:
									subtask.title.length > 60
										? subtask.title.substring(0, 57) + '...'
										: subtask.title,
								Status: `${getStatusSymbol(subtask.status)} ${subtask.status}`,
								Worktrees:
									worktrees.length > 0
										? `🌳 ${worktrees.map((wt) => wt.name).join(', ')}`
										: '-',
								_renderCell: (col, value) => {
									let color = isSelected ? theme.selectionText : theme.text;

									if (col === 'Status') {
										color = getStatusColor(subtask.status);
									} else if (col === 'Worktrees') {
										color = isSelected
											? theme.selectionText
											: worktrees.length > 0
												? theme.success
												: theme.textDim;
									}

									return (
										<Text color={color} bold={isSelected}>
											{value}
										</Text>
									);
								}
							};
						})}
						columns={[' ', 'ID', 'Title', 'Status', 'Worktrees']}
						selectedIndex={selectedSubtaskIndex - subtasksScrollOffset}
						borders={true}
					/>

					{/* Scroll indicator */}
					{selectedTask.subtasks.length > VISIBLE_ROWS && (
						<Box marginTop={1}>
							<Text color={theme.textDim}>
								{subtasksScrollOffset + 1}-
								{Math.min(
									subtasksScrollOffset + VISIBLE_ROWS,
									selectedTask.subtasks.length
								)}{' '}
								of {selectedTask.subtasks.length} subtasks
							</Text>
						</Box>
					)}
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>
						↑↓ navigate • ENTER view details • t cycle status • ESC back
					</Text>
				</Box>

				{toast && (
					<Toast
						message={toast.message}
						type={toast.type}
						onDismiss={() => setToast(null)}
					/>
				)}
			</Box>
		);
	}

	// Render subtask detail view
	if (viewMode === 'subtask-detail' && selectedTask && selectedSubtask) {
		// Calculate content lines for subtask detail view
		const contentLines = [];

		// Add all the content that will be displayed
		contentLines.push({
			type: 'field',
			label: 'Status:',
			value: `${getStatusSymbol(selectedSubtask.status)} ${selectedSubtask.status}`,
			color: getStatusColor(selectedSubtask.status)
		});

		contentLines.push({
			type: 'field',
			label: 'Title:',
			value: selectedSubtask.title
		});

		if (selectedSubtask.description) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: 'Description:' });
			contentLines.push({
				type: 'text',
				text: selectedSubtask.description
			});
		}

		if (selectedSubtask.details) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({
				type: 'header',
				text: 'Implementation Details:'
			});
			// Split details into lines
			const detailLines = selectedSubtask.details.split('\n');
			detailLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		// Handle dependencies
		if (
			selectedSubtask.dependencies &&
			selectedSubtask.dependencies.length > 0
		) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({
				type: 'field',
				label: 'Dependencies:',
				value: selectedSubtask.dependencies
					.map((dep) => {
						// For subtask dependencies, they could be other subtasks or main tasks
						// Try to find the task/subtask and check its status
						let depStatus = '⏱️'; // pending by default

						// Check if it's a subtask dependency (format: parentId.subtaskId)
						if (typeof dep === 'string' && dep.includes('.')) {
							const [parentId, subId] = dep.split('.');
							if (parseInt(parentId) === selectedTask.id) {
								// It's a sibling subtask
								const siblingSubtask = selectedTask.subtasks.find(
									(st) => st.id === parseInt(subId)
								);
								if (siblingSubtask?.status === 'done') {
									depStatus = '✅';
								}
							}
						} else {
							// It's a main task dependency
							const depTask = tasks.find((t) => t.id === dep);
							if (depTask?.status === 'done') {
								depStatus = '✅';
							}
						}

						return `${depStatus} ${dep}`;
					})
					.join(', ')
			});
		}

		// Check for worktrees
		const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
		const worktrees = subtaskWorktrees.get(subtaskId) || [];

		if (selectedSubtask.testStrategy) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({
				type: 'header',
				text: 'Test Strategy:'
			});
			// Split test strategy into lines
			const testLines = selectedSubtask.testStrategy.split('\n');
			testLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'field',
			label: 'Git Worktrees:',
			value:
				worktrees.length > 0
					? worktrees.map((wt) => `🌳 ${wt.name}`).join(', ')
					: '-',
			color: worktrees.length > 0 ? theme.success : theme.textDim
		});

		// Calculate visible content based on scroll offset
		const visibleContent = contentLines.slice(
			detailScrollOffset,
			detailScrollOffset + DETAIL_VISIBLE_ROWS
		);

		// If modal is open, render only the modal
		if (showClaudeLauncherModal && claudeWorktree && modalTaskData) {
			return (
				<ClaudeWorktreeLauncherModal
					backend={backend}
					worktree={claudeWorktree}
					tasks={modalTaskData}
					onClose={() => {
						setShowClaudeLauncherModal(false);
						setClaudeWorktree(null);
					}}
					onSuccess={handleClaudeLauncherSuccess}
				/>
			);
		}

		return (
			<Box key="subtask-detail-view" flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color="white">Task #{selectedTask.id}</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Subtask #{selectedSubtask.id}</Text>
					</Box>
					<Text color={theme.textDim}>[ESC back to subtasks]</Text>
				</Box>

				{/* Subtask Details with scrolling */}
				<Box
					flexGrow={1}
					flexDirection="column"
					paddingLeft={2}
					paddingRight={2}
					height={DETAIL_VISIBLE_ROWS + 2}
					overflow="hidden"
				>
					{visibleContent.map((line, index) => {
						if (line.type === 'field') {
							return (
								<Box key={index} flexDirection="row" marginBottom={1}>
									<Box width={20}>
										<Text color={theme.textDim}>{line.label}</Text>
									</Box>
									<Box flexGrow={1}>
										<Text color={line.color || theme.text}>{line.value}</Text>
									</Box>
								</Box>
							);
						} else if (line.type === 'header') {
							return (
								<Box key={index} flexDirection="column" marginTop={1}>
									<Text color={theme.accent} bold>
										{line.text}
									</Text>
								</Box>
							);
						} else if (line.type === 'text') {
							return (
								<Box key={index} marginTop={0.5} paddingLeft={2}>
									<Text color={theme.text}>{line.text}</Text>
								</Box>
							);
						} else if (line.type === 'spacer') {
							return <Box key={index} height={1} />;
						}
						return null;
					})}

					{/* Scroll indicator */}
					{contentLines.length > DETAIL_VISIBLE_ROWS && (
						<Box marginTop={1}>
							<Text color={theme.textDim}>
								Lines {detailScrollOffset + 1}-
								{Math.min(
									detailScrollOffset + DETAIL_VISIBLE_ROWS,
									contentLines.length
								)}{' '}
								of {contentLines.length} • ↑↓ scroll
							</Text>
						</Box>
					)}
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<Text color={theme.text}>
						{contentLines.length > DETAIL_VISIBLE_ROWS ? '↑↓ scroll • ' : ''}w
						work on subtask •{' '}
						{worktrees.length > 0 ? 'g go to worktree • ' : ''}c claude • ESC
						back
					</Text>
				</Box>

				{toast && (
					<Toast
						message={toast.message}
						type={toast.type}
						onDismiss={() => setToast(null)}
					/>
				)}
			</Box>
		);
	}

	// Render task list view
	// If modal is open, render only the modal
	if (showClaudeLauncherModal && claudeWorktree && modalTaskData) {
		return (
			<ClaudeWorktreeLauncherModal
				backend={backend}
				worktree={claudeWorktree}
				tasks={modalTaskData}
				onClose={() => {
					setShowClaudeLauncherModal(false);
					setClaudeWorktree(null);
				}}
				onSuccess={handleClaudeLauncherSuccess}
			/>
		);
	}

	return (
		<Box key="list-view" flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color="white">Tasks</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>[Current Tag: {currentTag}]</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Task List */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				<SimpleTable
					data={visibleTasks
						.slice(scrollOffset, scrollOffset + VISIBLE_ROWS)
						.map((task, displayIndex) => {
							const actualIndex = displayIndex + scrollOffset;
							const isSelected = actualIndex === selectedIndex;
							const subtaskCount =
								task.level === 0 && task.subtasks ? task.subtasks.length : 0;

							return {
								' ': isSelected ? '→' : ' ',
								ID: task.id,
								Title:
									task.title.length > 33
										? task.title.substring(0, 30) + '...'
										: task.title,
								Subtasks:
									task.level === 0
										? subtaskCount > 0
											? `[${subtaskCount}]`
											: '-'
										: '',
								Complex: task.complexity ? `● ${task.complexity}` : '-',
								Status: `${getStatusSymbol(task.status)} ${task.status}`,
								Priority: task.priority,
								Deps: formatDependencies(task.dependencies),
								_renderCell: (col, value) => {
									let color = isSelected ? theme.selectionText : theme.text;

									if (col === 'Status') {
										color = getStatusColor(task.status);
									} else if (col === 'Priority') {
										color = getPriorityColor(task.priority);
									} else if (
										col === 'Complex' ||
										col === 'Deps' ||
										col === 'Subtasks'
									) {
										color = isSelected ? theme.selectionText : theme.textDim;
									}

									// Add indentation for subtasks
									if (col === 'ID' && task.level > 0) {
										return (
											<Text color={color} bold={isSelected}>
												{'  ' + value}
											</Text>
										);
									}

									return (
										<Text color={color} bold={isSelected}>
											{value}
										</Text>
									);
								}
							};
						})}
					columns={[
						' ',
						'ID',
						'Title',
						'Subtasks',
						'Complex',
						'Status',
						'Priority',
						'Deps'
					]}
					selectedIndex={selectedIndex - scrollOffset}
					borders={true}
				/>

				{/* Scroll indicator */}
				{visibleTasks.length > VISIBLE_ROWS && (
					<Box marginTop={1}>
						<Text color={theme.textDim}>
							{scrollOffset + 1}-
							{Math.min(scrollOffset + VISIBLE_ROWS, visibleTasks.length)} of{' '}
							{visibleTasks.length} tasks
						</Text>
					</Box>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Box flexDirection="column">
					{/* Controls */}
					<Box marginBottom={1}>
						<Text color={theme.text}>
							↑↓ navigate • Enter view details • t cycle status • r cycle
							priority
						</Text>
					</Box>

					{/* Filter mode indicator and options */}
					<Box>
						<Text color={theme.text}>Filter: </Text>
						<Text
							color={filterMode === 'status' ? theme.accent : theme.textDim}
						>
							f Filter
						</Text>
						<Text color={theme.textDim}> • </Text>

						{filterMode === 'status' ? (
							<>
								<Text color={filter === 'all' ? theme.accent : theme.textDim}>
									1 All
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text
									color={filter === 'pending' ? theme.accent : theme.textDim}
								>
									2 Pending
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text
									color={
										filter === 'in-progress' ? theme.accent : theme.textDim
									}
								>
									3 Progress
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text color={filter === 'done' ? theme.accent : theme.textDim}>
									4 Done
								</Text>
							</>
						) : (
							<>
								<Text
									color={
										priorityFilter === 'all' ? theme.accent : theme.textDim
									}
								>
									1 All
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text
									color={
										priorityFilter === 'high' ? theme.accent : theme.textDim
									}
								>
									2 High
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text
									color={
										priorityFilter === 'medium' ? theme.accent : theme.textDim
									}
								>
									3 Medium
								</Text>
								<Text color={theme.textDim}> </Text>
								<Text
									color={
										priorityFilter === 'low' ? theme.accent : theme.textDim
									}
								>
									4 Low
								</Text>
							</>
						)}
					</Box>
				</Box>
			</Box>

			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onDismiss={() => setToast(null)}
				/>
			)}

			{showBranchConflictModal && branchConflictInfo && (
				<WorktreeBranchConflictModal
					branchName={branchConflictInfo.branchName}
					branchInUseAt={branchConflictInfo.branchInUseAt}
					onDecision={handleBranchConflictDecision}
					onClose={() => {
						setShowBranchConflictModal(false);
						setBranchConflictInfo(null);
					}}
				/>
			)}

			{/* Streaming Modal */}
			<StreamingModal
				isOpen={showStreamingModal}
				onClose={() => setShowStreamingModal(false)}
			/>
		</Box>
	);
}
