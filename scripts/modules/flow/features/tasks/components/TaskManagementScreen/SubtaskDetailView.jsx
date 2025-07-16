import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../../../../shared/theme/theme.js';
import { ResearchInputModal } from '../../../../components/ResearchInputModal.jsx';
import { VibeKitExecutionModal } from '../../../../components/VibeKitExecutionModal.jsx';
import { Toast } from '../../../../shared/components/ui/Toast.jsx';

export function SubtaskDetailView({
	// State
	selectedTask,
	selectedSubtask,
	tasks,
	detailScrollOffset,
	setDetailScrollOffset,
	showResearchModal,
	setShowResearchModal,
	showVibeKitModal,
	setShowVibeKitModal,
	toast,
	setToast,
	DETAIL_VISIBLE_ROWS,

	// Actions
	setViewMode,
	cycleTaskStatus,
	handleRunResearch,
	handleVibeKitComplete,
	getStatusSymbol
}) {
	const theme = getTheme();

	// Handle keyboard input for subtask detail view
	useInput((input, key) => {
		// Don't process keys if modals are open
		if (showResearchModal || showVibeKitModal) {
			if (key.escape) {
				setShowResearchModal(false);
				setShowVibeKitModal(false);
			}
			return;
		}

		if (key.upArrow) {
			setDetailScrollOffset((p) => Math.max(0, p - 1));
		} else if (key.downArrow) {
			const maxOffset = getMaxScrollOffset();
			setDetailScrollOffset((p) => Math.min(maxOffset, p + 1));
		} else if (input === 't') {
			cycleTaskStatus({
				...selectedSubtask,
				id: `${selectedTask.id}.${selectedSubtask.id}`
			});
		} else if (input === 'r') {
			setShowResearchModal(true);
		} else if (input === 'a') {
			setShowVibeKitModal(true);
		} else if (key.escape) {
			setViewMode('subtasks');
		}
	});

	// Helper function
	const getStatusColor = (status) => {
		switch (status) {
			case 'done':
				return theme.statusDone;
			case 'in-progress':
				return theme.statusInProgress;
			case 'pending':
				return theme.statusPending;
			case 'review':
				return theme.priorityMedium;
			case 'blocked':
				return theme.statusBlocked;
			case 'deferred':
				return theme.statusDeferred;
			case 'cancelled':
				return theme.statusBlocked;
			default:
				return theme.text;
		}
	};

	// Calculate content lines for subtask detail view
	const contentLines = [];

	// Add all the content that will be displayed
	contentLines.push({
		type: 'field',
		label: 'Status:',
		value: `${getStatusSymbol(selectedSubtask.status)} ${selectedSubtask.status}`,
		color: getStatusColor(selectedSubtask.status)
	});

	contentLines.push({
		type: 'field',
		label: 'Title:',
		value: selectedSubtask.title
	});

	if (selectedSubtask.description) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({ type: 'header', text: 'Description:' });
		contentLines.push({
			type: 'text',
			text: selectedSubtask.description
		});
	}

	if (selectedSubtask.details) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'header',
			text: 'Implementation Details:'
		});
		// Split details into lines
		const detailLines = selectedSubtask.details.split('\n');
		detailLines.forEach((line) => {
			contentLines.push({ type: 'text', text: line });
		});
	}

	// Handle dependencies
	if (
		selectedSubtask.dependencies &&
		selectedSubtask.dependencies.length > 0
	) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'field',
			label: 'Dependencies:',
			value: selectedSubtask.dependencies
				.map((dep) => {
					// For subtask dependencies, they could be other subtasks or main tasks
					// Try to find the task/subtask and check its status
					let depStatus = '⏱️'; // pending by default

					// Check if it's a subtask dependency (format: parentId.subtaskId)
					if (typeof dep === 'string' && dep.includes('.')) {
						const [parentId, subId] = dep.split('.');
						if (parseInt(parentId) === selectedTask.id) {
							// It's a sibling subtask
							const siblingSubtask = selectedTask.subtasks.find(
								(st) => st.id === parseInt(subId)
							);
							if (siblingSubtask?.status === 'done') {
								depStatus = '✅';
							}
						}
					} else {
						// It's a main task dependency
						const depTask = tasks.find((t) => t.id === dep);
						if (depTask?.status === 'done') {
							depStatus = '✅';
						}
					}

					return `${depStatus} ${dep}`;
				})
				.join(', ')
		});
	}

	if (selectedSubtask.testStrategy) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'header',
			text: 'Test Strategy:'
		});
		// Split test strategy into lines
		const testLines = selectedSubtask.testStrategy.split('\n');
		testLines.forEach((line) => {
			contentLines.push({ type: 'text', text: line });
		});
	}

	// Calculate max scroll offset for bounds checking
	const getMaxScrollOffset = () => {
		return Math.max(0, contentLines.length - DETAIL_VISIBLE_ROWS);
	};

	// Calculate visible content based on scroll offset
	const visibleContent = contentLines.slice(
		detailScrollOffset,
		detailScrollOffset + DETAIL_VISIBLE_ROWS
	);

	return (
		<Box key="subtask-detail-view" flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color="white">Task #{selectedTask.id}</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>Subtask #{selectedSubtask.id}</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back to subtasks]</Text>
			</Box>

			{/* Subtask Details with scrolling */}
			<Box
				flexGrow={1}
				flexDirection="column"
				paddingLeft={2}
				paddingRight={2}
				height={DETAIL_VISIBLE_ROWS + 2}
				overflow="hidden"
			>
				{visibleContent.map((line, index) => {
					const key = `subtask-detail-${selectedTask.id}-${selectedSubtask.id}-${index}`;
					if (line.type === 'field') {
						return (
							<Box key={key}>
								<Text bold color={theme.textDim} width={15}>
									{line.label}
								</Text>
								<Text color={line.color || theme.text}>{line.value}</Text>
							</Box>
						);
					} else if (line.type === 'header') {
						return (
							<Box key={key}>
								<Text color={theme.accent} bold>
									{line.text}
								</Text>
							</Box>
						);
					} else if (line.type === 'text') {
						return (
							<Box key={key}>
								<Text color={theme.text}>{line.text}</Text>
							</Box>
						);
					} else if (line.type === 'spacer') {
						return <Box key={key} height={1} />;
					}
					return null;
				})}

				{/* Scroll indicator */}
				{contentLines.length > DETAIL_VISIBLE_ROWS && (
					<Box marginTop={1}>
						<Text color={theme.textDim}>
							Lines {detailScrollOffset + 1}-
							{Math.min(
								detailScrollOffset + DETAIL_VISIBLE_ROWS,
								contentLines.length
							)}{' '}
							of {contentLines.length} • ↑↓ scroll
						</Text>
					</Box>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text color={theme.text}>
					{contentLines.length > DETAIL_VISIBLE_ROWS ? '↑↓ scroll • ' : ''}
					t status • r research • a agent • ESC back
				</Text>
			</Box>

			{/* Modals */}
			{showResearchModal && (
				<ResearchInputModal
					onResearch={handleRunResearch}
					onClose={() => setShowResearchModal(false)}
				/>
			)}

			{showVibeKitModal && (
				<VibeKitExecutionModal
					task={selectedTask}
					subtask={selectedSubtask}
					isVisible={showVibeKitModal}
					onClose={() => setShowVibeKitModal(false)}
					onComplete={handleVibeKitComplete}
				/>
			)}

			{/* Toast notifications */}
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onDismiss={() => setToast(null)}
				/>
			)}
		</Box>
	);
} 