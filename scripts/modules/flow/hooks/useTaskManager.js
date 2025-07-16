import { useEffect, useCallback } from 'react';
import { useAppContext } from '../app/index-root.jsx';
import { useTaskManagementStore } from '../stores/task-management-store.js';
import { useUIStore } from '../stores/ui-store.js';

export const useTaskManager = () => {
  const { backend, currentTag } = useAppContext();
  const { showNotification } = useUIStore();
  const {
    setTasks,
    setSubtasks,
    setComplexityReport,
    setTaskWorktrees,
    setSubtaskWorktrees,
    setIsLoading,
    setIsExpanding,
    setViewMode,
    setSelectedTaskId,
    setSelectedSubtaskId,
    // Get other state and setters from the store as needed
  } = useTaskManagementStore();

  const reloadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const tasks = await backend.getTasks(currentTag);
      setTasks(tasks);
    } catch (error) {
      showNotification(`Failed to load tasks: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [backend, currentTag, setTasks, setIsLoading, showNotification]);

  const getTaskDetails = useCallback(async (taskId) => {
    try {
      const fullTask = await backend.getTask(taskId);
      setSelectedTaskId(fullTask.id);
      // Here you can set more details to the store if needed
      
      const worktrees = await backend.getTaskWorktrees(taskId);
      setTaskWorktrees(worktrees || []);
      
      if (fullTask.subtasks && fullTask.subtasks.length > 0) {
        const subtaskWorktreePromises = fullTask.subtasks.map(async (subtask) => {
          const subtaskId = `${fullTask.id}.${subtask.id}`;
          try {
            const subtaskWorktrees = await backend.getTaskWorktrees(subtaskId);
            return { subtaskId, worktrees: subtaskWorktrees || [] };
          } catch (error) {
            return { subtaskId, worktrees: [] };
          }
        });
        const subtaskWorktreeResults = await Promise.all(subtaskWorktreePromises);
        const subtaskWorktreeMap = new Map(
          subtaskWorktreeResults.map((result) => [result.subtaskId, result.worktrees])
        );
        setSubtaskWorktrees(subtaskWorktreeMap);
      } else {
        setSubtaskWorktrees(new Map());
      }
      
      return fullTask;
    } catch (error) {
      showNotification(`Failed to load task details: ${error.message}`, 'error');
    }
  }, [backend, setSelectedTaskId, setTaskWorktrees, setSubtaskWorktrees, showNotification]);

  const expandTask = useCallback(async (taskId, options) => {
    setIsExpanding(true);
    try {
      // This is a simplified version. The original has streaming logic
      // which should also be handled, possibly in a separate service.
      await backend.expandTask(taskId, options);
      await reloadTasks();
      const updatedTask = await backend.getTask(taskId);
      // Update state with the new task details
      showNotification('Task expanded successfully', 'success');
    } catch (error) {
      showNotification(`Failed to expand task: ${error.message}`, 'error');
    } finally {
      setIsExpanding(false);
    }
  }, [backend, reloadTasks, setIsExpanding, showNotification]);

  const cycleTaskStatus = useCallback(async (task) => {
    const statusOrder = ['pending', 'in-progress', 'review', 'done', 'deferred', 'cancelled'];
    const currentIndex = statusOrder.indexOf(task.status || 'pending');
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const newStatus = statusOrder[nextIndex];

    try {
      await backend.setTaskStatus(task.id, newStatus);
      await reloadTasks();
      showNotification(`Task ${task.id} status changed to ${newStatus}`, 'success');
    } catch (error) {
      showNotification(`Failed to update task status: ${error.message}`, 'error');
    }
  }, [backend, reloadTasks, showNotification]);

  useEffect(() => {
    reloadTasks();
  }, [reloadTasks]);

  return {
    reloadTasks,
    getTaskDetails,
    expandTask,
    cycleTaskStatus,
  };
}; 