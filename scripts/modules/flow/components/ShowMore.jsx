import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useComponentTheme } from '../hooks/index.js';

/**
 * ShowMore - Interactive indicator for expanding/collapsing content
 *
 * @param {boolean} isExpanded - Whether content is currently expanded
 * @param {function} onToggle - Callback to toggle expanded state
 * @param {number} hiddenLines - Number of lines currently hidden
 * @param {number} totalLines - Total number of lines in content
 * @param {boolean} isFocused - Whether this component is focused for keyboard interaction
 * @param {string} expandSymbol - Symbol to show when collapsed (default: "▼")
 * @param {string} collapseSymbol - Symbol to show when expanded (default: "▲")
 */
export function ShowMore({
	isExpanded,
	onToggle,
	hiddenLines = 0,
	totalLines = 0,
	isFocused = false,
	expandSymbol = '▼',
	collapseSymbol = '▲'
}) {
	const { theme } = useComponentTheme('showMore');

	// Safe color accessor with fallbacks
	const getColor = (colorPath, fallback = '#ffffff') => {
		if (typeof colorPath === 'string' && colorPath.length > 0) {
			return colorPath;
		}
		return fallback;
	};

	// Create theme colors with fallbacks
	const colors = {
		indicator: getColor(theme.indicator, '#60a5fa'),
		indicatorDim: getColor(theme.indicatorDim, '#94a3b8'),
		text: getColor(theme.text, '#cbd5e1'),
		textDim: getColor(theme.textDim, '#64748b'),
		focus: getColor(theme.focus, '#22d3ee'),
		background: getColor(theme.background, 'transparent')
	};

	// Handle keyboard input when focused
	useInput((input, key) => {
		if (!isFocused) return;

		if (key.return || input === ' ') {
			onToggle();
		}
	});

	// Generate the display text
	const generateDisplayText = () => {
		if (isExpanded) {
			return `${collapseSymbol} Show Less`;
		} else {
			const linesText = hiddenLines === 1 ? 'line' : 'lines';
			return `${expandSymbol} Show ${hiddenLines} more ${linesText}`;
		}
	};

	// Generate additional info text
	const generateInfoText = () => {
		if (isExpanded) {
			return `(${totalLines} total lines)`;
		} else {
			return `(${totalLines} total)`;
		}
	};

	return (
		<Box
			marginTop={0}
			marginBottom={0}
			backgroundColor={isFocused ? colors.background : 'transparent'}
			paddingLeft={isFocused ? 1 : 0}
			paddingRight={isFocused ? 1 : 0}
		>
			<Text
				color={isFocused ? colors.focus : colors.indicator}
				bold={isFocused}
			>
				{generateDisplayText()}
			</Text>
			<Text color={colors.textDim} marginLeft={1}>
				{generateInfoText()}
			</Text>
			{isFocused && (
				<Text color={colors.textDim} marginLeft={2}>
					[Enter/Space to toggle]
				</Text>
			)}
		</Box>
	);
}
