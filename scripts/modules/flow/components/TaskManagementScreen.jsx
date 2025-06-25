import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';
import { Toast } from './Toast.jsx';

export function TaskManagementScreen() {
	const { backend, tasks, reloadTasks, setCurrentScreen, currentTag } =
		useAppContext();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [expandedTasks, setExpandedTasks] = useState(new Set());
	const [selectedTasks, setSelectedTasks] = useState(new Set());
	const [filter, setFilter] = useState('all'); // all, pending, in-progress, done
	const [filterMode, setFilterMode] = useState('status'); // 'status' or 'priority'
	const [priorityFilter, setPriorityFilter] = useState('all'); // all, high, medium, low
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
	const [selectedTask, setSelectedTask] = useState(null);
	const [showExpandOptions, setShowExpandOptions] = useState(false);
	const [toast, setToast] = useState(null);
	const [isExpanding, setIsExpanding] = useState(false);

	// Constants for display
	const VISIBLE_ROWS = 15; // Reduced for better visibility

	// Reload tasks on mount
	useEffect(() => {
		reloadTasks();
	}, []);

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

		if (showExpandOptions) {
			if (input === '1' || input === 'y') {
				// Expand with research
				expandTask(true);
			} else if (input === '2' || input === 'n') {
				// Expand without research
				expandTask(false);
			} else if (key.escape) {
				setShowExpandOptions(false);
			}
			return;
		}

		if (viewMode === 'detail') {
			if (key.escape) {
				setViewMode('list');
				setSelectedTask(null);
			} else if (
				input === 'e' &&
				selectedTask &&
				!selectedTask.subtasks?.length
			) {
				// Show expand options
				setShowExpandOptions(true);
			}
			return;
		}

		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

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
		} else if (input === ' ') {
			// Toggle selection
			const task = visibleTasks[selectedIndex];
			const newSelected = new Set(selectedTasks);
			if (newSelected.has(task.id)) {
				newSelected.delete(task.id);
			} else {
				newSelected.add(task.id);
			}
			setSelectedTasks(newSelected);
		} else if (input === 's') {
			// Switch to status filter mode
			setFilterMode('status');
			setFilter('all');
			setPriorityFilter('all');
		} else if (input === 'p') {
			// Switch to priority filter mode
			setFilterMode('priority');
			setPriorityFilter('all');
			setFilter('all');
		} else if (input === 't') {
			// Cycle status of selected task
			const task = visibleTasks[selectedIndex];
			cycleTaskStatus(task);
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
			setViewMode('detail');
		} catch (error) {
			console.error('Failed to load task details:', error);
		}
	};

	const expandTask = async (withResearch) => {
		setShowExpandOptions(false);
		setIsExpanding(true);

		try {
			await backend.expandTask(selectedTask.id, {
				research: withResearch,
				force: false
			});

			// Reload tasks and refresh the detail view
			await reloadTasks();
			const updatedTask = await backend.getTask(selectedTask.id);
			setSelectedTask(updatedTask);

			setToast({
				message: `Task expanded ${withResearch ? 'with research' : 'without research'}`,
				type: 'success'
			});
		} catch (error) {
			setToast({
				message: `Failed to expand task: ${error.message}`,
				type: 'error'
			});
		} finally {
			setIsExpanding(false);
		}
	};

	const cycleTaskStatus = async (task) => {
		const statusOrder = [
			'pending',
			'in-progress',
			'done',
			'blocked',
			'deferred'
		];
		const currentIndex = statusOrder.indexOf(task.status);
		const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

		try {
			await backend.setTaskStatus(task.id, nextStatus);
			await reloadTasks();
		} catch (error) {
			console.error('Failed to update task status:', error);
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

	// Render task detail view
	if (viewMode === 'detail' && selectedTask) {
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
					<Text color={theme.accent} bold>
						Task: #{selectedTask.id} - {selectedTask.title}
					</Text>
				</Box>

				{/* Task Details */}
				<Box
					flexDirection="column"
					paddingLeft={2}
					paddingRight={2}
					flexGrow={1}
				>
					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>ID:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={theme.text}>{selectedTask.id}</Text>
						</Box>
					</Box>

					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>Title:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={theme.text}>{selectedTask.title}</Text>
						</Box>
					</Box>

					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>Status:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={getStatusColor(selectedTask.status)}>
								{getStatusSymbol(selectedTask.status)} {selectedTask.status}
							</Text>
						</Box>
					</Box>

					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>Priority:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={getPriorityColor(selectedTask.priority)}>
								{selectedTask.priority}
							</Text>
						</Box>
					</Box>

					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>Dependencies:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={theme.text}>
								{selectedTask.dependencies &&
								selectedTask.dependencies.length > 0
									? selectedTask.dependencies
											.map((dep) => {
												const depTask = tasks.find((t) => t.id === dep);
												return depTask?.status === 'done'
													? `✅ ${dep}`
													: `⏱️ ${dep}`;
											})
											.join(', ')
									: '-'}
							</Text>
						</Box>
					</Box>

					{selectedTask.complexity && (
						<Box flexDirection="row" marginBottom={1}>
							<Box width={20}>
								<Text color={theme.textDim}>Complexity:</Text>
							</Box>
							<Box flexGrow={1}>
								<Text color={theme.priorityMedium}>
									● {selectedTask.complexity}
								</Text>
							</Box>
						</Box>
					)}

					<Box flexDirection="row" marginBottom={1}>
						<Box width={20}>
							<Text color={theme.textDim}>Description:</Text>
						</Box>
						<Box flexGrow={1}>
							<Text color={theme.text}>{selectedTask.description}</Text>
						</Box>
					</Box>

					{/* Implementation Details */}
					{selectedTask.details && (
						<Box flexDirection="column" marginTop={1}>
							<Text color={theme.accent} bold>
								Implementation Details:
							</Text>
							<Box
								marginTop={1}
								borderStyle="round"
								borderColor={theme.border}
								padding={1}
							>
								<Text color={theme.text}>{selectedTask.details}</Text>
							</Box>
						</Box>
					)}

					{/* Test Strategy */}
					{selectedTask.testStrategy && (
						<Box flexDirection="column" marginTop={1}>
							<Text color={theme.accent} bold>
								Test Strategy:
							</Text>
							<Box
								marginTop={1}
								borderStyle="round"
								borderColor={theme.border}
								padding={1}
							>
								<Text color={theme.text}>{selectedTask.testStrategy}</Text>
							</Box>
						</Box>
					)}

					{/* Subtasks */}
					{selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
						<Box flexDirection="column" marginTop={1}>
							<Text color={theme.accent} bold>
								Subtasks ({selectedTask.subtasks.length}):
							</Text>
							{selectedTask.subtasks.map((subtask, index) => (
								<Box key={subtask.id} marginTop={1} paddingLeft={2}>
									<Text color={getStatusColor(subtask.status)}>
										{getStatusSymbol(subtask.status)} {subtask.id}:{' '}
										{subtask.title}
									</Text>
								</Box>
							))}
						</Box>
					) : (
						<Box flexDirection="column" marginTop={2}>
							<Box borderStyle="round" borderColor={theme.warning} padding={1}>
								<Text color={theme.warning}>
									No subtasks found. Consider breaking down this task:
								</Text>
								<Text color={theme.textDim}>Press 'e' to expand this task</Text>
							</Box>
						</Box>
					)}
				</Box>

				{/* Expand Options Dialog */}
				{showExpandOptions && (
					<Box
						position="absolute"
						width="60%"
						height={8}
						left="20%"
						top="40%"
						borderStyle="round"
						borderColor={theme.accent}
						backgroundColor={theme.background}
						paddingLeft={2}
						paddingRight={2}
						paddingTop={1}
						paddingBottom={1}
					>
						<Box flexDirection="column">
							<Text color={theme.accent} bold>
								Expand Task Options:
							</Text>
							<Box marginTop={1}>
								<Text color={theme.text}>
									Would you like to use research for better task breakdown?
								</Text>
							</Box>
							<Box marginTop={1}>
								<Text color={theme.success}>
									1) Yes - Use research (recommended)
								</Text>
							</Box>
							<Box>
								<Text color={theme.text}>
									2) No - Quick expand without research
								</Text>
							</Box>
							<Box marginTop={1}>
								<Text color={theme.textDim}>[ESC to cancel]</Text>
							</Box>
						</Box>
					</Box>
				)}

				{/* Loading indicator */}
				{isExpanding && (
					<Box
						position="absolute"
						width="50%"
						height={5}
						left="25%"
						top="45%"
						borderStyle="round"
						borderColor={theme.accent}
						backgroundColor={theme.background}
						justifyContent="center"
						alignItems="center"
					>
						<Text color={theme.accent}>🔄 Expanding task...</Text>
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
				>
					<Text color={theme.text}>
						{selectedTask.subtasks?.length ? 'ESC back' : 'e expand • ESC back'}
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
					<Text color={theme.text}>[Current Tag: {currentTag}]</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Task List */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{/* Column Headers */}
				<Box marginBottom={1}>
					<Box width={8}>
						<Text color={theme.text} bold>
							ID
						</Text>
					</Box>
					<Box width={35}>
						<Text color={theme.text} bold>
							Title
						</Text>
					</Box>
					<Box width={10}>
						<Text color={theme.text} bold>
							Subtasks
						</Text>
					</Box>
					<Box width={8}>
						<Text color={theme.text} bold>
							Complex
						</Text>
					</Box>
					<Box width={12}>
						<Text color={theme.text} bold>
							Status
						</Text>
					</Box>
					<Box width={10}>
						<Text color={theme.text} bold>
							Priority
						</Text>
					</Box>
					<Box width={15}>
						<Text color={theme.text} bold>
							Dependencies
						</Text>
					</Box>
				</Box>

				{/* Task Rows */}
				<Box flexDirection="column">
					{visibleTasks
						.slice(scrollOffset, scrollOffset + VISIBLE_ROWS)
						.map((task, displayIndex) => {
							const actualIndex = displayIndex + scrollOffset;
							const isSelected = actualIndex === selectedIndex;
							const isTaskSelected = selectedTasks.has(task.id);
							const subtaskCount =
								task.level === 0 && task.subtasks ? task.subtasks.length : 0;

							return (
								<Box
									key={`${task.id}-${task.level}`}
									backgroundColor={isSelected ? theme.selection : undefined}
									paddingLeft={task.level * 2}
								>
									<Box width={8}>
										<Text
											color={isSelected ? theme.selectionText : theme.text}
											bold={isSelected}
										>
											{task.id}
										</Text>
									</Box>
									<Box width={35}>
										<Text
											color={isSelected ? theme.selectionText : theme.text}
											bold={isSelected}
										>
											{task.title.length > 32
												? task.title.substring(0, 29) + '...'
												: task.title}
										</Text>
									</Box>
									<Box width={10}>
										<Text
											color={isSelected ? theme.selectionText : theme.textDim}
										>
											{task.level === 0
												? subtaskCount > 0
													? `[${subtaskCount}]`
													: '-'
												: ''}
										</Text>
									</Box>
									<Box width={8}>
										<Text
											color={isSelected ? theme.selectionText : theme.textDim}
										>
											{task.complexity ? `● ${task.complexity}` : '-'}
										</Text>
									</Box>
									<Box width={12}>
										<Text color={getStatusColor(task.status)} bold={isSelected}>
											{getStatusSymbol(task.status)} {task.status}
										</Text>
									</Box>
									<Box width={10}>
										<Text
											color={getPriorityColor(task.priority)}
											bold={isSelected}
										>
											{task.priority}
										</Text>
									</Box>
									<Box width={15}>
										<Text
											color={isSelected ? theme.selectionText : theme.textDim}
										>
											{formatDependencies(task.dependencies)}
										</Text>
									</Box>
								</Box>
							);
						})}
				</Box>

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
			>
				<Box flexDirection="column">
					{/* Controls */}
					<Box marginBottom={1}>
						<Text color={theme.text}>
							↑↓ navigate • Enter view details • Space select • t cycle status
						</Text>
					</Box>

					{/* Filter mode indicator and options */}
					<Box>
						<Text color={theme.text}>Filter: </Text>
						<Text
							color={filterMode === 'status' ? theme.accent : theme.textDim}
						>
							s Status
						</Text>
						<Text color={theme.textDim}> | </Text>
						<Text
							color={filterMode === 'priority' ? theme.accent : theme.textDim}
						>
							p Priority
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
		</Box>
	);
}
