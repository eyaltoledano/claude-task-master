import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppContext } from '../index.jsx';
import { theme } from '../theme.js';

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
			if (input === 'y' || input === 'Y') {
				deleteTag();
			} else if (input === 'n' || input === 'N' || key.escape) {
				setMode('view');
				setError(null);
			}
			return;
		}

		// Normal navigation mode
		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}

		if (key.downArrow) {
			setSelectedIndex(Math.min(selectedIndex + 1, sortedTags.length - 1));
			setError(null);
		} else if (key.upArrow) {
			setSelectedIndex(Math.max(selectedIndex - 1, 0));
			setError(null);
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
				{/* Column Headers */}
				<Box marginBottom={1}>
					<Box width={25}>
						<Text color={theme.text} bold>
							Tag Name
						</Text>
					</Box>
					<Box width={10}>
						<Text color={theme.text} bold>
							Tasks
						</Text>
					</Box>
					<Box width={12}>
						<Text color={theme.text} bold>
							Completed
						</Text>
					</Box>
					<Box width={8}>
						<Text color={theme.text} bold>
							%
						</Text>
					</Box>
				</Box>

				{/* Tag Rows */}
				<Box flexDirection="column">
					{sortedTags.map((tag, index) => {
						const isSelected = index === selectedIndex;
						const isCurrent = tag.name === currentTag;
						const percentage =
							tag.taskCount > 0
								? Math.round((tag.completedTasks / tag.taskCount) * 100)
								: 0;

						if (mode === 'rename' && isSelected) {
							// Show inline edit
							return (
								<Box key={tag.name} backgroundColor={theme.selection}>
									<Box width={25}>
										<Text>
											<Text color={theme.accent}>▶ </Text>
											<Text color={theme.selectionText}>
												{isCurrent ? '● ' : ''}
											</Text>
											<TextInput
												value={inputValue}
												onChange={setInputValue}
												onSubmit={renameTag}
												placeholder={tag.name}
											/>
										</Text>
									</Box>
								</Box>
							);
						}

						return (
							<Box
								key={tag.name}
								backgroundColor={isSelected ? theme.selection : undefined}
							>
								<Box width={25}>
									<Text>
										{isSelected ? <Text color={theme.accent}>▶ </Text> : '  '}
										<Text
											color={
												isCurrent
													? theme.success
													: isSelected
														? theme.selectionText
														: theme.text
											}
										>
											{isCurrent ? '● ' : ''}
											{tag.name}
											{isCurrent ? ' (current)' : ''}
										</Text>
									</Text>
								</Box>
								<Box width={10}>
									<Text color={isSelected ? theme.selectionText : theme.text}>
										{tag.taskCount || 0}
									</Text>
								</Box>
								<Box width={12}>
									<Text color={isSelected ? theme.selectionText : theme.text}>
										{tag.completedTasks || 0}
									</Text>
								</Box>
								<Box width={8}>
									<Text color={isSelected ? theme.selectionText : theme.text}>
										{percentage}%
									</Text>
								</Box>
							</Box>
						);
					})}

					{/* Add new tag input */}
					{mode === 'add' && (
						<Box marginTop={1}>
							<Box width={25}>
								<Text color={theme.accent}> + </Text>
								<TextInput
									value={inputValue}
									onChange={setInputValue}
									onSubmit={addTag}
									placeholder="new-tag-name"
								/>
							</Box>
						</Box>
					)}
				</Box>

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
						<Text color={theme.warning}>
							Delete tag '{sortedTags[selectedIndex]?.name}'?{' '}
						</Text>
						<Text color={theme.text}>(y/n)</Text>
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
