import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { BaseModal } from './BaseModal.jsx';
import { useKeypress } from '../hooks/useKeypress.js';
import { useComponentTheme } from '../hooks/useTheme.js';
import { streamingStateManager } from '../streaming/StreamingStateManager.js';

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
	const { theme } = useComponentTheme('modal');

	// If state is idle but modal is open, show waiting state
	const effectiveState = state.state === 'idle' && isOpen ? 'preparing' : state.state;
	const effectiveMessage = state.state === 'idle' && isOpen ? 'Initializing...' : state.message;

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

	// Handle keyboard input
	const handlers = {
		escape: () => {
			if (state.canCancel) {
				handleCancel();
			} else if (['completed', 'cancelled', 'error'].includes(state.state)) {
				handleClose();
			}
		},
		return: () => {
			if (['completed', 'cancelled', 'error'].includes(state.state)) {
				handleClose();
			}
		}
	};

	useKeypress(isOpen ? handlers : {});

	// Animate dots for loading effect
	useEffect(() => {
		const currentState = state.state === 'idle' && isOpen ? 'preparing' : state.state;
		if (!['preparing', 'processing'].includes(currentState)) return;

		const interval = setInterval(() => {
			setDots(prev => {
				if (prev.length >= 3) return '';
				return prev + '.';
			});
		}, 500);

		return () => clearInterval(interval);
	}, [state.state, isOpen]);

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

	if (!isOpen) return null;

	const getStateIcon = () => {
		switch (effectiveState) {
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

	const getModalPreset = () => {
		switch (effectiveState) {
			case 'completed':
				return 'success';
			case 'cancelled':
				return 'warning';
			case 'error':
				return 'error';
			default:
				return 'info';
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

	const isInProgress = ['preparing', 'processing'].includes(effectiveState);
	const isComplete = ['completed', 'cancelled', 'error'].includes(effectiveState);

	const modalTitle = `${getStateIcon()} ${getOperationTitle()}${
		state.formattedElapsedTime !== '0s' ? ` • ${state.formattedElapsedTime}` : ''
	}`;

	return (
		<BaseModal
			title={modalTitle}
			onClose={handleClose}
			width="80%"
			height="auto"
			preset={getModalPreset()}
			showCloseHint={false} // We'll show custom hints
		>
			<Box flexDirection="column">
				{/* Progress Indicator */}
				{isInProgress && (
					<Box flexDirection="column" marginBottom={2}>
						{/* Current Phase */}
						{state.currentPhase && (
							<Text color={theme.textDim}>
								Phase: {state.currentPhase.charAt(0).toUpperCase() + state.currentPhase.slice(1)}
							</Text>
						)}

						{/* Main Message */}
						<Text color={theme.text}>
							{effectiveMessage}{dots}
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
					<Box flexDirection="column" marginBottom={2}>
						<Text color={theme.text}>
							{effectiveMessage}
						</Text>
						{effectiveState === 'error' && state.context.error && (
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
							Operation {effectiveState} • [Enter/ESC] Close
						</Text>
					)}
				</Box>
			</Box>
		</BaseModal>
	);
} 