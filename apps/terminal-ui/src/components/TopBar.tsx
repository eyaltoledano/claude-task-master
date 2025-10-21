import React from 'react';
import { Box, Text } from 'ink';

interface TopBarProps {
	currentPanel: 'dashboard' | 'help';
}

/**
 * Top Bar Menu Component
 * Shows navigation between Dashboard and Help panels
 */
export const TopBar: React.FC<TopBarProps> = ({ currentPanel }) => {
	return (
		<Box borderStyle="single" paddingX={1} flexShrink={0}>
			<Text wrap="truncate-end">
				<Text bold color="cyan">
					Task Master
				</Text>
				<Text dimColor> | </Text>
				<Text
					color={currentPanel === 'dashboard' ? 'green' : 'gray'}
					bold={currentPanel === 'dashboard'}
				>
					{currentPanel === 'dashboard' ? '> ' : '  '}Dashboard
				</Text>
				<Text dimColor> | </Text>
				<Text
					color={currentPanel === 'help' ? 'green' : 'gray'}
					bold={currentPanel === 'help'}
				>
					{currentPanel === 'help' ? '> ' : '  '}Help
				</Text>
				<Text dimColor> | </Text>
				<Text dimColor>Tab to switch | q to quit</Text>
			</Text>
		</Box>
	);
};
