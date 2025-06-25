import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { theme } from '../theme.js';

export function ExpandModal({ onSelect, onClose }) {
	const items = [
		{
			label: 'Yes - With research',
			value: 'research'
		},
		{
			label: 'No - Quick expand',
			value: 'no-research'
		},
		{
			label: 'Cancel',
			value: 'cancel'
		}
	];

	const handleSelect = (item) => {
		if (item.value === 'cancel') {
			onClose();
		} else {
			onSelect(item.value === 'research');
		}
	};

	return (
		<Box
			borderStyle="round"
			borderColor={theme.accent}
			width={45}
			paddingX={1}
			paddingY={1}
		>
			<Box flexDirection="column">
				<Text color={theme.accent} bold>
					Expand Task Options
				</Text>

				<Text> </Text>

				<Text color={theme.text}>Use research for better breakdown?</Text>

				<Text> </Text>

				<SelectInput
					items={items}
					onSelect={handleSelect}
					indicatorComponent={({ isSelected }) => (
						<Text color={isSelected ? theme.accent : theme.textDim}>
							{isSelected ? '▶ ' : '  '}
						</Text>
					)}
					itemComponent={({ isSelected, label }) => (
						<Text color={isSelected ? theme.accent : theme.text}>{label}</Text>
					)}
				/>

				<Text> </Text>

				<Text color={theme.textDim}>
					↑↓ navigate • Enter select • ESC cancel
				</Text>
			</Box>
		</Box>
	);
}
