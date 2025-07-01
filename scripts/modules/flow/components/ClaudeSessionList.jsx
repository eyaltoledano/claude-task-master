import React, { useState } from 'react';
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
	onWatchOperation,
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
	const [selectedIndex, setSelectedIndex, selectedIndexRef] = useStateAndRef(initialSelectedIndex);
	const [scrollOffset, setScrollOffset] = useState(initialScrollOffset);
	const [sessionFilter, setSessionFilter] = useState(initialSessionFilter);
	const [showActions, setShowActions] = useState(false);

	// Combine sessions and running operations for display
	const combinedItems = React.useMemo(() => {
		const items = [];
		
		// Add running operations first (they'll appear at the top)
		runningOperations.forEach(op => {
			items.push({
				type: 'operation',
				id: op.id,
				sessionId: op.id,
				status: op.status,
				startTime: op.startTime,
				messages: op.messages || [],
				metadata: op.metadata || {},
				title: op.metadata?.subtaskId ? `Subtask ${op.metadata.subtaskId}` : 'Background Operation'
			});
		});
		
		// Add regular sessions
		sessions.forEach(session => {
			items.push({
				type: 'session',
				...session
			});
		});
		
	
		return items;
	}, [sessions, runningOperations]);

	// Filter items based on current filter and subtaskId
	const filteredItems = React.useMemo(() => {
		let items = combinedItems;
		
		// Filter by subtask if specified
		if (filterSubtaskId) {
			items = items.filter(item => {
				if (item.type === 'operation') {
					return item.metadata?.subtaskId === filterSubtaskId;
				}
				return item.metadata?.subtaskId === filterSubtaskId;
			});
		}
		
		// Apply session filter
		if (sessionFilter === 'active') {
			items = items.filter(item => {
				if (item.type === 'operation') return true; // Operations are always considered active
				return !item.metadata?.finished;
			});
		} else if (sessionFilter === 'finished') {
			items = items.filter(item => {
				if (item.type === 'operation') return false; // Operations are never finished in this context
				return item.metadata?.finished;
			});
		}
		

		return items;
	}, [combinedItems, sessionFilter, filterSubtaskId]);

	// Reset selection when filtered sessions change
	React.useEffect(() => {
		if (
			selectedIndex >= filteredItems.length &&
			filteredItems.length > 0
		) {
			setSelectedIndex(0);
			setScrollOffset(0);
		}
	}, [filteredItems.length, selectedIndex, setSelectedIndex]);

	// Keyboard navigation handling
	useInput((input, key) => {
		if (key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
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
		} else if (key.return && filteredItems.length > 0) {
			// Select session for viewing details
			const item = filteredItems[selectedIndex];
			if (item.type === 'operation') {
				// Watch running operation
				onWatchOperation?.(item.id);
			} else if (!item.metadata?.isRunning) {
				onSessionSelect?.(item);
			}
		} else if (input === 'r' && filteredItems.length > 0) {
			// Resume session (not applicable to running operations)
			const item = filteredItems[selectedIndex];
			if (item.type === 'session' && !item.metadata?.finished && !item.metadata?.isRunning) {
				onSessionResume?.(item.sessionId);
			}
		} else if (input === 'w' && filteredItems.length > 0) {
			// Watch operation
			const item = filteredItems[selectedIndex];
			if (item.type === 'operation') {
				onWatchOperation?.(item.id);
			}
		} else if (input === 'd' && filteredItems.length > 0) {
			// View session details (not applicable to running operations)
			const item = filteredItems[selectedIndex];
			if (item.type === 'session' && !item.metadata?.isRunning) {
				onSessionDetails?.(item.sessionId);
			}
		} else if (input === 'n') {
			// New session
			onNewSession?.();
		} else if (input === 'r' && filteredItems.length === 0) {
			// Refresh when no sessions
			onRefresh?.();
		} else if (input === 'f') {
			// Filter toggle
			setSessionFilter(currentFilter => {
				switch (currentFilter) {
					case 'all':
						return 'active';
					case 'active':
						return 'finished';
					case 'finished':
						return 'all';
					default:
						return 'all';
				}
			});
		} else if (key.escape) {
			// Go back
			onBack?.();
		}
	});

	const visibleSessions = filteredItems.slice(
		scrollOffset,
		scrollOffset + visibleRows
	);

	// Generate table data
	const tableData = visibleSessions.map((item, index) => {
		const isSelected = scrollOffset + index === selectedIndex;
		const globalIndex = scrollOffset + index;
		
		if (item.type === 'operation') {
			// Running operation
			const elapsed = Math.floor((new Date() - new Date(item.startTime)) / 1000);
			const minutes = Math.floor(elapsed / 60);
			const seconds = elapsed % 60;
			
			return {
				'Session/Operation': `🔄 ${item.title}`,
				'Status': `Running • ${minutes}:${seconds.toString().padStart(2, '0')}`,
				'Time/Messages': `${item.messages.length} msgs`,
				'Context': item.metadata.subtaskId || 'General',
				_renderCell: (col, value, selected) => (
					<Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
						{value}
					</Text>
				)
			};
		} else {
			// Regular session
			const statusDisplay = item.metadata?.finished 
				? '✅ Complete'
				: item.metadata?.isRunning 
					? '🔄 Running'
					: '⏸️ Paused';
			
			// Safe date formatting with validation
			let dateDisplay = 'Unknown time';
			const dateValue = item.lastUpdated || item.createdAt;
			if (dateValue) {
				const date = new Date(dateValue);
				if (!Number.isNaN(date.getTime())) {
					try {
						dateDisplay = formatDistanceToNow(date, { addSuffix: true });
					} catch (error) {
						console.warn('Date formatting error:', error, 'for value:', dateValue);
						dateDisplay = 'Invalid date';
					}
				} else {
					console.warn('Invalid date value:', dateValue);
					dateDisplay = 'Invalid date';
				}
			}

			// Generate display name from subtask info
			const subtaskInfo = item.metadata?.subtaskInfo;
			let displayName = 'No subtask info';
			
			if (subtaskInfo) {
				const fullId = subtaskInfo.fullId || `${subtaskInfo.parentTaskId}.${subtaskInfo.subtaskId}` || 'Unknown';
				const title = subtaskInfo.title || 'Untitled';
				displayName = `${fullId}: ${title}`;
				
				// Truncate if too long
				if (displayName.length > 40) {
					displayName = displayName.substring(0, 37) + '...';
				}
			}
			
			return {
				'Session/Operation': displayName,
				'Status': statusDisplay,
				'Time/Messages': dateDisplay,
				'Context': subtaskInfo?.fullId || subtaskInfo?.parentTaskId || 'General',
				_renderCell: (col, value, selected) => (
					<Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
						{value}
					</Text>
				)
			};
		}
	});



	const tableConfig = {
		headers: ['Session/Operation', 'Status', 'Time/Messages', 'Context'],
		columnWidths: [40, 20, 20, 15],
		selectedRowIndex: selectedIndex - scrollOffset
	};

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
				{filteredItems.length === 0 ? (
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
							columns={tableConfig.headers}
							borders={true}
						/>

						{/* Scroll indicator */}
						{filteredItems.length > visibleRows && (
							<Box marginTop={1}>
								<Text color={safeTheme.text?.tertiary || '#cbd5e1'}>
									Showing {scrollOffset + 1}-
									{Math.min(
										scrollOffset + visibleRows,
										filteredItems.length
									)}{' '}
									of {filteredItems.length} items
									{selectedIndex < filteredItems.length - visibleRows &&
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
				borderColor={safeTheme.border?.primary || '#475569'}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
				marginTop={1}
			>
				<Text color={safeTheme.text?.primary || '#f1f5f9'}>
					{filteredItems.length > 0 ? (
						(() => {
							const selectedItem = filteredItems[selectedIndex];
							const commands = [];
							
							if (selectedItem?.type === 'operation') {
								commands.push('Enter/w watch');
							} else {
								commands.push('Enter view');
								if (!selectedItem?.metadata?.finished && !selectedItem?.metadata?.isRunning) {
									commands.push('r resume');
								}
								if (!selectedItem?.metadata?.isRunning) {
									commands.push('d details');
								}
							}
							
							commands.push('n new');
							commands.push('f filter');
							commands.push('ESC back');
							
							return commands.join(' • ');
						})()
					) : (
						'n new session • r refresh • ESC back'
					)}
				</Text>
			</Box>
		</Box>
	);
}
