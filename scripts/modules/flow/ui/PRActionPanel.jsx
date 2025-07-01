import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

const ActionButton = ({ label, onAction, isSelected }) => (
	<Box 
		borderStyle="round" 
		paddingX={1} 
		borderColor={isSelected ? 'cyan' : 'gray'}
	>
		<Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
	</Box>
);

const PRActionPanel = ({ pr, backend, onNotification }) => {
	const [selectedAction, setSelectedAction] = useState(0);

	if (!pr) return null;

	const isPaused = pr.status === 'paused';
	const actions = [
		{ 
			label: isPaused ? 'Resume' : 'Pause', 
			action: async () => {
				const result = isPaused 
					? await backend.resumePRMonitoring(pr.prNumber)
					: await backend.pausePRMonitoring(pr.prNumber);
				onNotification(result ? `PR #${pr.prNumber} ${isPaused ? 'resumed' : 'paused'}.` : 'Action failed.');
			} 
		},
		{ 
			label: 'Force Merge', 
			action: async () => {
				onNotification(`Attempting to force merge PR #${pr.prNumber}...`);
				const result = await backend.forceMerge(pr.prNumber);
				onNotification(result.success ? `PR #${pr.prNumber} merged.` : `Merge failed: ${result.reason}`);
			}
		},
		{
			label: 'Stop',
			action: async () => {
				// Assumes direct-backend has stopPRMonitoring or similar
				// For now, we'll just log it.
				onNotification(`Stopping monitoring for PR #${pr.prNumber}...`);
			}
		}
	];

	useInput((input, key) => {
		if (key.leftArrow) {
			setSelectedAction(prev => (prev > 0 ? prev - 1 : actions.length - 1));
		}
		if (key.rightArrow) {
			setSelectedAction(prev => (prev < actions.length - 1 ? prev + 1 : 0));
		}
		if (key.return) {
			actions[selectedAction].action();
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Actions for PR #{pr.prNumber}</Text>
			<Box marginTop={1}>
				{actions.map((item, index) => (
					<Box key={item.label} marginRight={1}>
						<ActionButton 
							label={item.label}
							onAction={item.action}
							isSelected={index === selectedAction}
						/>
					</Box>
				))}
			</Box>
		</Box>
	);
};

export default PRActionPanel; 