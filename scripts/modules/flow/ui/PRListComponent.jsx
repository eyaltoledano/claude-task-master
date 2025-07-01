import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

const PRListComponent = ({ prs, selectedPR, onSelect }) => {
	const selectedIndex = prs.findIndex(pr => pr.prNumber === selectedPR?.prNumber);

	useInput((input, key) => {
		if (key.upArrow) {
			const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : prs.length - 1;
			onSelect(prs[nextIndex]);
		}
		if (key.downArrow) {
			const nextIndex = selectedIndex < prs.length - 1 ? selectedIndex + 1 : 0;
			onSelect(prs[nextIndex]);
		}
	});

	const getStatusColor = (status) => {
		switch (status) {
			case 'ready-to-merge':
				return 'green';
			case 'merged':
				return 'magenta';
			case 'checks-failed':
				return 'red';
			default:
				return 'yellow';
		}
	};

	if (prs.length === 0) {
		return <Text>No pull requests are being monitored.</Text>;
	}

	return (
		<Box flexDirection="column" paddingX={1} width="100%">
			<Text bold>Monitored PRs</Text>
			{prs.map((pr, index) => (
				<Box key={pr.prNumber} flexDirection="column">
					<Text 
						backgroundColor={index === selectedIndex ? 'blue' : undefined} 
						color={getStatusColor(pr.status)}
					>
						#{pr.prNumber} - {pr.status} {pr.autoMerge ? '(Auto-merge)' : ''}
					</Text>
					<Text dimColor>Task: {pr.taskId || 'N/A'}</Text>
				</Box>
			))}
		</Box>
	);
};

export default PRListComponent; 