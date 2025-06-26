import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export function NextTaskModal({ task, onClose }) {
	const [scrollOffset, setScrollOffset] = useState(0);
	const maxVisibleLines = 20; // Adjust based on terminal height

	useInput((input, key) => {
		if (key.escape) {
			onClose();
		}

		// Scroll controls
		if (key.downArrow || input === 'j') {
			setScrollOffset(prev => prev + 1);
		}
		if (key.upArrow || input === 'k') {
			setScrollOffset(prev => Math.max(0, prev - 1));
		}
		if (key.pageDown) {
			setScrollOffset(prev => prev + 10);
		}
		if (key.pageUp) {
			setScrollOffset(prev => Math.max(0, prev - 10));
		}
		// Home/End keys
		if (input === 'g' && key.shift) {
			setScrollOffset(0);
		}
		if (input === 'G') {
			setScrollOffset(999); // Will be clamped to max
		}
	});

	// Helper function to wrap long text
	const wrapText = (text, maxWidth = 75) => {
		if (!text) return '';
		const words = text.split(' ');
		const lines = [];
		let currentLine = '';

		words.forEach(word => {
			if ((currentLine + word).length > maxWidth) {
				if (currentLine) lines.push(currentLine.trim());
				currentLine = word + ' ';
			} else {
				currentLine += word + ' ';
			}
		});
		if (currentLine) lines.push(currentLine.trim());

		return lines.join('\n');
	};

	if (!task) {
		return (
			<Box
				width="100%"
				height="100%"
				flexDirection="column"
				justifyContent="center"
				alignItems="center"
			>
				<Box
					flexDirection="column"
					borderStyle="round"
					borderColor={theme.border}
					paddingTop={1}
					paddingBottom={1}
					paddingLeft={2}
					paddingRight={2}
					width={60}
				>
					<Box marginBottom={1} justifyContent="center">
						<Text color={theme.accent} bold>
							No Pending Tasks
						</Text>
					</Box>
					<Box justifyContent="center">
						<Text color={theme.text}>
							All tasks are either completed or have unmet dependencies.
						</Text>
					</Box>
					<Box marginTop={1} justifyContent="center">
						<Text color={theme.textDim}>Press ESC to close</Text>
					</Box>
				</Box>
			</Box>
		);
	}

	// Format dependencies display
	const formatDependencies = (deps) => {
		if (!deps || deps.length === 0) return 'None';
		return deps.map(dep => {
			const status = dep.completed ? '✅' : '⏱️';
			return `${status} ${dep.id}`;
		}).join(', ');
	};

	// Build content sections
	const contentSections = [];

	// Task header section
	contentSections.push({
		type: 'header',
		content: (
			<Box key="header" marginBottom={1}>
				<Text color={theme.accent} bold>Task {task.id}: </Text>
				<Text color={theme.textBright} bold>{task.title}</Text>
			</Box>
		)
	});

	// Status and Priority section
	contentSections.push({
		type: 'status',
		content: (
			<Box key="status" marginBottom={1}>
				<Box>
					<Text color={theme.textDim}>Status: </Text>
					<Text color={
						task.status === 'done' ? theme.success :
						task.status === 'in-progress' ? theme.warning :
						theme.text
					}>
						{task.status}
					</Text>
				</Box>
				{task.priority && (
					<Box marginLeft={2}>
						<Text color={theme.textDim}>Priority: </Text>
						<Text color={
							task.priority === 'high' ? theme.error :
							task.priority === 'medium' ? theme.warning :
							theme.success
						}>
							{task.priority}
						</Text>
					</Box>
				)}
			</Box>
		)
	});

	// Description section
	if (task.description) {
		contentSections.push({
			type: 'section',
			content: (
				<Box key="description" marginBottom={1} flexDirection="column">
					<Box borderStyle="single" borderColor={theme.border} borderBottom={false} paddingLeft={1}>
						<Text color={theme.accent} bold>📝 Description</Text>
					</Box>
					<Box borderStyle="single" borderColor={theme.border} borderTop={false} paddingLeft={2} paddingRight={1} paddingBottom={1}>
						<Text color={theme.text}>{wrapText(task.description)}</Text>
					</Box>
				</Box>
			)
		});
	}

	// Implementation Details section
	if (task.details) {
		contentSections.push({
			type: 'section',
			content: (
				<Box key="details" marginBottom={1} flexDirection="column">
					<Box borderStyle="single" borderColor={theme.border} borderBottom={false} paddingLeft={1}>
						<Text color={theme.accent} bold>🔧 Implementation Details</Text>
					</Box>
					<Box borderStyle="single" borderColor={theme.border} borderTop={false} paddingLeft={2} paddingRight={1} paddingBottom={1}>
						<Text color={theme.text}>{wrapText(task.details)}</Text>
					</Box>
				</Box>
			)
		});
	}

	// Dependencies section
	if (task.dependencies && task.dependencies.length > 0) {
		contentSections.push({
			type: 'section',
			content: (
				<Box key="dependencies" marginBottom={1} flexDirection="column">
					<Box borderStyle="single" borderColor={theme.border} borderBottom={false} paddingLeft={1}>
						<Text color={theme.accent} bold>🔗 Dependencies</Text>
					</Box>
					<Box borderStyle="single" borderColor={theme.border} borderTop={false} paddingLeft={2} paddingRight={1} paddingBottom={1}>
						<Text color={theme.text}>{formatDependencies(task.dependencies)}</Text>
					</Box>
				</Box>
			)
		});
	}

	// Subtasks section
	if (task.subtasks && task.subtasks.length > 0) {
		const completedCount = task.subtasks.filter(st => st.status === 'done').length;
		const subtaskElements = task.subtasks.map((subtask, idx) => (
			<Box key={`subtask-${idx}`}>
				<Text color={subtask.status === 'done' ? theme.success : theme.text}>
					{subtask.status === 'done' ? '✅' : '○'} {subtask.id}: {subtask.title}
				</Text>
			</Box>
		));

		contentSections.push({
			type: 'section',
			content: (
				<Box key="subtasks" marginBottom={1} flexDirection="column">
					<Box borderStyle="single" borderColor={theme.border} borderBottom={false} paddingLeft={1}>
						<Text color={theme.accent} bold>
							📋 Subtasks ({completedCount}/{task.subtasks.length} completed)
						</Text>
					</Box>
					<Box borderStyle="single" borderColor={theme.border} borderTop={false} paddingLeft={2} paddingRight={1} paddingBottom={1} flexDirection="column">
						{subtaskElements}
					</Box>
				</Box>
			)
		});
	}

	// Test Strategy section
	if (task.testStrategy) {
		contentSections.push({
			type: 'section',
			content: (
				<Box key="test" marginBottom={1} flexDirection="column">
					<Box borderStyle="single" borderColor={theme.border} borderBottom={false} paddingLeft={1}>
						<Text color={theme.accent} bold>🧪 Test Strategy</Text>
					</Box>
					<Box borderStyle="single" borderColor={theme.border} borderTop={false} paddingLeft={2} paddingRight={1} paddingBottom={1}>
						<Text color={theme.text}>{wrapText(task.testStrategy)}</Text>
					</Box>
				</Box>
			)
		});
	}

	// Suggested Actions section
	contentSections.push({
		type: 'actions',
		content: (
			<Box key="actions" flexDirection="column">
				<Box borderStyle="double" borderColor={theme.accent} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
					<Box flexDirection="column">
						<Text color={theme.accent} bold>💡 Suggested Actions</Text>
						<Box paddingLeft={2} flexDirection="column" marginTop={1}>
							<Text color={theme.text}>• Press <Text color={theme.accent}>/tasks</Text> to open task management</Text>
							<Text color={theme.text}>• Press <Text color={theme.accent}>/chat</Text> to discuss with AI</Text>
							{!task.subtasks || task.subtasks.length === 0 ? (
								<Text color={theme.text}>• Consider expanding this task into subtasks</Text>
							) : (
								<Text color={theme.text}>• Work through subtasks sequentially</Text>
							)}
							{task.status === 'pending' && (
								<Text color={theme.text}>• Mark as <Text color={theme.warning}>in-progress</Text> when starting</Text>
							)}
						</Box>
					</Box>
				</Box>
			</Box>
		)
	});

	// Calculate visible content based on scroll
	const allContent = contentSections.map(section => section.content);
	
	// Create a scrollable container with all content
	const scrollableContent = (
		<Box flexDirection="column">
			{allContent}
		</Box>
	);

	return (
		<Box
			width="100%"
			height="100%"
			flexDirection="column"
			justifyContent="center"
			alignItems="center"
		>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.accent}
				paddingTop={1}
				paddingBottom={1}
				paddingLeft={2}
				paddingRight={2}
				width={85}
				height={28}
			>
				{/* Header */}
				<Box marginBottom={1} justifyContent="space-between">
					<Box>
						<Text color={theme.accent} bold>
							📌 Next Task Details
						</Text>
					</Box>
					<Box>
						<Text color={theme.textDim}>↑↓ scroll • ESC close</Text>
					</Box>
				</Box>

				{/* Scrollable content area */}
				<Box flexDirection="column" height={24} overflow="hidden">
					<Box marginTop={-scrollOffset}>
						{scrollableContent}
					</Box>
				</Box>

				{/* Scroll indicator */}
				<Box justifyContent="center" marginTop={1}>
					<Text color={theme.textDim}>
						{scrollOffset > 0 ? '↑ ' : '  '}
						Scroll for more
						{' ↓'}
					</Text>
				</Box>
			</Box>
		</Box>
	);
} 