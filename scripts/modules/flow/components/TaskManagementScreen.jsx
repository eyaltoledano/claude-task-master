import React from 'react';
import { useTaskManagementStore } from '../stores/task-management-store.js';
import { useTaskManager } from '../hooks/useTaskManager.js';
import { useTaskInput } from '../hooks/useTaskInput.js';
import { Box, Text } from 'ink';
import { TaskListView } from './task-management/TaskListView.jsx';
import { TaskDetailView } from './task-management/TaskDetailView.jsx';
// import { SubtaskDetailView } from './task-management/SubtaskDetailView.jsx';

export function TaskManagementScreen() {
  const { viewMode, isLoading } = useTaskManagementStore();
  
  // Initialize hooks
  useTaskManager();
  useTaskInput();

  if (isLoading) {
    return <Text>Loading tasks...</Text>;
  }

  return (
    <Box flexDirection="column">
      {viewMode === 'list' && <TaskListView />}
      {viewMode === 'detail' && <TaskDetailView />}
      {/* {viewMode === 'subtasks' && <TaskDetailView />} // Or a combined view */}
      {/* {viewMode === 'subtask-detail' && <SubtaskDetailView />} */}
    </Box>
  );
} 