/**
 * @fileoverview Onboarding Component
 * Guides new users through Task Master setup
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
	ProjectState,
	detectProjectState,
	type ProjectStateResult
} from '../utils/project-state.js';

export interface OnboardingProps {
	/**
	 * Project root path
	 */
	projectPath?: string;

	/**
	 * Callback when onboarding is complete
	 */
	onComplete?: () => void;

	/**
	 * Callback to skip onboarding
	 */
	onSkip?: () => void;
}

/**
 * Onboarding Component
 * Displays appropriate onboarding flow based on project state
 */
export const Onboarding: React.FC<OnboardingProps> = ({
	projectPath = process.cwd(),
	onComplete,
	onSkip: _onSkip
}) => {
	const [projectState, setProjectState] = useState<ProjectStateResult | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Detect project state
		const state = detectProjectState(projectPath);
		setProjectState(state);
		setIsLoading(false);

		// If project has tasks, complete onboarding immediately
		if (state.state === ProjectState.HAS_TASKS) {
			onComplete?.();
		}
	}, [projectPath, onComplete]);

	if (isLoading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text>Checking project status...</Text>
			</Box>
		);
	}

	if (!projectState) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Error: Unable to detect project state</Text>
			</Box>
		);
	}

	// Project is initialized and has tasks - proceed to main UI
	if (projectState.state === ProjectState.HAS_TASKS) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green">
					✓ Project initialized with {projectState.taskCount} tasks
				</Text>
				<Text dimColor>Loading dashboard...</Text>
			</Box>
		);
	}

	// Project is not initialized
	if (projectState.state === ProjectState.UNINITIALIZED) {
		return (
			<Box
				flexDirection="column"
				padding={1}
				borderStyle="round"
				borderColor="yellow"
			>
				<Box marginBottom={1}>
					<Text bold color="yellow">
						Welcome to Task Master Terminal UI!
					</Text>
				</Box>

				<Box marginBottom={1}>
					<Text>
						This project hasn't been initialized with Task Master yet.
					</Text>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text bold>To get started:</Text>
					<Text> 1. Initialize Task Master:</Text>
					<Text color="cyan"> task-master init</Text>
					<Text></Text>
					<Text> 2. Parse your PRD to generate tasks:</Text>
					<Text color="cyan">
						{' '}
						task-master parse-prd .taskmaster/docs/prd.txt
					</Text>
					<Text></Text>
					<Text> 3. Launch the Terminal UI:</Text>
					<Text color="cyan"> task-master interactive</Text>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						Press Ctrl+C to exit and run initialization commands
					</Text>
				</Box>
			</Box>
		);
	}

	// Project is initialized but has no tasks
	if (projectState.state === ProjectState.NO_TASKS) {
		return (
			<Box
				flexDirection="column"
				padding={1}
				borderStyle="round"
				borderColor="blue"
			>
				<Box marginBottom={1}>
					<Text bold color="blue">
						Task Master Initialized
					</Text>
				</Box>

				<Box marginBottom={1}>
					<Text>
						Your project is initialized, but no tasks have been created yet.
					</Text>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text bold>To create tasks:</Text>
					<Text></Text>
					<Text> 1. Create a PRD file in:</Text>
					<Text color="cyan"> .taskmaster/docs/prd.txt</Text>
					<Text></Text>
					<Text> 2. Generate tasks from PRD:</Text>
					<Text color="cyan">
						{' '}
						task-master parse-prd .taskmaster/docs/prd.txt
					</Text>
					<Text></Text>
					<Text> 3. Or manually add tasks:</Text>
					<Text color="cyan">
						{' '}
						task-master add-task --prompt="Your task description"
					</Text>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>Press Ctrl+C to exit and create tasks</Text>
				</Box>
			</Box>
		);
	}

	// Error state
	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="red"
		>
			<Box marginBottom={1}>
				<Text bold color="red">
					Error Detecting Project State
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>{projectState.error || 'Unknown error occurred'}</Text>
			</Box>

			<Box marginTop={1}>
				<Text dimColor>Press Ctrl+C to exit</Text>
			</Box>
		</Box>
	);
};

export default Onboarding;
