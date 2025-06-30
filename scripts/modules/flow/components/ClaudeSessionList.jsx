import React from 'react';
import { Box, Text, useInput } from 'ink';
import { SimpleTable } from './SimpleTable.jsx';
import { useComponentTheme, useStateAndRef } from '../hooks/index.js';
import { formatDistanceToNow } from 'date-fns';

export function ClaudeSessionList({
	sessions = [],
	runningOperations = [],
	filterSubtaskId = null,
	visibleRows = 15,
	config = null,
	// Callback props for actions
	onSessionSelect,
	onSessionResume,
	onSessionDetails,
	onNewSession,
	onRefresh,
	onBack,
	// Initial state
	initialSelectedIndex = 0,
	initialScrollOffset = 0,
	initialSessionFilter = 'all'
}) {
	const { theme: safeTheme } = useComponentTheme('claudeSessionList');

	// Self-contained state management
	const [selectedIndex, setSelectedIndex, selectedIndexRef] =
		useStateAndRef(initialSelectedIndex);
	const [scrollOffset, setScrollOffset, scrollOffsetRef] =
		useStateAndRef(initialScrollOffset);
	const [sessionFilter, setSessionFilter] =
		React.useState(initialSessionFilter);

	// Combine running operations with sessions
	const combinedItems = React.useMemo(() => {
		// Convert running operations to session-like objects
		const runningItems = runningOperations.map(op => ({
			sessionId: op.id,
			prompt: op.metadata?.prompt || 'Background operation',
			lastUpdated: op.startTime,
			metadata: {
				...op.metadata,
				type: op.metadata?.type || 'background',
				finished: false,
				isRunning: true,
				operationId: op.id
			},
			status: op.status,
			messages: op.messages || []
		}));

		// Combine and sort by date (newest first)
		return [...runningItems, ...sessions].sort((a, b) => 
			new Date(b.lastUpdated || b.createdAt) - new Date(a.lastUpdated || a.createdAt)
		);
	}, [sessions, runningOperations]);

	// Filter sessions based on current filter
	const filteredSessions = React.useMemo(() => {
		return combinedItems.filter((session) => {
			// First apply subtask filter if provided
			if (filterSubtaskId && session.metadata?.subtaskId !== filterSubtaskId) {
				return false;
			}

			if (sessionFilter === 'all') return true;
			if (sessionFilter === 'active') {
				// Active sessions are running operations or unfinished sessions
				return (
					session.metadata?.isRunning ||
					!session.metadata?.finished ||
					(session.lastUpdated &&
						new Date(session.lastUpdated) > new Date(Date.now() - 3600000))
				);
			}
			if (sessionFilter === 'finished') {
				return session.metadata?.finished === true && !session.metadata?.isRunning;
			}
			return true;
		});
	}, [combinedItems, filterSubtaskId, sessionFilter]);

	// Reset selection when filtered sessions change
	React.useEffect(() => {
		if (
			selectedIndex >= filteredSessions.length &&
			filteredSessions.length > 0
		) {
			setSelectedIndex(0);
			setScrollOffset(0);
		}
	}, [
		filteredSessions.length,
		selectedIndex,
		setSelectedIndex,
		setScrollOffset
	]);

	// Keyboard navigation handling
	useInput((input, key) => {
		if (key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, filteredSessions.length - 1);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex >= scrollOffset + visibleRows) {
				setScrollOffset(newIndex - visibleRows + 1);
			}
		} else if (key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);

			// Adjust scroll if needed
			if (newIndex < scrollOffset) {
				setScrollOffset(newIndex);
			}
		} else if (key.return && filteredSessions.length > 0) {
			// Select session for viewing details
			const session = filteredSessions[selectedIndex];
			if (!session.metadata?.isRunning) {
				onSessionSelect?.(session);
			}
		} else if (input === 'r' && filteredSessions.length > 0) {
			// Resume session (not applicable to running operations)
			const session = filteredSessions[selectedIndex];
			if (!session.metadata?.finished && !session.metadata?.isRunning) {
				onSessionResume?.(session.sessionId);
			}
		} else if (input === 'd' && filteredSessions.length > 0) {
			// View session details (not applicable to running operations)
			const session = filteredSessions[selectedIndex];
			if (!session.metadata?.isRunning) {
				onSessionDetails?.(session.sessionId);
			}
		} else if (input === 'f') {
			// Cycle through filters
			if (sessionFilter === 'all') {
				setSessionFilter('active');
			} else if (sessionFilter === 'active') {
				setSessionFilter('finished');
			} else {
				setSessionFilter('all');
			}
			setSelectedIndex(0);
			setScrollOffset(0);
		} else if (input === '1') {
			setSessionFilter('all');
			setSelectedIndex(0);
			setScrollOffset(0);
		} else if (input === '2') {
			setSessionFilter('active');
			setSelectedIndex(0);
			setScrollOffset(0);
		} else if (input === '3') {
			setSessionFilter('finished');
			setSelectedIndex(0);
			setScrollOffset(0);
		} else if (input === 'n') {
			// New session
			onNewSession?.();
		} else if (input === 'r' && filteredSessions.length === 0) {
			// Refresh when no sessions
			onRefresh?.();
		} else if (key.escape) {
			// Go back
			onBack?.();
		}
	});

	const visibleSessions = filteredSessions.slice(
		scrollOffset,
		scrollOffset + visibleRows
	);

	// Prepare table data
	const tableData = visibleSessions.map((session, displayIndex) => {
		const actualIndex = displayIndex + scrollOffset;
		const isSelected = actualIndex === selectedIndex;
		const date = new Date(session.lastUpdated || session.createdAt);
		const isActive = !session.metadata?.finished;
		const isSubtaskSession =
			session.metadata?.type === 'subtask-implementation';
		const isRunning = session.metadata?.isRunning;

		return {
			' ': isSelected ? '→' : ' ',
			'Session ID': isRunning 
				? `🔄 ${session.sessionId.substring(0, 6)}...` 
				: session.sessionId.substring(0, 8) + '...',
			Type: isRunning 
				? 'Background' 
				: (isSubtaskSession ? 'Subtask' : 'General'),
			Status: isRunning 
				? `⚡ ${session.status || 'Running'}` 
				: (isActive ? '● Active' : '✓ Finished'),
			Prompt: session.prompt?.substring(0, 40) + '...' || 'No prompt',
			Started: isRunning 
				? formatDistanceToNow(new Date(session.lastUpdated), { addSuffix: true })
				: date.toLocaleDateString(),
			'': isRunning ? '' : date.toLocaleTimeString(),
			_renderCell: (col, value) => {
				let color = isSelected
					? safeTheme.item?.selected || '#0f172a'
					: safeTheme.text?.primary || '#f1f5f9';

				if (col === 'Status') {
					if (!isSelected) {
						if (isRunning) {
							color = '#fbbf24'; // Yellow for running
						} else {
							color = isActive
								? safeTheme.session?.active || '#60a5fa'
								: safeTheme.session?.finished || '#34d399';
						}
					}
				} else if (col === 'Type') {
					if (!isSelected) {
						if (isRunning) {
							color = '#fbbf24'; // Yellow for running
						} else if (isSubtaskSession) {
							color = safeTheme.session?.subtask || '#22d3ee';
						}
					}
				} else if (col === 'Session ID' && isRunning && !isSelected) {
					color = '#fbbf24'; // Yellow for running
				}

				return (
					<Text color={color} bold={isSelected}>
						{value}
					</Text>
				);
			}
		};
	});

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={safeTheme.border || '#334155'}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={safeTheme.accent || '#22d3ee'}>Task Master</Text>
					<Text color={safeTheme.text?.secondary || '#cbd5e1'}> › </Text>
					<Text color="white">Claude Code Sessions</Text>
					{filterSubtaskId && (
						<>
							<Text color={safeTheme.text?.secondary || '#cbd5e1'}> › </Text>
							<Text color={safeTheme.text?.primary || '#f1f5f9'}>
								Subtask {filterSubtaskId}
							</Text>
						</>
					)}
					<Text color={safeTheme.text?.secondary || '#cbd5e1'}>
						{' '}
						[{sessionFilter}]
					</Text>
				</Box>
				<Box>
					{runningOperations.length > 0 && (
						<Text color="#fbbf24">
							{runningOperations.length} running • 
						</Text>
					)}
					{config?.enabled ? (
						<Text color={safeTheme.session?.active || '#34d399'}>[Enabled]</Text>
					) : (
						<Text color={safeTheme.session?.finished || '#f87171'}>
							[Disabled]
						</Text>
					)}
				</Box>
			</Box>

			{/* Sessions Table */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{filteredSessions.length === 0 ? (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
						flexGrow={1}
					>
						<Text color={safeTheme.text?.secondary || '#cbd5e1'}>
							No {sessionFilter === 'all' ? '' : sessionFilter} Claude Code
							sessions found
						</Text>
						<Text color={safeTheme.text?.secondary || '#cbd5e1'} marginTop={1}>
							Press 'n' to start a new session
						</Text>
					</Box>
				) : (
					<>
						<SimpleTable
							data={tableData}
							columns={[
								' ',
								'Session ID',
								'Type',
								'Status',
								'Prompt',
								'Started',
								''
							]}
							selectedIndex={selectedIndex - scrollOffset}
							borders={true}
						/>

						{/* Scroll indicator */}
						{filteredSessions.length > visibleRows && (
							<Box marginTop={1}>
								<Text color={safeTheme.text?.tertiary || '#cbd5e1'}>
									Showing {scrollOffset + 1}-
									{Math.min(
										scrollOffset + visibleRows,
										filteredSessions.length
									)}{' '}
									of {filteredSessions.length} items
									{selectedIndex < filteredSessions.length - visibleRows &&
										' • ↓ for more'}
								</Text>
							</Box>
						)}
					</>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={safeTheme.border || '#334155'}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				flexShrink={0}
			>
				<Text color={safeTheme.text?.primary || '#f1f5f9'}>
					{filteredSessions.length > 0
						? 'Enter to view • r resume active • d details • '
						: ''}
					n new • f filter • r refresh • ESC back
				</Text>
			</Box>
		</Box>
	);
}
