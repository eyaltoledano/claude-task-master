import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../app/index-root.jsx';
import { theme } from '../shared/theme/theme.js';

export function WelcomeScreen() {
	const { messages, hasTasksFile } = useAppContext();

	return (
		<Box flexDirection="column" flexGrow={1}>
			{messages.length === 0 ? (
				<Box
					flexDirection="column"
					height="100%"
					justifyContent="center"
					alignItems="center"
				>
					<Text> </Text>
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

					{/* Show message if no tasks.json */}
					{!hasTasksFile && (
						<Box flexDirection="column" marginBottom={2} alignItems="center">
							<Text color={theme.warning}>⚠️ No tasks.json found</Text>
							<Text color={theme.textDim}>
								Start by parsing a PRD with /parse or ctrl+x p
							</Text>
						</Box>
					)}

					{/* Menu items in column format */}
					<Box flexDirection="column" marginBottom={1} marginTop={2}>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/init</Text>
							</Box>
							<Box width={34}>
								<Text>Initialize a new project</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x i</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/parse</Text>
							</Box>
							<Box width={34}>
								<Text>Parse PRD to generate tasks</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x p</Text>
						</Box>
						{hasTasksFile && (
							<>
								<Box flexDirection="row">
									<Box width={12}>
										<Text color={theme.accent}>/analyze</Text>
									</Box>
									<Box width={34}>
										<Text>Analyze task complexity</Text>
									</Box>
									<Text color={theme.textDim}>ctrl+x a</Text>
								</Box>
								<Box flexDirection="row">
									<Box width={12}>
										<Text color={theme.accent}>/tasks</Text>
									</Box>
									<Box width={34}>
										<Text>Interactive task management</Text>
									</Box>
									<Text color={theme.textDim}>ctrl+x t</Text>
								</Box>
							</>
						)}
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/tags</Text>
							</Box>
							<Box width={34}>
								<Text>Manage task tags</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x g</Text>
						</Box>
						{hasTasksFile && (
							<Box flexDirection="row">
								<Box width={12}>
									<Text color={theme.accent}>/next</Text>
								</Box>
								<Box width={34}>
									<Text>Show next task to work on</Text>
								</Box>
								<Text color={theme.textDim}>ctrl+x n</Text>
							</Box>
						)}
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/mcp</Text>
							</Box>
							<Box width={34}>
								<Text>Manage MCP servers</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x v</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/chat</Text>
							</Box>
							<Box width={34}>
								<Text>Chat with AI assistant</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x c</Text>
						</Box>

						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/status</Text>
							</Box>
							<Box width={34}>
								<Text>View project status details</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x s</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/models</Text>
							</Box>
							<Box width={34}>
								<Text>Configure AI models</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x m</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/rules</Text>
							</Box>
							<Box width={34}>
								<Text>Configure AI assistant rules</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x r</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/theme</Text>
							</Box>
							<Box width={34}>
								<Text>Toggle theme (auto/light/dark)</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x d</Text>
						</Box>
						<Box flexDirection="row">
							<Box width={12}>
								<Text color={theme.accent}>/exit</Text>
							</Box>
							<Box width={34}>
								<Text>Exit Task Master Flow</Text>
							</Box>
							<Text color={theme.textDim}>ctrl+x q</Text>
						</Box>
					</Box>
				</Box>
			) : (
				<Box flexDirection="column" flexGrow={1}>
					{/* Chat messages would go here */}
					<Box flexGrow={1} flexDirection="column" paddingLeft={1}>
						{messages.map((msg, i) => (
							<Box
								key={`msg-${i}-${msg.type}-${msg.content.slice(0, 10)}`}
								marginBottom={1}
							>
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

export const WelcomeHeader = ({ messages }) => {
	return (
		<Box flexDirection="column" gap={1}>
			{messages.map((msg, idx) => (
				<Text
					key={`${msg.type}-${idx}-${msg.text.slice(0, 10)}`}
					color={msg.type === 'user' ? theme.text : theme.accent}
				>
					{msg.text}
				</Text>
			))}
		</Box>
	);
};
