import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { flushSync } from 'react-dom';
import { useAppContext } from '../index.jsx';
import { getTheme } from '../theme.js';
import { Toast } from './Toast.jsx';
import { ExpandModal } from './ExpandModal.jsx';
import { OverflowIndicator } from './OverflowIndicator.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { SimpleTable } from './SimpleTable.jsx';
import { EnhancedClaudeWorktreeLauncherModal } from './EnhancedClaudeWorktreeLauncherModal.jsx';
import { ProgressLoggingModal } from './ProgressLoggingModal.jsx';
import { WorkflowDecisionModal } from './WorkflowDecisionModal.jsx';
import { WorkflowStatusIndicator, GitStatusIndicator } from './WorkflowStatusIndicator.jsx';
import { WorkflowGuide } from './WorkflowGuide.jsx';
import { CommitAssistant } from './CommitAssistant.jsx';
import TextInput from 'ink-text-input';
import { WorktreeBranchConflictModal } from './WorktreeBranchConflictModal.jsx';
import { StreamingModal } from './StreamingModal.jsx';
import { streamingStateManager } from '../streaming/StreamingStateManager.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { ResearchInputModal } from './ResearchInputModal.jsx';
import { HookIntegrationService } from '../services/HookIntegrationService.js';

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
	const [showProgressModal, setShowProgressModal] = useState(false);
	const [progressModalData, setProgressModalData] = useState(null);
	const [showWorkflowModal, setShowWorkflowModal] = useState(false);
	const [workflowModalData, setWorkflowModalData] = useState(null);
	const [showCommitAssistant, setShowCommitAssistant] = useState(false);
	const [commitAssistantData, setCommitAssistantData] = useState(null);
	const [gitStatus, setGitStatus] = useState(null);
	const [repoInfo, setRepoInfo] = useState(null);
	const [showResearchModal, setShowResearchModal] = useState(false);
	const [modalTaskData, setModalTaskData] = useState(null);

	// Hook integration service
	const [hookService] = useState(() => new HookIntegrationService(backend));

	// Constants for display
	const VISIBLE_ROWS = 15; // Reduced for better visibility
	const DETAIL_VISIBLE_ROWS = 20; // Visible rows in detail view

	// Initialize hook service
	useEffect(() => {
		console.log('[TaskManagementScreen] Initializing hook service...');
		try {
			hookService.initialize();
			console.log('[TaskManagementScreen] Hook service initialized successfully');
		} catch (error) {
			console.error('[TaskManagementScreen] Hook service initialization failed:', error);
			setToast({
				message: `Hook service initialization failed: ${error.message}`,
				type: 'error'
			});
		}
	}, [hookService]);

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

	// Unified keypress handler
	useInput((input, key) => {
		// If any modal is open, let it handle the input, except for global ESC
		if (key.escape) {
			if (showResearchModal) return setShowResearchModal(false);
			if (showExpandOptions) return setShowExpandOptions(false);
			// Other modal escape logic can go here...

			if (viewMode === 'detail' || viewMode === 'subtasks') setViewMode('list');
			else if (viewMode === 'subtask-detail') setViewMode('subtasks');
			else if (isSearching) {
				setIsSearching(false);
				setSearchQuery('');
			}
			return;
		}

		// Don't process other keys if a modal is active
		if (showResearchModal || showExpandOptions || isSearching) {
			return;
		}

		switch (viewMode) {
			case 'list':
				if (key.downArrow) handleDownArrow();
				else if (key.upArrow) handleUpArrow();
				else if (key.return && filteredTasks.length > 0) {
					const task = filteredTasks[selectedIndex];
					setSelectedTask(task);
					setViewMode('detail');
					setDetailScrollOffset(0);
				} else if (input === 'f') cycleFilter();
				else if (input === 'p') cyclePriorityFilter();
				else if (input === 't' && filteredTasks.length > 0) {
					cycleTaskStatus(filteredTasks[selectedIndex]);
				} else if (input === '/') setIsSearching(true);
				break;

			case 'detail':
				if (key.upArrow) setDetailScrollOffset((p) => Math.max(0, p - 1));
				else if (key.downArrow) setDetailScrollOffset((p) => p + 1);
				else if (input === 'e') setShowExpandOptions(true);
				else if (input === 's' && selectedTask?.subtasks?.length > 0)
					setViewMode('subtasks');
				else if (input === 'r') setShowResearchModal(true);
				break;

			case 'subtasks':
				if (key.downArrow) {
					const max = selectedTask.subtasks.length - 1;
					const newIndex = Math.min(selectedSubtaskIndex + 1, max);
					setSelectedSubtaskIndex(newIndex);
					if (newIndex >= subtasksScrollOffset + VISIBLE_ROWS) {
						setSubtasksScrollOffset(newIndex - VISIBLE_ROWS + 1);
					}
				} else if (key.upArrow) {
					const newIndex = Math.max(selectedSubtaskIndex - 1, 0);
					setSelectedSubtaskIndex(newIndex);
					if (newIndex < subtasksScrollOffset) {
						setSubtasksScrollOffset(newIndex);
					}
				} else if (key.return) {
					setSelectedSubtask(selectedTask.subtasks[selectedSubtaskIndex]);
					setViewMode('subtask-detail');
					setDetailScrollOffset(0);
				} else if (input === 't') {
					const subtask = selectedTask.subtasks[selectedSubtaskIndex];
					cycleTaskStatus({ ...subtask, id: `${selectedTask.id}.${subtask.id}` });
				}
				break;

			case 'subtask-detail':
				console.log('[TaskManagementScreen] subtask-detail keypress:', input, key);
				if (key.upArrow) setDetailScrollOffset((p) => Math.max(0, p - 1));
				else if (key.downArrow) setDetailScrollOffset((p) => p + 1);
				else if (input === 't') {
					cycleTaskStatus({
						...selectedSubtask,
						id: `${selectedTask.id}.${selectedSubtask.id}`
					});
				} else if (input === 'c') {
					console.log('[TaskManagementScreen] c key pressed, calling handleClaudeSession');
					handleClaudeSession();
				}
				else if (input === 'r') setShowResearchModal(true);
				break;
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
		console.log('[TaskManagementScreen] handleClaudeSession called');
		console.log('[TaskManagementScreen] selectedTask:', selectedTask?.id);
		console.log('[TaskManagementScreen] selectedSubtask:', selectedSubtask?.id);
		
		if (!selectedTask || !selectedSubtask) {
			console.error('[TaskManagementScreen] Missing selectedTask or selectedSubtask');
			return;
		}

		try {
			console.log('[TaskManagementScreen] Checking for existing worktrees...');
			// Check for existing worktrees for this subtask (but don't create)
			const worktrees = await backend.getTaskWorktrees(
				`${selectedTask.id}.${selectedSubtask.id}`
			);
			console.log('[TaskManagementScreen] Found worktrees:', worktrees);

			let worktreeToUse = null;

			if (worktrees && worktrees.length > 0) {
				// Use the first linked worktree if it exists
				worktreeToUse = worktrees[0];
				console.log('[TaskManagementScreen] Using existing worktree:', worktreeToUse);
			}

			// Fetch full parent task details to ensure we have complete information
			let fullParentTask = selectedTask;
			let subtaskWithFullDetails = selectedSubtask; // Start with current subtask

			try {
				fullParentTask = await backend.getTask(selectedTask.id);
				if (fullParentTask && fullParentTask.subtasks) {
					const foundSubtask = fullParentTask.subtasks.find(st => st.id === selectedSubtask.id);
					if (foundSubtask) {
						subtaskWithFullDetails = foundSubtask; // Use the one with full details
					}
				}
			} catch (error) {
				console.warn('Could not fetch full parent task details for modal:', error);
				// Continue with the task data we have
			}


			// Prepare task data for the Claude launcher modal
			const taskData = [
				{
					id: `${selectedTask.id}.${selectedSubtask.id}`,
					title: subtaskWithFullDetails.title,
					description: subtaskWithFullDetails.description,
					details: subtaskWithFullDetails.details,
					status: subtaskWithFullDetails.status,
					isSubtask: true,
					parentTask: {
						id: fullParentTask.id,
						title: fullParentTask.title,
						description: fullParentTask.description,
						details: fullParentTask.details,
						testStrategy: fullParentTask.testStrategy || fullParentTask.test_strategy
					}
				}
			];

			// Set modal data and worktree
			setModalTaskData(taskData);
			setClaudeWorktree(worktreeToUse);
			setShowClaudeLauncherModal(true);
		} catch (error) {
			console.error('[TaskManagementScreen] Error launching Claude session:', error);
			setToast({
				message: `Error: ${error.message}`,
				type: 'error'
			});
		}
	};

	const handleWorkOnSubtask = async () => {
		if (!selectedTask || !selectedSubtask) return;

		try {
			// Fetch full parent task details to ensure we have complete information
			let fullParentTask = selectedTask;
			try {
				fullParentTask = await backend.getTask(selectedTask.id);
			} catch (error) {
				console.warn('Could not fetch full parent task details:', error);
				// Continue with the task we have
			}

			// Prepare task data for the Claude launcher modal
			const taskData = [
				{
					id: `${selectedTask.id}.${selectedSubtask.id}`,
					title: selectedSubtask.title,
					description: selectedSubtask.description,
					details: selectedSubtask.details,
					status: selectedSubtask.status,
					isSubtask: true,
					parentTask: {
						id: fullParentTask.id,
						title: fullParentTask.title,
						description: fullParentTask.description,
						details: fullParentTask.details,
						testStrategy: fullParentTask.testStrategy || fullParentTask.test_strategy
					}
				}
			];

			// Set modal data and show the launcher modal
			// No worktree is passed - the modal will create it when Claude is launched
			setModalTaskData(taskData);
			setClaudeWorktree(null); // Explicitly set to null
			setShowClaudeLauncherModal(true);
		} catch (error) {
			console.error('Failed to setup Claude session:', error);
			setToast({
				message: `Failed to setup Claude session: ${error.message}`,
				type: 'error'
			});
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

		// If a worktree was created during the modal operation, update our state
		if (result.worktree && selectedTask && selectedSubtask) {
			const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
			const updatedWorktrees = new Map(subtaskWorktrees);
			updatedWorktrees.set(subtaskId, [result.worktree]);
			setSubtaskWorktrees(updatedWorktrees);

			setToast({
				message: `Claude session started in worktree: ${result.worktree.name}`,
				type: 'success'
			});
		}

		// Handle other launch modes
		if (result.mode === 'interactive') {
			// Interactive mode - the modal has already launched Claude in a terminal
			setToast({
				message: `Claude launched in ${result.worktree?.name || 'worktree'} with persona: ${result.persona || 'none'}`,
				type: 'success'
			});
		} else if (result.mode === 'headless') {
			// Headless mode - gather context and navigate to ClaudeCodeScreen
			const worktreePath = result.worktree?.path || backend.projectRoot;
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
		} else {
			// Background mode (most common case now)
			setToast({
				message: `Claude session started in background. Monitor progress in Background Operations.`,
				type: 'success'
			});
		}

		// Close modal and clear state
		setShowClaudeLauncherModal(false);
		setClaudeWorktree(null);
		setModalTaskData(null);
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

		// Fetch full subtask details to check for existing research
		// (details field is stripped from list operations for performance)
		let subtaskWithDetails = selectedSubtask;
		try {
			const fullTask = await backend.getTask(selectedTask.id);
			if (fullTask && fullTask.subtasks) {
				const fullSubtask = fullTask.subtasks.find(
					st => st.id === selectedSubtask.id
				);
				if (fullSubtask) {
					subtaskWithDetails = fullSubtask;
				}
			}
		} catch (error) {
			console.warn('Could not fetch full subtask details:', error);
			// Continue with the subtask we have
		}

		// Check if research has already been run using the hook service
		let hasExistingResearch = false;
		try {
			const researchCheck = await hookService.checkResearchNeeded(subtaskWithDetails);
			if (researchCheck && researchCheck.researchStatus) {
				hasExistingResearch = !researchCheck.researchStatus.needed;
				console.log(`[TaskManagementScreen] Research analysis result:`, {
					needed: researchCheck.researchStatus.needed,
					hasExisting: !researchCheck.researchStatus.needed,
					reason: researchCheck.researchStatus.reason
				});
			}
		} catch (error) {
			console.warn('Failed to check research status via hooks, falling back to simple check:', error);
			setToast({
				message: `Hook service error (using fallback): ${error.message}`,
				type: 'warning'
			});
			// Fallback to simple check - check both subtask and parent task
			hasExistingResearch = false;
			
			// Check subtask details using the same pattern as the hook utility
			if (subtaskWithDetails.details) {
				const oldPattern = /<info added on ([^>]+)>\s*(.*?)\s*(?:<\/info added on [^>]+>|$)/gs;
				const matches = [...subtaskWithDetails.details.matchAll(oldPattern)];
				if (matches.length > 0) {
					hasExistingResearch = true;
					console.log('[TaskManagementScreen] Found research in subtask via fallback');
				}
			}
			
			// If not found in subtask, check parent task
			if (!hasExistingResearch && selectedTask.details) {
				const oldPattern = /<info added on ([^>]+)>\s*(.*?)\s*(?:<\/info added on [^>]+>|$)/gs;
				const matches = [...selectedTask.details.matchAll(oldPattern)];
				if (matches.length > 0) {
					hasExistingResearch = true;
					console.log('[TaskManagementScreen] Found research in parent task via fallback');
				}
			}
		}

		// Run automatic research only if it hasn't been done before
		const researchQuery = buildResearchQuery();
		let researchContext = null;

		if (!hasExistingResearch) {
			try {
				setToast({
					message: 'Running research for context...',
					type: 'info'
				});

				// Use the backend's research function with saveTo to automatically save in proper format
				const researchResult = await backend.research({
					query: researchQuery,
					taskIds: [
						`${selectedTask.id}.${selectedSubtask.id}`,
						selectedTask.id,
						...dependencies.filter((d) => d).map((d) => d.id)
					],
					includeProjectTree: true,
					detailLevel: 'medium',
					saveTo: `${selectedTask.id}.${selectedSubtask.id}` // This will save with proper timestamp format
				});

				researchContext = researchResult.response || researchResult;

				setToast({
					message: 'Research completed and saved to subtask',
					type: 'success'
				});
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
			const detailLines = subtaskWithDetails.details.split('\n');
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
				details: subtaskWithDetails.details,  // Use the full details we fetched
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

	// Progress logging handlers
	const handleLogProgress = () => {
		if (!selectedSubtask) return;
		
		setProgressModalData({
			subtask: {
				...selectedSubtask,
				id: `${selectedTask.id}.${selectedSubtask.id}`,
				title: selectedSubtask.title
			},
			phase: 'implementation'
		});
		setShowProgressModal(true);
	};

	const handleLogExploration = () => {
		if (!selectedSubtask) return;
		
		setProgressModalData({
			subtask: {
				...selectedSubtask,
				id: `${selectedTask.id}.${selectedSubtask.id}`,
				title: selectedSubtask.title
			},
			phase: 'exploration'
		});
		setShowProgressModal(true);
	};

	const handleLogCompletion = () => {
		if (!selectedSubtask) return;
		
		setProgressModalData({
			subtask: {
				...selectedSubtask,
				id: `${selectedTask.id}.${selectedSubtask.id}`,
				title: selectedSubtask.title
			},
			phase: 'completion'
		});
		setShowProgressModal(true);
	};

	const handleProgressSave = async (progressUpdate) => {
		try {
			const subtaskId = progressModalData.subtask.id;
			const result = await backend.updateSubtask(subtaskId, {
				prompt: progressUpdate,
				research: false
			});

			if (result.success) {
				setToast({
					message: 'Progress logged successfully',
					type: 'success'
				});

				// Refresh task data to show updated progress
				await reloadTasks();
				
				// Refresh the selected task details
				if (selectedTask) {
					const updatedTask = await backend.getTask(selectedTask.id);
					setSelectedTask(updatedTask);
					
					// Update the selected subtask
					const updatedSubtask = updatedTask.subtasks?.find(
						s => `${updatedTask.id}.${s.id}` === subtaskId
					);
					if (updatedSubtask) {
						setSelectedSubtask(updatedSubtask);
					}
				}
			} else {
				setToast({
					message: result.error || 'Failed to log progress',
					type: 'error'
				});
			}
		} catch (error) {
			setToast({
				message: `Error logging progress: ${error.message}`,
				type: 'error'
			});
		} finally {
			setShowProgressModal(false);
			setProgressModalData(null);
		}
	};

	const handleProgressCancel = () => {
		setShowProgressModal(false);
		setProgressModalData(null);
	};

	// Enhanced workflow handlers for Phase 3
	const handleWorkflowDecision = (worktree, taskInfo) => {
		setWorkflowModalData({
			worktree,
			taskInfo
		});
		setShowWorkflowModal(true);
	};

	const handleWorkflowChoice = async (choice, options) => {
		try {
			// Delegate to existing worktree completion logic
			const result = await backend.completeSubtask(options.workflowOption.worktree?.name || 'unknown', {
				workflowChoice: choice,
				...options
			});

			if (result.success) {
				setToast({
					message: `Workflow completed: ${choice}`,
					type: 'success'
				});
				// Refresh task data
				await reloadTasks();
			} else {
				setToast({
					message: result.error || 'Workflow failed',
					type: 'error'
				});
			}
		} catch (error) {
			setToast({
				message: `Workflow error: ${error.message}`,
				type: 'error'
			});
		} finally {
			setShowWorkflowModal(false);
			setWorkflowModalData(null);
		}
	};

	const handleCommitAssistance = (worktree, subtaskInfo, gitStatus) => {
		setCommitAssistantData({
			worktree,
			subtaskInfo,
			gitStatus
		});
		setShowCommitAssistant(true);
	};

	const handleCommit = async (commitMessage, options) => {
		try {
			const result = await backend.commitSubtaskProgress(
				options.worktree?.path || commitAssistantData.worktree?.path,
				commitAssistantData.subtaskInfo,
				commitMessage,
				options
			);

			if (result.success) {
				setToast({
					message: 'Changes committed successfully',
					type: 'success'
				});
				// Refresh git status
				await loadGitStatus();
			} else {
				setToast({
					message: result.error || 'Commit failed',
					type: 'error'
				});
			}
		} catch (error) {
			setToast({
				message: `Commit error: ${error.message}`,
				type: 'error'
			});
		} finally {
			setShowCommitAssistant(false);
			setCommitAssistantData(null);
		}
	};

	// Load git and repo info when subtask changes
	useEffect(() => {
		const loadGitStatus = async () => {
			if (!selectedTask || !selectedSubtask) return;
			
			try {
				// Find worktree for current subtask
				const subtaskId = `${selectedTask.id}.${selectedSubtask.id}`;
				const worktrees = subtaskWorktrees.get(subtaskId) || [];
				
				if (worktrees.length > 0) {
					const status = await backend.getWorktreeGitStatus(worktrees[0].path);
					setGitStatus(status);
				}
			} catch (error) {
				console.warn('Failed to load git status:', error.message);
			}
		};

		const loadRepoInfo = async () => {
			try {
				const info = await backend.detectRemoteRepository();
				setRepoInfo(info);
			} catch (error) {
				console.warn('Failed to detect repository info:', error.message);
			}
		};

		if (selectedSubtask && viewMode === 'subtask-detail') {
			loadGitStatus();
			loadRepoInfo();
		}
	}, [selectedSubtask, viewMode, selectedTask, subtaskWorktrees, backend]);

	const handleRunResearch = async (researchOptions) => {
		const { query, save } = researchOptions;
		setShowResearchModal(false);

		if (!query) return;

		setToast({ message: 'Running research...', type: 'info' });

		try {
			const saveToId =
				viewMode === 'detail'
					? selectedTask.id.toString()
					: `${selectedTask.id}.${selectedSubtask.id}`;

			await backend.research({
				query,
				taskIds: [saveToId],
				saveTo: save ? saveToId : null
			});

			setToast({ message: 'Research complete!', type: 'success' });
			reloadTasks(); // Reload tasks to show updated details
		} catch (error) {
			setToast({ message: `Research failed: ${error.message}`, type: 'error' });
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

		// Add worktree information with git status
		if (taskWorktrees.length > 0) {
			contentLines.push({
				type: 'field',
				label: 'Git Worktrees:',
				value: `${taskWorktrees.length} worktree${taskWorktrees.length > 1 ? 's' : ''}`,
				color: theme.success
			});
			
			// Add detailed worktree status
			taskWorktrees.forEach((wt) => {
				contentLines.push({
					type: 'text',
					text: `  🌳 ${wt.name} ${wt.status ? `(${wt.status})` : ''}`,
					color: theme.text
				});
			});
		} else {
			contentLines.push({
				type: 'field',
				label: 'Git Worktrees:',
				value: '-',
				color: theme.textDim
			});
		}

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
							const key = `detail-${selectedTask.id}-${index}`;
							if (line.type === 'field') {
								return (
									<Box key={key}>
										<Text bold color={theme.textDim} width={15}>
											{line.label}
										</Text>
										<Text color={line.color || theme.text}>{line.value}</Text>
									</Box>
								);
							} else if (line.type === 'header') {
								return (
									<Box key={key}>
										<Text color={theme.accent} bold>
											{line.text}
										</Text>
									</Box>
								);
							} else if (line.type === 'text') {
								return (
									<Box key={key}>
										<Text color={theme.text}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'subtask') {
								return (
									<Box key={key}>
										<Text color={line.color}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'warning') {
								return (
									<Box key={key}>
										<Text color={theme.warning}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'info') {
								return (
									<Box key={key}>
										<Text color={theme.textDim}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'hint') {
								return (
									<Box key={key}>
										<Text color={theme.textDim}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'spacer') {
								return <Box key={key} height={1} />;
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
								e expand • r research •
								{selectedTask?.subtasks?.length > 0 ? 's subtasks • ' : ''}
								ESC back
							</>
						)}
					</Text>
				</Box>

				{showResearchModal && (
					<ResearchInputModal
						onResearch={handleRunResearch}
						onClose={() => setShowResearchModal(false)}
					/>
				)}

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
		// Add worktree information with git status for subtask
		if (worktrees.length > 0) {
			contentLines.push({
				type: 'field',
				label: 'Git Worktrees:',
				value: `${worktrees.length} worktree${worktrees.length > 1 ? 's' : ''}`,
				color: theme.success
			});
			
			// Add detailed worktree status for subtask
			worktrees.forEach((wt) => {
				contentLines.push({
					type: 'text',
					text: `  🌳 ${wt.name} ${wt.status ? `(${wt.status})` : ''}`,
					color: theme.text
				});
			});

			// Add workflow status information
			if (gitStatus) {
				contentLines.push({ type: 'spacer' });
				contentLines.push({
					type: 'workflow-status',
					task: selectedSubtask,
					worktree: worktrees[0],
					gitStatus,
					repoInfo
				});
			}
		} else {
			contentLines.push({
				type: 'field',
				label: 'Git Worktrees:',
				value: '-',
				color: theme.textDim
			});
		}

		// Calculate visible content based on scroll offset
		const visibleContent = contentLines.slice(
			detailScrollOffset,
			detailScrollOffset + DETAIL_VISIBLE_ROWS
		);

		// If modal is open, render only the modal
		if (showClaudeLauncherModal && modalTaskData) {
			return (
				<EnhancedClaudeWorktreeLauncherModal
					backend={backend}
					worktree={claudeWorktree} // Can be null - modal will handle worktree creation
					tasks={modalTaskData}
					onClose={() => {
						setShowClaudeLauncherModal(false);
						setClaudeWorktree(null);
						setModalTaskData(null);
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
						const key = `subtask-detail-${selectedTask.id}-${selectedSubtask.id}-${index}`;
						if (line.type === 'field') {
							return (
								<Box key={key}>
									<Text bold color={theme.textDim} width={15}>
										{line.label}
									</Text>
									<Text color={line.color || theme.text}>{line.value}</Text>
								</Box>
							);
						} else if (line.type === 'header') {
							return (
								<Box key={key}>
									<Text color={theme.accent} bold>
										{line.text}
									</Text>
								</Box>
							);
						} else if (line.type === 'text') {
							return (
								<Box key={key}>
									<Text color={theme.text}>{line.text}</Text>
								</Box>
							);
						} else if (line.type === 'spacer') {
							return <Box key={key} height={1} />;
						} else if (line.type === 'workflow-status') {
							return (
								<Box key={key}>
									<WorkflowStatusIndicator
										task={line.task}
										worktree={line.worktree}
										gitStatus={line.gitStatus}
										repoInfo={line.repoInfo}
										compact={false}
									/>
								</Box>
							);
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
						{worktrees.length > 0 ? 'g go to worktree • ' : ''}c claude • p progress • e exploration • l completion
						{worktrees.length > 0 && gitStatus ? ' • W workflow • C commit' : ''} • ESC
						back
					</Text>
				</Box>

				{showResearchModal && (
					<ResearchInputModal
						onResearch={handleRunResearch}
						onClose={() => setShowResearchModal(false)}
					/>
				)}

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
	if (showClaudeLauncherModal && modalTaskData) {
		return (
			<EnhancedClaudeWorktreeLauncherModal
				backend={backend}
				worktree={claudeWorktree} // Can be null - modal will handle worktree creation
				tasks={modalTaskData}
				onClose={() => {
					setShowClaudeLauncherModal(false);
					setClaudeWorktree(null);
					setModalTaskData(null);
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

			{showResearchModal && (
				<ResearchInputModal
					onResearch={handleRunResearch}
					onClose={() => setShowResearchModal(false)}
				/>
			)}

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

			{/* Progress Logging Modal */}
			{showProgressModal && progressModalData && (
				<ProgressLoggingModal
					subtask={progressModalData.subtask}
					phase={progressModalData.phase}
					onSave={handleProgressSave}
					onCancel={handleProgressCancel}
					backend={backend}
				/>
			)}

			{/* Workflow Decision Modal */}
			{showWorkflowModal && workflowModalData && (
				<WorkflowDecisionModal
					worktree={workflowModalData.worktree}
					taskInfo={workflowModalData.taskInfo}
					backend={backend}
					onDecision={handleWorkflowChoice}
					onClose={() => {
						setShowWorkflowModal(false);
						setWorkflowModalData(null);
					}}
				/>
			)}

			{/* Commit Assistant Modal */}
			{showCommitAssistant && commitAssistantData && (
				<CommitAssistant
					worktree={commitAssistantData.worktree}
					subtaskInfo={commitAssistantData.subtaskInfo}
					gitStatus={commitAssistantData.gitStatus}
					backend={backend}
					onCommit={handleCommit}
					onClose={() => {
						setShowCommitAssistant(false);
						setCommitAssistantData(null);
					}}
				/>
			)}

			{/* Overflow Indicator */}
			<OverflowIndicator position="bottom-right" showCount={true} symbol="⋯" />
		</Box>
	);
}
