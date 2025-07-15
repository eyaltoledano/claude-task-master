import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
	createContext,
	useContext
} from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { theme, setTheme, getTheme } from './theme.js';

// Import screens
import { WelcomeScreen } from './components/WelcomeScreen.jsx';
import { TaskManagementScreen } from './components/TaskManagementScreen.jsx';
import { TagManagementScreen } from './components/TagManagementScreen.jsx';
import { StatusScreen } from './components/StatusScreen.jsx';
import { ParsePRDScreen } from './components/ParsePRDScreen.jsx';
import { AnalyzeComplexityScreen } from './components/AnalyzeComplexityScreen.jsx';
import { DependencyVisualizerScreen } from './components/DependencyVisualizerScreen.jsx';
import { SessionsScreen } from './components/SessionsScreen.jsx';
import { Toast } from './shared/components/ui/Toast.jsx';
import { CommandSuggestions } from './components/CommandSuggestions.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { MCPServerManager } from './components/MCPServerManager.jsx';
import { ChatScreen } from './components/ChatScreen.jsx';
import { MCPManagementScreen } from './components/MCPManagementScreen.jsx';
import { NextTaskModal } from './components/NextTaskModal.jsx';
import { WorktreePromptModal } from './components/WorktreePromptModal.jsx';
import { ProvidersScreen } from './components/ProvidersScreen.jsx';
import { ExecutionManagementScreen } from './components/ExecutionManagementScreen.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { OverflowProvider } from './contexts/OverflowContext.jsx';
import { getHookManager } from './shared/hooks/index.js';
import { BranchAwarenessManager } from './services/BranchAwarenessManager.js';
import { initializeHookIntegration } from './services/HookIntegrationService.js';
import { initializeNextTaskService } from './services/NextTaskService.js';
import { getTaskMasterVersion } from '../../../src/utils/getVersion.js';

// Import VibeKit components
import { AgentExecutionScreen } from './components/AgentExecutionScreen.jsx';

// Create context for backend and app state
const AppContext = createContext();

/**
 * Main Flow application component
 * Manages state, screen navigation, and user interactions
 */
export function FlowApp({ backend, options = {} }) {
	const [currentScreen, setCurrentScreen] = useState('welcome');
	const [inputValue, setInputValue] = useState('');
	const [tasks, setTasks] = useState([]);
	const [currentTag, setCurrentTag] = useState('master');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [messages, setMessages] = useState([]);
	const [currentModel, setCurrentModel] = useState(
		'claude-3-5-sonnet-20241022'
	);
	const [notification, setNotification] = useState(null);
	const [currentBackend, setCurrentBackend] = useState(backend);
	const [currentTheme, setCurrentTheme] = useState('auto');
	const [hasTasksFile, setHasTasksFile] = useState(false);
	const [navigationData, setNavigationData] = useState(null);

	const [suggestions, setSuggestions] = useState([]);
	const [suggestionIndex, setSuggestionIndex] = useState(0);
	const [showCommandPalette, setShowCommandPalette] = useState(false);
	const [waitingForShortcut, setWaitingForShortcut] = useState(false);
	const isWaitingForShortcutRef = useRef(false);
	const savedInputRef = useRef('');
	const [inputKey, setInputKey] = useState(0);
	const [nextTask, setNextTask] = useState(null);
	const [showNextTaskModal, setShowNextTaskModal] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [hookManager, setHookManager] = useState(null);
	const [branchManager, setBranchManager] = useState(null);
	const [currentBranch, setCurrentBranch] = useState(null);
	const [repositoryName, setRepositoryName] = useState(null);
	const [branchInfo, setBranchInfo] = useState(null);
	const [remoteInfo, setRemoteInfo] = useState(null);
	const [showWorktreePrompt, setShowWorktreePrompt] = useState(false);
	const [worktreePromptData, setWorktreePromptData] = useState(null);
	const [version, setVersion] = useState('');

	const { exit } = useApp();

	// Helper function to format remote URL for display
	const formatRemoteUrl = (remoteInfo) => {
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
	};

	// Initialize managers and services
	useEffect(() => {
		const initializeServices = async () => {
			try {
				// Get package version
				const pkgVersion = await getTaskMasterVersion();
				setVersion(pkgVersion);

				// Initialize hook manager
				const manager = await getHookManager();
				setHookManager(manager);

				// Initialize branch awareness manager
				const branchMgr = new BranchAwarenessManager(options.projectRoot, { backend });
				setBranchManager(branchMgr);

				// Initialize hook integration
				await initializeHookIntegration(manager);

				// Initialize next task service
				await initializeNextTaskService(backend);

				// Get initial branch info
				const info = await branchMgr.getCurrentBranchInfo();
				if (info) {
					setCurrentBranch(info.name);
					setRepositoryName(branchMgr.repositoryName);
					setBranchInfo(info);
					const remoteInfo = await branchMgr.getRemoteInfo();
					setRemoteInfo(remoteInfo);
				}

				// Check if tasks file exists
				if (backend.hasTasksFile) {
					const hasFile = await backend.hasTasksFile();
					setHasTasksFile(hasFile);
				}

				setLoading(false);
			} catch (error) {
				console.error('Error initializing services:', error);
				setError(error.message);
				setLoading(false);
			}
		};

		initializeServices();
	}, [backend, options.projectRoot]);

	// Load tasks when screen or backend changes
	useEffect(() => {
		const loadTasks = async () => {
			if (currentScreen === 'tasks' && currentBackend) {
				try {
					const result = await currentBackend.getTasks();
					setTasks(result.tasks || []);
					setHasTasksFile(true);
				} catch (error) {
					console.error('Error loading tasks:', error);
					setHasTasksFile(false);
				}
			}
		};

		loadTasks();
	}, [currentScreen, currentBackend]);

	// Input handling
	const handleInput = useCallback(
		async (input) => {
			if (showCommandPalette) {
				setShowCommandPalette(false);
				setInputValue('');
				return;
			}

			if (waitingForShortcut) {
				setWaitingForShortcut(false);
				isWaitingForShortcutRef.current = false;
				setInputValue(savedInputRef.current);
				setInputKey(prev => prev + 1);
				return;
			}

			if (input.trim() === '') {
				return;
			}

			// Handle different input types
			if (input.startsWith('/')) {
				// Command mode
				const command = input.slice(1).toLowerCase();
				handleCommand(command);
			} else {
				// Regular input handling based on current screen
				handleScreenInput(input);
			}

			setInputValue('');
			setSuggestions([]);
			setSuggestionIndex(0);
		},
		[showCommandPalette, waitingForShortcut]
	);

	const handleCommand = (command) => {
		switch (command) {
			case 'tasks':
				setCurrentScreen('tasks');
				break;
			case 'tags':
				setCurrentScreen('tags');
				break;
			case 'status':
				setCurrentScreen('status');
				break;
			case 'parse':
				setCurrentScreen('parse');
				break;
			case 'analyze':
				setCurrentScreen('analyze');
				break;
			case 'deps':
				setCurrentScreen('dependencies');
				break;
			case 'sessions':
				setCurrentScreen('sessions');
				break;
			case 'chat':
				setCurrentScreen('chat');
				break;
			case 'mcp':
				setCurrentScreen('mcp');
				break;
			case 'providers':
				setCurrentScreen('providers');
				break;
			case 'executions':
				setCurrentScreen('executions');
				break;
			case 'welcome':
			case 'home':
				setCurrentScreen('welcome');
				break;
			case 'exit':
			case 'quit':
				exit();
				break;
			default:
				setNotification({
					message: `Unknown command: ${command}`,
					type: 'error',
					duration: 3000
				});
		}
	};

	const handleScreenInput = (input) => {
		// Screen-specific input handling
		switch (currentScreen) {
			case 'welcome':
				// Handle welcome screen input
				break;
			case 'tasks':
				// Handle task management input
				break;
			default:
				setNotification({
					message: `Input not handled for screen: ${currentScreen}`,
					type: 'warning',
					duration: 3000
				});
		}
	};

	const handleTextInputChange = useCallback(
		(value) => {
			setInputValue(value);
			
			// Generate suggestions based on input
			if (value.startsWith('/')) {
				const command = value.slice(1).toLowerCase();
				const commands = ['tasks', 'tags', 'status', 'parse', 'analyze', 'deps', 'sessions', 'chat', 'mcp', 'providers', 'executions', 'welcome', 'exit'];
				const filtered = commands.filter(cmd => cmd.startsWith(command));
				setSuggestions(filtered.map(cmd => `/${cmd}`));
				setSuggestionIndex(0);
			} else {
				setSuggestions([]);
			}
		},
		[]
	);

	// Keyboard shortcuts
	useInput((input, key) => {
		if (showCommandPalette) {
			if (key.escape) {
				setShowCommandPalette(false);
			}
			return;
		}

		if (waitingForShortcut) {
			if (key.escape) {
				setWaitingForShortcut(false);
				isWaitingForShortcutRef.current = false;
				setInputValue(savedInputRef.current);
				setInputKey(prev => prev + 1);
				return;
			}
			return;
		}

		// Global shortcuts
		if (key.ctrl && input === 'x') {
			setWaitingForShortcut(true);
			isWaitingForShortcutRef.current = true;
			savedInputRef.current = inputValue;
			setInputValue('');
			setInputKey(prev => prev + 1);
			return;
		}

		if (key.ctrl && input === 'p') {
			setShowCommandPalette(true);
			return;
		}

		if (key.ctrl && input === 'c') {
			exit();
			return;
		}

		// Navigation shortcuts
		if (key.ctrl && input === 'n') {
			// Next task shortcut
			if (hasTasksFile) {
				setShowNextTaskModal(true);
			}
			return;
		}

		// Suggestion navigation
		if (suggestions.length > 0) {
			if (key.upArrow) {
				setSuggestionIndex(prev => Math.max(0, prev - 1));
			} else if (key.downArrow) {
				setSuggestionIndex(prev => Math.min(suggestions.length - 1, prev + 1));
			} else if (key.tab) {
				if (suggestions[suggestionIndex]) {
					setInputValue(suggestions[suggestionIndex]);
					setSuggestions([]);
				}
			}
		}
	});

	if (loading) {
		return (
			<Box justifyContent="center" alignItems="center" height="100%">
				<Text>Loading Flow...</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box justifyContent="center" alignItems="center" height="100%">
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	// Create context value
	const contextValue = {
		backend,
		currentScreen,
		setCurrentScreen,
		tasks,
		setTasks,
		currentTag,
		setCurrentTag,
		loading,
		setLoading,
		error,
		setError,
		inputValue,
		setInputValue,
		messages,
		setMessages,
		hasTasksFile,
		setHasTasksFile,
		notification,
		setNotification,
		showCommandPalette,
		setShowCommandPalette,
		showNextTaskModal,
		setShowNextTaskModal,
		nextTask,
		setNextTask,
		showWorktreePrompt,
		setShowWorktreePrompt,
		worktreePromptData,
		setWorktreePromptData,
		showSettings,
		setShowSettings,
		suggestions,
		setSuggestions,
		suggestionIndex,
		setSuggestionIndex,
		waitingForShortcut,
		setWaitingForShortcut,
		inputKey,
		setInputKey
	};

	return (
		<AppContext.Provider value={contextValue}>
			<OverflowProvider>
				<Box flexDirection="column" height="100%">
				{/* Command Palette */}
				{showCommandPalette && (
					<CommandPalette
						onClose={() => setShowCommandPalette(false)}
						onCommand={handleCommand}
					/>
				)}

				{/* Settings Modal */}
				{showSettings && (
					<SettingsModal
						onClose={() => setShowSettings(false)}
						backend={currentBackend}
						currentTheme={currentTheme}
						onThemeChange={setCurrentTheme}
					/>
				)}

				{/* Next Task Modal */}
				{showNextTaskModal && (
					<NextTaskModal
						backend={currentBackend}
						onClose={() => setShowNextTaskModal(false)}
						onTaskSelect={(task) => {
							setNavigationData({ taskId: task.id, mode: 'execute' });
							setCurrentScreen('agent-execution');
							setShowNextTaskModal(false);
						}}
					/>
				)}

				{/* Screen Content */}
				{currentScreen === 'tasks' ? (
					<TaskManagementScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
						onTaskSelect={(taskId) => {
							setNavigationData({ taskId, mode: 'execute' });
							setCurrentScreen('agent-execution');
						}}
					/>
				) : currentScreen === 'tags' ? (
					<TagManagementScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
						currentTag={currentTag}
						onTagChange={setCurrentTag}
					/>
				) : currentScreen === 'status' ? (
					<StatusScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
					/>
				) : currentScreen === 'parse' ? (
					<ParsePRDScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
						onSuccess={() => {
							setNotification({
								message: 'PRD parsed successfully',
								type: 'success',
								duration: 3000
							});
							setCurrentScreen('tasks');
						}}
					/>
				) : currentScreen === 'analyze' ? (
					<AnalyzeComplexityScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
					/>
				) : currentScreen === 'dependencies' ? (
					<DependencyVisualizerScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
					/>
				) : currentScreen === 'chat' ? (
					<ChatScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
						messages={messages}
						onMessagesChange={setMessages}
						currentModel={currentModel}
						onModelChange={setCurrentModel}
					/>
				) : currentScreen === 'mcp' ? (
					<MCPManagementScreen
						backend={currentBackend}
						onBack={() => setCurrentScreen('welcome')}
						onBackendSwitch={async (newBackend) => {
							try {
								await newBackend.initialize();
								setCurrentBackend(newBackend);
								setNotification({
									message: 'Backend switched successfully',
									type: 'success',
									duration: 3000
								});
							} catch (error) {
								setNotification({
									message: `Failed to switch backend: ${error.message}`,
									type: 'error',
									duration: 5000
								});
							}
						}}
						log={currentBackend.log}
					/>
				) : currentScreen === 'providers' ? (
					<ProvidersScreen
						onBack={() => setCurrentScreen('welcome')}
						onError={(errorMessage) => {
							setNotification({
								message: errorMessage,
								type: 'error',
								duration: 5000
							});
						}}
					/>
				) : currentScreen === 'executions' ? (
					<ExecutionManagementScreen
						onBack={() => setCurrentScreen('welcome')}
					/>
				) : currentScreen === 'agent-execution' ? (
					<AgentExecutionScreen
						backend={currentBackend}
						initialAgent={navigationData?.initialAgent || 'claude'}
						taskId={navigationData?.taskId}
						mode={navigationData?.mode || 'list'}
					/>
				) : (
					<>
						{/* Main content area */}
						<Box flexGrow={1} flexDirection="column">
							{/* Dynamic screen rendering */}
							{currentScreen === 'welcome' && <WelcomeScreen />}
							{currentScreen === 'sessions' && <SessionsScreen />}

							{/* Notification toast */}
							{notification && (
								<Toast
									message={notification.message}
									type={notification.type}
									duration={notification.duration}
									onDismiss={() => setNotification(null)}
								/>
							)}
						</Box>

						{/* Bottom input bar */}
						<Box flexDirection="column" flexShrink={0}>
							{/* Command suggestions */}
							{suggestions.length > 0 && (
								<Box flexDirection="column">
									<Box
										borderStyle="single"
										borderColor={theme.text.tertiary}
										borderBottom={false}
										paddingLeft={1}
										paddingRight={1}
									>
										<CommandSuggestions
											suggestions={suggestions}
											selectedIndex={suggestionIndex}
										/>
									</Box>
								</Box>
							)}

							{/* Input bar */}
							<Box flexDirection="column">
								<Box
									borderStyle="single"
									borderColor={theme.text.tertiary}
									paddingLeft={1}
									paddingRight={1}
								>
									<Box width="100%">
										<Text color="cyan">❯ </Text>
										<Box flexGrow={1}>
											<TextInput
												key={inputKey}
												value={inputValue}
												onChange={handleTextInputChange}
												onSubmit={handleInput}
												placeholder={
													waitingForShortcut
														? 'Waiting for command key...'
														: 'Type / for commands or use Ctrl+X shortcuts'
												}
											/>
										</Box>
									</Box>
								</Box>
							</Box>

							{/* Bottom status bar */}
							<Box paddingLeft={1} paddingRight={1} flexDirection="row" justifyContent="space-between" width="100%">
								<Box>
									<Text>
										<Text color={theme.text.tertiary}>[tag] </Text>
										<Text color={theme.text.accent}>{currentTag}</Text>
										{repositoryName && (
											<>
												<Text color={theme.text.tertiary}> • [repo] </Text>
												<Text>{repositoryName}</Text>
											</>
										)}
										{currentBranch && (
											<>
												<Text color={theme.text.tertiary}> • [branch] </Text>
												<Text>{currentBranch}</Text>
											</>
										)}
										{remoteInfo && formatRemoteUrl(remoteInfo) && (
											<>
												<Text color={theme.text.tertiary}> • [remote] </Text>
												<Text>{formatRemoteUrl(remoteInfo)}</Text>
											</>
										)}
									</Text>
								</Box>
								<Box>
									<Text color={theme.text.muted}>
										Task Master AI v{version}
									</Text>
								</Box>
							</Box>
						</Box>
					</>
				)}
			</Box>
		</OverflowProvider>
		</AppContext.Provider>
	);
}

// Export context hook
export function useAppContext() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('useAppContext must be used within AppContext.Provider');
	}
	return context;
} 