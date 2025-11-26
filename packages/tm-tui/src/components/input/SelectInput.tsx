/**
 * @fileoverview Select input component for Task Master TUI
 * Matches the inquirer patterns from scripts/init.js
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme/colors.js';
import { decorativeIcons } from '../../theme/icons.js';

export interface SelectOption<T = string> {
	/** Display label */
	label: string;
	/** Option value */
	value: T;
	/** Short label for after selection */
	short?: string;
	/** Description (multi-line) */
	description?: string | string[];
	/** Whether option is disabled */
	disabled?: boolean;
}

export interface SelectInputProps<T = string> {
	/** Options to select from */
	options: SelectOption<T>[];
	/** Initial selected value */
	initialValue?: T;
	/** Callback when selection changes */
	onChange?: (value: T, option: SelectOption<T>) => void;
	/** Callback when selection is confirmed */
	onSubmit?: (value: T, option: SelectOption<T>) => void;
	/** Whether the input is focused */
	isFocused?: boolean;
	/** Indicator character for selected item */
	indicator?: string;
	/** Show descriptions inline */
	showDescriptions?: boolean;
	/** Limit visible items (for scrolling) */
	limit?: number;
}

/**
 * Select input component
 */
export function SelectInput<T = string>({
	options,
	initialValue,
	onChange,
	onSubmit,
	isFocused = true,
	indicator = decorativeIcons.arrow,
	showDescriptions = true,
	limit
}: SelectInputProps<T>): React.ReactElement {
	const [selectedIndex, setSelectedIndex] = useState(() => {
		if (initialValue !== undefined) {
			const index = options.findIndex((opt) => opt.value === initialValue);
			return index >= 0 ? index : 0;
		}
		return 0;
	});

	// Calculate visible range for scrolling
	const visibleStart = limit
		? Math.max(0, Math.min(selectedIndex - Math.floor(limit / 2), options.length - limit))
		: 0;
	const visibleEnd = limit ? Math.min(visibleStart + limit, options.length) : options.length;
	const visibleOptions = options.slice(visibleStart, visibleEnd);

	useInput(
		(input, key) => {
			if (!isFocused) return;

			if (key.upArrow || input === 'k') {
				const newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
				setSelectedIndex(newIndex);
				onChange?.(options[newIndex].value, options[newIndex]);
			}

			if (key.downArrow || input === 'j') {
				const newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
				setSelectedIndex(newIndex);
				onChange?.(options[newIndex].value, options[newIndex]);
			}

			if (key.return) {
				const option = options[selectedIndex];
				if (!option.disabled) {
					onSubmit?.(option.value, option);
				}
			}
		},
		{ isActive: isFocused }
	);

	const renderDescription = (description: string | string[]): React.ReactNode => {
		if (Array.isArray(description)) {
			return (
				<Box flexDirection="column" marginLeft={3}>
					{description.map((line, i) => (
						<Text key={i} dimColor>
							{line}
						</Text>
					))}
				</Box>
			);
		}
		return (
			<Box marginLeft={3}>
				<Text dimColor>{description}</Text>
			</Box>
		);
	};

	return (
		<Box flexDirection="column">
			{/* Scroll indicator at top */}
			{limit && visibleStart > 0 && (
				<Text color={colors.textDim}>  ↑ {visibleStart} more</Text>
			)}

			{visibleOptions.map((option, visibleIdx) => {
				const actualIndex = visibleStart + visibleIdx;
				const isSelected = actualIndex === selectedIndex;
				const isDisabled = option.disabled;

				return (
					<Box key={actualIndex} flexDirection="column">
						<Box>
							{/* Indicator */}
							<Text color={isSelected ? colors.primary : undefined}>
								{isSelected ? indicator : ' '}
							</Text>
							<Text> </Text>

							{/* Label */}
							<Text
								color={isDisabled ? colors.textMuted : undefined}
								bold={isSelected}
								dimColor={isDisabled}
							>
								{option.label}
							</Text>
						</Box>

						{/* Description (only for selected or always visible) */}
						{showDescriptions && option.description && isSelected && (
							renderDescription(option.description)
						)}
					</Box>
				);
			})}

			{/* Scroll indicator at bottom */}
			{limit && visibleEnd < options.length && (
				<Text color={colors.textDim}>  ↓ {options.length - visibleEnd} more</Text>
			)}
		</Box>
	);
}

/**
 * Rich card-style select (matching the init.js storage selection)
 */
export interface CardSelectOption<T = string> extends SelectOption<T> {
	/** Title line (bold) */
	title: string;
	/** Feature bullet points */
	features?: string[];
}

export interface CardSelectInputProps<T = string> {
	/** Card options */
	options: CardSelectOption<T>[];
	/** Header text above the options */
	header?: string;
	/** Callback when selection is confirmed */
	onSubmit?: (value: T, option: CardSelectOption<T>) => void;
	/** Initial value */
	initialValue?: T;
}

export function CardSelectInput<T = string>({
	options,
	header,
	onSubmit,
	initialValue
}: CardSelectInputProps<T>): React.ReactElement {
	const [selectedIndex, setSelectedIndex] = useState(() => {
		if (initialValue !== undefined) {
			const index = options.findIndex((opt) => opt.value === initialValue);
			return index >= 0 ? index : 0;
		}
		return 0;
	});

	useInput((input, key) => {
		if (key.upArrow || input === 'k') {
			setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
		}

		if (key.downArrow || input === 'j') {
			setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
		}

		if (key.return) {
			const option = options[selectedIndex];
			onSubmit?.(option.value, option);
		}
	});

	return (
		<Box flexDirection="column">
			{/* Header */}
			{header && (
				<Box marginBottom={1}>
					<Text bold color={colors.primary}>
						{header}
					</Text>
				</Box>
			)}

			{/* Options as cards */}
			{options.map((option, index) => {
				const isSelected = index === selectedIndex;

				return (
					<Box
						key={index}
						flexDirection="column"
						marginBottom={1}
						borderStyle={isSelected ? 'round' : undefined}
						borderColor={isSelected ? colors.primary : undefined}
						paddingLeft={isSelected ? 1 : 2}
						paddingRight={1}
					>
						{/* Title with indicator */}
						<Box>
							<Text color={isSelected ? colors.primary : undefined}>
								{isSelected ? decorativeIcons.arrow : ' '}
							</Text>
							<Text> </Text>
							<Text bold={isSelected}>{option.title}</Text>
						</Box>

						{/* Features (bullet points) */}
						{option.features && isSelected && (
							<Box flexDirection="column" marginLeft={3} marginTop={1}>
								{option.features.map((feature, i) => (
									<Text key={i}>
										<Text dimColor>• </Text>
										<Text>{feature}</Text>
									</Text>
								))}
							</Box>
						)}
					</Box>
				);
			})}
		</Box>
	);
}

