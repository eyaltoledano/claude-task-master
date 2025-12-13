/**
 * @fileoverview Error Boundary Component
 * Catches React errors and provides graceful fallback UI
 */

import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { classifyError } from '../utils/error-handling.js';
import { logger } from '../utils/logger.js';

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
	/** Child components */
	children: ReactNode;
	/** Fallback component to render on error */
	fallback?: ReactNode;
	/** Callback when error occurs */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	/** Whether to show technical details */
	showDetails?: boolean;
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null
		};
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return {
			hasError: true,
			error,
			errorInfo: null
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		// Classify and log the error
		const classified = classifyError(error);
		logger.error('React component error', error, {
			componentStack: errorInfo.componentStack,
			category: classified.category,
			severity: classified.severity
		});

		// Update state with error info
		this.setState({ errorInfo });

		// Call onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}
	}

	render(): ReactNode {
		if (this.state.hasError && this.state.error) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI
			const classified = classifyError(this.state.error);

			return (
				<Box
					flexDirection="column"
					padding={1}
					borderStyle="round"
					borderColor="red"
				>
					<Box marginBottom={1}>
						<Text bold color="red">
							⚠ Application Error
						</Text>
					</Box>

					<Box marginBottom={1}>
						<Text>{classified.message}</Text>
					</Box>

					{classified.recoveryActions &&
						classified.recoveryActions.length > 0 && (
							<Box flexDirection="column" marginBottom={1}>
								<Text bold>Suggested Actions:</Text>
								{classified.recoveryActions.map((action, index) => (
									<Text key={index}> • {action}</Text>
								))}
							</Box>
						)}

					{this.props.showDetails && this.state.errorInfo && (
						<Box flexDirection="column" marginTop={1}>
							<Text dimColor>Component Stack:</Text>
							<Text dimColor>
								{this.state.errorInfo.componentStack
									?.split('\n')
									.slice(0, 5)
									.join('\n')}
							</Text>
						</Box>
					)}

					<Box marginTop={1}>
						<Text dimColor>
							Press Ctrl+C to exit and try the suggested actions
						</Text>
					</Box>
				</Box>
			);
		}

		return this.props.children;
	}
}

/**
 * Default error fallback component
 */
export const DefaultErrorFallback: React.FC<{ error?: Error }> = ({
	error
}) => {
	const classified = error ? classifyError(error) : null;

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="red"
		>
			<Box marginBottom={1}>
				<Text bold color="red">
					⚠ Something went wrong
				</Text>
			</Box>

			{classified && (
				<>
					<Box marginBottom={1}>
						<Text>{classified.message}</Text>
					</Box>

					{classified.recoveryActions &&
						classified.recoveryActions.length > 0 && (
							<Box flexDirection="column">
								<Text bold>What you can do:</Text>
								{classified.recoveryActions.map((action, index) => (
									<Text key={index}> • {action}</Text>
								))}
							</Box>
						)}
				</>
			)}

			<Box marginTop={1}>
				<Text dimColor>Press Ctrl+C to exit</Text>
			</Box>
		</Box>
	);
};

export default ErrorBoundary;
