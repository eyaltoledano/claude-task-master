#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Text, useInput, useApp, useStdout, Box } from 'ink';
import chalk from 'chalk';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { TopBar } from './components/TopBar.js';
import { BottomStatusBar } from './components/BottomStatusBar.js';
import { DashboardPanel } from './views/panels/DashboardPanel.js';
import { HelpPanel } from './views/panels/HelpPanel.js';
import { TaskDetailsModal } from './views/modals/TaskDetailsModal.js';
import { useTaskStore } from './hooks/useTaskStore.js';
import {
	getStatusColor,
	getPriorityColor,
	getComplexityDisplay
} from './utils/task-helpers.js';
import { logger } from './utils/logger.js';
import { detectProjectState, ProjectState } from './utils/project-state.js';
import type { Task } from '@tm/core';

interface AppProps {
	panel?: string;
	section?: string;
	projectPath?: string;
	explicitProject?: boolean; // Flag to indicate --project was explicitly provided
}

type PanelType = 'dashboard' | 'help';

const AppContent: React.FC<AppProps> = ({
	panel: initialPanel,
	projectPath: propProjectPath
}) => {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const projectPath = propProjectPath || process.cwd();

	const [currentPanel, setCurrentPanel] = useState<PanelType>(
		(initialPanel as PanelType) || 'dashboard'
	);

	const [dimensions, setDimensions] = useState({
		width: stdout.columns || 80,
		height: stdout.rows || 24
	});

	const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
	const [scrollOffset, setScrollOffset] = useState<number>(0);

	const [showModal, setShowModal] = useState<boolean>(false);
	const [modalTask, setModalTask] = useState<Task | null>(null);

	const [maximizedSection, setMaximizedSection] = useState<
		null | 'project' | 'dependency' | 'tasklist'
	>(null);

	const { tasks, complexityMap, loading, error } = useTaskStore(projectPath);

	const flattenedTasks: Array<any> = [];
	tasks.forEach((task) => {
		flattenedTasks.push(task);
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				flattenedTasks.push({
					...subtask,
					isSubtask: true,
					parentId: task.id
				});
			});
		}
	});

	useEffect(() => {
		if (stdout.columns && stdout.rows) {
			setDimensions({ width: stdout.columns, height: stdout.rows });
		}

		const handleResize = () => {
			setDimensions({
				width: stdout.columns || 80,
				height: stdout.rows || 24
			});
		};

		stdout.on('resize', handleResize);
		return () => {
			stdout.off('resize', handleResize);
		};
	}, [stdout]);

	useEffect(() => {
		if (currentPanel !== 'dashboard') return;

		const contentHeight = dimensions.height - 2;
		const bottomRowHeight = Math.floor((contentHeight * 3) / 5);
		const visibleRows = Math.max(1, bottomRowHeight - 5);

		if (selectedTaskIndex >= scrollOffset + visibleRows) {
			setScrollOffset(selectedTaskIndex - visibleRows + 1);
		}

		if (selectedTaskIndex < scrollOffset) {
			setScrollOffset(selectedTaskIndex);
		}
	}, [selectedTaskIndex, currentPanel, dimensions.height, scrollOffset]);

	useInput((input, key) => {
		if (showModal) {
			if (key.escape || key.return || input === 'q') {
				setShowModal(false);
				setModalTask(null);
			}
			return;
		}

		if ((key.ctrl && input === 'c') || input === 'q') {
			exit();
		}

		if (key.tab) {
			setCurrentPanel((prev) => (prev === 'dashboard' ? 'help' : 'dashboard'));
			return;
		}

		if (currentPanel === 'dashboard') {
			if (input === '0') {
				setMaximizedSection(null);
				return;
			}
			if (input === '1') {
				setMaximizedSection('project');
				return;
			}
			if (input === '2') {
				setMaximizedSection('dependency');
				return;
			}
			if (input === '3') {
				setMaximizedSection('tasklist');
				return;
			}

			if (key.return) {
				const task = flattenedTasks[selectedTaskIndex];
				if (task) {
					setModalTask(task as Task);
					setShowModal(true);
				}
				return;
			}

			if (key.upArrow) {
				setSelectedTaskIndex((prev) => Math.max(0, prev - 1));
			}

			if (key.downArrow) {
				setSelectedTaskIndex((prev) =>
					Math.min(flattenedTasks.length - 1, prev + 1)
				);
			}

			if (key.pageUp) {
				setSelectedTaskIndex((prev) => Math.max(0, prev - 10));
			}

			if (key.pageDown) {
				setSelectedTaskIndex((prev) =>
					Math.min(flattenedTasks.length - 1, prev + 10)
				);
			}
		}
	});

	const contentHeight = dimensions.height - 2;

	if (loading) {
		return (
			<Box
				flexDirection="column"
				width={dimensions.width}
				height={dimensions.height}
			>
				<TopBar currentPanel={currentPanel} />
				<Box
					flexDirection="column"
					justifyContent="center"
					alignItems="center"
					height={contentHeight}
				>
					<Text>Loading tasks...</Text>
				</Box>
				<BottomStatusBar dimensions={dimensions} currentPanel={currentPanel} />
			</Box>
		);
	}

	if (error) {
		return (
			<Box
				flexDirection="column"
				width={dimensions.width}
				height={dimensions.height}
			>
				<TopBar currentPanel={currentPanel} />
				<Box
					flexDirection="column"
					justifyContent="center"
					alignItems="center"
					height={contentHeight}
				>
					<Text color="red">Error: {error}</Text>
				</Box>
				<BottomStatusBar dimensions={dimensions} currentPanel={currentPanel} />
			</Box>
		);
	}

	return (
		<Box
			flexDirection="column"
			width={dimensions.width}
			height={dimensions.height}
		>
			<TopBar currentPanel={currentPanel} />

			{currentPanel === 'dashboard' ? (
				<DashboardPanel
					tasks={tasks}
					complexityMap={complexityMap}
					selectedTaskIndex={selectedTaskIndex}
					scrollOffset={scrollOffset}
					contentHeight={contentHeight}
					maximizedSection={maximizedSection}
				/>
			) : (
				<HelpPanel height={contentHeight} />
			)}

			<BottomStatusBar
				dimensions={dimensions}
				currentPanel={currentPanel}
				maximizedSection={maximizedSection}
			/>

			{showModal && modalTask && (
				<TaskDetailsModal
					task={modalTask}
					tasks={tasks}
					complexityMap={complexityMap}
					dimensions={dimensions}
					getStatusColor={getStatusColor}
					getPriorityColor={getPriorityColor}
					getComplexityDisplay={getComplexityDisplay}
				/>
			)}
		</Box>
	);
};

/**
 * Main App component with error boundary
 */
const App: React.FC<AppProps> = (props) => {
	return (
		<ErrorBoundary
			onError={(error, errorInfo) => {
				logger.fatal('Unhandled application error', error, {
					componentStack: errorInfo.componentStack
				});
			}}
		>
			<AppContent {...props} />
		</ErrorBoundary>
	);
};

/**
 * Print onboarding message for uninitialized project
 */
function printUninitializedMessage(): void {
	console.log();
	console.log(chalk.yellow.bold('⚠ Task Master Not Initialized'));
	console.log();
	console.log("This project hasn't been initialized with Task Master yet.");
	console.log();
	console.log(chalk.white.bold('To get started:'));
	console.log();
	console.log('  1. Initialize Task Master:');
	console.log(chalk.cyan('     task-master init'));
	console.log();
	console.log('  2. Parse your PRD to generate tasks:');
	console.log(
		chalk.cyan('     task-master parse-prd .taskmaster/docs/prd.txt')
	);
	console.log();
	console.log('  3. Launch the Terminal UI:');
	console.log(chalk.cyan('     task-master interactive'));
	console.log();
}

/**
 * Print onboarding message for project with no tasks
 */
function printNoTasksMessage(): void {
	console.log();
	console.log(chalk.blue.bold('ℹ Task Master Initialized - No Tasks Found'));
	console.log();
	console.log(
		'Your project is initialized, but no tasks have been created yet.'
	);
	console.log();
	console.log(chalk.white.bold('To create tasks:'));
	console.log();
	console.log('  1. Create a PRD file in:');
	console.log(chalk.cyan('     .taskmaster/docs/prd.txt'));
	console.log();
	console.log('  2. Generate tasks from PRD:');
	console.log(
		chalk.cyan('     task-master parse-prd .taskmaster/docs/prd.txt')
	);
	console.log();
	console.log('  Or manually add tasks:');
	console.log(
		chalk.cyan('     task-master add-task --prompt="Your task description"')
	);
	console.log();
}

/**
 * Launch the terminal UI
 */
export const launchTerminalUI = async (props?: AppProps): Promise<void> => {
	const projectPath = props?.projectPath || process.cwd();
	const explicitProject = props?.explicitProject || false;
	const projectState = detectProjectState(projectPath);

	// If --project was explicitly provided and project is not ready, show error instead of onboarding
	if (explicitProject) {
		if (projectState.state === ProjectState.UNINITIALIZED) {
			console.log();
			console.log(chalk.red.bold('✗ Error: Task Master Not Initialized'));
			console.log();
			console.log(
				`The specified project path is not initialized with Task Master:`
			);
			console.log(chalk.cyan(`  ${projectPath}`));
			console.log();
			console.log(chalk.white.bold('To initialize this project:'));
			console.log();
			console.log('  1. Navigate to the project directory:');
			console.log(chalk.cyan(`     cd ${projectPath}`));
			console.log();
			console.log('  2. Initialize Task Master:');
			console.log(chalk.cyan('     task-master init'));
			console.log();
			console.log('Or omit the --project flag to use the current directory.');
			console.log();
			return;
		}

		if (projectState.state === ProjectState.NO_TASKS) {
			console.log();
			console.log(chalk.red.bold('✗ Error: No Tasks Found'));
			console.log();
			console.log(`The specified project has no tasks:`);
			console.log(chalk.cyan(`  ${projectPath}`));
			console.log();
			console.log(chalk.white.bold('To create tasks:'));
			console.log();
			console.log('  1. Navigate to the project directory:');
			console.log(chalk.cyan(`     cd ${projectPath}`));
			console.log();
			console.log('  2. Create a PRD and generate tasks:');
			console.log(
				chalk.cyan('     task-master parse-prd .taskmaster/docs/prd.txt')
			);
			console.log();
			console.log('  Or add tasks manually:');
			console.log(
				chalk.cyan('     task-master add-task --prompt="Your task description"')
			);
			console.log();
			console.log('Or omit the --project flag to use the current directory.');
			console.log();
			return;
		}
	} else {
		// Normal onboarding flow when --project is not used
		if (projectState.state === ProjectState.UNINITIALIZED) {
			printUninitializedMessage();
			return;
		}

		if (projectState.state === ProjectState.NO_TASKS) {
			printNoTasksMessage();
			return;
		}
	}

	process.stdout.write('\x1b[2J\x1b[0f');

	const { waitUntilExit } = render(
		<App {...props} projectPath={projectPath} />
	);
	await waitUntilExit();

	process.stdout.write('\x1b[2J\x1b[0f');
};
