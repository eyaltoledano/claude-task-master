import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../theme.js';

export function CommandSuggestions({ suggestions, selectedIndex }) {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<Box
			flexDirection="column"
			marginLeft={0}
			marginBottom={0}
			paddingLeft={0}
			paddingRight={1}
		>
			<Box flexDirection="column">
				{suggestions.map((cmd, index) => {
					const isSelected = index === selectedIndex;
					return (
						<Box key={cmd.name} paddingLeft={1} flexDirection="row">
							<Box width={12}>
								<Text
									color={isSelected ? theme.accent : theme.text}
									bold={isSelected}
								>
									{cmd.name}
								</Text>
							</Box>
							<Text color={theme.textDim}>{cmd.description}</Text>
						</Box>
					);
				})}
			</Box>
		</Box>
	);
}
