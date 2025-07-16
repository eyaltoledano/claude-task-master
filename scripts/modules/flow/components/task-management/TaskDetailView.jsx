import React from 'react';
import { Box, Text } from 'ink';
import { useTaskManagementStore } from '../../stores/task-management-store.js';

export function TaskDetailView() {
  const { selectedTaskId, tasks } = useTaskManagementStore();
  const task = tasks.find(t => t.id === selectedTaskId);

  if (!task) {
    return <Text>No task selected or found.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>{task.title}</Text>
      <Text>{task.description}</Text>
      <Text>Status: {task.status}</Text>
      <Text>Priority: {task.priority}</Text>
    </Box>
  );
} 