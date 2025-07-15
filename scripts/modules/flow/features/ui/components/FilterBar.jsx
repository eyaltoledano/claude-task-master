import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

/**
 * FilterBar - Renders the filter controls and search input
 */
export function FilterBar({
	filter,
	filterMode,
	priorityFilter,
	searchQuery,
	isSearching,
	isStatusMode,
	isPriorityMode,
	setSearchQuery,
	setIsSearching,
	theme
}) {
	const handleSearchSubmit = (value) => {
		setSearchQuery(value);
		setIsSearching(false);
	};

	const handleSearchCancel = () => {
		setIsSearching(false);
		setSearchQuery('');
	};

	if (isSearching) {
		return (
			<Box marginBottom={1}>
				<Box paddingX={1} borderStyle="round" borderColor={theme.accent}>
					<Text color={theme.text}>Search: </Text>
					<TextInput
						value={searchQuery}
						onChange={setSearchQuery}
						onSubmit={handleSearchSubmit}
						placeholder="Type to search tasks..."
					/>
					<Text color={theme.textDim}> (Enter to search, Esc to cancel)</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box marginBottom={1}>
			<Box paddingX={1} borderStyle="round" borderColor={theme.border}>
				<Box flexDirection="row" alignItems="center">
					<Text color={theme.text}>Filter: </Text>
					<Text color={isStatusMode ? theme.accent : theme.textDim}>
						f Filter
					</Text>
					<Text color={theme.textDim}> ({filterMode}) </Text>
					<Text color={theme.textDim}>• </Text>
					<Text color={theme.text}>Search: </Text>
					<Text color={theme.textDim}>/ • </Text>
					<Text color={theme.text}>Priority: </Text>
					<Text color={theme.textDim}>r • </Text>

					{isStatusMode ? (
						<>
							<Text color={filter === 'all' ? theme.accent : theme.textDim}>
								1 All
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text color={filter === 'pending' ? theme.accent : theme.textDim}>
								2 Pending
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text
								color={filter === 'in-progress' ? theme.accent : theme.textDim}
							>
								3 Progress
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text color={filter === 'done' ? theme.accent : theme.textDim}>
								4 Done
							</Text>
						</>
					) : (
						<>
							<Text
								color={priorityFilter === 'all' ? theme.accent : theme.textDim}
							>
								1 All
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text
								color={priorityFilter === 'high' ? theme.accent : theme.textDim}
							>
								2 High
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text
								color={
									priorityFilter === 'medium' ? theme.accent : theme.textDim
								}
							>
								3 Medium
							</Text>
							<Text color={theme.textDim}> </Text>
							<Text
								color={priorityFilter === 'low' ? theme.accent : theme.textDim}
							>
								4 Low
							</Text>
						</>
					)}
				</Box>
			</Box>

			{searchQuery && (
				<Box paddingX={1} marginTop={1}>
					<Text color={theme.textDim}>
						Searching for: "{searchQuery}" (/ to modify, clear to reset)
					</Text>
				</Box>
			)}
		</Box>
	);
}
