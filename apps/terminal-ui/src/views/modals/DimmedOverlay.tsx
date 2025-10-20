import React from 'react';
import { Box, Text } from 'ink';

interface DimmedOverlayProps {
	width: number;
	height: number;
}

export const DimmedOverlay: React.FC<DimmedOverlayProps> = ({
	width,
	height
}) => {
	return (
		<Box position="absolute" width="100%" height="100%" flexDirection="column">
			{Array.from({ length: height }).map((_, i) => (
				<Box key={i} width="100%">
					<Text dimColor>{' '.repeat(width)}</Text>
				</Box>
			))}
		</Box>
	);
};
