import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

/**
 * Modal to handle branch conflicts when creating worktrees
 * @param {Object} props
 * @param {string} props.branchName - The branch name that already exists
 * @param {string} props.branchInUseAt - Path where branch is in use (optional)
 * @param {Function} props.onDecision - Callback with user decision: 'use-existing', 'recreate', 'cancel'
 * @param {Function} props.onClose - Callback to close the modal
 */
export function WorktreeBranchConflictModal({
	branchName,
	branchInUseAt,
	onDecision,
	onClose
}) {
	const [selectedOption, setSelectedOption] = useState(0);

	const options = [
		{
			key: 'use-existing',
			label: 'Use existing branch',
			description: 'Continue with the current branch and any existing work'
		},
		{
			key: 'recreate',
			label: 'Remove and recreate',
			description:
				'Delete the existing branch and start fresh (⚠️ will lose any uncommitted changes)'
		},
		{
			key: 'cancel',
			label: 'Cancel',
			description: 'Do nothing and return'
		}
	];

	useInput((input, key) => {
		if (key.escape) {
			onClose();
		} else if (key.upArrow) {
			setSelectedOption((prev) => (prev > 0 ? prev - 1 : options.length - 1));
		} else if (key.downArrow) {
			setSelectedOption((prev) => (prev < options.length - 1 ? prev + 1 : 0));
		} else if (key.return) {
			onDecision(options[selectedOption].key);
		} else if (input >= '1' && input <= '3') {
			const index = parseInt(input) - 1;
			if (index < options.length) {
				onDecision(options[index].key);
			}
		}
	});

	return (
		<Box
			flexDirection="column"
			width={80}
			minHeight={15}
			borderStyle="round"
			borderColor={theme.warning}
			paddingX={2}
			paddingY={1}
		>
			<Box marginBottom={1} flexDirection="column" alignItems="center">
				<Text bold color={theme.warning}>
					⚠️ Branch Already Exists
				</Text>
				<Text color={theme.text}>Branch: {branchName}</Text>
				{branchInUseAt && (
					<Text color={theme.muted} fontSize={12}>
						Currently in use at: {branchInUseAt}
					</Text>
				)}
			</Box>

			<Box marginBottom={1} borderStyle="single" borderColor={theme.border} />

			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.text}>
					A branch named "{branchName}" already exists. What would you like to
					do?
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={2}>
				{options.map((option, index) => {
					const isSelected = index === selectedOption;
					const number = index + 1;

					return (
						<Box key={option.key} marginBottom={1} flexDirection="column">
							<Box>
								<Text color={isSelected ? theme.primary : theme.text}>
									{isSelected ? '▶ ' : '  '}[{number}] {option.label}
								</Text>
							</Box>
							<Box marginLeft={5}>
								<Text color={theme.muted} dimColor={!isSelected} wrap="wrap">
									{option.description}
								</Text>
							</Box>
						</Box>
					);
				})}
			</Box>

			<Box marginTop={1}>
				<Text dimColor>
					[↑↓] Navigate [1-3] Quick select [Enter] Confirm [Esc] Cancel
				</Text>
			</Box>
		</Box>
	);
}
