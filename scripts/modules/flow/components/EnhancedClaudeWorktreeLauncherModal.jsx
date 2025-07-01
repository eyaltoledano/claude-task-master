import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';
import { personaDefinitions } from '../personas/persona-definitions.js';
import { BackgroundClaudeCode } from '../services/BackgroundClaudeCode.js';
import { HookIntegrationService } from '../services/HookIntegrationService.js';

// Persona icons for visual identification
const personaIcons = {
	architect: '🏛️',
	frontend: '🎨',
	backend: '⚙️',
	analyzer: '🔍',
	security: '🔒',
	mentor: '📚',
	refactorer: '♻️',
	performance: '⚡',
	qa: '✅'
};

export function EnhancedClaudeWorktreeLauncherModal({
	backend,
	worktree,
	tasks,
	onClose,
	onSuccess
}) {
	const { theme } = useComponentTheme('modal');

	// Always select the task automatically for single task scenarios
	const [selectedTasks] = useState(() => {
		return tasks.map((t) => t.id);
	});

	// Core state
	const [view, setView] = useState('persona'); // persona, tools, prompt, research, review, processing, summary
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [processingLog, setProcessingLog] = useState('');

	// Persona selection
	const [detectedPersonas, setDetectedPersonas] = useState([]);
	const [selectedPersona, setSelectedPersona] = useState(null);
	const [personaSelectionIndex, setPersonaSelectionIndex] = useState(0);
	const [isDetectingPersonas, setIsDetectingPersonas] = useState(false);

	// Tool restrictions
	const [toolRestrictions, setToolRestrictions] = useState({
		allowShellCommands: true,
		allowFileOperations: true,
		allowWebSearch: true
	});
	const [maxTurns, setMaxTurns] = useState(15);

	// Custom prompt
	const [customPrompt, setCustomPrompt] = useState('');
	const [useCustomPrompt, setUseCustomPrompt] = useState(false);

	// Research state
	const [researchStatus, setResearchStatus] = useState(null);
	const [shouldRunResearch, setShouldRunResearch] = useState(false);
	const [isRunningResearch, setIsRunningResearch] = useState(false);
	const [researchResults, setResearchResults] = useState(null);

	// Final configuration for review
	const [finalConfig, setFinalConfig] = useState(null);
	const [sessionResult, setSessionResult] = useState(null);

	// Hook integration service
	const [hookService] = useState(() => new HookIntegrationService(backend));

	// Initialize hook service
	useEffect(() => {
		hookService.initialize();
	}, [hookService]);

	// Detect personas when we switch to persona view
	const detectPersonasForSelectedTasks = useCallback(async () => {
		setIsDetectingPersonas(true);
		try {
			const selected = tasks.filter((t) => selectedTasks.includes(t.id));
			const result = await backend.detectPersonasForTasks(selected, worktree);

			// Aggregate personas across all tasks
			const personaScores = {};
			result.taskPersonas.forEach((tp) => {
				tp.suggestedPersonas.forEach((sp) => {
					if (!personaScores[sp.persona]) {
						personaScores[sp.persona] = {
							persona: sp.persona,
							totalScore: 0,
							totalConfidence: 0,
							count: 0,
							reasons: new Set()
						};
					}
					personaScores[sp.persona].totalScore += sp.score;
					personaScores[sp.persona].totalConfidence += sp.confidence;
					personaScores[sp.persona].count += 1;
					sp.reasons.forEach((r) => personaScores[sp.persona].reasons.add(r));
				});
			});

			// Calculate average confidence and sort
			const aggregated = Object.values(personaScores)
				.map((ps) => ({
					persona: ps.persona,
					confidence: Math.round(ps.totalConfidence / ps.count),
					reasons: Array.from(ps.reasons)
				}))
				.sort((a, b) => b.confidence - a.confidence);

			setDetectedPersonas(aggregated);
			if (aggregated.length > 0) {
				setSelectedPersona(aggregated[0].persona);
			}
		} catch (err) {
			console.error('Error detecting personas:', err);
		} finally {
			setIsDetectingPersonas(false);
		}
	}, [selectedTasks, tasks, backend, worktree]);

	// Check research needs when we get to the research view
	const checkResearchNeeds = useCallback(async () => {
		if (!tasks[0]) return;

		try {
			setProcessingLog('Analyzing task for research needs...');

			// Use hook to check research needs
			const researchCheck = await hookService.checkResearchNeeded(tasks[0]);

			if (researchCheck && researchCheck.researchStatus) {
				setResearchStatus(researchCheck.researchStatus);

				// If research is needed and not already present, suggest running it
				if (
					researchCheck.researchStatus.needed &&
					!researchCheck.researchStatus.hasExisting
				) {
					setShouldRunResearch(true);
				}
			} else {
				// Fallback to basic analysis if hooks aren't available
				setResearchStatus({
					needed: false,
					reason: 'no-analysis',
					confidence: 0,
					message: 'Research analysis not available'
				});
			}
		} catch (error) {
			console.error('Error checking research needs:', error);
			setResearchStatus({
				needed: false,
				reason: 'error',
				error: error.message,
				confidence: 0
			});
		}
	}, [tasks, hookService]);

	// Run research
	const runResearch = useCallback(async () => {
		if (!tasks[0] || !researchStatus) return;

		setIsRunningResearch(true);
		setProcessingLog('Running research...');

		try {
			// Generate research query based on task
			const task = tasks[0];
			const query = `Best practices for implementing: ${task.title}. ${task.description || ''}`;

			// Run research using backend
			const results = await backend.research(query, {
				taskIds: [task.id],
				saveToFile: false,
				detailLevel: 'medium'
			});

			setResearchResults(results);

			// Notify hooks that research completed
			await hookService.notifyResearchCompleted(task, results);

			setProcessingLog('Research completed successfully');
		} catch (error) {
			console.error('Error running research:', error);
			setProcessingLog(`Research failed: ${error.message}`);
		} finally {
			setIsRunningResearch(false);
		}
	}, [tasks, researchStatus, backend, hookService]);

	// Auto-detect personas when we switch to persona view
	useEffect(() => {
		if (
			view === 'persona' &&
			selectedTasks.length > 0 &&
			!isDetectingPersonas &&
			detectedPersonas.length === 0
		) {
			detectPersonasForSelectedTasks();
		}
	}, [
		view,
		selectedTasks.length,
		isDetectingPersonas,
		detectedPersonas.length,
		detectPersonasForSelectedTasks
	]);

	// Auto-check research when we get to research view
	useEffect(() => {
		if (view === 'research' && !researchStatus) {
			checkResearchNeeds();
		}
	}, [view, researchStatus, checkResearchNeeds]);

	// Dynamic modal props based on current view
	const getModalProps = () => {
		const baseProps = {
			width: 100,
			height: 'auto',
			onClose
		};

		switch (view) {
			case 'persona':
				return {
					...baseProps,
					title: '🚀 Claude Code: Select Persona',
					preset: 'info',
					keyboardHints: isDetectingPersonas
						? ['ESC cancel']
						: ['↑↓ navigate', 'ENTER next', '1-9 quick select', 'ESC cancel']
				};
			case 'tools':
				return {
					...baseProps,
					title: '🚀 Claude Code: Configure Tools',
					preset: 'default',
					keyboardHints: [
						'1-3 toggle',
						'+/- turns',
						'ENTER next',
						'BACKSPACE back',
						'ESC cancel'
					]
				};
			case 'prompt':
				return {
					...baseProps,
					title: '🚀 Claude Code: Custom Instructions',
					preset: 'default',
					keyboardHints: ['ENTER next', 'BACKSPACE back', 'ESC cancel']
				};
			case 'research':
				return {
					...baseProps,
					title: '🚀 Claude Code: Research Analysis',
					preset: 'info',
					keyboardHints: isRunningResearch
						? ['ESC cancel']
						: ['y run research', 'n skip', 'BACKSPACE back', 'ESC cancel']
				};
			case 'review':
				return {
					...baseProps,
					title: '🚀 Claude Code: Final Review',
					preset: 'default',
					keyboardHints: ['ENTER launch', 'BACKSPACE back', 'ESC cancel']
				};
			case 'processing':
				return {
					...baseProps,
					title: '🚀 Claude Code: Processing',
					preset: 'default',
					keyboardHints: ['ESC cancel']
				};
			case 'summary':
				return {
					...baseProps,
					title: '🚀 Claude Code: Complete',
					preset: 'success',
					keyboardHints: ['ENTER done', 'ESC cancel']
				};
			default:
				return baseProps;
		}
	};

	// Key handlers for navigation
	const keyHandlers = {
		escape: onClose,

		upArrow: () => {
			if (view === 'persona') {
				setPersonaSelectionIndex(Math.max(0, personaSelectionIndex - 1));
			}
		},

		downArrow: () => {
			if (view === 'persona') {
				setPersonaSelectionIndex(
					Math.min(detectedPersonas.length - 1, personaSelectionIndex + 1)
				);
			}
		},

		return: () => {
			if (view === 'persona') {
				setSelectedPersona(
					detectedPersonas[personaSelectionIndex]?.persona || 'architect'
				);
				setView('tools');
			} else if (view === 'tools') {
				setView('prompt');
			} else if (view === 'prompt') {
				setView('research');
			} else if (view === 'research') {
				// Skip to review if no research needed or already done
				if (!researchStatus?.needed || researchResults || !shouldRunResearch) {
					prepareReview();
				}
			} else if (view === 'review') {
				handleLaunch();
			} else if (view === 'summary') {
				handleComplete();
			}
		},

		backspace: () => {
			if (view === 'tools') {
				setView('persona');
			} else if (view === 'prompt') {
				setView('tools');
			} else if (view === 'research') {
				setView('prompt');
			} else if (view === 'review') {
				setView('research');
			}
		},

		// Research view specific
		y: () => {
			if (
				view === 'research' &&
				!isRunningResearch &&
				researchStatus?.needed &&
				!researchResults
			) {
				runResearch();
			}
		},

		n: () => {
			if (view === 'research' && !isRunningResearch) {
				setShouldRunResearch(false);
				prepareReview();
			}
		},

		// Number keys for various views
		1: () => handleNumberKey('1'),
		2: () => handleNumberKey('2'),
		3: () => handleNumberKey('3'),
		4: () => handleNumberKey('4'),
		5: () => handleNumberKey('5'),
		6: () => handleNumberKey('6'),
		7: () => handleNumberKey('7'),
		8: () => handleNumberKey('8'),
		9: () => handleNumberKey('9'),

		// Tool configuration
		'+': () => {
			if (view === 'tools') {
				setMaxTurns((prev) => Math.min(30, prev + 5));
			}
		},

		'-': () => {
			if (view === 'tools') {
				setMaxTurns((prev) => Math.max(5, prev - 5));
			}
		}
	};

	const handleNumberKey = (number) => {
		if (view === 'persona') {
			const index = parseInt(number) - 1;
			const personaIds = Object.keys(personaDefinitions);
			if (index < personaIds.length) {
				setSelectedPersona(personaIds[index]);
				setView('tools');
			}
		} else if (view === 'tools') {
			if (number === '1') {
				setToolRestrictions((prev) => ({
					...prev,
					allowShellCommands: !prev.allowShellCommands
				}));
			} else if (number === '2') {
				setToolRestrictions((prev) => ({
					...prev,
					allowFileOperations: !prev.allowFileOperations
				}));
			} else if (number === '3') {
				setToolRestrictions((prev) => ({
					...prev,
					allowWebSearch: !prev.allowWebSearch
				}));
			}
		}
	};

	useKeypress(keyHandlers);

	// Prepare final configuration for review
	const prepareReview = useCallback(() => {
		const config = {
			persona: selectedPersona,
			toolRestrictions,
			maxTurns,
			customPrompt: useCustomPrompt ? customPrompt : null,
			researchStatus,
			researchResults,
			shouldRunResearch,
			tasks: tasks[0],
			worktree
		};

		setFinalConfig(config);
		setView('review');
	}, [
		selectedPersona,
		toolRestrictions,
		maxTurns,
		useCustomPrompt,
		customPrompt,
		researchStatus,
		researchResults,
		shouldRunResearch,
		tasks,
		worktree
	]);

	// Main launch handler
	const handleLaunch = async () => {
		setView('processing');
		setIsProcessing(true);
		setProcessingLog('Initializing Claude Code session...');

		try {
			// Execute pre-launch hooks
			await hookService.validatePreLaunch(finalConfig, tasks[0], worktree);

			// Handle worktree creation if needed
			let actualWorktree = worktree;
			if (!actualWorktree && tasks.length > 0) {
				setProcessingLog('Creating worktree...');
				actualWorktree = await createWorktreeForTask(tasks[0]);

				// Notify hooks about worktree creation
				await hookService.notifyWorktreeCreated(
					actualWorktree,
					tasks[0],
					finalConfig
				);
			}

			// Run research if needed and not already done
			if (shouldRunResearch && !researchResults && researchStatus?.needed) {
				setProcessingLog('Running research...');
				await runResearch();
			}

			// Create CLAUDE.md
			setProcessingLog('Preparing CLAUDE.md...');
			const claudeMdPath = await prepareClaudeMarkdown(
				actualWorktree,
				tasks[0]
			);

			// Notify hooks about CLAUDE.md preparation
			await hookService.notifyClaudeMdPrepared(
				actualWorktree,
				tasks[0],
				claudeMdPath
			);

			// Start Claude Code session
			setProcessingLog('Starting Claude Code session...');
			const session = await startClaudeSession(actualWorktree, tasks[0]);

			// Notify hooks about session start
			await hookService.notifySessionStarted(
				session,
				finalConfig,
				tasks[0],
				actualWorktree
			);

			setSessionResult(session);
			setView('summary');
		} catch (error) {
			console.error('Launch failed:', error);
			setError(`Launch failed: ${error.message}`);
			setView('review');
		} finally {
			setIsProcessing(false);
		}
	};

	// Helper functions
	const createWorktreeForTask = async (task) => {
		const isSubtask = task.isSubtask || String(task.id).includes('.');

		try {
			let sourceBranch = 'main';
			try {
				const { execSync } = await import('child_process');
				sourceBranch = execSync('git rev-parse --abbrev-ref HEAD', {
					cwd: backend.projectRoot,
					encoding: 'utf8'
				}).trim();
			} catch (error) {
				sourceBranch = 'master';
			}

			let result;
			if (isSubtask) {
				const [parentId, subtaskId] = task.id.split('.');
				result = await backend.getOrCreateWorktreeForSubtask(
					parseInt(parentId),
					parseInt(subtaskId),
					{ sourceBranch, subtaskTitle: task.title }
				);
			} else {
				result = await backend.getOrCreateWorktreeForTask(task.id, {
					sourceBranch,
					taskTitle: task.title
				});
			}

			if (result.needsUserDecision) {
				throw new Error('Branch conflict - please resolve in Tasks screen');
			}

			return result.worktree;
		} catch (error) {
			throw new Error(`Failed to create worktree: ${error.message}`);
		}
	};

	const prepareClaudeMarkdown = async (worktree, task) => {
		// This would create the CLAUDE.md file with task context
		// Implementation would go here
		return `${worktree.path}/CLAUDE.md`;
	};

	const startClaudeSession = async (worktree, task) => {
		const backgroundClaudeCode = new BackgroundClaudeCode(backend);

		const prompt =
			finalConfig.customPrompt ||
			'Implement the assigned tasks according to the specifications in CLAUDE.md';

		const operation = await backgroundClaudeCode.startQuery(prompt, {
			persona: finalConfig.persona,
			metadata: {
				type: task.isSubtask ? 'subtask-implementation' : 'task-implementation',
				taskId: task.id,
				worktreePath: worktree.path,
				worktreeName: worktree.name,
				branch: worktree.branch || worktree.name,
				maxTurns: finalConfig.maxTurns,
				allowedTools: buildAllowedTools(),
				prompt
			}
		});

		return {
			operationId: operation.operationId,
			sessionId: operation.operationId,
			worktree,
			message: 'Claude Code session started successfully!'
		};
	};

	const buildAllowedTools = () => {
		if (
			toolRestrictions.allowShellCommands &&
			toolRestrictions.allowFileOperations &&
			toolRestrictions.allowWebSearch
		) {
			return null; // All tools allowed
		}

		const allowedTools = ['read_file', 'list_directory', 'search_files'];

		if (toolRestrictions.allowFileOperations) {
			allowedTools.push('create_file', 'edit_file', 'delete_file', 'move_file');
		}

		if (toolRestrictions.allowShellCommands) {
			allowedTools.push('execute_command', 'run_script');
		}

		if (toolRestrictions.allowWebSearch) {
			allowedTools.push('web_search', 'fetch_url');
		}

		return allowedTools;
	};

	const handleComplete = async () => {
		// Auto-create PR based on global setting
		// This would check a global configuration for PR creation
		onSuccess(sessionResult);
	};

	// Render functions for each view
	const renderPersonaSelection = () => (
		<Box flexDirection="column">
			{isDetectingPersonas ? (
				<Box marginTop={1}>
					<LoadingSpinner />
					<Text> Analyzing tasks...</Text>
				</Box>
			) : (
				<>
					{detectedPersonas.length > 0 && (
						<Box marginTop={1} flexDirection="column">
							<Text color={theme.secondary}>
								Detected Personas (by confidence):
							</Text>
							{detectedPersonas.map((dp, idx) => {
								const persona = personaDefinitions[dp.persona];
								const isSelected = idx === personaSelectionIndex;
								return (
									<Box key={dp.persona} marginTop={1}>
										<Text color={isSelected ? theme.primary : theme.text}>
											{isSelected ? '▶ ' : '  '}
											{personaIcons[dp.persona]}{' '}
											{persona.identity.split('|')[0]} ({dp.confidence}%)
										</Text>
										{isSelected && dp.reasons.length > 0 && (
											<Box marginLeft={4}>
												<Text dimColor fontSize={12}>
													{dp.reasons[0]}
												</Text>
											</Box>
										)}
									</Box>
								);
							})}
						</Box>
					)}
				</>
			)}
		</Box>
	);

	const renderToolConfiguration = () => (
		<Box flexDirection="column">
			<Text color={theme.secondary}>
				Selected Persona: {personaIcons[selectedPersona]}{' '}
				{personaDefinitions[selectedPersona]?.identity.split('|')[0]}
			</Text>

			<Box marginTop={2} flexDirection="column">
				<Text bold>Tool Restrictions:</Text>
				<Box marginTop={1}>
					<Text color={toolRestrictions.allowShellCommands ? 'green' : 'red'}>
						1. Shell Commands:{' '}
						{toolRestrictions.allowShellCommands ? '✓ Allowed' : '✗ Restricted'}
					</Text>
				</Box>
				<Box>
					<Text color={toolRestrictions.allowFileOperations ? 'green' : 'red'}>
						2. File Operations:{' '}
						{toolRestrictions.allowFileOperations
							? '✓ Allowed'
							: '✗ Restricted'}
					</Text>
				</Box>
				<Box>
					<Text color={toolRestrictions.allowWebSearch ? 'green' : 'red'}>
						3. Web Search:{' '}
						{toolRestrictions.allowWebSearch ? '✓ Allowed' : '✗ Restricted'}
					</Text>
				</Box>
			</Box>

			<Box marginTop={2}>
				<Text bold>Max Turns: </Text>
				<Text color={theme.primary}>{maxTurns}</Text>
				<Text dimColor> (use +/- to adjust)</Text>
			</Box>
		</Box>
	);

	const renderCustomPrompt = () => (
		<Box flexDirection="column">
			<Text color={theme.secondary}>Enter custom instructions (optional):</Text>
			<Box marginTop={1}>
				<TextInput
					value={customPrompt}
					onChange={(value) => {
						setCustomPrompt(value);
						setUseCustomPrompt(value.length > 0);
					}}
					placeholder="Additional instructions for task implementation..."
				/>
			</Box>
			{customPrompt.length > 0 && (
				<Box marginTop={1}>
					<Text dimColor>Custom prompt will be used</Text>
				</Box>
			)}
		</Box>
	);

	const renderResearchAnalysis = () => (
		<Box flexDirection="column">
			<Text color={theme.secondary}>Task: {tasks[0]?.title}</Text>

			{processingLog && (
				<Box marginTop={1}>
					<LoadingSpinner />
					<Text> {processingLog}</Text>
				</Box>
			)}

			{researchStatus && !isRunningResearch && (
				<Box marginTop={2} flexDirection="column">
					<Text bold>Research Analysis:</Text>
					<Text color={researchStatus.needed ? 'yellow' : 'green'}>
						{researchStatus.message}
					</Text>

					{researchStatus.needed && !researchStatus.hasExisting && (
						<Box marginTop={1}>
							<Text>
								Confidence: {researchStatus.confidence}% | Keywords:{' '}
								{researchStatus.keywords?.join(', ') || 'None'}
							</Text>
							{!researchResults && (
								<Box marginTop={1}>
									<Text color="yellow">
										Press 'y' to run research or 'n' to skip
									</Text>
								</Box>
							)}
						</Box>
					)}

					{researchResults && (
						<Box marginTop={1}>
							<Text color="green">
								✓ Research completed and will be included
							</Text>
						</Box>
					)}
				</Box>
			)}
		</Box>
	);

	const renderFinalReview = () => (
		<Box flexDirection="column">
			<Text bold color={theme.primary}>
				Configuration Review:
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Text>📋 Task: {finalConfig?.tasks?.title}</Text>
				<Text>
					🎭 Persona: {personaIcons[finalConfig?.persona]}{' '}
					{personaDefinitions[finalConfig?.persona]?.identity.split('|')[0]}
				</Text>
				<Text>🔧 Max Turns: {finalConfig?.maxTurns}</Text>
				<Text>
					🛠️ Tools:{' '}
					{finalConfig?.toolRestrictions?.allowShellCommands &&
					finalConfig?.toolRestrictions?.allowFileOperations &&
					finalConfig?.toolRestrictions?.allowWebSearch
						? 'All allowed'
						: 'Some restricted'}
				</Text>
				{finalConfig?.customPrompt && <Text>💬 Custom Prompt: Yes</Text>}
				<Text>
					🔍 Research:{' '}
					{finalConfig?.researchResults
						? 'Completed'
						: finalConfig?.shouldRunResearch
							? 'Will run'
							: 'Skipped'}
				</Text>
			</Box>

			{finalConfig?.worktree && (
				<Box marginTop={2} flexDirection="column">
					<Text bold>Worktree:</Text>
					<Text>📁 {finalConfig.worktree.name}</Text>
					<Text dimColor>Branch: {finalConfig.worktree.branch}</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text color="green">Press ENTER to launch Claude Code session</Text>
			</Box>
		</Box>
	);

	const renderProcessing = () => (
		<Box flexDirection="column">
			<Box marginTop={1}>
				<LoadingSpinner />
				<Text> {processingLog}</Text>
			</Box>
		</Box>
	);

	const renderSummary = () => (
		<Box flexDirection="column">
			<Text color="green">✅ Claude Code session started successfully!</Text>

			{sessionResult && (
				<Box marginTop={2} flexDirection="column">
					<Text>
						Operation ID: {sessionResult.operationId?.substring(0, 8)}...
					</Text>
					<Text>{sessionResult.message}</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text dimColor>
					Monitor progress in the Background Operations screen
				</Text>
			</Box>
		</Box>
	);

	// Main render
	const renderContent = () => {
		if (error) {
			return (
				<Box flexDirection="column">
					<Text color="red">❌ {error}</Text>
				</Box>
			);
		}

		switch (view) {
			case 'persona':
				return renderPersonaSelection();
			case 'tools':
				return renderToolConfiguration();
			case 'prompt':
				return renderCustomPrompt();
			case 'research':
				return renderResearchAnalysis();
			case 'review':
				return renderFinalReview();
			case 'processing':
				return renderProcessing();
			case 'summary':
				return renderSummary();
			default:
				return <Text>Unknown view: {view}</Text>;
		}
	};

	return <BaseModal {...getModalProps()}>{renderContent()}</BaseModal>;
}
