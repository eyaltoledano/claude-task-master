import React from 'react';
import { Box, Text } from 'ink';
import { useOverflow } from '../contexts/OverflowContext.jsx';
import { useComponentTheme } from '../hooks/index.js';

/**
 * OverflowIndicator - Global indicator showing when content is overflowing
 * 
 * This component displays a subtle indicator when there are overflowing
 * content blocks that can be expanded. It's typically placed in a footer
 * or corner of the screen.
 * 
 * @param {string} position - Position of indicator: 'bottom-right', 'bottom-left', 'top-right', 'top-left'
 * @param {boolean} showCount - Whether to show the count of overflowing items
 * @param {string} symbol - Symbol to display (default: "...")
 * @param {string} message - Custom message template (default: "{count} items can be expanded")
 */
export function OverflowIndicator({ 
	position = 'bottom-right',
	showCount = true,
	symbol = "⋯",
	message = "{count} more content available"
}) {
	const { hasOverflowingContent, getOverflowCount } = useOverflow();
	const { theme } = useComponentTheme('overflowIndicator');
	
	// Safe color accessor with fallbacks
	const getColor = (colorPath, fallback = '#ffffff') => {
		if (typeof colorPath === 'string' && colorPath.length > 0) {
			return colorPath;
		}
		return fallback;
	};

	// Create theme colors with fallbacks
	const colors = {
		indicator: getColor(theme.indicator, '#94a3b8'),
		text: getColor(theme.text, '#64748b'),
		background: getColor(theme.background, 'transparent'),
		border: getColor(theme.border, '#374151')
	};

	// Don't render if no overflowing content
	if (!hasOverflowingContent()) {
		return null;
	}

	const overflowCount = getOverflowCount();
	
	// Generate display text
	const displayText = showCount && overflowCount > 0
		? message.replace('{count}', overflowCount.toString())
		: symbol;

	// Determine positioning styles
	const getPositionStyles = () => {
		switch (position) {
			case 'bottom-left':
				return { justifyContent: 'flex-start', alignItems: 'flex-end' };
			case 'top-right':
				return { justifyContent: 'flex-end', alignItems: 'flex-start' };
			case 'top-left':
				return { justifyContent: 'flex-start', alignItems: 'flex-start' };
			default:
				return { justifyContent: 'flex-end', alignItems: 'flex-end' };
		}
	};

	const positionStyles = getPositionStyles();

	return (
		<Box
			position="absolute"
			bottom={position.includes('bottom') ? 0 : undefined}
			top={position.includes('top') ? 0 : undefined}
			left={position.includes('left') ? 0 : undefined}
			right={position.includes('right') ? 0 : undefined}
			width="100%"
			height="100%"
			{...positionStyles}
			pointerEvents="none"
		>
			<Box
				paddingX={1}
				paddingY={0}
				backgroundColor={colors.background}
				borderStyle={showCount ? "round" : undefined}
				borderColor={showCount ? colors.border : undefined}
			>
				<Text color={colors.indicator}>
					{symbol}
				</Text>
				{showCount && overflowCount > 0 && (
					<Text color={colors.text} marginLeft={1}>
						{overflowCount} expandable
					</Text>
				)}
			</Box>
		</Box>
	);
} 