import React from 'react';
import { Box, Text } from 'ink';

interface HelpPanelProps {
	height: number;
}

/**
 * Help Panel Component
 * Shows keyboard shortcuts and tips
 */
export const HelpPanel: React.FC<HelpPanelProps> = ({ height }) => {
	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			paddingX={2}
			paddingY={1}
			height={height}
		>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Keyboard Shortcuts
				</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Text bold color="green">
					Navigation:
				</Text>
				<Text>
					<Text bold>Tab</Text> - Switch between panels
				</Text>
				<Text>
					<Text bold>↑↓</Text> - Navigate task list
				</Text>
				<Text>
					<Text bold>Enter</Text> - View task details
				</Text>
				<Text>
					<Text bold>q / Ctrl+C</Text> - Exit
				</Text>
			</Box>

			<Box flexDirection="column">
				<Text bold color="yellow">
					Tips:
				</Text>
				<Text>* Dashboard shows real-time project statistics</Text>
				<Text>* Terminal UI is fully responsive</Text>
				<Text>
					* Use <Text bold>task-master list</Text> for detailed task management
				</Text>
			</Box>
		</Box>
	);
};
