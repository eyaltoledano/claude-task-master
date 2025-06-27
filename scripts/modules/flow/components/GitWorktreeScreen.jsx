import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SimpleTable } from './SimpleTable.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { Toast } from './Toast.jsx';
import AddWorktreeModal from './AddWorktreeModal.jsx';
import WorktreeDetailsModal from './WorktreeDetailsModal.jsx';
import LinkTasksModal from './LinkTasksModal.jsx';
import { ClaudeWorktreeLauncherModal } from './ClaudeWorktreeLauncherModal.jsx';
import { getTheme } from '../theme.js';

export default function GitWorktreeScreen({
	backend,
	onBack,
	onExit,
	navigationData,
	onNavigateToTask
}) {
	const [worktrees, setWorktrees] = useState([]);
	const [selectedWorktree, setSelectedWorktree] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [toast, setToast] = useState(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showDetailsModal, setShowDetailsModal] = useState(false);
	const [worktreeDetails, setWorktreeDetails] = useState(null);
	const [focusedIndex, setFocusedIndex] = useState(0);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const [showLinkTasksModal, setShowLinkTasksModal] = useState(false);
	const [availableTasks, setAvailableTasks] = useState([]);
	const [showClaudeModal, setShowClaudeModal] = useState(null);
	const [showPrompt, setShowPrompt] = useState(null);
	const [contextDetail, setContextDetail] = useState({});
	const theme = getTheme();

	// Load worktrees
	const loadWorktrees = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const trees = await backend.listWorktrees();

			// Load task counts for each worktree
			const treesWithTaskCounts = await Promise.all(
				trees.map(async (wt) => {
					try {
						const tasks = await backend.getWorktreeTasks(wt.name);
						return { ...wt, taskCount: tasks.length };
					} catch (err) {
						// If task loading fails, just show 0
						return { ...wt, taskCount: 0 };
					}
				})
			);

			setWorktrees(treesWithTaskCounts);
			if (
				treesWithTaskCounts.length > 0 &&
				focusedIndex >= treesWithTaskCounts.length
			) {
				setFocusedIndex(treesWithTaskCounts.length - 1);
			}
		} catch (err) {
			setError(err.message);
			setWorktrees([]);
		} finally {
			setIsLoading(false);
		}
	}, [backend, focusedIndex]);

	// Load details for selected worktree
	const loadWorktreeDetails = useCallback(
		async (worktree) => {
			setIsLoading(true);
			try {
				const details = await backend.getWorktreeDetails(worktree.path);
				const linkedTasks = await backend.getWorktreeTasks(worktree.name);
				setWorktreeDetails({ ...details, linkedTasks });
				setShowDetailsModal(true);
			} catch (err) {
				setToast({
					message: `Failed to load details: ${err.message}`,
					type: 'error'
				});
			} finally {
				setIsLoading(false);
			}
		},
		[backend]
	);

	// Initial load
	useEffect(() => {
		loadWorktrees();
	}, [loadWorktrees]);

	// Handle navigation data - only load if we don't already have the detail modal showing
	useEffect(() => {
		if (
			navigationData?.selectedWorktree &&
			navigationData?.showDetails &&
			!showDetailsModal
		) {
			// Set the worktree details immediately to avoid intermediate render
			setWorktreeDetails(navigationData.selectedWorktree);
			setShowDetailsModal(true);
			// Load full details in the background
			loadWorktreeDetails(navigationData.selectedWorktree);
		}
	}, [navigationData, loadWorktreeDetails, showDetailsModal]);

	// Handle worktree operations
	const handleAddWorktree = useCallback(
		async (name) => {
			setIsLoading(true);
			try {
				const result = await backend.addWorktree(name);
				setToast({
					message: `Worktree '${result.name}' created at ${result.path}`,
					type: 'success'
				});
				await loadWorktrees();
			} catch (err) {
				setToast({ message: err.message, type: 'error' });
			} finally {
				setIsLoading(false);
				setShowAddModal(false);
			}
		},
		[backend, loadWorktrees]
	);

	const handleRemoveWorktree = useCallback(
		async (worktree) => {
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
				await backend.removeWorktree(worktree.path);

				// Clean up task links
				await backend.cleanupWorktreeLinks(worktree.name);

				setToast({
					message: `Worktree '${worktree.name}' removed`,
					type: 'success'
				});
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
			setToast({ message: 'Pruned stale worktree entries', type: 'success' });
			await loadWorktrees();
		} catch (err) {
			setToast({ message: err.message, type: 'error' });
		} finally {
			setIsLoading(false);
		}
	}, [backend, loadWorktrees]);

	const handleToggleLock = useCallback(
		async (worktree) => {
			setIsLoading(true);
			try {
				if (worktree.isLocked) {
					await backend.unlockWorktree(worktree.path);
					setToast({
						message: `Worktree '${worktree.name}' unlocked`,
						type: 'success'
					});
				} else {
					await backend.lockWorktree(worktree.path, 'Locked via Flow TUI');
					setToast({
						message: `Worktree '${worktree.name}' locked`,
						type: 'success'
					});
				}
				await loadWorktrees();
				if (showDetailsModal && worktreeDetails) {
					await loadWorktreeDetails(worktree);
				}
			} catch (err) {
				setToast({ message: err.message, type: 'error' });
			} finally {
				setIsLoading(false);
			}
		},
		[
			backend,
			loadWorktrees,
			showDetailsModal,
			worktreeDetails,
			loadWorktreeDetails
		]
	);

	const handleLaunchClaude = async (worktree) => {
		try {
			// Get linked tasks for this worktree
			const tasks = await backend.getWorktreeTasks(worktree.name);

			if (!tasks || tasks.length === 0) {
				setToast({
					message:
						'No tasks linked to this worktree. Link tasks first with [l].',
					type: 'error'
				});
				return;
			}

			// Show Claude launcher modal
			setShowClaudeModal({ worktree, tasks });
		} catch (err) {
			setToast({
				message: `Failed to prepare Claude launch: ${err.message}`,
				type: 'error'
			});
		}
	};

	// Keyboard navigation
	useInput((input, key) => {
		// Modal handling
		if (showAddModal || showDetailsModal || showClaudeModal || showPrompt) {
			return;
		}

		// Handle delete confirmation
		if (confirmDelete) {
			if (input === 'y' || input === 'Y') {
				handleRemoveWorktree(confirmDelete);
				setConfirmDelete(null);
				setShowDetailsModal(false);
				setWorktreeDetails(null);
			} else if (input === 'n' || input === 'N' || key.escape) {
				setConfirmDelete(null);
			}
			return;
		}

		// Navigation
		if (key.upArrow || input === 'k') {
			setFocusedIndex((prev) => Math.max(0, prev - 1));
		} else if (key.downArrow || input === 'j') {
			setFocusedIndex((prev) => Math.min(worktrees.length - 1, prev + 1));
		} else if (key.return || input === ' ') {
			// Select worktree for details
			if (worktrees[focusedIndex]) {
				loadWorktreeDetails(worktrees[focusedIndex]);
			}
		}

		// Actions
		if (input === 'a') {
			setShowAddModal(true);
		} else if (input === 'r') {
			loadWorktrees();
		} else if (input === 'p') {
			handlePruneWorktrees();
		} else if (input === 'c' && worktrees[focusedIndex]) {
			handleLaunchClaude(worktrees[focusedIndex]);
		} else if (input === 'q' || key.escape) {
			onBack();
		}
	});

	// Prepare table data
	const tableData = worktrees.map((wt, index) => ({
		' ': index === focusedIndex ? '>' : ' ',
		Name: wt.isCurrent ? `${wt.name} (current)` : wt.name,
		Branch: wt.isDetached ? '(detached)' : wt.branch || '-',
		Tasks: wt.taskCount || 0,
		'🔒': wt.isLocked ? '🔒' : '',
		Path: wt.path
	}));

	// Render
	if (showAddModal) {
		return (
			<AddWorktreeModal
				onSubmit={handleAddWorktree}
				onCancel={() => setShowAddModal(false)}
			/>
		);
	}

	// Show details modal immediately if we have navigation data
	if (
		(showDetailsModal && worktreeDetails) ||
		(navigationData?.selectedWorktree && navigationData?.showDetails)
	) {
		const worktreeToShow = worktreeDetails || navigationData.selectedWorktree;

		// Show confirmation instead of details modal when delete is requested
		if (confirmDelete) {
			return (
				<Box
					flexDirection="column"
					alignItems="center"
					justifyContent="center"
					height="100%"
				>
					<Box
						borderStyle="round"
						borderColor={theme.warning}
						padding={2}
						flexDirection="column"
						alignItems="center"
					>
						<Text color={theme.warning} bold>
							Delete Confirmation
						</Text>
						<Box marginTop={1}>
							<Text>Delete worktree '{confirmDelete.name}'?</Text>
						</Box>
						<Box marginTop={1}>
							<Text color={theme.muted}>{confirmDelete.path}</Text>
						</Box>
						<Box marginTop={2}>
							<Text color={theme.text}>Press Y to confirm, N to cancel</Text>
						</Box>
					</Box>
				</Box>
			);
		}

		return (
			<WorktreeDetailsModal
				worktree={worktreeToShow}
				backend={backend}
				onClose={() => {
					setShowDetailsModal(false);
					setWorktreeDetails(null);
					loadWorktrees(); // Refresh to update task counts
					// If we came from navigation data, go back instead of staying on worktrees list
					if (navigationData?.showDetails) {
						onBack();
					}
				}}
				onDelete={() => {
					setConfirmDelete(worktreeToShow);
				}}
				onNavigateToTask={onNavigateToTask}
			/>
		);
	}

	if (showLinkTasksModal && worktreeDetails) {
		return (
			<LinkTasksModal
				worktree={worktreeDetails}
				backend={backend}
				onClose={() => {
					setShowLinkTasksModal(false);
					setShowDetailsModal(true);
					loadWorktrees(); // Refresh to update task counts
				}}
			/>
		);
	}

	// Show Claude launcher modal
	if (showClaudeModal) {
		return (
			<Box
				flexDirection="column"
				height="100%"
				alignItems="center"
				justifyContent="center"
			>
				<ClaudeWorktreeLauncherModal
					backend={backend}
					worktree={showClaudeModal.worktree}
					tasks={showClaudeModal.tasks}
					onClose={() => setShowClaudeModal(null)}
					onSuccess={(message) => {
						setToast({ message: message, type: 'success' });
						setShowClaudeModal(null);
					}}
				/>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color={theme.primary}>
					Git Worktrees
				</Text>
			</Box>

			{/* Controls */}
			<Box marginBottom={1} gap={2}>
				<Text color={theme.text}>
					↑↓ navigate • Enter view • a add • d delete • l link tasks • c launch
					claude • p prune • r refresh • ESC back
				</Text>
			</Box>

			{/* Content */}
			{isLoading ? (
				<LoadingSpinner message="Loading worktrees..." />
			) : error ? (
				<Box
					flexDirection="column"
					alignItems="center"
					justifyContent="center"
					flexGrow={1}
				>
					<Text color={theme.error}>{error}</Text>
					<Text color={theme.muted}>Press 'q' to go back</Text>
				</Box>
			) : worktrees.length === 0 ? (
				<Box
					flexDirection="column"
					alignItems="center"
					justifyContent="center"
					flexGrow={1}
				>
					<Text color={theme.muted}>No worktrees found</Text>
					<Text color={theme.muted}>Press 'a' to add a new worktree</Text>
				</Box>
			) : (
				<Box flexGrow={1} flexDirection="column">
					<SimpleTable
						data={tableData}
						columns={[' ', 'Name', 'Branch', 'Tasks', '🔒', 'Path']}
						selectedIndex={focusedIndex}
						borders={true}
					/>

					{worktrees[focusedIndex] && (
						<Box marginTop={1}>
							<Text color={theme.muted}>
								HEAD:{' '}
								{worktrees[focusedIndex].head?.substring(0, 8) || 'unknown'}
							</Text>
						</Box>
					)}
				</Box>
			)}

			{/* Toast */}
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
