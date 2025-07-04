import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfirmInput } from '@inkjs/ui';
import { getTheme } from '../theme.js';
import { Toast } from './Toast.jsx';
import { SimpleTable } from './SimpleTable.jsx';
import AddWorktreeModal from './AddWorktreeModal.jsx';
import WorktreeDetailsModal from './WorktreeDetailsModal.jsx';

export default function GitWorktreeScreen({
	backend,
	onNavigateToTask,
	onBack,
	onExit,
	navigationData,
	setCurrentScreen
}) {
	const theme = getTheme();
	const [mainWorktree, setMainWorktree] = useState(null);
	const [linkedWorktrees, setLinkedWorktrees] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showDetailsModal, setShowDetailsModal] = useState(false);
	const [worktreeDetails, setWorktreeDetails] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [confirmForceDelete, setConfirmForceDelete] = useState(null);
	const [toast, setToast] = useState(null);
	const [scrollOffset, setScrollOffset] = useState(0);

	// Constants for scrolling
	const VISIBLE_ROWS = 10;

	// Load worktrees
	const loadWorktrees = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await backend.listWorktrees();
			setMainWorktree(result.main);
			setLinkedWorktrees(result.linked || []);
			// Reset selection if out of bounds
			if (selectedIndex >= result.linked.length) {
				setSelectedIndex(Math.max(0, result.linked.length - 1));
			}
		} catch (err) {
			setLinkedWorktrees([]);
		} finally {
			setIsLoading(false);
		}
	}, [selectedIndex, backend]);

	// Initial load
	useEffect(() => {
		loadWorktrees();
	}, [loadWorktrees]);

	// Handle navigation data to auto-open details modal
	useEffect(() => {
		if (navigationData?.selectedWorktree && navigationData?.showDetails) {
			setWorktreeDetails(navigationData.selectedWorktree);
			setShowDetailsModal(true);
		}
	}, [navigationData]);

	// Handle worktree operations
	const handleAddWorktree = useCallback(
		async (name, source, checkout = false) => {
			setIsLoading(true);
			try {
				await backend.addWorktree(name, { source, checkout });
				setToast({
					message: `Worktree '${name}' created successfully`,
					type: 'success'
				});
				await loadWorktrees();
			} catch (error) {
				setToast({ message: error.message, type: 'error' });
			} finally {
				setIsLoading(false);
				setShowAddModal(false);
			}
		},
		[backend, loadWorktrees]
	);

	const handleRemoveWorktree = useCallback(
		async (worktree, force = false) => {
			if (worktree.isCurrent) {
				setToast({
					message: 'Cannot remove the current worktree',
					type: 'error'
				});
				return;
			}

			setIsLoading(true);
			try {
				// Remove worktree
				const result = await backend.removeWorktree(worktree.path, { force });

				// Check if result indicates force is needed
				if (result && !result.success && result.needsForce) {
					// Need to prompt for force deletion
					setConfirmDelete(null); // Clear the regular confirmation
					setConfirmForceDelete(worktree);
					setIsLoading(false);
					return;
				}

				// If we got here, removal was successful
				// Clean up task links
				await backend.cleanupWorktreeLinks(worktree.name);

				const message =
					result && result.usedForce
						? `Worktree '${worktree.name}' force removed`
						: `Worktree '${worktree.name}' removed`;

				setToast({
					message,
					type: 'success'
				});

				// Close any open modals and clear all confirmation states
				setShowDetailsModal(false);
				setWorktreeDetails(null);
				setConfirmDelete(null);
				setConfirmForceDelete(null);

				await loadWorktrees();
			} catch (err) {
				setToast({ message: err.message, type: 'error' });
			} finally {
				setIsLoading(false);
			}
		},
		[backend, loadWorktrees]
	);

	const handlePruneWorktrees = useCallback(async () => {
		setIsLoading(true);
		try {
			const result = await backend.pruneWorktrees();
			setToast({
				message: result.message || 'Worktrees pruned successfully',
				type: 'success'
			});
			await loadWorktrees();
		} catch (error) {
			setToast({ message: error.message, type: 'error' });
		} finally {
			setIsLoading(false);
		}
	}, [backend, loadWorktrees]);

	// Keyboard navigation
	useInput((input, key) => {
		// Modal handling
		if (showAddModal || showDetailsModal) {
			return;
		}

		// Handle confirmations - now handled by ConfirmInput components
		if (confirmForceDelete || confirmDelete) {
			return;
		}

		// Navigation
		if (key.upArrow) {
			setSelectedIndex((prev) => {
				const newIndex = Math.max(0, prev - 1);
				// Adjust scroll if needed
				if (newIndex < scrollOffset) {
					setScrollOffset(newIndex);
				}
				return newIndex;
			});
		} else if (key.downArrow) {
			setSelectedIndex((prev) => {
				const newIndex = Math.min(linkedWorktrees.length - 1, prev + 1);
				// Adjust scroll if needed
				if (newIndex >= scrollOffset + VISIBLE_ROWS) {
					setScrollOffset(newIndex - VISIBLE_ROWS + 1);
				}
				return newIndex;
			});
		} else if (key.pageUp) {
			setSelectedIndex((prev) => {
				const newIndex = Math.max(0, prev - VISIBLE_ROWS);
				setScrollOffset(Math.max(0, scrollOffset - VISIBLE_ROWS));
				return newIndex;
			});
		} else if (key.pageDown) {
			setSelectedIndex((prev) => {
				const newIndex = Math.min(
					linkedWorktrees.length - 1,
					prev + VISIBLE_ROWS
				);
				setScrollOffset(
					Math.min(
						Math.max(0, linkedWorktrees.length - VISIBLE_ROWS),
						scrollOffset + VISIBLE_ROWS
					)
				);
				return newIndex;
			});
		} else if (key.return && linkedWorktrees.length > 0) {
			const selected = linkedWorktrees[selectedIndex];
			if (selected) {
				if (selected.isCurrent) {
					setToast({ message: 'Already in this worktree', type: 'info' });
				} else {
					setToast({
						message: `To switch worktrees: exit Flow and run 'cd ${selected.path}'`,
						type: 'info'
					});
				}
			}
		} else if (input === 'a') {
			setShowAddModal(true);
		} else if (input === 'd' && linkedWorktrees.length > 0) {
			const selected = linkedWorktrees[selectedIndex];
			if (selected) {
				if (selected.isCurrent || selected.isMain) {
					setToast({
						message: 'Cannot remove the current or main worktree',
						type: 'error'
					});
				} else {
					setConfirmDelete(selected);
				}
			}
		} else if (input === 'v' && linkedWorktrees.length > 0) {
			const selected = linkedWorktrees[selectedIndex];
			if (selected) {
				setWorktreeDetails(selected);
				setShowDetailsModal(true);
			}
		} else if (input === 'p') {
			handlePruneWorktrees();
		}

		// Handle escape key
		if (key.escape && onBack) {
			onBack();
		}
	});

	// Show add modal
	if (showAddModal) {
		return (
			<AddWorktreeModal
				onSubmit={(name) => {
					setShowAddModal(false);
					handleAddWorktree(name);
				}}
				onCancel={() => setShowAddModal(false)}
			/>
		);
	}

	// Show details modal
	if (showDetailsModal && worktreeDetails) {
		return (
			<WorktreeDetailsModal
				worktree={worktreeDetails}
				backend={backend}
				onClose={() => {
					setShowDetailsModal(false);
					setWorktreeDetails(null);
				}}
				onDelete={() => {
					setShowDetailsModal(false);
					setConfirmDelete(worktreeDetails);
				}}
				onNavigateToTask={onNavigateToTask}
			/>
		);
	}

	// Show delete confirmation
	if (confirmDelete) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.warning}
				padding={1}
				width={60}
			>
				<Text bold color={theme.warning}>
					Delete Confirmation
				</Text>
				<Box marginTop={1}>
					<Text>
						Are you sure you want to delete worktree '{confirmDelete.name}'?
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>{confirmDelete.path}</Text>
				</Box>
				<Box marginTop={2}>
					<ConfirmInput
						message="Delete this worktree?"
						onConfirm={() => {
							handleRemoveWorktree(confirmDelete);
							setConfirmDelete(null);
							setShowDetailsModal(false);
							setWorktreeDetails(null);
						}}
						onCancel={() => setConfirmDelete(null)}
					/>
				</Box>
			</Box>
		);
	}

	// Show force delete confirmation
	if (confirmForceDelete) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.error}
				padding={1}
				width={70}
			>
				<Text bold color={theme.error}>
					Force Delete Required
				</Text>
				<Box marginTop={1}>
					<Text>
						Worktree '{confirmForceDelete.name}' contains modified or untracked
						files.
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color={theme.warning}>
						Force deletion will remove all uncommitted changes!
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>{confirmForceDelete.path}</Text>
				</Box>
				<Box marginTop={2}>
					<ConfirmInput
						message="Force delete this worktree? (All uncommitted changes will be lost!)"
						onConfirm={() => {
							handleRemoveWorktree(confirmForceDelete, true);
							setConfirmForceDelete(null);
							setShowDetailsModal(false);
							setWorktreeDetails(null);
						}}
						onCancel={() => setConfirmForceDelete(null)}
						confirmText="Force Delete"
						cancelText="Cancel"
					/>
				</Box>
			</Box>
		);
	}

	// Calculate stats
	const totalWorktrees = linkedWorktrees.length;
	const stats = {
		total: totalWorktrees,
		active: linkedWorktrees.filter((wt) => wt.isCurrent).length,
		detached: linkedWorktrees.filter((wt) => wt.isDetached).length,
		locked: linkedWorktrees.filter((wt) => wt.isLocked).length
	};

	// Main render
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
					<Text color="white">Git Worktrees</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Main Repository Info */}
			{mainWorktree && (
				<Box
					flexDirection="column"
					marginTop={1}
					marginBottom={1}
					paddingLeft={1}
					paddingRight={1}
					borderStyle="round"
					borderColor={theme.border}
				>
					<Text bold color={theme.accent}>
						Main Repository
					</Text>
					<Box marginTop={1}>
						<Text>Path: {mainWorktree.path}</Text>
					</Box>
					<Box>
						<Text>
							Branch: {mainWorktree.branch || '(detached)'}
							{mainWorktree.isCurrent && (
								<Text color={theme.success}> [CURRENT]</Text>
							)}
						</Text>
					</Box>
				</Box>
			)}

			{/* Linked Worktrees Section */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{linkedWorktrees.length > 0 ? (
					<>
						<Box marginBottom={1}>
							<Text bold color={theme.primary}>
								Linked Worktrees ({linkedWorktrees.length})
							</Text>
						</Box>

						{/* Worktree Table */}
						<SimpleTable
							data={linkedWorktrees
								.slice(scrollOffset, scrollOffset + VISIBLE_ROWS)
								.map((worktree, index) => {
									const actualIndex = scrollOffset + index;
									const isSelected = selectedIndex === actualIndex;
									const statusIcon = worktree.isLocked
										? '🔒'
										: worktree.isCurrent
											? '●'
											: worktree.isBare
												? '○'
												: ' ';

									return {
										' ': isSelected ? '→' : ' ',
										S: statusIcon,
										Name:
											worktree.name.length > 20
												? worktree.name.substring(0, 17) + '...'
												: worktree.name,
										Branch:
											worktree.branch.length > 20
												? worktree.branch.substring(0, 17) + '...'
												: worktree.branch,
										Status: worktree.isLocked
											? 'locked'
											: worktree.isCurrent
												? 'current'
												: 'active',
										Path:
											worktree.path.length > 40
												? '...' + worktree.path.slice(-37)
												: worktree.path,
										_renderCell: (col, value) => {
											let color = isSelected ? theme.selectionText : theme.text;

											if (col === 'Status') {
												if (value === 'current') {
													color = theme.success;
												} else if (value === 'locked') {
													color = theme.warning;
												}
											} else if (col === 'S') {
												if (value === '●') {
													color = theme.success;
												} else if (value === '🔒') {
													color = theme.warning;
												}
											}

											return (
												<Text color={color} bold={isSelected}>
													{value}
												</Text>
											);
										}
									};
								})}
							columns={[' ', 'S', 'Name', 'Branch', 'Status', 'Path']}
							selectedIndex={selectedIndex - scrollOffset}
							borders={true}
						/>

						{/* Scroll indicator */}
						{linkedWorktrees.length > VISIBLE_ROWS && (
							<Box marginTop={1}>
								<Text color={theme.textDim}>
									{scrollOffset + 1}-
									{Math.min(
										scrollOffset + VISIBLE_ROWS,
										linkedWorktrees.length
									)}{' '}
									of {linkedWorktrees.length} worktrees
								</Text>
							</Box>
						)}
					</>
				) : (
					/* Empty state */
					!isLoading && (
						<Box marginTop={2} paddingLeft={2}>
							<Text color={theme.textDim}>
								No linked worktrees. Press 'a' to create one.
							</Text>
						</Box>
					)
				)}

				{/* Loading state */}
				{isLoading && (
					<Box marginTop={2} paddingLeft={2}>
						<Text color={theme.textDim}>Loading worktrees...</Text>
					</Box>
				)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
			>
				<Box flexDirection="column">
					<Box>
						<Text color={theme.text}>
							↑↓ navigate • Enter switch • a add • d delete • v view • p prune
						</Text>
					</Box>
					<Box>
						<Text color={theme.textDim}>
							{stats.total} worktrees • {stats.active} active • {stats.detached}{' '}
							detached • {stats.locked} locked
						</Text>
					</Box>
				</Box>
			</Box>

			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onDismiss={() => setToast(null)}
				/>
			)}
		</Box>
	);
}
