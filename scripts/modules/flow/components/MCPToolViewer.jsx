import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { connectionPool } from '../infra/mcp/connection-pool.js';
import { theme } from '../shared/theme/theme.js';

export function MCPToolViewer({ tool, serverId, onBack, log }) {
	const [testMode, setTestMode] = useState(false);
	const [testArgs, setTestArgs] = useState('{}');
	const [testResult, setTestResult] = useState(null);
	const [isTestingTool, setIsTestingTool] = useState(false);
	const [error, setError] = useState(null);
	const [showResultActions, setShowResultActions] = useState(false);

	useInput((input, key) => {
		if (testMode) return;

		if (testResult && showResultActions) {
			if (input === 'c') {
				// Copy to clipboard functionality would go here
				log.info('Result copied to clipboard (feature coming soon)');
				setShowResultActions(false);
			} else if (input === 's') {
				// Save to file functionality would go here
				log.info('Result saved to file (feature coming soon)');
				setShowResultActions(false);
			} else if (key.escape) {
				setShowResultActions(false);
			}
			return;
		}

		if (input === 't') {
			setTestMode(true);
			setTestResult(null);
			setError(null);
		} else if (input === 'r' && testResult) {
			setShowResultActions(true);
		} else if (key.escape || input === 'b') {
			onBack();
		}
	});

	const handleTestTool = async () => {
		try {
			setIsTestingTool(true);
			setError(null);

			const client = connectionPool.getClient(serverId);
			if (!client) {
				throw new Error('Server not connected');
			}

			// Parse and validate JSON args
			let args;
			try {
				args = JSON.parse(testArgs);
			} catch (e) {
				throw new Error('Invalid JSON arguments');
			}

			const result = await client.callTool(tool.name, args);
			setTestResult(result);
			setTestMode(false);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsTestingTool(false);
		}
	};

	const renderParameters = () => {
		if (!tool.inputSchema || !tool.inputSchema.properties) {
			return <Text color={theme.textDim}>No parameters</Text>;
		}

		return Object.entries(tool.inputSchema.properties).map(([key, schema]) => (
			<Box key={key} marginLeft={2}>
				<Text color="yellow">{key}</Text>
				<Text>: </Text>
				<Text color={theme.textDim}>{schema.type}</Text>
				{schema.description && (
					<Text color={theme.textDim}> - {schema.description}</Text>
				)}
				{tool.inputSchema.required?.includes(key) && (
					<Text color="red"> *</Text>
				)}
			</Box>
		));
	};

	const renderTestResult = () => {
		if (!testResult) return null;

		// Handle different types of results
		if (typeof testResult === 'string') {
			return <Text>{testResult}</Text>;
		}

		if (testResult.type === 'text') {
			return <Text>{testResult.text || testResult.content}</Text>;
		}

		if (testResult.type === 'error') {
			return <Text color="red">{testResult.error || testResult.message}</Text>;
		}

		// For complex objects, pretty print
		return <Text>{JSON.stringify(testResult, null, 2)}</Text>;
	};

	const renderExampleArgs = () => {
		if (!tool.inputSchema || !tool.inputSchema.properties) {
			return '{}';
		}

		const example = {};
		Object.entries(tool.inputSchema.properties).forEach(([key, schema]) => {
			// Generate example values based on type
			switch (schema.type) {
				case 'string':
					example[key] =
						schema.example || (schema.enum ? schema.enum[0] : 'example-string');
					break;
				case 'number':
					example[key] = schema.example || 42;
					break;
				case 'boolean':
					example[key] = schema.example !== undefined ? schema.example : true;
					break;
				case 'array':
					example[key] = schema.example || [];
					break;
				case 'object':
					example[key] = schema.example || {};
					break;
				default:
					example[key] = null;
			}
		});

		// Only include required fields in the example
		if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
			const requiredExample = {};
			tool.inputSchema.required.forEach((key) => {
				if (key in example) {
					requiredExample[key] = example[key];
				}
			});
			return JSON.stringify(requiredExample, null, 2);
		}

		return JSON.stringify(example, null, 2);
	};

	if (testMode) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color={theme.accent}>
					Test Tool: {tool.name}
				</Text>

				<Box marginTop={1}>
					<Text>Arguments (JSON):</Text>
				</Box>

				<Box marginTop={1} marginBottom={1}>
					<TextInput
						value={testArgs}
						onChange={setTestArgs}
						onSubmit={handleTestTool}
						placeholder={renderExampleArgs()}
					/>
				</Box>

				<Box marginBottom={1}>
					<Text color={theme.textDim}>Example: {renderExampleArgs()}</Text>
				</Box>

				{isTestingTool && (
					<Box>
						<Spinner type="dots" />
						<Text> Running tool...</Text>
					</Box>
				)}

				{error && (
					<Box marginTop={1}>
						<Text color="red">Error: {error}</Text>
					</Box>
				)}

				<Box marginTop={1}>
					<Text color={theme.textDim}>Enter: Run Test • Esc: Cancel</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color={theme.accent}>
				{tool.name}
			</Text>

			{tool.description && (
				<Box marginTop={1}>
					<Text>{tool.description}</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text bold>Parameters:</Text>
			</Box>
			{renderParameters()}

			{tool.inputSchema?.required && tool.inputSchema.required.length > 0 && (
				<Box marginTop={1}>
					<Text color="red">* Required parameters</Text>
				</Box>
			)}

			{testResult && (
				<Box marginTop={2} flexDirection="column">
					<Text bold color="green">
						Test Result:
					</Text>
					<Box
						marginTop={1}
						borderStyle="round"
						borderColor="green"
						padding={1}
					>
						{renderTestResult()}
					</Box>
				</Box>
			)}

			{error && (
				<Box marginTop={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			<Box marginTop={2}>
				<Text color={theme.textDim}>T: Test Tool • R: Save/Copy • B: Back</Text>
			</Box>
		</Box>
	);
}
