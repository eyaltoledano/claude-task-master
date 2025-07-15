import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useOverflow } from '../../../contexts/OverflowContext.jsx';
import { ShowMore } from './ShowMore.jsx';

/**
 * OverflowableText - A smart wrapper for text content that might need truncation
 *
 * @param {string} id - Unique identifier for this content block
 * @param {string} content - The full text content to display
 * @param {number} maxLines - Maximum lines to show before truncating (default: 10)
 * @param {string} color - Text color (optional)
 * @param {boolean} dimWhenCollapsed - Whether to dim text when collapsed (default: false)
 * @param {Object} textProps - Additional props to pass to Text component
 */
export function OverflowableText({
	id,
	content,
	maxLines = 10,
	color,
	dimWhenCollapsed = false,
	textProps = {},
	...boxProps
}) {
	const {
		registerComponent,
		unregisterComponent,
		updateOverflowState,
		toggleExpanded,
		getOverflowState
	} = useOverflow();

	const [isInitialized, setIsInitialized] = useState(false);

	// Get current overflow state
	const overflowState = getOverflowState(id);
	const { isOverflowing, isExpanded } = overflowState;

	// Calculate content metrics
	const contentMetrics = useMemo(() => {
		if (!content) {
			return {
				lines: [],
				totalLines: 0,
				shouldTruncate: false,
				visibleLines: [],
				truncatedContent: ''
			};
		}

		// Split content into lines
		const lines = content.split('\n');
		const totalLines = lines.length;
		const shouldTruncate = totalLines > maxLines;

		// Determine visible lines
		const visibleLines =
			shouldTruncate && !isExpanded ? lines.slice(0, maxLines) : lines;

		// Create truncated content string
		const truncatedContent = visibleLines.join('\n');

		return {
			lines,
			totalLines,
			shouldTruncate,
			visibleLines,
			truncatedContent
		};
	}, [content, maxLines, isExpanded]);

	// Register component on mount and update overflow state
	useEffect(() => {
		registerComponent(id, { maxLines });
		setIsInitialized(true);

		return () => {
			unregisterComponent(id);
		};
	}, [id, maxLines, registerComponent, unregisterComponent]);

	// Update overflow state when content changes
	useEffect(() => {
		if (isInitialized) {
			updateOverflowState(id, {
				isOverflowing: contentMetrics.shouldTruncate,
				totalLines: contentMetrics.totalLines,
				maxLines
			});
		}
	}, [
		id,
		contentMetrics.shouldTruncate,
		contentMetrics.totalLines,
		maxLines,
		updateOverflowState,
		isInitialized
	]);

	// Handle expand/collapse toggle
	const handleToggle = () => {
		toggleExpanded(id);
	};

	// Don't render anything if no content
	if (!content) {
		return null;
	}

	// Determine text color
	const textColor =
		color ||
		(dimWhenCollapsed && isOverflowing && !isExpanded ? 'gray' : undefined);

	return (
		<Box flexDirection="column" {...boxProps}>
			{/* Main content */}
			<Box>
				<Text color={textColor} {...textProps}>
					{contentMetrics.truncatedContent}
				</Text>
			</Box>

			{/* Show More/Less indicator */}
			{contentMetrics.shouldTruncate && (
				<ShowMore
					isExpanded={isExpanded}
					onToggle={handleToggle}
					hiddenLines={
						contentMetrics.totalLines -
						(isExpanded ? contentMetrics.totalLines : maxLines)
					}
					totalLines={contentMetrics.totalLines}
				/>
			)}
		</Box>
	);
}
