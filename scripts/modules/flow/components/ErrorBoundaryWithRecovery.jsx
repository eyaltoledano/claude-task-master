import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Alert, StatusMessage, Badge } from '@inkjs/ui';

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		this.setState({
			error: error,
			errorInfo: errorInfo
		});

		// Integrate with telemetry service following VibeKit patterns
		this.props.onError &&
			this.props.onError({
				type: 'COMPONENT_ERROR',
				error: error.message,
				stack: error.stack,
				componentStack: errorInfo.componentStack,
				timestamp: new Date().toISOString()
			});
	}

	render() {
		if (this.state.hasError) {
			return (
				<ErrorRecoveryComponent
					error={this.state.error}
					errorInfo={this.state.errorInfo}
					onRecover={() =>
						this.setState({ hasError: false, error: null, errorInfo: null })
					}
				/>
			);
		}

		return this.props.children;
	}
}

function ErrorRecoveryComponent({ error, errorInfo, onRecover }) {
	const [recoveryAttempts, setRecoveryAttempts] = useState(0);
	const [lastRecoveryTime, setLastRecoveryTime] = useState(null);

	useInput((input, key) => {
		if (input === 'r' && recoveryAttempts < 3) {
			setRecoveryAttempts((prev) => prev + 1);
			setLastRecoveryTime(new Date().toLocaleTimeString());
			onRecover();
		}
		if (input === 'q') {
			process.exit(1);
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Alert variant="error">
				<Box flexDirection="column">
					<Text color="red" bold>
						Component Error Detected
					</Text>
					<Text>Error: {error?.message || 'Unknown error'}</Text>
					{lastRecoveryTime && (
						<Text color="gray">Last recovery attempt: {lastRecoveryTime}</Text>
					)}
				</Box>
			</Alert>

			<Box marginTop={1}>
				<Badge color={recoveryAttempts < 3 ? 'yellow' : 'red'}>
					Recovery attempts: {recoveryAttempts}/3
				</Badge>
			</Box>

			<Box marginTop={1}>
				<Text color="cyan">
					{recoveryAttempts < 3
						? '[r] Attempt Recovery | [q] Quit'
						: 'Max recovery attempts reached. [q] Quit'}
				</Text>
			</Box>
		</Box>
	);
}

export default ErrorBoundary;
