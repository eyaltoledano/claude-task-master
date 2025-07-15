import React, {
	useEffect,
	useCallback,
	useRef,
	createContext,
	useContext
} from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { spawn } from 'child_process';
import { theme, setTheme, getTheme } from '../shared/theme/theme.js';

// Import screens
import { WelcomeScreen } from '../components/WelcomeScreen.jsx';
import { 
  TaskManagementScreen,
  TagManagementScreen,
  AnalyzeComplexityScreen,
  DependencyVisualizerScreen
} from '../features/tasks/index.js';
import { StatusScreen } from '../components/StatusScreen.jsx';
import { ParsePRDScreen } from '../components/ParsePRDScreen.jsx';
import { SessionsScreen } from '../components/SessionsScreen.jsx';
import { Toast } from '../shared/components/ui/Toast.jsx';
import { CommandSuggestions } from '../features/ui';
import { CommandPalette } from '../features/ui';
import { MCPServerManager } from '../components/MCPServerManager.jsx';
import { ChatScreen } from '../features/chat';
import { WorkflowGuide } from '../features/workflows';
import { MCPManagementScreen } from '../components/MCPManagementScreen.jsx';
import { NextTaskModal } from '../features/tasks/index.js';
import { WorktreePromptModal } from '../components/WorktreePromptModal.jsx';
import { ProvidersScreen } from '../components/ProvidersScreen.jsx';
import { ExecutionManagementScreen } from '../components/ExecutionManagementScreen.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import { OverflowProvider } from '../shared/contexts/OverflowContext.jsx';
import { useServices } from '../shared/contexts/ServiceContext.jsx';
import { initializeHookIntegration } from '../features/hooks/services/HookIntegrationService.js';
import { initializeNextTaskService } from '../features/tasks/services/NextTaskService.js';
import { getTaskMasterVersion } from '../../../../src/utils/getVersion.js';

// Import VibeKit components
import { AgentExecutionScreen } from '../components/AgentExecutionScreen.jsx';

// Import error boundaries
import { 
  GlobalErrorHandler,
  NavigationErrorBoundary,
  ServiceErrorBoundary
} from '../shared/components/error-boundaries/index.js';

// Import performance utilities
import { useRenderTracking, usePerformanceTiming } from '../shared/hooks/usePerformance.js';
import { globalMemoryMonitor } from '../shared/utils/performance.js';

// Import Zustand hooks - this replaces all the useState calls!
import {
  useCurrentScreen,
  useNotification,
  useLoading,
  useError,
  useModals,
  useInputState,
  useNavigationState,
  useTasks,
  useCurrentTag,
  useNextTask,
  useHasTasksFile,
  useGitInfo,
  useMessages,
  useCurrentModel,
  useVersion,
  useTheme,
  useCurrentBackend,
  useUIActions,
  useDataActions,
  useNavigationActions,
  usePreferencesActions,
  useAppState
} from '../hooks/use-selectors.js';

// Create context for backend and app state
const AppContext = createContext();

/**
 * Main Flow application component
 * Now uses Zustand stores for state management instead of 24+ useState calls
 */
export function FlowApp({ options = {} }) {
	// Performance tracking
	const trackRender = useRenderTracking('FlowApp');
	const { measureAsync } = usePerformanceTiming('FlowApp');

	// Get services from context
	const services = useServices();
	const { backend, logger, branchManager, hookManager } = services;

	// Use Zustand selectors instead of useState - this prevents unnecessary re-renders!
	const currentScreen = useCurrentScreen();
	const notification = useNotification();
	const loading = useLoading();
	const error = useError();
	const modals = useModals();
	const inputState = useInputState();
	const navigationState = useNavigationState();
	const tasks = useTasks();
	const currentTag = useCurrentTag();
	const nextTask = useNextTask();
	const hasTasksFile = useHasTasksFile();
	const gitInfo = useGitInfo();
	const messages = useMessages();
	const currentModel = useCurrentModel();
	const version = useVersion();
	const currentTheme = useTheme();
	const currentBackend = useCurrentBackend();
	const appState = useAppState();

	// Get action functions - these are stable references and won't cause re-renders
	const uiActions = useUIActions();
	const dataActions = useDataActions();
	const navigationActions = useNavigationActions();
	const preferencesActions = usePreferencesActions();

	// Keep refs for functionality that needs them
	const isWaitingForShortcutRef = useRef(false);
	const savedInputRef = useRef('');

	const { exit } = useApp();

	// Helper function to format remote URL for display
	const formatRemoteUrl = useCallback((remoteInfo) => {
		if (!remoteInfo || !remoteInfo.hasRemote || !remoteInfo.url) {
			return null;
		}

		let url = remoteInfo.url;
		
		// Remove .git suffix if present
		if (url.endsWith('.git')) {
			url = url.slice(0, -4);
		}

		// Handle different URL formats
		if (url.startsWith('git@')) {
			// git@github.com:user/repo -> github.com/user/repo
			url = url.replace('git@', '').replace(':', '/');
		} else if (url.startsWith('https://')) {
			// https://github.com/user/repo -> github.com/user/repo
			// https://username@github.com/user/repo -> github.com/user/repo
			url = url.replace('https://', '');
			
			// Remove username@ if present
			if (url.includes('@')) {
				url = url.split('@')[1];
			}
		}

		return url;
	}, []);

	// Check for completion message from restart
	useEffect(() => {
		if (options.completedSetup) {
			const messages = {
				models: '✓ Model configuration complete!',
				rules: '✓ Rules configuration complete!',
				init: '✓ Project initialization complete!'
			};

			uiActions.setNotification({
				message: messages[options.completedSetup] || `✓ ${options.completedSetup} complete!`,
				type: 'success',
				duration: 3000
			});
		}
	}, [options.completedSetup, uiActions.setNotification]);

	// Initialize services and get initial data - now much cleaner!
	const initializeApp = useCallback(async () => {
		try {
			// Take initial memory snapshot
			globalMemoryMonitor.snapshot('app-start');

			// Get package version
			const pkgVersion = await getTaskMasterVersion();
			dataActions.setVersion(pkgVersion);

			// Initialize hook integration
			await initializeHookIntegration(hookManager);

			// Initialize next task service
			await initializeNextTaskService(backend);

			// Get initial branch info
			const info = await branchManager.getCurrentBranchInfo();
			if (info) {
				dataActions.setBranchInfo(info);
				dataActions.setRepositoryName(branchManager.repositoryName);
				const remoteInfo = await branchManager.getRemoteInfo();
				dataActions.setRemoteInfo(remoteInfo);
			}

			// Check if tasks file exists
			if (backend.hasTasksFile) {
				const hasFile = await backend.hasTasksFile();
				dataActions.setHasTasksFile(hasFile);
			}

			// Update backend in preferences
			preferencesActions.setCurrentBackend(backend);

			uiActions.setLoading(false);
		} catch (error) {
			console.error('Error initializing services:', error);
			uiActions.setError(error.message);
			uiActions.setLoading(false);
		}
	}, [backend, hookManager, branchManager, dataActions, uiActions, preferencesActions]);

	useEffect(() => {
		initializeApp();
	}, [initializeApp]);

	// Sync refs with Zustand state
	useEffect(() => {
		isWaitingForShortcutRef.current = inputState.waitingForShortcut;
	}, [inputState.waitingForShortcut]);

	// Screen renderer - much cleaner logic now
	const renderScreen = useCallback(() => {
		if (loading) {
			return (
				<Box flexDirection="column" alignItems="center" justifyContent="center">
					<Text>Loading Task Master Flow...</Text>
					{version && <Text dimColor>v{version}</Text>}
				</Box>
			);
		}

		if (error) {
			return (
				<Box flexDirection="column" padding={1}>
					<Text color="red">Error: {error}</Text>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			);
		}

		// Screen rendering logic based on currentScreen
		switch (currentScreen) {
			case 'welcome':
				return (
					<WelcomeScreen
						onNavigate={navigationActions.navigateTo}
						hasTasksFile={hasTasksFile}
						currentBranch={gitInfo.currentBranch}
						repositoryName={gitInfo.repositoryName}
						remoteInfo={gitInfo.remoteInfo}
						version={version}
						formatRemoteUrl={formatRemoteUrl}
					/>
				);

			case 'tasks':
				return (
					<TaskManagementScreen
						onBack={() => navigationActions.goBack()}
						navigationData={navigationState.navigationData}
					/>
				);

			case 'status':
				return (
					<StatusScreen
						onBack={() => navigationActions.goBack()}
						tasks={tasks}
						currentTag={currentTag}
					/>
				);

			case 'parse-prd':
				return (
					<ParsePRDScreen
						onBack={() => navigationActions.goBack()}
						onComplete={(result) => {
							uiActions.setNotification({
								message: '✓ PRD parsed successfully!',
								type: 'success',
								duration: 3000
							});
							navigationActions.navigateTo('tasks');
						}}
					/>
				);

			case 'chat':
				return (
					<ChatScreen
						onBack={() => navigationActions.goBack()}
						messages={messages}
						onSendMessage={dataActions.addMessage}
						currentModel={currentModel}
					/>
				);

			case 'workflow':
				return (
					<WorkflowGuide
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'sessions':
				return (
					<SessionsScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'providers':
				return (
					<ProvidersScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'execution':
				return (
					<ExecutionManagementScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'agent':
				return (
					<AgentExecutionScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'mcp':
				return (
					<MCPManagementScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'analyze-complexity':
				return (
					<AnalyzeComplexityScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'dependency-visualizer':
				return (
					<DependencyVisualizerScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			case 'tag-management':
				return (
					<TagManagementScreen
						onBack={() => navigationActions.goBack()}
					/>
				);

			default:
				return (
					<Box flexDirection="column" padding={1}>
						<Text color="red">Unknown screen: {currentScreen}</Text>
						<Text dimColor>Press 'h' to go to welcome screen</Text>
					</Box>
				);
		}
	}, [
		loading,
		error,
		currentScreen,
		hasTasksFile,
		gitInfo,
		version,
		formatRemoteUrl,
		navigationActions,
		navigationState.navigationData,
		tasks,
		currentTag,
		messages,
		currentModel,
		uiActions,
		dataActions
	]);

	// Input handling - now with Zustand actions
	useInput((input, key) => {
		// Handle global shortcuts
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}

		// Command palette shortcut
		if (key.ctrl && input === 'k') {
			uiActions.setShowCommandPalette(!modals.showCommandPalette);
			return;
		}

		// Settings shortcut
		if (input === ',' && !inputState.waitingForShortcut) {
			uiActions.setShowSettings(!modals.showSettings);
			return;
		}

		// Navigation shortcuts
		if (!inputState.waitingForShortcut && !modals.showCommandPalette && !modals.showSettings) {
			switch (input) {
				case 'h':
					navigationActions.navigateTo('welcome');
					break;
				case 't':
					navigationActions.navigateTo('tasks');
					break;
				case 's':
					navigationActions.navigateTo('status');
					break;
				case 'c':
					navigationActions.navigateTo('chat');
					break;
				case 'w':
					navigationActions.navigateTo('workflow');
					break;
				case 'p':
					navigationActions.navigateTo('parse-prd');
					break;
				case 'q':
					exit();
					break;
			}
		}
	});

	// Context value
	const contextValue = {
		// State
		currentScreen,
		loading,
		error,
		notification,
		tasks,
		currentTag,
		nextTask,
		hasTasksFile,
		gitInfo,
		messages,
		currentModel,
		version,
		currentTheme,
		inputState,
		modals,
		
		// Actions
		...uiActions,
		...dataActions,
		...navigationActions,
		...preferencesActions,
		
		// Services
		backend,
		logger,
		branchManager,
		hookManager,
		
		// Utilities
		formatRemoteUrl,
		exit
	};

	return (
		<AppContext.Provider value={contextValue}>
			<OverflowProvider>
				<GlobalErrorHandler>
					<ServiceErrorBoundary>
						<NavigationErrorBoundary>
							<Box flexDirection="column" height="100%">
								{renderScreen()}
								
								{/* Modals and overlays */}
								{modals.showCommandPalette && (
									<CommandPalette
										onClose={() => uiActions.setShowCommandPalette(false)}
										onNavigate={navigationActions.navigateTo}
									/>
								)}

								{modals.showNextTaskModal && nextTask && (
									<NextTaskModal
										task={nextTask}
										onClose={() => uiActions.setShowNextTaskModal(false)}
										onStart={(taskId) => {
											// Handle task start
											navigationActions.navigateTo('tasks', { taskId });
											uiActions.setShowNextTaskModal(false);
										}}
									/>
								)}

								{modals.showSettings && (
									<SettingsModal
										onClose={() => uiActions.setShowSettings(false)}
										currentTheme={currentTheme}
										onThemeChange={preferencesActions.setCurrentTheme}
									/>
								)}

								{modals.showWorktreePrompt && (
									<WorktreePromptModal
										data={navigationState.navigationData}
										onClose={() => uiActions.setShowWorktreePrompt(false)}
										onConfirm={(action) => {
											// Handle worktree action
											uiActions.setShowWorktreePrompt(false);
										}}
									/>
								)}

								{/* Notification toast */}
								{notification && (
									<Toast
										message={notification.message}
										type={notification.type}
										duration={notification.duration}
										onDismiss={uiActions.clearNotification}
									/>
								)}
							</Box>
						</NavigationErrorBoundary>
					</ServiceErrorBoundary>
				</GlobalErrorHandler>
			</OverflowProvider>
		</AppContext.Provider>
	);
}

// Export context hook for child components
export const useAppContext = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('useAppContext must be used within FlowApp');
	}
	return context;
}; 