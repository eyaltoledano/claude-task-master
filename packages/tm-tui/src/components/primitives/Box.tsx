/**
 * @fileoverview Styled Box component for Task Master TUI
 * Matches the boxen patterns from scripts/modules/ui.js
 */

import React from 'react';
import { Box as InkBox, Text } from 'ink';
import { colors } from '../../theme/colors.js';
import { borderStyles, getBoxWidth, type BorderStyle } from '../../theme/borders.js';

export interface BoxProps {
	/** Box content */
	children: React.ReactNode;
	/** Border style matching boxen patterns */
	borderStyle?: BorderStyle;
	/** Border color */
	borderColor?: string;
	/** Semantic variant for quick styling */
	variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
	/** Box title (displayed in top border) */
	title?: string;
	/** Title alignment */
	titleAlign?: 'left' | 'center' | 'right';
	/** Padding inside the box */
	padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
	/** Margin outside the box */
	margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
	/** Fixed width (defaults to responsive) */
	width?: number | 'auto';
	/** Center the box horizontally */
	centered?: boolean;
}

/**
 * Get variant color
 */
function getVariantColor(variant: BoxProps['variant']): string {
	switch (variant) {
		case 'success':
			return colors.success;
		case 'warning':
			return colors.warning;
		case 'error':
			return colors.error;
		case 'info':
			return colors.info;
		case 'primary':
			return colors.primary;
		default:
			return colors.border;
	}
}

/**
 * Normalize padding/margin to object format
 */
function normalizeSpacing(
	spacing: number | { top?: number; right?: number; bottom?: number; left?: number } | undefined
): { top: number; right: number; bottom: number; left: number } {
	if (spacing === undefined) {
		return { top: 0, right: 0, bottom: 0, left: 0 };
	}
	if (typeof spacing === 'number') {
		return { top: spacing, right: spacing, bottom: spacing, left: spacing };
	}
	return {
		top: spacing.top ?? 0,
		right: spacing.right ?? 0,
		bottom: spacing.bottom ?? 0,
		left: spacing.left ?? 0
	};
}

/**
 * Create a horizontal border line
 */
function createBorderLine(
	width: number,
	char: string,
	leftCorner: string,
	rightCorner: string,
	color: string,
	title?: string,
	titleAlign?: 'left' | 'center' | 'right'
): React.ReactElement {
	const innerWidth = Math.max(0, width - 2);

	if (title && innerWidth > 0) {
		const titleText = ` ${title} `;
		const titleLen = titleText.length;
		const availableSpace = innerWidth - titleLen;

		if (availableSpace >= 0) {
			let leftPad = 0;
			let rightPad = availableSpace;

			if (titleAlign === 'center') {
				leftPad = Math.floor(availableSpace / 2);
				rightPad = availableSpace - leftPad;
			} else if (titleAlign === 'right') {
				leftPad = availableSpace;
				rightPad = 0;
			}

			return (
				<Text color={color}>
					{leftCorner}
					{char.repeat(leftPad)}
					{titleText}
					{char.repeat(rightPad)}
					{rightCorner}
				</Text>
			);
		}
	}

	return (
		<Text color={color}>
			{leftCorner}
			{char.repeat(innerWidth)}
			{rightCorner}
		</Text>
	);
}

/**
 * Styled Box component matching boxen patterns
 */
export function TMBox({
	children,
	borderStyle = 'round',
	borderColor,
	variant = 'default',
	title,
	titleAlign = 'left',
	padding = 1,
	margin = 0,
	width = 'auto',
	centered = false
}: BoxProps): React.ReactElement {
	const border = borderStyles[borderStyle];
	const color = borderColor || getVariantColor(variant);
	const pad = normalizeSpacing(padding);
	const mar = normalizeSpacing(margin);

	// Calculate box width
	const boxWidth = width === 'auto' ? getBoxWidth() : width;
	const contentWidth = boxWidth - 2 - pad.left - pad.right; // -2 for borders

	return (
		<InkBox
			flexDirection="column"
			marginTop={mar.top}
			marginRight={mar.right}
			marginBottom={mar.bottom}
			marginLeft={mar.left}
			alignItems={centered ? 'center' : 'flex-start'}
		>
			{/* Top border with optional title */}
			{createBorderLine(
				boxWidth,
				border.horizontal,
				border.topLeft,
				border.topRight,
				color,
				title,
				titleAlign
			)}

			{/* Top padding rows */}
			{Array.from({ length: pad.top }).map((_, i) => (
				<Text key={`pad-top-${i}`} color={color}>
					{border.vertical}
					{' '.repeat(boxWidth - 2)}
					{border.vertical}
				</Text>
			))}

			{/* Content with side borders and padding */}
			<InkBox flexDirection="row">
				<Text color={color}>{border.vertical}</Text>
				<InkBox
					paddingLeft={pad.left}
					paddingRight={pad.right}
					width={contentWidth + pad.left + pad.right}
				>
					<InkBox flexDirection="column">{children}</InkBox>
				</InkBox>
				<Text color={color}>{border.vertical}</Text>
			</InkBox>

			{/* Bottom padding rows */}
			{Array.from({ length: pad.bottom }).map((_, i) => (
				<Text key={`pad-bot-${i}`} color={color}>
					{border.vertical}
					{' '.repeat(boxWidth - 2)}
					{border.vertical}
				</Text>
			))}

			{/* Bottom border */}
			{createBorderLine(
				boxWidth,
				border.horizontal,
				border.bottomLeft,
				border.bottomRight,
				color
			)}
		</InkBox>
	);
}

// Re-export with simpler name
export { TMBox as Box };

