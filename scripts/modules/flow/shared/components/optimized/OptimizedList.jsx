import React, { memo, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useVirtualScroll } from '../../hooks/usePerformance.js';

/**
 * Optimized list component with virtualization
 */
export const OptimizedList = memo(
	({
		items,
		renderItem,
		itemHeight = 1,
		maxHeight = 20,
		keyExtractor = (item, index) => index,
		emptyMessage = 'No items to display',
		header,
		footer
	}) => {
		const { visibleItems, totalHeight, handleScroll, scrollTop } =
			useVirtualScroll(items, maxHeight, itemHeight);

		const containerStyle = useMemo(
			() => ({
				height: Math.min(totalHeight, maxHeight),
				overflow: 'hidden',
				position: 'relative'
			}),
			[totalHeight, maxHeight]
		);

		const contentStyle = useMemo(
			() => ({
				height: totalHeight,
				position: 'relative'
			}),
			[totalHeight]
		);

		if (items.length === 0) {
			return (
				<Box flexDirection="column">
					{header}
					<Text color="gray">{emptyMessage}</Text>
					{footer}
				</Box>
			);
		}

		return (
			<Box flexDirection="column">
				{header}
				<Box {...containerStyle}>
					<Box {...contentStyle}>
						{visibleItems.map((item) => (
							<Box key={keyExtractor(item, item.index)} {...item.style}>
								{renderItem(item, item.index)}
							</Box>
						))}
					</Box>
				</Box>
				{footer}
			</Box>
		);
	}
);

OptimizedList.displayName = 'OptimizedList';

/**
 * Memoized list item wrapper
 */
export const ListItem = memo(({ children, isSelected, onClick }) => {
	const handleClick = useCallback(() => {
		if (onClick) onClick();
	}, [onClick]);

	return (
		<Box
			flexDirection="row"
			backgroundColor={isSelected ? 'blue' : undefined}
			onClick={handleClick}
		>
			{children}
		</Box>
	);
});

ListItem.displayName = 'ListItem';

/**
 * Batch update list component
 */
export const BatchUpdateList = memo(({ items, renderItem, batchSize = 10 }) => {
	const [renderedCount, setRenderedCount] = React.useState(batchSize);

	React.useEffect(() => {
		if (renderedCount < items.length) {
			const timer = setTimeout(() => {
				setRenderedCount((prev) => Math.min(prev + batchSize, items.length));
			}, 0);
			return () => clearTimeout(timer);
		}
	}, [renderedCount, items.length, batchSize]);

	const visibleItems = useMemo(
		() => items.slice(0, renderedCount),
		[items, renderedCount]
	);

	return (
		<Box flexDirection="column">
			{visibleItems.map((item, index) => (
				<Box key={item.id || index}>{renderItem(item, index)}</Box>
			))}
			{renderedCount < items.length && (
				<Text color="gray">
					Loading more... ({renderedCount}/{items.length})
				</Text>
			)}
		</Box>
	);
});

BatchUpdateList.displayName = 'BatchUpdateList';
