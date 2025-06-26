import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getTheme } from '../theme.js';

export default function AddWorktreeModal({ onSubmit, onCancel }) {
	const [worktreeName, setWorktreeName] = useState('');
	const [error, setError] = useState('');
	const theme = getTheme();

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
		} else if (key.return && worktreeName.trim()) {
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
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.border}
			padding={1}
			width={60}
		>
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Add New Worktree
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color={theme.muted}>
					Enter a name for the new worktree. Spaces will be replaced with
					dashes.
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Name: </Text>
				<TextInput
					value={worktreeName}
					onChange={setWorktreeName}
					placeholder="feature-name"
				/>
			</Box>

			{worktreeName && (
				<Box marginBottom={1}>
					<Text color={theme.muted}>
						Will create: {worktreeName.replace(/\s+/g, '-')}
					</Text>
				</Box>
			)}

			{error && (
				<Box marginBottom={1}>
					<Text color={theme.error}>{error}</Text>
				</Box>
			)}

			<Box gap={2}>
				<Text color={theme.muted}>[Enter] Create</Text>
				<Text color={theme.muted}>[Esc] Cancel</Text>
			</Box>
		</Box>
	);
}
