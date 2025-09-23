import React from 'react';
import { TaskMasterKanban } from './TaskMasterKanban';
import TaskDetailsView from '@/components/TaskDetailsView';
import { ConfigView } from '@/components/ConfigView';
import { useVSCodeContext } from '../contexts/VSCodeContext';

export const AppContent: React.FC = () => {
	const { state, dispatch, sendMessage } = useVSCodeContext();

	if (state.currentView === 'config') {
		return (
			<ConfigView
				sendMessage={sendMessage}
				onNavigateBack={() => dispatch({ type: 'NAVIGATE_TO_KANBAN' })}
			/>
		);
	}

	if (state.currentView === 'task-details' && state.selectedTaskId) {
		return (
			<TaskDetailsView
				taskId={state.selectedTaskId}
				onNavigateBack={() => dispatch({ type: 'NAVIGATE_TO_KANBAN' })}
				onNavigateToTask={(taskId: string) =>
					dispatch({ type: 'NAVIGATE_TO_TASK', payload: taskId })
				}
			/>
		);
	}

	// Default to Kanban view
	return <TaskMasterKanban />;
};
