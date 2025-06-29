import React from 'react';
import { Box, Text } from 'ink';
import {
  useComponentTheme,
  useTerminalSize,
  usePhraseCycler,
  PhraseCollections,
  useKeypress,
} from '../hooks/index.js';

export function TaskDetails({
  task,
  subtask = null,
  viewMode,
  detailScrollOffset = 0,
  maxVisibleRows = 20,
  isLoading = false,
  onScroll,
}) {
  const { theme } = useComponentTheme('taskDetails');
  const { maxContentWidth, isNarrow, availableHeight } = useTerminalSize();
  
  // Loading state with cycling phrases
  const { currentPhrase } = usePhraseCycler(PhraseCollections.loading, {
    paused: !isLoading,
  });

  // Scroll handling for detail view
  useKeypress({
    up: () => onScroll && onScroll(-1),
    down: () => onScroll && onScroll(1),
    pageUp: () => onScroll && onScroll(-10),
    pageDown: () => onScroll && onScroll(10),
  }, { 
    isActive: (viewMode === 'detail' || viewMode === 'subtask-detail') && !isLoading 
  });

  if (isLoading) {
    return (
      <Box justifyContent="center" width={maxContentWidth}>
        <Text color={theme.text.secondary}>{currentPhrase}</Text>
      </Box>
    );
  }

  if (!task) {
    return (
      <Box justifyContent="center" width={maxContentWidth}>
        <Text color={theme.text.secondary}>No task selected</Text>
      </Box>
    );
  }

  const currentItem = subtask || task;
  const isSubtaskView = !!subtask;

  const renderHeader = () => {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {/* Task/Subtask ID and Title */}
        <Box>
          <Text color={theme.accent} bold>
            {isSubtaskView ? `${task.id}.${subtask.id}` : task.id}
          </Text>
          <Text color={theme.text.primary} bold>
            {' '}{currentItem.title}
          </Text>
        </Box>

        {/* Parent task info for subtasks */}
        {isSubtaskView && (
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>Parent: </Text>
            <Text color={theme.text.primary}>{task.id} - {task.title}</Text>
          </Box>
        )}

        {/* Status and Priority */}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Status: </Text>
          <Text color={getStatusColor(currentItem.status)}>
            {getStatusSymbol(currentItem.status)} {currentItem.status}
          </Text>
          
          {currentItem.priority && (
            <>
              <Text color={theme.text.secondary}> | Priority: </Text>
              <Text color={getPriorityColor(currentItem.priority)}>
                {currentItem.priority}
              </Text>
            </>
          )}
        </Box>

        {/* Dependencies */}
        {currentItem.dependencies && currentItem.dependencies.length > 0 && (
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>Dependencies: </Text>
            <Text color={theme.text.primary}>
              {formatDependencies(currentItem.dependencies)}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderDescription = () => {
    if (!currentItem.description) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text.primary} bold>Description:</Text>
        <Text color={theme.text.primary}>
          {currentItem.description}
        </Text>
      </Box>
    );
  };

  const renderDetails = () => {
    if (!currentItem.details) return null;

    // Split details into lines and handle scrolling
    const detailLines = currentItem.details.split('\n');
    const visibleLines = detailLines.slice(
      detailScrollOffset,
      detailScrollOffset + maxVisibleRows
    );

    const hasMoreAbove = detailScrollOffset > 0;
    const hasMoreBelow = detailScrollOffset + maxVisibleRows < detailLines.length;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text.primary} bold>Implementation Details:</Text>
        
        {hasMoreAbove && (
          <Text color={theme.text.tertiary} dimColor>
            ▲ {detailScrollOffset} lines above...
          </Text>
        )}

        {visibleLines.map((line, index) => (
          <Text key={`line-${detailScrollOffset + index}-${line.slice(0, 10)}`} color={theme.text.primary}>
            {line || ' '} {/* Handle empty lines */}
          </Text>
        ))}

        {hasMoreBelow && (
          <Text color={theme.text.tertiary} dimColor>
            ▼ {detailLines.length - (detailScrollOffset + maxVisibleRows)} lines below...
          </Text>
        )}

        {/* Scroll indicators */}
        {(hasMoreAbove || hasMoreBelow) && !isNarrow && (
          <Text color={theme.text.tertiary} dimColor>
            Use ↑/↓ to scroll, Page Up/Down for faster scrolling
          </Text>
        )}
      </Box>
    );
  };

  const renderTestStrategy = () => {
    if (!currentItem.testStrategy) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text.primary} bold>Test Strategy:</Text>
        <Text color={theme.text.primary}>
          {currentItem.testStrategy}
        </Text>
      </Box>
    );
  };

  const renderSubtasks = () => {
    if (isSubtaskView || !task.subtasks || task.subtasks.length === 0) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text.primary} bold>
          Subtasks ({task.subtasks.length}):
        </Text>
        {task.subtasks.slice(0, 10).map(subtask => (
          <Box key={subtask.id}>
            <Text color={getStatusColor(subtask.status)}>
              {getStatusSymbol(subtask.status)}
            </Text>
            <Text color={theme.text.secondary}>
              {' '}{task.id}.{subtask.id}
            </Text>
            <Text color={theme.text.primary}>
              {' '}{subtask.title}
            </Text>
          </Box>
        ))}
        {task.subtasks.length > 10 && (
          <Text color={theme.text.tertiary}>
            ... and {task.subtasks.length - 10} more subtasks
          </Text>
        )}
        {!isNarrow && (
          <Text color={theme.text.secondary} marginTop={1}>
            Press [s] to view subtasks list
          </Text>
        )}
      </Box>
    );
  };

  const renderMetadata = () => {
    const metadata = [];

    // Add creation date if available
    if (currentItem.createdAt) {
      metadata.push(`Created: ${new Date(currentItem.createdAt).toLocaleDateString()}`);
    }

    // Add last updated if available
    if (currentItem.updatedAt) {
      metadata.push(`Updated: ${new Date(currentItem.updatedAt).toLocaleDateString()}`);
    }

    // Add estimated duration if available
    if (currentItem.estimatedHours) {
      metadata.push(`Estimated: ${currentItem.estimatedHours}h`);
    }

    if (metadata.length === 0) return null;

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text.tertiary} dimColor>
          {metadata.join(' | ')}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width={maxContentWidth}>
      {renderHeader()}
      {renderDescription()}
      {renderDetails()}
      {renderTestStrategy()}
      {renderSubtasks()}
      {renderMetadata()}
    </Box>
  );
}

function getStatusSymbol(status) {
  const symbols = {
    'done': '✅',
    'in-progress': '⏳',
    'pending': '⏱️',
    'blocked': '❌',
    'deferred': '⏸️',
    'review': '👀',
    'cancelled': '🚫',
  };
  return symbols[status] || '•';
}

function getStatusColor(status) {
  const colors = {
    'done': 'green',
    'in-progress': 'blue',
    'pending': 'yellow',
    'blocked': 'red',
    'deferred': 'gray',
    'review': 'cyan',
    'cancelled': 'gray',
  };
  return colors[status] || 'white';
}

function getPriorityColor(priority) {
  const colors = {
    'high': 'red',
    'medium': 'yellow',
    'low': 'green',
  };
  return colors[priority] || 'white';
}

function formatDependencies(dependencies) {
  if (!dependencies || dependencies.length === 0) return 'None';
  return dependencies.join(', ');
} 