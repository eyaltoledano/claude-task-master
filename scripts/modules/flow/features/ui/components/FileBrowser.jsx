import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../../shared/theme/theme.js';
import fs from 'fs';
import path from 'path';

export function FileBrowser({
	onSelect,
	onCancel,
	title = 'Select File',
	fileFilter = null
}) {
	const [currentPath, setCurrentPath] = useState(process.cwd());
	const [items, setItems] = useState([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Load directory contents
	useEffect(() => {
		loadDirectory(currentPath);
	}, [currentPath]);

	const loadDirectory = async (dirPath) => {
		try {
			setLoading(true);
			setError(null);

			const entries = await fs.promises.readdir(dirPath, {
				withFileTypes: true
			});
			const dirItems = [];

			// Add parent directory if not at root
			if (dirPath !== path.parse(dirPath).root) {
				dirItems.push({
					name: '..',
					type: 'directory',
					path: path.dirname(dirPath)
				});
			}

			// Add directories first
			entries
				.filter((entry) => entry.isDirectory())
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach((entry) => {
					dirItems.push({
						name: entry.name,
						type: 'directory',
						path: path.join(dirPath, entry.name)
					});
				});

			// Add files (filtered if needed)
			entries
				.filter((entry) => entry.isFile())
				.filter((entry) => !fileFilter || fileFilter(entry.name))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach((entry) => {
					dirItems.push({
						name: entry.name,
						type: 'file',
						path: path.join(dirPath, entry.name)
					});
				});

			setItems(dirItems);
			setSelectedIndex(0);
			setLoading(false);
		} catch (err) {
			setError(err.message);
			setLoading(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
			return;
		}

		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
			return;
		}

		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(prev - 1, 0));
			return;
		}

		if (key.return) {
			const selectedItem = items[selectedIndex];
			if (!selectedItem) return;

			if (selectedItem.type === 'directory') {
				setCurrentPath(selectedItem.path);
			} else {
				onSelect(selectedItem.path);
			}
			return;
		}
	});

	if (loading) {
		return (
			<Box flexDirection="column" height="100%">
				<Box justifyContent="center" alignItems="center" height="100%">
					<Text color={theme.accent}>Loading directory...</Text>
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
					<Text color={theme.accent}>{title}</Text>
				</Box>
				<Text color={theme.textDim}>[ESC cancel]</Text>
			</Box>

			{/* Current path */}
			<Box paddingLeft={1} marginBottom={1}>
				<Text color={theme.textDim}>Path: </Text>
				<Text color={theme.text}>{currentPath}</Text>
			</Box>

			{/* File list */}
			<Box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{error ? (
					<Text color={theme.error}>Error: {error}</Text>
				) : (
					<Box flexDirection="column">
						{items.map((item, index) => {
							const isSelected = index === selectedIndex;
							const icon = item.type === 'directory' ? '📁' : '📄';

							return (
								<Box
									key={item.path}
									backgroundColor={isSelected ? theme.selection : undefined}
								>
									<Text color={isSelected ? theme.selectionText : theme.text}>
										{isSelected ? '▶ ' : '  '}
										{icon} {item.name}
									</Text>
								</Box>
							);
						})}
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
				<Text color={theme.text}>
					↑↓ navigate • Enter select/open • ESC cancel
				</Text>
			</Box>
		</Box>
	);
}
