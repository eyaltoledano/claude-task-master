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
	// Always select the task automatically for single task scenarios
	const [selectedTasks] = useState(() => {
		// For subtasks, we always process just the one
		return tasks.map((t) => t.id);
	});

	const [headlessPrompt, setHeadlessPrompt] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState(null);
	const [view, setView] = useState('persona'); // persona, options, prompt, processing, research, summary
	const [detectedPersonas, setDetectedPersonas] = useState([]);
	const [selectedPersona, setSelectedPersona] = useState(null);
	const [personaSelectionIndex, setPersonaSelectionIndex] = useState(0);
	const [isDetectingPersonas, setIsDetectingPersonas] = useState(false);
	const [processingLog, setProcessingLog] = useState('');
	const [processingLines, setProcessingLines] = useState([]); // Store multiple lines
	const [sessionResult, setSessionResult] = useState(null);
	const [showFullConversation, setShowFullConversation] = useState(false);
	const [conversationScrollOffset, setConversationScrollOffset] = useState(0);
	const [maxTurns, setMaxTurns] = useState(15);
	const [toolRestrictions, setToolRestrictions] = useState({
		allowShellCommands: true, // Changed from false to true
		allowFileOperations: true, // Changed from false to true
		allowWebSearch: true // Changed from false to true
	});
	const [shouldCreatePR, setShouldCreatePR] = useState(true); // Default to creating PR

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
	}, [
		view,
		selectedTasks.length,
		isDetectingPersonas,
		detectedPersonas.length,
		detectPersonasForSelectedTasks
	]);

	useInput((input, key) => {
		if (key.escape) {
			onClose();
			return;
		}

		if (view === 'persona') {
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
				setView('options');
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
					setView('options');
				}
			} else if (input === 'p') {
				// Manual persona selection
				setView('manual-persona');
			} else if (input === 'n') {
				// No persona
				setSelectedPersona(null);
				setView('options');
			}
		} else if (view === 'options') {
			if (input === '1') {
				// Toggle shell commands
				setToolRestrictions((prev) => ({
					...prev,
					allowShellCommands: !prev.allowShellCommands
				}));
			} else if (input === '2') {
				// Toggle file operations
				setToolRestrictions((prev) => ({
					...prev,
					allowFileOperations: !prev.allowFileOperations
				}));
			} else if (input === '3') {
				// Toggle web search
				setToolRestrictions((prev) => ({
					...prev,
					allowWebSearch: !prev.allowWebSearch
				}));
			} else if (input === '+') {
				// Increase max turns
				setMaxTurns((prev) => Math.min(30, prev + 5));
			} else if (input === '-') {
				// Decrease max turns
				setMaxTurns((prev) => Math.max(5, prev - 5));
			} else if (key.return) {
				// Continue to prompt
				setView('prompt');
			} else if (key.backspace) {
				// Go back to persona selection
				setView('persona');
			}
		} else if (view === 'prompt') {
			if (key.return && !key.shift) {
				// Launch on Enter (without shift)
				handleLaunch();
			} else if (key.backspace && headlessPrompt === '') {
				// Go back to options if prompt is empty
				setView('options');
			}
		} else if (view === 'summary') {
			if (input === 'v') {
				// Toggle full conversation view
				setShowFullConversation(!showFullConversation);
				// Reset scroll when toggling
				setConversationScrollOffset(0);
			} else if (input === 'r') {
				// Retry/Resume if interrupted
				handleResume();
			} else if (input === 'p') {
				// Toggle PR creation
				setShouldCreatePR(!shouldCreatePR);
			} else if (key.return) {
				// Complete and close, create PR if requested
				handleComplete();
			} else if (showFullConversation) {
				// Scroll controls when conversation is shown
				if (key.upArrow) {
					setConversationScrollOffset((prev) => Math.max(0, prev - 1));
				} else if (key.downArrow) {
					const totalMessages = sessionResult?.messages?.length || 0;
					const visibleLines = 12; // Height minus headers
					const maxOffset = Math.max(0, totalMessages - visibleLines);
					setConversationScrollOffset((prev) => Math.min(maxOffset, prev + 1));
				} else if (key.pageUp) {
					setConversationScrollOffset((prev) => Math.max(0, prev - 10));
				} else if (key.pageDown) {
					const totalMessages = sessionResult?.messages?.length || 0;
					const visibleLines = 12; // Height minus headers
					const maxOffset = Math.max(0, totalMessages - visibleLines);
					setConversationScrollOffset((prev) => Math.min(maxOffset, prev + 10));
				} else if (input === 'h' || input === 'H') {
					// Home - go to top
					setConversationScrollOffset(0);
				} else if (input === 'e' || input === 'E') {
					// End - go to bottom
					const totalMessages = sessionResult?.messages?.length || 0;
					const visibleLines = 12;
					const maxOffset = Math.max(0, totalMessages - visibleLines);
					setConversationScrollOffset(maxOffset);
				}
			}
		}
	});

	const handleLaunch = async () => {
		setIsProcessing(true);
		setError(null);
		setProcessingLines([]); // Clear previous lines

		try {
			const selectedTaskObjects = tasks.filter((t) =>
				selectedTasks.includes(t.id)
			);

			// Check if tasks need research
			let needsResearch = false;
			for (const task of selectedTaskObjects) {
				if (!backend.hasResearchInTask || !backend.hasResearchInTask(task)) {
					needsResearch = true;
					break;
				}
			}

			if (needsResearch) {
				setView('research');
				setProcessingLog('Checking for existing research...');
			} else {
				setView('processing');
			}

			// Build allowed tools list based on restrictions
			let allowedTools = null;
			if (
				!toolRestrictions.allowShellCommands ||
				!toolRestrictions.allowFileOperations ||
				!toolRestrictions.allowWebSearch
			) {
				// Start with all tools and filter out restricted ones
				allowedTools = [];

				// Basic tools that are always allowed
				allowedTools.push('read_file', 'list_directory', 'search_files');

				// File operation tools
				if (toolRestrictions.allowFileOperations) {
					allowedTools.push(
						'create_file',
						'edit_file',
						'delete_file',
						'move_file'
					);
				}

				// Shell command tools
				if (toolRestrictions.allowShellCommands) {
					allowedTools.push('execute_command', 'run_script');
				}

				// Web search tools
				if (toolRestrictions.allowWebSearch) {
					allowedTools.push('web_search', 'fetch_url');
				}
			}

			// Headless mode - run Claude with prompts in background
			const result = await backend.launchClaudeHeadless(
				worktree,
				selectedTaskObjects,
				headlessPrompt,
				{
					persona: selectedPersona,
					maxTurns: maxTurns,
					permissionMode: 'acceptEdits',
					captureOutput: true,
					outputFormat: 'stream-json',
					allowedTools: allowedTools,
					log: {
						info: (msg) => {
							if (
								msg.includes('has no research') ||
								msg.includes('Running research')
							) {
								setView('research');
								setProcessingLog(msg);
							} else if (msg.includes('Research completed')) {
								setProcessingLog(msg);
								// Switch to processing view after research is done
								setTimeout(() => setView('processing'), 1000);
							} else if (msg.includes('already has research')) {
								// If all tasks already have research, go straight to processing
								if (view === 'research') {
									setView('processing');
								}
							}
						},
						warn: (msg) => console.warn(msg),
						error: (msg) => console.error(msg),
						debug: (msg) => console.debug(msg),
						success: (msg) => console.log(msg)
					},
					onProgress: (output) => {
						// Parse streaming output and collect lines
						if (typeof output === 'string') {
							// Claude often sends the full conversation, so we need to be smart about what to show
							const lines = output.split('\n');

							// Look for specific patterns that indicate progress
							const meaningfulLines = lines.filter((line) => {
								const trimmed = line.trim();
								return (
									trimmed &&
									(trimmed.startsWith("I'll") ||
										trimmed.startsWith('Let me') ||
										trimmed.startsWith('Creating') ||
										trimmed.startsWith('Implementing') ||
										trimmed.startsWith('Task') ||
										trimmed.startsWith('Writing') ||
										trimmed.startsWith('Testing') ||
										trimmed.startsWith('✓') ||
										trimmed.startsWith('✗') ||
										trimmed.includes('...') ||
										trimmed.match(/^\d+\./) || // Numbered steps
										trimmed.match(/^[-*]/)) // Bullet points
								);
							});

							if (meaningfulLines.length > 0) {
								setProcessingLines((prev) => {
									const newLines = [...prev];
									meaningfulLines.forEach((line) => {
										// Avoid duplicates
										if (!newLines.includes(line.trim())) {
											newLines.push(line.trim());
										}
									});
									// Return all lines, no limit
									return newLines;
								});
								// Update single log with last meaningful line
								setProcessingLog(meaningfulLines[meaningfulLines.length - 1]);
							}
						} else if (output && typeof output === 'object') {
							// Handle structured progress updates
							const message =
								output.message || output.text || JSON.stringify(output);
							setProcessingLines((prev) => {
								const newLines = [...prev];
								if (!newLines.includes(message)) {
									newLines.push(message);
								}
								// Return all lines, no limit
								return newLines;
							});
							setProcessingLog(message);
						}
					}
				}
			);

			if (result.success) {
				// Calculate detailed statistics
				const turnCount =
					result.messages?.filter((m) => m.type === 'assistant').length || 0;
				const fileChanges =
					result.messages?.filter(
						(m) =>
							m.type === 'tool_use' &&
							['create_file', 'edit_file'].includes(m.name)
					).length || 0;
				const tokenCounts = result.tokenCounts || {};

				// Store the result for the summary view
				const sessionData = {
					mode: 'headless',
					worktree: worktree.name,
					worktreePath: worktree.path,
					branch: worktree.branch || worktree.name,
					sourceBranch: worktree.sourceBranch || 'main',
					tasks: selectedTaskObjects.map((t) => ({
						id: t.id,
						title: t.title,
						description: t.description
					})),
					persona: result.persona || selectedPersona,
					output: result.output,
					sessionId: result.sessionId,
					totalCost: result.totalCost,
					duration: result.duration,
					messages: result.messages,
					message: `Processed ${result.tasksProcessed} task(s) in ${worktree.name}`,
					statistics: {
						turns: turnCount,
						maxTurns: maxTurns,
						fileChanges: fileChanges,
						totalCost: result.totalCost || 0,
						duration: result.duration || 0,
						durationSeconds: Math.round((result.duration || 0) / 1000),
						tokenCounts: tokenCounts,
						toolRestrictions: toolRestrictions,
						completedAt: new Date().toISOString()
					}
				};

				setSessionResult(sessionData);

				// Save session data to file
				try {
					await backend.saveClaudeSessionData(sessionData);
				} catch (saveError) {
					console.error('Failed to save Claude session data:', saveError);
					// Don't block the UI flow, just log the error
				}

				// Switch to summary view
				setView('summary');
			} else {
				throw new Error(result.error || 'Claude headless execution failed');
			}
		} catch (err) {
			setError(err.message);
			setView('persona');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleResume = async () => {
		if (!sessionResult?.sessionId) return;

		setIsProcessing(true);
		setView('processing');
		setError(null);

		try {
			// Resume the session with additional instructions
			const result = await backend.claudeCodeResume(
				sessionResult.sessionId,
				'Continue with the task implementation',
				{
					maxTurns: maxTurns,
					permissionMode: 'acceptEdits',
					captureOutput: true
				}
			);

			if (result.success) {
				// Update session result
				const updatedSessionData = {
					...sessionResult,
					...result,
					messages: [
						...(sessionResult.messages || []),
						...(result.messages || [])
					],
					statistics: {
						...sessionResult.statistics,
						turns:
							(sessionResult.statistics?.turns || 0) +
							(result.messages?.filter((m) => m.type === 'assistant').length ||
								0),
						fileChanges:
							(sessionResult.statistics?.fileChanges || 0) +
							(result.messages?.filter(
								(m) =>
									m.type === 'tool_use' &&
									['create_file', 'edit_file'].includes(m.name)
							).length || 0),
						totalCost:
							(sessionResult.statistics?.totalCost || 0) +
							(result.totalCost || 0),
						duration:
							(sessionResult.statistics?.duration || 0) +
							(result.duration || 0),
						durationSeconds: Math.round(
							((sessionResult.statistics?.duration || 0) +
								(result.duration || 0)) /
								1000
						),
						lastResumedAt: new Date().toISOString()
					}
				};

				setSessionResult(updatedSessionData);

				// Save updated session data
				try {
					await backend.saveClaudeSessionData(updatedSessionData);
				} catch (saveError) {
					console.error(
						'Failed to save updated Claude session data:',
						saveError
					);
				}

				setView('summary');
			} else {
				throw new Error(result.error || 'Failed to resume session');
			}
		} catch (err) {
			setError(err.message);
			setView('summary');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleComplete = async () => {
		if (shouldCreatePR && worktree) {
			// Create PR using WorktreeManager
			try {
				const task = tasks[0]; // Get the first (usually only) task
				const prDescription = `Implemented by Claude Code\n\nStatistics:\n- Turns: ${sessionResult.statistics?.turns || 0}/${sessionResult.statistics?.maxTurns || 0}\n- File Changes: ${sessionResult.statistics?.fileChanges || 0}\n- Duration: ${sessionResult.statistics?.durationSeconds || 0}s\n- Cost: $${(sessionResult.statistics?.totalCost || 0).toFixed(4)}`;

				await backend.completeSubtaskWithPR(worktree.name, {
					createPR: true,
					prTitle: `Task ${task.id}: ${task.title}`,
					prDescription: prDescription
				});
			} catch (error) {
				console.error('Failed to create PR:', error);
				// Continue with completion even if PR creation fails
			}
		}
		onSuccess(sessionResult);
	};

	// Render functions for different views
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

	const renderResearch = () => {
		const task = tasks[0]; // Since we're processing one task at a time
		const taskInfo = task
			? {
					id: task.id,
					title: task.title,
					description: task.description || 'No description provided',
					isSubtask: String(task.id).includes('.')
				}
			: null;

		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold color={theme.primary}>
						🔍 Preparing Research for Task Implementation
					</Text>
				</Box>

				{taskInfo && (
					<Box marginBottom={1} flexDirection="column">
						<Text color={theme.secondary}>
							{taskInfo.isSubtask
								? `Subtask ${taskInfo.id}`
								: `Task ${taskInfo.id}`}
							: {taskInfo.title}
						</Text>
					</Box>
				)}

				<Box marginBottom={1}>
					<LoadingSpinner />
					<Text> Running research to gather current best practices...</Text>
				</Box>

				{processingLog && (
					<Box marginTop={1}>
						<Text dimColor>{processingLog}</Text>
					</Box>
				)}

				<Box marginTop={2}>
					<Text dimColor>
						Research will be saved to the task before launching Claude
					</Text>
				</Box>
			</Box>
		);
	};

	const renderProcessing = () => {
		// Get task details for display
		const task = tasks[0]; // Since we're processing one task at a time
		const taskInfo = task
			? {
					id: task.id,
					title: task.title,
					description: task.description || 'No description provided',
					isSubtask: String(task.id).includes('.')
				}
			: null;

		return (
			<Box flexDirection="column" padding={0}>
				{/* Compact Git Worktree Box */}
				<Box
					marginBottom={0}
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.border}
					paddingX={1}
					paddingY={0}
				>
					<Text bold color={theme.highlight}>
						📁 Git Worktree: {worktree.name}
					</Text>
					<Text color={theme.secondary} fontSize={11}>
						Branch: {worktree.branch || worktree.name} • Source: {worktree.sourceBranch || 'main'}
					</Text>
					<Text color={theme.muted} fontSize={10}>
						Path: {worktree.path}
					</Text>
				</Box>

				{/* Task info - compact */}
				{taskInfo && (
					<Box marginTop={1} marginBottom={0} flexDirection="column">
						<Text bold color={theme.primary}>
							{taskInfo.isSubtask ? `Subtask ${taskInfo.id}` : `Task ${taskInfo.id}`}: {taskInfo.title}
						</Text>
					</Box>
				)}
				
				{/* Processing status and mode/persona on same line */}
				<Box marginTop={1} flexDirection="row" justifyContent="space-between">
					<Box>
						<Text bold color="green">Processing with Claude Code...</Text>
						<LoadingSpinner />
						<Text> Working on implementation...</Text>
					</Box>
					<Text dimColor fontSize={11}>{`${selectedPersona || 'auto-detected'} • headless`}</Text>
				</Box>
				
				{/* Streaming Progress - Full view that expands */}
				{processingLines.length > 0 && (
					<Box
						marginTop={1}
						flexDirection="column"
						borderStyle="single"
						borderColor={theme.borderDim}
						paddingX={1}
						paddingY={0}
						width="100%"
					>
						<Box flexDirection="column">
							{processingLines.map((line, idx) => (
								<Box
									key={`log-${idx}-${line.substring(0, 20)}`}
									width="100%"
								>
									<Text wrap="wrap" fontSize={11}>{line}</Text>
								</Box>
							))}
						</Box>
					</Box>
				)}
			</Box>
		);
	};

	const renderOptions = () => (
		<Box flexDirection="column">
			<Text bold color={theme.primary}>
				Configure Claude Session
			</Text>
			<Text color={theme.secondary}>
				Persona: {personaIcons[selectedPersona]}{' '}
				{personaDefinitions[selectedPersona]?.identity.split('|')[0] || 'None'}
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Text color={theme.text}>Tool Restrictions:</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text
						color={
							toolRestrictions.allowShellCommands ? theme.success : theme.error
						}
					>
						[1] Shell Commands:{' '}
						{toolRestrictions.allowShellCommands ? '✓ Allowed' : '✗ Restricted'}
					</Text>
					<Text
						color={
							toolRestrictions.allowFileOperations ? theme.success : theme.error
						}
					>
						[2] File Operations:{' '}
						{toolRestrictions.allowFileOperations
							? '✓ Allowed'
							: '✗ Restricted'}
					</Text>
					<Text
						color={
							toolRestrictions.allowWebSearch ? theme.success : theme.error
						}
					>
						[3] Web Search:{' '}
						{toolRestrictions.allowWebSearch ? '✓ Allowed' : '✗ Restricted'}
					</Text>
				</Box>
			</Box>

			<Box marginTop={1}>
				<Text color={theme.text}>
					Max Turns: {maxTurns} (use +/- to adjust)
				</Text>
			</Box>

			<Box marginTop={2}>
				<Text dimColor>[1-3] Toggle restrictions [+/-] Adjust turns</Text>
				<Text dimColor>[Enter] Continue [Backspace] Back</Text>
			</Box>
		</Box>
	);

	const renderSummary = () => {
		if (!sessionResult) return null;

		// Calculate summary statistics
		const turnCount =
			sessionResult.messages?.filter((m) => m.type === 'assistant').length || 0;
		const fileChanges =
			sessionResult.messages?.filter(
				(m) =>
					m.type === 'tool_use' && ['create_file', 'edit_file'].includes(m.name)
			).length || 0;

		return (
			<Box flexDirection="column">
				{/* Git Worktree Details */}
				<Box
					marginBottom={1}
					flexDirection="column"
					borderStyle="single"
					borderColor={theme.border}
					paddingX={1}
					paddingY={0.5}
				>
					<Text bold color={theme.highlight}>
						📁 Git Worktree: {worktree.name}
					</Text>
					<Box flexDirection="column" marginLeft={2}>
						<Text color={theme.secondary}>
							Branch: {worktree.branch || worktree.name}
						</Text>
						<Text color={theme.secondary}>
							Source: {worktree.sourceBranch || 'main'}
						</Text>
						<Text color={theme.muted} fontSize={12}>
							Path: {worktree.path}
						</Text>
					</Box>
				</Box>

				<Text bold color={theme.success}>
					✓ Task Completed Successfully
				</Text>

				<Box marginTop={1} flexDirection="column">
					<Text color={theme.text}>Summary:</Text>
					<Box marginLeft={2} flexDirection="column">
						<Text dimColor>
							• Turns: {turnCount}/{maxTurns}
						</Text>
						<Text dimColor>• File Changes: {fileChanges}</Text>
						<Text dimColor>
							• Total Cost: ${sessionResult.totalCost?.toFixed(4) || '0.0000'}
						</Text>
						<Text dimColor>
							• Duration: {Math.round((sessionResult.duration || 0) / 1000)}s
						</Text>
					</Box>
				</Box>

				{/* PR Creation Option */}
				<Box marginTop={2} flexDirection="column">
					<Text color={theme.text}>Next Steps:</Text>
					<Box marginLeft={2}>
						<Text color={shouldCreatePR ? theme.success : theme.muted}>
							[p] Create Pull Request:{' '}
							{shouldCreatePR ? '✓ Yes (default)' : '✗ No'}
						</Text>
					</Box>
				</Box>

				{showFullConversation ? (
					<Box marginTop={2} flexDirection="column">
						<Box flexDirection="row" justifyContent="space-between">
							<Text color={theme.secondary}>Full Conversation:</Text>
							{sessionResult.messages?.length > 12 && (
								<Text dimColor>
									{conversationScrollOffset + 1}-
									{Math.min(
										conversationScrollOffset + 12,
										sessionResult.messages.length
									)}{' '}
									of {sessionResult.messages.length}
								</Text>
							)}
						</Box>
						<Box marginTop={1} flexDirection="column" height={12}>
							{sessionResult.messages
								?.slice(conversationScrollOffset, conversationScrollOffset + 12)
								.map((msg, relativeIdx) => {
									const actualIdx = conversationScrollOffset + relativeIdx;
									// Extract text content from message
									let contentPreview = '';
									if (msg.message?.content) {
										const content = msg.message.content;
										if (Array.isArray(content)) {
											// Handle array of content parts
											for (const part of content) {
												if (part.type === 'text' && part.text) {
													contentPreview += part.text;
													if (contentPreview.length > 100) break;
												}
											}
										} else if (typeof content === 'string') {
											// Handle string content
											contentPreview = content;
										} else if (content.text) {
											// Handle object with text property
											contentPreview = content.text;
										}
									} else if (msg.type === 'tool_use' && msg.name) {
										// Handle tool use messages
										contentPreview = `Tool: ${msg.name}`;
										if (msg.input) {
											contentPreview += ` - ${JSON.stringify(msg.input).substring(0, 50)}`;
										}
									} else if (msg.type === 'system' && msg.subtype) {
										// Handle system messages
										contentPreview = `System: ${msg.subtype}`;
									}

									// Truncate to 100 characters
									if (contentPreview.length > 100) {
										contentPreview = contentPreview.substring(0, 100) + '...';
									}

									return (
										<Box
											key={`msg-${msg.type}-${actualIdx}-${msg.timestamp || actualIdx}`}
											marginBottom={1}
										>
											<Text color={theme.muted}>
												[{msg.type}] {contentPreview || '(no content)'}
											</Text>
										</Box>
									);
								})}
						</Box>
						{sessionResult.messages?.length > 12 && (
							<Box marginTop={1}>
								<Text dimColor>
									[↑↓] Scroll line [PgUp/PgDn] Scroll page [H]ome [E]nd
								</Text>
							</Box>
						)}
					</Box>
				) : (
					<Box marginTop={2}>
						<Text dimColor>{sessionResult.message}</Text>
					</Box>
				)}

				<Box marginTop={2}>
					<Text dimColor>
						[v] {showFullConversation ? 'Hide' : 'Show'} full conversation
						{sessionResult.sessionId && ' [r] Resume/Retry'} [p] Toggle PR
						[Enter] {shouldCreatePR ? 'Done & Create PR' : 'Done'}
					</Text>
				</Box>
			</Box>
		);
	};

	return (
		<Box
			flexDirection="column"
			width={100}
			borderStyle="round"
			borderColor={theme.border}
			paddingX={1}
			paddingY={0}
		>
			<Box marginBottom={0} flexDirection="row" justifyContent="space-between" alignItems="center">
				<Text bold color={theme.highlight}>
					🚀 Claude Code: {worktree.name}
				</Text>
				{view === 'processing' && <Text color={theme.muted}>Headless Mode</Text>}
			</Box>

			{error && (
				<Box marginBottom={1}>
					<Text color={theme.error}>❌ {error}</Text>
				</Box>
			)}

			<Box flexGrow={1}>
				{view === 'persona' && renderPersonaSelection()}
				{view === 'prompt' && renderPromptInput()}
				{view === 'research' && renderResearch()}
				{view === 'processing' && renderProcessing()}
				{view === 'options' && renderOptions()}
				{view === 'summary' && renderSummary()}
			</Box>
		</Box>
	);
}
