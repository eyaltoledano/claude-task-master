import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getTheme } from '../../../../shared/theme/theme.js';
import { SimpleTable } from '../../../ui/components/SimpleTable.jsx';
import { Toast } from '../../../../shared/components/ui/Toast.jsx';

export function TaskListView({
	// State
	selectedIndex,
	filteredTasks,
	visibleTasks,
	filter,
	filterMode,
	priorityFilter,
	searchQuery,
	setSearchQuery,
	isSearching,
	setIsSearching,
	scrollOffset,
	toast,
	setToast,
	currentTag,
	VISIBLE_ROWS,

	// Actions
	handleDownArrow,
	handleUpArrow,
	showTaskDetail,
	cycleFilter,
	cyclePriorityFilter,
	cycleTaskStatus,
	setCurrentScreen,
	getStatusSymbol
}) {
	const theme = getTheme();

	// Handle keyboard input for list view
	useInput((input, key) => {
		// Handle search input
		if (isSearching) {
			if (key.return) {
				setIsSearching(false);
			} else if (key.escape) {
				setIsSearching(false);
				setSearchQuery('');
			}
			return; // Let TextInput handle other keys
		}

		// Navigation
		if (key.downArrow) {
			handleDownArrow();
		} else if (key.upArrow) {
			handleUpArrow();
		} else if (key.return && filteredTasks.length > 0) {
			const task = filteredTasks[selectedIndex];
			showTaskDetail(task);
		} else if (input === 'f') {
			cycleFilter();
		} else if (input === 'p') {
			cyclePriorityFilter();
		} else if (input === 't' && filteredTasks.length > 0) {
			cycleTaskStatus(filteredTasks[selectedIndex]);
		} else if (input === '/') {
			setIsSearching(true);
		} else if (key.escape) {
			setCurrentScreen('welcome');
		}
	});

	// Helper functions
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

	// Render search input if searching
	if (isSearching) {
		return (
			<Box flexDirection="column" height="100%">
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
						<Text color={theme.text}>Search</Text>
					</Box>
					<Text color={theme.textDim}>[ENTER confirm, ESC cancel]</Text>
				</Box>

				{/* Search Input */}
				<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
					<Text color={theme.text}>Search tasks: </Text>
					<TextInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Type to search..."
					/>
				</Box>

				{/* Results preview */}
				<Box paddingLeft={1} paddingRight={1}>
					<Text color={theme.textDim}>
						{filteredTasks.length} task(s) match "{searchQuery}"
					</Text>
				</Box>
			</Box>
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

			{/* Filter Status */}
			<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
				<Text color={theme.textDim}>
					Filter: {filterMode === 'status' ? filter : `priority:${priorityFilter}`}
					{searchQuery && ` | Search: "${searchQuery}"`}
				</Text>
			</Box>

			{/* Task List */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{filteredTasks.length === 0 ? (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
						height="100%"
					>
						<Text color={theme.textDim}>No tasks found</Text>
						<Text color={theme.textDim} marginTop={1}>
							{searchQuery ? 'Try a different search term' : 'No tasks match the current filter'}
						</Text>
					</Box>
				) : (
					<>
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
					</>
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
					↑↓ navigate • ENTER view • f filter • p priority • t status • / search • ESC back
				</Text>
			</Box>

			{/* Toast notifications */}
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