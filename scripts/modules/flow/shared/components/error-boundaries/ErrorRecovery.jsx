import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

/**
 * Error recovery component with retry logic
 */
export const ErrorRecovery = ({
	error,
	onRetry,
	onCancel,
	maxRetries = 3,
	retryDelay = 1000,
	showError = true
}) => {
	const [retryCount, setRetryCount] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);
	const [countdown, setCountdown] = useState(null);

	useInput((input, key) => {
		if (!isRetrying) {
			if (input === 'r' && retryCount < maxRetries) {
				handleRetry();
			} else if (key.escape && onCancel) {
				onCancel();
			}
		}
	});

	useEffect(() => {
		if (countdown !== null && countdown > 0) {
			const timer = setTimeout(() => {
				setCountdown(countdown - 1);
			}, 1000);
			return () => clearTimeout(timer);
		} else if (countdown === 0) {
			performRetry();
		}
	}, [countdown]);

	const handleRetry = () => {
		setIsRetrying(true);
		setCountdown(Math.ceil(retryDelay / 1000));
	};

	const performRetry = async () => {
		try {
			await onRetry();
			// If successful, component will unmount
		} catch (retryError) {
			setRetryCount((prev) => prev + 1);
			setIsRetrying(false);
			setCountdown(null);
		}
	};

	const canRetry = retryCount < maxRetries;

	return (
		<Box flexDirection="column" padding={1}>
			{showError && (
				<>
					<Text color="red" bold>
						⚠️ Error
					</Text>
					<Text color="red">{error?.message || 'An error occurred'}</Text>
					<Box marginTop={1} />
				</>
			)}

			{isRetrying ? (
				<Box flexDirection="column">
					<Text color="yellow">Retrying in {countdown}...</Text>
					<Text color="gray" dimColor>
						Attempt {retryCount + 1} of {maxRetries}
					</Text>
				</Box>
			) : (
				<>
					{canRetry ? (
						<Box flexDirection="column">
							<Text color="yellow">
								Press 'r' to retry ({retryCount}/{maxRetries} attempts)
							</Text>
							{onCancel && <Text color="gray">Press ESC to cancel</Text>}
						</Box>
					) : (
						<Box flexDirection="column">
							<Text color="red">Maximum retry attempts reached</Text>
							{onCancel && <Text color="gray">Press ESC to go back</Text>}
						</Box>
					)}
				</>
			)}
		</Box>
	);
};

/**
 * Hook for error recovery logic
 */
export const useErrorRecovery = (options = {}) => {
	const { maxRetries = 3, retryDelay = 1000, onError, onSuccess } = options;

	const [error, setError] = useState(null);
	const [retryCount, setRetryCount] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);

	const executeWithRetry = async (operation) => {
		setError(null);
		setIsRetrying(true);

		try {
			const result = await operation();
			setError(null);
			setRetryCount(0);
			setIsRetrying(false);
			if (onSuccess) onSuccess(result);
			return result;
		} catch (err) {
			setError(err);
			setIsRetrying(false);
			if (onError) onError(err);
			throw err;
		}
	};

	const retry = async (operation) => {
		if (retryCount >= maxRetries) {
			throw new Error('Maximum retry attempts exceeded');
		}

		setRetryCount((prev) => prev + 1);

		// Wait before retrying
		await new Promise((resolve) => setTimeout(resolve, retryDelay));

		return executeWithRetry(operation);
	};

	const reset = () => {
		setError(null);
		setRetryCount(0);
		setIsRetrying(false);
	};

	return {
		error,
		retryCount,
		isRetrying,
		canRetry: retryCount < maxRetries,
		executeWithRetry,
		retry,
		reset
	};
};
