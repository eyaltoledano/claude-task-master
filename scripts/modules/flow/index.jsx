#!/usr/bin/env node
import React, { useState, useEffect, createContext, useContext } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { spawn } from 'child_process';
import { DirectBackend } from './backends/direct-backend.js';
import { theme } from './theme.js';

// Import screens
import { WelcomeScreen } from './components/WelcomeScreen.jsx';
import { TaskListScreen } from './components/TaskListScreen.jsx';
import { TaskListPopup } from './components/TaskListPopup.jsx';
import { SessionsScreen } from './components/SessionsScreen.jsx';
import { HelpScreen } from './components/HelpScreen.jsx';
import { Toast } from './components/Toast.jsx';
import { CommandSuggestions } from './components/CommandSuggestions.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';

// Create context for backend and app state
const AppContext = createContext();

const ALL_COMMANDS = [
  { name: '/help', description: 'Show help screen' },
  { name: '/list', description: 'View and manage your task list' },
  { name: '/models', description: 'Configure AI models interactively' },
  { name: '/rules', description: 'Configure AI coding assistant rules' },
  { name: '/exit', description: 'Exit the application' }
];

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
  const [currentModel, setCurrentModel] = useState('Task Master AI');
  const [notification, setNotification] = useState(null);
  
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTaskList, setShowTaskList] = useState(false);
  
  const { exit } = useApp();

  // Autocomplete filtering effect
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      const filtered = ALL_COMMANDS.filter(cmd => 
        cmd.name.toLowerCase().startsWith(inputValue.toLowerCase())
      );
      setSuggestions(filtered);
      setSuggestionIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  // Check for completion message from restart
  useEffect(() => {
    if (options.completedSetup) {
      const message = options.completedSetup === 'models' 
        ? '✓ Model configuration complete!' 
        : '✓ Rules configuration complete!';
      
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
        await backend.initialize();
        const result = await backend.listTasks();
        setTasks(result.tasks);
        setCurrentTag(result.tag);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    init();
  }, [backend]);

  // Launch external setup command
  const launchSetupCommand = (command, args = []) => {
    // Show a transition message
    console.clear();
    console.log('\n\n');
    console.log('  ╔════════════════════════════════════════════════════════════════╗');
    console.log(`  ║  Launching ${command === 'models' ? 'AI Model Configuration' : 'AI Rules Configuration'}...                      ║`);
    console.log('  ║  You will return to Task Master Flow when complete.           ║');
    console.log('  ╚════════════════════════════════════════════════════════════════╝');
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
        run({ ...options, completedSetup: command }).catch(error => {
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
    
    // If we have suggestions and one is selected, use that instead
    if (suggestions.length > 0 && suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
      value = suggestions[suggestionIndex].name;
    }
    
    // Handle slash commands
    if (value.startsWith('/')) {
      const command = value.substring(1).toLowerCase();
      
      switch (command) {
        case 'help':
          setShowCommandPalette(true);
          break;
        case 'list':
          setShowTaskList(true);
          break;

        case 'models':
          // Launch the interactive models setup
          launchSetupCommand('models', ['--setup']);
          break;
        case 'rules':
          // Launch the interactive rules setup
          launchSetupCommand('rules', ['--setup']);
          break;
        case 'exit':
        case 'quit':
          exit();
          break;
        default:
          setMessages([...messages, {
            type: 'error',
            content: `Unknown command: /${command}`
          }]);
      }
      
      setInputValue('');
    } else if (trimmedValue && currentScreen === 'welcome') {
      // Handle regular input as task operations
      setMessages([...messages, {
        type: 'user',
        content: trimmedValue
      }]);
      
      // TODO: Process natural language commands
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'Task operations coming soon. Try /tasks to see your task list.'
      }]);
      
      setInputValue('');
    }
  };

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    
    // Don't handle other inputs if popups are showing
    if (showCommandPalette || showTaskList) {
      return;
    }
    
    if (key.escape) {
      setCurrentScreen('welcome');
      setSuggestions([]);
    }
    
    if (suggestions.length > 0) {
      if (key.downArrow) {
        setSuggestionIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      
      if (key.upArrow) {
        setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      
      if (key.tab && suggestions[suggestionIndex]) {
        setInputValue(suggestions[suggestionIndex].name);
        return;
      }
    }
  });

  // Context value
  const contextValue = {
    backend,
    tasks,
    setTasks,
    currentTag,
    setCurrentTag,
    currentScreen,
    setCurrentScreen,
    inputValue,
    setInputValue,
    messages,
    setMessages,
    currentModel,
    setCurrentModel,
    handleInput,
    reloadTasks: async () => {
      try {
        const result = await backend.listTasks();
        setTasks(result.tasks);
        setCurrentTag(result.tag);
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
      <Box flexDirection="column" height="100%">
        {/* Conditionally render EITHER popup OR main content */}
        {showCommandPalette ? (
          <CommandPalette 
            onClose={() => setShowCommandPalette(false)}
            onSelectCommand={(cmd) => {
              setShowCommandPalette(false);
              setInputValue(cmd);
              handleInput(cmd);
            }}
          />
        ) : showTaskList ? (
          <TaskListPopup
            tasks={tasks}
            onClose={() => setShowTaskList(false)}
            onSelectTask={(task) => {
              // Could implement task actions here
              console.log('Selected task:', task);
            }}
          />
        ) : (
          <>
            {/* Main content area */}
            <Box flexGrow={1} flexDirection="column">
              {/* Dynamic screen rendering */}
              {currentScreen === 'welcome' && <WelcomeScreen />}
              {currentScreen === 'tasks' && <TaskListScreen />}
              {currentScreen === 'sessions' && <SessionsScreen />}
              {currentScreen === 'help' && <HelpScreen />}
              
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
                    borderColor={theme.border}
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
                  borderColor={theme.border}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <Box width="100%">
                    <Text color="cyan">❯ </Text>
                    <Box flexGrow={1}>
                      <TextInput
                        value={inputValue}
                        onChange={setInputValue}
                        onSubmit={handleInput}
                        placeholder=""
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
              
              {/* Bottom status bar */}
              <Box paddingLeft={1} paddingRight={1}>
                <Box flexGrow={1}>
                  <Text dimColor>enter </Text>
                  <Text color={theme.textDim}>send</Text>
                </Box>
                <Text color={theme.accent}>{currentModel}</Text>
                <Text dimColor> v0.18.0</Text>
              </Box>
            </Box>
          </>
        )}
      </Box>
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
  const backendType = options.backend || process.env.TASKMASTER_BACKEND || 'direct';
  
  let backend;
  if (backendType === 'direct') {
    backend = new DirectBackend({
      projectRoot: options.projectRoot
    });
  } else if (backendType === 'cli') {
    // TODO: Import and use CliBackend when ready
    throw new Error('CLI backend not yet implemented');
  } else if (backendType === 'mcp') {
    // TODO: Import and use McpBackend when ready
    throw new Error('MCP backend not yet implemented');
  } else {
    throw new Error(`Unknown backend type: ${backendType}`);
  }

  // Render the app
  render(<FlowApp backend={backend} options={options} />);
}

// If this file is run directly, execute the run function
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => {
    console.error('Error running flow:', error);
    process.exit(1);
  });
} 