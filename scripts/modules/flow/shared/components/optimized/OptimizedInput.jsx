import React, { memo, useCallback, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useDebounce, useThrottle } from '../../hooks/usePerformance.js';

/**
 * Debounced text input component
 */
export const DebouncedInput = memo(
	({
		value,
		onChange,
		onDebounceChange,
		placeholder,
		delay = 300,
		...props
	}) => {
		const [localValue, setLocalValue] = useState(value);
		const debouncedValue = useDebounce(localValue, delay);

		useEffect(() => {
			setLocalValue(value);
		}, [value]);

		useEffect(() => {
			if (debouncedValue !== value && onDebounceChange) {
				onDebounceChange(debouncedValue);
			}
		}, [debouncedValue, value, onDebounceChange]);

		const handleChange = useCallback(
			(newValue) => {
				setLocalValue(newValue);
				if (onChange) {
					onChange(newValue);
				}
			},
			[onChange]
		);

		return (
			<TextInput
				value={localValue}
				onChange={handleChange}
				placeholder={placeholder}
				{...props}
			/>
		);
	}
);

DebouncedInput.displayName = 'DebouncedInput';

/**
 * Throttled input component for real-time updates
 */
export const ThrottledInput = memo(
	({ value, onChange, placeholder, throttleDelay = 100, ...props }) => {
		const [localValue, setLocalValue] = useState(value);

		const throttledOnChange = useThrottle(onChange, throttleDelay);

		useEffect(() => {
			setLocalValue(value);
		}, [value]);

		const handleChange = useCallback(
			(newValue) => {
				setLocalValue(newValue);
				throttledOnChange(newValue);
			},
			[throttledOnChange]
		);

		return (
			<TextInput
				value={localValue}
				onChange={handleChange}
				placeholder={placeholder}
				{...props}
			/>
		);
	}
);

ThrottledInput.displayName = 'ThrottledInput';

/**
 * Optimized search input with suggestions
 */
export const SearchInput = memo(
	({
		value,
		onChange,
		onSearch,
		suggestions = [],
		placeholder = 'Search...',
		debounceDelay = 300,
		showSuggestions = true,
		maxSuggestions = 5
	}) => {
		const [localValue, setLocalValue] = useState(value);
		const [selectedIndex, setSelectedIndex] = useState(0);
		const debouncedValue = useDebounce(localValue, debounceDelay);

		useEffect(() => {
			if (debouncedValue && onSearch) {
				onSearch(debouncedValue);
			}
		}, [debouncedValue, onSearch]);

		const handleChange = useCallback(
			(newValue) => {
				setLocalValue(newValue);
				setSelectedIndex(0);
				if (onChange) {
					onChange(newValue);
				}
			},
			[onChange]
		);

		const visibleSuggestions = suggestions.slice(0, maxSuggestions);

		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">🔍 </Text>
					<TextInput
						value={localValue}
						onChange={handleChange}
						placeholder={placeholder}
					/>
				</Box>

				{showSuggestions && localValue && visibleSuggestions.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						{visibleSuggestions.map((suggestion, index) => (
							<Text
								key={suggestion.id || index}
								color={index === selectedIndex ? 'blue' : 'gray'}
							>
								{index === selectedIndex ? '▶ ' : '  '}
								{suggestion.label || suggestion}
							</Text>
						))}
					</Box>
				)}
			</Box>
		);
	}
);

SearchInput.displayName = 'SearchInput';

/**
 * Controlled input with validation
 */
export const ValidatedInput = memo(
	({
		value,
		onChange,
		validator,
		placeholder,
		errorMessage = 'Invalid input',
		showError = true
	}) => {
		const [localValue, setLocalValue] = useState(value);
		const [error, setError] = useState(null);
		const [touched, setTouched] = useState(false);

		const validate = useCallback(
			(val) => {
				if (validator) {
					const isValid = validator(val);
					setError(isValid ? null : errorMessage);
					return isValid;
				}
				return true;
			},
			[validator, errorMessage]
		);

		const handleChange = useCallback(
			(newValue) => {
				setLocalValue(newValue);
				setTouched(true);

				const isValid = validate(newValue);
				if (onChange) {
					onChange(newValue, isValid);
				}
			},
			[onChange, validate]
		);

		return (
			<Box flexDirection="column">
				<TextInput
					value={localValue}
					onChange={handleChange}
					placeholder={placeholder}
				/>
				{showError && touched && error && (
					<Text color="red" fontSize="small">
						{error}
					</Text>
				)}
			</Box>
		);
	}
);

ValidatedInput.displayName = 'ValidatedInput';
