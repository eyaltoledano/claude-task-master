/**
 * @fileoverview Table component for Task Master TUI
 * Matches the cli-table3 patterns from scripts/modules/ui.js
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme/colors.js';
import { tableBorders, type TableBorderStyle, getBoxWidth } from '../../theme/borders.js';

export interface TableColumn {
	/** Column header */
	header: string;
	/** Column key (for data lookup) */
	key: string;
	/** Fixed width or flexible */
	width?: number | 'auto';
	/** Text alignment */
	align?: 'left' | 'center' | 'right';
	/** Custom cell renderer */
	render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface TableProps {
	/** Column definitions */
	columns: TableColumn[];
	/** Row data */
	data: Record<string, unknown>[];
	/** Border style */
	borderStyle?: TableBorderStyle;
	/** Border color */
	borderColor?: string;
	/** Header background color */
	headerBg?: string;
	/** Whether to show headers */
	showHeader?: boolean;
	/** Table width */
	width?: number | 'auto';
	/** Compact mode (minimal borders) */
	compact?: boolean;
	/** No wrap (truncate long text) */
	noWrap?: boolean;
}

/**
 * Key-value table (2-column format like taskTable in ui.js)
 */
export interface KeyValueTableProps {
	/** Key-value pairs */
	data: Array<{ key: string; value: React.ReactNode }>;
	/** Key column width */
	keyWidth?: number;
	/** Border style */
	borderStyle?: TableBorderStyle;
	/** Border color */
	borderColor?: string;
	/** Show compact style */
	compact?: boolean;
}

/**
 * Calculate column widths
 */
function calculateColumnWidths(
	columns: TableColumn[],
	data: Record<string, unknown>[],
	totalWidth: number
): number[] {
	const fixedWidths = columns.map((col) =>
		typeof col.width === 'number' ? col.width : 0
	);
	const fixedTotal = fixedWidths.reduce((sum, w) => sum + w, 0);
	const autoColumns = columns.filter((col) => col.width === 'auto' || col.width === undefined);
	const autoCount = autoColumns.length;

	if (autoCount === 0) {
		return fixedWidths;
	}

	// Account for borders and padding
	const borderWidth = columns.length + 1;
	const availableWidth = totalWidth - fixedTotal - borderWidth;
	const autoWidth = Math.max(10, Math.floor(availableWidth / autoCount));

	return columns.map((col, i) =>
		typeof col.width === 'number' ? col.width : autoWidth
	);
}

/**
 * Truncate or pad text to fit width
 */
function fitText(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
	if (text.length > width) {
		return text.slice(0, width - 1) + '…';
	}

	const padding = width - text.length;
	switch (align) {
		case 'center':
			const leftPad = Math.floor(padding / 2);
			const rightPad = padding - leftPad;
			return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
		case 'right':
			return ' '.repeat(padding) + text;
		default:
			return text + ' '.repeat(padding);
	}
}

/**
 * Data table component matching cli-table3 patterns
 */
export function Table({
	columns,
	data,
	borderStyle = 'default',
	borderColor = colors.border,
	showHeader = true,
	width = 'auto',
	compact = false,
	noWrap = true
}: TableProps): React.ReactElement {
	const borders = compact ? tableBorders.minimal : tableBorders[borderStyle];
	const tableWidth = width === 'auto' ? getBoxWidth() : width;
	const colWidths = calculateColumnWidths(columns, data, tableWidth);

	// Build horizontal border line
	const buildHorizontalBorder = (
		leftChar: string,
		midChar: string,
		rightChar: string,
		lineChar: string
	): string => {
		if (!leftChar && !midChar && !rightChar && !lineChar) return '';
		return (
			leftChar +
			colWidths.map((w) => lineChar.repeat(w + 2)).join(midChar) +
			rightChar
		);
	};

	const topBorder = buildHorizontalBorder(
		borders.topLeft,
		borders.topMid,
		borders.topRight,
		borders.top
	);
	const midBorder = buildHorizontalBorder(
		borders.leftMid,
		borders.midMid,
		borders.rightMid,
		borders.mid
	);
	const bottomBorder = buildHorizontalBorder(
		borders.bottomLeft,
		borders.bottomMid,
		borders.bottomRight,
		borders.bottom
	);

	// Build a row
	const buildRow = (cells: React.ReactNode[], isHeader = false): React.ReactElement => {
		return (
			<Box>
				<Text color={borderColor}>{borders.left}</Text>
				{cells.map((cell, i) => (
					<React.Fragment key={i}>
						<Text> </Text>
						<Box width={colWidths[i]}>
							{typeof cell === 'string' ? (
								<Text bold={isHeader}>
									{noWrap
										? fitText(cell, colWidths[i], columns[i]?.align || 'left')
										: cell}
								</Text>
							) : (
								cell
							)}
						</Box>
						<Text> </Text>
						{i < cells.length - 1 && (
							<Text color={borderColor}>{borders.middle}</Text>
						)}
					</React.Fragment>
				))}
				<Text color={borderColor}>{borders.right}</Text>
			</Box>
		);
	};

	return (
		<Box flexDirection="column">
			{/* Top border */}
			{topBorder && <Text color={borderColor}>{topBorder}</Text>}

			{/* Header row */}
			{showHeader && (
				<>
					{buildRow(
						columns.map((col) => col.header),
						true
					)}
					{midBorder && <Text color={borderColor}>{midBorder}</Text>}
				</>
			)}

			{/* Data rows */}
			{data.map((row, rowIndex) => (
				<React.Fragment key={rowIndex}>
					{buildRow(
						columns.map((col) => {
							const value = row[col.key];
							if (col.render) {
								return col.render(value, row);
							}
							return String(value ?? '');
						})
					)}
					{rowIndex < data.length - 1 && compact && midBorder && (
						<Text color={borderColor}>{midBorder}</Text>
					)}
				</React.Fragment>
			))}

			{/* Bottom border */}
			{bottomBorder && <Text color={borderColor}>{bottomBorder}</Text>}
		</Box>
	);
}

/**
 * Key-value table (2-column format like taskTable in ui.js)
 */
export function KeyValueTable({
	data,
	keyWidth = 15,
	borderStyle = 'default',
	borderColor = colors.border,
	compact = false
}: KeyValueTableProps): React.ReactElement {
	const borders = compact ? tableBorders.none : tableBorders[borderStyle];

	if (compact) {
		// Compact mode: no borders, just aligned key-value pairs
		return (
			<Box flexDirection="column">
				{data.map((row, i) => (
					<Box key={i}>
						<Box width={keyWidth}>
							<Text color={colors.primary} bold>
								{row.key}:
							</Text>
						</Box>
						<Text> </Text>
						{typeof row.value === 'string' ? <Text>{row.value}</Text> : row.value}
					</Box>
				))}
			</Box>
		);
	}

	const tableWidth = getBoxWidth();
	const valueWidth = tableWidth - keyWidth - 7; // Account for borders and padding

	// Build borders
	const topBorder =
		borders.topLeft +
		borders.top.repeat(keyWidth + 2) +
		borders.topMid +
		borders.top.repeat(valueWidth + 2) +
		borders.topRight;
	const bottomBorder =
		borders.bottomLeft +
		borders.bottom.repeat(keyWidth + 2) +
		borders.bottomMid +
		borders.bottom.repeat(valueWidth + 2) +
		borders.bottomRight;

	return (
		<Box flexDirection="column">
			<Text color={borderColor}>{topBorder}</Text>
			{data.map((row, i) => (
				<Box key={i}>
					<Text color={borderColor}>{borders.left}</Text>
					<Text> </Text>
					<Box width={keyWidth}>
						<Text color={colors.primary} bold>
							{fitText(row.key, keyWidth)}
						</Text>
					</Box>
					<Text> </Text>
					<Text color={borderColor}>{borders.middle}</Text>
					<Text> </Text>
					<Box width={valueWidth}>
						{typeof row.value === 'string' ? (
							<Text>{row.value}</Text>
						) : (
							row.value
						)}
					</Box>
					<Text> </Text>
					<Text color={borderColor}>{borders.right}</Text>
				</Box>
			))}
			<Text color={borderColor}>{bottomBorder}</Text>
		</Box>
	);
}

/**
 * Simple list table (for task lists, etc.)
 */
export interface TaskListTableProps {
	tasks: Array<{
		id: string | number;
		title: string;
		status: string;
		priority?: string;
	}>;
	compact?: boolean;
}

export function TaskListTable({
	tasks,
	compact = false
}: TaskListTableProps): React.ReactElement {
	const columns: TableColumn[] = [
		{ header: 'ID', key: 'id', width: 6, align: 'right' },
		{ header: 'Title', key: 'title', width: 'auto' },
		{
			header: 'Status',
			key: 'status',
			width: 12,
			render: (value) => (
				<Text color={colors.statusPending}>{String(value)}</Text>
			)
		}
	];

	return (
		<Table
			columns={columns}
			data={tasks}
			compact={compact}
		/>
	);
}

