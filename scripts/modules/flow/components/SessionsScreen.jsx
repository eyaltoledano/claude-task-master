import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';

export function SessionsScreen() {
	const { setCurrentScreen, backend } = useAppContext();
	const [sessions] = useState([
		{
			id: 1,
			date: new Date().toLocaleDateString(),
			duration: '2h 15m',
			tasksCompleted: 3,
			aiCost: 0.42,
			description: 'Implemented user authentication'
		},
		{
			id: 2,
			date: new Date(Date.now() - 86400000).toLocaleDateString(),
			duration: '1h 30m',
			tasksCompleted: 2,
			aiCost: 0.28,
			description: 'Fixed database schema issues'
		}
	]);

	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((input, key) => {
		if (key.escape) {
			setCurrentScreen('welcome');
		}

		if (key.upArrow) {
			setSelectedIndex(Math.max(0, selectedIndex - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(Math.min(sessions.length - 1, selectedIndex + 1));
		}
	});

	const totalCost = sessions.reduce((sum, s) => sum + s.aiCost, 0);
	const totalTasks = sessions.reduce((sum, s) => sum + s.tasksCompleted, 0);

	return (
		<Box flexDirection="column" flexGrow={1}>
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor="cyan"
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Text bold color="cyan">
					Work Sessions
				</Text>
				<Text> • </Text>
				<Text>Total: {sessions.length}</Text>
				<Text> • </Text>
				<Text>Tasks Done: {totalTasks}</Text>
				<Text> • </Text>
				<Text>AI Cost: ${totalCost.toFixed(2)}</Text>
			</Box>

			{/* Sessions list */}
			<Box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
				{sessions.length === 0 ? (
					<Text dimColor>
						No sessions recorded yet. Start working on tasks!
					</Text>
				) : (
					sessions.map((session, index) => {
						const isSelected = index === selectedIndex;

						return (
							<Box key={session.id} marginBottom={1} flexDirection="column">
								<Box>
									<Text color={isSelected ? 'cyan' : 'white'}>
										{isSelected ? '❯ ' : '  '}
									</Text>
									<Text bold>{session.date}</Text>
									<Text dimColor> • {session.duration}</Text>
									<Text color="green"> • {session.tasksCompleted} tasks</Text>
									<Text color="yellow"> • ${session.aiCost.toFixed(2)}</Text>
								</Box>
								<Box marginLeft={3}>
									<Text dimColor>{session.description}</Text>
								</Box>
							</Box>
						);
					})
				)}
			</Box>

			{/* Note */}
			<Box padding={1}>
				<Text dimColor italic>
					Note: Session tracking is a preview feature. Data shown is example
					data.
				</Text>
			</Box>

			{/* Help bar */}
			<Box
				borderStyle="single"
				borderColor="gray"
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text dimColor>↑↓ Navigate • Enter View Details • ESC Back</Text>
			</Box>
		</Box>
	);
}
