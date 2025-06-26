import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { flushSync } from 'react-dom';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';
import { Toast } from './Toast.jsx';
import { ExpandModal } from './ExpandModal.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { SimpleTable } from './SimpleTable.jsx';
import ClaudeCodeTaskModal from './ClaudeCodeTaskModal.jsx';

export function TaskManagementScreen() {
	const { backend, tasks, reloadTasks, setCurrentScreen, currentTag } =
		useAppContext();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [expandedTasks, setExpandedTasks] = useState(new Set());
	const [filter, setFilter] = useState('all'); // all, pending, done, in-progress
	const [filterMode, setFilterMode] = useState('status'); // status or priority
	const [priorityFilter, setPriorityFilter] = useState('all'); // all, high, medium, low
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewMode, setViewMode] = useState('list'); // list or detail
	const [selectedTask, setSelectedTask] = useState(null);
	const [showExpandOptions, setShowExpandOptions] = useState(false);
	const [toast, setToast] = useState(null);
	const [isExpanding, setIsExpanding] = useState(false);
	const [detailScrollOffset, setDetailScrollOffset] = useState(0);
	const [showExpandModal, setShowExpandModal] = useState(false);
	const [showClaudeCodeModal, setShowClaudeCodeModal] = useState(false);
	const [expandForce, setExpandForce] = useState(false);
	const [taskWorktrees, setTaskWorktrees] = useState([]); // Add state for worktrees
	const [subtaskWorktrees, setSubtaskWorktrees] = useState(new Map()); // Add state for subtask worktrees

	// Constants for display
	const VISIBLE_ROWS = 15; // Reduced for better visibility
	const DETAIL_VISIBLE_ROWS = 20; // Visible rows in detail view

	// Reload tasks on mount
	useEffect(() => {
		reloadTasks();
	}, []);

	// Ensure proper re-render when viewMode changes
	useEffect(() => {
		// This effect will trigger a re-render when viewMode changes
	}, [viewMode]);

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
			if (viewMode === 'detail') {
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

		if (viewMode === 'detail') {
			if (input === 'e' && selectedTask && !selectedTask.subtasks?.length) {
				// Show expand options
				setShowExpandOptions(true);
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
		} else if (input === 'l' && selectedTask) {
			// Claude Code implementation
			setShowClaudeCodeModal(true);
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
		// Calculate total content lines for detail view
		let contentLines = [];

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
				type: 'warning',
				text: 'No subtasks found. Consider breaking down this task:'
			});
			contentLines.push({
				type: 'hint',
				text: "Press 'e' to expand this task"
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
							onSelect={(withResearch) => {
								setShowExpandOptions(false);
								expandTask(withResearch);
							}}
							onClose={() => setShowExpandOptions(false)}
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
							} else if (line.type === 'subtask') {
								return (
									<Box key={index} marginTop={1} paddingLeft={2}>
										<Text color={line.color}>{line.text}</Text>
									</Box>
								);
							} else if (line.type === 'warning') {
								return (
									<Box
										key={index}
										borderStyle="round"
										borderColor={theme.warning}
										padding={1}
									>
										<Text color={theme.warning}>{line.text}</Text>
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
								{selectedTask.subtasks?.length ? '' : 'e expand • '}l Claude
								Code • ESC back
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

				{showClaudeCodeModal && selectedTask && (
					<ClaudeCodeTaskModal
						task={selectedTask}
						backend={backend}
						onClose={() => setShowClaudeCodeModal(false)}
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
