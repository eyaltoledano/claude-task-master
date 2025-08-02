/**
 * Shared types for the webview application
 */

export interface TaskMasterTask {
	id: string;
	title: string;
	description: string;
	status: 'pending' | 'in-progress' | 'done' | 'deferred' | 'review';
	priority: 'high' | 'medium' | 'low';
	dependencies?: string[];
	details?: string;
	testStrategy?: string;
	subtasks?: TaskMasterTask[];
	complexityScore?: number;
}

export interface TaskUpdates {
	title?: string;
	description?: string;
	details?: string;
	priority?: TaskMasterTask['priority'];
	testStrategy?: string;
	dependencies?: string[];
}

export interface WebviewMessage {
	type: string;
	requestId?: string;
	data?: any;
	success?: boolean;
	[key: string]: any;
}

export interface ToastNotification {
	id: string;
	type: 'success' | 'info' | 'warning' | 'error';
	title: string;
	message: string;
	duration?: number;
}

export interface AppState {
	tasks: TaskMasterTask[];
	loading: boolean;
	error?: string;
	requestId: number;
	isConnected: boolean;
	connectionStatus: string;
	editingTask?: { taskId: string | null; editData?: TaskMasterTask };
	polling: {
		isActive: boolean;
		errorCount: number;
		lastUpdate?: number;
		isUserInteracting: boolean;
		isOfflineMode: boolean;
		reconnectAttempts: number;
		maxReconnectAttempts: number;
		lastSuccessfulConnection?: number;
		connectionStatus: 'online' | 'offline' | 'reconnecting';
	};
	toastNotifications: ToastNotification[];
	currentView: 'kanban' | 'task-details' | 'config';
	selectedTaskId?: string;
	// Tag-related state
	currentTag: string;
	availableTags: string[];
}

export type AppAction =
	| { type: 'SET_TASKS'; payload: TaskMasterTask[] }
	| { type: 'SET_LOADING'; payload: boolean }
	| { type: 'SET_ERROR'; payload: string }
	| { type: 'CLEAR_ERROR' }
	| { type: 'INCREMENT_REQUEST_ID' }
	| {
			type: 'UPDATE_TASK_STATUS';
			payload: { taskId: string; newStatus: TaskMasterTask['status'] };
	  }
	| {
			type: 'UPDATE_TASK_CONTENT';
			payload: { taskId: string; updates: TaskUpdates };
	  }
	| {
			type: 'SET_CONNECTION_STATUS';
			payload: { isConnected: boolean; status: string };
	  }
	| {
			type: 'SET_EDITING_TASK';
			payload: { taskId: string | null; editData?: TaskMasterTask };
	  }
	| {
			type: 'SET_POLLING_STATUS';
			payload: { isActive: boolean; errorCount?: number };
	  }
	| { type: 'SET_USER_INTERACTING'; payload: boolean }
	| { type: 'TASKS_UPDATED_FROM_POLLING'; payload: TaskMasterTask[] }
	| {
			type: 'SET_NETWORK_STATUS';
			payload: {
				isOfflineMode: boolean;
				connectionStatus: 'online' | 'offline' | 'reconnecting';
				reconnectAttempts?: number;
				maxReconnectAttempts?: number;
				lastSuccessfulConnection?: number;
			};
	  }
	| { type: 'LOAD_CACHED_TASKS'; payload: TaskMasterTask[] }
	| { type: 'ADD_TOAST'; payload: ToastNotification }
	| { type: 'REMOVE_TOAST'; payload: string }
	| { type: 'CLEAR_ALL_TOASTS' }
	| { type: 'NAVIGATE_TO_TASK'; payload: string }
	| { type: 'NAVIGATE_TO_KANBAN' }
	| { type: 'NAVIGATE_TO_CONFIG' }
	| { type: 'SET_CURRENT_TAG'; payload: string }
	| { type: 'SET_AVAILABLE_TAGS'; payload: string[] }
	| {
			type: 'SET_TAG_DATA';
			payload: { currentTag: string; availableTags: string[] };
	  };
