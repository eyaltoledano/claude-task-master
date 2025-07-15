import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { flushSync } from 'react-dom';
import { useAppContext } from '../../../app/index-root.jsx';
import { getTheme } from '../../../shared/theme/theme.js';
import { Toast } from '../../../shared/components/ui/Toast.jsx';
import { ExpandModal } from './ExpandModal.jsx';
import { OverflowIndicator, SimpleTable } from '../../ui';
import { LoadingSpinner } from '../../../shared/components/ui/LoadingSpinner.jsx';
import TextInput from 'ink-text-input';
import { StreamingModal } from '../../../components/StreamingModal.jsx';
import { streamingStateManager } from '../../../infra/streaming/StreamingStateManager.js';
import { useTerminalSize } from '../../../shared/hooks/useTerminalSize.js';
import { ResearchInputModal } from '../../../components/ResearchInputModal.jsx';

import { VibeKitExecutionModal } from '../../../components/VibeKitExecutionModal.jsx';
import { VibeKitSettingsModal } from '../../../components/VibeKitSettingsModal.jsx';
import { SandboxControlPanel } from '../../../components/SandboxControlPanel.jsx';

export function TaskManagementScreen() {
	const {
		backend,
		tasks,
		reloadTasks,
		setCurrentScreen,
		currentTag,
		navigationData
	} = useAppContext();

	// Safety check - don't render if backend is not available
	if (!backend) {
		return (
			<Box
				flexDirection="column"
				height="100%"
				justifyContent="center"
				alignItems="center"
			>
				<Text color="yellow">⚠️ Backend service is not available</Text>
				<Text color="gray">Please wait for initialization to complete...</Text>
			</Box>
		);
	}
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
	const [detailScrollOffset, setDetailScrollOffset] = useState(0);
	const [complexityReport, setComplexityReport] = useState(null);
	const [loadingComplexity, setLoadingComplexity] = useState(false);
	const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState(0);
	const [subtasksScrollOffset, setSubtasksScrollOffset] = useState(0);
	const [selectedSubtask, setSelectedSubtask] = useState(null); // For subtask detail view
	const [showStreamingModal, setShowStreamingModal] = useState(false);

	const [showResearchModal, setShowResearchModal] = useState(false);

	
	// VibeKit modals state
	const [showVibeKitModal, setShowVibeKitModal] = useState(false);
	

	const [showVibeKitSettings, setShowVibeKitSettings] = useState(false);
	const [showSandboxControl, setShowSandboxControl] = useState(false);
	const [vibeKitService, setVibeKitService] = useState(null);

	// Constants for display
	const VISIBLE_ROWS = 15; // Reduced for better visibility
	const DETAIL_VISIBLE_ROWS = 20; // Visible rows in detail view

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
			if (!backend) {
				setLoadingComplexity(false);
				return;
			}

			setLoadingComplexity(true);
			try {
				const report = await backend.getComplexityReport(currentTag);
				setComplexityReport(report);
			} catch (error) {
				// Silently fail - complexity report is optional
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
			if (showVibeKitModal) return setShowVibeKitModal(false);
			if (showVibeKitSettings) return setShowVibeKitSettings(false);
			if (showSandboxControl) return setShowSandboxControl(false);
			// Other modal escape logic can go here...

			if (viewMode === 'detail' || viewMode === 'subtasks') setViewMode('list');
			else if (viewMode === 'subtask-detail') setViewMode('subtasks');
			else if (isSearching) {
				setIsSearching(false);
				setSearchQuery('');
			} else if (viewMode === 'list') {
				// ESC from list view goes back to main menu
				setCurrentScreen('welcome');
			}
			return;
		}

		// Don't process other keys if a modal is active
		const modalsActive = {
			showResearchModal,
			showExpandOptions,
			isSearching,
			showVibeKitModal,
			showVibeKitSettings,
			showSandboxControl
		};
		const hasActiveModal = Object.values(modalsActive).some(modal => modal);
		
		if (hasActiveModal) {
			return;
		}

		switch (viewMode) {
			case 'list':
				if (key.downArrow) handleDownArrow();
				else if (key.upArrow) handleUpArrow();
				else if (key.return && filteredTasks.length > 0) {
					const task = filteredTasks[selectedIndex];
					showTaskDetail(task);
				} else if (input === 'f') cycleFilter();
				else if (input === 'p') cyclePriorityFilter();
				else if (input === 't' && filteredTasks.length > 0) {
					cycleTaskStatus(filteredTasks[selectedIndex]);
				} else if (input === '/') setIsSearching(true);
				break;

			case 'detail':
				if (key.upArrow) setDetailScrollOffset((p) => Math.max(0, p - 1));
				else if (key.downArrow) {
					const maxOffset = getMaxScrollOffset(selectedTask, false);
					setDetailScrollOffset((p) => Math.min(maxOffset, p + 1));
				}
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
					cycleTaskStatus({
						...subtask,
						id: `${selectedTask.id}.${subtask.id}`
					});
				}
				break;

			case 'subtask-detail':
				if (key.upArrow) setDetailScrollOffset((p) => Math.max(0, p - 1));
				else if (key.downArrow) {
					const maxOffset = getMaxScrollOffset(selectedSubtask, true);
					setDetailScrollOffset((p) => Math.min(maxOffset, p + 1));
				}
				else if (input === 't') {
					cycleTaskStatus({
						...selectedSubtask,
						id: `${selectedTask.id}.${selectedSubtask.id}`
					});
				} else if (input === 'r') setShowResearchModal(true);
				else if (input === 'a') {
					// Launch VibeKit agent execution
					setShowVibeKitModal(true);
				}
				break;
		}
	});

	const showTaskDetail = async (task) => {
		try {
			// Fetch full task details
			const fullTask = await backend.getTask(task.id);
			setSelectedTask(fullTask);

			setViewMode('detail');
			setDetailScrollOffset(0); // Reset scroll position when opening a new task

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
		// Safety check - ensure backend exists
		if (!backend) {
			setToast({
				message: 'Backend service not available. Please try again.',
				type: 'error'
			});
			return;
		}

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

			// Refresh task/subtask state based on current view mode
			if (selectedTask) {
				// Always refresh selectedTask to get updated subtask data
				const updatedTask = await backend.getTask(selectedTask.id);
				setSelectedTask(updatedTask);

				// If we're in subtask views, also update the selected subtask
				if (
					(viewMode === 'subtasks' || viewMode === 'subtask-detail') &&
					selectedSubtask
				) {
					// Find the updated subtask in the refreshed task
					const updatedSubtask = updatedTask.subtasks?.find(
						(st) => st.id === selectedSubtask.id
					);
					if (updatedSubtask) {
						setSelectedSubtask(updatedSubtask);
					}
				}
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

	// Helper function to calculate content lines for scroll bounds checking
	const calculateContentLines = (task, isSubtask = false) => {
		if (!task) return [];
		
		const contentLines = [];

		// Add basic field lines
		contentLines.push({ type: 'field', label: 'Status:' });
		contentLines.push({ type: 'field', label: 'Priority:' });
		contentLines.push({ type: 'field', label: 'Dependencies:' });

		if (task.complexity) {
			contentLines.push({ type: 'field', label: 'Complexity:' });
		}

		contentLines.push({ type: 'field', label: 'Description:' });

		if (task.details) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: 'Implementation Details:' });
			const detailLines = task.details.split('\n');
			detailLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		if (task.testStrategy) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: 'Test Strategy:' });
			const testLines = task.testStrategy.split('\n');
			testLines.forEach((line) => {
				contentLines.push({ type: 'text', text: line });
			});
		}

		if (!isSubtask && task.subtasks && task.subtasks.length > 0) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'header', text: `Subtasks (${task.subtasks.length}):` });
			task.subtasks.forEach((subtask) => {
				contentLines.push({ type: 'subtask', text: `${getStatusSymbol(subtask.status)} ${subtask.id}: ${subtask.title}` });
			});
		} else if (!isSubtask) {
			contentLines.push({ type: 'spacer' });
			contentLines.push({ type: 'info', text: "No subtasks yet. Press 'e' to break down this task." });
		}

		return contentLines;
	};

	// Calculate max scroll offset for bounds checking
	const getMaxScrollOffset = (task, isSubtask = false) => {
		const contentLines = calculateContentLines(task, isSubtask);
		return Math.max(0, contentLines.length - DETAIL_VISIBLE_ROWS);
	};







	const handleRunResearch = async (query, options = {}) => {
		try {
			const result = await backend.research({
				query,
				taskIds: selectedTask ? [selectedTask.id] : undefined,
				...options
			});

			showToast(
				`Research completed: ${result.summary || 'Results saved to task'}`,
				'success'
			);
		} catch (error) {
			console.error('Research failed:', error);
			showToast(`Research failed: ${error.message}`, 'error');
		}
	};





	// VibeKit handlers
	const handleVibeKitComplete = async (result) => {
		try {
			if (result.success) {
				// Refresh task data to show any updates
				await reloadTasks();

				// Refresh the selected task details
				if (selectedTask) {
					const updatedTask = await backend.getTask(selectedTask.id);
					setSelectedTask(updatedTask);

					// Update the selected subtask
					if (selectedSubtask) {
					const updatedSubtask = updatedTask.subtasks?.find(
							(s) => s.id === selectedSubtask.id
					);
					if (updatedSubtask) {
						setSelectedSubtask(updatedSubtask);
					}
				}
				}
				
						setToast({
					message: 'VibeKit execution completed successfully!',
							type: 'success'
						});
				} else {
					setToast({
					message: `VibeKit execution failed: ${result.error}`,
					type: 'error'
				});
			}
		} catch (error) {
			setToast({
				message: `Error handling VibeKit completion: ${error.message}`,
				type: 'error'
			});
		} finally {
			setShowVibeKitModal(false);
		}
	};



	const cycleFilter = () => {
		const filters = ['all', 'pending', 'in-progress', 'done'];
		const currentIndex = filters.indexOf(filter);
		const nextIndex = (currentIndex + 1) % filters.length;
		setFilter(filters[nextIndex]);
		setSelectedIndex(0);
		setScrollOffset(0);
	};

	const cyclePriorityFilter = () => {
		const priorities = ['all', 'high', 'medium', 'low'];
		const currentIndex = priorities.indexOf(priorityFilter);
		const nextIndex = (currentIndex + 1) % priorities.length;
		setPriorityFilter(priorities[nextIndex]);
		setSelectedIndex(0);
		setScrollOffset(0);
	};

	// Navigation functions for list view
	const handleDownArrow = () => {
		const newIndex = Math.min(selectedIndex + 1, filteredTasks.length - 1);
		setSelectedIndex(newIndex);

		// Adjust scroll if needed
		if (newIndex >= scrollOffset + VISIBLE_ROWS) {
			setScrollOffset(newIndex - VISIBLE_ROWS + 1);
		}
	};

	const handleUpArrow = () => {
		const newIndex = Math.max(selectedIndex - 1, 0);
		setSelectedIndex(newIndex);

		// Adjust scroll if needed
		if (newIndex < scrollOffset) {
			setScrollOffset(newIndex);
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
				contentLines.push({
					type: 'subtask',
					text: `${getStatusSymbol(subtask.status)} ${subtask.id}: ${subtask.title}`,
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

				{/* VibeKit Execution Modal */}
				{showVibeKitModal && (
					<VibeKitExecutionModal
						task={selectedTask}
						subtask={selectedSubtask}
						isVisible={showVibeKitModal}
						onClose={() => setShowVibeKitModal(false)}
						onComplete={handleVibeKitComplete}
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

							return {
								' ': isSelected ? '→' : ' ',
								ID: subtaskId,
								Title:
									subtask.title.length > 60
										? subtask.title.substring(0, 57) + '...'
										: subtask.title,
								Status: `${getStatusSymbol(subtask.status)} ${subtask.status}`,
								_renderCell: (col, value) => {
									let color = isSelected ? theme.selectionText : theme.text;

									if (col === 'Status') {
										color = getStatusColor(subtask.status);
									}

									return (
										<Text color={color} bold={isSelected}>
											{value}
										</Text>
									);
								}
							};
						})}
						columns={[' ', 'ID', 'Title', 'Status']}
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

				{/* VibeKit Execution Modal */}
				{showVibeKitModal && (
					<VibeKitExecutionModal
						task={selectedTask}
						subtask={selectedSubtask}
						isVisible={showVibeKitModal}
						onClose={() => setShowVibeKitModal(false)}
						onComplete={handleVibeKitComplete}
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

		// Calculate visible content based on scroll offset
		const visibleContent = contentLines.slice(
			detailScrollOffset,
			detailScrollOffset + DETAIL_VISIBLE_ROWS
		);



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
						{contentLines.length > DETAIL_VISIBLE_ROWS ? '↑↓ scroll • ' : ''}
						t status • r research • a agent • ESC back
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

				{/* VibeKit Execution Modal */}
				{showVibeKitModal && (
					<VibeKitExecutionModal
						task={selectedTask}
						subtask={selectedSubtask}
						isVisible={showVibeKitModal}
						onClose={() => setShowVibeKitModal(false)}
						onComplete={handleVibeKitComplete}
					/>
				)}
			</Box>
		);
	}

	// Render task list view

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

			{/* Streaming Modal */}
			<StreamingModal
				isOpen={showStreamingModal}
				onClose={() => setShowStreamingModal(false)}
			/>



			{/* Overflow Indicator */}
			<OverflowIndicator position="bottom-right" showCount={true} symbol="⋯" />

			{/* VibeKit Execution Modal */}
			{showVibeKitModal && (
				<VibeKitExecutionModal
					task={selectedTask}
					subtask={selectedSubtask}
					isVisible={showVibeKitModal}
					onClose={() => setShowVibeKitModal(false)}
					onComplete={handleVibeKitComplete}
				/>
			)}

			{/* VibeKit Settings Modal */}
			{showVibeKitSettings && (
				<VibeKitSettingsModal
					isVisible={showVibeKitSettings}
					onClose={() => setShowVibeKitSettings(false)}
					projectRoot={backend?.projectRoot}
				/>
			)}

			{/* Sandbox Control Panel */}
			{showSandboxControl && (
				<SandboxControlPanel
					isVisible={showSandboxControl}
					onClose={() => setShowSandboxControl(false)}
					projectRoot={backend?.projectRoot}
					vibeKitService={vibeKitService}
				/>
			)}
		</Box>
	);
}
