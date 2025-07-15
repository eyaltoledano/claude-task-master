import React from 'react';
import { Box, Text } from 'ink';
import {
	getStatusSymbol,
	getStatusColor,
	getPriorityColor,
	formatDependencies,
	extractKeyDecisions,
	extractClaudeSessionIds,
	TASK_MANAGEMENT_CONSTANTS
} from './TaskManagementUtils.js';

/**
 * TaskDetailView - Renders the detailed view of a single task
 */
export function TaskDetailView({
	selectedTask,
	detailScrollOffset,
	complexityReport,
	taskWorktrees,
	theme
}) {
	const { DETAIL_VISIBLE_ROWS } = TASK_MANAGEMENT_CONSTANTS;

	if (!selectedTask) {
		return (
			<Box justifyContent="center" alignItems="center" height={10}>
				<Text color={theme.textDim}>No task selected</Text>
			</Box>
		);
	}

	// Get complexity data if available
	const complexityData = complexityReport?.tasks?.find(
		(t) => t.id === selectedTask.id
	);
	const hasWorktrees = taskWorktrees && taskWorktrees.length > 0;
	const claudeSessionIds = extractClaudeSessionIds(selectedTask.details);
	const keyDecisions = extractKeyDecisions(selectedTask.details);

	// Split task details into lines for scrolling
	const detailLines = selectedTask.details
		? selectedTask.details.split('\\n')
		: [];
	const visibleDetailLines = detailLines.slice(
		detailScrollOffset,
		detailScrollOffset + DETAIL_VISIBLE_ROWS
	);

	return (
		<Box flexDirection="column" paddingX={1}>
			{/* Task Header */}
			<Box marginBottom={1}>
				<Box flexDirection="column">
					<Box flexDirection="row" alignItems="center">
						<Text bold color={theme.text}>
							Task {selectedTask.id}: {selectedTask.title}
						</Text>
					</Box>

					<Box flexDirection="row" marginTop={1} gap={1}>
						<Text color={theme.text}>Status: </Text>
						<Text color={getStatusColor(selectedTask.status, theme)} bold>
							{getStatusSymbol(selectedTask.status)} {selectedTask.status}
						</Text>

						<Text color={theme.textDim}> | </Text>

						<Text color={theme.text}>Priority: </Text>
						<Text color={getPriorityColor(selectedTask.priority, theme)} bold>
							{selectedTask.priority || 'medium'}
						</Text>

						{complexityData && (
							<>
								<Text color={theme.textDim}> | </Text>
								<Text color={theme.text}>Complexity: </Text>
								<Text
									color={
										complexityData.complexity >= 8
											? theme.error
											: complexityData.complexity >= 6
												? theme.warning
												: complexityData.complexity >= 4
													? theme.info
													: theme.success
									}
									bold
								>
									{complexityData.complexity}/10
								</Text>
							</>
						)}
					</Box>
				</Box>
			</Box>

			{/* Dependencies */}
			{selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
				<Box marginBottom={1}>
					<Text color={theme.text}>Dependencies: </Text>
					<Text color={theme.textDim}>
						{formatDependencies(selectedTask.dependencies)}
					</Text>
				</Box>
			)}

			{/* Worktrees Info */}
			{hasWorktrees && (
				<Box marginBottom={1}>
					<Text color={theme.text}>Linked Worktrees: </Text>
					<Text color={theme.info}>
						{taskWorktrees.length} worktree
						{taskWorktrees.length !== 1 ? 's' : ''}
					</Text>
				</Box>
			)}

			{/* Claude Sessions Info */}
			{claudeSessionIds.length > 0 && (
				<Box marginBottom={1}>
					<Text color={theme.text}>Claude Sessions: </Text>
					<Text color={theme.info}>
						{claudeSessionIds.length} session
						{claudeSessionIds.length !== 1 ? 's' : ''}
					</Text>
				</Box>
			)}

			{/* Description */}
			{selectedTask.description && (
				<Box marginBottom={1}>
					<Text color={theme.text} bold>
						Description:
					</Text>
					<Text color={theme.text}>{selectedTask.description}</Text>
				</Box>
			)}

			{/* Key Decisions */}
			{keyDecisions && (
				<Box marginBottom={1}>
					<Text color={theme.text} bold>
						Key Decisions:
					</Text>
					<Text color={theme.textDim}>{keyDecisions}</Text>
				</Box>
			)}

			{/* Subtasks Summary */}
			{selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
				<Box marginBottom={1}>
					<Text color={theme.text} bold>
						Subtasks ({selectedTask.subtasks.length}):
					</Text>
					<Box marginLeft={2}>
						{selectedTask.subtasks.slice(0, 3).map((subtask) => (
							<Box key={`${selectedTask.id}-${subtask.id}`}>
								<Text color={getStatusColor(subtask.status, theme)}>
									{getStatusSymbol(subtask.status)}
								</Text>
								<Text color={theme.text}> {subtask.title}</Text>
							</Box>
						))}
						{selectedTask.subtasks.length > 3 && (
							<Text color={theme.textDim}>
								... and {selectedTask.subtasks.length - 3} more
							</Text>
						)}
					</Box>
				</Box>
			)}

			{/* Implementation Details */}
			{selectedTask.details && (
				<Box marginBottom={1}>
					<Text color={theme.text} bold>
						Implementation Details:
					</Text>
					<Box marginLeft={1}>
						{visibleDetailLines.map((line, index) => (
							<Text
								key={`detail-line-${detailScrollOffset + index}`}
								color={theme.text}
							>
								{line}
							</Text>
						))}
						{detailLines.length > DETAIL_VISIBLE_ROWS && (
							<Text color={theme.textDim}>
								... (
								{detailLines.length - detailScrollOffset - DETAIL_VISIBLE_ROWS}{' '}
								more lines)
							</Text>
						)}
					</Box>
				</Box>
			)}

			{/* Test Strategy */}
			{selectedTask.testStrategy && (
				<Box marginBottom={1}>
					<Text color={theme.text} bold>
						Test Strategy:
					</Text>
					<Text color={theme.text}>{selectedTask.testStrategy}</Text>
				</Box>
			)}

			{/* Controls Help */}
			<Box
				marginTop={1}
				paddingTop={1}
				borderStyle="single"
				borderColor={theme.border}
			>
				<Text color={theme.textDim}>
					Press 'e' to expand • 's' for subtasks • ↑↓ to scroll • Esc to go back
				</Text>
			</Box>
		</Box>
	);
}
