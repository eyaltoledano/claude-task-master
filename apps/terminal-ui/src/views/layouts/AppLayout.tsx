import React from 'react';
import { Box, Text } from 'ink';

interface AppLayoutProps {
	title: string;
	subtitle?: React.ReactNode;
	instructions?: React.ReactNode;
	dimensions: { width: number; height: number };
	children: React.ReactNode;
}

/**
 * Main application layout with header, instructions, and content area
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
	title,
	subtitle,
	instructions,
	dimensions,
	children
}) => {
	return (
		<Box
			flexDirection="column"
			width={dimensions.width}
			height={dimensions.height}
		>
			{/* Header */}
			<Box
				borderStyle="single"
				borderBottom={true}
				paddingX={1}
				justifyContent="space-between"
				flexShrink={0}
			>
				<Text bold color="cyan">
					{title}
				</Text>
				{subtitle && <Text dimColor>{subtitle}</Text>}
			</Box>

			{/* Instructions */}
			{instructions && (
				<Box paddingX={1} paddingY={1} flexShrink={0}>
					{instructions}
				</Box>
			)}

			{/* Content */}
			{children}
		</Box>
	);
};
