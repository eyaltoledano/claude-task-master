import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';

export function WelcomeScreen() {
	const { messages } = useAppContext();

	return (
		<Box flexDirection="column" flexGrow={1}>
			{messages.length === 0 ? (
				<Box
					flexDirection="column"
					height="100%"
					justifyContent="center"
					alignItems="center"
				>
					{/* ASCII Art Logo */}
					<Box flexDirection="column" alignItems="center" marginBottom={2}>
						<Text color={theme.accent}>
							{
								'████████╗ █████╗ ███████╗██╗  ██╗███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ '
							}
						</Text>
						<Text color={theme.accent}>
							{
								'╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗'
							}
						</Text>
						<Text color={theme.accent}>
							{
								'   ██║   ███████║███████╗█████╔╝ ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝'
							}
						</Text>
						<Text color={theme.accent}>
							{
								'   ██║   ██╔══██║╚════██║██╔═██╗ ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗'
							}
						</Text>
						<Text color={theme.accent}>
							{
								'   ██║   ██║  ██║███████║██║  ██╗██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║'
							}
						</Text>
						<Text color={theme.accent}>
							{
								'   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝'
							}
						</Text>
					</Box>

					{/* Menu items */}
					<Box flexDirection="column" marginBottom={1} marginTop={2}>
						<Text color={theme.text}>/help Show all available commands</Text>
						<Text color={theme.text}>/parse Parse PRD to generate tasks</Text>
						<Text color={theme.text}>/analyze Analyze task complexity</Text>
						<Text color={theme.text}>/tasks Interactive task management</Text>
						<Text color={theme.text}>/tags Manage task tags</Text>
						<Text color={theme.text}>/mcp Manage MCP servers</Text>
						<Text color={theme.text}>/status View project status details</Text>
						<Text color={theme.text}>/models Configure AI models</Text>
						<Text color={theme.text}>/rules Configure AI assistant rules</Text>
						<Text color={theme.text}>
							/theme Toggle theme (auto/light/dark)
						</Text>
						<Text color={theme.text}>/exit Exit Task Master Flow</Text>
					</Box>
				</Box>
			) : (
				<Box flexDirection="column" flexGrow={1}>
					{/* Chat messages would go here */}
					<Box flexGrow={1} flexDirection="column" paddingLeft={1}>
						{messages.map((msg, i) => (
							<Box key={i} marginBottom={1}>
								<Text
									color={msg.type === 'user' ? theme.text : theme.accent}
									bold={msg.type === 'assistant'}
								>
									{msg.type === 'user' ? '❯ ' : '◆ '}
									{msg.content}
								</Text>
							</Box>
						))}
					</Box>
				</Box>
			)}
		</Box>
	);
}
