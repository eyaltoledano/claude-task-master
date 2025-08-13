import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../../../../shared/theme/theme.js';
import { SimpleTable } from '../../../ui/components/SimpleTable.jsx';
import { VibeKitExecutionModal } from '../../../../components/VibeKitExecutionModal.jsx';
import { Toast } from '../../../../shared/components/ui/Toast.jsx';

export function SubtaskListView({
	// State
	selectedTask,
	selectedSubtaskIndex,
	setSelectedSubtaskIndex,
	subtasksScrollOffset,
	setSubtasksScrollOffset,
	setSelectedSubtask,
	showVibeKitModal,
	setShowVibeKitModal,
	toast,
	setToast,
	VISIBLE_ROWS,

	// Actions
	setViewMode,
	cycleTaskStatus,
	handleVibeKitComplete,
	getStatusSymbol
}) {
	const theme = getTheme();

	// Handle keyboard input for subtasks view
	useInput((input, key) => {
		// Don't process keys if modals are open
		if (showVibeKitModal) {
			if (key.escape) {
				setShowVibeKitModal(false);
			}
			return;
		}

		if (key.downArrow) {
			const max = selectedTask.subtasks.length - 1;
			const newIndex = Math.min(selectedSubtaskIndex + 1, max);
			setSelectedSubtaskIndex(newIndex);
			if (newIndex >= subtasksScrollOffset + VISIBLE_ROWS) {
				setSubtasksScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (key.upArrow) {
			const newIndex = Math.max(selectedSubtaskIndex - 1, 0);
			setSelectedSubtaskIndex(newIndex);
			if (newIndex < subtasksScrollOffset) {
				setSubtasksScrollOffset(newIndex);
			}
		} else if (key.return) {
			setSelectedSubtask(selectedTask.subtasks[selectedSubtaskIndex]);
			setViewMode('subtask-detail');
		} else if (input === 't') {
			const subtask = selectedTask.subtasks[selectedSubtaskIndex];
			cycleTaskStatus({
				...subtask,
				id: `${selectedTask.id}.${subtask.id}`
			});
		} else if (key.escape) {
			setViewMode('detail');
		}
	});

	// Helper function
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

	if (!selectedTask?.subtasks?.length) {
		return (
			<Box flexDirection="column" height="100%" justifyContent="center" alignItems="center">
				<Text color={theme.textDim}>No subtasks available</Text>
				<Text color={theme.textDim} marginTop={1}>Press ESC to go back</Text>
			</Box>
		);
	}

	const visibleSubtasks = selectedTask.subtasks.slice(
		subtasksScrollOffset,
		subtasksScrollOffset + VISIBLE_ROWS
	);

	return (
		<Box key="subtasks-view" flexDirection="column" height="100%">
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
					<Text color="white">Task #{selectedTask.id}</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>Subtasks</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back to details]</Text>
			</Box>

			{/* Subtasks List */}
			<Box
				flexGrow={1}
				flexDirection="column"
				paddingLeft={1}
				paddingRight={1}
			>
				<SimpleTable
					data={visibleSubtasks.map((subtask, displayIndex) => {
						const actualIndex = displayIndex + subtasksScrollOffset;
						const isSelected = actualIndex === selectedSubtaskIndex;
						const subtaskId = `${selectedTask.id}.${subtask.id}`;

						return {
							' ': isSelected ? '→' : ' ',
							ID: subtaskId,
							Title:
								subtask.title.length > 60
									? subtask.title.substring(0, 57) + '...'
									: subtask.title,
							Status: `${getStatusSymbol(subtask.status)} ${subtask.status}`,
							_renderCell: (col, value) => {
								let color = isSelected ? theme.selectionText : theme.text;

								if (col === 'Status') {
									color = getStatusColor(subtask.status);
								}

								return (
									<Text color={color} bold={isSelected}>
										{value}
									</Text>
								);
							}
						};
					})}
					columns={[' ', 'ID', 'Title', 'Status']}
					selectedIndex={selectedSubtaskIndex - subtasksScrollOffset}
					borders={true}
				/>

				{/* Scroll indicator */}
				{selectedTask.subtasks.length > VISIBLE_ROWS && (
					<Box marginTop={1}>
						<Text color={theme.textDim}>
							{subtasksScrollOffset + 1}-
							{Math.min(
								subtasksScrollOffset + VISIBLE_ROWS,
								selectedTask.subtasks.length
							)}{' '}
							of {selectedTask.subtasks.length} subtasks
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
				<Text color={theme.text}>
					↑↓ navigate • ENTER view details • t cycle status • ESC back
				</Text>
			</Box>

			{/* Modals */}
			{showVibeKitModal && (
				<VibeKitExecutionModal
					task={selectedTask}
					subtask={selectedTask.subtasks[selectedSubtaskIndex]}
					isVisible={showVibeKitModal}
					onClose={() => setShowVibeKitModal(false)}
					onComplete={handleVibeKitComplete}
				/>
			)}

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