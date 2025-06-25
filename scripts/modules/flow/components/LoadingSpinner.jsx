import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';

// Map operation types to appropriate spinners
const spinnerTypes = {
	parse: 'dots2', // For parsing operations
	analyze: 'line', // For analysis operations
	expand: 'arc', // For expansion operations
	default: 'dots' // Default spinner
};

export function LoadingSpinner({
	message = 'Loading...',
	type = 'default',
	customType
}) {
	// Use custom type if provided, otherwise use mapped type
	const spinnerType = customType || spinnerTypes[type] || spinnerTypes.default;

	return (
		<Box>
			<Text color={theme.accent}>
				<Spinner type={spinnerType} />
			</Text>
			<Text> {message}</Text>
		</Box>
	);
}
