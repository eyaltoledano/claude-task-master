import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ConfirmInput } from '@inkjs/ui';
import { useAppContext } from '../app/index-root.jsx';
import { useServices } from '../shared/contexts/ServiceContext.jsx';
import { theme } from '../shared/theme/theme.js';
import { FileBrowser, LoadingSpinner, OverflowableText } from '../features/ui';
import { StreamingModal } from './StreamingModal.jsx';
import { streamingStateManager } from '../infra/streaming/StreamingStateManager.js';
import { AsyncErrorBoundary, FileOperationErrorBoundary } from '../shared/components/error-boundaries/index.js';

export function ParsePRDScreen() {
	// Get backend from dependency injection, other things from app context
	const { backend, logger } = useServices();
	const { currentTag, setCurrentScreen, showToast, reloadTasks } =
		useAppContext();
	const [step, setStep] = useState('file-browser'); // 'file-browser' | 'research-prompt' | 'num-tasks-prompt' | 'confirm-overwrite' | 'parsing' | 'success' | 'analyze-prompt' | 'analyzing' | 'expand-prompt' | 'expanding' | 'error'
	const [showStreamingModal, setShowStreamingModal] = useState(false);
	const [selectedFile, setSelectedFile] = useState(null);
	const [useResearch, setUseResearch] = useState(false);
	const [numTasks, setNumTasks] = useState('');
	const [parseResult, setParseResult] = useState(null);
	const [analyzeResult, setAnalyzeResult] = useState(null);
	const [error, setError] = useState(null);

	// Handle file selection from browser
	const handleFileSelect = (filePath) => {
		setSelectedFile(filePath);
		// First ask about research
		setStep('research-prompt');
		logger.info('PRD file selected', { filePath });
	};

	// Handle research option selection
	const handleResearchPrompt = (shouldUseResearch) => {
		setUseResearch(shouldUseResearch);
		// Then ask about number of tasks
		setStep('num-tasks-prompt');
	};

	// Handle number of tasks submission
	const handleNumTasksSubmit = async (value) => {
		// Parse the number if provided, otherwise use undefined for default
		let parsedNum = undefined;
		if (value && value.trim() !== '') {
			const num = parseInt(value, 10);
			if (!Number.isNaN(num) && num > 0) {
				parsedNum = num;
			}
		}

		// Check if there are existing tasks in the current tag
		try {
			const taskList = await backend.listTasks({ tag: currentTag });
			if (taskList.tasks && taskList.tasks.length > 0) {
				// There are existing tasks, ask for confirmation
				setStep('confirm-overwrite');
				return;
			}
		} catch (err) {
			// If we can't check tasks, proceed anyway
		}

		// No existing tasks, proceed directly to parsing
		await performParsing(selectedFile, false, parsedNum);
	};

	// Handle parsing with force option
	const performParsing = async (
		filePath,
		force = false,
		taskCount = undefined
	) => {
		setShowStreamingModal(true);
		setError(null);

		logger.info('Starting PRD parsing', { 
			filePath, 
			force, 
			useResearch, 
			taskCount,
			currentTag 
		});

		try {
			// Use streaming state manager for parsing
			const result = await streamingStateManager.startOperation('parse_prd', {
				execute: async (signal, callbacks) => {
					// Simulate thinking messages during parsing
					let thinkingIndex = 0;
					const config = streamingStateManager.getOperationConfig('parse_prd');

					const thinkingInterval = setInterval(() => {
						if (config.thinkingMessages?.[thinkingIndex]) {
							callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
							thinkingIndex =
								(thinkingIndex + 1) % config.thinkingMessages.length;
						}
					}, 2000);

					try {
						// Execute the actual parsing
						const parseResult = await backend.parsePRD(filePath, {
							tag: currentTag,
							force: force,
							research: useResearch,
							numTasks: taskCount
						});

						clearInterval(thinkingInterval);
						return parseResult;
					} catch (error) {
						clearInterval(thinkingInterval);
						throw error;
					}
				}
			});

			setParseResult(result);
			logger.success('PRD parsing completed', { 
				tasksCreated: result?.tasksCreated,
				tag: currentTag 
			});
			await reloadTasks();
			setShowStreamingModal(false);
			setStep('success');
		} catch (err) {
			setShowStreamingModal(false);
			if (err.message !== 'Operation cancelled') {
				logger.error('PRD parsing failed', { error: err.message });
				setError(err.message);
				setStep('error');
			} else {
				// User cancelled, go back to file selection
				logger.info('PRD parsing cancelled by user');
				setStep('file-browser');
			}
		}
	};

	// Handle overwrite confirmation
	const handleOverwriteConfirmation = async (shouldOverwrite) => {
		if (shouldOverwrite) {
			// Parse the number again when confirming overwrite
			let parsedNum = undefined;
			if (numTasks && numTasks.trim() !== '') {
				const num = parseInt(numTasks, 10);
				if (!Number.isNaN(num) && num > 0) {
					parsedNum = num;
				}
			}
			await performParsing(selectedFile, true, parsedNum); // force = true
		} else {
			setCurrentScreen('welcome');
		}
	};

	// Handle analyze prompt response
	const handleAnalyzeResponse = async (shouldAnalyze) => {
		if (!shouldAnalyze) {
			setCurrentScreen('welcome');
			showToast(`✓ Parsed PRD successfully!`);
			return;
		}

		setShowStreamingModal(true);
		setError(null);

		try {
			// Use streaming state manager for analysis
			const result = await streamingStateManager.startOperation(
				'analyze_complexity',
				{
					execute: async (signal, callbacks) => {
						// Simulate thinking messages during analysis
						let thinkingIndex = 0;
						const config =
							streamingStateManager.getOperationConfig('analyze_complexity');

						const thinkingInterval = setInterval(() => {
							if (config.thinkingMessages?.[thinkingIndex]) {
								callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
								thinkingIndex =
									(thinkingIndex + 1) % config.thinkingMessages.length;
							}
						}, 2000);

						try {
							// Execute the actual analysis
							const analysisResult = await backend.analyzeComplexity({
								tag: currentTag,
								research: false // Default to no research for post-parse analysis
							});

							clearInterval(thinkingInterval);
							return analysisResult;
						} catch (error) {
							clearInterval(thinkingInterval);
							throw error;
						}
					}
				}
			);

			setAnalyzeResult(result);
			setShowStreamingModal(false);
			setStep('expand-prompt');
		} catch (err) {
			setShowStreamingModal(false);
			if (err.message !== 'Operation cancelled') {
				setError(err.message);
				setCurrentScreen('welcome');
				showToast(
					`✓ Parsed PRD successfully! (Analysis failed: ${err.message})`
				);
			} else {
				// User cancelled, go back to success step
				setStep('success');
			}
		}
	};

	// Handle expand prompt response
	const handleExpandResponse = async (expandOption) => {
		if (expandOption === 'none') {
			setCurrentScreen('welcome');
			showToast(`✓ Parse and analysis complete!`);
			return;
		}

		setShowStreamingModal(true);

		try {
			if (expandOption === 'all') {
				// Use streaming state manager for expand all
				await streamingStateManager.startOperation('expand_all', {
					execute: async (signal, callbacks) => {
						// Simulate thinking messages during expansion
						let thinkingIndex = 0;
						const config =
							streamingStateManager.getOperationConfig('expand_all');

						const thinkingInterval = setInterval(() => {
							if (config.thinkingMessages?.[thinkingIndex]) {
								callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
								thinkingIndex =
									(thinkingIndex + 1) % config.thinkingMessages.length;
							}
						}, 2000);

						try {
							const expandResult = await backend.expandAll({
								tag: currentTag,
								research: false
							});

							clearInterval(thinkingInterval);
							return expandResult;
						} catch (error) {
							clearInterval(thinkingInterval);
							throw error;
						}
					}
				});
				showToast(`✓ Expanded all high-complexity tasks!`);
			} else if (expandOption === 'first') {
				// Find first high-complexity task and expand it
				const highComplexityTasks =
					analyzeResult?.recommendations?.filter((r) => r.shouldExpand) || [];
				if (highComplexityTasks.length > 0) {
					// Use streaming state manager for single task expansion
					await streamingStateManager.startOperation('expand_task', {
						execute: async (signal, callbacks) => {
							// Simulate thinking messages during expansion
							let thinkingIndex = 0;
							const config =
								streamingStateManager.getOperationConfig('expand_task');

							const thinkingInterval = setInterval(() => {
								if (config.thinkingMessages?.[thinkingIndex]) {
									callbacks.onThinking(config.thinkingMessages[thinkingIndex]);
									thinkingIndex =
										(thinkingIndex + 1) % config.thinkingMessages.length;
								}
							}, 2000);

							try {
								const expandResult = await backend.expandTask(
									highComplexityTasks[0].taskId,
									{
										research: false
									}
								);

								clearInterval(thinkingInterval);
								return expandResult;
							} catch (error) {
								clearInterval(thinkingInterval);
								throw error;
							}
						}
					});
					showToast(`✓ Expanded task ${highComplexityTasks[0].taskId}!`);
				}
			}

			await reloadTasks();
			setShowStreamingModal(false);
			setCurrentScreen('welcome');
		} catch (err) {
			setShowStreamingModal(false);
			if (err.message !== 'Operation cancelled') {
				setError(err.message);
				setCurrentScreen('welcome');
				showToast(`✓ Parse complete! (Expand failed: ${err.message})`);
			} else {
				// User cancelled, go back to expand prompt
				setStep('expand-prompt');
			}
		}
	};

	// Handle keyboard input for prompts
	useInput((input, key) => {
		// During streaming operations, keyboard input is handled by StreamingModal
		if (showStreamingModal) {
			return;
		}

		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		if (step === 'error') {
			if (key.return || key.escape) {
				setCurrentScreen('welcome');
			}
			return;
		}

		// Note: confirmation prompts are now handled by ConfirmInput components
		// Only handle non-confirmation steps here

		if (step === 'num-tasks-prompt') {
			// Input is handled by TextInput component
			return;
		}

		if (step === 'expand-prompt') {
			if (input === 'a' || input === 'A') {
				handleExpandResponse('all');
			} else if (input === 'f' || input === 'F') {
				handleExpandResponse('first');
			} else if (input === 'n' || input === 'N') {
				handleExpandResponse('none');
			}
		}
	});

	// PRD file filter
	const prdFileFilter = (filename) => {
		const ext = filename.toLowerCase();
		return (
			ext.endsWith('.txt') ||
			ext.endsWith('.md') ||
			ext.endsWith('.prd') ||
			ext.includes('prd') ||
			ext.includes('requirement')
		);
	};

	if (step === 'file-browser') {
		return (
			<FileOperationErrorBoundary operation="browse PRD files">
				<FileBrowser
					title="Select PRD File"
					fileFilter={prdFileFilter}
					onSelect={handleFileSelect}
					onCancel={() => setCurrentScreen('welcome')}
				/>
			</FileOperationErrorBoundary>
		);
	}

	return (
		<AsyncErrorBoundary onRetry={() => setStep('file-browser')}>
		<Box flexDirection="column" height="100%">
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
					<Text color={theme.text}>Parse PRD</Text>
				</Box>
				<Text color={theme.textDim}>[ESC cancel]</Text>
			</Box>

			{/* Content */}
			<Box
				flexGrow={1}
				flexDirection="column"
				justifyContent="center"
				alignItems="center"
			>
				{step === 'research-prompt' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.accent}>🔍 Research Option</Text>
						<Text color={theme.text} marginTop={1}>
							Selected file: {selectedFile}
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							Would you like to use AI research while parsing?
						</Text>
						<Text color={theme.textDim}>
							This provides more accurate task generation but takes longer.
						</Text>
						<Box marginTop={2}>
							<ConfirmInput
								message="Use research?"
								onConfirm={() => handleResearchPrompt(true)}
								onCancel={() => handleResearchPrompt(false)}
							/>
						</Box>
					</Box>
				)}

				{step === 'num-tasks-prompt' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.accent}>📊 Number of Tasks</Text>
						<Text color={theme.text} marginTop={1}>
							How many tasks should be generated from this PRD?
						</Text>
						<Text color={theme.textDim}>
							Leave empty for default (10 tasks)
						</Text>
						<Box marginTop={2}>
							<Text color={theme.text}>Number of tasks: </Text>
							<TextInput
								value={numTasks}
								onChange={setNumTasks}
								onSubmit={handleNumTasksSubmit}
								placeholder="10"
							/>
						</Box>
						<Text color={theme.textDim} marginTop={1}>
							Press Enter to continue or ESC to cancel
						</Text>
					</Box>
				)}

				{step === 'confirm-overwrite' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.warning}>⚠️ Existing Tasks Found</Text>
						<Text color={theme.text} marginTop={1}>
							Tag '{currentTag}' already contains tasks.
						</Text>
						<Text color={theme.textDim} marginTop={1}>
							File: {selectedFile}
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							Parsing this PRD will overwrite all existing tasks in this tag.
						</Text>
						<Box marginTop={2}>
							<ConfirmInput
								message="Do you want to continue?"
								onConfirm={() => handleOverwriteConfirmation(true)}
								onCancel={() => handleOverwriteConfirmation(false)}
							/>
						</Box>
					</Box>
				)}

				{step === 'success' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.success}>✓ PRD parsed successfully!</Text>
						<Text color={theme.text} marginTop={1}>
							Generated tasks in tag '{currentTag}'
						</Text>
						<Text color={theme.textDim}>
							Using {useResearch ? 'research mode' : 'standard mode'} with{' '}
							{numTasks && numTasks.trim() !== ''
								? `${numTasks} tasks`
								: 'default (10 tasks)'}
						</Text>
						{parseResult?.message && (
							<Text color={theme.textDim} marginTop={1}>
								{parseResult.message}
							</Text>
						)}
						<Box marginTop={2}>
							<ConfirmInput
								message="Would you like to analyze task complexity?"
								onConfirm={() => setStep('analyze-prompt')}
								onCancel={() => {
									setCurrentScreen('welcome');
									showToast(`✓ Parsed PRD successfully!`);
								}}
							/>
						</Box>
					</Box>
				)}

				{step === 'analyze-prompt' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.accent}>🔍 Analyze Complexity</Text>
						<Text color={theme.text} marginTop={1}>
							This will identify tasks that should be broken down further.
						</Text>
						<Box marginTop={2}>
							<ConfirmInput
								message="Proceed with complexity analysis?"
								onConfirm={() => handleAnalyzeResponse(true)}
								onCancel={() => handleAnalyzeResponse(false)}
							/>
						</Box>
					</Box>
				)}

				{step === 'expand-prompt' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.success}>✓ Complexity analysis complete!</Text>
						<Text color={theme.text} marginTop={1}>
							Found{' '}
							{analyzeResult?.recommendations?.filter((r) => r.shouldExpand)
								.length || 0}{' '}
							tasks that should be expanded
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							Expand tasks now?
						</Text>
						<Text color={theme.text} marginTop={1}>
							(a) All high-complexity tasks
						</Text>
						<Text color={theme.text}>(f) First task only</Text>
						<Text color={theme.text}>(n) No, finish here</Text>
					</Box>
				)}

				{step === 'error' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.error}>✗ Error: {error}</Text>
						<Text color={theme.textDim} marginTop={1}>
							File: {selectedFile}
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							Press Enter or ESC to go back
						</Text>
					</Box>
				)}
			</Box>

			{/* Streaming Modal */}
			<StreamingModal
				isOpen={showStreamingModal}
				onClose={() => setShowStreamingModal(false)}
			/>
		</Box>
		</AsyncErrorBoundary>
	);
}
