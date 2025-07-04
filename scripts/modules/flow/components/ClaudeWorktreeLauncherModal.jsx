import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';
import { personaDefinitions } from '../personas/persona-definitions.js';
import { BackgroundClaudeCode } from '../services/BackgroundClaudeCode.js';
import { useAppContext } from '../index.jsx';
import { backgroundOperations } from '../services/BackgroundOperationsManager.js';

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
	const { theme } = useComponentTheme('modal');

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
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(10); // Default viewport height

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

	// Auto-scroll to bottom when new lines are added
	useEffect(() => {
		if (view === 'processing' && processingLines.length > 0) {
			// Auto-scroll to show latest content
			const maxScroll = Math.max(0, processingLines.length - viewportHeight);
			setScrollOffset(maxScroll);
		}
	}, [processingLines.length, viewportHeight, view]);

	// Set viewport height based on available space
	useEffect(() => {
		// Reserve space for header, task info, status line, and scroll indicators
		const reservedLines = 12;
		const availableHeight = Math.max(
			5,
			(process.stdout.rows || 24) - reservedLines
		);
		setViewportHeight(availableHeight);
	}, []);

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
						: [
								'↑↓ navigate',
								'ENTER accept',
								'TAB next',
								'1-9 quick select',
								'p manual',
								'n none',
								'ESC cancel'
							]
				};
			case 'options':
				return {
					...baseProps,
					title: `🚀 Claude Code: Configure Session`,
					preset: 'default',
					keyboardHints: [
						'1-3 toggle restrictions',
						'+/- adjust turns',
						'c customize prompt',
						'ENTER launch',
						'BACKSPACE back',
						'ESC cancel'
					]
				};
			case 'prompt':
				return {
					...baseProps,
					title: '🚀 Claude Code: Enter Instructions',
					preset: 'default',
					keyboardHints: ['ENTER launch', 'BACKSPACE back', 'ESC cancel']
				};
			case 'research':
				return {
					...baseProps,
					title: '🚀 Claude Code: Preparing Research',
					preset: 'info',
					keyboardHints: ['ESC cancel']
				};
			case 'processing':
				return {
					...baseProps,
					title: `🚀 Claude Code: Processing`,
					preset: 'default',
					keyboardHints:
						processingLines.length > viewportHeight
							? [
									'↑↓/j/k scroll',
									'PgUp/PgDn page',
									'Home/End jump',
									'ESC cancel'
								]
							: ['ESC cancel']
				};
			case 'summary':
				return {
					...baseProps,
					title: '🚀 Claude Code: Task Complete',
					preset: 'success',
					keyboardHints: showFullConversation
						? [
								'v hide conversation',
								'p toggle PR',
								'ENTER done',
								'↑↓ scroll',
								'H/E home/end',
								'ESC cancel'
							]
						: [
								'v show conversation',
								'p toggle PR',
								'ENTER done',
								'r resume',
								'ESC cancel'
							]
				};
			default:
				return {
					...baseProps,
					title: '🚀 Claude Code',
					preset: 'default',
					keyboardHints: ['ESC cancel']
				};
		}
	};

	const keyHandlers = {
		escape: onClose,

		// Handle scrolling in processing view
		upArrow: () => {
			if (view === 'processing' && processingLines.length > viewportHeight) {
				setScrollOffset((prev) => Math.max(0, prev - 1));
			} else if (view === 'persona') {
				setPersonaSelectionIndex(Math.max(0, personaSelectionIndex - 1));
			} else if (view === 'summary' && showFullConversation) {
				setConversationScrollOffset((prev) => Math.max(0, prev - 1));
			}
		},

		downArrow: () => {
			if (view === 'processing' && processingLines.length > viewportHeight) {
				setScrollOffset((prev) =>
					Math.min(
						prev + 1,
						Math.max(0, processingLines.length - viewportHeight)
					)
				);
			} else if (view === 'persona') {
				setPersonaSelectionIndex(
					Math.min(detectedPersonas.length - 1, personaSelectionIndex + 1)
				);
			} else if (view === 'summary' && showFullConversation) {
				const totalMessages = sessionResult?.messages?.length || 0;
				const visibleLines = 12;
				const maxOffset = Math.max(0, totalMessages - visibleLines);
				setConversationScrollOffset((prev) => Math.min(maxOffset, prev + 1));
			}
		},

		// Vim-style navigation
		j: () => {
			if (view === 'processing') {
				keyHandlers.downArrow();
			}
		},

		k: () => {
			if (view === 'processing') {
				keyHandlers.upArrow();
			}
		},

		// Page navigation
		pageUp: () => {
			if (view === 'processing' && processingLines.length > viewportHeight) {
				setScrollOffset((prev) => Math.max(0, prev - viewportHeight));
			} else if (view === 'summary' && showFullConversation) {
				setConversationScrollOffset((prev) => Math.max(0, prev - 10));
			}
		},

		pageDown: () => {
			if (view === 'processing' && processingLines.length > viewportHeight) {
				setScrollOffset((prev) =>
					Math.min(
						prev + viewportHeight,
						Math.max(0, processingLines.length - viewportHeight)
					)
				);
			} else if (view === 'summary' && showFullConversation) {
				const totalMessages = sessionResult?.messages?.length || 0;
				const visibleLines = 12;
				const maxOffset = Math.max(0, totalMessages - visibleLines);
				setConversationScrollOffset((prev) => Math.min(maxOffset, prev + 10));
			}
		},

		home: () => {
			if (view === 'processing') {
				setScrollOffset(0);
			}
		},

		end: () => {
			if (view === 'processing') {
				setScrollOffset(Math.max(0, processingLines.length - viewportHeight));
			}
		},

		// View-specific actions
		return: () => {
			if (view === 'persona') {
				setSelectedPersona(
					detectedPersonas[personaSelectionIndex]?.persona || 'architect'
				);
				setView('options');
			} else if (view === 'options') {
				// Skip the prompt view and launch directly with default prompt
				const defaultPrompt =
					'Implement the assigned tasks according to the specifications and context provided in CLAUDE.md. Follow best practices and ensure comprehensive testing.';
				setHeadlessPrompt(defaultPrompt);
				handleLaunch();
			} else if (view === 'prompt') {
				handleLaunch();
			} else if (view === 'summary') {
				handleComplete();
			}
		},

		backspace: () => {
			if (view === 'options') {
				setView('persona');
			} else if (view === 'prompt' && headlessPrompt === '') {
				setView('options');
			}
		},

		// Persona view specific
		tab: () => {
			if (view === 'persona' && detectedPersonas.length > 1) {
				const nextIndex = (personaSelectionIndex + 1) % detectedPersonas.length;
				setPersonaSelectionIndex(nextIndex);
			}
		},

		// Number keys for quick selection
		1: () => handleNumberKey('1'),
		2: () => handleNumberKey('2'),
		3: () => handleNumberKey('3'),
		4: () => handleNumberKey('4'),
		5: () => handleNumberKey('5'),
		6: () => handleNumberKey('6'),
		7: () => handleNumberKey('7'),
		8: () => handleNumberKey('8'),
		9: () => handleNumberKey('9'),

		// Letter keys
		p: () => {
			if (view === 'persona') {
				setView('manual-persona');
			} else if (view === 'summary') {
				setShouldCreatePR(!shouldCreatePR);
			}
		},

		c: () => {
			if (view === 'options') {
				setView('prompt');
			}
		},

		n: () => {
			if (view === 'persona') {
				setSelectedPersona(null);
				setView('options');
			}
		},

		v: () => {
			if (view === 'summary') {
				setShowFullConversation(!showFullConversation);
				setConversationScrollOffset(0);
			}
		},

		r: () => {
			if (view === 'summary') {
				handleResume();
			}
		},

		// Options view specific
		'+': () => {
			if (view === 'options') {
				setMaxTurns((prev) => Math.min(30, prev + 5));
			}
		},

		'-': () => {
			if (view === 'options') {
				setMaxTurns((prev) => Math.max(5, prev - 5));
			}
		},

		// Summary view specific
		h: () => {
			if (view === 'summary' && showFullConversation) {
				setConversationScrollOffset(0);
			}
		},

		e: () => {
			if (view === 'summary' && showFullConversation) {
				const totalMessages = sessionResult?.messages?.length || 0;
				const visibleLines = 12;
				const maxOffset = Math.max(0, totalMessages - visibleLines);
				setConversationScrollOffset(maxOffset);
			}
		}
	};

	const handleNumberKey = (number) => {
		if (view === 'persona') {
			const index = parseInt(number) - 1;
			const personaIds = Object.keys(personaDefinitions);
			if (index < personaIds.length) {
				setSelectedPersona(personaIds[index]);
				setView('options');
			}
		} else if (view === 'options') {
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

	const handleLaunch = async () => {
		console.log(
			'🚀 [ClaudeWorktreeLauncherModal] Starting background Claude Code session with options:',
			{
				persona: selectedPersona,
				maxTurns: maxTurns,
				worktreeName: worktree?.name,
				tasksCount: tasks.length
			}
		);

		// Handle worktree creation if needed
		let actualWorktree = worktree;

		if (!actualWorktree && tasks.length > 0) {
			// No worktree exists, create one for the task/subtask
			const task = tasks[0];
			const isSubtask = task.isSubtask || String(task.id).includes('.');

			console.log(
				'🏗️ [ClaudeWorktreeLauncherModal] Creating worktree for task:',
				{
					taskId: task.id,
					isSubtask,
					title: task.title
				}
			);

			try {
				// Get the current branch to use as source
				let sourceBranch = 'main'; // default fallback
				try {
					const { execSync } = await import('child_process');
					sourceBranch = execSync('git rev-parse --abbrev-ref HEAD', {
						cwd: backend.projectRoot,
						encoding: 'utf8'
					}).trim();
				} catch (error) {
					console.error('Failed to get current branch:', error);
					// Try 'master' as a secondary fallback
					sourceBranch = 'master';
				}

				// Create worktree based on task type
				let result;
				if (isSubtask) {
					const [parentId, subtaskId] = task.id.split('.');
					result = await backend.getOrCreateWorktreeForSubtask(
						parseInt(parentId),
						parseInt(subtaskId),
						{
							sourceBranch,
							subtaskTitle: task.title
						}
					);
				} else {
					result = await backend.getOrCreateWorktreeForTask(task.id, {
						sourceBranch,
						taskTitle: task.title
					});
				}

				// Check if we need user decision for branch conflict
				if (result.needsUserDecision) {
					const conflictMessage = result.branchInUseAt
						? `Branch conflict: ${result.branchName} is already in use at ${result.branchInUseAt}. Please resolve this in the Tasks screen first.`
						: `Branch conflict: ${result.branchName} already exists but is not currently in use. Please choose how to proceed in the Tasks screen.`;

					setError(conflictMessage);
					setView('persona');
					return;
				}

				if (result.created) {
					console.log(
						`✅ [ClaudeWorktreeLauncherModal] Created worktree: ${result.worktree.name}`
					);
				} else if (result.exists) {
					console.log(
						`♻️ [ClaudeWorktreeLauncherModal] Using existing worktree: ${result.worktree.name}`
					);
				}

				actualWorktree = result.worktree;
			} catch (worktreeError) {
				console.error(
					'❌ [ClaudeWorktreeLauncherModal] Failed to create worktree:',
					worktreeError
				);
				setError(`Failed to create worktree: ${worktreeError.message}`);
				setView('persona');
				return;
			}
		}

		try {
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

			// Initialize background service
			const backgroundClaudeCode = new BackgroundClaudeCode(backend);

			// Build the prompt for the session
			const prompt =
				headlessPrompt ||
				'Implement the assigned tasks according to the specifications in CLAUDE.md';

			// Start background operation
			const operation = await backgroundClaudeCode.startQuery(prompt, {
				persona: selectedPersona,
				metadata: {
					type:
						tasks.length === 1 &&
						(tasks[0].isSubtask || String(tasks[0].id).includes('.'))
							? 'subtask-implementation'
							: 'task-implementation',
					taskId: tasks[0]?.id,
					subtaskId:
						tasks[0]?.isSubtask || String(tasks[0]?.id).includes('.')
							? tasks[0].id
							: null,
					parentTaskId:
						tasks[0]?.isSubtask || String(tasks[0]?.id).includes('.')
							? tasks[0].id.split('.')[0]
							: null,
					// Pass complete task information for CLAUDE.md generation
					taskData: tasks[0]
						? await (async () => {
								const task = tasks[0];
								const taskData = {
									id: task.id,
									title: task.title,
									description: task.description || '',
									details: task.details || '',
									testStrategy: task.testStrategy || '',
									status: task.status || 'pending',
									isSubtask: task.isSubtask || String(task.id).includes('.'),
									parentTask: task.parentTask || null
								};

								// If this is a subtask and we don't already have parent task data, fetch it
								if (taskData.isSubtask && task.id.includes('.') && !task.parentTask) {
									const parentTaskId = task.id.split('.')[0];
									try {
										const parentTask = await backend.getTask(parentTaskId);
										if (parentTask) {
											taskData.parentTask = {
												id: parentTask.id,
												title: parentTask.title,
												description: parentTask.description || '',
												details: parentTask.details || '',
												testStrategy: parentTask.testStrategy || '',
												status: parentTask.status || 'pending'
											};
										}
									} catch (error) {
										console.warn(
											'⚠️ [ClaudeWorktreeLauncherModal] Failed to fetch parent task:',
											error
										);
									}
								}

								return taskData;
							})()
						: null,
					worktreePath: actualWorktree?.path,
					worktreeName: actualWorktree?.name,
					branch: actualWorktree?.branch || actualWorktree?.name,
					persona: selectedPersona,
					maxTurns: maxTurns,
					allowedTools: allowedTools,
					prompt: prompt
				}
			});

			console.log(
				'✅ [ClaudeWorktreeLauncherModal] Background operation started:',
				{
					operationId: operation.operationId,
					worktree: actualWorktree?.name
				}
			);

			// Update the relevant task/subtask with background operation reference
			try {
				const primaryTask = tasks[0];
				const sessionReference = `
<claude-session added="${new Date().toISOString()}" operationId="${operation.operationId}" type="background">
Claude Code session started in background with ${selectedPersona} persona. Operation ID: ${operation.operationId}
Working directory: ${actualWorktree?.path}
Branch: ${actualWorktree?.branch || actualWorktree?.name}
Max turns: ${maxTurns}
${allowedTools ? `Allowed tools: ${allowedTools.join(', ')}` : 'All tools allowed'}
</claude-session>
`;

				if (primaryTask.isSubtask || String(primaryTask.id).includes('.')) {
					// Update subtask
					await backend.updateSubtask({
						id: primaryTask.id,
						prompt: sessionReference,
						research: false
					});
					console.log(
						'📝 [ClaudeWorktreeLauncherModal] Updated subtask with session reference'
					);
				} else {
					// Update task
					await backend.updateTask({
						id: primaryTask.id,
						prompt: sessionReference,
						research: false
					});
					console.log(
						'📝 [ClaudeWorktreeLauncherModal] Updated task with session reference'
					);
				}
			} catch (updateError) {
				console.warn(
					'⚠️ [ClaudeWorktreeLauncherModal] Failed to update task with session reference:',
					updateError
				);
			}

			// Show success and close modal
			setSessionResult({
				success: true,
				operationId: operation.operationId,
				sessionId: operation.operationId, // Use operationId as sessionId for compatibility
				worktree: actualWorktree,
				output: `Claude Code started in background (Operation: ${operation.operationId.substring(0, 8)}...)`,
				message: `Background session started successfully! You can monitor progress in the Background Operations screen.`
			});

			setView('summary');

			// Auto-close after showing success
			setTimeout(() => {
				onClose();
			}, 3000);
		} catch (error) {
			console.error(
				'❌ [ClaudeWorktreeLauncherModal] Failed to start background operation:',
				error
			);
			setError(`Failed to start Claude Code: ${error.message}`);
			setView('persona');
		}
	};

	const handleResume = async () => {
		console.log(
			'🔄 [ClaudeWorktreeLauncherModal] Resuming background Claude Code session:',
			{
				sessionId: sessionResult.sessionId,
				maxTurns: maxTurns
			}
		);

		try {
			// Initialize background service
			const backgroundClaudeCode = new BackgroundClaudeCode(backend);

			// Resume the session (or start a new one with continuation prompt)
			const resumePrompt =
				'Continue with the implementation from where we left off.';

			// Start a new background operation as continuation
			const operation = await backgroundClaudeCode.startQuery(resumePrompt, {
				persona: selectedPersona,
				metadata: {
					type: 'session-continuation',
					originalSessionId: sessionResult.sessionId,
					taskId: tasks[0]?.id,
					worktreePath: worktree?.path,
					worktreeName: worktree?.name,
					branch: worktree?.branch || worktree?.name,
					persona: selectedPersona,
					maxTurns: maxTurns,
					prompt: resumePrompt
				}
			});

			console.log(
				'✅ [ClaudeWorktreeLauncherModal] Background continuation started:',
				{
					operationId: operation.operationId,
					originalSessionId: sessionResult.sessionId
				}
			);

			// Update the task/subtask with continuation reference
			try {
				const primaryTask = tasks[0];
				const continuationReference = `
<claude-session added="${new Date().toISOString()}" operationId="${operation.operationId}" type="background-continuation">
Claude Code session resumed in background. New Operation ID: ${operation.operationId}
Original Session: ${sessionResult.sessionId}
Working directory: ${worktree?.path}
</claude-session>
`;

				if (primaryTask.isSubtask || String(primaryTask.id).includes('.')) {
					await backend.updateSubtask({
						id: primaryTask.id,
						prompt: continuationReference,
						research: false
					});
				} else {
					await backend.updateTask({
						id: primaryTask.id,
						prompt: continuationReference,
						research: false
					});
				}
			} catch (updateError) {
				console.warn(
					'⚠️ [ClaudeWorktreeLauncherModal] Failed to update task with continuation reference:',
					updateError
				);
			}

			// Update session result
			setSessionResult({
				...sessionResult,
				operationId: operation.operationId,
				message: `Session resumed in background! New Operation ID: ${operation.operationId.substring(0, 8)}...`
			});

			// Auto-close after showing success
			setTimeout(() => {
				onClose();
			}, 3000);
		} catch (error) {
			console.error(
				'❌ [ClaudeWorktreeLauncherModal] Failed to resume background session:',
				error
			);
			setError(`Failed to resume session: ${error.message}`);
		}
	};

	const handleComplete = async () => {
		if (shouldCreatePR && sessionResult) {
			try {
				const task = tasks[0]; // Get the first (usually only) task
				const prDescription = `Implemented by Claude Code\n\nStatistics:\n- Turns: ${sessionResult.statistics?.turns || 0}/${sessionResult.statistics?.maxTurns || 0}\n- File Changes: ${sessionResult.statistics?.fileChanges || 0}\n- Duration: ${sessionResult.statistics?.durationSeconds || 0}s\n- Cost: $${(sessionResult.statistics?.totalCost || 0).toFixed(4)}`;

				// Use worktree from props or sessionResult as fallback
				const currentWorktree = worktree || { name: sessionResult?.worktree };
				await backend.completeSubtaskWithPR(currentWorktree.name, {
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

	const renderPromptInput = () => (
		<Box flexDirection="column">
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

		// Calculate visible lines based on viewport
		const startIdx = scrollOffset;
		const endIdx = Math.min(
			scrollOffset + viewportHeight,
			processingLines.length
		);
		const visibleLines = processingLines.slice(startIdx, endIdx);
		const canScrollUp = scrollOffset > 0;
		const canScrollDown = endIdx < processingLines.length;

		return (
			<Box flexDirection="column" padding={0}>
				{/* Compact Git Worktree Box */}
				{(worktree || sessionResult?.worktree) && (
					<Box
						marginBottom={0}
						flexDirection="column"
						borderStyle="single"
						borderColor={theme.border}
						paddingX={1}
						paddingY={0}
					>
						<Text bold color={theme.highlight}>
							📁 Git Worktree:{' '}
							{worktree?.path.split('/').pop() ||
								sessionResult?.worktree?.path.split('/').pop() ||
								'Unknown'}
						</Text>
						<Text color={theme.secondary} fontSize={11}>
							Branch:{' '}
							{worktree?.branch ||
								worktree?.name ||
								sessionResult?.branch ||
								'TBD'}{' '}
							• Source:{' '}
							{worktree?.sourceBranch || sessionResult?.sourceBranch || 'main'}
						</Text>
						<Text color={theme.muted} fontSize={10}>
							Path: {worktree?.path || sessionResult?.worktreePath || 'TBD'}
						</Text>
					</Box>
				)}

				{/* Task info - compact */}
				{taskInfo && (
					<Box marginTop={1} marginBottom={0} flexDirection="column">
						<Text bold color={theme.primary}>
							{taskInfo.isSubtask
								? `Subtask ${taskInfo.id}`
								: `Task ${taskInfo.id}`}
							: {taskInfo.title}
						</Text>
					</Box>
				)}

				{/* Processing status and mode/persona on same line */}
				<Box marginTop={1} flexDirection="row" justifyContent="space-between">
					<Box>
						<Text bold color="green">
							Processing with Claude Code...
						</Text>
						<LoadingSpinner />
						<Text> Working on implementation...</Text>
					</Box>
					<Text
						dimColor
						fontSize={11}
					>{`${selectedPersona || 'auto-detected'} • headless`}</Text>
				</Box>

				{/* Scroll indicators */}
				{canScrollUp && (
					<Box marginTop={1}>
						<Text dimColor>
							↑ {scrollOffset} more lines above (press ↑/k to scroll up)
						</Text>
					</Box>
				)}

				{/* Streaming Progress - Scrollable view */}
				{visibleLines.length > 0 && (
					<Box
						marginTop={1}
						flexDirection="column"
						width="100%"
						height={viewportHeight}
					>
						{visibleLines.map((line, idx) => (
							<Text
								key={`log-${startIdx + idx}-${line.substring(0, 20)}`}
								wrap="wrap"
								fontSize={11}
							>
								{line}
							</Text>
						))}
					</Box>
				)}

				{/* Scroll indicators */}
				{canScrollDown && (
					<Box marginTop={1}>
						<Text dimColor>
							↓ {processingLines.length - endIdx} more lines below (press ↓/j to
							scroll down)
						</Text>
					</Box>
				)}

				{/* Quick scroll info */}
				{processingLines.length > viewportHeight && (
					<Box marginTop={1}>
						<Text dimColor fontSize={10}>
							Line {startIdx + 1}-{endIdx} of {processingLines.length} •
							[PgUp/PgDn] page • [Home/End] jump
						</Text>
					</Box>
				)}
			</Box>
		);
	};

	const renderOptions = () => (
		<Box flexDirection="column">
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
				<Text color={theme.secondary}>
					Press ENTER to launch with default prompt or 'c' to customize
				</Text>
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
						📁 Git Worktree:{' '}
						{worktree?.path.split('/').pop() ||
							sessionResult?.worktree?.path.split('/').pop() ||
							'Unknown'}
					</Text>
					<Box flexDirection="column" marginLeft={2}>
						<Text color={theme.secondary}>
							Branch:{' '}
							{worktree?.branch ||
								worktree?.name ||
								sessionResult?.branch ||
								'Unknown'}
						</Text>
						<Text color={theme.secondary}>
							Source:{' '}
							{worktree?.sourceBranch || sessionResult?.sourceBranch || 'main'}
						</Text>
						<Text color={theme.muted} fontSize={12}>
							Path: {worktree?.path || sessionResult?.worktreePath || 'Unknown'}
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
					</Box>
				) : (
					<Box marginTop={2}>
						<Text dimColor>{sessionResult.message}</Text>
					</Box>
				)}
			</Box>
		);
	};

	return (
		<BaseModal {...getModalProps()}>
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
		</BaseModal>
	);
}
