import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';

export function ExpandModal({
	onSelect,
	onClose,
	defaultNum = 5,
	fromComplexityReport = false,
	hasExistingSubtasks = false
}) {
	const [step, setStep] = useState(
		hasExistingSubtasks ? 'confirm' : 'research'
	); // 'confirm', 'research', or 'number'
	const [useResearch, setUseResearch] = useState(false);
	const [numSubtasks, setNumSubtasks] = useState(defaultNum.toString());

	const confirmItems = [
		{
			label: 'Yes - Replace existing subtasks',
			value: 'replace'
		},
		{
			label: 'No - Keep existing subtasks',
			value: 'cancel'
		}
	];

	const researchItems = [
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

	const handleConfirmSelect = (item) => {
		if (item.value === 'cancel') {
			onClose();
		} else {
			// Proceed to research question
			setStep('research');
		}
	};

	const handleResearchSelect = (item) => {
		if (item.value === 'cancel') {
			onClose();
			return;
		}

		setUseResearch(item.value === 'research');
		setStep('number');
	};

	const handleNumberSubmit = (value) => {
		const num = parseInt(value, 10);
		if (!Number.isNaN(num) && num > 0) {
			onSelect({
				research: useResearch,
				num: num,
				force: hasExistingSubtasks // Will force if there were existing subtasks
			});
		}
	};

	const handleNumberKeyPress = (key, isEscapeKey) => {
		if (isEscapeKey || key === 'escape') {
			onClose();
		}
	};

	if (step === 'confirm') {
		return (
			<Box
				borderStyle="round"
				borderColor={theme.warning}
				padding={1}
				flexDirection="column"
			>
				<Text color={theme.warning} bold>
					⚠️ Warning: This task already has subtasks
				</Text>
				<Text color={theme.text} marginTop={1}>
					Expanding will replace all existing subtasks.
				</Text>
				<Text color={theme.text}>Do you want to continue?</Text>
				<Box marginTop={1}>
					<SelectInput items={confirmItems} onSelect={handleConfirmSelect} />
				</Box>
			</Box>
		);
	}

	if (step === 'research') {
		return (
			<Box
				borderStyle="round"
				borderColor={theme.accent}
				padding={1}
				flexDirection="column"
			>
				<Text color={theme.accent} bold>
					Expand Task Options
				</Text>
				<Text color={theme.text} marginTop={1}>
					Use research for better task breakdown?
				</Text>
				<Box marginTop={1}>
					<SelectInput items={researchItems} onSelect={handleResearchSelect} />
				</Box>
			</Box>
		);
	}

	// Number input step
	return (
		<Box
			borderStyle="round"
			borderColor={theme.accent}
			padding={1}
			flexDirection="column"
		>
			<Text color={theme.accent} bold>
				Number of Subtasks
			</Text>
			<Box marginTop={1}>
				<Text color={theme.text}>
					How many subtasks? (default: {defaultNum}
					{fromComplexityReport
						? ' ✓ from complexity analysis'
						: ' - estimated'}
					):
				</Text>
			</Box>
			<Box marginTop={1}>
				<Text color={theme.text}>→ </Text>
				<TextInput
					value={numSubtasks}
					onChange={setNumSubtasks}
					onSubmit={handleNumberSubmit}
					placeholder={defaultNum.toString()}
				/>
			</Box>
			<Box marginTop={1}>
				<Text color={theme.textDim}>
					Press Enter to confirm or Escape to cancel
				</Text>
			</Box>
		</Box>
	);
}
