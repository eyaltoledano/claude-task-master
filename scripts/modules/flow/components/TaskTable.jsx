import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

// Column definitions with widths (adjusted for padding)
const columns = [
	{ key: 'id', label: 'ID', width: 6 },
	{ key: 'title', label: 'Title', width: 33 },
	{ key: 'subtasks', label: 'Subtasks', width: 8 },
	{ key: 'complexity', label: 'Complex', width: 7 },
	{ key: 'status', label: 'Status', width: 10 },
	{ key: 'priority', label: 'Priority', width: 8 },
	{ key: 'dependencies', label: 'Deps', width: 13 }
];

export function TaskTable({
	tasks,
	visibleTasks,
	scrollOffset,
	visibleRows,
	selectedIndex,
	getStatusSymbol,
	getStatusColor,
	getPriorityColor,
	formatDependencies
}) {
	// Helper to create border line
	const createBorderLine = (left, middle, right, fill) => {
		return left + columns.map((col, i) => {
			const line = fill.repeat(col.width + 2); // +2 for padding
			return i === 0 ? line : middle + line;
		}).join('') + right;
	};

	return (
		<Box flexDirection="column">
			{/* Top border */}
			<Text>{createBorderLine('┌', '┬', '┐', '─')}</Text>

			{/* Header row */}
			<Box>
				<Text>│</Text>
				{columns.map((col, i) => (
					<React.Fragment key={col.key}>
						<Box width={col.width + 2} justifyContent="center">
							<Text color={theme.accent} bold>
								{col.label}
							</Text>
						</Box>
						<Text>│</Text>
					</React.Fragment>
				))}
			</Box>

			{/* Header bottom border */}
			<Text>{createBorderLine('├', '┼', '┤', '─')}</Text>

			{/* Data rows */}
			{visibleTasks
				.slice(scrollOffset, scrollOffset + visibleRows)
				.map((task, displayIndex) => {
					const actualIndex = displayIndex + scrollOffset;
					const isSelected = actualIndex === selectedIndex;
					const subtaskCount = task.level === 0 && task.subtasks ? task.subtasks.length : 0;

					return (
						<Box
							key={`${task.id}-${task.level}`}
							backgroundColor={isSelected ? theme.selection : undefined}
						>
							<Text>│</Text>
							
							{/* ID */}
							<Box width={columns[0].width + 2} paddingLeft={task.level > 0 ? 2 : 1} paddingRight={1}>
								<Text color={isSelected ? theme.selectionText : theme.text} bold={isSelected}>
									{task.id}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Title */}
							<Box width={columns[1].width + 2} paddingLeft={1} paddingRight={1}>
								<Text color={isSelected ? theme.selectionText : theme.text} bold={isSelected}>
									{task.title.length > columns[1].width ? 
										task.title.substring(0, columns[1].width - 3) + '...' : 
										task.title}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Subtasks */}
							<Box width={columns[2].width + 2} paddingLeft={1} paddingRight={1} justifyContent="center">
								<Text color={isSelected ? theme.selectionText : theme.textDim}>
									{task.level === 0 ? (subtaskCount > 0 ? `[${subtaskCount}]` : '-') : ''}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Complexity */}
							<Box width={columns[3].width + 2} paddingLeft={1} paddingRight={1} justifyContent="center">
								<Text color={isSelected ? theme.selectionText : theme.textDim}>
									{task.complexity ? `● ${task.complexity}` : '-'}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Status */}
							<Box width={columns[4].width + 2} paddingLeft={1} paddingRight={1}>
								<Text color={getStatusColor(task.status)} bold={isSelected}>
									{getStatusSymbol(task.status)} {task.status}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Priority */}
							<Box width={columns[5].width + 2} paddingLeft={1} paddingRight={1} justifyContent="center">
								<Text color={getPriorityColor(task.priority)} bold={isSelected}>
									{task.priority}
								</Text>
							</Box>
							<Text>│</Text>
							
							{/* Dependencies */}
							<Box width={columns[6].width + 2} paddingLeft={1} paddingRight={1}>
								<Text color={isSelected ? theme.selectionText : theme.textDim}>
									{formatDependencies(task.dependencies)}
								</Text>
							</Box>
							<Text>│</Text>
						</Box>
					);
				})}

			{/* Bottom border */}
			<Text>{createBorderLine('└', '┴', '┘', '─')}</Text>
		</Box>
	);
} 