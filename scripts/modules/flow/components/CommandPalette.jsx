import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

const commands = [
	{
		command: '/help',
		description: 'show help',
		category: 'General'
	},
	{
		command: '/parse',
		description: 'parse PRD to generate tasks',
		category: 'Tasks'
	},
	{
		command: '/analyze',
		description: 'analyze task complexity',
		category: 'Tasks'
	},
	{
		command: '/tasks',
		description: 'interactive task management',
		category: 'Tasks'
	},
	{
		command: '/tags',
		description: 'manage task tags',
		category: 'Tasks'
	},
	{
		command: '/status',
		description: 'view project status details',
		category: 'Tasks'
	},
	{
		command: '/mcp',
		description: 'manage MCP servers',
		category: 'Configuration'
	},
	{
		command: '/models',
		description: 'configure AI models',
		category: 'Configuration'
	},
	{
		command: '/rules',
		description: 'configure AI assistant rules',
		category: 'Configuration'
	},
	{
		command: '/theme',
		description: 'toggle theme',
		category: 'Display'
	},
	{
		command: '/exit',
		description: 'exit Task Master Flow',
		category: 'General'
	}
];

export function CommandPalette({ onClose, onSelectCommand }) {
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Calculate the maximum command width for proper alignment
	const maxCommandWidth = Math.max(...commands.map(cmd => cmd.command.length));

	useInput((input, key) => {
		if (key.escape) {
			onClose();
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
			if (selected.command.startsWith('/')) {
				onSelectCommand(selected.command);
			}
			onClose();
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
						Help
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
