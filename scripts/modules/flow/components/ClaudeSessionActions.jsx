import React from 'react';
import { Box, Text } from 'ink';
import {
	useComponentTheme,
	useTerminalSize,
	useKeypress
} from '../shared/hooks/index.js';

export function ClaudeSessionActions({
	mode = 'list',
	config = null,
	selectedSession = null,
	isProcessing = false,
	canAbort = false,
	onNewQuery,
	onResumeSession,
	onViewSession,
	onAbortQuery,
	onConfigUpdate,
	onBack,
	onShowMenu,
	showMenu = false
}) {
	const { theme } = useComponentTheme('claudeSessionActions');
	const { maxContentWidth, isNarrow } = useTerminalSize();

	// Keyboard handling for actions
	useKeypress(
		{
			n: () => {
				if (!isProcessing && onNewQuery) {
					onNewQuery();
				}
			},
			c: () => {
				if (!isProcessing && onConfigUpdate) {
					onConfigUpdate();
				}
			},
			m: () => {
				if (onShowMenu) {
					onShowMenu(!showMenu);
				}
			},
			q: () => {
				if (!isProcessing && onBack) {
					onBack();
				}
			}
		},
		{ isActive: mode === 'list' }
	);

	const renderModeActions = () => {
		if (mode === 'active-session') {
			return (
				<Box flexDirection={isNarrow ? 'column' : 'row'} gap={2}>
					{canAbort && isProcessing && (
						<Text color="red">[Ctrl+C] Abort Query</Text>
					)}
					<Text color={theme.text.secondary}>[Esc] Back to Sessions</Text>
				</Box>
			);
		}

		if (mode === 'list') {
			return (
				<Box flexDirection={isNarrow ? 'column' : 'row'} gap={isNarrow ? 0 : 2}>
					<Text color={theme.text.secondary}>[n] New Query</Text>
					<Text color={theme.text.secondary}>[c] Config</Text>
					<Text color={theme.text.secondary}>[m] Menu</Text>
					<Text color={theme.text.secondary}>[q] Back</Text>
				</Box>
			);
		}

		return null;
	};

	const renderSessionActions = () => {
		if (mode !== 'list' || !selectedSession) return null;

		return (
			<Box flexDirection="column" marginY={1}>
				<Text color={theme.accent} bold>
					Selected Session Actions:
				</Text>
				<Box
					flexDirection={isNarrow ? 'column' : 'row'}
					gap={isNarrow ? 0 : 2}
					marginTop={1}
				>
					<Text color={theme.text.secondary}>[Enter/r] Resume</Text>
					<Text color={theme.text.secondary}>[v] View Messages</Text>
					{selectedSession.metadata?.finished && (
						<Text color="green">[✓] Completed</Text>
					)}
					{selectedSession.metadata?.type === 'subtask-implementation' && (
						<Text color="yellow">[🔧] Subtask Session</Text>
					)}
				</Box>
			</Box>
		);
	};

	const renderConfigStatus = () => {
		if (!config) {
			return (
				<Box marginY={1}>
					<Text color="red">⚠️ No Claude Code configuration found</Text>
				</Box>
			);
		}

		const statusItems = [];

		if (config.permissionMode) {
			statusItems.push(`Mode: ${config.permissionMode}`);
		}

		if (config.allowedTools && config.allowedTools.length > 0) {
			statusItems.push(
				`Tools: ${config.allowedTools.slice(0, 3).join(', ')}${config.allowedTools.length > 3 ? '...' : ''}`
			);
		}

		if (config.defaultMaxTurns) {
			statusItems.push(`Max Turns: ${config.defaultMaxTurns}`);
		}

		return (
			<Box marginY={1}>
				<Text color={theme.text.tertiary}>
					Config:{' '}
					{statusItems.length > 0
						? statusItems.join(' • ')
						: 'Default settings'}
				</Text>
			</Box>
		);
	};

	const renderQuickMenu = () => {
		if (!showMenu) return null;

		const menuItems = [
			{
				key: 'n',
				label: 'Start New Query',
				action: onNewQuery,
				disabled: isProcessing
			},
			{
				key: 'r',
				label: 'Resume Selected',
				action: () =>
					selectedSession && onResumeSession?.(selectedSession.sessionId),
				disabled: !selectedSession || isProcessing
			},
			{
				key: 'v',
				label: 'View Messages',
				action: () => selectedSession && onViewSession?.(selectedSession),
				disabled: !selectedSession
			},
			{
				key: 'c',
				label: 'Update Config',
				action: onConfigUpdate,
				disabled: isProcessing
			},
			{
				key: 'q',
				label: 'Back to Main',
				action: onBack,
				disabled: isProcessing
			}
		];

		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.accent}
				padding={1}
				marginY={1}
			>
				<Text color={theme.accent} bold>
					Quick Actions Menu:
				</Text>
				{menuItems.map((item) => (
					<Box key={item.key} marginTop={1}>
						<Text
							color={item.disabled ? theme.text.tertiary : theme.text.secondary}
						>
							[{item.key}] {item.label}
							{item.disabled && ' (disabled)'}
						</Text>
					</Box>
				))}
				<Box marginTop={1}>
					<Text color={theme.text.tertiary}>Press [m] to close menu</Text>
				</Box>
			</Box>
		);
	};

	const renderProcessingIndicator = () => {
		if (!isProcessing) return null;

		return (
			<Box marginY={1}>
				<Text color={theme.accent}>🔄 Processing Claude Code query...</Text>
				{canAbort && (
					<Text color={theme.text.secondary}> (Press Ctrl+C to abort)</Text>
				)}
			</Box>
		);
	};

	const renderHelpText = () => {
		if (mode === 'active-session' || showMenu) return null;

		const tips = [
			'Use arrow keys to navigate sessions',
			'Sessions auto-save your conversations',
			'Subtask sessions (🔧) are linked to specific tasks'
		];

		return (
			<Box flexDirection="column" marginTop={2}>
				<Text color={theme.text.tertiary} bold>
					Tips:
				</Text>
				{tips.map((tip) => (
					<Box key={`tip-${tip.slice(0, 20)}`} marginTop={1}>
						<Text color={theme.text.tertiary}>• {tip}</Text>
					</Box>
				))}
			</Box>
		);
	};

	return (
		<Box flexDirection="column" width={maxContentWidth}>
			{/* Processing indicator */}
			{renderProcessingIndicator()}

			{/* Config status */}
			{renderConfigStatus()}

			{/* Session-specific actions */}
			{renderSessionActions()}

			{/* Quick menu */}
			{renderQuickMenu()}

			{/* Mode-specific actions */}
			<Box marginTop={1}>{renderModeActions()}</Box>

			{/* Help text */}
			{renderHelpText()}
		</Box>
	);
}
