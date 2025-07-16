import { useState, useEffect } from 'react';
import { useAppContext } from '../../../../../app/index-root.jsx';
import { useServices } from '../../../../../shared/contexts/ServiceContext.jsx';
import { streamingStateManager } from '../../../../../infra/streaming/StreamingStateManager.js';

export function useTaskScreenState() {
	// Get services and app context
	const { backend, logger } = useServices();
	const {
		tasks,
		reloadTasks,
		setCurrentScreen,
		currentTag,
		navigationData
	} = useAppContext();

	// View state
	const [viewMode, setViewMode] = useState('list'); // list, detail, subtasks, subtask-detail
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [selectedTask, setSelectedTask] = useState(null);
	const [selectedSubtask, setSelectedSubtask] = useState(null);
	const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState(0);

	// Filtering and search state
	const [filter, setFilter] = useState('all'); // all, pending, done, in-progress
	const [filterMode, setFilterMode] = useState('status'); // status or priority
	const [priorityFilter, setPriorityFilter] = useState('all'); // all, high, medium, low
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [expandedTasks, setExpandedTasks] = useState(new Set());

	// Scroll state
	const [scrollOffset, setScrollOffset] = useState(0);
	const [detailScrollOffset, setDetailScrollOffset] = useState(0);
	const [subtasksScrollOffset, setSubtasksScrollOffset] = useState(0);

	// Modal and loading state
	const [showExpandOptions, setShowExpandOptions] = useState(false);
	const [showResearchModal, setShowResearchModal] = useState(false);
	const [showVibeKitModal, setShowVibeKitModal] = useState(false);
	const [showVibeKitSettings, setShowVibeKitSettings] = useState(false);
	const [showSandboxControl, setShowSandboxControl] = useState(false);
	const [showStreamingModal, setShowStreamingModal] = useState(false);
	const [isExpanding, setIsExpanding] = useState(false);
	
	// Data state
	const [toast, setToast] = useState(null);
	const [expandError, setExpandError] = useState(null);
	const [complexityReport, setComplexityReport] = useState(null);
	const [loadingComplexity, setLoadingComplexity] = useState(false);
	const [vibeKitService, setVibeKitService] = useState(null);

	// Constants
	const VISIBLE_ROWS = 15;
	const DETAIL_VISIBLE_ROWS = 20;

	// Reload tasks on mount
	useEffect(() => {
		reloadTasks();
	}, [reloadTasks]);

	// Handle navigation data
	useEffect(() => {
		if (navigationData?.selectedTaskId && tasks.length > 0) {
			const taskIndex = tasks.findIndex(
				(task) => task.id === navigationData.selectedTaskId
			);
			if (taskIndex !== -1) {
				setSelectedIndex(taskIndex);
				const task = tasks[taskIndex];

				showTaskDetail(task)
					.then((fullTask) => {
						setSelectedTask(fullTask);

						if (navigationData.selectedSubtaskId && fullTask.subtasks) {
							const subtaskIndex = fullTask.subtasks.findIndex(
								(subtask) =>
									`${fullTask.id}.${subtask.id}` ===
									navigationData.selectedSubtaskId
							);
							if (subtaskIndex !== -1) {
								setSelectedSubtaskIndex(subtaskIndex);
								setSelectedSubtask(fullTask.subtasks[subtaskIndex]);
								if (navigationData.viewMode === 'subtask-detail') {
									setViewMode('subtask-detail');
								} else {
									setViewMode('subtask-detail');
								}
								setDetailScrollOffset(0);
							} else {
								setViewMode('detail');
								setDetailScrollOffset(0);
							}
						} else {
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
				logger.debug('Loading complexity report', { tag: currentTag });
				const report = await backend.getComplexityReport(currentTag);
				setComplexityReport(report);
				logger.debug('Complexity report loaded', { taskCount: report?.tasks?.length });
			} catch (error) {
				logger.debug('Complexity report not available', { error: error.message });
				setComplexityReport(null);
			} finally {
				setLoadingComplexity(false);
			}
		};

		loadComplexityReport();
	}, [currentTag, backend, logger]);

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

	// Helper function to show toast messages
	const showToast = (message, type = 'info') => {
		setToast({ message, type });
	};

	// Show task detail function
	const showTaskDetail = async (task) => {
		try {
			const fullTask = await backend.getTask(task.id);
			setSelectedTask(fullTask);
			setViewMode('detail');
			setDetailScrollOffset(0);
			return fullTask;
		} catch (error) {
			console.error('Failed to load task details:', error);
			throw error;
		}
	};

	// Expand task function
	const expandTask = async (options) => {
		setShowExpandOptions(false);
		setShowStreamingModal(true);

		try {
			await streamingStateManager.startOperation('expand_task', {
				execute: async (signal, callbacks) => {
					let thinkingIndex = 0;
					const config = streamingStateManager.getOperationConfig('expand_task');

					const thinkingInterval = setInterval(() => {
						if (config.thinkingMessages?.[thinkingIndex]) {
							callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
							thinkingIndex = (thinkingIndex + 1) % config.thinkingMessages.length;
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
				setToast({
					message: 'Task expansion cancelled',
					type: 'warning'
				});
			}
		} finally {
			setIsExpanding(false);
		}
	};

	// Cycle task status function
	const cycleTaskStatus = async (task) => {
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
			logger.info('Updating task status', { 
				taskId: task.id, 
				oldStatus: task.status, 
				newStatus 
			});
			await backend.setTaskStatus(task.id, newStatus);
			await reloadTasks();
			logger.success('Task status updated', { taskId: task.id, newStatus });

			if (selectedTask) {
				const updatedTask = await backend.getTask(selectedTask.id);
				setSelectedTask(updatedTask);

				if ((viewMode === 'subtasks' || viewMode === 'subtask-detail') && selectedSubtask) {
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

	// Filter functions
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

		if (newIndex >= scrollOffset + VISIBLE_ROWS) {
			setScrollOffset(newIndex - VISIBLE_ROWS + 1);
		}
	};

	const handleUpArrow = () => {
		const newIndex = Math.max(selectedIndex - 1, 0);
		setSelectedIndex(newIndex);

		if (newIndex < scrollOffset) {
			setScrollOffset(newIndex);
		}
	};

	// Research handler
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
				await reloadTasks();

				if (selectedTask) {
					const updatedTask = await backend.getTask(selectedTask.id);
					setSelectedTask(updatedTask);

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

	// Helper function to calculate content lines for scroll bounds checking
	const calculateContentLines = (task, isSubtask = false) => {
		if (!task) return [];
		
		const contentLines = [];

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

	// Status symbol helper
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

	return {
		// State
		viewMode,
		setViewMode,
		selectedIndex,
		setSelectedIndex,
		selectedTask,
		setSelectedTask,
		selectedSubtask,
		setSelectedSubtask,
		selectedSubtaskIndex,
		setSelectedSubtaskIndex,
		filter,
		filterMode,
		priorityFilter,
		searchQuery,
		setSearchQuery,
		isSearching,
		setIsSearching,
		expandedTasks,
		scrollOffset,
		setScrollOffset,
		detailScrollOffset,
		setDetailScrollOffset,
		subtasksScrollOffset,
		setSubtasksScrollOffset,
		showExpandOptions,
		setShowExpandOptions,
		showResearchModal,
		setShowResearchModal,
		showVibeKitModal,
		setShowVibeKitModal,
		showVibeKitSettings,
		setShowVibeKitSettings,
		showSandboxControl,
		setShowSandboxControl,
		showStreamingModal,
		setShowStreamingModal,
		isExpanding,
		toast,
		setToast,
		expandError,
		complexityReport,
		loadingComplexity,
		vibeKitService,

		// Computed state
		filteredTasks,
		visibleTasks,

		// Constants
		VISIBLE_ROWS,
		DETAIL_VISIBLE_ROWS,

		// Context data
		tasks,
		currentTag,
		backend,
		logger,
		setCurrentScreen,

		// Actions
		showToast,
		showTaskDetail,
		expandTask,
		cycleTaskStatus,
		cycleFilter,
		cyclePriorityFilter,
		handleDownArrow,
		handleUpArrow,
		handleRunResearch,
		handleVibeKitComplete,
		calculateContentLines,
		getMaxScrollOffset,
		getStatusSymbol,
		reloadTasks
	};
} 