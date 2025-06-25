import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

const commands = [
	{
		command: '/help',
		description: 'Show this help screen',
		category: 'General'
	},
	{
		command: '/parse',
		description:
			'Parse PRD to generate tasks - browse files and create task structure',
		category: 'Tasks'
	},
	{
		command: '/analyze',
		description: 'Analyze task complexity - identify tasks that need breakdown',
		category: 'Tasks'
	},
	{
		command: '/tasks',
		description: 'Interactive task management - view, edit, and organize tasks',
		category: 'Tasks'
	},
	{
		command: '/tags',
		description:
			'Manage task tags - create, rename, delete, and switch between tags',
		category: 'Tasks'
	},
	{
		command: '/mcp',
		description:
			'Manage MCP servers - add, edit, connect to external MCP servers',
		category: 'Configuration'
	},
	{
		command: '/status',
		description:
			'View detailed project status - task distribution, completion rates, and tag overview',
		category: 'Tasks'
	},
	{
		command: '/models',
		description: 'Configure AI models interactively',
		category: 'Configuration'
	},
	{
		command: '/rules',
		description: 'Configure AI coding assistant rules',
		category: 'Configuration'
	},
	{
		command: '/theme',
		description:
			'Toggle between light theme (for white terminals) and dark theme (for dark terminals)',
		category: 'Display'
	},
	{
		command: '/exit',
		description: 'Exit Task Master Flow',
		category: 'General'
	}
];

export function CommandPalette({ onClose, onSelectCommand }) {
	const [selectedIndex, setSelectedIndex] = useState(0);

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
				width="90%"
				maxWidth={120}
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
								<Box width={15}>
									<Text color={isSelected ? theme.accent : '#4a9eff'}>
										{cmd.command}
									</Text>
								</Box>
								<Box flexGrow={1}>
									<Text color={isSelected ? 'white' : theme.text} wrap="wrap">
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
