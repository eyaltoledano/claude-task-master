import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from '../../ui';
import { useKeypress } from '../../../shared/hooks/useKeypress.js';
import { useComponentTheme } from '../../../shared/hooks/useTheme.js';

export function NextTaskModal({ task, onClose }) {
	const [scrollOffset, setScrollOffset] = useState(0);
	const { theme } = useComponentTheme('modal');

	// Scroll controls
	const scrollHandlers = {
		downArrow: () => setScrollOffset((prev) => prev + 1),
		upArrow: () => setScrollOffset((prev) => Math.max(0, prev - 1)),
		pageDown: () => setScrollOffset((prev) => prev + 10),
		pageUp: () => setScrollOffset((prev) => Math.max(0, prev - 10)),
		home: () => setScrollOffset(0),
		end: () => setScrollOffset(999) // Will be clamped to max
	};

	// Add vim-style navigation
	const vimHandlers = {
		j: () => setScrollOffset((prev) => prev + 1),
		k: () => setScrollOffset((prev) => Math.max(0, prev - 1)),
		g: (input, key) => {
			if (key.shift) setScrollOffset(0); // G (shift+g)
		},
		G: () => setScrollOffset(999)
	};

	useKeypress({ ...scrollHandlers, ...vimHandlers });

	// Helper function to wrap long text
	const wrapText = (text, maxWidth = 70) => {
		if (!text) return '';
		const words = text.split(' ');
		const lines = [];
		let currentLine = '';

		words.forEach((word) => {
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

	// No task case
	if (!task) {
		return (
			<BaseModal
				title="No Pending Tasks"
				onClose={onClose}
				width="60%"
				height="auto"
				preset="info"
			>
				<Box flexDirection="column" alignItems="center">
					<Text color={theme.text}>
						All tasks are either completed or have unmet dependencies.
					</Text>
				</Box>
			</BaseModal>
		);
	}

	// Format dependencies display
	const formatDependencies = (deps) => {
		if (!deps || deps.length === 0) return 'None';
		return deps
			.map((dep) => {
				const status = dep.completed ? '✅' : '⏱️';
				return `${status} ${dep.id}`;
			})
			.join(', ');
	};

	// Build content sections
	const contentSections = [];

	// Task header section
	contentSections.push(
		<Box key="header" marginBottom={1}>
			<Text color={theme.accent} bold>
				Task {task.id}:{' '}
			</Text>
			<Text color={theme.textBright} bold>
				{task.title}
			</Text>
		</Box>
	);

	// Status and Priority section
	contentSections.push(
		<Box key="status" marginBottom={1}>
			<Box>
				<Text color={theme.textDim}>Status: </Text>
				<Text
					color={
						task.status === 'done'
							? theme.success
							: task.status === 'in-progress'
								? theme.warning
								: theme.text
					}
				>
					{task.status}
				</Text>
			</Box>
			{task.priority && (
				<Box marginLeft={2}>
					<Text color={theme.textDim}>Priority: </Text>
					<Text
						color={
							task.priority === 'high'
								? theme.error
								: task.priority === 'medium'
									? theme.warning
									: theme.success
						}
					>
						{task.priority}
					</Text>
				</Box>
			)}
		</Box>
	);

	// Description section
	if (task.description) {
		contentSections.push(
			<Box key="description" marginBottom={1} flexDirection="column">
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderBottom={false}
					paddingLeft={1}
				>
					<Text color={theme.accent} bold>
						📝 Description
					</Text>
				</Box>
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					paddingLeft={2}
					paddingRight={1}
					paddingBottom={1}
				>
					<Text color={theme.text}>{wrapText(task.description)}</Text>
				</Box>
			</Box>
		);
	}

	// Implementation Details section
	if (task.details) {
		contentSections.push(
			<Box key="details" marginBottom={1} flexDirection="column">
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderBottom={false}
					paddingLeft={1}
				>
					<Text color={theme.accent} bold>
						🔧 Implementation Details
					</Text>
				</Box>
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					paddingLeft={2}
					paddingRight={1}
					paddingBottom={1}
				>
					<Text color={theme.text}>{wrapText(task.details)}</Text>
				</Box>
			</Box>
		);
	}

	// Dependencies section
	if (task.dependencies && task.dependencies.length > 0) {
		contentSections.push(
			<Box key="dependencies" marginBottom={1} flexDirection="column">
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderBottom={false}
					paddingLeft={1}
				>
					<Text color={theme.accent} bold>
						🔗 Dependencies
					</Text>
				</Box>
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					paddingLeft={2}
					paddingRight={1}
					paddingBottom={1}
				>
					<Text color={theme.text}>
						{formatDependencies(task.dependencies)}
					</Text>
				</Box>
			</Box>
		);
	}

	// Subtasks section
	if (task.subtasks && task.subtasks.length > 0) {
		const completedCount = task.subtasks.filter(
			(st) => st.status === 'done'
		).length;
		const subtaskElements = task.subtasks.map((subtask) => (
			<Box key={`subtask-${subtask.id}`}>
				<Text color={subtask.status === 'done' ? theme.success : theme.text}>
					{subtask.status === 'done' ? '✅' : '○'} {subtask.id}: {subtask.title}
				</Text>
			</Box>
		));

		contentSections.push(
			<Box key="subtasks" marginBottom={1} flexDirection="column">
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderBottom={false}
					paddingLeft={1}
				>
					<Text color={theme.accent} bold>
						📋 Subtasks ({completedCount}/{task.subtasks.length} completed)
					</Text>
				</Box>
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					paddingLeft={2}
					paddingRight={1}
					paddingBottom={1}
					flexDirection="column"
				>
					{subtaskElements}
				</Box>
			</Box>
		);
	}

	// Test Strategy section
	if (task.testStrategy) {
		contentSections.push(
			<Box key="test" marginBottom={1} flexDirection="column">
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderBottom={false}
					paddingLeft={1}
				>
					<Text color={theme.accent} bold>
						🧪 Test Strategy
					</Text>
				</Box>
				<Box
					borderStyle="single"
					borderColor={theme.border}
					borderTop={false}
					paddingLeft={2}
					paddingRight={1}
					paddingBottom={1}
				>
					<Text color={theme.text}>{wrapText(task.testStrategy)}</Text>
				</Box>
			</Box>
		);
	}

	// Suggested Actions section
	contentSections.push(
		<Box key="actions" flexDirection="column">
			<Box
				borderStyle="double"
				borderColor={theme.accent}
				paddingLeft={1}
				paddingRight={1}
				paddingTop={1}
				paddingBottom={1}
			>
				<Box flexDirection="column">
					<Text color={theme.accent} bold>
						💡 Suggested Actions
					</Text>
					<Box paddingLeft={2} flexDirection="column" marginTop={1}>
						<Text color={theme.text}>
							• Press <Text color={theme.accent}>/tasks</Text> to open task
							management
						</Text>
						<Text color={theme.text}>
							• Press <Text color={theme.accent}>/chat</Text> to discuss with AI
						</Text>
						{!task.subtasks || task.subtasks.length === 0 ? (
							<Text color={theme.text}>
								• Consider expanding this task into subtasks
							</Text>
						) : (
							<Text color={theme.text}>
								• Work through subtasks sequentially
							</Text>
						)}
						{task.status === 'pending' && (
							<Text color={theme.text}>
								• Mark as <Text color={theme.warning}>in-progress</Text> when
								starting
							</Text>
						)}
					</Box>
				</Box>
			</Box>
		</Box>
	);

	// Create scrollable content
	const scrollableContent = (
		<Box flexDirection="column" height={20} overflow="hidden">
			<Box marginTop={-scrollOffset} flexDirection="column">
				{contentSections}
			</Box>
		</Box>
	);

	return (
		<BaseModal
			title="📌 Next Task Details"
			onClose={onClose}
			width="85%"
			height="30"
			showCloseHint={false} // We'll show custom scroll hint
		>
			{scrollableContent}

			{/* Custom scroll indicator */}
			<Box justifyContent="center" marginTop={1}>
				<Text color={theme.textDim}>
					{scrollOffset > 0 ? '↑ ' : '  '}
					↑↓ scroll • j/k vim • ESC close
					{' ↓'}
				</Text>
			</Box>
		</BaseModal>
	);
}
