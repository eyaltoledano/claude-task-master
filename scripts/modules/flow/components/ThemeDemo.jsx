import React from 'react';
import { Box, Text } from 'ink';
import { themeManager, gradient, style, getComponentTheme } from '../shared/theme/theme.js';

/**
 * Demo component showcasing the advanced theme system
 */
export const ThemeDemo = () => {
	const theme = themeManager.getTheme();
	const taskListTheme = getComponentTheme('taskList');

	return (
		<Box flexDirection="column" padding={1}>
			{/* Gradient header */}
			<Box marginBottom={1}>
				<Text>
					{gradient('✨ Task Master Flow - Advanced Theme Demo ✨', [
						'primary',
						'secondary'
					])}
				</Text>
			</Box>

			{/* Semantic colors demo */}
			<Box flexDirection="column" marginBottom={1}>
				<Text>{style('Primary Text', 'text.primary')}</Text>
				<Text>{style('Secondary Text', 'text.secondary')}</Text>
				<Text>{style('Tertiary Text', 'text.tertiary')}</Text>
			</Box>

			{/* State colors demo */}
			<Box flexDirection="column" marginBottom={1}>
				<Text>{style('✓ Success', 'state.success.primary')}</Text>
				<Text>{style('✗ Error', 'state.error.primary')}</Text>
				<Text>{style('⚠ Warning', 'state.warning.primary')}</Text>
				<Text>{style('ℹ Info', 'state.info.primary')}</Text>
			</Box>

			{/* Component theming example */}
			<Box
				borderStyle="round"
				borderColor={themeManager.getColor(taskListTheme.item.border)}
				padding={1}
			>
				<Box flexDirection="column">
					<Text>{style('Task: Implement theme system', 'text.primary')}</Text>
					<Text>
						{style('Status: ', 'text.secondary')}
						{style('In Progress', taskListTheme.status['in-progress'])}
					</Text>
				</Box>
			</Box>

			{/* Theme info */}
			<Box marginTop={1}>
				<Text dimColor>
					Current theme: {theme.name} ({theme.type})
				</Text>
			</Box>
		</Box>
	);
};

// Example of using theme in a functional component
export const ThemedButton = ({ label, variant = 'primary', onPress }) => {
	const buttonTheme = getComponentTheme('button');
	const variantTheme = buttonTheme[variant];

	const backgroundColor = themeManager.getColor(variantTheme.background);
	const textColor = themeManager.getColor(variantTheme.text);

	return (
		<Box
			paddingX={2}
			paddingY={1}
			borderStyle="round"
			borderColor={backgroundColor}
		>
			<Text color={textColor}>{label}</Text>
		</Box>
	);
};

// Example of a status badge component
export const StatusBadge = ({ status, text }) => {
	const statusTheme = getComponentTheme('status');
	const badge = statusTheme.badge[status] || statusTheme.badge.info;

	return (
		<Box
			paddingX={1}
			borderStyle="round"
			borderColor={themeManager.getColor(badge.background)}
		>
			<Text color={themeManager.getColor(badge.text)}>{text || status}</Text>
		</Box>
	);
};

// Example of gradient text component
export const GradientTitle = ({
	children,
	colors = ['primary', 'secondary']
}) => {
	return <Text>{gradient(children, colors)}</Text>;
};
