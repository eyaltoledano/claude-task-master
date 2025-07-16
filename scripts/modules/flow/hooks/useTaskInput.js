import { useInput } from 'ink';
import { flushSync } from 'react-dom';
import { useTaskManagementStore } from '../stores/task-management-store.js';
import { useUIStore } from '../stores/ui-store.js';
import { useTaskManager } from './useTaskManager.js';
import { useAppContext } from '../app/index-root.jsx';

const VISIBLE_ROWS = 15; // This should probably come from a config/theme file

export const useTaskInput = () => {
	const {
		viewMode,
		tasks,
		selectedIndex,
		scrollOffset,
		selectedTask,
		selectedSubtask,
		selectedSubtaskIndex,
		subtasksScrollOffset,
		isSearching,
		isExpanding,
		showExpandOptions,
		showStreamingModal,
		// Actions from the store
		setViewMode,
		setSelectedIndex,
		setScrollOffset,
		setSelectedTask,
		setSelectedSubtask,
		setShowExpandOptions,
		setIsExpanding,
		setDetailScrollOffset,
		setSelectedSubtaskIndex,
		setSubtasksScrollOffset,
		setFilterMode,
		setPriorityFilter,
		setStatusFilter,
		setIsSearching,
		priorityFilter,
		statusFilter
	} = useTaskManagementStore();

	const { setCurrentScreen } = useAppContext();
	const { showToast } = useUIStore();
	const { cycleTaskStatus, getTaskDetails } = useTaskManager();

	// This logic for visibleTasks needs to be available here
	// Ideally, this would be a selector in the zustand store
	const filteredTasks = tasks.filter((task) => {
		if (statusFilter !== 'all' && task.status !== statusFilter) return false;
		if (priorityFilter !== 'all' && task.priority !== priorityFilter)
			return false;
		return true;
	});
	const visibleTasks = filteredTasks; // Simplified for now

	useInput((input, key) => {
		if (isSearching || showStreamingModal || showExpandOptions) {
			return;
		}

		if (key.escape) {
			if (isExpanding) return;

			if (viewMode === 'subtask-detail') {
				flushSync(() => {
					setViewMode('subtasks');
					setSelectedSubtask(null);
				});
			} else if (viewMode === 'subtasks') {
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

		if (key.ctrl && input === 'x' && isExpanding) {
			setIsExpanding(false);
			showToast('Expansion cancelled', 'warning');
			return;
		}

		if (viewMode === 'list') {
			handleListViewInput(input, key);
		} else if (viewMode === 'detail') {
			handleDetailViewInput(input, key);
		} else if (viewMode === 'subtasks') {
			handleSubtasksViewInput(input, key);
		} else if (viewMode === 'subtask-detail') {
			handleSubtaskDetailViewInput(input, key);
		}
	});

	const handleListViewInput = (input, key) => {
		if (key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, visibleTasks.length - 1);
			setSelectedIndex(newIndex);
			if (newIndex >= scrollOffset + VISIBLE_ROWS) {
				setScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);
			if (newIndex < scrollOffset) {
				setScrollOffset(newIndex);
			}
		} else if (key.pageDown) {
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
			const newIndex = Math.max(selectedIndex - VISIBLE_ROWS, 0);
			setSelectedIndex(newIndex);
			setScrollOffset(Math.max(0, newIndex));
		} else if (key.return) {
			const task = visibleTasks[selectedIndex];
			getTaskDetails(task.id).then((fullTask) => {
				if (fullTask) {
					setSelectedTask(fullTask);
					setViewMode('detail');
				}
			});
		} else if (input === 'f') {
			setFilterMode((prev) => (prev === 'status' ? 'priority' : 'status'));
		} else if (input === 't') {
			const task = visibleTasks[selectedIndex];
			cycleTaskStatus(task);
		} else if (input === 'r') {
			const priorityOrder = ['all', 'high', 'medium', 'low'];
			const currentIndex = priorityOrder.indexOf(priorityFilter);
			const nextIndex = (currentIndex + 1) % priorityOrder.length;
			setPriorityFilter(priorityOrder[nextIndex]);
			setFilterMode('priority');
		} else if (input === '1') {
			statusFilter === 'status'
				? setStatusFilter('all')
				: setPriorityFilter('all');
		} else if (input === '2') {
			statusFilter === 'status'
				? setStatusFilter('pending')
				: setPriorityFilter('high');
		} else if (input === '3') {
			statusFilter === 'status'
				? setStatusFilter('in-progress')
				: setPriorityFilter('medium');
		} else if (input === '4') {
			statusFilter === 'status'
				? setStatusFilter('done')
				: setPriorityFilter('low');
		} else if (input === '/') {
			setIsSearching(true);
		}
	};

	const handleDetailViewInput = (input, key) => {
		if (input === 'e' && selectedTask) {
			setShowExpandOptions(true);
		} else if (input === 's' && selectedTask?.subtasks?.length > 0) {
			setViewMode('subtasks');
			setSelectedSubtaskIndex(0);
			setSubtasksScrollOffset(0);
		} else if (key.downArrow) {
			setDetailScrollOffset((prev) => prev + 1);
		} else if (key.upArrow) {
			setDetailScrollOffset((prev) => Math.max(0, prev - 1));
		} else if (key.pageDown) {
			setDetailScrollOffset((prev) => prev + 10);
		} else if (key.pageUp) {
			setDetailScrollOffset((prev) => Math.max(0, prev - 10));
		}
	};

	const handleSubtasksViewInput = (input, key) => {
		if (key.downArrow) {
			const maxIndex = selectedTask.subtasks.length - 1;
			const newIndex = Math.min(selectedSubtaskIndex + 1, maxIndex);
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
			const subtask = selectedTask.subtasks[selectedSubtaskIndex];
			setSelectedSubtask(subtask);
			setViewMode('subtask-detail');
			setDetailScrollOffset(0);
		} else if (input === 't') {
			const subtask = selectedTask.subtasks[selectedSubtaskIndex];
			const subtaskId = `${selectedTask.id}.${subtask.id}`;
			cycleTaskStatus({ ...subtask, id: subtaskId });
		}
	};

	const handleSubtaskDetailViewInput = (input, key) => {
		if (key.downArrow) {
			setDetailScrollOffset((prev) => prev + 1);
		} else if (key.upArrow) {
			setDetailScrollOffset((prev) => Math.max(0, prev - 1));
		} else if (key.pageDown) {
			setDetailScrollOffset((prev) => prev + 10);
		} else if (key.pageUp) {
			setDetailScrollOffset((prev) => Math.max(0, prev - 10));
		} else if (input === 'w') {
			// handleWorkOnSubtask(); // This function would be moved to useTaskManager
		} else if (input === 'g') {
			// Go to worktree logic
		} else if (input === 'c' || input === 'C') {
			// handleClaudeSession(); // This function would be moved to useTaskManager
		} else if (input === 'v' || input === 'V') {
			// View Claude sessions logic
		}
	};
};
