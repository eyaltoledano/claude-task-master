import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { streamingStateManager } from '../streaming/StreamingStateManager.js';
import { theme } from '../theme.js';

export function StreamingModal({ isOpen, onClose }) {
	const [state, setState] = useState({
		state: 'idle',
		operation: null,
		message: '',
		context: {},
		elapsedTime: 0,
		formattedElapsedTime: '0s',
		currentPhase: '',
		phases: [],
		thinkingMessage: '',
		canCancel: false
	});

	const [thinkingIndex, setThinkingIndex] = useState(0);
	const [dots, setDots] = useState('');

	useEffect(() => {
		if (!isOpen) return;

		// Subscribe to state changes
		const handleStateChange = (newState) => {
			setState(newState);
		};

		streamingStateManager.onStateChange = handleStateChange;

		return () => {
			streamingStateManager.onStateChange = null;
		};
	}, [isOpen]);

	// Handle ESC key for cancellation
	useInput((input, key) => {
		if (!isOpen) return;
		
		if (key.escape && state.canCancel) {
			handleCancel();
		}

		if (key.escape && ['completed', 'cancelled', 'error'].includes(state.state)) {
			handleClose();
		}

		// Handle Enter for closing when complete
		if (key.return && ['completed', 'cancelled', 'error'].includes(state.state)) {
			handleClose();
		}
	}, { isActive: isOpen });

	// Animate dots for loading effect
	useEffect(() => {
		if (!['preparing', 'processing'].includes(state.state)) return;

		const interval = setInterval(() => {
			setDots(prev => {
				if (prev.length >= 3) return '';
				return prev + '.';
			});
		}, 500);

		return () => clearInterval(interval);
	}, [state.state]);

	// Cycle through thinking messages
	useEffect(() => {
		if (state.state !== 'processing' || !state.context.operationType) return;

		const config = streamingStateManager.getOperationConfig(state.context.operationType);
		if (!config.thinkingMessages?.length) return;

		const interval = setInterval(() => {
			setThinkingIndex(prev => (prev + 1) % config.thinkingMessages.length);
		}, 3000);

		return () => clearInterval(interval);
	}, [state.state, state.context.operationType]);

	const handleCancel = () => {
		if (state.canCancel) {
			streamingStateManager.cancel();
		}
	};

	const handleClose = () => {
		if (state.state === 'idle' || ['completed', 'cancelled', 'error'].includes(state.state)) {
			onClose();
		}
	};

	if (!isOpen || state.state === 'idle') return null;

	const getStateIcon = () => {
		switch (state.state) {
			case 'preparing':
				return '🔄';
			case 'processing':
				return '⚡';
			case 'completed':
				return '✅';
			case 'cancelled':
				return '⏹️';
			case 'error':
				return '❌';
			default:
				return '🔄';
		}
	};

	const getStateColor = () => {
		switch (state.state) {
			case 'preparing':
				return theme.accent;
			case 'processing':
				return theme.primary;
			case 'completed':
				return theme.success;
			case 'cancelled':
				return theme.warning;
			case 'error':
				return theme.error;
			default:
				return theme.accent;
		}
	};

	const getCurrentThinkingMessage = () => {
		if (state.state !== 'processing' || !state.context.operationType) return '';

		const config = streamingStateManager.getOperationConfig(state.context.operationType);
		if (!config.thinkingMessages?.length) return '';

		return config.thinkingMessages[thinkingIndex];
	};

	const getOperationTitle = () => {
		const titles = {
			parse_prd: 'Parsing PRD',
			analyze_complexity: 'Analyzing Complexity',
			expand_task: 'Expanding Task',
			expand_all: 'Expanding All Tasks'
		};
		return titles[state.operation] || 'Processing';
	};

	const isInProgress = ['preparing', 'processing'].includes(state.state);
	const isComplete = ['completed', 'cancelled', 'error'].includes(state.state);



	return (
		<Box
			flexDirection="column"
			borderStyle="double"
			borderColor={getStateColor()}
			padding={1}
			width="80%"
			alignSelf="center"
		>
			{/* Header */}
			<Box justifyContent="space-between" marginBottom={1}>
				<Box>
					<Text color={getStateColor()}>
						{getStateIcon()} {getOperationTitle()}
					</Text>
					{state.formattedElapsedTime !== '0s' && (
						<Text color={theme.textDim}> • {state.formattedElapsedTime}</Text>
					)}
				</Box>
				{isComplete && (
					<Text color={theme.textDim}>[Enter/ESC to close]</Text>
				)}
			</Box>

			{/* Progress Indicator */}
			{isInProgress && (
				<Box flexDirection="column" marginBottom={1}>
					{/* Current Phase */}
					{state.currentPhase && (
						<Text color={theme.textDim}>
							Phase: {state.currentPhase.charAt(0).toUpperCase() + state.currentPhase.slice(1)}
						</Text>
					)}

					{/* Main Message */}
					<Text color={theme.text}>
						{state.message}{dots}
					</Text>

					{/* Thinking Message */}
					{getCurrentThinkingMessage() && (
						<Text color={theme.textDim} italic>
							💭 {getCurrentThinkingMessage()}
						</Text>
					)}

					{/* Cancel Instructions */}
					{state.canCancel && (
						<Box marginTop={1}>
							<Text color={theme.warning}>
								Press ESC to cancel operation
							</Text>
						</Box>
					)}
				</Box>
			)}

			{/* Completion Message */}
			{isComplete && (
				<Box flexDirection="column" marginBottom={1}>
					<Text color={getStateColor()}>
						{state.message}
					</Text>
					{state.state === 'error' && state.context.error && (
						<Text color={theme.textDim}>
							Details: {state.context.error.message || 'Unknown error'}
						</Text>
					)}
				</Box>
			)}

			{/* Status Bar */}
			<Box
				borderStyle="single"
				borderTop
				borderColor={theme.border}
				paddingTop={1}
				justifyContent="center"
			>
				{isInProgress ? (
					<Text color={theme.textDim}>
						Operation in progress... {state.canCancel ? '[ESC] Cancel' : 'Please wait'}
					</Text>
				) : (
					<Text color={theme.textDim}>
						Operation {state.state} • Press Enter or ESC to continue
					</Text>
				)}
			</Box>
		</Box>
	);
} 