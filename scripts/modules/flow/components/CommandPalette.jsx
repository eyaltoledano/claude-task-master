import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { useAppContext } from '../index.jsx';

export function CommandPalette() {
	const {
		setCurrentScreen,
		showToast,
		hasTasksFile,
		setShowCommandPalette,
		handleInput
	} = useAppContext();
	const [selectedIndex, setSelectedIndex] = useState(0);

	const baseCommands = [
		{
			name: 'Initialize Project',
			command: '/init',
			description: 'Initialize a new Task Master project',
			key: 'i'
		},
		{
			name: 'Parse PRD',
			command: '/parse',
			description: 'Parse PRD to generate tasks',
			key: 'p'
		}
	];

	const taskCommands = hasTasksFile
		? [
				{
					name: 'Analyze Complexity',
					command: '/analyze',
					description: 'Analyze task complexity',
					key: 'a'
				},
				{
					name: 'Task Management',
					command: '/tasks',
					description: 'Interactive task management',
					key: 't'
				}
			]
		: [];

	const otherCommands = [
		{
			name: 'Tag Management',
			command: '/tags',
			description: 'Manage task tags',
			key: 'g'
		},
		{
			name: 'Next Task',
			command: '/next',
			description: 'Show next task to work on',
			key: 'n'
		},
		{
			name: 'MCP Servers',
			command: '/mcp',
			description: 'Manage MCP servers',
			key: 'v'
		},
		{
			name: 'Chat with AI',
			command: '/chat',
			description: 'Chat with AI assistant',
			key: 'c'
		},
		{
			name: 'Project Status',
			command: '/status',
			description: 'View project status',
			key: 's'
		},
		{
			name: 'Configure Models',
			command: '/models',
			description: 'Configure AI models',
			key: 'm'
		},
		{
			name: 'Configure Rules',
			command: '/rules',
			description: 'Configure AI assistant rules',
			key: 'r'
		},
		{
			name: 'Toggle Theme',
			command: '/theme',
			description: 'Toggle theme mode',
			key: 'd'
		},
		{
			name: 'Exit',
			command: '/exit',
			description: 'Exit application',
			key: 'q'
		}
	];

	const commands = [...baseCommands, ...taskCommands, ...otherCommands];

	// Calculate the maximum command width for proper alignment
	const maxCommandWidth = Math.max(
		...commands.map((cmd) => cmd.command.length)
	);

	useInput((input, key) => {
		if (key.escape) {
			setShowCommandPalette(false);
			return;
		}

		if (key.downArrow) {
			setSelectedIndex((prev) => (prev + 1) % commands.length);
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(
				(prev) => (prev - 1 + commands.length) % commands.length
			);
			return;
		}

		if (key.return) {
			const selected = commands[selectedIndex];
			if (selected.command) {
				handleInput(selected.command);
				setShowCommandPalette(false);
			}
			return;
		}
	});

	return (
		<Box
			width="100%"
			height="100%"
			flexDirection="column"
			justifyContent="center"
			alignItems="center"
		>
			{/* Modal */}
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				paddingTop={1}
				paddingBottom={1}
				paddingLeft={2}
				paddingRight={2}
				width={70}
			>
				{/* Header */}
				<Box marginBottom={1} justifyContent="space-between">
					<Text color={theme.accent} bold>
						Commands
					</Text>
					<Text color={theme.textDim}>esc</Text>
				</Box>

				{/* Command list */}
				<Box flexDirection="column">
					{commands.map((cmd, index) => {
						const isSelected = index === selectedIndex;

						return (
							<Box
								key={cmd.command}
								paddingLeft={1}
								paddingRight={1}
								flexDirection="row"
								width="100%"
							>
								<Box width={12}>
									<Text color={isSelected ? theme.accent : theme.accent}>
										{cmd.command}
									</Text>
								</Box>
								<Box flexGrow={1}>
									<Text color={isSelected ? theme.textBright : theme.text}>
										{cmd.description}
									</Text>
								</Box>
							</Box>
						);
					})}
				</Box>
			</Box>
		</Box>
	);
}
