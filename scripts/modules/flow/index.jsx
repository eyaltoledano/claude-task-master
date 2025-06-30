#!/usr/bin/env node
import React, {
	useState,
	useEffect,
	createContext,
	useContext,
	useRef
} from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { spawn } from 'child_process';
import { DirectBackend } from './backends/direct-backend.js';
import { CliBackend } from './backends/cli-backend.js';
import { theme, setTheme, getTheme } from './theme.js';
import { MCPClientBackend } from './backends/mcp-client-backend.js';

// Import screens
import { WelcomeScreen } from './components/WelcomeScreen.jsx';
import { TaskManagementScreen } from './components/TaskManagementScreen.jsx';
import { TagManagementScreen } from './components/TagManagementScreen.jsx';
import { StatusScreen } from './components/StatusScreen.jsx';
import { ParsePRDScreen } from './components/ParsePRDScreen.jsx';
import { AnalyzeComplexityScreen } from './components/AnalyzeComplexityScreen.jsx';
import { SessionsScreen } from './components/SessionsScreen.jsx';
import { Toast } from './components/Toast.jsx';
import { CommandSuggestions } from './components/CommandSuggestions.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { MCPServerManager } from './components/MCPServerManager.jsx';
import { ChatScreen } from './components/ChatScreen.jsx';
import { MCPManagementScreen } from './components/MCPManagementScreen.jsx';
import { NextTaskModal } from './components/NextTaskModal.jsx';
import GitWorktreeScreen from './components/GitWorktreeScreen.jsx';
import { ClaudeCodeScreen } from './components/ClaudeCodeScreen.jsx';
import { WorktreePromptModal } from './components/WorktreePromptModal.jsx';
import { OverflowProvider } from './contexts/OverflowContext.jsx';

// Create context for backend and app state
const AppContext = createContext();

/**
 * Main Flow App Component - OpenCode Style
 */
function FlowApp({ backend, options = {} }) {
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

	const { exit } = useApp();

	// Handle navigation from other screens
	const handleNavigateToTask = (task) => {
		if (task) {
			const navData = {
				selectedTaskId: task.parentId ? task.parentId : task.id,
				selectedSubtaskId: task.parentId ? task.id : null
			};
			setNavigationData(navData);
			setCurrentScreen('tasks'); // Switch to task screen
		}
	};

	// Define available commands based on whether tasks.json exists
	const getAvailableCommands = () => {
		const baseCommands = [
			{ name: '/init', description: 'Initialize a new Task Master project' },
			{ name: '/parse', description: 'Parse PRD to generate tasks' },
			{ name: '/tags', description: 'Manage task tags' },
			{ name: '/next', description: 'Show next task to work on' },
			{ name: '/mcp', description: 'Manage MCP servers' },
			{ name: '/chat', description: 'Chat with AI assistant' },
			{ name: '/trees', description: 'Manage Git worktrees' },
			{ name: '/claude', description: 'Claude Code assistant' },
			{ name: '/status', description: 'View project status details' },
			{ name: '/models', description: 'Configure AI models' },
			{ name: '/rules', description: 'Configure AI assistant rules' },
			{ name: '/theme', description: 'Toggle theme' },
			{ name: '/exit', description: 'Exit the application' }
		];

		// Only include task-related commands if tasks.json exists
		if (hasTasksFile) {
			baseCommands.splice(
				2,
				0,
				{ name: '/analyze', description: 'Analyze task complexity' },
				{ name: '/tasks', description: 'Interactive task management' }
			);
		}

		return baseCommands;
	};

	// Initialize theme on mount
	useEffect(() => {
		// Apply the initial theme based on auto-detection or saved preference
		if (currentTheme === 'auto') {
			setTheme('auto');
		} else {
			setTheme(currentTheme);
		}
	}, []);

	// Autocomplete filtering effect
	useEffect(() => {
		if (inputValue.startsWith('/')) {
			const availableCommands = getAvailableCommands();
			const filtered = availableCommands.filter((cmd) =>
				cmd.name.toLowerCase().startsWith(inputValue.toLowerCase())
			);
			setSuggestions(filtered);
			setSuggestionIndex(0);
		} else {
			setSuggestions([]);
		}
	}, [inputValue, hasTasksFile]);

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

	// Initialize backend
	useEffect(() => {
		async function init() {
			try {
				await currentBackend.initialize();

				// Check if tasks.json exists
				const hasFile = await currentBackend.hasTasksFile();
				setHasTasksFile(hasFile);

				if (hasFile) {
					const result = await currentBackend.listTasks();
					setTasks(result.tasks);
					setCurrentTag(result.tag);
				} else {
					// No tasks file, just set empty tasks
					setTasks([]);
				}

				setLoading(false);
			} catch (err) {
				setError(err.message);
				setLoading(false);
			}
		}

		init();
	}, [currentBackend]);

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
				setTimeout(() => {
					// Re-run the flow interface with a flag indicating what was completed
					run({ ...options, completedSetup: command }).catch((error) => {
						console.error('Error restarting flow:', error);
						process.exit(1);
					});
				}, 500);
			});
		}, 100);
	};

	// Handle input commands
	const handleInput = async (value) => {
		const trimmedValue = value.trim();
		console.log('[FlowApp] handleInput called with:', {
			value,
			trimmedValue,
			currentScreen
		});

		// If we have suggestions and one is selected, use that instead
		if (
			suggestions.length > 0 &&
			suggestionIndex >= 0 &&
			suggestionIndex < suggestions.length
		) {
			value = suggestions[suggestionIndex].name;
		}

		// Handle slash commands
		if (value.startsWith('/')) {
			const command = value.substring(1).toLowerCase();
			console.log('[FlowApp] Processing slash command:', command);

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
					setCurrentScreen('mcp-management');
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
				case 'theme':
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
				case 'trees':
					setCurrentScreen('worktrees');
					break;
				case 'claude':
					setCurrentScreen('claude-code');
					break;
				case 'exit':
				case 'quit':
					exit();
					break;
				default:
					setMessages([
						...messages,
						{
							type: 'error',
							content: `Unknown command: /${command}`
						}
					]);
			}

			setInputValue('');
		}
	};

	const setWaiting = (isWaiting) => {
		isWaitingForShortcutRef.current = isWaiting;
		setWaitingForShortcut(isWaiting);
	};

	const handleTextInputChange = (value) => {
		// If we're in shortcut mode, don't update the input.
		// This prevents the 'x' from 'Ctrl+X' from appearing.
		if (isWaitingForShortcutRef.current) {
			return;
		}
		setInputValue(value);
	};

	// Global keyboard shortcuts
	useInput(
		(input, key) => {
			if (key.ctrl && input === 'c') {
				exit();
			}

			// Handle Ctrl+X prefix
			if (key.ctrl && input === 'x') {
				// Save current input before entering shortcut mode
				savedInputRef.current = inputValue;
				setWaiting(true);
				// Clear any existing input to prevent 'x' from appearing
				setInputValue('');
				return;
			}

			// Handle follow-up key after Ctrl+X
			if (waitingForShortcut) {
				// Handle escape to cancel shortcut mode
				if (key.escape) {
					setWaiting(false);
					// Restore the saved input
					const savedValue = savedInputRef.current;
					savedInputRef.current = '';
					setInputValue(savedValue);
					// Force TextInput to remount with cursor at end
					setInputKey((prev) => prev + 1);
					return;
				}

				setWaiting(false);
				// Clear saved input since a command was executed
				savedInputRef.current = '';

				switch (input.toLowerCase()) {
					case 'h':
						setShowCommandPalette(true);
						break;
					case 'i':
						launchSetupCommand('init', []);
						break;
					case 'p':
						setCurrentScreen('parse');
						break;
					case 'a':
						if (hasTasksFile) {
							setCurrentScreen('analyze');
						} else {
							setNotification({
								message:
									'No tasks.json found. Use /parse to create tasks first.',
								type: 'warning',
								duration: 3000
							});
						}
						break;
					case 't':
						if (hasTasksFile) {
							setCurrentScreen('tasks');
						} else {
							setNotification({
								message:
									'No tasks.json found. Use /parse to create tasks first.',
								type: 'warning',
								duration: 3000
							});
						}
						break;
					case 'g':
						setCurrentScreen('tags');
						break;
					case 'c':
						setCurrentScreen('chat');
						break;
					case 'w':
						setCurrentScreen('worktrees');
						break;
					case 'l':
						setCurrentScreen('claude-code');
						break;
					case 'v':
						setCurrentScreen('mcp-management');
						break;
					case 's':
						setCurrentScreen('status');
						break;
					case 'n':
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
								message:
									'No tasks.json found. Use /parse to create tasks first.',
								type: 'warning',
								duration: 3000
							});
						}
						break;
					case 'm':
						launchSetupCommand('models', ['--setup']);
						break;
					case 'r':
						launchSetupCommand('rules', ['--setup']);
						break;
					case 'd':
						// Theme toggle
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
					case 'q':
						exit();
						break;
					default:
						setNotification({
							message: `Unknown shortcut: Ctrl+X ${input}`,
							type: 'error',
							duration: 2000
						});
				}
				return;
			}

			if (key.escape) {
				// If we're waiting for a shortcut, cancel it and clear input
				if (waitingForShortcut) {
					setWaiting(false);
					setInputValue('');
					return;
				}

				setCurrentScreen('welcome');
				setSuggestions([]);
			}

			if (suggestions.length > 0) {
				if (key.downArrow) {
					setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
					return;
				}

				if (key.upArrow) {
					setSuggestionIndex(
						(prev) => (prev - 1 + suggestions.length) % suggestions.length
					);
					return;
				}

				if (key.tab && suggestions[suggestionIndex]) {
					setInputValue(suggestions[suggestionIndex].name);
					return;
				}
			}
		},
		{
			isActive:
				!showCommandPalette &&
				!showNextTaskModal &&
				currentScreen !== 'tasks' &&
				currentScreen !== 'chat' &&
				currentScreen !== 'status' &&
				currentScreen !== 'worktrees' &&
				currentScreen !== 'claude-code'
		}
	);

	// Check for exit-for-claude screen
	useEffect(() => {
		if (currentScreen === 'exit-for-claude' && navigationData?.launchCommand) {
			// Exit Flow and launch Claude after a small delay
			const launchClaude = async () => {
				console.log('\n🚀 Launching Claude Code...\n');

				// Small delay to ensure clean exit
				setTimeout(async () => {
					// Import needed modules
					const { exec } = await import('child_process');
					const { promisify } = await import('util');
					const execAsync = promisify(exec);

					try {
						if (process.platform === 'darwin') {
							// macOS - use Terminal.app
							// Escape the command for AppleScript
							const escapedCommand = navigationData.launchCommand.replace(
								/"/g,
								'\\"'
							);
							await execAsync(
								`osascript -e 'tell application "Terminal" to do script "${escapedCommand}"' -e 'tell application "Terminal" to activate'`
							);
						} else if (process.platform === 'win32') {
							// Windows
							await execAsync(`start cmd /k "${navigationData.launchCommand}"`);
						} else {
							// Linux - try common terminal emulators
							await execAsync(
								`gnome-terminal -- bash -c "${navigationData.launchCommand}; exec bash"`
							);
						}
					} catch (err) {
						console.error('Failed to launch Claude:', err.message);
					}

					// Exit Flow
					exit();
				}, 100);
			};

			launchClaude();
		}
	}, [currentScreen, navigationData, exit]);

	// Context value
	const contextValue = {
		backend: currentBackend,
		tasks,
		setTasks,
		currentTag,
		setCurrentTag,
		currentScreen,
		setCurrentScreen: (screen, data = null) => {
			setCurrentScreen(screen);
			setNavigationData(data);
		},
		navigationData,
		inputValue,
		setInputValue,
		messages,
		setMessages,
		currentModel,
		setCurrentModel,
		handleInput,
		hasTasksFile,
		showCommandPalette,
		setShowCommandPalette,
		showToast: (message) => {
			setNotification({
				message,
				type: 'success',
				duration: 2000
			});
		},
		reloadTasks: async () => {
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
		}
	};

	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color="cyan">Loading Task Master...</Text>
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color="red">Error: {error}</Text>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			</Box>
		);
	}

	return (
		<AppContext.Provider value={contextValue}>
			<OverflowProvider>
				<Box flexDirection="column" height="100%">
					{/* Conditionally render EITHER popup OR main content */}
					{showCommandPalette ? (
						<CommandPalette />
					) : showNextTaskModal ? (
						<NextTaskModal
							task={nextTask}
							onClose={() => {
								setShowNextTaskModal(false);
								setNextTask(null);
							}}
						/>
					) : currentScreen === 'tasks' ? (
						<TaskManagementScreen />
					) : currentScreen === 'tags' ? (
						<TagManagementScreen />
					) : currentScreen === 'status' ? (
						<StatusScreen />
					) : currentScreen === 'parse' ? (
						<ParsePRDScreen />
					) : currentScreen === 'analyze' ? (
						<AnalyzeComplexityScreen />
					) : currentScreen === 'chat' ? (
						<ChatScreen
							mcpClient={currentBackend}
							projectRoot={currentBackend.projectRoot}
							onExit={() => setCurrentScreen('welcome')}
						/>
					) : currentScreen === 'worktrees' ? (
						<GitWorktreeScreen
							backend={currentBackend}
							onBack={() => setCurrentScreen('welcome')}
							onExit={exit}
							navigationData={navigationData}
							onNavigateToTask={handleNavigateToTask}
							setCurrentScreen={(screen, data) => {
								setCurrentScreen(screen);
								setNavigationData(data);
							}}
						/>
					) : currentScreen === 'claude-code' ? (
						<ClaudeCodeScreen
							backend={currentBackend}
							onBack={() => setCurrentScreen('welcome')}
							navigationData={navigationData}
							initialContext={navigationData?.initialContext}
							mode={navigationData?.mode}
							returnTo={navigationData?.returnTo}
							returnData={navigationData?.returnData}
						/>
					) : currentScreen === 'mcp-management' ? (
						<MCPManagementScreen />
					) : currentScreen === 'worktreePrompt' ? (
						<Box justifyContent="center" alignItems="center" height="100%">
							<WorktreePromptModal
								taskTitle={navigationData?.taskTitle}
								subtaskTitle={navigationData?.subtaskTitle}
								onSelect={
									navigationData?.onSelect ||
									(() => setCurrentScreen('welcome'))
								}
								onClose={() => setCurrentScreen('welcome')}
							/>
						</Box>
					) : currentScreen === 'mcp' ? (
						<MCPServerManager
							onBack={() => setCurrentScreen('welcome')}
							onOpenChat={() => setCurrentScreen('chat')}
							onUseServer={async (server) => {
								try {
									// Create and initialize MCP client backend
									const mcpBackend = new MCPClientBackend({ server });
									await mcpBackend.initialize();

									// Update the backend reference
									setCurrentBackend(mcpBackend);

									// Reload tasks with new backend
									const result = await mcpBackend.listTasks();
									setTasks(result.tasks);
									setCurrentTag(result.tag);

									setNotification({
										message: `Switched to ${server.name}`,
										type: 'success',
										duration: 3000
									});

									// Go back to main screen
									setCurrentScreen('welcome');
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
								<Box paddingLeft={1} paddingRight={1}>
									<Box flexGrow={1}>
										<Text color={theme.text}>
											<Text color={theme.accent}>[tag]</Text>{' '}
											{currentTag || 'master'}
										</Text>
									</Box>
									<Text color={theme.accent}>Task Master AI</Text>
									<Text dimColor> v0.18.0</Text>
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

/**
 * Run the Flow TUI
 * @param {Object} options - Configuration options
 */
export async function run(options = {}) {
	// Determine backend
	const backendType =
		options.backend || process.env.TASKMASTER_BACKEND || 'direct';

	let backend;
	if (backendType === 'direct') {
		backend = new DirectBackend({
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else if (backendType === 'cli') {
		backend = new CliBackend({
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else if (backendType === 'mcp') {
		// For MCP backend, we need to load server configuration
		const { loadServers, getDefaultServer, findServerById } = await import(
			'./mcp/servers.js'
		);
		const servers = await loadServers();

		// Get server ID from options or environment
		const serverId =
			options.mcpServerId || process.env.TASKMASTER_MCP_SERVER_ID;

		let serverConfig;
		if (serverId) {
			serverConfig = findServerById(servers, serverId);
			if (!serverConfig) {
				throw new Error(`MCP server with ID '${serverId}' not found`);
			}
		} else {
			// Use default server
			serverConfig = getDefaultServer(servers);
			if (!serverConfig) {
				throw new Error(
					'No MCP servers configured. Use Flow UI to add servers or run with --backend direct'
				);
			}
		}

		// Create MCP backend with server configuration
		backend = new MCPClientBackend({
			server: serverConfig,
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else {
		throw new Error(`Unknown backend type: ${backendType}`);
	}

	// Initialize backend
	await backend.initialize();

	// Create app instance
	const app = render(<FlowApp backend={backend} />);

	// Wait for app to exit
	await app.waitUntilExit();
}

// If this file is run directly, execute the run function
if (import.meta.url === `file://${process.argv[1]}`) {
	run().catch((error) => {
		console.error('Error running flow:', error);
		process.exit(1);
	});
}
