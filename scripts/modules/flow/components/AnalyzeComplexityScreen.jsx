import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';

export function AnalyzeComplexityScreen() {
	const {
		backend,
		currentTag,
		setCurrentScreen,
		showToast,
		reloadTasks,
		tasks
	} = useAppContext();
	const [step, setStep] = useState('research-prompt'); // 'research-prompt' | 'analyzing' | 'expand-prompt' | 'expanding'
	const [useResearch, setUseResearch] = useState(false);
	const [analyzeResult, setAnalyzeResult] = useState(null);
	const [error, setError] = useState(null);
	const [expandingMessage, setExpandingMessage] = useState('');

	// Handle research prompt response
	const handleResearchResponse = async (shouldUseResearch) => {
		setUseResearch(shouldUseResearch);
		setStep('analyzing');
		setError(null);

		try {
			const result = await backend.analyzeComplexity({
				tag: currentTag,
				research: shouldUseResearch
			});

			setAnalyzeResult(result);
			setStep('expand-prompt');
		} catch (err) {
			setError(err.message);
			// Don't immediately go back to welcome screen, show the error first
			setTimeout(() => {
				setCurrentScreen('welcome');
			}, 3000);
			showToast(`✗ Analysis failed: ${err.message}`);
		}
	};

	// Handle expand prompt response
	const handleExpandResponse = async (expandOption) => {
		if (expandOption === 'none') {
			setCurrentScreen('welcome');
			showToast(`✓ Complexity analysis complete!`);
			return;
		}

		setStep('expanding');
		
		try {
			if (expandOption === 'all') {
				setExpandingMessage('Expanding all high-complexity tasks...');
				await backend.expandAll({
					tag: currentTag,
					research: useResearch
				});
				showToast(`✓ Expanded all high-complexity tasks!`);
			} else if (expandOption === 'first') {
				// Find first high-complexity task and expand it
				const highComplexityTasks =
					analyzeResult?.recommendations?.filter((r) => r.shouldExpand) || [];
				if (highComplexityTasks.length > 0) {
					setExpandingMessage(`Expanding task ${highComplexityTasks[0].taskId}...`);
					await backend.expandTask(highComplexityTasks[0].taskId, {
						research: useResearch
					});
					showToast(`✓ Expanded task ${highComplexityTasks[0].taskId}!`);
				} else {
					showToast(`ℹ No high-complexity tasks found to expand.`);
				}
			}

			await reloadTasks();
			setCurrentScreen('welcome');
		} catch (err) {
			setError(err.message);
			setCurrentScreen('welcome');
			showToast(`✓ Analysis complete! (Expand failed: ${err.message})`);
		}
	};

	// Handle keyboard input
	useInput((input, key) => {
		// During long-running operations, only allow Ctrl+X to cancel
		if (step === 'analyzing' || step === 'expanding') {
			if (key.ctrl && input === 'x') {
				setError('Operation cancelled by user');
				setCurrentScreen('welcome');
				showToast('Operation cancelled');
				return;
			}
			// Ignore all other keys during operations
			return;
		}

		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		if (step === 'research-prompt') {
			// Don't proceed if no tasks
			if (tasks.length === 0) {
				if (key.escape) {
					setCurrentScreen('welcome');
				}
				return;
			}

			if (input === 'y' || input === 'Y') {
				handleResearchResponse(true);
			} else if (input === 'n' || input === 'N') {
				handleResearchResponse(false);
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
					<Text color={theme.text}>Analyze Complexity</Text>
				</Box>
				{step === 'analyzing' || step === 'expanding' ? (
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
						<Text color={theme.accent}>🔍 Analyze Task Complexity</Text>
						<Text color={theme.text} marginTop={1}>
							Tag: {currentTag} ({tasks.length} tasks)
						</Text>
						{tasks.length === 0 ? (
							<>
								<Text color={theme.error} marginTop={2}>
									No tasks found to analyze!
								</Text>
								<Text color={theme.textDim} marginTop={1}>
									Please parse a PRD first using /parse
								</Text>
							</>
						) : (
							<>
								<Text color={theme.textDim} marginTop={2}>
									Use research mode for more accurate analysis?
								</Text>
								<Text color={theme.textDim} marginTop={1}>
									(Research mode uses AI to gather additional context but takes
									longer)
								</Text>
								<Text color={theme.text} marginTop={2}>
									Use research mode? (y/n)
								</Text>
							</>
						)}
					</Box>
				)}

				{step === 'analyzing' && (
					<Box flexDirection="column" alignItems="center">
						<LoadingSpinner message="Analyzing task complexity..." type="analyze" />
						<Text color={theme.textDim} marginTop={1}>
							Tag: {currentTag}
						</Text>
						<Text color={theme.textDim}>
							Research mode: {useResearch ? 'enabled' : 'disabled'}
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							This may take a moment...
						</Text>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
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
						{analyzeResult?.summary && (
							<Box flexDirection="column" alignItems="center" marginTop={1}>
								<Text color={theme.textDim}>
									Average complexity:{' '}
									{analyzeResult.summary.averageComplexity?.toFixed(1) || 'N/A'}
								</Text>
								<Text color={theme.textDim}>
									High complexity tasks:{' '}
									{analyzeResult.summary.highComplexityCount || 0}
								</Text>
							</Box>
						)}
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
							Research mode: {useResearch ? 'enabled' : 'disabled'}
						</Text>
						<Text color={theme.textDim} marginTop={2}>
							This may take a moment...
						</Text>
						<Text color={theme.warning} marginTop={2}>
							Press Ctrl+X to cancel
						</Text>
					</Box>
				)}

				{error && (
					<Box flexDirection="column" alignItems="center">
						<Text color={theme.error}>✗ Error: {error}</Text>
						<Text color={theme.textDim} marginTop={1}>
							Press ESC to go back
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
