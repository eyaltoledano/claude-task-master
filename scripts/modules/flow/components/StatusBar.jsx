import React from 'react';
import { Box, Text } from 'ink';

/**
 * StatusBar - Renders the bottom status and help information
 */
export function StatusBar({
	viewMode,
	currentTag,
	visibleTasksCount,
	totalTasksCount,
	selectedIndex,
	filter,
	searchQuery,
	isExpanding,
	theme
}) {
	// Build status text based on current view
	const getStatusText = () => {
		if (viewMode === 'list') {
			let status = `Tasks: ${visibleTasksCount}/${totalTasksCount}`;
			
			if (filter !== 'all') {
				status += ` (filtered: ${filter})`;
			}
			
			if (searchQuery) {
				status += ` (search: "${searchQuery}")`;
			}
			
			if (visibleTasksCount > 0) {
				status += ` | Selected: ${selectedIndex + 1}`;
			}
			
			return status;
		}
		
		if (viewMode === 'detail') {
			return 'Task Detail View';
		}
		
		if (viewMode === 'subtasks') {
			return 'Subtasks View';
		}
		
		if (viewMode === 'subtask-detail') {
			return 'Subtask Detail View';
		}
		
		return 'Unknown View';
	};

	// Build help text based on current view
	const getHelpText = () => {
		if (isExpanding) {
			return 'Expanding task... Press Ctrl+X to cancel';
		}
		
		if (viewMode === 'list') {
			return '↑↓ Navigate • Enter Details • t Status • f Filter • / Search • Esc Menu';
		}
		
		if (viewMode === 'detail') {
			return 'e Expand • s Subtasks • ↑↓ Scroll • Esc Back';
		}
		
		if (viewMode === 'subtasks') {
			return '↑↓ Navigate • Enter Details • t Status • Esc Back';
		}
		
		if (viewMode === 'subtask-detail') {
			return 'w Work • c Claude • v Sessions • g Worktree • ↑↓ Scroll • Esc Back';
		}
		
		return 'Press Esc to go back';
	};

	return (
		<Box
			borderStyle="single"
			borderColor={theme.border}
			paddingX={1}
			marginTop={1}
		>
			<Box flexDirection="row" justifyContent="space-between" width="100%">
				{/* Left side - Status */}
				<Box flexDirection="row" alignItems="center">
					<Text color={theme.text} bold>
						[{currentTag}]
					</Text>
					<Text color={theme.textDim}> | </Text>
					<Text color={theme.text}>
						{getStatusText()}
					</Text>
				</Box>

				{/* Right side - Help */}
				<Box>
					<Text color={theme.textDim}>
						{getHelpText()}
					</Text>
				</Box>
			</Box>
		</Box>
	);
} 