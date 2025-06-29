import React from 'react';
import { Box, Text } from 'ink';
import {
  useComponentTheme,
  useTerminalSize,
  useGitBranchName,
} from '../hooks/index.js';

export function TaskStats({
  tasks = [],
  filteredTasks = [],
  currentTag = 'master',
  isLoading = false,
  complexityReport = null,
  filter,
  filterMode,
  searchQuery,
}) {
  const { theme } = useComponentTheme('taskStats');
  const { maxContentWidth, isNarrow } = useTerminalSize();
  
  // Git branch information
  const { displayName: branchName, hasChanges, isGitRepo } = useGitBranchName({
    includeStatus: true,
    refreshInterval: 10000,
  });

  // Calculate task statistics
  const stats = React.useMemo(() => {
    const totalTasks = tasks.length;
    const visibleTasks = filteredTasks.length;
    
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    const priorityCounts = tasks.reduce((acc, task) => {
      if (task.priority) {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
      }
      return acc;
    }, {});

    const subtaskCounts = tasks.reduce((acc, task) => {
      if (task.subtasks && task.subtasks.length > 0) {
        acc.withSubtasks += 1;
        acc.totalSubtasks += task.subtasks.length;
        
        task.subtasks.forEach(subtask => {
          acc.subtaskStatus[subtask.status] = (acc.subtaskStatus[subtask.status] || 0) + 1;
        });
      }
      return acc;
    }, {
      withSubtasks: 0,
      totalSubtasks: 0,
      subtaskStatus: {},
    });

    const completionPercentage = totalTasks > 0 
      ? Math.round((statusCounts.done || 0) / totalTasks * 100)
      : 0;

    return {
      totalTasks,
      visibleTasks,
      statusCounts,
      priorityCounts,
      subtaskCounts,
      completionPercentage,
    };
  }, [tasks, filteredTasks]);

  const renderHeader = () => {
    return (
      <Box justifyContent="space-between" width={maxContentWidth} marginBottom={1}>
        <Box>
          <Text color={theme.accent} bold>
            📋 Task Master
          </Text>
          {currentTag && currentTag !== 'master' && (
            <>
              <Text color={theme.text.secondary}> | Tag: </Text>
              <Text color={theme.accent}>{currentTag}</Text>
            </>
          )}
        </Box>
        
        {isGitRepo && branchName && !isNarrow && (
          <Box>
            <Text color={hasChanges ? 'yellow' : 'green'}>
              🌿 {branchName}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderTaskCounts = () => {
    if (isLoading) {
      return (
        <Text color={theme.text.secondary}>
          Loading tasks...
        </Text>
      );
    }

    const { totalTasks, visibleTasks, completionPercentage } = stats;

    return (
      <Box flexDirection={isNarrow ? 'column' : 'row'} gap={isNarrow ? 0 : 2}>
        <Box>
          <Text color={theme.text.primary}>
            {visibleTasks === totalTasks ? totalTasks : `${visibleTasks}/${totalTasks}`} tasks
          </Text>
          {completionPercentage > 0 && (
            <Text color={getCompletionColor(completionPercentage)}>
              {' '}({completionPercentage}% complete)
            </Text>
          )}
        </Box>

        {searchQuery && (
          <Box>
            <Text color={theme.text.secondary}>Filtered by: "</Text>
            <Text color={theme.accent}>{searchQuery}</Text>
            <Text color={theme.text.secondary}>"</Text>
          </Box>
        )}

        {filter && filter !== 'all' && (
          <Box>
            <Text color={theme.text.secondary}>
              {filterMode === 'status' ? 'Status' : 'Priority'}: 
            </Text>
            <Text color={theme.accent}>{filter}</Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderStatusBreakdown = () => {
    if (isNarrow || isLoading) return null;

    const { statusCounts } = stats;
    const statusOrder = ['pending', 'in-progress', 'review', 'done', 'blocked', 'deferred'];
    
    return (
      <Box flexDirection="row" gap={1} marginTop={1}>
        {statusOrder.map(status => {
          const count = statusCounts[status] || 0;
          if (count === 0) return null;
          
          return (
            <Box key={status}>
              <Text color={getStatusColor(status)}>
                {getStatusSymbol(status)}
              </Text>
              <Text color={theme.text.secondary}>
                {count}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderSubtaskInfo = () => {
    if (isNarrow || isLoading) return null;

    const { subtaskCounts } = stats;
    
    if (subtaskCounts.totalSubtasks === 0) return null;

    const subtaskDone = subtaskCounts.subtaskStatus.done || 0;
    const subtaskTotal = subtaskCounts.totalSubtasks;
    const subtaskPercentage = Math.round(subtaskDone / subtaskTotal * 100);

    return (
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Subtasks: {subtaskDone}/{subtaskTotal} done ({subtaskPercentage}%)
        </Text>
        <Text color={theme.text.secondary}>
          {' '}in {subtaskCounts.withSubtasks} tasks
        </Text>
      </Box>
    );
  };

  const renderComplexityInfo = () => {
    if (isNarrow || isLoading || !complexityReport) return null;

    const highComplexityCount = complexityReport.tasks?.filter(
      task => task.score >= 8
    ).length || 0;

    if (highComplexityCount === 0) return null;

    return (
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          High complexity: 
        </Text>
        <Text color="yellow">
          {' '}{highComplexityCount} tasks
        </Text>
        <Text color={theme.text.secondary}>
          {' '}(score ≥ 8)
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width={maxContentWidth}>
      {renderHeader()}
      {renderTaskCounts()}
      {renderStatusBreakdown()}
      {renderSubtaskInfo()}
      {renderComplexityInfo()}
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

function getCompletionColor(percentage) {
  if (percentage >= 80) return 'green';
  if (percentage >= 50) return 'yellow';
  if (percentage >= 25) return 'cyan';
  return 'red';
} 