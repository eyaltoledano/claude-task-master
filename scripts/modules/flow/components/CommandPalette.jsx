import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { style, getComponentTheme } from '../theme.js';
import { useAppContext } from '../index.jsx';

export const CommandPalette = ({
	input,
	suggestions,
	selectedIndex,
	onSelect,
	onClose
}) => {
	const cmdTheme = getComponentTheme('modal');

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor={style('', 'border.primary')}
			padding={1}
			marginTop={1}
			marginBottom={1}
		>
			{/* Input field */}
			<Box marginBottom={1}>
				<Text>{style('› ', 'accent')}</Text>
				<Text>{style(input, 'text.primary')}</Text>
				<Text>{style('_', 'text.tertiary')}</Text>
			</Box>

			{/* Suggestions list */}
			{suggestions.length > 0 && (
				<Box flexDirection="column">
					{suggestions.map((suggestion, index) => {
						const isSelected = index === selectedIndex;
						const textColor = isSelected
							? cmdTheme.selectedText || 'text.inverse'
							: 'text.primary';
						const bgColor = isSelected
							? cmdTheme.selectedBackground || 'interactive.selected'
							: 'transparent';

						return (
							<Box
								key={`cmd-${suggestion.command}-${index}`}
								backgroundColor={isSelected ? style('', bgColor) : undefined}
								paddingLeft={1}
								paddingRight={1}
							>
								<Box width={20}>
									<Text color={style('', textColor)}>{suggestion.command}</Text>
								</Box>
								<Text
									color={style('', isSelected ? textColor : 'text.secondary')}
								>
									{suggestion.description}
								</Text>
							</Box>
						);
					})}
				</Box>
			)}

			{/* Help text */}
			<Box marginTop={1}>
				<Text>{style('Enter: Select • ESC: Cancel', 'text.tertiary')}</Text>
			</Box>
		</Box>
	);
};
