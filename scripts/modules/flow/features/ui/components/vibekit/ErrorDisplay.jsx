import React from 'react';
import { Box, Text } from 'ink';

const ErrorDisplay = ({ error, agent, onRetry, onCancel }) => {
	const getErrorType = (errorMessage) => {
		if (errorMessage.includes('API key')) return 'api-key';
		if (errorMessage.includes('rate limit')) return 'rate-limit';
		if (errorMessage.includes('network')) return 'network';
		if (errorMessage.includes('sandbox')) return 'sandbox';
		if (errorMessage.includes('GitHub')) return 'github';
		return 'general';
	};

	const getErrorSuggestion = (errorType, errorMessage) => {
		switch (errorType) {
			case 'api-key':
				return 'Please set the appropriate API key in your environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY).';
			case 'rate-limit':
				return 'You have exceeded the API rate limit. Please wait a few minutes before trying again.';
			case 'network':
				return 'Check your internet connection and try again.';
			case 'sandbox':
				return 'Sandbox environment is unavailable. Please check your E2B configuration and API key.';
			case 'github':
				return 'GitHub integration failed. Please check your GitHub token and repository permissions.';
			default:
				return 'Please try again or contact support if the issue persists.';
		}
	};

	const getErrorEmoji = (errorType) => {
		switch (errorType) {
			case 'api-key':
				return '🔑';
			case 'rate-limit':
				return '⏱️';
			case 'network':
				return '🌐';
			case 'sandbox':
				return '📦';
			case 'github':
				return '🐙';
			default:
				return '❌';
		}
	};

	const errorType = getErrorType(error);
	const suggestion = getErrorSuggestion(errorType, error);
	const emoji = getErrorEmoji(errorType);

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor="red"
			padding={1}
		>
			<Box marginBottom={1}>
				<Text bold color="red">
					{emoji} Code Generation Failed
				</Text>
			</Box>

			{agent && (
				<Box marginBottom={1}>
					<Text>
						<Text bold>Agent:</Text>{' '}
						{agent.charAt(0).toUpperCase() + agent.slice(1)}
					</Text>
				</Box>
			)}

			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="red">
					Error Details:
				</Text>
				<Text dimColor wrap="wrap">
					{error}
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="yellow">
					💡 Suggestion:
				</Text>
				<Text dimColor wrap="wrap">
					{suggestion}
				</Text>
			</Box>

			{errorType === 'api-key' && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color="cyan">
						🔧 API Key Setup:
					</Text>
					<Text dimColor>For Claude: export ANTHROPIC_API_KEY=your_key</Text>
					<Text dimColor>For Codex: export OPENAI_API_KEY=your_key</Text>
					<Text dimColor>For Gemini: export GOOGLE_API_KEY=your_key</Text>
					<Text dimColor>For E2B: export E2B_API_KEY=your_key</Text>
				</Box>
			)}

			{errorType === 'github' && (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color="cyan">
						🔧 GitHub Setup:
					</Text>
					<Text dimColor>export GITHUB_API_KEY=your_token</Text>
					<Text dimColor>Ensure token has 'repo' permissions</Text>
				</Box>
			)}

			<Box flexDirection="row" marginTop={1} gap={2}>
				<Box marginRight={2}>
					<Text bold color="cyan">
						Press R to retry
					</Text>
				</Box>
				<Box>
					<Text bold color="red">
						Press ESC to cancel
					</Text>
				</Box>
			</Box>

			<Box marginTop={1}>
				<Text dimColor>
					Fix the issue above and retry, or cancel to return to the subtask
					view.
				</Text>
			</Box>
		</Box>
	);
};

export { ErrorDisplay };
