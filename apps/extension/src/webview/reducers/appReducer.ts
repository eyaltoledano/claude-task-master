/**
 * Main application state reducer
 */

import type { AppState, AppAction } from '../types';
import { logger } from '../utils/logger';

export const appReducer = (state: AppState, action: AppAction): AppState => {
	logger.debug(
		'Reducer action:',
		action.type,
		'payload' in action ? action.payload : 'no payload'
	);
	switch (action.type) {
		case 'SET_TASKS':
			const newTasks = Array.isArray(action.payload) ? action.payload : [];
			logger.debug('SET_TASKS reducer - updating tasks:', {
				oldCount: state.tasks.length,
				newCount: newTasks.length,
				newTasks
			});
			return {
				...state,
				tasks: newTasks,
				loading: false,
				error: undefined
			};
		case 'SET_LOADING':
			return { ...state, loading: action.payload };
		case 'SET_ERROR':
			return { ...state, error: action.payload, loading: false };
		case 'CLEAR_ERROR':
			return { ...state, error: undefined };
		case 'INCREMENT_REQUEST_ID':
			return { ...state, requestId: state.requestId + 1 };
		case 'UPDATE_TASK_STATUS': {
			const { taskId, newStatus } = action.payload;
			return {
				...state,
				tasks: state.tasks.map((task) =>
					task.id === taskId ? { ...task, status: newStatus } : task
				)
			};
		}
		case 'UPDATE_TASK_CONTENT': {
			const { taskId, updates } = action.payload;
			return {
				...state,
				tasks: state.tasks.map((task) =>
					task.id === taskId ? { ...task, ...updates } : task
				)
			};
		}
		case 'SET_CONNECTION_STATUS':
			return {
				...state,
				isConnected: action.payload.isConnected,
				connectionStatus: action.payload.status
			};
		case 'SET_EDITING_TASK':
			return {
				...state,
				editingTask: action.payload
			};
		case 'SET_POLLING_STATUS':
			return {
				...state,
				polling: {
					...state.polling,
					isActive: action.payload.isActive,
					errorCount: action.payload.errorCount ?? state.polling.errorCount,
					lastUpdate: action.payload.isActive
						? Date.now()
						: state.polling.lastUpdate
				}
			};
		case 'SET_USER_INTERACTING':
			return {
				...state,
				polling: {
					...state.polling,
					isUserInteracting: action.payload
				}
			};
		case 'TASKS_UPDATED_FROM_POLLING':
			return {
				...state,
				tasks: Array.isArray(action.payload) ? action.payload : [],
				polling: {
					...state.polling,
					lastUpdate: Date.now()
				}
			};
		case 'SET_NETWORK_STATUS':
			return {
				...state,
				polling: {
					...state.polling,
					isOfflineMode: action.payload.isOfflineMode,
					connectionStatus: action.payload.connectionStatus,
					reconnectAttempts:
						action.payload.reconnectAttempts !== undefined
							? action.payload.reconnectAttempts
							: state.polling.reconnectAttempts,
					maxReconnectAttempts:
						action.payload.maxReconnectAttempts !== undefined
							? action.payload.maxReconnectAttempts
							: state.polling.maxReconnectAttempts,
					lastSuccessfulConnection:
						action.payload.lastSuccessfulConnection !== undefined
							? action.payload.lastSuccessfulConnection
							: state.polling.lastSuccessfulConnection
				}
			};
		case 'LOAD_CACHED_TASKS':
			return {
				...state,
				tasks: Array.isArray(action.payload) ? action.payload : []
			};
		case 'ADD_TOAST':
			return {
				...state,
				toastNotifications: [...state.toastNotifications, action.payload]
			};
		case 'REMOVE_TOAST':
			return {
				...state,
				toastNotifications: state.toastNotifications.filter(
					(notification) => notification.id !== action.payload
				)
			};
		case 'CLEAR_ALL_TOASTS':
			return { ...state, toastNotifications: [] };
		case 'NAVIGATE_TO_TASK':
			logger.debug('📍 Reducer: Navigating to task:', action.payload);
			return {
				...state,
				currentView: 'task-details',
				selectedTaskId: action.payload
			};
		case 'NAVIGATE_TO_KANBAN':
			logger.debug('📍 Reducer: Navigating to kanban');
			return { ...state, currentView: 'kanban', selectedTaskId: undefined };
		case 'NAVIGATE_TO_CONFIG':
			logger.debug('📍 Reducer: Navigating to config');
			return { ...state, currentView: 'config', selectedTaskId: undefined };
		case 'SET_CURRENT_TAG':
			return {
				...state,
				currentTag: action.payload
			};
		case 'SET_AVAILABLE_TAGS':
			return {
				...state,
				availableTags: action.payload
			};
		case 'SET_TAG_DATA':
			return {
				...state,
				currentTag: action.payload.currentTag,
				availableTags: action.payload.availableTags
			};
		default:
			return state;
	}
};

export const initialState: AppState = {
	tasks: [],
	loading: true,
	requestId: 0,
	isConnected: false,
	connectionStatus: 'Connecting...',
	editingTask: { taskId: null },
	polling: {
		isActive: false,
		errorCount: 0,
		lastUpdate: undefined,
		isUserInteracting: false,
		isOfflineMode: false,
		reconnectAttempts: 0,
		maxReconnectAttempts: 0,
		lastSuccessfulConnection: undefined,
		connectionStatus: 'online'
	},
	toastNotifications: [],
	currentView: 'kanban',
	selectedTaskId: undefined,
	// Tag-related state
	currentTag: 'master',
	availableTags: ['master']
};
