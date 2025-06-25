import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { useAppContext } from '../index.jsx';

export function HelpScreen() {
	const { setCurrentScreen, hasTasksFile } = useAppContext();

	useInput((input, key) => {
		if (key.escape) {
			setCurrentScreen('welcome');
		}
	});

	const baseCommands = [
		{
			name: '/help',
			description: 'Show this help screen',
			shortcut: 'Ctrl+X H'
		},
		{
			name: '/parse',
			description: 'Parse PRD to generate tasks',
			shortcut: 'Ctrl+X P'
		}
	];

	const taskCommands = hasTasksFile ? [
		{
			name: '/analyze',
			description: 'Analyze task complexity',
			shortcut: 'Ctrl+X A'
		},
		{
			name: '/tasks',
			description: 'Interactive task management',
			shortcut: 'Ctrl+X T'
		}
	] : [];

	const otherCommands = [
		{
			name: '/tags',
			description: 'Manage task tags',
			shortcut: 'Ctrl+X G'
		},
		{
			name: '/mcp',
			description: 'Manage MCP servers',
			shortcut: 'Ctrl+X C'
		},
		{
			name: '/status',
			description: 'View project status',
			shortcut: 'Ctrl+X S'
		},
		{
			name: '/models',
			description: 'Configure AI models',
			shortcut: 'Ctrl+X M'
		},
		{
			name: '/rules',
			description: 'Configure AI assistant rules',
			shortcut: 'Ctrl+X R'
		},
		{
			name: '/theme',
			description: 'Toggle theme (auto/light/dark)',
			shortcut: 'Ctrl+X D'
		},
		{
			name: '/exit',
			description: 'Exit the application',
			shortcut: 'Ctrl+X Q'
		}
	];

	const allCommands = [...baseCommands, ...taskCommands, ...otherCommands];

	return (
		<Box
			position="absolute"
			top={0}
			left={0}
			right={0}
			bottom={0}
			justifyContent="center"
			alignItems="center"
			backgroundColor="rgba(0,0,0,0.5)"
		>
			<Box
				width="90%"
				height="90%"
				borderStyle="single"
				borderColor={theme.border}
				backgroundColor={theme.background}
				flexDirection="column"
			>
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					borderLeft={false}
					borderRight={false}
					paddingLeft={1}
					paddingRight={1}
					paddingTop={1}
					paddingBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent} bold>
							Task Master Flow - Help
						</Text>
					</Box>
					<Text color={theme.textDim}>[ESC to close]</Text>
				</Box>

				{/* Content */}
				<Box
					flexGrow={1}
					paddingLeft={2}
					paddingRight={2}
					paddingTop={1}
					overflowY="auto"
				>
					<Box flexDirection="column" width="100%">
						<Box flexDirection="column" marginBottom={2}>
							<Text color={theme.accent} bold>
								Available Commands
							</Text>
							<Box flexDirection="column" marginTop={1}>
								{allCommands.map((cmd) => (
									<Box key={cmd.name} flexDirection="row">
										<Box width={15}>
											<Text color={theme.accent}>{cmd.name}</Text>
										</Box>
										<Box width={50}>
											<Text color={theme.textDim} wrap="wrap">
												{cmd.description}
											</Text>
										</Box>
										<Box width={15}>
											<Text color={theme.textDim}>{cmd.shortcut}</Text>
										</Box>
									</Box>
								))}
							</Box>
						</Box>

						{/* Task Management Controls */}
						<Box flexDirection="column" marginBottom={2}>
							<Text color={theme.accent} bold>
								Task Management Controls (/tasks)
							</Text>
							<Box flexDirection="column" marginTop={1}>
								<Text color={theme.text}>Navigation:</Text>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>↑/↓</Text>
									</Box>
									<Text color={theme.textDim}>Navigate tasks</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>PgUp/PgDn</Text>
									</Box>
									<Text color={theme.textDim}>Scroll by page</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>Enter</Text>
									</Box>
									<Text color={theme.textDim}>Expand/collapse task</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>Space</Text>
									</Box>
									<Text color={theme.textDim}>Select/deselect task</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>ESC</Text>
									</Box>
									<Text color={theme.textDim}>Return to main screen</Text>
								</Box>

								<Text color={theme.text} marginTop={1}>
									Actions:
								</Text>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>t</Text>
									</Box>
									<Text color={theme.textDim}>Cycle task status</Text>
								</Box>

								<Text color={theme.text} marginTop={1}>
									Filtering:
								</Text>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>s</Text>
									</Box>
									<Text color={theme.textDim}>
										Switch to status filter mode
									</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>p</Text>
									</Box>
									<Text color={theme.textDim}>
										Switch to priority filter mode
									</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>1-4</Text>
									</Box>
									<Text color={theme.textDim}>
										Apply filter (depends on mode)
									</Text>
								</Box>
							</Box>
						</Box>

						{/* Tag Management Controls */}
						<Box flexDirection="column" marginBottom={2}>
							<Text color={theme.accent} bold>
								Tag Management Controls (/tags)
							</Text>
							<Box flexDirection="column" marginTop={1}>
								<Text color={theme.text}>Navigation:</Text>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>↑/↓</Text>
									</Box>
									<Text color={theme.textDim}>Navigate tags</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>Enter</Text>
									</Box>
									<Text color={theme.textDim}>Switch to selected tag</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>ESC</Text>
									</Box>
									<Text color={theme.textDim}>Return to main screen</Text>
								</Box>

								<Text color={theme.text} marginTop={1}>
									Actions:
								</Text>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>a</Text>
									</Box>
									<Text color={theme.textDim}>Add new tag</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>d</Text>
									</Box>
									<Text color={theme.textDim}>Delete empty tag</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>r</Text>
									</Box>
									<Text color={theme.textDim}>Rename selected tag</Text>
								</Box>
								<Box flexDirection="row" marginLeft={2}>
									<Box width={16}>
										<Text color={theme.textDim}>s</Text>
									</Box>
									<Text color={theme.textDim}>Toggle sort (name/tasks)</Text>
								</Box>
							</Box>
						</Box>

						<Box flexDirection="column" marginBottom={2}>
							<Text bold underline>
								Global Shortcuts:
							</Text>
							<Box marginTop={1} flexDirection="column">
								<Box>
									<Text color="cyan">Ctrl+X</Text>
									<Text> - Enter command mode (follow with a letter key)</Text>
								</Box>
								<Box>
									<Text color="cyan">ESC</Text>
									<Text> - Return to previous screen/home</Text>
								</Box>
								<Box>
									<Text color="cyan">Ctrl+C</Text>
									<Text> - Exit application</Text>
								</Box>
							</Box>
						</Box>

						<Box flexDirection="column" marginBottom={2}>
							<Text bold underline>
								Configuration Commands:
							</Text>
							<Box marginTop={1} flexDirection="column">
								<Box>
									<Text color="cyan">/models</Text>
									<Text> - Opens interactive AI model configuration</Text>
								</Box>
								<Text dimColor marginLeft={2}>
									Configure primary, research, and fallback models
								</Text>
								<Box marginTop={1}>
									<Text color="cyan">/rules</Text>
									<Text> - Opens interactive rules setup</Text>
								</Box>
								<Text dimColor marginLeft={2}>
									Select which AI assistant rule profiles to include
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column">
							<Text bold underline>
								Natural Language Commands:
							</Text>
							<Box marginTop={1}>
								<Text dimColor>
									Type naturally to interact with Task Master AI. Examples:
								</Text>
							</Box>
							<Box flexDirection="column" marginTop={1} marginLeft={2}>
								<Text dimColor>• "Show me all pending tasks"</Text>
								<Text dimColor>• "Mark task 5 as done"</Text>
								<Text dimColor>
									• "Create a new task for implementing user auth"
								</Text>
								<Text dimColor>• "What should I work on next?"</Text>
							</Box>
						</Box>
					</Box>
				</Box>

				{/* Footer */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={true}
					borderBottom={false}
					borderLeft={false}
					borderRight={false}
					paddingTop={1}
					paddingLeft={1}
					paddingRight={1}
				>
					<Text color={theme.textDim}>Press ESC to close</Text>
				</Box>
			</Box>
		</Box>
	);
}
