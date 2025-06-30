import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import {
	useComponentTheme,
	useTerminalSize,
	useKeypress
} from '../hooks/index.js';

export function TaskFilters({
	filter,
	filterMode,
	priorityFilter,
	searchQuery,
	isSearching,
	onFilterChange,
	onFilterModeChange,
	onPriorityFilterChange,
	onSearchChange,
	onSearchStart,
	onSearchEnd,
	taskCounts = {}
}) {
	const { theme } = useComponentTheme('taskFilters');
	const { isNarrow, maxContentWidth } = useTerminalSize();
	const [searchInput, setSearchInput] = useState(searchQuery || '');

	// Handle search input
	const handleSearchSubmit = () => {
		onSearchChange(searchInput);
		onSearchEnd();
	};

	const handleSearchCancel = () => {
		setSearchInput('');
		onSearchChange('');
		onSearchEnd();
	};

	// Search mode keyboard handling
	useKeypress(
		{
			escape: handleSearchCancel,
			return: handleSearchSubmit
		},
		{ isActive: isSearching }
	);

	// Filter keyboard shortcuts when not searching
	useKeypress(
		{
			f: () => {
				if (filterMode === 'status') {
					onFilterModeChange('priority');
					onPriorityFilterChange('all');
					onFilterChange('all');
				} else {
					onFilterModeChange('status');
					onFilterChange('all');
					onPriorityFilterChange('all');
				}
			},
			r: () => {
				if (filterMode !== 'priority') {
					onFilterModeChange('priority');
					onFilterChange('all');
				}
				// Cycle through priority filters
				const priorityOrder = ['all', 'high', 'medium', 'low'];
				const currentIndex = priorityOrder.indexOf(priorityFilter);
				const nextIndex = (currentIndex + 1) % priorityOrder.length;
				onPriorityFilterChange(priorityOrder[nextIndex]);
			},
			1: () => {
				if (filterMode === 'status') {
					onFilterChange('all');
				} else {
					onPriorityFilterChange('all');
				}
			},
			2: () => {
				if (filterMode === 'status') {
					onFilterChange('pending');
				} else {
					onPriorityFilterChange('high');
				}
			},
			3: () => {
				if (filterMode === 'status') {
					onFilterChange('in-progress');
				} else {
					onPriorityFilterChange('medium');
				}
			},
			4: () => {
				if (filterMode === 'status') {
					onFilterChange('done');
				} else {
					onPriorityFilterChange('low');
				}
			},
			'/': onSearchStart
		},
		{ isActive: !isSearching }
	);

	const renderStatusFilters = () => {
		const statusOptions = [
			{ key: 'all', label: 'All', count: taskCounts.all || 0 },
			{ key: 'pending', label: 'Pending', count: taskCounts.pending || 0 },
			{
				key: 'in-progress',
				label: 'In Progress',
				count: taskCounts['in-progress'] || 0
			},
			{ key: 'done', label: 'Done', count: taskCounts.done || 0 }
		];

		return (
			<Box flexDirection={isNarrow ? 'column' : 'row'} gap={isNarrow ? 0 : 1}>
				{statusOptions.map((option, index) => {
					const isActive = filter === option.key;
					const shortcut = `${index + 1}`;

					return (
						<Box key={option.key} marginRight={isNarrow ? 0 : 1}>
							<Text color={isActive ? theme.accent : theme.text.secondary}>
								[{shortcut}]
							</Text>
							<Text
								color={isActive ? theme.text.primary : theme.text.secondary}
							>
								{option.label}
							</Text>
							{!isNarrow && (
								<Text color={theme.text.tertiary}>({option.count})</Text>
							)}
						</Box>
					);
				})}
			</Box>
		);
	};

	const renderPriorityFilters = () => {
		const priorityOptions = [
			{ key: 'all', label: 'All', count: taskCounts.all || 0 },
			{ key: 'high', label: 'High', count: taskCounts.high || 0 },
			{ key: 'medium', label: 'Medium', count: taskCounts.medium || 0 },
			{ key: 'low', label: 'Low', count: taskCounts.low || 0 }
		];

		return (
			<Box flexDirection={isNarrow ? 'column' : 'row'} gap={isNarrow ? 0 : 1}>
				{priorityOptions.map((option, index) => {
					const isActive = priorityFilter === option.key;
					const shortcut = `${index + 1}`;

					return (
						<Box key={option.key} marginRight={isNarrow ? 0 : 1}>
							<Text color={isActive ? theme.accent : theme.text.secondary}>
								[{shortcut}]
							</Text>
							<Text
								color={isActive ? theme.text.primary : theme.text.secondary}
							>
								{option.label}
							</Text>
							{!isNarrow && (
								<Text color={theme.text.tertiary}>({option.count})</Text>
							)}
						</Box>
					);
				})}
			</Box>
		);
	};

	const renderSearchBox = () => {
		if (!isSearching) {
			return searchQuery ? (
				<Box>
					<Text color={theme.text.secondary}>Search: "</Text>
					<Text color={theme.accent}>{searchQuery}</Text>
					<Text color={theme.text.secondary}>" [/] to modify</Text>
				</Box>
			) : (
				<Text color={theme.text.secondary}>Press [/] to search</Text>
			);
		}

		return (
			<Box>
				<Text color={theme.text.primary}>Search: </Text>
				<TextInput
					value={searchInput}
					onChange={setSearchInput}
					placeholder="Enter search term..."
				/>
				<Text color={theme.text.secondary}>
					{' '}
					[Enter] to search, [Esc] to cancel
				</Text>
			</Box>
		);
	};

	return (
		<Box flexDirection="column" width={maxContentWidth} marginBottom={1}>
			{/* Filter mode and controls */}
			<Box
				flexDirection={isNarrow ? 'column' : 'row'}
				justifyContent="space-between"
			>
				<Box flexDirection="column">
					<Box marginBottom={isNarrow ? 1 : 0}>
						<Text color={theme.text.secondary}>Filter by </Text>
						<Text color={theme.accent} bold>
							{filterMode === 'status' ? 'Status' : 'Priority'}
						</Text>
						<Text color={theme.text.secondary}> [f] to toggle</Text>
						{filterMode === 'priority' && (
							<Text color={theme.text.secondary}> | [r] to cycle</Text>
						)}
					</Box>

					{filterMode === 'status'
						? renderStatusFilters()
						: renderPriorityFilters()}
				</Box>

				{/* Search box */}
				{!isNarrow && (
					<Box flexDirection="column" alignItems="flex-end">
						{renderSearchBox()}
					</Box>
				)}
			</Box>

			{/* Search box for narrow terminals */}
			{isNarrow && <Box marginTop={1}>{renderSearchBox()}</Box>}
		</Box>
	);
}
