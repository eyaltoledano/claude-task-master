import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';

export function WorktreePromptModal({
	taskTitle,
	subtaskTitle,
	onSelect,
	onClose
}) {
	const { theme } = useComponentTheme('modal');
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

	const handleSelect = () => {
		onSelect(options[selectedOption].value);
	};

	const handleCancel = () => {
		onSelect('cancel');
	};

	const handlers = {
		escape: handleCancel,
		return: handleSelect,
		downArrow: () => setSelectedOption((prev) => (prev + 1) % options.length),
		upArrow: () =>
			setSelectedOption((prev) => (prev - 1 + options.length) % options.length),
		j: () => setSelectedOption((prev) => (prev + 1) % options.length), // vim-style
		k: () =>
			setSelectedOption((prev) => (prev - 1 + options.length) % options.length) // vim-style
	};

	useKeypress(handlers);

	return (
		<BaseModal
			title="No Worktree Found"
			onClose={handleCancel}
			width="60%"
			height="auto"
			preset="warning"
			showCloseHint={false} // We'll show custom navigation hint
		>
			<Box flexDirection="column">
				<Box marginBottom={2}>
					<Text color={theme.text}>
						Task "{taskTitle}" doesn't have an associated worktree.
					</Text>
					{subtaskTitle && (
						<Text color={theme.textDim}>Subtask: {subtaskTitle}</Text>
					)}
				</Box>

				<Box marginBottom={2}>
					<Text color={theme.text}>How would you like to proceed?</Text>
				</Box>

				<Box flexDirection="column" marginBottom={2}>
					{options.map((option, index) => {
						const isSelected = index === selectedOption;
						return (
							<Box key={option.value} marginBottom={0.5}>
								<Box>
									<Text color={isSelected ? theme.accent : theme.text}>
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

				<Box justifyContent="center">
					<Text color={theme.textDim}>
						↑↓ navigate • j/k vim • Enter select • ESC cancel
					</Text>
				</Box>
			</Box>
		</BaseModal>
	);
}
