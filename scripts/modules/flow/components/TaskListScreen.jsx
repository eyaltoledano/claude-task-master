import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';

export function TaskListScreen() {
	const { tasks, backend, reloadTasks, setCurrentScreen } = useAppContext();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [filter, setFilter] = useState('all'); // all, pending, done, in-progress

	// Filter tasks based on current filter
	const filteredTasks = tasks.filter((task) => {
		if (filter === 'all') return true;
		return task.status === filter;
	});

	// Status cycle order
	const statusCycle = [
		'pending',
		'in-progress',
		'done',
		'blocked',
		'deferred',
		'cancelled'
	];

	// Handle keyboard navigation
	useInput((input, key) => {
		if (key.upArrow) {
			setSelectedIndex(Math.max(0, selectedIndex - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(Math.min(filteredTasks.length - 1, selectedIndex + 1));
		}

		// Press 'n' to cycle status
		if (input === 'n' && filteredTasks[selectedIndex]) {
			const task = filteredTasks[selectedIndex];
			const currentStatusIndex = statusCycle.indexOf(task.status);
			const nextStatusIndex = (currentStatusIndex + 1) % statusCycle.length;
			const nextStatus = statusCycle[nextStatusIndex];

			backend
				.setTaskStatus(task.id, nextStatus)
				.then(() => reloadTasks())
				.catch((error) => console.error('Failed to update status:', error));
		}

		// Filter shortcuts
		if (input === '1') setFilter('all');
		if (input === '2') setFilter('pending');
		if (input === '3') setFilter('in-progress');
		if (input === '4') setFilter('done');

		// Return to welcome
		if (key.escape) {
			setCurrentScreen('welcome');
		}
	});

	const getStatusColor = (status) => {
		const colors = {
			done: 'green',
			'in-progress': 'cyan',
			pending: 'yellow',
			blocked: 'red',
			deferred: 'gray',
			cancelled: 'gray'
		};
		return colors[status] || 'white';
	};

	const getStatusSymbol = (status) => {
		const symbols = {
			done: '✓',
			'in-progress': '●',
			pending: '○',
			blocked: '✗',
			deferred: '⊝',
			cancelled: '⊗'
		};
		return symbols[status] || '?';
	};

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
					Task List
				</Text>
				<Text> • </Text>
				<Text>Total: {tasks.length}</Text>
				<Text> • </Text>
				<Text>Filter: </Text>
				<Text color={filter === 'all' ? 'cyan' : 'gray'}>[1] All </Text>
				<Text color={filter === 'pending' ? 'cyan' : 'gray'}>[2] Pending </Text>
				<Text color={filter === 'in-progress' ? 'cyan' : 'gray'}>
					[3] In Progress{' '}
				</Text>
				<Text color={filter === 'done' ? 'cyan' : 'gray'}>[4] Done</Text>
			</Box>

			{/* Task list */}
			<Box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
				{filteredTasks.length === 0 ? (
					<Text dimColor>No tasks found with current filter.</Text>
				) : (
					filteredTasks.map((task, index) => {
						const isSelected = index === selectedIndex;
						const statusColor = getStatusColor(task.status);
						const statusSymbol = getStatusSymbol(task.status);

						return (
							<Box key={task.id} marginBottom={0}>
								<Text color={isSelected ? 'cyan' : 'white'}>
									{isSelected ? '❯ ' : '  '}
								</Text>
								<Text color={statusColor}>{statusSymbol} </Text>
								<Text dimColor>[{task.id}] </Text>
								<Text>{task.title}</Text>
								{task.dependencies?.length > 0 && (
									<Text dimColor> (deps: {task.dependencies.join(', ')})</Text>
								)}
							</Box>
						);
					})
				)}
			</Box>

			{/* Help bar */}
			<Box
				borderStyle="single"
				borderColor="gray"
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text dimColor>
					↑↓ Navigate • n Change Status • 1-4 Filter • ESC Back • /help Commands
				</Text>
			</Box>
		</Box>
	);
}
