import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';

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
	const theme = useComponentTheme('modal');

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

	const keyHandlers = {
		escape: onClose,

		up: () => {
			setSelectedOption((prev) => (prev > 0 ? prev - 1 : options.length - 1));
		},

		down: () => {
			setSelectedOption((prev) => (prev < options.length - 1 ? prev + 1 : 0));
		},

		// Vim-style navigation
		j: () => keyHandlers.down(),
		k: () => keyHandlers.up(),

		return: () => {
			onDecision(options[selectedOption].key);
		},

		// Quick select by number
		1: () => onDecision(options[0].key),
		2: () => onDecision(options[1].key),
		3: () => onDecision(options[2].key)
	};

	useKeypress(keyHandlers);

	const modalProps = {
		title: '⚠️ Branch Already Exists',
		preset: 'warning',
		width: 80,
		height: 15,
		keyboardHints: [
			'↑↓ navigate',
			'j/k vim nav',
			'1-3 quick select',
			'ENTER confirm',
			'ESC cancel'
		]
	};

	return (
		<BaseModal {...modalProps}>
			<Box flexDirection="column">
				{/* Branch info */}
				<Box marginBottom={1} flexDirection="column" alignItems="center">
					<Text color={theme.text}>Branch: {branchName}</Text>
					{branchInUseAt && (
						<Text color={theme.muted} fontSize={12}>
							Currently in use at: {branchInUseAt}
						</Text>
					)}
				</Box>

				{/* Description */}
				<Box flexDirection="column" marginBottom={1}>
					<Text color={theme.text}>
						A branch named "{branchName}" already exists. What would you like to
						do?
					</Text>
				</Box>

				{/* Options */}
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
			</Box>
		</BaseModal>
	);
}
