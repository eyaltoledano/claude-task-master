import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../shared/theme/theme.js';

export function ToolDetails({ selectedTool, selectedServer }) {
	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>MCP Servers</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>{selectedServer.name}</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>{selectedTool.name}</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Tool details */}
			<Box flexGrow={1} paddingLeft={1} paddingRight={1} flexDirection="column">
				<Box marginBottom={1}>
					<Text color={theme.accent} bold>
						Tool: {selectedTool.name}
					</Text>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text color={theme.textDim}>Description:</Text>
					<Box paddingLeft={2}>
						<Text>{selectedTool.description}</Text>
					</Box>
				</Box>

				{selectedTool.inputSchema && (
					<Box marginBottom={1} flexDirection="column">
						<Text color={theme.textDim}>Parameters:</Text>
						<Box paddingLeft={2}>
							<Text color={theme.text}>
								{JSON.stringify(selectedTool.inputSchema, null, 2)}
							</Text>
						</Box>
					</Box>
				)}
			</Box>
		</Box>
	);
}
