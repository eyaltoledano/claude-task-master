import React from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from '../../../../shared/theme/theme.js';
import { LoadingSpinner } from '../../../../shared/components/ui/LoadingSpinner.jsx';
import { ExpandModal } from '../ExpandModal.jsx';
import { ResearchInputModal } from '../../../../components/ResearchInputModal.jsx';
import { VibeKitExecutionModal } from '../../../../components/VibeKitExecutionModal.jsx';
import { Toast } from '../../../../shared/components/ui/Toast.jsx';

export function TaskDetailView({
	// State
	selectedTask,
	tasks,
	detailScrollOffset,
	setDetailScrollOffset,
	showExpandOptions,
	setShowExpandOptions,
	showResearchModal,
	setShowResearchModal,
	showVibeKitModal,
	setShowVibeKitModal,
	isExpanding,
	toast,
	setToast,
	complexityReport,
	DETAIL_VISIBLE_ROWS,

	// Actions
	setViewMode,
	expandTask,
	handleRunResearch,
	handleVibeKitComplete,
	calculateContentLines,
	getMaxScrollOffset,
	getStatusSymbol
}) {
	const theme = getTheme();

	// Handle keyboard input for detail view
	useInput((input, key) => {
		// Don't process keys if modals are open
		if (showExpandOptions || showResearchModal || showVibeKitModal) {
			if (key.escape) {
				setShowExpandOptions(false);
				setShowResearchModal(false);
				setShowVibeKitModal(false);
			}
			return;
		}

		if (key.upArrow) {
			setDetailScrollOffset((p) => Math.max(0, p - 1));
		} else if (key.downArrow) {
			const maxOffset = getMaxScrollOffset(selectedTask, false);
			setDetailScrollOffset((p) => Math.min(maxOffset, p + 1));
		} else if (input === 'e') {
			setShowExpandOptions(true);
		} else if (input === 's' && selectedTask?.subtasks?.length > 0) {
			setViewMode('subtasks');
		} else if (input === 'r') {
			setShowResearchModal(true);
		} else if (key.escape) {
			setViewMode('list');
		}
	});

	// Helper functions
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

	const getPriorityColor = (priority) => {
		switch (priority) {
			case 'high':
				return theme.priorityHigh;
			case 'medium':
				return theme.priorityMedium;
			case 'low':
				return theme.priorityLow;
			default:
				return theme.text;
		}
	};

	// Determine default number of subtasks based on complexity report
	let defaultSubtaskNum = 5; // fallback default
	let fromComplexityReport = false;

	// First, try to get from complexity report
	if (complexityReport?.complexityAnalysis) {
		const taskAnalysis = complexityReport.complexityAnalysis.find(
			(analysis) => analysis.taskId === selectedTask.id
		);

		if (taskAnalysis?.recommendedSubtasks) {
			defaultSubtaskNum = taskAnalysis.recommendedSubtasks;
			fromComplexityReport = true;
		} else if (taskAnalysis?.complexityScore) {
			// Estimate based on complexity score if recommendedSubtasks not available
			const complexityScore = parseInt(taskAnalysis.complexityScore, 10);
			if (!Number.isNaN(complexityScore)) {
				// Higher complexity = more subtasks (3-10 range)
				defaultSubtaskNum = Math.min(
					10,
					Math.max(3, Math.round(complexityScore * 0.8))
				);
			}
		}
	} else if (selectedTask.complexity) {
		// Fallback to task's own complexity field if no report
		const complexityScore = parseInt(selectedTask.complexity, 10);
		if (!Number.isNaN(complexityScore)) {
			defaultSubtaskNum = Math.min(
				10,
				Math.max(3, Math.round(complexityScore * 0.8))
			);
		}
	}

	// Calculate content lines for detail view
	const contentLines = [];

	// Add all the content that will be displayed (excluding ID and Title which are in the header)
	contentLines.push({
		type: 'field',
		label: 'Status:',
		value: `${getStatusSymbol(selectedTask.status)} ${selectedTask.status}`,
		color: getStatusColor(selectedTask.status)
	});
	contentLines.push({
		type: 'field',
		label: 'Priority:',
		value: selectedTask.priority,
		color: getPriorityColor(selectedTask.priority)
	});
	contentLines.push({
		type: 'field',
		label: 'Dependencies:',
		value:
			selectedTask.dependencies && selectedTask.dependencies.length > 0
				? selectedTask.dependencies
						.map((dep) => {
							const depTask = tasks.find((t) => t.id === dep);
							return depTask?.status === 'done' ? `✅ ${dep}` : `⏱️ ${dep}`;
						})
						.join(', ')
				: '-'
	});

	if (selectedTask.complexity) {
		contentLines.push({
			type: 'field',
			label: 'Complexity:',
			value: `● ${selectedTask.complexity}`,
			color: theme.priorityMedium
		});
	}

	contentLines.push({
		type: 'field',
		label: 'Description:',
		value: selectedTask.description
	});

	if (selectedTask.details) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({ type: 'header', text: 'Implementation Details:' });
		// Split details into lines for proper scrolling
		const detailLines = selectedTask.details.split('\n');
		detailLines.forEach((line) => {
			contentLines.push({ type: 'text', text: line });
		});
	}

	if (selectedTask.testStrategy) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({ type: 'header', text: 'Test Strategy:' });
		// Split test strategy into lines for proper scrolling
		const testLines = selectedTask.testStrategy.split('\n');
		testLines.forEach((line) => {
			contentLines.push({ type: 'text', text: line });
		});
	}

	if (selectedTask.subtasks && selectedTask.subtasks.length > 0) {
		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'header',
			text: `Subtasks (${selectedTask.subtasks.length}):`
		});

		selectedTask.subtasks.forEach((subtask) => {
			contentLines.push({
				type: 'subtask',
				text: `${getStatusSymbol(subtask.status)} ${subtask.id}: ${subtask.title}`,
				color: getStatusColor(subtask.status)
			});
		});
	} else {
		contentLines.push({ type: 'spacer' });
		contentLines.push({
			type: 'info',
			text: "No subtasks yet. Press 'e' to break down this task."
		});
	}

	// Calculate visible content based on scroll offset
	const visibleContent = contentLines.slice(
		detailScrollOffset,
		detailScrollOffset + DETAIL_VISIBLE_ROWS
	);

	return (
		<Box key="detail-view" flexDirection="column">
			{/* Header - Always visible at top */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Text color={theme.accent} bold>
					Task #{selectedTask.id} - {selectedTask.title}
				</Text>
			</Box>

			{/* Expand Options Dialog - Rendered at fixed position */}
			{showExpandOptions && (
				<Box marginBottom={1} marginLeft={2}>
					<ExpandModal
						onSelect={(options) => {
							setShowExpandOptions(false);
							expandTask(options);
						}}
						onClose={() => setShowExpandOptions(false)}
						defaultNum={defaultSubtaskNum}
						fromComplexityReport={fromComplexityReport}
						hasExistingSubtasks={
							selectedTask.subtasks && selectedTask.subtasks.length > 0
						}
					/>
				</Box>
			)}

			{/* Loading indicator */}
			{isExpanding && (
				<Box
					flexDirection="column"
					justifyContent="center"
					alignItems="center"
					width="100%"
					height={20}
					marginTop={2}
				>
					<Box
						borderStyle="round"
						borderColor={theme.accent}
						padding={2}
						backgroundColor={theme.background || '#000000'}
					>
						<LoadingSpinner message="Expanding task..." type="expand" />
					</Box>
					<Text color={theme.warning} marginTop={2}>
						Press Ctrl+X to cancel
					</Text>
				</Box>
			)}

			{/* Task Details with scrolling - only show when not expanding */}
			{!isExpanding && !showExpandOptions && (
				<Box
					flexDirection="column"
					paddingLeft={2}
					paddingRight={2}
					height={DETAIL_VISIBLE_ROWS + 2}
					overflow="hidden"
				>
					{visibleContent.map((line, index) => {
						const key = `detail-${selectedTask.id}-${index}`;
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
						} else if (line.type === 'subtask') {
							return (
								<Box key={key}>
									<Text color={line.color}>{line.text}</Text>
								</Box>
							);
						} else if (line.type === 'warning') {
							return (
								<Box key={key}>
									<Text color={theme.warning}>{line.text}</Text>
								</Box>
							);
						} else if (line.type === 'info') {
							return (
								<Box key={key}>
									<Text color={theme.textDim}>{line.text}</Text>
								</Box>
							);
						} else if (line.type === 'hint') {
							return (
								<Box key={key}>
									<Text color={theme.textDim}>{line.text}</Text>
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
			)}

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
					{isExpanding ? (
						'Ctrl+X cancel'
					) : (
						<>
							{contentLines.length > DETAIL_VISIBLE_ROWS
								? '↑↓ scroll • '
								: ''}
							e expand • r research •
							{selectedTask?.subtasks?.length > 0 ? 's subtasks • ' : ''}
							ESC back
						</>
					)}
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
					subtask={null}
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