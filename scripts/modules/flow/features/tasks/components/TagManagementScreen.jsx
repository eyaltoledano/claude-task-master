import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ConfirmInput } from '@inkjs/ui';
import { useAppContext } from '../../../app/index-root.jsx';
import { theme } from '../../../theme.js';
import { SimpleTable } from '../../ui';

import { useComponentTheme } from '../../../shared/hooks/useTheme.js';

export function TagManagementScreen() {
	const { backend, currentTag, setCurrentTag, setCurrentScreen, showToast } =
		useAppContext();
	const [tags, setTags] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [mode, setMode] = useState('view'); // 'view' | 'add' | 'rename' | 'delete-confirm'
	const [inputValue, setInputValue] = useState('');
	const [sortMode, setSortMode] = useState('name'); // 'name' | 'tasks'
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [scrollOffset, setScrollOffset] = useState(0);

	// Constants for display
	const VISIBLE_ROWS = 15;

	// Load tags on mount
	useEffect(() => {
		loadTags();
	}, []);

	const loadTags = async () => {
		try {
			setLoading(true);
			const result = await backend.listTags();
			setTags(result.tags || []);
			setLoading(false);
		} catch (err) {
			setError(err.message);
			setLoading(false);
		}
	};

	// Sort tags based on current sort mode
	const sortedTags = [...tags].sort((a, b) => {
		if (sortMode === 'name') {
			return a.name.localeCompare(b.name);
		} else if (sortMode === 'tasks') {
			return b.taskCount - a.taskCount;
		}
		return 0;
	});

	// Calculate totals
	const totalTasks = tags.reduce((sum, tag) => sum + (tag.taskCount || 0), 0);
	const totalCompleted = tags.reduce(
		(sum, tag) => sum + (tag.completedTasks || 0),
		0
	);
	const totalPercentage =
		totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

	// Handle keyboard input
	useInput((input, key) => {
		if (mode === 'add' || mode === 'rename') {
			// Input mode is handled by TextInput
			return;
		}

		if (mode === 'delete-confirm') {
			// Confirmation is now handled by ConfirmInput component
			return;
		}

		// Normal navigation mode
		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		if (key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, sortedTags.length - 1);
			setSelectedIndex(newIndex);
			setError(null);

			// Adjust scroll if needed
			if (newIndex >= scrollOffset + VISIBLE_ROWS) {
				setScrollOffset(newIndex - VISIBLE_ROWS + 1);
			}
		} else if (key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);
			setError(null);

			// Adjust scroll if needed
			if (newIndex < scrollOffset) {
				setScrollOffset(newIndex);
			}
		} else if (key.pageDown) {
			// Page down
			const newIndex = Math.min(
				selectedIndex + VISIBLE_ROWS,
				sortedTags.length - 1
			);
			setSelectedIndex(newIndex);
			setScrollOffset(
				Math.min(
					newIndex - VISIBLE_ROWS + 1,
					Math.max(0, sortedTags.length - VISIBLE_ROWS)
				)
			);
		} else if (key.pageUp) {
			// Page up
			const newIndex = Math.max(selectedIndex - VISIBLE_ROWS, 0);
			setSelectedIndex(newIndex);
			setScrollOffset(Math.max(0, newIndex));
		} else if (key.return) {
			// Switch to selected tag
			const selectedTag = sortedTags[selectedIndex];
			if (selectedTag && selectedTag.name !== currentTag) {
				switchToTag(selectedTag.name);
			}
		} else if (input === 'a') {
			// Add new tag
			setMode('add');
			setInputValue('');
			setError(null);
		} else if (input === 'd') {
			// Delete tag
			const selectedTag = sortedTags[selectedIndex];
			if (selectedTag) {
				if (selectedTag.taskCount > 0) {
					setError('Cannot delete tag with tasks');
				} else if (selectedTag.name === currentTag) {
					setError('Cannot delete current tag');
				} else {
					setMode('delete-confirm');
				}
			}
		} else if (input === 'r') {
			// Rename tag
			const selectedTag = sortedTags[selectedIndex];
			if (selectedTag) {
				setMode('rename');
				setInputValue(selectedTag.name);
				setError(null);
			}
		} else if (input === 's') {
			// Cycle sort mode
			setSortMode(sortMode === 'name' ? 'tasks' : 'name');
			setError(null);
		}
	});

	const switchToTag = async (tagName) => {
		try {
			await backend.useTag(tagName);
			setCurrentTag(tagName);
			showToast(`Switched to tag: ${tagName}`);
		} catch (err) {
			setError(err.message);
		}
	};

	const addTag = async () => {
		if (!inputValue.trim()) {
			setError('Tag name cannot be empty');
			return;
		}

		// Validate tag name
		if (!/^[a-zA-Z0-9-_]+$/.test(inputValue)) {
			setError(
				'Tag name can only contain letters, numbers, hyphens, and underscores'
			);
			return;
		}

		try {
			await backend.addTag(inputValue);
			await loadTags();
			setMode('view');
			setInputValue('');
			showToast(`Created tag: ${inputValue}`);
		} catch (err) {
			setError(err.message);
		}
	};

	const renameTag = async () => {
		const selectedTag = sortedTags[selectedIndex];

		if (!inputValue.trim()) {
			setError('Tag name cannot be empty');
			return;
		}

		if (inputValue === selectedTag.name) {
			setMode('view');
			return;
		}

		// Validate tag name
		if (!/^[a-zA-Z0-9-_]+$/.test(inputValue)) {
			setError(
				'Tag name can only contain letters, numbers, hyphens, and underscores'
			);
			return;
		}

		try {
			await backend.renameTag(selectedTag.name, inputValue);
			if (selectedTag.name === currentTag) {
				setCurrentTag(inputValue);
			}
			await loadTags();
			setMode('view');
			setInputValue('');
			showToast(`Renamed tag: ${selectedTag.name} → ${inputValue}`);
		} catch (err) {
			setError(err.message);
		}
	};

	const deleteTag = async () => {
		const selectedTag = sortedTags[selectedIndex];

		try {
			await backend.deleteTag(selectedTag.name);
			await loadTags();
			setMode('view');
			setSelectedIndex(Math.max(0, selectedIndex - 1));
			showToast(`Deleted tag: ${selectedTag.name}`);
		} catch (err) {
			setError(err.message);
			setMode('view');
		}
	};

	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color={theme.accent}>Loading tags...</Text>
				</Box>
			</Box>
		);
	}

	// Prepare visible tags
	const visibleTags = sortedTags.slice(
		scrollOffset,
		scrollOffset + VISIBLE_ROWS
	);

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
					<Text color="white">Tag Management</Text>
				</Box>
				<Text color={theme.textDim}>[ESC back]</Text>
			</Box>

			{/* Tag List */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{mode === 'rename' ? (
					// Show table with inline edit
					<SimpleTable
						data={visibleTags.map((tag, displayIndex) => {
							const actualIndex = displayIndex + scrollOffset;
							const isSelected = actualIndex === selectedIndex;
							const isCurrent = tag.name === currentTag;
							const percentage =
								tag.taskCount > 0
									? Math.round((tag.completedTasks / tag.taskCount) * 100)
									: 0;

							if (isSelected && mode === 'rename') {
								return {
									' ': '→',
									'Tag Name': (
										<TextInput
											value={inputValue}
											onChange={setInputValue}
											onSubmit={renameTag}
											placeholder={tag.name}
										/>
									),
									Tasks: tag.taskCount || 0,
									Completed: tag.completedTasks || 0,
									'%': `${percentage}%`,
									_renderCell: (col, value) => {
										if (col === ' ') {
											return <Text color={theme.accent}>{value}</Text>;
										}
										if (col === 'Tag Name') {
											return value;
										}
										return <Text color={theme.selectionText}>{value}</Text>;
									}
								};
							}

							return {
								' ': isSelected ? '→' : ' ',
								'Tag Name': isCurrent ? `● ${tag.name} (current)` : tag.name,
								Tasks: tag.taskCount || 0,
								Completed: tag.completedTasks || 0,
								'%': `${percentage}%`,
								_renderCell: (col, value) => {
									let color = isSelected ? theme.selectionText : theme.text;

									if (col === 'Tag Name' && isCurrent) {
										color = theme.success;
									}

									return (
										<Text color={color} bold={isSelected}>
											{value}
										</Text>
									);
								}
							};
						})}
						columns={[' ', 'Tag Name', 'Tasks', 'Completed', '%']}
						selectedIndex={selectedIndex - scrollOffset}
						borders={true}
					/>
				) : (
					// Normal view mode
					<SimpleTable
						data={visibleTags.map((tag, displayIndex) => {
							const actualIndex = displayIndex + scrollOffset;
							const isSelected = actualIndex === selectedIndex;
							const isCurrent = tag.name === currentTag;
							const percentage =
								tag.taskCount > 0
									? Math.round((tag.completedTasks / tag.taskCount) * 100)
									: 0;

							return {
								' ': isSelected ? '→' : ' ',
								'Tag Name': isCurrent ? `● ${tag.name} (current)` : tag.name,
								Tasks: tag.taskCount || 0,
								Completed: tag.completedTasks || 0,
								'%': `${percentage}%`,
								_renderCell: (col, value) => {
									let color = isSelected ? theme.selectionText : theme.text;

									if (col === 'Tag Name' && isCurrent) {
										color = theme.success;
									}

									return (
										<Text color={color} bold={isSelected}>
											{value}
										</Text>
									);
								}
							};
						})}
						columns={[' ', 'Tag Name', 'Tasks', 'Completed', '%']}
						selectedIndex={selectedIndex - scrollOffset}
						borders={true}
					/>
				)}

				{/* Add new tag input */}
				{mode === 'add' && (
					<Box marginTop={1}>
						<Box>
							<Text color={theme.accent}> + New tag: </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={addTag}
								placeholder="new-tag-name"
							/>
						</Box>
					</Box>
				)}

				{/* Scroll indicator */}
				{sortedTags.length > VISIBLE_ROWS && (
					<Box marginTop={1}>
						<Text color={theme.textDim}>
							{scrollOffset + 1}-
							{Math.min(scrollOffset + VISIBLE_ROWS, sortedTags.length)} of{' '}
							{sortedTags.length} tags
						</Text>
					</Box>
				)}

				{/* Summary */}
				<Box marginTop={1}>
					<Text color={theme.textDim}>
						{tags.length} tags • {totalTasks} total tasks • {totalCompleted}{' '}
						completed ({totalPercentage}%)
					</Text>
				</Box>
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
				{mode === 'delete-confirm' ? (
					<Box>
						<ConfirmInput
							message={`Delete tag '${sortedTags[selectedIndex]?.name}'?`}
							onConfirm={() => deleteTag()}
							onCancel={() => {
								setMode('view');
								setError(null);
							}}
						/>
					</Box>
				) : error ? (
					<Text color={theme.error}>{error}</Text>
				) : (
					<Box flexDirection="column">
						<Box>
							<Text color={theme.text}>
								↑↓ navigate • Enter switch • a add • d delete • r rename • s
								sort
							</Text>
						</Box>
						<Box>
							<Text color={theme.textDim}>sorted by: </Text>
							<Text color={theme.accent}>
								{sortMode === 'name' ? 'name ↓' : 'tasks ↓'}
							</Text>
						</Box>
					</Box>
				)}
			</Box>
		</Box>
	);
}
