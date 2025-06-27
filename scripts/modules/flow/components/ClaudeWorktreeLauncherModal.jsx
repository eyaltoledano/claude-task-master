import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { getTheme } from '../theme.js';
import { personaDefinitions } from '../personas/persona-definitions.js';

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

export function ClaudeWorktreeLauncherModal({
	backend,
	worktree,
	tasks,
	onClose,
	onSuccess
}) {
	const theme = getTheme();
	// Initialize selectedTasks based on task count
	const [selectedTasks, setSelectedTasks] = useState(() => {
		// Pre-select the first task if only one is linked
		if (tasks.length === 1) {
			return [tasks[0].id];
		}
		return [];
	});
	const [launchMode, setLaunchMode] = useState('interactive'); // interactive, headless, batch
	const [headlessPrompt, setHeadlessPrompt] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [view, setView] = useState('mode'); // mode, persona, prompt, processing
	const [detectedPersonas, setDetectedPersonas] = useState([]);
	const [selectedPersona, setSelectedPersona] = useState(null);
	const [personaSelectionIndex, setPersonaSelectionIndex] = useState(0);
	const [isDetectingPersonas, setIsDetectingPersonas] = useState(false);
	const [selectedModeIndex, setSelectedModeIndex] = useState(0); // Track selected mode in UI - starts at 0 for interactive
	const [processingLog, setProcessingLog] = useState('');
	const [suggestedWorkflow, setSuggestedWorkflow] = useState(null);

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

			// Check for multi-persona workflow
			if (result.multiPersonaWorkflow) {
				// Store for later use
				setDetectedPersonas((prev) => {
					const newPersonas = [...prev];
					newPersonas._multiWorkflow = result.multiPersonaWorkflow;
					return newPersonas;
				});
			}
		} catch (err) {
			console.error('Error detecting personas:', err);
		} finally {
			setIsDetectingPersonas(false);
		}
	}, [selectedTasks, tasks, backend, worktree]);

	// Detect personas when we switch to persona view
	useEffect(() => {
		if (
			view === 'persona' &&
			selectedTasks.length > 0 &&
			!isDetectingPersonas &&
			detectedPersonas.length === 0
		) {
			detectPersonasForSelectedTasks();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view, selectedTasks.length]);

	useInput((input, key) => {
		if (key.escape) {
			onClose();
			return;
		}

		if (view === 'mode') {
			const modeCount = tasks.length > 1 ? 3 : 2;

			if (key.upArrow) {
				setSelectedModeIndex(Math.max(0, selectedModeIndex - 1));
			} else if (key.downArrow) {
				setSelectedModeIndex(Math.min(modeCount - 1, selectedModeIndex + 1));
			} else if (key.return) {
				const modes = ['interactive', 'headless'];
				if (tasks.length > 1) modes.push('batch');

				setLaunchMode(modes[selectedModeIndex]);
				if (modes[selectedModeIndex] === 'batch') {
					setSelectedTasks(tasks.map((t) => t.id));
				}
				setView('persona');
			} else if (input === '1') {
				setLaunchMode('interactive');
				setSelectedModeIndex(0);
				setView('persona');
			} else if (input === '2') {
				setLaunchMode('headless');
				setSelectedModeIndex(1);
				setView('persona');
			} else if (input === '3' && tasks.length > 1) {
				setLaunchMode('batch');
				setSelectedModeIndex(2);
				setSelectedTasks(tasks.map((t) => t.id));
				setView('persona');
			}
		} else if (view === 'persona') {
			if (key.upArrow) {
				setPersonaSelectionIndex(Math.max(0, personaSelectionIndex - 1));
			} else if (key.downArrow) {
				setPersonaSelectionIndex(
					Math.min(detectedPersonas.length - 1, personaSelectionIndex + 1)
				);
			} else if (key.return) {
				setSelectedPersona(
					detectedPersonas[personaSelectionIndex]?.persona || 'architect'
				);
				if (launchMode === 'headless') {
					setView('prompt');
				} else {
					handleLaunch();
				}
			} else if (key.tab && detectedPersonas.length > 1) {
				// Cycle through detected personas
				const nextIndex = (personaSelectionIndex + 1) % detectedPersonas.length;
				setPersonaSelectionIndex(nextIndex);
			} else if (input >= '1' && input <= '9') {
				// Quick select by number
				const index = parseInt(input) - 1;
				const personaIds = Object.keys(personaDefinitions);
				if (index < personaIds.length) {
					setSelectedPersona(personaIds[index]);
					if (launchMode === 'headless') {
						setView('prompt');
					} else {
						handleLaunch();
					}
				}
			} else if (input === 'p') {
				// Manual persona selection
				setView('manual-persona');
			} else if (input === 'n') {
				// No persona
				setSelectedPersona(null);
				if (launchMode === 'headless') {
					setView('prompt');
				} else {
					handleLaunch();
				}
			}
		}
	});

	const handleLaunch = async () => {
		setIsProcessing(true);
		setView('processing');
		setError(null);

		try {
			const selectedTaskObjects = tasks.filter((t) =>
				selectedTasks.includes(t.id)
			);

			if (launchMode === 'interactive') {
				// For interactive mode, we need to exit Flow first
				// Return launch instructions instead of launching directly
				const contextInfo = await backend.prepareClaudeContext(
					worktree,
					selectedTaskObjects,
					{
						persona: selectedPersona,
						includeStructure: true,
						mode: 'interactive'
					}
				);

				onSuccess({
					mode: 'interactive',
					worktree: worktree.name,
					worktreePath: worktree.path,
					tasks: selectedTasks,
					persona: selectedPersona,
					contextInfo,
					shouldExitFlow: true // Signal to exit Flow before launching
				});
			} else if (launchMode === 'headless') {
				// Headless mode - run Claude with prompts in background
				const result = await backend.launchClaudeHeadless(
					worktree,
					selectedTaskObjects,
					headlessPrompt,
					{
						persona: selectedPersona,
						maxTurns: 10,
						permissionMode: 'acceptEdits',
						captureOutput: true,
						outputFormat: 'stream-json',
						onProgress: (output) => {
							// Update processing log with streaming output
							setProcessingLog((prev) => prev + output);
						}
					}
				);

				if (result.success) {
					// Format success result with SDK data
					onSuccess({
						mode: 'headless',
						worktree: worktree.name,
						worktreePath: worktree.path,
						tasks: selectedTaskObjects.map((t) => t.id),
						persona: result.persona,
						output: result.output,
						sessionId: result.sessionId,
						totalCost: result.totalCost,
						duration: result.duration,
						message: `Processed ${result.tasksProcessed} task(s) in ${worktree.name}`
					});
				} else {
					throw new Error(result.error || 'Claude headless execution failed');
				}
			} else if (launchMode === 'batch') {
				// Check if multi-persona workflow was detected
				if (detectedPersonas._multiWorkflow) {
					const workflow = detectedPersonas._multiWorkflow;
					const groups = workflow.personas.map((persona) => ({
						tasks: selectedTaskObjects,
						persona,
						prompt: `Complete these tasks with ${persona} approach`
					}));

					const result = await backend.launchMultipleClaudeSessions(
						worktree,
						groups,
						{ captureOutput: true }
					);

					if (result.success) {
						onSuccess({
							mode: 'batch-multi-persona',
							worktree: worktree.name,
							workflow: workflow.workflow,
							sessions: result.sessions
						});
					}
				} else {
					// Single persona batch
					const result = await backend.launchClaudeHeadless(
						worktree,
						selectedTaskObjects,
						'Process all tasks systematically',
						{
							persona: selectedPersona,
							maxTurns: 15,
							permissionMode: 'acceptEdits'
						}
					);

					if (result.success) {
						onSuccess({
							mode: 'batch',
							worktree: worktree.name,
							tasks: selectedTasks,
							persona: selectedPersona
						});
					}
				}
			}
		} catch (err) {
			setError(err.message);
			setView('mode');
		} finally {
			setIsProcessing(false);
		}
	};

	// Render functions for different views
	const renderModeSelection = () => {
		const modes = [
			{
				id: 'interactive',
				label: 'Interactive - Open Claude in terminal for manual interaction'
			},
			{
				id: 'headless',
				label: 'Headless - Run with specific prompt (no interaction)'
			}
		];

		if (tasks.length > 1) {
			modes.push({
				id: 'batch',
				label: 'Batch - Process all tasks automatically'
			});
		}

		return (
			<Box flexDirection="column">
				<Text bold color={theme.primary}>
					Select Launch Mode
				</Text>
				<Box marginTop={1} flexDirection="column">
					{modes.map((mode, index) => (
						<Text
							key={mode.id}
							color={selectedModeIndex === index ? theme.success : theme.text}
						>
							{selectedModeIndex === index ? '▶ ' : '  '}[{index + 1}]{' '}
							{mode.label}
						</Text>
					))}
				</Box>
				<Box marginTop={2}>
					<Text dimColor>
						Press number to select, ↑↓ to navigate, [Esc] to cancel
					</Text>
				</Box>
			</Box>
		);
	};

	const renderPersonaSelection = () => (
		<Box flexDirection="column">
			<Text bold color={theme.primary}>
				Select Persona
			</Text>

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

					<Box marginTop={2} flexDirection="column">
						<Text dimColor>
							[↑↓] Navigate [Enter] Accept [Tab] Next suggestion
						</Text>
						<Text dimColor>
							[1-9] Quick select [p] Choose manually [n] No persona
						</Text>
					</Box>
				</>
			)}
		</Box>
	);

	const renderPromptInput = () => (
		<Box flexDirection="column">
			<Text bold color={theme.primary}>
				Enter Instructions for Claude
			</Text>
			<Text color={theme.secondary}>
				Persona: {personaIcons[selectedPersona]}{' '}
				{personaDefinitions[selectedPersona]?.identity.split('|')[0] || 'None'}
			</Text>
			<Box marginTop={1}>
				<TextInput
					value={headlessPrompt}
					onChange={setHeadlessPrompt}
					placeholder="Additional instructions for task implementation..."
					onSubmit={() => handleLaunch()}
				/>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>[Enter] to launch, [Esc] to cancel</Text>
			</Box>
		</Box>
	);

	const renderProcessing = () => (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="green">
					Processing with Claude Code...
				</Text>
			</Box>
			<Box marginBottom={1}>
				<LoadingSpinner />
				<Text>
					{' '}
					{launchMode === 'batch'
						? 'Processing multiple tasks...'
						: 'Processing task...'}
				</Text>
			</Box>
			{processingLog && (
				<Box
					flexDirection="column"
					borderStyle="single"
					paddingX={1}
					marginBottom={1}
					height={10}
				>
					<Text dimColor>Progress:</Text>
					<Box flexDirection="column" height={8} overflowY="scroll">
						<Text>{processingLog}</Text>
					</Box>
				</Box>
			)}
			<Box>
				<Text
					dimColor
				>{`Mode: ${launchMode} | Persona: ${selectedPersona || 'auto-detected'}`}</Text>
			</Box>
		</Box>
	);

	return (
		<Box
			flexDirection="column"
			width={80}
			minHeight={20}
			borderStyle="round"
			borderColor={theme.border}
			paddingX={2}
			paddingY={1}
		>
			<Box marginBottom={1} flexDirection="column" alignItems="center">
				<Text bold color={theme.highlight}>
					🚀 Launch Claude in {worktree.name}
				</Text>
				<Text color={theme.muted} fontSize={12}>
					Task: {tasks[0]?.title || 'Unknown'}
				</Text>
			</Box>

			{error && (
				<Box marginBottom={1}>
					<Text color={theme.error}>❌ {error}</Text>
				</Box>
			)}

			<Box flexGrow={1}>
				{view === 'mode' && renderModeSelection()}
				{view === 'persona' && renderPersonaSelection()}
				{view === 'prompt' && renderPromptInput()}
				{view === 'processing' && renderProcessing()}
			</Box>
		</Box>
	);
}
