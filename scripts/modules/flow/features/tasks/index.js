// Task Feature - Main exports
// This file provides a centralized export for all task-related functionality

// Components
export { TaskStats } from './components/TaskStats.jsx';
export { TaskDetails } from './components/TaskDetails.jsx';
export { TaskFilters } from './components/TaskFilters.jsx';
export { TaskList } from './components/TaskList.jsx';
export { TaskListPopup } from './components/TaskListPopup.jsx';
export { TaskListView } from './components/TaskListView.jsx';
export { TaskManagementScreen } from './components/TaskManagementScreen.jsx';
export { TaskActions } from './components/TaskActions.jsx';
export { TaskDetailView } from './components/TaskDetailView.jsx';
export { ExpandModal } from './components/ExpandModal.jsx';
export { LinkTasksModal } from './components/LinkTasksModal.jsx';
export { NextTaskModal } from './components/NextTaskModal.jsx';
export { TagManagementScreen } from './components/TagManagementScreen.jsx';
export { DependencyVisualizerScreen } from './components/DependencyVisualizerScreen.jsx';
export { AnalyzeComplexityScreen } from './components/AnalyzeComplexityScreen.jsx';

// Utilities
export * from './components/TaskManagementUtils.js';

// Hooks
export * from './hooks/useTaskFilters.js';
export * from './hooks/useTaskViewState.js';

// Services
export * from './services/DependencyAnalysisService.js';
export * from './services/NextTaskService.js';
export * from './services/TaskStatusManager.js';
export * from './services/ImplementationLogger.js';
