// Task Feature - Main exports
// This file provides a centralized export for all task-related functionality

// Components
export { default as TaskStats } from './components/TaskStats.jsx';
export { default as TaskDetails } from './components/TaskDetails.jsx';
export { default as TaskFilters } from './components/TaskFilters.jsx';
export { default as TaskList } from './components/TaskList.jsx';
export { default as TaskListPopup } from './components/TaskListPopup.jsx';
export { default as TaskListView } from './components/TaskListView.jsx';
export { default as TaskManagementScreen } from './components/TaskManagementScreen.jsx';
export { default as TaskActions } from './components/TaskActions.jsx';
export { default as TaskDetailView } from './components/TaskDetailView.jsx';
export { default as ExpandModal } from './components/ExpandModal.jsx';
export { default as LinkTasksModal } from './components/LinkTasksModal.jsx';
export { default as NextTaskModal } from './components/NextTaskModal.jsx';
export { default as TagManagementScreen } from './components/TagManagementScreen.jsx';
export { default as DependencyVisualizerScreen } from './components/DependencyVisualizerScreen.jsx';
export { default as AnalyzeComplexityScreen } from './components/AnalyzeComplexityScreen.jsx';

// Utilities
export { default as TaskManagementUtils } from './components/TaskManagementUtils.js';

// Hooks
export { default as useTaskFilters } from './hooks/useTaskFilters.js';
export { default as useTaskViewState } from './hooks/useTaskViewState.js';

// Services
export { default as DependencyAnalysisService } from './services/DependencyAnalysisService.js';
export { default as NextTaskService } from './services/NextTaskService.js';
export { default as TaskStatusManager } from './services/TaskStatusManager.js';
export { default as ImplementationLogger } from './services/ImplementationLogger.js'; 