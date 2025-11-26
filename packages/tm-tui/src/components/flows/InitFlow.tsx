/**
 * @fileoverview Init flow component for Task Master TUI
 * Replicates the interactive init flow from scripts/init.js
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { WelcomeBanner, SuccessBanner } from '../primitives/Banner.js';
import { TMBox } from '../primitives/Box.js';
import { CardSelectInput, ConfirmInput, TextInput } from '../input/index.js';
import { LoadingIndicator, StepIndicator } from '../feedback/Spinner.js';
import { KeyValueTable } from '../data/Table.js';
import { colors } from '../../theme/colors.js';
import { logIcons } from '../../theme/icons.js';

export type StorageType = 'local' | 'cloud';

export interface InitFlowState {
	step: 'storage' | 'git' | 'gitTasks' | 'rules' | 'language' | 'confirm' | 'installing' | 'complete';
	storageType: StorageType;
	initGit: boolean;
	storeTasksInGit: boolean;
	setupRules: boolean;
	preferredLanguage: string;
}

export interface InitFlowProps {
	/** Callback when init is complete */
	onComplete?: (config: InitFlowState) => void;
	/** Skip prompts (use defaults) */
	skipPrompts?: boolean;
	/** Pre-set options */
	options?: Partial<InitFlowState>;
}

/**
 * Storage selection step
 */
function StorageStep({
	onSelect
}: {
	onSelect: (type: StorageType) => void;
}): React.ReactElement {
	const options = [
		{
			value: 'local' as StorageType,
			title: 'Solo (Taskmaster)',
			label: 'Solo (Taskmaster)',
			features: [
				'Parse your own PRDs into structured task lists and build with any IDE or background agents',
				'Agents execute tasks with precision, no scope creep, no going off-track',
				'Tasks live in a local JSON file, everything stays in your repo',
				'Upgrade to Hamster to bring the Taskmaster experience to your team'
			]
		},
		{
			value: 'cloud' as StorageType,
			title: 'Together (Hamster)',
			label: 'Together (Hamster)',
			features: [
				'Write a brief with your team. Hamster refines it into a plan.',
				'Your team drafts, refines, and aligns on the same page before executing',
				'One brief, one plan, one source of truth for execution',
				'Access tasks on Taskmaster and execute with any AI agent'
			]
		}
	];

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold color={colors.primary}>
					You need a plan before you execute.
				</Text>
				<Text> </Text>
				<Text>How do you want to build it?</Text>
			</Box>

			<CardSelectInput
				options={options}
				onSubmit={(value) => onSelect(value)}
				initialValue="local"
			/>

			<Box marginTop={1}>
				<Text dimColor>Use ↑↓ to navigate, Enter to select</Text>
			</Box>
		</Box>
	);
}

/**
 * Settings summary display
 */
function SettingsSummary({
	state,
	showGitSettings
}: {
	state: InitFlowState;
	showGitSettings: boolean;
}): React.ReactElement {
	const data = [
		{
			key: 'Storage',
			value: (
				<Text>
					{state.storageType === 'cloud' ? 'Hamster Studio' : 'Local File Storage'}
				</Text>
			)
		},
		{
			key: 'AI IDE rules',
			value: (
				<Box>
					<Text color={state.setupRules ? colors.success : colors.textDim}>
						{state.setupRules ? logIcons.success : logIcons.error}
					</Text>
					<Text> </Text>
					<Text dimColor>{state.setupRules ? 'Yes' : 'No'}</Text>
				</Box>
			)
		},
		{
			key: 'Response language',
			value: <Text>{state.preferredLanguage}</Text>
		}
	];

	if (showGitSettings) {
		data.push(
			{
				key: 'Initialize Git repository',
				value: (
					<Box>
						<Text color={state.initGit ? colors.success : colors.textDim}>
							{state.initGit ? logIcons.success : logIcons.error}
						</Text>
						<Text> </Text>
						<Text dimColor>{state.initGit ? 'Yes' : 'No'}</Text>
					</Box>
				)
			},
			{
				key: 'Store tasks in Git',
				value: (
					<Box>
						<Text color={state.storeTasksInGit ? colors.success : colors.textDim}>
							{state.storeTasksInGit ? logIcons.success : logIcons.error}
						</Text>
						<Text> </Text>
						<Text dimColor>{state.storeTasksInGit ? 'Yes' : 'No'}</Text>
					</Box>
				)
			}
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold>Taskmaster Project Settings:</Text>
			<Text dimColor>{'─'.repeat(50)}</Text>
			<KeyValueTable data={data} compact keyWidth={32} />
			<Text dimColor>{'─'.repeat(50)}</Text>
		</Box>
	);
}

/**
 * Workflow instructions (shown after init)
 */
function WorkflowInstructions({
	storageType
}: {
	storageType: StorageType;
}): React.ReactElement {
	if (storageType === 'cloud') {
		return (
			<TMBox variant="warning" title="Workflow" padding={1}>
				<Box flexDirection="column">
					<Text bold color={colors.primary}>
						Here's how to execute your Hamster briefs with Taskmaster
					</Text>
					<Text />
					<Text>
						<Text bold>1. </Text>
						<Text color={colors.warning}>Create your first brief at </Text>
						<Text color={colors.primary} underline>
							https://tryhamster.com
						</Text>
					</Text>
					<Text dimColor>   └─ Hamster will write your brief and generate the full task plan</Text>
					<Text />
					<Text>
						<Text bold>2. </Text>
						<Text color={colors.warning}>Connect this project to your brief</Text>
					</Text>
					<Text dimColor>
						{'   └─ CLI: '}
						<Text color={colors.primary}>tm context {'<brief-url>'}</Text>
					</Text>
					<Text />
					<Text>
						<Text bold>3. </Text>
						<Text color={colors.warning}>View your tasks from the brief</Text>
					</Text>
					<Text dimColor>
						{'   └─ CLI: '}
						<Text color={colors.primary}>tm list</Text>
						{' or '}
						<Text color={colors.primary}>tm list all</Text>
						{' (with subtasks)'}
					</Text>
					<Text />
					<Text>
						<Text bold>4. </Text>
						<Text color={colors.warning}>Work on tasks with any AI coding assistant</Text>
					</Text>
					<Text dimColor>
						{'   ├─ CLI: '}
						<Text color={colors.primary}>tm next</Text>
						{' - Find the next task to work on'}
					</Text>
					<Text dimColor>
						{'   ├─ CLI: '}
						<Text color={colors.primary}>{'tm show <id>'}</Text>
						{' - View task details'}
					</Text>
					<Text dimColor>
						{'   └─ CLI: '}
						<Text color={colors.primary}>{'tm status <id> done'}</Text>
						{' - Mark task complete'}
					</Text>
					<Text />
					<Text>
						<Text bold>5. </Text>
						<Text color={colors.success} bold>
							Ship it!
						</Text>
					</Text>
					<Text />
					<Text dimColor>
						* Run <Text color={colors.primary}>tm help</Text> to see all available commands
					</Text>
				</Box>
			</TMBox>
		);
	}

	return (
		<TMBox variant="warning" title="Workflow" padding={1}>
			<Box flexDirection="column">
				<Text bold color={colors.primary}>
					Things you should do next:
				</Text>
				<Text />
				<Text>
					<Text bold>1. </Text>
					<Text color={colors.warning}>Configure AI models and add API keys to `.env`</Text>
				</Text>
				<Text dimColor>
					{'   ├─ Models: Use '}
					<Text color={colors.primary}>task-master models</Text>
					{' commands'}
				</Text>
				<Text dimColor>   └─ Keys: Add provider API keys to .env (or .cursor/mcp.json)</Text>
				<Text />
				<Text>
					<Text bold>2. </Text>
					<Text color={colors.warning}>Discuss your idea with AI and create a PRD</Text>
				</Text>
				<Text dimColor>
					{'   ├─ Simple projects: Use '}
					<Text color={colors.primary}>example_prd.txt</Text>
					{' template'}
				</Text>
				<Text dimColor>
					{'   └─ Complex systems: Use '}
					<Text color={colors.primary}>example_prd_rpg.txt</Text>
					{' template'}
				</Text>
				<Text />
				<Text>
					<Text bold>3. </Text>
					<Text color={colors.warning}>Parse your PRD to generate initial tasks</Text>
				</Text>
				<Text dimColor>
					{'   └─ CLI: '}
					<Text color={colors.primary}>
						task-master parse-prd .taskmaster/docs/prd.txt
					</Text>
				</Text>
				<Text />
				<Text>
					<Text bold>4. </Text>
					<Text color={colors.warning}>Analyze task complexity</Text>
				</Text>
				<Text dimColor>
					{'   └─ CLI: '}
					<Text color={colors.primary}>task-master analyze-complexity --research</Text>
				</Text>
				<Text />
				<Text>
					<Text bold>5. </Text>
					<Text color={colors.warning}>Expand tasks into subtasks</Text>
				</Text>
				<Text dimColor>
					{'   └─ CLI: '}
					<Text color={colors.primary}>task-master expand --all --research</Text>
				</Text>
				<Text />
				<Text>
					<Text bold>6. </Text>
					<Text color={colors.warning}>Start working on tasks</Text>
				</Text>
				<Text dimColor>
					{'   └─ CLI: '}
					<Text color={colors.primary}>task-master next</Text>
				</Text>
				<Text />
				<Text>
					<Text bold>7. </Text>
					<Text color={colors.success} bold>
						Ship it!
					</Text>
				</Text>
				<Text />
				<Text dimColor>
					* Run <Text color={colors.primary}>task-master --help</Text> to see all available
					commands
				</Text>
			</Box>
		</TMBox>
	);
}

/**
 * Main Init Flow component
 */
export function InitFlow({
	onComplete,
	skipPrompts = false,
	options = {}
}: InitFlowProps): React.ReactElement {
	const { exit } = useApp();

	const [state, setState] = useState<InitFlowState>({
		step: 'storage',
		storageType: options.storageType ?? 'local',
		initGit: options.initGit ?? true,
		storeTasksInGit: options.storeTasksInGit ?? true,
		setupRules: options.setupRules ?? false,
		preferredLanguage: options.preferredLanguage ?? 'English'
	});

	const updateState = (updates: Partial<InitFlowState>) => {
		setState((prev) => ({ ...prev, ...updates }));
	};

	// Handle skip prompts mode
	useEffect(() => {
		if (skipPrompts) {
			updateState({ step: 'installing' });
		}
	}, [skipPrompts]);

	// Installation complete handler
	const handleInstallComplete = () => {
		updateState({ step: 'complete' });
		onComplete?.(state);
	};

	return (
		<Box flexDirection="column" padding={1}>
			{/* Banner */}
			{state.step !== 'complete' && <WelcomeBanner />}

			{/* Storage selection */}
			{state.step === 'storage' && (
				<Box marginTop={1}>
					<StorageStep
						onSelect={(type) => {
							updateState({
								storageType: type,
								step: type === 'cloud' ? 'rules' : 'git'
							});
						}}
					/>
				</Box>
			)}

			{/* Git init prompt (local only) */}
			{state.step === 'git' && (
				<Box marginTop={1}>
					<ConfirmInput
						question="Initialize a Git repository in project root?"
						defaultValue={true}
						onSubmit={(confirmed) => {
							updateState({ initGit: confirmed, step: 'gitTasks' });
						}}
					/>
				</Box>
			)}

			{/* Git tasks prompt (local only) */}
			{state.step === 'gitTasks' && (
				<Box marginTop={1}>
					<ConfirmInput
						question="Store tasks in Git (tasks.json and tasks/ directory)?"
						defaultValue={true}
						onSubmit={(confirmed) => {
							updateState({ storeTasksInGit: confirmed, step: 'rules' });
						}}
					/>
				</Box>
			)}

			{/* Rules setup prompt */}
			{state.step === 'rules' && (
				<Box marginTop={1}>
					<ConfirmInput
						question="Set up AI IDE rules for better integration? (Cursor, Windsurf, etc.)"
						defaultValue={false}
						onSubmit={(confirmed) => {
							updateState({ setupRules: confirmed, step: 'language' });
						}}
					/>
				</Box>
			)}

			{/* Language prompt */}
			{state.step === 'language' && (
				<Box marginTop={1}>
					<TextInput
						label="Preferred response language"
						defaultValue="English"
						placeholder="English"
						onSubmit={(value) => {
							updateState({ preferredLanguage: value || 'English', step: 'confirm' });
						}}
						showResult={false}
					/>
				</Box>
			)}

			{/* Confirmation */}
			{state.step === 'confirm' && (
				<Box flexDirection="column" marginTop={1}>
					<SettingsSummary
						state={state}
						showGitSettings={state.storageType === 'local'}
					/>
					<Box marginTop={1}>
						<ConfirmInput
							question="Do you want to continue with these settings?"
							defaultValue={true}
							onSubmit={(confirmed) => {
								if (confirmed) {
									updateState({ step: 'installing' });
								} else {
									exit();
								}
							}}
						/>
					</Box>
				</Box>
			)}

			{/* Installing */}
			{state.step === 'installing' && (
				<Box flexDirection="column" marginTop={1}>
					<StepIndicator
						steps={[
							{ label: 'Creating directory structure', status: 'complete' },
							{ label: 'Writing configuration files', status: 'complete' },
							{ label: 'Setting up templates', status: 'loading' },
							{ label: 'Finalizing...', status: 'pending' }
						]}
					/>
					<Box marginTop={1}>
						<LoadingIndicator message="Installing Taskmaster..." status="loading" />
					</Box>
				</Box>
			)}

			{/* Complete */}
			{state.step === 'complete' && (
				<Box flexDirection="column">
					{state.storageType === 'cloud' ? (
						<TMBox variant="success" padding={1}>
							<Box flexDirection="column" alignItems="center">
								<Text color={colors.success} bold>
									✓ Connected to Hamster Studio
								</Text>
								<Text />
								<Text>Your team's workspace is ready to go ham!</Text>
								<Text dimColor>Draft together. Align once. Build with agents.</Text>
							</Box>
						</TMBox>
					) : (
						<SuccessBanner message="Project initialized successfully!" />
					)}
					<Box marginTop={1}>
						<WorkflowInstructions storageType={state.storageType} />
					</Box>
				</Box>
			)}
		</Box>
	);
}

