import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { getCurrentTheme } from '../theme.js';

export function WorktreePromptModal({
	taskTitle,
	subtaskTitle,
	onSelect,
	onClose
}) {
	const theme = getCurrentTheme();
	const [selectedOption, setSelectedOption] = useState(0);

	const options = [
		{
			label: 'Create New Worktree',
			value: 'create',
			description: 'Create a new Git worktree for this task'
		},
		{
			label: 'Select Existing Worktree',
			value: 'select',
			description: 'Choose from existing worktrees'
		},
		{
			label: 'Use Main Directory',
			value: 'main',
			description: 'Use the main project directory'
		},
		{
			label: 'Cancel',
			value: 'cancel',
			description: 'Cancel Claude Code session'
		}
	];

	useInput((input, key) => {
		if (key.escape) {
			onSelect('cancel');
		} else if (key.return) {
			onSelect(options[selectedOption].value);
		} else if (key.downArrow) {
			setSelectedOption((prev) => (prev + 1) % options.length);
		} else if (key.upArrow) {
			setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.border}
			paddingLeft={2}
			paddingRight={2}
			paddingTop={1}
			paddingBottom={1}
			width={60}
		>
			<Box marginBottom={1}>
				<Text color={theme.accent} bold>
					No Worktree Found
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color={theme.text}>
					Task "{taskTitle}" doesn't have an associated worktree.
				</Text>
				{subtaskTitle && (
					<Text color={theme.textDim}>Subtask: {subtaskTitle}</Text>
				)}
			</Box>

			<Box marginBottom={1}>
				<Text color={theme.text}>How would you like to proceed?</Text>
			</Box>

			<Box flexDirection="column">
				{options.map((option, index) => {
					const isSelected = index === selectedOption;
					return (
						<Box key={option.value} marginBottom={0.5}>
							<Box>
								<Text color={isSelected ? theme.selectionText : theme.text}>
									{isSelected ? '→ ' : '  '}
									{option.label}
								</Text>
							</Box>
							{isSelected && option.description && (
								<Box marginLeft={4}>
									<Text color={theme.textDim}>{option.description}</Text>
								</Box>
							)}
						</Box>
					);
				})}
			</Box>

			<Box marginTop={1}>
				<Text color={theme.textDim}>
					↑↓ navigate • Enter select • ESC cancel
				</Text>
			</Box>
		</Box>
	);
}
