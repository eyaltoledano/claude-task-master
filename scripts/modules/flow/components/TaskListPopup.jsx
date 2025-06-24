import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { theme } from '../theme.js';

// Helper functions
const getStatusSymbol = (status) => {
  switch (status) {
    case 'done': return '✓';
    case 'in-progress': return '●';
    case 'pending': return '○';
    case 'blocked': return '⊗';
    case 'deferred': return '⊙';
    case 'cancelled': return '✗';
    default: return '?';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'done': return 'green';
    case 'in-progress': return 'blue';
    case 'pending': return 'yellow';
    case 'blocked': return 'red';
    case 'deferred': return 'gray';
    case 'cancelled': return 'red';
    default: return 'white';
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'cyan';
    default: return 'white';
  }
};

// Separate component for list view
function ListView({ tasks, onClose, onSelectTask }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const windowSize = 15;
  
  // Calculate visible tasks
  const visibleTasks = tasks.slice(scrollOffset, scrollOffset + windowSize);
  const relativeIndex = selectedIndex - scrollOffset;
  
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    
    if (key.downArrow) {
      const newIndex = Math.min(selectedIndex + 1, tasks.length - 1);
      setSelectedIndex(newIndex);
      
      // Update scroll if needed
      if (newIndex >= scrollOffset + windowSize) {
        setScrollOffset(newIndex - windowSize + 1);
      }
    } else if (key.upArrow) {
      const newIndex = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(newIndex);
      
      // Update scroll if needed
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    } else if (key.return) {
      const task = tasks[selectedIndex];
      if (task) {
        onSelectTask(task);
      }
    }
  });
  
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      width={90}
      height={20}
    >
      {/* List View Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text color={theme.accent} bold>Task List</Text>
        <Text color={theme.textDim}>
          {selectedIndex + 1}/{tasks.length} • ↑↓ navigate • enter view • esc close
        </Text>
      </Box>

      {/* Column headers */}
      <Box marginBottom={1}>
        <Box width={6}><Text color={theme.textDim} bold>ID</Text></Box>
        <Box width={40}><Text color={theme.textDim} bold>Title</Text></Box>
        <Box width={12}><Text color={theme.textDim} bold>Status</Text></Box>
        <Box width={10}><Text color={theme.textDim} bold>Priority</Text></Box>
        <Box width={15}><Text color={theme.textDim} bold>Dependencies</Text></Box>
      </Box>

      {/* Task rows */}
      <Box flexDirection="column">
        {visibleTasks.map((task, index) => {
          const isSelected = index === relativeIndex;
          const deps = task.dependencies?.join(', ') || 'None';
          
          return (
            <Box 
              key={task.id}
              backgroundColor={isSelected ? '#1a1a1a' : undefined}
            >
              <Box width={6}>
                <Text color={isSelected ? 'white' : theme.text}>
                  {task.id}
                </Text>
              </Box>
              <Box width={40}>
                <Text color={isSelected ? 'white' : theme.text}>
                  {task.title.length > 37 ? task.title.substring(0, 34) + '...' : task.title}
                </Text>
              </Box>
              <Box width={12}>
                <Text color={getStatusColor(task.status)}>
                  {getStatusSymbol(task.status)} {task.status}
                </Text>
              </Box>
              <Box width={10}>
                <Text color={getPriorityColor(task.priority)}>
                  {task.priority}
                </Text>
              </Box>
              <Box width={15}>
                <Text color={theme.textDim}>
                  {deps.length > 12 ? deps.substring(0, 9) + '...' : deps}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Scroll indicator */}
      {tasks.length > windowSize && (
        <Box marginTop={1}>
          <Text color={theme.textDim}>
            {scrollOffset > 0 && '↑ '} 
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + windowSize, tasks.length)} of {tasks.length}
            {scrollOffset + windowSize < tasks.length && ' ↓'}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// Separate component for detail view
function DetailView({ task, onBack }) {
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
  });
  
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      width={80}
      maxHeight={30}
    >
      {/* Detail View Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text color={theme.accent} bold>Task Details</Text>
        <Text color={theme.textDim}>esc back to list</Text>
      </Box>

      {task && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.textDim}>ID: </Text>
            <Text color="white">{task.id}</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.textDim}>Title: </Text>
            <Text color="white" bold>{task.title}</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.textDim}>Status: </Text>
            <Text color={getStatusColor(task.status)}>
              {getStatusSymbol(task.status)} {task.status}
            </Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.textDim}>Priority: </Text>
            <Text color={getPriorityColor(task.priority)}>
              {task.priority}
            </Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color={theme.textDim}>Dependencies: </Text>
            <Text color="white">
              {task.dependencies?.join(', ') || 'None'}
            </Text>
          </Box>
          
          {task.description && (
            <Box marginBottom={1} flexDirection="column">
              <Text color={theme.textDim}>Description:</Text>
              <Box marginLeft={2}>
                <Text color="white">{task.description}</Text>
              </Box>
            </Box>
          )}
          
          {task.details && (
            <Box marginBottom={1} flexDirection="column">
              <Text color={theme.textDim}>Details:</Text>
              <Box marginLeft={2} width={70}>
                <Text color="white" wrap="wrap">{task.details}</Text>
              </Box>
            </Box>
          )}
          
          {task.subtasks && task.subtasks.length > 0 && (
            <Box flexDirection="column">
              <Text color={theme.textDim}>Subtasks ({task.subtasks.length}):</Text>
              <Box marginLeft={2} flexDirection="column">
                {task.subtasks.slice(0, 5).map(subtask => (
                  <Box key={subtask.id}>
                    <Text color={getStatusColor(subtask.status)}>
                      {getStatusSymbol(subtask.status)} [{subtask.id}] {subtask.title}
                    </Text>
                  </Box>
                ))}
                {task.subtasks.length > 5 && (
                  <Text color={theme.textDim}>... and {task.subtasks.length - 5} more</Text>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export function TaskListPopup({ tasks, onClose, onSelectTask }) {
  const [viewMode, setViewMode] = useState('list');
  const [selectedTask, setSelectedTask] = useState(null);
  
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setViewMode('detail');
  };
  
  const handleBack = () => {
    setViewMode('list');
    setSelectedTask(null);
  };
  
  return (
    <Box
      width="100%"
      height="100%"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      {viewMode === 'list' ? (
        <ListView 
          key="list-view"
          tasks={tasks}
          onClose={onClose}
          onSelectTask={handleSelectTask}
        />
      ) : (
        <DetailView
          key="detail-view"
          task={selectedTask}
          onBack={handleBack}
        />
      )}
    </Box>
  );
} 