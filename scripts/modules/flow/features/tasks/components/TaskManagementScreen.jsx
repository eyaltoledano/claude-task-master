import React from 'react';
import { Box, Text } from 'ink';
import { useTaskScreenState } from './TaskManagementScreen/hooks/useTaskScreenState.js';
import { TaskListView } from './TaskManagementScreen/TaskListView.jsx';
import { TaskDetailView } from './TaskManagementScreen/TaskDetailView.jsx';
import { SubtaskListView } from './TaskManagementScreen/SubtaskListView.jsx';
import { SubtaskDetailView } from './TaskManagementScreen/SubtaskDetailView.jsx';
import { StreamingModal } from '../../../components/StreamingModal.jsx';
import { getTheme } from '../../../shared/theme/theme.js';

export function TaskManagementScreen() {
	// Get all state and actions from the custom hook
	const state = useTaskScreenState();

	// Safety check - don't render if backend is not available
	if (!state.backend) {
		const theme = getTheme();
		return (
			<Box
				flexDirection="column"
				height="100%"
				justifyContent="center"
				alignItems="center"
			>
				<Text color="yellow">⚠️ Backend service is not available</Text>
				<Text color="gray">Please wait for initialization to complete...</Text>
			</Box>
		);
	}

	// Route to the appropriate view component based on viewMode
	const renderView = () => {
		switch (state.viewMode) {
			case 'detail':
				return <TaskDetailView {...state} />;
			
			case 'subtasks':
				return <SubtaskListView {...state} />;
			
			case 'subtask-detail':
				return <SubtaskDetailView {...state} />;
			
			default:
				return <TaskListView {...state} />;
		}
	};

	return (
		<>
			{renderView()}
			
			{/* Global Streaming Modal */}
			{state.showStreamingModal && (
				<StreamingModal
					isVisible={state.showStreamingModal}
					onClose={() => state.setShowStreamingModal(false)}
				/>
			)}
		</>
	);
} 