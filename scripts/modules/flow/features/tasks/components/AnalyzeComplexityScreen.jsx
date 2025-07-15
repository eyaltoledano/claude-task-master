import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfirmInput } from '@inkjs/ui';
import { style, gradient } from '../../../theme.js';
import { useAppContext } from '../../../app/index-root.jsx';
import { LoadingSpinner } from '../../../shared/components/ui/LoadingSpinner.jsx';
import { StreamingModal } from '../../../components/StreamingModal.jsx';
import { OverflowableText, OverflowIndicator } from '../../ui';
import { streamingStateManager } from '../../../infra/streaming/StreamingStateManager.js';

export function AnalyzeComplexityScreen() {
	const { backend, setCurrentScreen, showToast, currentScreen } =
		useAppContext();
	const [state, setState] = useState({
		status: 'idle', // idle, analyzing, completed, error
		error: null,
		report: null,
		response: '',
		hasReport: false,
		expandOption: null // null, 'y', 'f', 'n'
	});
	const [showStreamingModal, setShowStreamingModal] = useState(false);

	// Load existing report on mount
	useEffect(() => {
		loadExistingReport();
	}, []);

	const loadExistingReport = async () => {
		try {
			const result = await backend.complexityReport();
			if (result.report) {
				setState((prev) => ({
					...prev,
					hasReport: true,
					report: result.report
				}));
			}
		} catch (error) {
			// No existing report, that's okay
		}
	};

	const runAnalysis = async () => {
		try {
			setShowStreamingModal(true);
			setState((prev) => ({ ...prev, error: null }));

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
								research: true
							});

							clearInterval(thinkingInterval);

							if (!analysisResult || !analysisResult.report) {
								throw new Error('No report data received');
							}

							return analysisResult;
						} catch (error) {
							clearInterval(thinkingInterval);
							throw error;
						}
					}
				}
			);

			setShowStreamingModal(false);
			setState((prev) => ({
				...prev,
				status: 'completed',
				report: result.report,
				hasReport: true
			}));
		} catch (error) {
			setShowStreamingModal(false);
			if (error.message !== 'Operation cancelled') {
				setState((prev) => ({
					...prev,
					status: 'error',
					error: error.message || 'Analysis failed'
				}));
			} else {
				// User cancelled, stay in idle state
				setState((prev) => ({ ...prev, status: 'idle' }));
			}
		}
	};

	const expandTasks = async (option) => {
		try {
			setShowStreamingModal(true);

			if (option === 'y') {
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
								research: true
							});

							clearInterval(thinkingInterval);
							return expandResult;
						} catch (error) {
							clearInterval(thinkingInterval);
							throw error;
						}
					}
				});
				showToast('All recommended tasks expanded successfully!', 'success');
			} else if (option === 'f') {
				// Get first recommended task and expand it
				const recommended = state.report.recommendations.filter(
					(t) => t.shouldExpand
				);
				if (recommended.length > 0) {
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
								const expandResult = await backend.expandTask({
									id: recommended[0].id,
									research: true
								});

								clearInterval(thinkingInterval);
								return expandResult;
							} catch (error) {
								clearInterval(thinkingInterval);
								throw error;
							}
						}
					});
					showToast(
						`Task ${recommended[0].id} expanded successfully!`,
						'success'
					);
				}
			}

			setShowStreamingModal(false);
			setCurrentScreen('welcome');
		} catch (error) {
			setShowStreamingModal(false);
			if (error.message !== 'Operation cancelled') {
				setState((prev) => ({
					...prev,
					status: 'error',
					error: error.message || 'Expansion failed'
				}));
			} else {
				// User cancelled, stay in completed state
				setState((prev) => ({ ...prev, expandOption: null }));
			}
		}
	};

	useInput((input, key) => {
		// Only handle input if this screen is active
		if (currentScreen !== 'analyze') return;

		// During streaming operations, keyboard input is handled by StreamingModal
		if (showStreamingModal) {
			return;
		}

		if (state.status === 'idle' || state.status === 'error') {
			if (key.escape || (key.ctrl && input === 'x')) {
				setCurrentScreen('welcome');
				return;
			}

			if (state.hasReport && (input === 'v' || input === 'V')) {
				setState((prev) => ({ ...prev, status: 'completed' }));
				return;
			}

			if (input === 'r' || input === 'R' || key.return) {
				runAnalysis();
				return;
			}
		}

		if (state.status === 'completed') {
			if (key.escape) {
				setState((prev) => ({ ...prev, status: 'idle' }));
				return;
			}

			if (input === 'y' || input === 'Y') {
				setState((prev) => ({ ...prev, expandOption: 'y' }));
				expandTasks('y');
				return;
			}

			if (input === 'f' || input === 'F') {
				setState((prev) => ({ ...prev, expandOption: 'f' }));
				expandTasks('f');
				return;
			}

			if (input === 'n' || input === 'N') {
				setCurrentScreen('welcome');
				return;
			}
		}
	});

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={style('', 'border.primary')}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text>{style('Task Master', 'accent')}</Text>
					<Text>{style(' › ', 'text.secondary')}</Text>
					<Text>{style('Analyze Complexity', 'text.primary')}</Text>
				</Box>
				{state.status === 'idle' && (
					<Text>{style('[Ctrl+X cancel]', 'state.warning.primary')}</Text>
				)}
				{state.status !== 'idle' && (
					<Text>{style('[ESC cancel]', 'text.secondary')}</Text>
				)}
			</Box>

			{/* Content */}
			<Box flexGrow={1} paddingLeft={1} paddingRight={1}>
				{state.status === 'idle' && (
					<Box flexDirection="column">
						<Box marginBottom={1}>
							<Text>
								{gradient('🔍 Analyze Task Complexity', ['primary', 'accent'])}
							</Text>
						</Box>
						<Text>{style('This analysis will:', 'text.primary')}</Text>
						<Box marginTop={1} paddingLeft={2} flexDirection="column">
							<Text>
								{style("• Evaluate each task's complexity", 'text.secondary')}
							</Text>
							<Text>
								{style(
									'• Identify tasks that need expansion',
									'text.secondary'
								)}
							</Text>
							<Text>
								{style(
									'• Generate expansion recommendations',
									'text.secondary'
								)}
							</Text>
							<Text>
								{style('• Use AI research for accuracy', 'text.secondary')}
							</Text>
						</Box>

						{state.error && (
							<Text marginTop={2}>
								{style(`Error: ${state.error}`, 'state.error.primary')}
							</Text>
						)}

						{state.hasReport && (
							<Text marginTop={1}>
								{style('💡 An existing report was found.', 'text.secondary')}
							</Text>
						)}

						<Box marginTop={2} flexDirection="column" gap={1}>
							<Text>{style('Options:', 'text.primary')}</Text>
							<Box paddingLeft={2} flexDirection="column">
								{state.hasReport && (
									<Text>
										{style('(v) View existing report', 'text.secondary')}
									</Text>
								)}
								<Text>{style('(r) Run new analysis', 'text.secondary')}</Text>
								<Text>{style('(ESC) Cancel', 'text.secondary')}</Text>
							</Box>
						</Box>

						<Text marginTop={2}>
							{style('Press a key to continue...', 'text.tertiary')}
						</Text>
					</Box>
				)}

				{state.status === 'completed' && state.report && (
					<Box flexDirection="column">
						<Text>
							{style(
								'✓ Complexity analysis complete!',
								'state.success.primary'
							)}
						</Text>
						<Text marginTop={1}>
							{style(
								`Analyzed ${state.report.totalTasks} tasks`,
								'text.primary'
							)}
						</Text>

						{/* Summary */}
						<Box marginTop={2} flexDirection="column">
							<Text>{style('Summary:', 'accent')}</Text>
							<Box paddingLeft={2} marginTop={1} flexDirection="column">
								<Text>
									{style(
										`• Tasks needing expansion: ${state.report.tasksNeedingExpansion}`,
										'text.secondary'
									)}
								</Text>
								<Text>
									{style(
										`• Average complexity: ${state.report.averageComplexity.toFixed(1)}/10`,
										'text.secondary'
									)}
								</Text>
								<Text>
									{style(
										`• Highest complexity: ${state.report.highestComplexity}/10`,
										'text.secondary'
									)}
								</Text>
							</Box>
						</Box>

						{/* Next steps */}
						<Text marginTop={2}>
							{style('What would you like to do?', 'text.primary')}
						</Text>
						<Box paddingLeft={2} marginTop={1} flexDirection="column">
							<Text>
								{style('(y) Expand all recommended tasks', 'text.primary')}
							</Text>
							<Text>{style('(f) First task only', 'text.primary')}</Text>
							<Text>{style('(n) No, finish here', 'text.primary')}</Text>
						</Box>

						{state.expandOption && (
							<Box marginTop={2}>
								<LoadingSpinner
									message={
										state.expandOption === 'y'
											? 'Expanding all recommended tasks...'
											: 'Expanding first task...'
									}
								/>
							</Box>
						)}

						<Text marginTop={1}>
							{style(
								'(You can run `task-master complexity-report` later to view details)',
								'text.tertiary'
							)}
						</Text>

						<Text marginTop={2}>
							{style('Press a key to continue...', 'text.tertiary')}
						</Text>
					</Box>
				)}

				{state.status === 'error' && (
					<Box flexDirection="column" justifyContent="center" height="100%">
						<Box justifyContent="center">
							<Text>
								{style(`✗ Error: ${state.error}`, 'state.error.primary')}
							</Text>
						</Box>
						<Box justifyContent="center" marginTop={1}>
							<Text>{style('Press ESC to go back', 'text.secondary')}</Text>
						</Box>
					</Box>
				)}
			</Box>

			{/* Streaming Modal */}
			<StreamingModal
				isOpen={showStreamingModal}
				onClose={() => setShowStreamingModal(false)}
			/>

			{/* Overflow Indicator */}
			<OverflowIndicator position="bottom-right" showCount={false} symbol="⋯" />
		</Box>
	);
}
