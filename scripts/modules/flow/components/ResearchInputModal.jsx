import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useComponentTheme } from '../shared/hooks/index.js';

export function ResearchInputModal({ onResearch, onClose }) {
	const [query, setQuery] = useState('');
	const [save, setSave] = useState(true); // Save by default
	const [stage, setStage] = useState('query'); // 'query' or 'confirm'
	const { theme } = useComponentTheme('researchInputModal');

	useInput((input, key) => {
		if (key.escape) {
			onClose();
		}

		if (stage === 'query' && key.return && query) {
			setStage('confirm');
		}

		if (stage === 'confirm') {
			if (input.toLowerCase() === 'y' || key.return) {
				onResearch({ query, save: true });
			} else if (input.toLowerCase() === 'n') {
				onResearch({ query, save: false });
			}
		}
	});

	return (
		<Box
			position="absolute"
			top="25%"
			left="25%"
			width="50%"
			borderStyle="round"
			borderColor={theme.border}
			backgroundColor={theme.background}
			padding={2}
			flexDirection="column"
		>
			<Text bold color={theme.title}>
				Run Research
			</Text>

			{stage === 'query' && (
				<Box marginTop={1}>
					<Text>Enter research query: </Text>
					<TextInput
						value={query}
						onChange={setQuery}
						onSubmit={() => setStage('confirm')}
					/>
				</Box>
			)}

			{stage === 'confirm' && (
				<Box marginTop={1} flexDirection="column">
					<Text>Save research results to task? (Y/n)</Text>
				</Box>
			)}
		</Box>
	);
}
