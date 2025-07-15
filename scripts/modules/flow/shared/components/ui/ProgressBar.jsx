import React from 'react';
import { Text, Box } from 'ink';

const ProgressBar = ({ progress = 0, width = 40, showPercentage = true }) => {
	// Ensure progress is between 0 and 100
	const normalizedProgress = Math.max(0, Math.min(100, progress));
	
	// Calculate filled and empty sections
	const filledWidth = Math.round((normalizedProgress / 100) * width);
	const emptyWidth = width - filledWidth;
	
	// Create progress bar using block characters
	const filledBar = '█'.repeat(filledWidth);
	const emptyBar = '░'.repeat(emptyWidth);
	
	return (
		<Box flexDirection="column">
			<Box>
				<Text color="green">{filledBar}</Text>
				<Text color="gray">{emptyBar}</Text>
				{showPercentage && (
					<Text color="white"> {Math.round(normalizedProgress)}%</Text>
				)}
			</Box>
		</Box>
	);
};

// Simple circular progress for terminal (just shows percentage)
export const CircularProgress = ({ value = 0, max = 100, showPercentage = true }) => {
	const percentage = Math.min((value / max) * 100, 100);
	
	return (
		<Box>
			<Text color="blue">◐ </Text>
			{showPercentage && (
				<Text color="white">{Math.round(percentage)}%</Text>
			)}
		</Box>
	);
};

// Step progress component for terminal
export const StepProgress = ({ steps = [], currentStep = 0 }) => {
	return (
		<Box flexDirection="column">
			{steps.map((step, index) => {
				const isCompleted = index < currentStep;
				const isCurrent = index === currentStep;
				
				let symbol = '○';
				let color = 'gray';
				
				if (isCompleted) {
					symbol = '●';
					color = 'green';
				} else if (isCurrent) {
					symbol = '◐';
					color = 'blue';
				}
				
				return (
					<Box key={step || `empty-step-${Date.now()}-${Math.random()}`}>
						<Text color={color}>{symbol} </Text>
						<Text color={isCurrent ? 'white' : 'gray'}>{step}</Text>
					</Box>
				);
			})}
		</Box>
	);
};

export default ProgressBar;
