import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';
import { FileBrowser } from './FileBrowser.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';

export function ParsePRDScreen() {
	const { backend, currentTag, setCurrentScreen, showToast, reloadTasks } =
		useAppContext();
	const [step, setStep] = useState('file-browser'); // 'file-browser' | 'research-prompt' | 'num-tasks-prompt' | 'confirm-overwrite' | 'parsing' | 'success' | 'analyze-prompt' | 'analyzing' | 'expand-prompt' | 'expanding' | 'error'
	const [selectedFile, setSelectedFile] = useState(null);
	const [useResearch, setUseResearch] = useState(false);
	const [numTasks, setNumTasks] = useState('');
	const [parseResult, setParseResult] = useState(null);
	const [analyzeResult, setAnalyzeResult] = useState(null);
	const [error, setError] = useState(null);
	const [expandingMessage, setExpandingMessage] = useState('');

	// Handle file selection from browser
	const handleFileSelect = (filePath) => {
		setSelectedFile(filePath);
		// First ask about research
		setStep('research-prompt');
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
			if (!isNaN(num) && num > 0) {
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
		setStep('parsing');
		setError(null);

		try {
			// Parse the PRD with all options
			const result = await backend.parsePRD(filePath, {
				tag: currentTag,
				force: force,
				research: useResearch,
				numTasks: taskCount
			});

			setParseResult(result);
			await reloadTasks();
			setStep('success');
		} catch (err) {
			setError(err.message);
			setStep('error');
		}
	};

	// Handle overwrite confirmation
	const handleOverwriteConfirmation = async (shouldOverwrite) => {
		if (shouldOverwrite) {
			// Parse the number again when confirming overwrite
			let parsedNum = undefined;
			if (numTasks && numTasks.trim() !== '') {
				const num = parseInt(numTasks, 10);
				if (!isNaN(num) && num > 0) {
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

		setStep('analyzing');
		setError(null);

		try {
			const result = await backend.analyzeComplexity({
				tag: currentTag,
				research: false // Default to no research for post-parse analysis
			});

			setAnalyzeResult(result);
			setStep('expand-prompt');
		} catch (err) {
			setError(err.message);
			setCurrentScreen('welcome');
			showToast(`✓ Parsed PRD successfully! (Analysis failed: ${err.message})`);
		}
	};

	// Handle expand prompt response
	const handleExpandResponse = async (expandOption) => {
		if (expandOption === 'none') {
			setCurrentScreen('welcome');
			showToast(`✓ Parse and analysis complete!`);
			return;
		}

		setStep('expanding');

		try {
			if (expandOption === 'all') {
				setExpandingMessage('Expanding all high-complexity tasks...');
				await backend.expandAll({
					tag: currentTag,
					research: false
				});
				showToast(`✓ Expanded all high-complexity tasks!`);
			} else if (expandOption === 'first') {
				// Find first high-complexity task and expand it
				const highComplexityTasks =
					analyzeResult?.recommendations?.filter((r) => r.shouldExpand) || [];
				if (highComplexityTasks.length > 0) {
					setExpandingMessage(
						`Expanding task ${highComplexityTasks[0].taskId}...`
					);
					await backend.expandTask(highComplexityTasks[0].taskId, {
						research: false
					});
					showToast(`✓ Expanded task ${highComplexityTasks[0].taskId}!`);
				}
			}

			await reloadTasks();
			setCurrentScreen('welcome');
		} catch (err) {
			setError(err.message);
			setCurrentScreen('welcome');
			showToast(`✓ Parse complete! (Expand failed: ${err.message})`);
		}
	};

	// Handle keyboard input for prompts
	useInput((input, key) => {
		// During long-running operations, only allow Ctrl+X to cancel
		if (step === 'parsing' || step === 'analyzing' || step === 'expanding') {
			if (key.ctrl && input === 'x') {
				setStep('error');
				setError('Operation cancelled by user');
				return;
			}
			// Ignore all other keys during operations
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

		if (step === 'research-prompt') {
			if (input === 'y' || input === 'Y') {
				handleResearchPrompt(true);
			} else if (input === 'n' || input === 'N') {
				handleResearchPrompt(false);
			}
			return;
		}

		if (step === 'num-tasks-prompt') {
			// Input is handled by TextInput component
			return;
		}

		if (step === 'confirm-overwrite') {
			if (input === 'y' || input === 'Y') {
				handleOverwriteConfirmation(true);
			} else if (input === 'n' || input === 'N') {
				handleOverwriteConfirmation(false);
			}
			return;
		}

		if (step === 'success') {
			if (input === 'y' || input === 'Y') {
				setStep('analyze-prompt');
			} else if (input === 'n' || input === 'N') {
				setCurrentScreen('welcome');
				showToast(`✓ Parsed PRD successfully!`);
			}
		} else if (step === 'analyze-prompt') {
			if (input === 'y' || input === 'Y') {
				handleAnalyzeResponse(true);
			} else if (input === 'n' || input === 'N') {
				handleAnalyzeResponse(false);
			}
		} else if (step === 'expand-prompt') {
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
			<FileBrowser
				title="Select PRD File"
				fileFilter={prdFileFilter}
				onSelect={handleFileSelect}
				onCancel={() => setCurrentScreen('welcome')}
			/>
		);
	}

	return (
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
				{step === 'parsing' || step === 'analyzing' || step === 'expanding' ? (
					<Text color={theme.warning}>[Ctrl+X cancel]</Text>
				) : (
					<Text color={theme.textDim}>[ESC cancel]</Text>
				)}
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
						<Text color={theme.text} marginTop={2}>
							Use research? (y/n)
						</Text>
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
						<Text color={theme.text} marginTop={2}>
							Do you want to continue? (y/n)
						</Text>
					</Box>
				)}

				{step === 'parsing' && (
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner message="Parsing PRD..." type="parse" />
						<Text color={theme.textDim} marginTop={1}>
							File: {selectedFile}
						</Text>
						<Text color={theme.textDim}>Target tag: {currentTag}</Text>
						<Text color={theme.textDim}>
							Research: {useResearch ? 'Yes' : 'No'}
						</Text>
						<Text color={theme.textDim}>
							Tasks:{' '}
							{numTasks && numTasks.trim() !== ''
								? `${numTasks} tasks`
								: 'Default (10 tasks)'}
						</Text>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
						</Text>
					</Box>
				)}

				{step === 'analyzing' && (
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner
							message="Analyzing task complexity..."
							type="analyze"
						/>
						<Text color={theme.textDim} marginTop={1}>
							This may take a moment...
						</Text>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
						</Text>
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
						<Text color={theme.textDim} marginTop={2}>
							Would you like to analyze task complexity? (y/n)
						</Text>
					</Box>
				)}

				{step === 'analyze-prompt' && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.accent}>🔍 Analyze Complexity</Text>
						<Text color={theme.text} marginTop={1}>
							This will identify tasks that should be broken down further.
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							Proceed with complexity analysis? (y/n)
						</Text>
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

				{step === 'expanding' && (
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner message={expandingMessage} type="expand" />
						<Text color={theme.textDim} marginTop={1}>
							Expanding tasks...
						</Text>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
						</Text>
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
		</Box>
	);
}
