import React, {
	useState,
	useEffect,
	useReducer,
	useContext,
	createContext,
	useCallback
} from 'react';
import { createRoot } from 'react-dom/client';

// Import shadcn Kanban components
import {
	KanbanProvider,
	KanbanBoard,
	KanbanHeader,
	KanbanCards,
	KanbanCard,
	type DragEndEvent,
	type Status,
	type Feature
} from '@/components/ui/shadcn-io/kanban';

// Import TaskDetailsView component
import TaskDetailsView from '../components/TaskDetailsView';

// TypeScript interfaces for Task Master integration
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

interface WebviewMessage {
	type: string;
	requestId?: string;
	data?: any;
	success?: boolean;
	[key: string]: any;
}

// VS Code API declaration
declare global {
	interface Window {
		acquireVsCodeApi?: () => {
			postMessage: (message: any) => void;
			setState: (state: any) => void;
			getState: () => any;
		};
	}
}

// State management types
interface AppState {
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
		// Network status
		isOfflineMode: boolean;
		reconnectAttempts: number;
		maxReconnectAttempts: number;
		lastSuccessfulConnection?: number;
		connectionStatus: 'online' | 'offline' | 'reconnecting';
	};
	// Toast notifications
	toastNotifications: ToastNotification[];
	// Navigation state
	currentView: 'kanban' | 'task-details';
	selectedTaskId?: string;
}

// Add interface for task updates
export interface TaskUpdates {
	title?: string;
	description?: string;
	details?: string;
	priority?: TaskMasterTask['priority'];
	testStrategy?: string;
	dependencies?: string[];
}

// Add state for task editing
type AppAction =
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
	| { type: 'NAVIGATE_TO_KANBAN' };

// Toast notification interfaces
interface ToastNotification {
	id: string;
	type: 'success' | 'info' | 'warning' | 'error';
	title: string;
	message: string;
	duration?: number;
	timestamp: number;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
	{
		children: React.ReactNode;
		onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	},
	ErrorBoundaryState
> {
	constructor(props: {
		children: React.ReactNode;
		onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	}) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('React Error Boundary caught an error:', error, errorInfo);

		this.setState({ error, errorInfo });

		// Notify parent component of error
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// Send error to extension for centralized handling
		if (window.acquireVsCodeApi) {
			const vscode = window.acquireVsCodeApi();
			vscode.postMessage({
				type: 'reactError',
				data: {
					message: error.message,
					stack: error.stack,
					componentStack: errorInfo.componentStack,
					timestamp: Date.now()
				}
			});
		}
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-vscode-background">
					<div className="max-w-md mx-auto text-center p-6">
						<div className="w-16 h-16 mx-auto mb-4 text-red-400">
							<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						</div>
						<h2 className="text-xl font-semibold text-vscode-foreground mb-2">
							Something went wrong
						</h2>
						<p className="text-vscode-foreground/70 mb-4">
							The Task Master Kanban board encountered an unexpected error.
						</p>
						<div className="space-y-2">
							<button
								onClick={() =>
									this.setState({
										hasError: false,
										error: undefined,
										errorInfo: undefined
									})
								}
								className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
							>
								Try Again
							</button>
							<button
								onClick={() => window.location.reload()}
								className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
							>
								Reload Extension
							</button>
						</div>
						{this.state.error && (
							<details className="mt-4 text-left">
								<summary className="text-sm text-vscode-foreground/50 cursor-pointer">
									Error Details
								</summary>
								<pre className="mt-2 text-xs text-vscode-foreground/70 bg-vscode-input/30 p-2 rounded overflow-auto max-h-32">
									{this.state.error.message}
									{this.state.error.stack && `\n\n${this.state.error.stack}`}
								</pre>
							</details>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Toast Notification Component
const ToastNotification: React.FC<{
	notification: ToastNotification;
	onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
	const [isVisible, setIsVisible] = useState(true);
	const [progress, setProgress] = useState(100);

	const duration = notification.duration || 5000; // 5 seconds default

	useEffect(() => {
		const progressInterval = setInterval(() => {
			setProgress((prev) => {
				const decrease = (100 / duration) * 100; // Update every 100ms
				return Math.max(0, prev - decrease);
			});
		}, 100);

		const timeoutId = setTimeout(() => {
			setIsVisible(false);
			setTimeout(() => onDismiss(notification.id), 300); // Wait for animation
		}, duration);

		return () => {
			clearInterval(progressInterval);
			clearTimeout(timeoutId);
		};
	}, [notification.id, duration, onDismiss]);

	const getIcon = () => {
		switch (notification.type) {
			case 'success':
				return (
					<svg
						className="w-5 h-5 text-green-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				);
			case 'warning':
				return (
					<svg
						className="w-5 h-5 text-yellow-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
				);
			case 'error':
				return (
					<svg
						className="w-5 h-5 text-red-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				);
			default:
				return (
					<svg
						className="w-5 h-5 text-blue-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				);
		}
	};

	const getColorClasses = () => {
		switch (notification.type) {
			case 'success':
				return 'bg-green-500/10 border-green-500/30 text-green-400';
			case 'warning':
				return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
			case 'error':
				return 'bg-red-500/10 border-red-500/30 text-red-400';
			default:
				return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
		}
	};

	return (
		<div
			className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        max-w-sm w-full bg-vscode-background border rounded-lg shadow-lg p-4 relative overflow-hidden
        ${getColorClasses()}
      `}
		>
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-vscode-foreground">
						{notification.title}
					</p>
					<p className="mt-1 text-sm text-vscode-foreground/70">
						{notification.message}
					</p>
				</div>
				<button
					onClick={() => onDismiss(notification.id)}
					className="flex-shrink-0 ml-2 text-vscode-foreground/50 hover:text-vscode-foreground transition-colors"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			{/* Progress bar */}
			<div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
				<div
					className="h-full bg-current transition-all ease-linear"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
};

// Toast Container Component
const ToastContainer: React.FC<{
	notifications: ToastNotification[];
	onDismiss: (id: string) => void;
}> = ({ notifications, onDismiss }) => {
	return (
		<div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
			<div className="space-y-3">
				{notifications.map((notification) => (
					<div key={notification.id} className="pointer-events-auto">
						<ToastNotification
							notification={notification}
							onDismiss={onDismiss}
						/>
					</div>
				))}
			</div>
		</div>
	);
};

// Toast helper functions
const createToast = (
	type: ToastNotification['type'],
	title: string,
	message: string,
	duration?: number
): ToastNotification => {
	return {
		id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		type,
		title,
		message,
		duration,
		timestamp: Date.now()
	};
};

const showSuccessToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('success', title, message, duration)
		});
	};

const showInfoToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('info', title, message, duration)
		});
	};

const showWarningToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('warning', title, message, duration)
		});
	};

const showErrorToast =
	(dispatch: React.Dispatch<AppAction>) =>
	(title: string, message: string, duration?: number) => {
		dispatch({
			type: 'ADD_TOAST',
			payload: createToast('error', title, message, duration)
		});
	};

// Kanban column configuration
const kanbanStatuses: Status[] = [
	{ id: 'pending', name: 'To Do', color: '#6B7280' },
	{ id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
	{ id: 'review', name: 'Review', color: '#8B5CF6' },
	{ id: 'done', name: 'Done', color: '#10B981' },
	{ id: 'deferred', name: 'Deferred', color: '#EF4444' }
];

// State reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
	switch (action.type) {
		case 'SET_TASKS':
			return {
				...state,
				tasks: action.payload,
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
		case 'UPDATE_TASK_STATUS':
			const updatedTasks = state.tasks.map((task) =>
				task.id === action.payload.taskId
					? { ...task, status: action.payload.newStatus }
					: task
			);
			return { ...state, tasks: updatedTasks };
		case 'UPDATE_TASK_CONTENT':
			const updatedTasksContent = state.tasks.map((task) =>
				task.id === action.payload.taskId
					? { ...task, ...action.payload.updates }
					: task
			);
			return { ...state, tasks: updatedTasksContent };
		case 'SET_CONNECTION_STATUS':
			return {
				...state,
				isConnected: action.payload.isConnected,
				connectionStatus: action.payload.status
			};
		case 'SET_EDITING_TASK':
			return { ...state, editingTask: action.payload };
		case 'SET_POLLING_STATUS':
			return { ...state, polling: { ...state.polling, ...action.payload } };
		case 'SET_USER_INTERACTING':
			return {
				...state,
				polling: { ...state.polling, isUserInteracting: action.payload }
			};
		case 'TASKS_UPDATED_FROM_POLLING':
			return { ...state, tasks: action.payload };
		case 'SET_NETWORK_STATUS':
			return { ...state, polling: { ...state.polling, ...action.payload } };
		case 'LOAD_CACHED_TASKS':
			return { ...state, tasks: action.payload };
		case 'ADD_TOAST':
			return {
				...state,
				toastNotifications: [...state.toastNotifications, action.payload]
			};
		case 'REMOVE_TOAST':
			return {
				...state,
				toastNotifications: state.toastNotifications.filter(
					(n) => n.id !== action.payload
				)
			};
		case 'CLEAR_ALL_TOASTS':
			return { ...state, toastNotifications: [] };
		case 'NAVIGATE_TO_TASK':
			console.log('📍 Reducer: Navigating to task', action.payload);
			return {
				...state,
				currentView: 'task-details',
				selectedTaskId: action.payload
			};
		case 'NAVIGATE_TO_KANBAN':
			console.log('📍 Reducer: Navigating to kanban');
			return { ...state, currentView: 'kanban', selectedTaskId: undefined };
		default:
			return state;
	}
};

// Context for VS Code API
export const VSCodeContext = createContext<{
	vscode?: ReturnType<NonNullable<typeof window.acquireVsCodeApi>>;
	state: AppState;
	dispatch: React.Dispatch<AppAction>;
	sendMessage: (message: WebviewMessage) => Promise<any>;
	availableHeight: number;
	// Toast notification functions
	showSuccessToast: (title: string, message: string, duration?: number) => void;
	showInfoToast: (title: string, message: string, duration?: number) => void;
	showWarningToast: (title: string, message: string, duration?: number) => void;
	showErrorToast: (title: string, message: string, duration?: number) => void;
} | null>(null);

// Priority Badge Component
const PriorityBadge: React.FC<{ priority: TaskMasterTask['priority'] }> = ({
	priority
}) => {
	const colorMap = {
		high: 'bg-red-500/20 text-red-400 border-red-500/30',
		medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		low: 'bg-green-500/20 text-green-400 border-green-500/30'
	};

	return (
		<span
			className={`
        inline-flex items-center justify-center
        px-2 py-0.5
        rounded text-xs font-medium border 
        min-w-[50px]
        ${colorMap[priority]}
      `}
			title={priority}
		>
			{priority}
		</span>
	);
};

// Task Edit Modal Component
const TaskEditModal: React.FC<{
	task: TaskMasterTask;
	onSave: (taskId: string, updates: TaskUpdates) => void;
	onCancel: () => void;
}> = ({ task, onSave, onCancel }) => {
	const [formData, setFormData] = useState<TaskUpdates>({
		title: task.title,
		description: task.description,
		details: task.details || '',
		priority: task.priority,
		testStrategy: task.testStrategy || '',
		dependencies: task.dependencies || []
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Only include changed fields
		const updates: TaskUpdates = {};
		if (formData.title !== task.title) {updates.title = formData.title;}
		if (formData.description !== task.description)
			{updates.description = formData.description;}
		if (formData.details !== task.details) {updates.details = formData.details;}
		if (formData.priority !== task.priority)
			{updates.priority = formData.priority;}
		if (formData.testStrategy !== task.testStrategy)
			{updates.testStrategy = formData.testStrategy;}
		if (
			JSON.stringify(formData.dependencies) !==
			JSON.stringify(task.dependencies)
		) {
			updates.dependencies = formData.dependencies;
		}

		if (Object.keys(updates).length > 0) {
			onSave(task.id, updates);
		} else {
			onCancel(); // No changes made
		}
	};

	const handleDependenciesChange = (value: string) => {
		const deps = value
			.split(',')
			.map((dep) => dep.trim())
			.filter((dep) => dep.length > 0);
		setFormData((prev) => ({ ...prev, dependencies: deps }));
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-vscode-input border border-vscode-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
				<div className="p-4 border-b border-vscode-border">
					<h2 className="text-lg font-semibold text-vscode-foreground">
						Edit Task #{task.id}
					</h2>
				</div>

				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Title
						</label>
						<input
							type="text"
							value={formData.title || ''}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, title: e.target.value }))
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Description
						</label>
						<textarea
							value={formData.description || ''}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value
								}))
							}
							className="w-full px-3 py-2 bg-input-background border border-border rounded text-input-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							rows={3}
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Priority
						</label>
						<select
							value={formData.priority || 'medium'}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									priority: e.target.value as TaskMasterTask['priority']
								}))
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
						>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Implementation Details
						</label>
						<textarea
							value={formData.details || ''}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, details: e.target.value }))
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							rows={4}
							placeholder="Implementation details and notes..."
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Test Strategy
						</label>
						<textarea
							value={formData.testStrategy || ''}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									testStrategy: e.target.value
								}))
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							rows={2}
							placeholder="How to test this task..."
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-2">
							Dependencies (comma-separated task IDs)
						</label>
						<input
							type="text"
							value={formData.dependencies?.join(', ') || ''}
							onChange={(e) => handleDependenciesChange(e.target.value)}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded text-link focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							placeholder="1, 2, 3"
						/>
					</div>

					<div className="flex justify-end gap-2 pt-4 border-t border-vscode-border">
						<button
							type="button"
							onClick={onCancel}
							className="px-4 py-2 text-vscode-foreground border border-vscode-border rounded hover:bg-vscode-input/50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground transition-colors"
						>
							Save Changes
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

// Task Card Component
const TaskCard: React.FC<{
	task: TaskMasterTask;
	index: number;
	status: string;
	onEdit?: (task: TaskMasterTask) => void;
	onViewDetails?: (taskId: string) => void;
}> = ({ task, index, status, onEdit, onViewDetails }) => {
	const handleClick = (e: React.MouseEvent) => {
		onViewDetails?.(task.id);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		onViewDetails?.(task.id);
	};

	return (
		<KanbanCard
			id={task.id}
			name={task.title}
			index={index}
			parent={status}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			className="
        w-full
        min-h-[120px]
        border border-vscode-border/50
        bg-card
        flex-shrink-0
      "
		>
			<div className="space-y-3 h-full flex flex-col">
				<div className="flex items-start justify-between gap-2 flex-shrink-0">
					<h3 className="font-medium text-sm leading-tight flex-1 min-w-0 text-vscode-foreground">
						{task.title}
					</h3>
					<div className="flex items-center gap-1 flex-shrink-0">
						<PriorityBadge priority={task.priority} />
					</div>
				</div>

				{task.description && (
					<p className="text-xs text-vscode-foreground/70 line-clamp-3 leading-relaxed flex-1 min-h-0">
						{task.description}
					</p>
				)}

				<div className="flex items-center justify-between text-xs mt-auto pt-2 flex-shrink-0 border-t border-vscode-border/20">
					<span className="font-mono text-vscode-foreground/50 flex-shrink-0">
						#{task.id}
					</span>
					{task.dependencies && task.dependencies.length > 0 && (
						<span className="text-vscode-foreground/50 flex-shrink-0 ml-2">
							Deps: {task.dependencies.length}
						</span>
					)}
				</div>
			</div>
		</KanbanCard>
	);
};

// Main Kanban Board Component
const TaskMasterKanban: React.FC = () => {
	const context = useContext(VSCodeContext);
	if (!context)
		{throw new Error('TaskMasterKanban must be used within VSCodeContext');}

	const { state, dispatch, sendMessage, availableHeight } = context;
	const {
		tasks,
		loading,
		error,
		editingTask,
		polling,
		currentView,
		selectedTaskId
	} = state;
	const [activeTask, setActiveTask] = React.useState<TaskMasterTask | null>(
		null
	);

	// Calculate header height for proper kanban board sizing
	const headerHeight = 73; // Header with padding and border
	const kanbanHeight = availableHeight - headerHeight;

	// Group tasks by status
	const tasksByStatus = kanbanStatuses.reduce(
		(acc, status) => {
			acc[status.id] = tasks.filter((task) => task.status === status.id);
			return acc;
		},
		{} as Record<string, TaskMasterTask[]>
	);

	// Handle task update
	const handleUpdateTask = async (taskId: string, updates: TaskUpdates) => {
		console.log(`🔄 Updating task ${taskId} content:`, updates);

		// Optimistic update
		dispatch({
			type: 'UPDATE_TASK_CONTENT',
			payload: { taskId, updates }
		});

		try {
			// Send update to extension
			await sendMessage({
				type: 'updateTask',
				data: {
					taskId,
					updates,
					options: { append: false, research: false }
				}
			});

			console.log(`✅ Task ${taskId} content updated successfully`);

			// Close the edit modal
			dispatch({
				type: 'SET_EDITING_TASK',
				payload: { taskId: null }
			});
		} catch (error) {
			console.error(`❌ Failed to update task ${taskId}:`, error);

			// Revert the optimistic update on error
			const originalTask = editingTask?.editData;
			if (originalTask) {
				dispatch({
					type: 'UPDATE_TASK_CONTENT',
					payload: {
						taskId,
						updates: {
							title: originalTask.title,
							description: originalTask.description,
							details: originalTask.details,
							priority: originalTask.priority,
							testStrategy: originalTask.testStrategy,
							dependencies: originalTask.dependencies
						}
					}
				});
			}

			dispatch({
				type: 'SET_ERROR',
				payload: `Failed to update task: ${error}`
			});
		}
	};

	// Handle drag start - mark user as interacting and set active task
	const handleDragStart = (event: DragEndEvent) => {
		console.log('🖱️ User started dragging, pausing updates');
		dispatch({ type: 'SET_USER_INTERACTING', payload: true });

		const taskId = event.active.id as string;
		const task = tasks.find((t) => t.id === taskId);
		setActiveTask(task || null);
	};

	// Handle drag end - allow updates again after a delay
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		// Clear active task
		setActiveTask(null);

		// Re-enable updates after drag completes
		setTimeout(() => {
			console.log('✅ Drag completed, resuming updates');
			dispatch({ type: 'SET_USER_INTERACTING', payload: false });
		}, 1000); // 1 second delay to ensure smooth completion

		if (!over) {return;}

		const taskId = active.id as string;
		const newStatus = over.id as TaskMasterTask['status'];

		// Find the task that was moved
		const task = tasks.find((t) => t.id === taskId);
		if (!task || task.status === newStatus) {return;}

		console.log(`🔄 Moving task ${taskId} from ${task.status} to ${newStatus}`);

		// Update task status locally (optimistic update)
		dispatch({
			type: 'UPDATE_TASK_STATUS',
			payload: { taskId, newStatus }
		});

		try {
			// Send update to extension
			await sendMessage({
				type: 'updateTaskStatus',
				data: { taskId, newStatus, oldStatus: task.status }
			});

			console.log(`✅ Task ${taskId} status updated successfully`);
		} catch (error) {
			console.error(`❌ Failed to update task ${taskId}:`, error);

			// Revert the optimistic update on error
			dispatch({
				type: 'UPDATE_TASK_STATUS',
				payload: { taskId, newStatus: task.status }
			});

			dispatch({
				type: 'SET_ERROR',
				payload: `Failed to update task status: ${error}`
			});
		}
	};

	// Get polling status indicator
	const getPollingStatusIndicator = () => {
		const {
			isActive,
			errorCount,
			isOfflineMode,
			connectionStatus,
			reconnectAttempts,
			maxReconnectAttempts
		} = polling;

		if (isOfflineMode || connectionStatus === 'offline') {
			return (
				<div className="flex items-center gap-2">
					<div
						className="flex items-center gap-1 text-red-400"
						title="Offline mode - using cached data"
					>
						<div className="w-2 h-2 rounded-full bg-red-400"></div>
						<span className="text-xs">Offline</span>
					</div>
					<button
						onClick={async () => {
							try {
								await sendMessage({ type: 'attemptReconnection' });
							} catch (error) {
								console.error('Failed to request reconnection:', error);
							}
						}}
						className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
						title="Attempt to reconnect"
					>
						Reconnect
					</button>
				</div>
			);
		} else if (connectionStatus === 'reconnecting') {
			return (
				<div
					className="flex items-center gap-1 text-yellow-400"
					title={`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`}
				>
					<div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
					<span className="text-xs">Reconnecting...</span>
				</div>
			);
		} else if (isActive) {
			return (
				<div
					className="flex items-center gap-1 text-green-400"
					title="Auto-refresh active"
				>
					<div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
					<span className="text-xs">Live</span>
				</div>
			);
		} else if (errorCount > 0) {
			return (
				<div
					className="flex items-center gap-1 text-yellow-400"
					title="Auto-refresh paused due to errors"
				>
					<div className="w-2 h-2 rounded-full bg-yellow-400"></div>
					<span className="text-xs">Paused</span>
				</div>
			);
		} else {
			return (
				<div
					className="flex items-center gap-1 text-gray-400"
					title="Auto-refresh off"
				>
					<div className="w-2 h-2 rounded-full bg-gray-400"></div>
					<span className="text-xs">Manual</span>
				</div>
			);
		}
	};

	if (loading) {
		return (
			<div
				className="flex items-center justify-center"
				style={{ height: `${kanbanHeight}px` }}
			>
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-foreground mx-auto mb-4"></div>
					<p className="text-sm text-vscode-foreground/70">Loading tasks...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 m-4">
				<p className="text-red-400 text-sm">Error: {error}</p>
				<button
					onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Dismiss
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col" style={{ height: `${availableHeight}px` }}>
				<div className="flex-shrink-0 p-4 bg-vscode-sidebar-background border-b border-vscode-border">
					<div className="flex items-center justify-between">
						<h1 className="text-lg font-semibold text-vscode-foreground">
							Task Master Kanban
						</h1>
						<div className="flex items-center gap-4">
							{getPollingStatusIndicator()}
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-400' : 'bg-red-400'}`}
								></div>
								<span className="text-xs text-vscode-foreground/70">
									{state.connectionStatus}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div
					className="flex-1 px-4 py-4 overflow-hidden"
					style={{ height: `${kanbanHeight}px` }}
				>
					<KanbanProvider
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
						className="
              kanban-container
              w-full h-full
              overflow-x-auto overflow-y-hidden
            "
						dragOverlay={
							activeTask ? (
								<TaskCard
									task={activeTask}
									index={0}
									status={activeTask.status}
									onEdit={() => {}}
									onViewDetails={() => {}}
								/>
							) : null
						}
					>
						<div
							className="
              flex gap-4 
              min-w-max
              h-full
              pb-2
            "
						>
							{kanbanStatuses.map((status) => {
								const columnHeaderHeight = 49; // Header with padding and border
								const columnPadding = 16; // p-2 = 8px top + 8px bottom
								const availableColumnHeight =
									kanbanHeight - columnHeaderHeight - columnPadding;

								return (
									<KanbanBoard
										key={status.id}
										id={status.id}
										className="
                      kanban-column
                      flex-shrink-0
                      min-w-[280px] max-w-[320px] w-[280px]
                      h-full
                      flex flex-col
                      border border-vscode-border/30
                      rounded-lg
                      bg-vscode-sidebar-background/50
                    "
									>
										<KanbanHeader
											name={`${status.name} (${tasksByStatus[status.id]?.length || 0})`}
											color={status.color}
											className="px-3 py-3 text-sm font-medium flex-shrink-0 border-b border-vscode-border/30"
										/>
										<div
											className="
                        flex flex-col gap-2 
                        overflow-y-auto overflow-x-hidden
                        p-2
                        scrollbar-thin scrollbar-track-transparent
                      "
											style={{
												height: `${availableColumnHeight}px`,
												maxHeight: `${availableColumnHeight}px`
											}}
										>
											<KanbanCards className="flex flex-col gap-2">
												{tasksByStatus[status.id]?.map((task, index) => (
													<TaskCard
														key={task.id}
														task={task}
														index={index}
														status={status.id}
														onEdit={(task) => {
															dispatch({
																type: 'SET_EDITING_TASK',
																payload: { taskId: task.id, editData: task }
															});
														}}
														onViewDetails={(taskId) => {
															console.log(
																'🔍 Navigating to task details:',
																taskId
															);
															dispatch({
																type: 'NAVIGATE_TO_TASK',
																payload: taskId
															});
														}}
													/>
												))}
											</KanbanCards>
										</div>
									</KanbanBoard>
								);
							})}
						</div>
					</KanbanProvider>
				</div>
			</div>

			{/* Task Edit Modal */}
			{editingTask?.taskId && editingTask.editData && (
				<TaskEditModal
					task={editingTask.editData}
					onSave={async (taskId, updates) => {
						await handleUpdateTask(taskId, updates);
					}}
					onCancel={() => {
						dispatch({
							type: 'SET_EDITING_TASK',
							payload: { taskId: null }
						});
					}}
				/>
			)}
		</>
	);
};

// Main App Component
const App: React.FC = () => {
	const [state, dispatch] = useReducer(appReducer, {
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
			// Network status
			isOfflineMode: false,
			reconnectAttempts: 0,
			maxReconnectAttempts: 0,
			lastSuccessfulConnection: undefined,
			connectionStatus: 'online'
		},
		toastNotifications: [],
		currentView: 'kanban',
		selectedTaskId: undefined
	});

	const [vscode] = useState(() => {
		return window.acquireVsCodeApi?.();
	});

	const [pendingRequests] = useState(
		new Map<
			string,
			{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }
		>()
	);

	// Dynamic height calculation state
	const [availableHeight, setAvailableHeight] = useState<number>(
		window.innerHeight
	);

	// Calculate available height for kanban board
	const updateAvailableHeight = useCallback(() => {
		// Use window.innerHeight to get the actual available space
		// This automatically accounts for VS Code panels like terminal, problems, etc.
		const height = window.innerHeight;
		console.log('📏 Available height updated:', height);
		setAvailableHeight(height);
	}, []);

	// Listen to resize events to handle VS Code panel changes
	useEffect(() => {
		updateAvailableHeight();

		const handleResize = () => {
			updateAvailableHeight();
		};

		window.addEventListener('resize', handleResize);

		// Also listen for VS Code specific events if available
		const handleVisibilityChange = () => {
			// Small delay to ensure VS Code has finished resizing
			setTimeout(updateAvailableHeight, 100);
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [updateAvailableHeight]);

	// Send message to extension with promise-based response handling
	const sendMessage = useCallback(
		async (message: WebviewMessage): Promise<any> => {
			if (!vscode) {
				throw new Error('VS Code API not available');
			}

			return new Promise((resolve, reject) => {
				const requestId = `${Date.now()}-${Math.random()}`;
				const messageWithId = { ...message, requestId };

				// Set up timeout
				const timeout = setTimeout(() => {
					pendingRequests.delete(requestId);
					reject(new Error('Request timeout'));
				}, 10000); // 10 second timeout

				// Store the promise resolvers
				pendingRequests.set(requestId, { resolve, reject, timeout });

				// Send the message
				vscode.postMessage(messageWithId);
			});
		},
		[vscode, pendingRequests]
	);

	// Handle messages from extension
	useEffect(() => {
		if (!vscode) {return;}

		const handleMessage = (event: MessageEvent) => {
			const message: WebviewMessage = event.data;
			console.log('📨 Received message from extension:', message);

			// Handle response to a pending request
			if (message.requestId && pendingRequests.has(message.requestId)) {
				const { resolve, reject, timeout } = pendingRequests.get(
					message.requestId
				)!;
				clearTimeout(timeout);
				pendingRequests.delete(message.requestId);

				if (message.type === 'error') {
					reject(new Error(message.error || 'Unknown error'));
				} else {
					resolve(message.data || message);
				}
				return;
			}

			// Handle different message types
			switch (message.type) {
				case 'init':
					console.log('🚀 Extension initialized:', message.data);
					dispatch({
						type: 'SET_CONNECTION_STATUS',
						payload: { isConnected: true, status: 'Connected' }
					});
					break;

				case 'tasksData':
					console.log('📋 Received tasks data:', message.data);
					dispatch({ type: 'SET_TASKS', payload: message.data });
					break;

				case 'taskStatusUpdated':
					console.log('✅ Task status updated:', message);
					// Status is already updated optimistically, no need to update again
					break;

				case 'taskUpdated':
					console.log('✅ Task content updated:', message);
					// Content is already updated optimistically, no need to update again
					break;

				case 'tasksUpdated':
					console.log('📡 Tasks updated from polling:', message);
					// Only update if user is not currently interacting
					if (!state.polling.isUserInteracting) {
						dispatch({
							type: 'TASKS_UPDATED_FROM_POLLING',
							payload: message.data
						});
						dispatch({
							type: 'SET_POLLING_STATUS',
							payload: { isActive: true, errorCount: 0 }
						});
					} else {
						console.log('⏸️ Skipping update due to user interaction');
					}
					break;

				case 'pollingError':
					console.log('❌ Polling error:', message);
					dispatch({
						type: 'SET_POLLING_STATUS',
						payload: {
							isActive: false,
							errorCount: (state.polling.errorCount || 0) + 1
						}
					});
					dispatch({
						type: 'SET_ERROR',
						payload: `Auto-refresh stopped: ${message.error}`
					});
					break;

				case 'pollingStarted':
					console.log('🔄 Polling started');
					dispatch({
						type: 'SET_POLLING_STATUS',
						payload: { isActive: true, errorCount: 0 }
					});
					break;

				case 'pollingStopped':
					console.log('⏹️ Polling stopped');
					dispatch({
						type: 'SET_POLLING_STATUS',
						payload: { isActive: false }
					});
					break;

				case 'connectionStatusUpdate':
					console.log('📡 Connection status update:', message);
					dispatch({
						type: 'SET_NETWORK_STATUS',
						payload: {
							isOfflineMode: message.data.isOfflineMode,
							connectionStatus: message.data.status,
							reconnectAttempts: message.data.reconnectAttempts,
							maxReconnectAttempts: message.data.maxReconnectAttempts
						}
					});
					break;

				case 'networkOffline':
					console.log('🔌 Network offline, loading cached tasks:', message);
					dispatch({
						type: 'SET_NETWORK_STATUS',
						payload: {
							isOfflineMode: true,
							connectionStatus: 'offline',
							reconnectAttempts: message.data.reconnectAttempts,
							lastSuccessfulConnection: message.data.lastSuccessfulConnection
						}
					});

					// Load cached tasks if available
					if (message.data.cachedTasks && message.data.cachedTasks.length > 0) {
						dispatch({
							type: 'LOAD_CACHED_TASKS',
							payload: message.data.cachedTasks
						});
					}
					break;

				case 'reconnectionAttempted':
					console.log('🔄 Reconnection attempted:', message);
					if (message.success) {
						dispatch({
							type: 'CLEAR_ERROR'
						});
					}
					break;

				case 'errorNotification':
					console.log('⚠️ Error notification from extension:', message);
					const errorData = message.data;

					// Map error severity to toast type
					let toastType: ToastNotification['type'] = 'error';
					if (errorData.severity === 'low') {toastType = 'info';}
					else if (errorData.severity === 'medium') {toastType = 'warning';}
					else if (
						errorData.severity === 'high' ||
						errorData.severity === 'critical'
					)
						{toastType = 'error';}

					// Create appropriate toast based on error category
					const title =
						errorData.category === 'network'
							? 'Network Error'
							: errorData.category === 'mcp_connection'
								? 'Connection Error'
								: errorData.category === 'task_loading'
									? 'Task Loading Error'
									: errorData.category === 'ui_rendering'
										? 'UI Error'
										: 'Error';

					dispatch({
						type: 'ADD_TOAST',
						payload: createToast(
							toastType,
							title,
							errorData.message,
							errorData.duration || (toastType === 'error' ? 8000 : 5000) // Use preference duration or fallback
						)
					});
					break;

				case 'error':
					console.log('❌ General error from extension:', message);
					const errorTitle =
						message.errorType === 'connection' ? 'Connection Error' : 'Error';
					const errorMessage = message.error || 'An unknown error occurred';

					dispatch({
						type: 'SET_ERROR',
						payload: errorMessage
					});

					dispatch({
						type: 'ADD_TOAST',
						payload: createToast('error', errorTitle, errorMessage, 8000)
					});

					// Set offline mode for connection errors
					if (message.errorType === 'connection') {
						dispatch({
							type: 'SET_NETWORK_STATUS',
							payload: {
								isOfflineMode: true,
								connectionStatus: 'offline',
								reconnectAttempts: 0
							}
						});
					}
					break;

				case 'reactError':
					console.log('🔥 React error reported to extension:', message);
					// Show a toast for React errors too
					dispatch({
						type: 'ADD_TOAST',
						payload: createToast(
							'error',
							'UI Error',
							'A component error occurred. The extension may need to be reloaded.',
							10000
						)
					});
					break;

				default:
					console.log('❓ Unknown message type:', message.type);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, [vscode, pendingRequests, state.polling]);

	// Initialize the webview
	useEffect(() => {
		if (!vscode) {
			console.warn('⚠️ VS Code API not available - running in standalone mode');
			dispatch({
				type: 'SET_CONNECTION_STATUS',
				payload: { isConnected: false, status: 'Standalone Mode' }
			});
			return;
		}

		console.log('🔄 Initializing webview...');

		// Notify extension that webview is ready
		vscode.postMessage({ type: 'ready' });

		// Request initial tasks data
		sendMessage({ type: 'getTasks' })
			.then((tasksData) => {
				console.log('📋 Initial tasks loaded:', tasksData);
				dispatch({ type: 'SET_TASKS', payload: tasksData });
			})
			.catch((error) => {
				console.error('❌ Failed to load initial tasks:', error);
				dispatch({
					type: 'SET_ERROR',
					payload: `Failed to load tasks: ${error.message}`
				});
			});
	}, [vscode, sendMessage]);

	const contextValue = {
		vscode,
		state,
		dispatch,
		sendMessage,
		availableHeight,
		// Toast notification functions
		showSuccessToast: showSuccessToast(dispatch),
		showInfoToast: showInfoToast(dispatch),
		showWarningToast: showWarningToast(dispatch),
		showErrorToast: showErrorToast(dispatch)
	};

	return (
		<VSCodeContext.Provider value={contextValue}>
			<ErrorBoundary
				onError={(error, errorInfo) => {
					// Handle React errors and show appropriate toast
					dispatch({
						type: 'ADD_TOAST',
						payload: createToast(
							'error',
							'Component Error',
							`A React component crashed: ${error.message}`,
							10000
						)
					});
				}}
			>
				{/* Conditional rendering for different views */}
				{(() => {
					console.log(
						'🎯 App render - currentView:',
						state.currentView,
						'selectedTaskId:',
						state.selectedTaskId
					);
					return state.currentView === 'task-details' &&
						state.selectedTaskId ? (
						<TaskDetailsView
							taskId={state.selectedTaskId}
							onNavigateBack={() => dispatch({ type: 'NAVIGATE_TO_KANBAN' })}
							onNavigateToTask={(taskId: string) =>
								dispatch({ type: 'NAVIGATE_TO_TASK', payload: taskId })
							}
						/>
					) : (
						<TaskMasterKanban />
					);
				})()}
				<ToastContainer
					notifications={state.toastNotifications}
					onDismiss={(id) => dispatch({ type: 'REMOVE_TOAST', payload: id })}
				/>
			</ErrorBoundary>
		</VSCodeContext.Provider>
	);
};

// Initialize React app
const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
} else {
	console.error('❌ Root container not found');
}
