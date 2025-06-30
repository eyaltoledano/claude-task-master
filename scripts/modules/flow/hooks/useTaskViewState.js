import { useState } from 'react';
import { TASK_MANAGEMENT_CONSTANTS } from '../components/TaskManagementUtils.js';

/**
 * Custom hook for managing task view state and navigation
 */
export function useTaskViewState() {
	const { VIEW_MODES, VISIBLE_ROWS, DETAIL_VISIBLE_ROWS } =
		TASK_MANAGEMENT_CONSTANTS;

	// View mode state
	const [viewMode, setViewMode] = useState(VIEW_MODES.LIST);

	// Selection state
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [selectedTask, setSelectedTask] = useState(null);
	const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState(0);
	const [selectedSubtask, setSelectedSubtask] = useState(null);

	// Scroll state
	const [scrollOffset, setScrollOffset] = useState(0);
	const [detailScrollOffset, setDetailScrollOffset] = useState(0);
	const [subtasksScrollOffset, setSubtasksScrollOffset] = useState(0);

	// Navigation helpers
	const navigateToTaskDetail = (task) => {
		setSelectedTask(task);
		setViewMode(VIEW_MODES.DETAIL);
		setDetailScrollOffset(0);
	};

	const navigateToSubtasks = () => {
		setViewMode(VIEW_MODES.SUBTASKS);
		setSelectedSubtaskIndex(0);
		setSubtasksScrollOffset(0);
	};

	const navigateToSubtaskDetail = (subtask) => {
		setSelectedSubtask(subtask);
		setViewMode(VIEW_MODES.SUBTASK_DETAIL);
		setDetailScrollOffset(0);
	};

	const navigateBack = () => {
		if (viewMode === VIEW_MODES.SUBTASK_DETAIL) {
			setViewMode(VIEW_MODES.SUBTASKS);
			setSelectedSubtask(null);
		} else if (viewMode === VIEW_MODES.SUBTASKS) {
			setViewMode(VIEW_MODES.DETAIL);
			setSelectedSubtaskIndex(0);
			setSubtasksScrollOffset(0);
		} else if (viewMode === VIEW_MODES.DETAIL) {
			setViewMode(VIEW_MODES.LIST);
			setSelectedTask(null);
			setDetailScrollOffset(0);
		}
	};

	const navigateToWelcome = () => {
		setViewMode(VIEW_MODES.LIST);
		setSelectedTask(null);
		setSelectedSubtask(null);
		setDetailScrollOffset(0);
		// Note: setCurrentScreen('welcome') should be called separately by the component
	};

	// Scroll helpers
	const scrollDown = (amount = 1) => {
		if (
			viewMode === VIEW_MODES.DETAIL ||
			viewMode === VIEW_MODES.SUBTASK_DETAIL
		) {
			setDetailScrollOffset((prev) => prev + amount);
		} else if (viewMode === VIEW_MODES.LIST) {
			const newIndex = Math.min(
				selectedIndex + amount,
				Number.MAX_SAFE_INTEGER
			); // Will be clamped by component
			setSelectedIndex(newIndex);
		} else if (viewMode === VIEW_MODES.SUBTASKS) {
			const newIndex = Math.min(
				selectedSubtaskIndex + amount,
				Number.MAX_SAFE_INTEGER
			);
			setSelectedSubtaskIndex(newIndex);
		}
	};

	const scrollUp = (amount = 1) => {
		if (
			viewMode === VIEW_MODES.DETAIL ||
			viewMode === VIEW_MODES.SUBTASK_DETAIL
		) {
			setDetailScrollOffset((prev) => Math.max(0, prev - amount));
		} else if (viewMode === VIEW_MODES.LIST) {
			const newIndex = Math.max(selectedIndex - amount, 0);
			setSelectedIndex(newIndex);
		} else if (viewMode === VIEW_MODES.SUBTASKS) {
			const newIndex = Math.max(selectedSubtaskIndex - amount, 0);
			setSelectedSubtaskIndex(newIndex);
		}
	};

	// List navigation with scroll adjustment
	const navigateInList = (direction, visibleTasksLength) => {
		if (direction === 'down') {
			const newIndex = Math.min(selectedIndex + 1, visibleTasksLength - 1);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex >= scrollOffset + VISIBLE_ROWS) {
				setScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (direction === 'up') {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex < scrollOffset) {
				setScrollOffset(newIndex);
			}
		}
	};

	// Page navigation
	const pageDown = (visibleTasksLength) => {
		if (
			viewMode === VIEW_MODES.DETAIL ||
			viewMode === VIEW_MODES.SUBTASK_DETAIL
		) {
			setDetailScrollOffset((prev) => prev + 10);
		} else if (viewMode === VIEW_MODES.LIST) {
			const newIndex = Math.min(
				selectedIndex + VISIBLE_ROWS,
				visibleTasksLength - 1
			);
			setSelectedIndex(newIndex);
			setScrollOffset(
				Math.min(
					newIndex - VISIBLE_ROWS + 1,
					Math.max(0, visibleTasksLength - VISIBLE_ROWS)
				)
			);
		}
	};

	const pageUp = () => {
		if (
			viewMode === VIEW_MODES.DETAIL ||
			viewMode === VIEW_MODES.SUBTASK_DETAIL
		) {
			setDetailScrollOffset((prev) => Math.max(0, prev - 10));
		} else if (viewMode === VIEW_MODES.LIST) {
			const newIndex = Math.max(selectedIndex - VISIBLE_ROWS, 0);
			setSelectedIndex(newIndex);
			setScrollOffset(Math.max(0, newIndex));
		}
	};

	// Subtask navigation with scroll adjustment
	const navigateInSubtasks = (direction, subtasksLength) => {
		if (direction === 'down') {
			const newIndex = Math.min(selectedSubtaskIndex + 1, subtasksLength - 1);
			setSelectedSubtaskIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex >= subtasksScrollOffset + VISIBLE_ROWS) {
				setSubtasksScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (direction === 'up') {
			const newIndex = Math.max(selectedSubtaskIndex - 1, 0);
			setSelectedSubtaskIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex < subtasksScrollOffset) {
				setSubtasksScrollOffset(newIndex);
			}
		}
	};

	// Reset all state
	const resetViewState = () => {
		setViewMode(VIEW_MODES.LIST);
		setSelectedIndex(0);
		setSelectedTask(null);
		setSelectedSubtaskIndex(0);
		setSelectedSubtask(null);
		setScrollOffset(0);
		setDetailScrollOffset(0);
		setSubtasksScrollOffset(0);
	};

	return {
		// Current state
		viewMode,
		selectedIndex,
		selectedTask,
		selectedSubtaskIndex,
		selectedSubtask,
		scrollOffset,
		detailScrollOffset,
		subtasksScrollOffset,

		// Direct setters (for complex cases)
		setViewMode,
		setSelectedIndex,
		setSelectedTask,
		setSelectedSubtaskIndex,
		setSelectedSubtask,
		setScrollOffset,
		setDetailScrollOffset,
		setSubtasksScrollOffset,

		// Navigation actions
		navigateToTaskDetail,
		navigateToSubtasks,
		navigateToSubtaskDetail,
		navigateBack,
		navigateToWelcome,

		// Scroll actions
		scrollDown,
		scrollUp,
		pageDown,
		pageUp,

		// List/subtask navigation
		navigateInList,
		navigateInSubtasks,

		// Utilities
		resetViewState,

		// View mode checks
		isListView: viewMode === VIEW_MODES.LIST,
		isDetailView: viewMode === VIEW_MODES.DETAIL,
		isSubtasksView: viewMode === VIEW_MODES.SUBTASKS,
		isSubtaskDetailView: viewMode === VIEW_MODES.SUBTASK_DETAIL
	};
}
