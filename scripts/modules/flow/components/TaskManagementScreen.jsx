import React, { useState, useEffect, useMemo } from 'react';
import { Box } from 'ink';
import { flushSync } from 'react-dom';
import { useAppContext } from '../index.jsx';
import { getTheme } from '../theme.js';
import {
  useTerminalSize,
  useStateAndRef,
  useKeypress,
  usePhraseCycler,
  useConsoleMessages,
  PhraseCollections,
} from '../hooks/index.js';

// New modular components
import { TaskStats } from './TaskStats.jsx';
import { TaskFilters } from './TaskFilters.jsx';
import { TaskList } from './TaskList.jsx';
import { TaskDetails } from './TaskDetails.jsx';
import { TaskActions } from './TaskActions.jsx';

// Existing modal components
import { Toast } from './Toast.jsx';
import { ExpandModal } from './ExpandModal.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { WorktreeBranchConflictModal } from './WorktreeBranchConflictModal.jsx';
import { StreamingModal } from './StreamingModal.jsx';
import { streamingStateManager } from '../streaming/StreamingStateManager.js';

export function TaskManagementScreen() {
  const {
    backend,
    tasks,
    reloadTasks,
    setCurrentScreen,
    currentTag,
    navigationData
  } = useAppContext();

  // Terminal-aware state
  const { maxContentWidth, availableHeight, isNarrow } = useTerminalSize();
  
  // Performance-optimized state using new hooks
  const [selectedIndex, setSelectedIndex, selectedIndexRef] = useStateAndRef(0);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [viewMode, setViewMode] = useState('list'); // list, detail, subtasks, subtask-detail
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSubtask, setSelectedSubtask] = useState(null);

  // Filter state
  const [filter, setFilter] = useState('all');
  const [filterMode, setFilterMode] = useState('status');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // UI state
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detailScrollOffset, setDetailScrollOffset] = useState(0);
  const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState(0);
  const [subtasksScrollOffset, setSubtasksScrollOffset] = useState(0);

  // Modal and action state
  const [showExpandOptions, setShowExpandOptions] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState(null);
  const [toast, setToast] = useState(null);

  // Claude and worktree state
  const [isLaunchingClaude, setIsLaunchingClaude] = useState(false);
  const [showClaudeLauncherModal, setShowClaudeLauncherModal] = useState(false);
  const [claudeWorktree, setClaudeWorktree] = useState(null);
  const [showBranchConflictModal, setShowBranchConflictModal] = useState(false);
  const [branchConflictInfo, setBranchConflictInfo] = useState(null);
  const [showStreamingModal, setShowStreamingModal] = useState(false);
  const [taskWorktrees, setTaskWorktrees] = useState([]);
  const [subtaskWorktrees, setSubtaskWorktrees] = useState(new Map());

  // Complexity analysis state
  const [complexityReport, setComplexityReport] = useState(null);
  const [loadingComplexity, setLoadingComplexity] = useState(false);

  // Constants
  const VISIBLE_ROWS = Math.min(15, Math.floor(availableHeight * 0.6));
  const DETAIL_VISIBLE_ROWS = Math.min(20, Math.floor(availableHeight * 0.8));

  // Console output capture for debugging
  const { messages: consoleMessages } = useConsoleMessages({
    maxMessages: 50,
    captureTypes: ['error', 'warn'],
  });

  // Loading phrases
  const { currentPhrase: loadingPhrase } = usePhraseCycler(PhraseCollections.loading, {
    paused: !loadingComplexity,
  });

  // Filter tasks based on current filter and search
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Apply status filter
      if (filterMode === 'status' && filter !== 'all' && task.status !== filter) {
        return false;
      }

      // Apply priority filter
      if (
        filterMode === 'priority' &&
        priorityFilter !== 'all' &&
        task.priority !== priorityFilter
      ) {
        return false;
      }

      // Apply search filter
      if (
        searchQuery &&
        !task.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [tasks, filter, filterMode, priorityFilter, searchQuery]);

  // Build flat list of visible tasks (including expanded subtasks)
  const visibleTasks = useMemo(() => {
    const flatTasks = [];
    filteredTasks.forEach((task) => {
      flatTasks.push({ ...task, level: 0 });
      if (expandedTasks.has(task.id) && task.subtasks) {
        task.subtasks.forEach((subtask) => {
          flatTasks.push({ ...subtask, level: 1, parentId: task.id });
        });
      }
    });
    return flatTasks;
  }, [filteredTasks, expandedTasks]);

  // Calculate task counts for filters
  const taskCounts = useMemo(() => {
    const counts = {
      all: tasks.length,
      pending: 0,
      'in-progress': 0,
      done: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    tasks.forEach(task => {
      if (task.status) counts[task.status] = (counts[task.status] || 0) + 1;
      if (task.priority) counts[task.priority] = (counts[task.priority] || 0) + 1;
    });

    return counts;
  }, [tasks]);

  // Navigation keyboard handling
  useKeypress({
    escape: () => {
      if (isExpanding) return; // ESC disabled during expansion
      
      if (viewMode === 'subtask-detail') {
        flushSync(() => {
          setViewMode('subtasks');
          setSelectedSubtask(null);
        });
      } else if (viewMode === 'subtasks') {
        flushSync(() => {
          setViewMode('detail');
          setSelectedSubtaskIndex(0);
          setSubtasksScrollOffset(0);
        });
      } else if (viewMode === 'detail') {
        flushSync(() => {
          setViewMode('list');
          setSelectedTask(null);
          setShowExpandOptions(false);
          setDetailScrollOffset(0);
        });
      } else {
        setCurrentScreen('welcome');
      }
    },
    'ctrl+x': () => {
      if (isExpanding) {
        setIsExpanding(false);
        showToast('Expansion cancelled', 'warning');
      }
    },
    down: () => {
      if (viewMode === 'list') {
        const newIndex = Math.min(selectedIndexRef.current + 1, visibleTasks.length - 1);
        setSelectedIndex(newIndex);
        adjustScrollIfNeeded(newIndex, 'down');
      } else if (viewMode === 'subtasks') {
        const maxIndex = selectedTask.subtasks.length - 1;
        const newIndex = Math.min(selectedSubtaskIndex + 1, maxIndex);
        setSelectedSubtaskIndex(newIndex);
        adjustSubtaskScrollIfNeeded(newIndex, 'down');
      }
    },
    up: () => {
      if (viewMode === 'list') {
        const newIndex = Math.max(selectedIndexRef.current - 1, 0);
        setSelectedIndex(newIndex);
        adjustScrollIfNeeded(newIndex, 'up');
      } else if (viewMode === 'subtasks') {
        const newIndex = Math.max(selectedSubtaskIndex - 1, 0);
        setSelectedSubtaskIndex(newIndex);
        adjustSubtaskScrollIfNeeded(newIndex, 'up');
      }
    },
    pageDown: () => {
      if (viewMode === 'list') {
        const newIndex = Math.min(selectedIndexRef.current + VISIBLE_ROWS, visibleTasks.length - 1);
        setSelectedIndex(newIndex);
        setScrollOffset(Math.min(newIndex - VISIBLE_ROWS + 1, Math.max(0, visibleTasks.length - VISIBLE_ROWS)));
      }
    },
    pageUp: () => {
      if (viewMode === 'list') {
        const newIndex = Math.max(selectedIndexRef.current - VISIBLE_ROWS, 0);
        setSelectedIndex(newIndex);
        setScrollOffset(Math.max(0, newIndex));
      }
    },
    return: () => {
      if (viewMode === 'list') {
        const task = visibleTasks[selectedIndexRef.current];
        if (task) showTaskDetail(task);
      } else if (viewMode === 'subtasks') {
        const subtask = selectedTask.subtasks[selectedSubtaskIndex];
        if (subtask) {
          setSelectedSubtask(subtask);
          setViewMode('subtask-detail');
          setDetailScrollOffset(0);
        }
      }
    },
    's': () => {
      if (viewMode === 'detail' && selectedTask?.subtasks?.length > 0) {
        setViewMode('subtasks');
        setSelectedSubtaskIndex(0);
        setSubtasksScrollOffset(0);
      }
    },
  }, { 
    isActive: !isSearching && !showStreamingModal && !showExpandOptions && !isExpanding 
  });

  // Scroll adjustment helpers
  const adjustScrollIfNeeded = (newIndex, direction) => {
    if (direction === 'down' && newIndex >= scrollOffset + VISIBLE_ROWS) {
      setScrollOffset(newIndex - VISIBLE_ROWS + 1);
    } else if (direction === 'up' && newIndex < scrollOffset) {
      setScrollOffset(newIndex);
    }
  };

  const adjustSubtaskScrollIfNeeded = (newIndex, direction) => {
    if (direction === 'down' && newIndex >= subtasksScrollOffset + VISIBLE_ROWS) {
      setSubtasksScrollOffset(newIndex - VISIBLE_ROWS + 1);
    } else if (direction === 'up' && newIndex < subtasksScrollOffset) {
      setSubtasksScrollOffset(newIndex);
    }
  };

  // Load tasks and complexity report on mount
  useEffect(() => {
    reloadTasks();
    loadComplexityReport();
  }, [reloadTasks, currentTag]);

  // Load complexity report
  const loadComplexityReport = async () => {
    setLoadingComplexity(true);
    try {
      const report = await backend.getComplexityReport(currentTag);
      setComplexityReport(report);
    } catch (error) {
      console.debug('No complexity report available:', error.message);
      setComplexityReport(null);
    } finally {
      setLoadingComplexity(false);
    }
  };

  // Handle navigation data
  useEffect(() => {
    if (navigationData?.selectedTaskId && tasks.length > 0) {
      const taskIndex = tasks.findIndex(
        (task) => task.id === navigationData.selectedTaskId
      );
      if (taskIndex !== -1) {
        setSelectedIndex(taskIndex);
        const task = tasks[taskIndex];

        showTaskDetail(task)
          .then((fullTask) => {
            setSelectedTask(fullTask);

            if (navigationData.selectedSubtaskId && fullTask.subtasks) {
              const subtaskIndex = fullTask.subtasks.findIndex(
                (subtask) =>
                  `${fullTask.id}.${subtask.id}` ===
                  navigationData.selectedSubtaskId
              );
              if (subtaskIndex !== -1) {
                setSelectedSubtaskIndex(subtaskIndex);
                setSelectedSubtask(fullTask.subtasks[subtaskIndex]);
                setViewMode(navigationData.viewMode || 'subtask-detail');
                setDetailScrollOffset(0);
              } else {
                setViewMode('detail');
                setDetailScrollOffset(0);
              }
            } else {
              setViewMode('detail');
              setDetailScrollOffset(0);
            }
          })
          .catch((error) => {
            console.error('Failed to navigate to task:', error);
            showToast('Failed to load task details', 'error');
          });
      }
    }
  }, [navigationData, tasks]);

  // Task operations
  const showTaskDetail = async (task) => {
    try {
      const fullTask = await backend.getTask(task.id);
      setSelectedTask(fullTask);

      // Load worktrees
      try {
        const worktrees = await backend.getTaskWorktrees(task.id);
        setTaskWorktrees(worktrees || []);
      } catch (error) {
        console.error('Failed to load task worktrees:', error);
        setTaskWorktrees([]);
      }

      setViewMode('detail');
      setDetailScrollOffset(0);

      // Load subtask worktrees
      if (fullTask.subtasks && fullTask.subtasks.length > 0) {
        const subtaskWorktreePromises = fullTask.subtasks.map(
          async (subtask) => {
            const subtaskId = `${fullTask.id}.${subtask.id}`;
            try {
              const subtaskWorktrees = await backend.getTaskWorktrees(subtaskId);
              return [subtaskId, subtaskWorktrees || []];
            } catch (error) {
              console.error(`Failed to load worktrees for subtask ${subtaskId}:`, error);
              return [subtaskId, []];
            }
          }
        );

        const subtaskWorktreeResults = await Promise.allSettled(subtaskWorktreePromises);
        const newSubtaskWorktrees = new Map();
        
        subtaskWorktreeResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [subtaskId, worktrees] = result.value;
            newSubtaskWorktrees.set(subtaskId, worktrees);
          }
        });
        
        setSubtaskWorktrees(newSubtaskWorktrees);
      }

      return fullTask;
    } catch (error) {
      console.error('Failed to load task details:', error);
      showToast('Failed to load task details', 'error');
      throw error;
    }
  };

  const expandTask = async (options) => {
    if (!selectedTask) return;

    setIsExpanding(true);
    setExpandError(null);

    try {
      await backend.expandTask(selectedTask.id, {
        force: options.forceRegenerate,
        research: options.useResearch,
        num: options.numSubtasks,
      });

      // Reload the task to get updated subtasks
      const updatedTask = await backend.getTask(selectedTask.id);
      setSelectedTask(updatedTask);
      
      showToast(`Generated ${updatedTask.subtasks?.length || 0} subtasks`, 'success');
    } catch (error) {
      console.error('Failed to expand task:', error);
      setExpandError(error.message);
      showToast('Failed to expand task', 'error');
    } finally {
      setIsExpanding(false);
      setShowExpandOptions(false);
    }
  };

  const cycleTaskStatus = async (task) => {
    const statusOrder = ['pending', 'in-progress', 'review', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
      await backend.setTaskStatus(task.id, nextStatus);
      await reloadTasks();
      
      // Update selected task if it's the one being modified
      if (selectedTask && selectedTask.id === task.id) {
        const updatedTask = await backend.getTask(task.id);
        setSelectedTask(updatedTask);
      }
      
      showToast(`Task ${task.id} status: ${nextStatus}`, 'success');
    } catch (error) {
      console.error('Failed to update task status:', error);
      showToast('Failed to update task status', 'error');
    }
  };

  // Modal task data
  const modalTaskData = useMemo(() => {
    if (!selectedTask || !selectedSubtask) return null;
    return [
      {
        id: `${selectedTask.id}.${selectedSubtask.id}`,
        title: selectedSubtask.title,
        description: selectedSubtask.description,
        details: selectedSubtask.details,
        testStrategy: selectedSubtask.testStrategy,
        status: selectedSubtask.status,
        dependencies: selectedSubtask.dependencies,
        parentId: selectedTask.id,
        parentTitle: selectedTask.title
      }
    ];
  }, [selectedTask, selectedSubtask]);

  // Helper functions
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleDetailScroll = (delta) => {
    setDetailScrollOffset(prev => Math.max(0, prev + delta));
  };

  // Event handlers for components
  const handleSelectTask = (task, index) => {
    setSelectedIndex(index);
  };

  const handleExpandTask = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleTaskExpand = () => {
    setShowExpandOptions(true);
  };

  // Render main content based on view mode
  const renderMainContent = () => {
    if (viewMode === 'list') {
      return (
        <TaskList
          tasks={filteredTasks}
          selectedIndex={selectedIndex}
          onSelectTask={handleSelectTask}
          onExpandTask={handleExpandTask}
          expandedTasks={expandedTasks}
          scrollOffset={scrollOffset}
          visibleRows={VISIBLE_ROWS}
          compact={isNarrow}
        />
      );
    }

    if (viewMode === 'detail' || viewMode === 'subtask-detail') {
      return (
        <TaskDetails
          task={selectedTask}
          subtask={viewMode === 'subtask-detail' ? selectedSubtask : null}
          viewMode={viewMode}
          detailScrollOffset={detailScrollOffset}
          maxVisibleRows={DETAIL_VISIBLE_ROWS}
          onScroll={handleDetailScroll}
        />
      );
    }

    if (viewMode === 'subtasks' && selectedTask?.subtasks) {
      return (
        <TaskList
          tasks={selectedTask.subtasks}
          selectedIndex={selectedSubtaskIndex}
          onSelectTask={(subtask, index) => setSelectedSubtaskIndex(index)}
          expandedTasks={new Set()} // Subtasks don't expand
          scrollOffset={subtasksScrollOffset}
          visibleRows={VISIBLE_ROWS}
          compact={isNarrow}
        />
      );
    }

    return null;
  };

  return (
    <Box flexDirection="column" width={maxContentWidth} height={availableHeight}>
      {/* Header with stats */}
      <TaskStats
        tasks={tasks}
        filteredTasks={filteredTasks}
        currentTag={currentTag}
        isLoading={loadingComplexity}
        complexityReport={complexityReport}
        filter={filter}
        filterMode={filterMode}
        searchQuery={searchQuery}
      />

      {/* Filters (only in list view) */}
      {viewMode === 'list' && (
        <TaskFilters
          filter={filter}
          filterMode={filterMode}
          priorityFilter={priorityFilter}
          searchQuery={searchQuery}
          isSearching={isSearching}
          onFilterChange={setFilter}
          onFilterModeChange={setFilterMode}
          onPriorityFilterChange={setPriorityFilter}
          onSearchChange={setSearchQuery}
          onSearchStart={() => setIsSearching(true)}
          onSearchEnd={() => setIsSearching(false)}
          taskCounts={taskCounts}
        />
      )}

      {/* Main content area */}
      <Box flexGrow={1}>
        {renderMainContent()}
      </Box>

      {/* Actions panel (when not in list view) */}
      {viewMode !== 'list' && (
        <TaskActions
          selectedTask={selectedTask}
          selectedSubtask={selectedSubtask}
          viewMode={viewMode}
          isExpanding={isExpanding}
          onExpandTask={handleTaskExpand}
          onCycleStatus={cycleTaskStatus}
          onLaunchClaude={() => {}} // TODO: Implement
          onWorkOnSubtask={() => {}} // TODO: Implement
          onViewClaudeSessions={() => {}} // TODO: Implement
          onGoToWorktree={() => {}} // TODO: Implement
          taskWorktrees={taskWorktrees}
          subtaskWorktrees={subtaskWorktrees}
        />
      )}

      {/* Modals */}
      {showExpandOptions && (
        <ExpandModal
          task={modalTaskData}
          onClose={() => setShowExpandOptions(false)}
          onExpand={expandTask}
          isExpanding={isExpanding}
          expandError={expandError}
        />
      )}

      {showStreamingModal && (
        <StreamingModal
          onClose={() => setShowStreamingModal(false)}
          streamingManager={streamingStateManager}
        />
      )}

      {showClaudeLauncherModal && (
        <ClaudeWorktreeLauncherModal
          isVisible={showClaudeLauncherModal}
          onClose={() => setShowClaudeLauncherModal(false)}
          onSuccess={() => {}} // TODO: Implement
          worktreePath={claudeWorktree?.path}
        />
      )}

      {showBranchConflictModal && branchConflictInfo && (
        <WorktreeBranchConflictModal
          isVisible={showBranchConflictModal}
          conflictInfo={branchConflictInfo}
          onDecision={() => {}} // TODO: Implement
          onClose={() => setShowBranchConflictModal(false)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Loading spinner for complex operations */}
      {loadingComplexity && (
        <LoadingSpinner message={loadingPhrase} />
      )}
    </Box>
  );
} 