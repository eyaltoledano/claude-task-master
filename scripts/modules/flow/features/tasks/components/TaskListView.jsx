import React from 'react';
import { Box, Text } from 'ink';
import { SimpleTable } from '../../ui';
import {
	getStatusSymbol,
	getStatusColor,
	getPriorityColor,
	formatDependencies,
	TASK_MANAGEMENT_CONSTANTS
} from './TaskManagementUtils.js';

/**
 * TaskListView - Renders the main task list table
 */
export function TaskListView({
	visibleTasks,
	selectedIndex,
	scrollOffset,
	complexityReport,
	theme,
	onTaskSelect
}) {
	const { VISIBLE_ROWS } = TASK_MANAGEMENT_CONSTANTS;

	// Handle task selection
	const handleTaskSelect = (rowIndex) => {
		const actualIndex = scrollOffset + rowIndex;
		const task = visibleTasks[actualIndex];
		if (task && onTaskSelect) {
			onTaskSelect(task);
		}
	};

	// Define table columns (simple string array)
	const columns = complexityReport
		? ['ID', 'Title', 'Status', 'Priority', 'Dependencies', 'Complexity']
		: ['ID', 'Title', 'Status', 'Priority', 'Dependencies'];

	// Build table data
	const tableData = visibleTasks
		.slice(scrollOffset, scrollOffset + VISIBLE_ROWS)
		.map((task, index) => {
			const globalIndex = scrollOffset + index;
			const isSelected = globalIndex === selectedIndex;
			const isSubtask = task.level === 1;

			// Get complexity data if available
			const complexityData = complexityReport?.complexityAnalysis?.find(
				(analysis) => analysis.taskId === task.id
			);

			const row = {
				ID: task.id,
				Title: task.title,
				Status: `${getStatusSymbol(task.status)} ${task.status}`,
				Priority: task.priority || 'medium',
				Dependencies: formatDependencies(task.dependencies)
			};

			// Add complexity if available
			if (complexityReport) {
				const complexityScore = complexityData?.complexityScore;
				row.Complexity = complexityScore ? `${complexityScore}/10` : '-';
			}

			// Custom rendering function for colors and selection
			row._renderCell = (columnName, value, selected) => {
				let color = selected ? theme.accent : theme.text;

				if (columnName === 'Status') {
					color = selected ? theme.accent : getStatusColor(task.status, theme);
				} else if (columnName === 'Priority') {
					color = selected
						? theme.accent
						: getPriorityColor(task.priority, theme);
				} else if (columnName === 'Dependencies') {
					color = selected ? theme.accent : theme.textDim;
				} else if (
					columnName === 'Complexity' &&
					complexityData?.complexityScore
				) {
					if (selected) {
						color = theme.accent;
					} else {
						const score = complexityData.complexityScore;
						if (score >= 8) color = theme.error;
						else if (score >= 6) color = theme.warning;
						else if (score >= 4) color = theme.info;
						else color = theme.success;
					}
				}

				return (
					<Text color={color} bold={selected}>
						{isSubtask && columnName === 'ID' ? `  ${value}` : value}
					</Text>
				);
			};

			return row;
		});

	return (
		<Box flexDirection="column">
			<SimpleTable
				data={tableData}
				columns={columns}
				selectedIndex={selectedIndex - scrollOffset}
				onSelect={handleTaskSelect}
				borders={true}
			/>
		</Box>
	);
}
