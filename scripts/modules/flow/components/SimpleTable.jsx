import React from 'react';
import { Box, Text } from 'ink';

// Lightweight, dynamic table component with optional borders
export const SimpleTable = ({ data, columns, selectedIndex = -1, borders = false }) => {
	// Calculate column widths dynamically
	const columnWidths = {};
	columns.forEach(col => {
		// Start with column header length
		columnWidths[col] = col.length;
		
		// Check all data rows for max width
		data.forEach(row => {
			const value = String(row[col] || '');
			columnWidths[col] = Math.max(columnWidths[col], value.length);
		});
		
		// Add some padding
		columnWidths[col] += 2;
	});

	// Helper to create border lines
	const createBorderLine = (left, middle, right, fill) => {
		return left + columns.map((col, i) => {
			const line = fill.repeat(columnWidths[col]);
			return i === 0 ? line : middle + line;
		}).join('') + right;
	};

	// Render header with optional borders
	const renderHeader = () => (
		<>
			{borders && <Text>{createBorderLine('┌', '┬', '┐', '─')}</Text>}
			<Box>
				{borders && <Text>│</Text>}
				{columns.map((col, index) => (
					<React.Fragment key={col}>
						<Box width={columnWidths[col]} justifyContent="center">
							<Text bold underline color="cyan">
								{col}
							</Text>
						</Box>
						{borders && <Text>│</Text>}
					</React.Fragment>
				))}
			</Box>
			{borders && <Text>{createBorderLine('├', '┼', '┤', '─')}</Text>}
		</>
	);

	// Render a data row
	const renderRow = (row, rowIndex) => {
		const isSelected = rowIndex === selectedIndex;
		
		return (
			<Box key={rowIndex}>
				{borders && <Text>│</Text>}
				{columns.map((col) => (
					<React.Fragment key={`${rowIndex}-${col}`}>
						<Box width={columnWidths[col]} paddingLeft={1} paddingRight={1}>
							{row._renderCell ? (
								row._renderCell(col, row[col], isSelected)
							) : (
								<Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
									{row[col] || ''}
								</Text>
							)}
						</Box>
						{borders && <Text>│</Text>}
					</React.Fragment>
				))}
			</Box>
		);
	};

	return (
		<Box flexDirection="column">
			{renderHeader()}
			{data.map((row, index) => renderRow(row, index))}
			{borders && <Text>{createBorderLine('└', '┴', '┘', '─')}</Text>}
		</Box>
	);
}; 