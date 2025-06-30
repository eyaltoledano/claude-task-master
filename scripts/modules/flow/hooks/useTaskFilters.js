import { useState } from 'react';
import { TASK_MANAGEMENT_CONSTANTS } from '../components/TaskManagementUtils.js';

/**
 * Custom hook for managing task filtering state and logic
 */
export function useTaskFilters() {
	const [filter, setFilter] = useState('all'); // all, pending, done, in-progress
	const [filterMode, setFilterMode] = useState('status'); // status or priority
	const [priorityFilter, setPriorityFilter] = useState('all'); // all, high, medium, low
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);

	const { FILTER_MODES } = TASK_MANAGEMENT_CONSTANTS;

	// Toggle between status and priority filter modes
	const toggleFilterMode = () => {
		if (filterMode === FILTER_MODES.STATUS) {
			setFilterMode(FILTER_MODES.PRIORITY);
			setPriorityFilter('all');
			setFilter('all');
		} else {
			setFilterMode(FILTER_MODES.STATUS);
			setFilter('all');
			setPriorityFilter('all');
		}
	};

	// Set status filter (1-4 keys)
	const setStatusFilter = (statusValue) => {
		setFilter(statusValue);
	};

	// Set priority filter (1-4 keys)
	const setPriorityFilterValue = (priorityValue) => {
		if (filterMode !== FILTER_MODES.PRIORITY) {
			// First switch to priority mode
			setFilterMode(FILTER_MODES.PRIORITY);
			setFilter('all');
		}
		setPriorityFilter(priorityValue);
	};

	// Cycle through priority filters: all → high → medium → low → all
	const cyclePriorityFilter = () => {
		if (filterMode !== FILTER_MODES.PRIORITY) {
			// First switch to priority mode
			setFilterMode(FILTER_MODES.PRIORITY);
			setFilter('all');
		}

		const priorityOrder = ['all', 'high', 'medium', 'low'];
		const currentIndex = priorityOrder.indexOf(priorityFilter);
		const nextIndex = (currentIndex + 1) % priorityOrder.length;
		setPriorityFilter(priorityOrder[nextIndex]);
	};

	// Filter tasks based on current filters
	const filterTasks = (tasks) => {
		return tasks.filter((task) => {
			// Apply status filter
			if (filterMode === FILTER_MODES.STATUS && filter !== 'all' && task.status !== filter) {
				return false;
			}

			// Apply priority filter
			if (
				filterMode === FILTER_MODES.PRIORITY &&
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
	};

	// Reset all filters
	const resetFilters = () => {
		setFilter('all');
		setFilterMode(FILTER_MODES.STATUS);
		setPriorityFilter('all');
		setSearchQuery('');
		setIsSearching(false);
	};

	return {
		// State
		filter,
		filterMode,
		priorityFilter,
		searchQuery,
		isSearching,
		
		// Actions
		setFilter,
		setFilterMode,
		setPriorityFilter,
		setSearchQuery,
		setIsSearching,
		toggleFilterMode,
		setStatusFilter,
		setPriorityFilterValue,
		cyclePriorityFilter,
		resetFilters,
		
		// Computed
		filterTasks,
		
		// Constants for UI
		isStatusMode: filterMode === FILTER_MODES.STATUS,
		isPriorityMode: filterMode === FILTER_MODES.PRIORITY
	};
} 