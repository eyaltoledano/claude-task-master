import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { style, getComponentTheme } from '../../../shared/theme/theme.js';

// Import Zustand selectors for state management
import {
	useShowCommandPalette,
	useInputValue,
	useSuggestions,
	useSuggestionIndex,
	useSetShowCommandPalette,
	useSetInputValue,
	useSetSuggestions,
	useSetSuggestionIndex,
	useSetCurrentScreen
} from '../../../stores/flow-app-selectors.js';

// Command definitions for the palette
const COMMANDS = [
	{ command: 'init', description: 'Initialize a new project' },
	{ command: 'parse', description: 'Parse PRD to generate tasks' },
	{ command: 'analyze', description: 'Analyze task complexity' },
	{ command: 'tasks', description: 'Interactive task management' },
	{ command: 'tags', description: 'Manage task tags' },
	{ command: 'next', description: 'Show next task to work on' },
	{ command: 'status', description: 'View project status details' },
	{ command: 'chat', description: 'Chat with AI assistant' },
	{ command: 'settings', description: 'Configure models and settings' },
	{ command: 'exit', description: 'Exit Task Master Flow' }
];

export const CommandPalette = () => {
	// Zustand state - only subscribe to what we need
	const isOpen = useShowCommandPalette();
	const globalInputValue = useInputValue();
	const globalSuggestions = useSuggestions();
	const globalSuggestionIndex = useSuggestionIndex();
	
	// Zustand actions - individual selectors to prevent re-renders
	const setShowCommandPalette = useSetShowCommandPalette();
	const setInputValue = useSetInputValue();
	const setSuggestions = useSetSuggestions();
	const setSuggestionIndex = useSetSuggestionIndex();
	const setCurrentScreen = useSetCurrentScreen();
	
	// Local state for command palette input
	const [commandInput, setCommandInput] = useState('');
	const [filteredCommands, setFilteredCommands] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	
	const cmdTheme = getComponentTheme('modal');

	// Filter commands based on input
	useEffect(() => {
		if (commandInput.trim() === '') {
			setFilteredCommands(COMMANDS);
		} else {
			const filtered = COMMANDS.filter(
				cmd => 
					cmd.command.toLowerCase().includes(commandInput.toLowerCase()) ||
					cmd.description.toLowerCase().includes(commandInput.toLowerCase())
			);
			setFilteredCommands(filtered);
		}
		setSelectedIndex(0);
	}, [commandInput]);

	// Handle command execution
	const executeCommand = useCallback((command) => {
		const cmd = command || filteredCommands[selectedIndex]?.command;
		if (!cmd) return;

		// Close command palette
		setShowCommandPalette(false);
		setCommandInput('');
		
		// Execute the command
		switch (cmd) {
			case 'init':
				// Handle init command
				setCurrentScreen('welcome'); // Or handle init properly
				break;
			case 'parse':
				setCurrentScreen('parse');
				break;
			case 'analyze':
				setCurrentScreen('analyze');
				break;
			case 'tasks':
				setCurrentScreen('tasks');
				break;
			case 'tags':
				setCurrentScreen('tags');
				break;
			case 'next':
				// Handle next task
				setCurrentScreen('tasks'); // Or open next task modal
				break;
			case 'status':
				setCurrentScreen('status');
				break;
			case 'chat':
				setCurrentScreen('chat');
				break;
			case 'settings':
				// This should open settings modal instead
				setCurrentScreen('welcome'); // Placeholder
				break;
			case 'exit':
				// Handle exit
				process.exit(0);
				break;
			default:
				// Unknown command
				break;
		}
	}, [filteredCommands, selectedIndex, setShowCommandPalette, setCurrentScreen]);

	// Handle keyboard input
	const keyHandlers = {
		escape: () => {
			setShowCommandPalette(false);
			setCommandInput('');
		},
		return: () => {
			executeCommand();
		},
		upArrow: () => {
			setSelectedIndex(prev => Math.max(0, prev - 1));
		},
		downArrow: () => {
			setSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
		},
		input: (input, key) => {
			// Handle text input for filtering
			if (key.name === 'backspace') {
				setCommandInput(prev => prev.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta && input.length === 1) {
				setCommandInput(prev => prev + input);
			}
		}
	};

	useInput((input, key) => {
		if (!isOpen) return; // Only handle input when open

		// Route to appropriate handler
		if (key.escape) keyHandlers.escape();
		else if (key.return) keyHandlers.return();
		else if (key.upArrow) keyHandlers.upArrow();
		else if (key.downArrow) keyHandlers.downArrow();
		else keyHandlers.input(input, key);
	});

	// Don't render if not open
	if (!isOpen) return null;

	return (
		<Box
			position="absolute"
			top={2}
			left={2}
			right={2}
			flexDirection="column"
			borderStyle="single"
			borderColor={style('', 'border.primary')}
			backgroundColor={style('', 'background.secondary')}
			padding={1}
			zIndex={100}
		>
			{/* Header */}
			<Box marginBottom={1}>
				<Text color={style('', 'text.primary')}>Command Palette</Text>
			</Box>

			{/* Input field */}
			<Box marginBottom={1}>
				<Text color={style('', 'accent')}>❯ </Text>
				<Text color={style('', 'text.primary')}>{commandInput}</Text>
				<Text color={style('', 'text.tertiary')}>_</Text>
			</Box>

			{/* Commands list */}
			{filteredCommands.length > 0 ? (
				<Box flexDirection="column" maxHeight={8}>
					{filteredCommands.map((command, index) => {
						const isSelected = index === selectedIndex;
						const textColor = isSelected
							? cmdTheme.selectedText || 'text.inverse'
							: 'text.primary';
						const bgColor = isSelected
							? cmdTheme.selectedBackground || 'interactive.selected'
							: 'transparent';

						return (
							<Box
								key={`cmd-${command.command}-${index}`}
								backgroundColor={isSelected ? style('', bgColor) : undefined}
								paddingLeft={1}
								paddingRight={1}
							>
								<Box width={12}>
									<Text color={style('', textColor)}>/{command.command}</Text>
								</Box>
								<Text
									color={style('', isSelected ? textColor : 'text.secondary')}
								>
									{command.description}
								</Text>
							</Box>
						);
					})}
				</Box>
			) : (
				<Box paddingLeft={1}>
					<Text color={style('', 'text.secondary')}>No matching commands</Text>
				</Box>
			)}

			{/* Help text */}
			<Box marginTop={1}>
				<Text color={style('', 'text.tertiary')}>
					↑↓: Navigate • Enter: Select • ESC: Cancel
				</Text>
			</Box>
		</Box>
	);
};
