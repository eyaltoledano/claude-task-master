import React from 'react';
import { Box, Text } from 'ink';

interface BottomStatusBarProps {
	dimensions: { width: number; height: number };
	currentPanel: 'dashboard' | 'help';
	maximizedSection?: null | 'project' | 'dependency' | 'tasklist';
}

/**
 * Bottom Status Bar Component
 * Shows terminal dimensions, current panel, last update time, and controls
 */
export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
	dimensions,
	currentPanel,
	maximizedSection
}) => {
	const panelText = currentPanel.toUpperCase();

	// Show different controls based on dashboard state
	const getControls = (): string => {
		if (currentPanel === 'dashboard') {
			if (maximizedSection) {
				return '0=Dashboard | Enter for Details';
			} else {
				return '1=Project 2=Dependencies 3=Tasks | Enter for Details';
			}
		}
		return '';
	};

	const controls = getControls();

	return (
		<Box
			borderStyle="single"
			paddingX={1}
			justifyContent="center"
			flexShrink={0}
		>
			<Text wrap="truncate-end" dimColor>
				{dimensions.width}x{dimensions.height} | {panelText}
				{controls && ` | ${controls}`}
			</Text>
		</Box>
	);
};
