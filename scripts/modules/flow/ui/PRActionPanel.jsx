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

const PRActionPanel = ({ pr, backend, onNotification, onOpenConfig, onOpenCleanup }) => {
	const [selectedAction, setSelectedAction] = useState(0);

	// Always include configuration and cleanup actions
	const actions = [
		{
			label: 'Config',
			action: () => {
				onOpenConfig();
			}
		},
		{
			label: 'Cleanup',
			action: () => {
				onOpenCleanup && onOpenCleanup();
			}
		}
	];

	// Add PR-specific actions if a PR is selected
	if (pr) {
		const isPaused = pr.status === 'paused';
		actions.push(
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
		);
	}

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
			<Text bold>{pr ? `Actions for PR #${pr.prNumber}` : 'Actions'}</Text>
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
			<Box marginTop={1}>
				<Text dimColor>← → Navigate | Enter: Execute</Text>
			</Box>
		</Box>
	);
};

export default PRActionPanel; 