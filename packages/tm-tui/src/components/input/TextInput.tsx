/**
 * @fileoverview Text input component for Task Master TUI
 * Matches readline prompt patterns from scripts/init.js
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import InkTextInput from 'ink-text-input';
import { colors } from '../../theme/colors.js';
import { logIcons } from '../../theme/icons.js';

export interface TextInputProps {
	/** Input label/prompt (optional for simple use) */
	label?: string;
	/** Placeholder text */
	placeholder?: string;
	/** Default value */
	defaultValue?: string;
	/** Current value (controlled) */
	value?: string;
	/** Callback when value changes */
	onChange?: (value: string) => void;
	/** Callback when enter is pressed */
	onSubmit?: (value: string) => void;
	/** Whether the input is focused */
	isFocused?: boolean;
	/** Show success/error state after submit */
	showResult?: boolean;
	/** Custom result formatter */
	formatResult?: (value: string) => { text: string; isSuccess: boolean };
}

/**
 * Text input with optional prompt label
 * Can be used standalone (no label) or with a label/prompt
 */
export function TextInput({
	label,
	placeholder = '',
	defaultValue = '',
	value: controlledValue,
	onChange,
	onSubmit,
	isFocused = true,
	showResult = false,
	formatResult
}: TextInputProps): React.ReactElement {
	const [internalValue, setInternalValue] = useState(controlledValue ?? defaultValue);
	const [submitted, setSubmitted] = useState(false);

	const value = controlledValue ?? internalValue;

	const handleChange = (newValue: string) => {
		setInternalValue(newValue);
		onChange?.(newValue);
	};

	const handleSubmit = (finalValue: string) => {
		setSubmitted(true);
		onSubmit?.(finalValue || defaultValue);
	};

	// After submission, show the result
	if (submitted && showResult && label) {
		const result = formatResult
			? formatResult(value || defaultValue)
			: { text: value || defaultValue, isSuccess: true };

		return (
			<Box>
				<Text color={colors.primary}>{label}</Text>
				<Text> </Text>
				<Text color={result.isSuccess ? colors.success : colors.error}>
					{result.isSuccess ? logIcons.success : logIcons.error}
				</Text>
				<Text> </Text>
				<Text dimColor>{result.text}</Text>
			</Box>
		);
	}

	// Simple mode without label (for shell input)
	if (!label) {
		return (
			<InkTextInput
				value={value}
				onChange={handleChange}
				onSubmit={handleSubmit}
				placeholder={placeholder}
				focus={isFocused}
			/>
		);
	}

	return (
		<Box>
			<Text color={colors.primary}>{label}</Text>
			<Text> </Text>
			<InkTextInput
				value={value}
				onChange={handleChange}
				onSubmit={handleSubmit}
				placeholder={placeholder}
				focus={isFocused}
			/>
		</Box>
	);
}

/**
 * Confirmation prompt (Y/n style)
 */
export interface ConfirmInputProps {
	/** Question to ask */
	question: string;
	/** Default answer (true = Y, false = n) */
	defaultValue?: boolean;
	/** Callback when answered */
	onSubmit?: (confirmed: boolean) => void;
	/** Whether the input is focused */
	isFocused?: boolean;
}

export function ConfirmInput({
	question,
	defaultValue = true,
	onSubmit,
	isFocused = true
}: ConfirmInputProps): React.ReactElement {
	const [answered, setAnswered] = useState(false);
	const [result, setResult] = useState<boolean | null>(null);

	useInput(
		(input, key) => {
			if (!isFocused || answered) return;

			const lowerInput = input.toLowerCase();

			if (lowerInput === 'y' || (key.return && defaultValue)) {
				setAnswered(true);
				setResult(true);
				onSubmit?.(true);
			} else if (lowerInput === 'n' || (key.return && !defaultValue)) {
				setAnswered(true);
				setResult(false);
				onSubmit?.(false);
			}
		},
		{ isActive: isFocused && !answered }
	);

	if (answered) {
		return (
			<Box>
				<Text color={colors.primary}>{question}</Text>
				<Text> </Text>
				<Text color={result ? colors.success : colors.error}>
					{result ? logIcons.success : logIcons.error}
				</Text>
				<Text> </Text>
				<Text dimColor>{result ? 'Yes' : 'No'}</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Text color={colors.primary}>{question}</Text>
			<Text> </Text>
			<Text dimColor>({defaultValue ? 'Y/n' : 'y/N'}): </Text>
			<Text color={colors.primary}>_</Text>
		</Box>
	);
}

/**
 * Multi-step form input
 */
export interface FormField {
	key: string;
	label: string;
	type: 'text' | 'confirm' | 'select';
	defaultValue?: string | boolean;
	placeholder?: string;
	options?: Array<{ label: string; value: string }>;
}

export interface FormInputProps {
	fields: FormField[];
	onSubmit?: (values: Record<string, string | boolean>) => void;
	onCancel?: () => void;
}

export function FormInput({
	fields,
	onSubmit,
	onCancel
}: FormInputProps): React.ReactElement {
	const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
	const [values, setValues] = useState<Record<string, string | boolean>>({});

	const currentField = fields[currentFieldIndex];
	const isComplete = currentFieldIndex >= fields.length;

	const handleFieldSubmit = (value: string | boolean) => {
		const newValues = { ...values, [currentField.key]: value };
		setValues(newValues);

		if (currentFieldIndex < fields.length - 1) {
			setCurrentFieldIndex((prev) => prev + 1);
		} else {
			onSubmit?.(newValues);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			onCancel?.();
		}
	});

	if (isComplete) {
		return (
			<Box flexDirection="column">
				<Text color={colors.success}>Form complete!</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{/* Show completed fields */}
			{fields.slice(0, currentFieldIndex).map((field) => (
				<Box key={field.key}>
					<Text color={colors.primary}>{field.label}</Text>
					<Text> </Text>
					<Text color={colors.success}>{logIcons.success}</Text>
					<Text> </Text>
					<Text dimColor>{String(values[field.key])}</Text>
				</Box>
			))}

			{/* Current field */}
			{currentField.type === 'text' && (
				<TextInput
					label={currentField.label}
					defaultValue={currentField.defaultValue as string}
					placeholder={currentField.placeholder}
					onSubmit={(v) => handleFieldSubmit(v)}
					isFocused={true}
				/>
			)}

			{currentField.type === 'confirm' && (
				<ConfirmInput
					question={currentField.label}
					defaultValue={currentField.defaultValue as boolean}
					onSubmit={(v) => handleFieldSubmit(v)}
					isFocused={true}
				/>
			)}
		</Box>
	);
}

export default TextInput;

