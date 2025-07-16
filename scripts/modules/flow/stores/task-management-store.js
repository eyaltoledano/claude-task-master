import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useTaskManagementStore = create(
  subscribeWithSelector((set, get) => ({
    // View and Selection State
    viewMode: 'list', // 'list', 'detail', 'subtasks', 'subtask-detail'
    selectedTaskId: null,
    selectedSubtaskId: null,
    selectedIndex: 0, // For list view
    selectedSubtaskIndex: 0, // For subtasks view
    scrollOffset: 0,
    detailScrollOffset: 0,
    subtasksScrollOffset: 0,
    
    // Filtering and Searching
    filterMode: 'status', // 'status', 'priority'
    statusFilter: 'all', // 'all', 'pending', 'done', 'in-progress'
    priorityFilter: 'all', // 'all', 'high', 'medium', 'low'
    searchQuery: '',
    isSearching: false,
    
    // Modal and Expansion State
    showExpandOptions: false,
    showClaudeLauncherModal: false,
    showBranchConflictModal: false,
    showStreamingModal: false,
    
    // Data and Loading
    tasks: [],
    subtasks: [],
    complexityReport: null,
    taskWorktrees: [],
    subtaskWorktrees: new Map(),
    isLoading: true,
    isExpanding: false,

    // Actions
    setViewMode: (mode) => set({ viewMode: mode }),
    setSelectedTaskId: (id) => set({ selectedTaskId: id }),
    setSelectedSubtaskId: (id) => set({ selectedSubtaskId: id }),
    setSelectedIndex: (index) => set({ selectedIndex: index }),
    setSelectedSubtaskIndex: (index) => set({ selectedSubtaskIndex: index }),
    setScrollOffset: (offset) => set({ scrollOffset: offset }),
    setDetailScrollOffset: (offset) => set({ detailScrollOffset: offset }),
    setSubtasksScrollOffset: (offset) => set({ subtasksScrollOffset: offset }),
    
    setFilterMode: (mode) => set({ filterMode: mode }),
    setStatusFilter: (filter) => set({ statusFilter: filter, priorityFilter: 'all' }),
    setPriorityFilter: (filter) => set({ priorityFilter: filter, statusFilter: 'all' }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setIsSearching: (isSearching) => set({ isSearching }),

    setShowExpandOptions: (show) => set({ showExpandOptions: show }),
    setShowClaudeLauncherModal: (show) => set({ showClaudeLauncherModal: show }),
    setShowBranchConflictModal: (show) => set({ showBranchConflictModal: show }),
    setShowStreamingModal: (show) => set({ showStreamingModal: show }),

    setTasks: (tasks) => set({ tasks }),
    setSubtasks: (subtasks) => set({ subtasks }),
    setComplexityReport: (report) => set({ complexityReport: report }),
    setTaskWorktrees: (worktrees) => set({ taskWorktrees: worktrees }),
    setSubtaskWorktrees: (worktrees) => set({ subtaskWorktrees: worktrees }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setIsExpanding: (expanding) => set({ isExpanding: expanding }),

    resetTaskManagementState: () => set({
      viewMode: 'list',
      selectedTaskId: null,
      selectedSubtaskId: null,
      selectedIndex: 0,
      selectedSubtaskIndex: 0,
      scrollOffset: 0,
      detailScrollOffset: 0,
      subtasksScrollOffset: 0,
      filterMode: 'status',
      statusFilter: 'all',
      priorityFilter: 'all',
      searchQuery: '',
      isSearching: false,
      showExpandOptions: false,
      showClaudeLauncherModal: false,
      showBranchConflictModal: false,
      showStreamingModal: false,
      isLoading: false,
      isExpanding: false,
    }),
  }))
); 