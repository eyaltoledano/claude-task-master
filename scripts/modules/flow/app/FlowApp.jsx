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
import { MCPManagementScreen } from '../features/mcp/components/MCPManagementScreen.jsx';
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
import {
	useRenderTracking,
	usePerformanceTiming
} from '../shared/hooks/usePerformance.js';
import { globalMemoryMonitor } from '../shared/utils/performance.js';

// Create context for backend and app state
const AppContext = createContext();

/**
 * Main Flow application component
 * Manages state, screen navigation, and user interactions
 */
export function FlowApp({ options = {} }) {
	// Performance tracking
	const trackRender = useRenderTracking('FlowApp');
	const { measureAsync } = usePerformanceTiming('FlowApp');

	// Get services from context
	const services = useServices();
	const { backend, logger, branchManager, hookManager } = services;

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

	// Check for completion message from restart
	useEffect(() => {
		if (options.completedSetup) {
			const message =
				options.completedSetup === 'models'
					? '✓ Model configuration complete!'
					: options.completedSetup === 'rules'
						? '✓ Rules configuration complete!'
						: options.completedSetup === 'init'
							? '✓ Project initialization complete!'
							: `✓ ${options.completedSetup} complete!`;

			setNotification({
				message,
				type: 'success',
				duration: 3000
			});
		}
	}, [options.completedSetup]);

	// Initialize services and get initial data
	useEffect(() => {
		const initializeApp = async () => {
			try {
				// Take initial memory snapshot
				globalMemoryMonitor.snapshot('app-start');

				// Get package version
				const pkgVersion = await getTaskMasterVersion();
				setVersion(pkgVersion);

				// Initialize hook integration
				await initializeHookIntegration(hookManager);

				// Initialize next task service
				await initializeNextTaskService(backend);

				// Get initial branch info
				const info = await branchManager.getCurrentBranchInfo();
				if (info) {
					setCurrentBranch(info.name);
					setRepositoryName(branchManager.repositoryName);
					setBranchInfo(info);
					const remoteInfo = await branchManager.getRemoteInfo();
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

		initializeApp();
	}, [backend, branchManager, hookManager]);

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

	// Launch external setup command
	const launchSetupCommand = (command, args = []) => {
		// Show a transition message
		console.clear();
		console.log('\n\n');
		console.log(
			'  ╔════════════════════════════════════════════════════════════════╗'
		);
		console.log(
			`  ║  Launching ${command === 'models' ? 'AI Model Configuration' : command === 'rules' ? 'AI Rules Configuration' : 'Project Initialization'}...                      ║`
		);
		console.log(
			'  ║  You will return to Task Master Flow when complete.           ║'
		);
		console.log(
			'  ╚════════════════════════════════════════════════════════════════╝'
		);
		console.log('\n\n');

		// Exit the TUI temporarily to run the interactive setup
		exit();

		// Small delay for visual effect
		setTimeout(() => {
			// Spawn the command
			const proc = spawn('node', ['scripts/dev.js', command, ...args], {
				stdio: 'inherit',
				shell: true
			});

			proc.on('close', (code) => {
				// After setup completes, restart the flow interface
				console.log('\nReturning to Task Master Flow...\n');

				// Small delay to ensure clean terminal state
				setTimeout(async () => {
					// Re-run the flow interface with a flag indicating what was completed
					try {
						const { run } = await import('./cli.js');
						await run({ ...options, completedSetup: command });
					} catch (error) {
						console.error('Error restarting flow:', error);
						process.exit(1);
					}
				}, 500);
			});
		}, 100);
	};

	// Define available commands based on whether tasks.json exists
	const getAvailableCommands = useCallback(() => {
		const baseCommands = [
			{ name: '/init', description: 'Initialize a new Task Master project' },
			{ name: '/parse', description: 'Parse PRD to generate tasks' },
			{ name: '/tags', description: 'Manage task tags' },
			{ name: '/next', description: 'Show next task to work on' },
			{ name: '/exec', description: 'Manage task executions' },
			{ name: '/mcp', description: 'Manage MCP servers' },
			{ name: '/chat', description: 'Chat with AI assistant' },
			{ name: '/status', description: 'View project status details' },
			{ name: '/models', description: 'Configure AI models' },
			{ name: '/rules', description: 'Configure AI assistant rules' },
			{ name: '/theme', description: 'Toggle theme (auto/light/dark)' },
			{ name: '/exit', description: 'Exit Task Master Flow' },
			{ name: '/quit', description: 'Exit Task Master Flow' }
		];

		// Only include task-related commands if tasks.json exists
		if (hasTasksFile) {
			baseCommands.splice(
				2,
				0,
				{ name: '/analyze', description: 'Analyze task complexity' },
				{ name: '/deps', description: 'Visualize task dependencies' },
				{ name: '/tasks', description: 'Interactive task management' }
			);
		}

		return baseCommands;
	}, [hasTasksFile]);

	// Input handling
	const handleInput = useCallback(
		async (value) => {
			const trimmedValue = value.trim();

			if (showCommandPalette) {
				setShowCommandPalette(false);
				setInputValue('');
				return;
			}

			if (waitingForShortcut) {
				setWaitingForShortcut(false);
				isWaitingForShortcutRef.current = false;
				setInputValue(savedInputRef.current);
				setInputKey((prev) => prev + 1);
				return;
			}

			if (trimmedValue === '') {
				return;
			}

			// If we have suggestions and one is selected, use that instead
			if (
				suggestions.length > 0 &&
				suggestionIndex >= 0 &&
				suggestionIndex < suggestions.length
			) {
				value = suggestions[suggestionIndex].name;
			}

			// Handle different input types
			if (value.startsWith('/')) {
				// Command mode
				const command = value.slice(1).toLowerCase();
				handleCommand(command);
			} else {
				// Regular input handling based on current screen
				handleScreenInput(value);
			}

			setInputValue('');
			setSuggestions([]);
			setSuggestionIndex(0);
		},
		[showCommandPalette, waitingForShortcut, suggestions, suggestionIndex]
	);

	const handleCommand = (command) => {
		switch (command) {
			case 'init':
				// Launch the interactive init command
				launchSetupCommand('init', []);
				break;
			case 'parse':
				setCurrentScreen('parse');
				break;
			case 'analyze':
				if (hasTasksFile) {
					setCurrentScreen('analyze');
				} else {
					setNotification({
						message: 'No tasks.json found. Use /parse to create tasks first.',
						type: 'warning',
						duration: 3000
					});
				}
				break;
			case 'deps':
				if (hasTasksFile) {
					setCurrentScreen('dependencies');
				} else {
					setNotification({
						message: 'No tasks.json found. Use /parse to create tasks first.',
						type: 'warning',
						duration: 3000
					});
				}
				break;
			case 'tasks':
				if (hasTasksFile) {
					setCurrentScreen('tasks');
				} else {
					setNotification({
						message: 'No tasks.json found. Use /parse to create tasks first.',
						type: 'warning',
						duration: 3000
					});
				}
				break;
			case 'tags':
				setCurrentScreen('tags');
				break;
			case 'mcp':
				setCurrentScreen('mcp');
				break;
			case 'status':
				setCurrentScreen('status');
				break;
			case 'next':
				if (hasTasksFile) {
					// Fetch the next task
					(async () => {
						try {
							const nextTaskResult = await currentBackend.nextTask();
							setNextTask(nextTaskResult.task || null);
							setShowNextTaskModal(true);
						} catch (error) {
							setNotification({
								message: `Error getting next task: ${error.message}`,
								type: 'error',
								duration: 3000
							});
						}
					})();
				} else {
					setNotification({
						message: 'No tasks.json found. Use /parse to create tasks first.',
						type: 'warning',
						duration: 3000
					});
				}
				break;
			case 'theme': {
				// Cycle through auto -> light -> dark -> auto
				let newTheme;
				if (currentTheme === 'auto') {
					newTheme = 'light';
				} else if (currentTheme === 'light') {
					newTheme = 'dark';
				} else {
					newTheme = 'auto';
				}

				setTheme(newTheme);
				setCurrentTheme(newTheme);

				let themeMessage;
				if (newTheme === 'auto') {
					const isDark = theme === getTheme('dark');
					themeMessage = `Switched to auto theme detection (currently using ${isDark ? 'dark mode' : 'light mode'})`;
				} else if (newTheme === 'dark') {
					themeMessage =
						'Switched to dark mode (light text on dark background)';
				} else {
					themeMessage =
						'Switched to light mode (dark text on light background)';
				}

				setNotification({
					message: themeMessage,
					type: 'success',
					duration: 3000
				});
				break;
			}
			case 'models':
				// Launch the interactive models setup
				launchSetupCommand('models', ['--setup']);
				break;
			case 'rules':
				// Launch the interactive rules setup
				launchSetupCommand('rules', ['--setup']);
				break;
			case 'chat':
				setCurrentScreen('chat');
				break;
			case 'exec':
			case 'executions':
				setCurrentScreen('executions');
				break;
			case 'exit':
			case 'quit':
				exit();
				break;
			case 'sessions':
				setCurrentScreen('sessions');
				break;
			case 'providers':
				setCurrentScreen('providers');
				break;
			case 'welcome':
			case 'home':
				setCurrentScreen('welcome');
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
			// If we're in shortcut mode, don't update the input
			if (isWaitingForShortcutRef.current) {
				return;
			}

			setInputValue(value);

			// Generate suggestions based on input
			if (value.startsWith('/')) {
				const availableCommands = getAvailableCommands();
				const filtered = availableCommands.filter((cmd) =>
					cmd.name.toLowerCase().startsWith(value.toLowerCase())
				);
				setSuggestions(filtered);
				setSuggestionIndex(0);
			} else {
				setSuggestions([]);
			}
		},
		[getAvailableCommands]
	);

	// Function to reload tasks
	const reloadTasks = useCallback(async () => {
		try {
			// Check if tasks.json exists first
			const hasFile = await currentBackend.hasTasksFile();
			setHasTasksFile(hasFile);

			if (hasFile) {
				const result = await currentBackend.listTasks();
				setTasks(result.tasks);
				setCurrentTag(result.tag);
			} else {
				setTasks([]);
			}
		} catch (err) {
			setError(err.message);
		}
	}, [currentBackend]);

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
				setInputKey((prev) => prev + 1);
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
			setInputKey((prev) => prev + 1);
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
				setSuggestionIndex((prev) => Math.max(0, prev - 1));
			} else if (key.downArrow) {
				setSuggestionIndex((prev) =>
					Math.min(suggestions.length - 1, prev + 1)
				);
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
		reloadTasks,
		navigationData,
		setNavigationData,
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
			<GlobalErrorHandler>
				<ServiceErrorBoundary serviceName="FlowApp">
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
									mcpClient={currentBackend}
									projectRoot={currentBackend?.getProjectRoot()}
									onExit={() => setCurrentScreen('welcome')}
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
										<NavigationErrorBoundary>
											{currentScreen === 'welcome' && <WelcomeScreen />}
											{currentScreen === 'sessions' && <SessionsScreen />}
										</NavigationErrorBoundary>

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
										<Box
											paddingLeft={1}
											paddingRight={1}
											flexDirection="row"
											justifyContent="space-between"
											width="100%"
										>
											<Box>
												<Text>
													<Text color={theme.accent}>[tag] </Text>
													<Text color={theme.text.accent}>{currentTag}</Text>
													{repositoryName && (
														<>
															<Text color={theme.accent}> • [repo] </Text>
															<Text>{repositoryName}</Text>
														</>
													)}
													{currentBranch && (
														<>
															<Text color={theme.accent}> • [branch] </Text>
															<Text>{currentBranch}</Text>
														</>
													)}
													{remoteInfo && formatRemoteUrl(remoteInfo) && (
														<>
															<Text color={theme.accent}> • [remote] </Text>
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
				</ServiceErrorBoundary>
			</GlobalErrorHandler>
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
