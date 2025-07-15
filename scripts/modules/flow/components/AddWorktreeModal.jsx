import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { BaseModal } from '../features/ui';
import { useKeypress } from '../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../shared/hooks/useTheme.js';

export default function AddWorktreeModal({ onSubmit, onCancel }) {
	const [worktreeName, setWorktreeName] = useState('');
	const [error, setError] = useState('');
	const { theme } = useComponentTheme('modal');

	const handleSubmit = () => {
		// Validate name
		const sanitizedName = worktreeName.trim().replace(/\s+/g, '-');
		if (sanitizedName.length === 0) {
			setError('Worktree name cannot be empty');
			return;
		}
		if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedName)) {
			setError(
				'Worktree name can only contain letters, numbers, hyphens, and underscores'
			);
			return;
		}
		onSubmit(worktreeName.trim());
	};

	const handlers = {
		return: () => {
			if (worktreeName.trim()) {
				handleSubmit();
			}
		}
	};

	useKeypress(handlers);

	return (
		<BaseModal
			title="Add New Worktree"
			onClose={onCancel}
			width="60%"
			height="auto"
			preset="default"
		>
			<Box flexDirection="column">
				<Box marginBottom={2}>
					<Text color={theme.textDim}>
						Enter a name for the new worktree. Spaces will be replaced with
						dashes.
					</Text>
				</Box>

				<Box marginBottom={1} alignItems="center">
					<Text color={theme.text}>Name: </Text>
					<Box marginLeft={1} flexGrow={1}>
						<TextInput
							value={worktreeName}
							onChange={setWorktreeName}
							placeholder="feature-name"
						/>
					</Box>
				</Box>

				{worktreeName && (
					<Box marginBottom={1}>
						<Text color={theme.textDim}>
							Will create: {worktreeName.replace(/\s+/g, '-')}
						</Text>
					</Box>
				)}

				{error && (
					<Box marginBottom={2}>
						<Text color={theme.error}>{error}</Text>
					</Box>
				)}

				<Box justifyContent="center" gap={3}>
					<Text color={theme.textDim}>[Enter] Create</Text>
					<Text color={theme.textDim}>[Esc] Cancel</Text>
				</Box>
			</Box>
		</BaseModal>
	);
}
