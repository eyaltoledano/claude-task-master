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
							████████╗ █████╗ ███████╗██╗ ██╗███╗ ███╗ █████╗
							███████╗████████╗███████╗██████╗
						</Text>
						<Text color={theme.accent}>
							╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝████╗
							████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
						</Text>
						<Text color={theme.accent}>
							{' '}
							██║ ███████║███████╗█████╔╝ ██╔████╔██║███████║███████╗ ██║ █████╗
							██████╔╝
						</Text>
						<Text color={theme.accent}>
							{' '}
							██║ ██╔══██║╚════██║██╔═██╗ ██║╚██╔╝██║██╔══██║╚════██║ ██║ ██╔══╝
							██╔══██╗
						</Text>
						<Text color={theme.accent}>
							{' '}
							██║ ██║ ██║███████║██║ ██╗██║ ╚═╝ ██║██║ ██║███████║ ██║
							███████╗██║ ██║
						</Text>
						<Text color={theme.accent}>
							{' '}
							╚═╝ ╚═╝ ╚═╝╚══════╝╚═╝ ╚═╝╚═╝ ╚═╝╚═╝ ╚═╝╚══════╝ ╚═╝ ╚══════╝╚═╝
							╚═╝
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
						<Text color={theme.text}>/theme Toggle light/dark theme</Text>
						<Text color={theme.text}>/exit Exit Task Master Flow</Text>
					</Box>
				</Box>
			) : (
				<Box flexDirection="column" width="100%" padding={2}>
					{/* Message history */}
					{messages.map((msg, idx) => (
						<Box key={idx} marginBottom={1}>
							{msg.type === 'user' ? (
								<Text color="cyan">❯ {msg.content}</Text>
							) : msg.type === 'assistant' ? (
								<Text>{msg.content}</Text>
							) : (
								<Text color="red">{msg.content}</Text>
							)}
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}
