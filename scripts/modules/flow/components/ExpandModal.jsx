import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';

export function ExpandModal({
	onSelect,
	onClose,
	defaultNum = 5,
	fromComplexityReport = false
}) {
	const [step, setStep] = useState('research'); // 'research' or 'number'
	const [useResearch, setUseResearch] = useState(false);
	const [numSubtasks, setNumSubtasks] = useState(defaultNum.toString());

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

	const handleResearchSelect = (item) => {
		if (item.value === 'cancel') {
			onClose();
		} else {
			setUseResearch(item.value === 'research');
			setStep('number');
		}
	};

	const handleNumberSubmit = () => {
		const num = parseInt(numSubtasks, 10);
		if (!isNaN(num) && num > 0) {
			onSelect({ research: useResearch, num });
		}
	};

	const handleNumberKeyPress = (key) => {
		if (key === 'escape') {
			onClose();
		}
	};

	if (step === 'research') {
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
						items={researchItems}
						onSelect={handleResearchSelect}
						indicatorComponent={({ isSelected }) => (
							<Text color={isSelected ? theme.accent : theme.textDim}>
								{isSelected ? '▶ ' : '  '}
							</Text>
						)}
						itemComponent={({ isSelected, label }) => (
							<Text color={isSelected ? theme.accent : theme.text}>
								{label}
							</Text>
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

	// Number input step
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
					Number of Subtasks
				</Text>

				<Text> </Text>

				<Text color={theme.text}>How many subtasks to generate?</Text>

				<Text color={theme.textDim}>
					(Recommendation: {defaultNum}{' '}
					{fromComplexityReport ? '✓' : 'estimated'})
				</Text>

				<Text> </Text>

				<Box>
					<Text color={theme.accent}>Number: </Text>
					<TextInput
						value={numSubtasks}
						onChange={setNumSubtasks}
						onSubmit={handleNumberSubmit}
						placeholder={defaultNum.toString()}
						onKeyPress={handleNumberKeyPress}
					/>
				</Box>

				<Text> </Text>

				<Text color={theme.textDim}>Enter confirm • ESC cancel</Text>
			</Box>
		</Box>
	);
}
