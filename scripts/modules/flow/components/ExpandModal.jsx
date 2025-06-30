import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { BaseModal } from './BaseModal.jsx';
import { useComponentTheme } from '../hooks/useTheme.js';

export function ExpandModal({
	onSelect,
	onClose,
	defaultNum = 5,
	fromComplexityReport = false,
	hasExistingSubtasks = false
}) {
	const { theme } = useComponentTheme('modal');
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

	// Get modal properties based on current step
	const getModalProps = () => {
		switch (step) {
			case 'confirm':
				return {
					title: '⚠️ Warning: This task already has subtasks',
					preset: 'warning'
				};
			case 'research':
				return {
					title: 'Expand Task Options',
					preset: 'info'
				};
			case 'number':
				return {
					title: 'Number of Subtasks',
					preset: 'default'
				};
			default:
				return {
					title: 'Expand Task',
					preset: 'default'
				};
		}
	};

	const modalProps = getModalProps();

	// Render step content
	const renderStepContent = () => {
		if (step === 'confirm') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.text}>
							Expanding will replace all existing subtasks.
						</Text>
						<Text color={theme.text}>Do you want to continue?</Text>
					</Box>
					<SelectInput items={confirmItems} onSelect={handleConfirmSelect} />
				</Box>
			);
		}

		if (step === 'research') {
			return (
				<Box flexDirection="column">
					<Box marginBottom={2}>
						<Text color={theme.text}>
							Use research for better task breakdown?
						</Text>
					</Box>
					<SelectInput items={researchItems} onSelect={handleResearchSelect} />
				</Box>
			);
		}

		// Number input step
		return (
			<Box flexDirection="column">
				<Box marginBottom={2}>
					<Text color={theme.text}>
						How many subtasks? (default: {defaultNum}
						{fromComplexityReport
							? ' ✓ from complexity analysis'
							: ' - estimated'}
						):
					</Text>
				</Box>
				<Box marginBottom={2} alignItems="center">
					<Text color={theme.text}>→ </Text>
					<Box marginLeft={1} flexGrow={1}>
						<TextInput
							value={numSubtasks}
							onChange={setNumSubtasks}
							onSubmit={handleNumberSubmit}
							placeholder={defaultNum.toString()}
						/>
					</Box>
				</Box>
				<Box justifyContent="center">
					<Text color={theme.textDim}>
						Press Enter to confirm or Escape to cancel
					</Text>
				</Box>
			</Box>
		);
	};

	return (
		<BaseModal
			title={modalProps.title}
			onClose={onClose}
			width="60%"
			height="auto"
			preset={modalProps.preset}
		>
			{renderStepContent()}
		</BaseModal>
	);
}
