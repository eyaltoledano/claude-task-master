import React from 'react';
import { Box, Text } from 'ink';
import { useMCPManager } from '../hooks/useMCPManager.js';
import { theme } from '../../../shared/theme/theme.js';

export function AddServerForm() {
	const {
		pasteMode,
		pasteContent,
		formField,
		inputValue,
		formData,
		getFormFields
	} = useMCPManager();

	if (pasteMode) {
		return (
			<Box flexDirection="column" height="100%">
				{/* Header */}
				<Box
					borderStyle="single"
					borderColor={theme.border}
					paddingLeft={1}
					paddingRight={1}
					marginBottom={1}
				>
					<Box flexGrow={1}>
						<Text color={theme.accent}>Task Master</Text>
						<Text color={theme.textDim}> › </Text>
						<Text color={theme.text}>Paste MCP Server Config</Text>
					</Box>
					<Text color={theme.textDim}>[Ctrl+↵ submit] [ESC cancel]</Text>
				</Box>

				{/* Paste area */}
				<Box
					flexGrow={1}
					paddingLeft={2}
					paddingRight={2}
					flexDirection="column"
				>
					<Text color={theme.accent} bold>
						Paste MCP Server Configuration
					</Text>
					<Box height={1} />

					<Text color={theme.textDim}>
						Paste your JSON configuration below:
					</Text>
					<Text color={theme.textDim}>
						Press ESC at any time to cancel without saving.
					</Text>
					<Box height={1} />

					{/* JSON input area */}
					<Box
						borderStyle="single"
						borderColor={theme.border}
						paddingLeft={1}
						paddingRight={1}
						paddingTop={1}
						paddingBottom={1}
						flexGrow={1}
					>
						<Box flexDirection="column">
							{pasteContent.split('\\n').map((line, index) => (
								<Box key={`${line}-${index}`}>
									<Text color={theme.textBright}>
										{line}
										{index === pasteContent.split('\\n').length - 1 &&
											!pasteContent.endsWith('\\n') && (
												<Text color={theme.accent}>_</Text>
											)}
									</Text>
								</Box>
							))}
							{pasteContent.endsWith('\\n') && (
								<Text color={theme.accent}>_</Text>
							)}
						</Box>
					</Box>

					{/* Help text */}
					<Box marginTop={2} flexDirection="column">
						<Text color={theme.textDim}>Example format:</Text>
						<Box paddingLeft={2} marginTop={1}>
							<Text color={theme.text}>{`{
"mcpServers": {
"weather": {
  "command": "uvx",
  "args": ["--from", "git+https://github.com/...", "mcp-weather"],
  "env": {
    "API_KEY": "your_key_here"
  }
}
}
}`}</Text>
						</Box>
					</Box>
				</Box>
			</Box>
		);
	}

	// Regular form mode
	const fields = getFormFields();

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
			>
				<Box flexGrow={1}>
					<Text color={theme.accent}>Task Master</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>Add MCP Server</Text>
				</Box>
				<Text color={theme.textDim}>
					[↑↓ navigate] [TAB/Shift+TAB cycle] [↵ submit] [ESC cancel]
				</Text>
			</Box>

			{/* Form */}
			<Box flexGrow={1} paddingLeft={2} paddingRight={2} flexDirection="column">
				<Text color={theme.accent} bold>
					Add New MCP Server
				</Text>
				<Box height={1} />

				{/* Server Name */}
				<Box marginBottom={1}>
					<Box width={15}>
						<Text color={formField === 'name' ? theme.accent : theme.text}>
							Name:
						</Text>
					</Box>
					<Text color={formField === 'name' ? theme.textBright : theme.text}>
						{formField === 'name' ? inputValue : formData.name}
						{formField === 'name' && <Text color={theme.accent}>_</Text>}
					</Text>
				</Box>

				{/* Transport */}
				<Box marginBottom={1}>
					<Box width={15}>
						<Text color={formField === 'transport' ? theme.accent : theme.text}>
							Transport:
						</Text>
					</Box>
					<Text
						color={formField === 'transport' ? theme.textBright : theme.text}
					>
						{formField === 'transport' ? inputValue : formData.transport}
						{formField === 'transport' && <Text color={theme.accent}>_</Text>}
					</Text>
					<Text color={theme.textDim}> (stdio, sse, http)</Text>
				</Box>

				{/* Command (for stdio) */}
				{formData.transport === 'stdio' && (
					<>
						<Box marginBottom={1}>
							<Box width={15}>
								<Text
									color={formField === 'command' ? theme.accent : theme.text}
								>
									Command:
								</Text>
							</Box>
							<Text
								color={formField === 'command' ? theme.textBright : theme.text}
							>
								{formField === 'command' ? inputValue : formData.command}
								{formField === 'command' && <Text color={theme.accent}>_</Text>}
							</Text>
						</Box>

						<Box marginBottom={1}>
							<Box width={15}>
								<Text color={formField === 'args' ? theme.accent : theme.text}>
									Arguments:
								</Text>
							</Box>
							<Text
								color={formField === 'args' ? theme.textBright : theme.text}
							>
								{formField === 'args' ? inputValue : formData.args.join(' ')}
								{formField === 'args' && <Text color={theme.accent}>_</Text>}
							</Text>
							<Text color={theme.textDim}> (space-separated)</Text>
						</Box>

						<Box marginBottom={1}>
							<Box width={15}>
								<Text color={formField === 'env' ? theme.accent : theme.text}>
									Environment:
								</Text>
							</Box>
							<Text color={formField === 'env' ? theme.textBright : theme.text}>
								{formField === 'env'
									? inputValue
									: Object.entries(formData.env)
											.map(([k, v]) => `${k}=${v}`)
											.join(' ')}
								{formField === 'env' && <Text color={theme.accent}>_</Text>}
							</Text>
							<Text color={theme.textDim}> (KEY=value pairs)</Text>
						</Box>
					</>
				)}

				{/* URL and Headers (for sse/http) */}
				{formData.transport !== 'stdio' && (
					<>
						<Box marginBottom={1}>
							<Box width={15}>
								<Text color={formField === 'url' ? theme.accent : theme.text}>
									URL:
								</Text>
							</Box>
							<Text color={formField === 'url' ? theme.textBright : theme.text}>
								{formField === 'url' ? inputValue : formData.url}
								{formField === 'url' && <Text color={theme.accent}>_</Text>}
							</Text>
						</Box>

						<Box marginBottom={1}>
							<Box width={15}>
								<Text
									color={formField === 'headers' ? theme.accent : theme.text}
								>
									Headers:
								</Text>
							</Box>
							<Text
								color={formField === 'headers' ? theme.textBright : theme.text}
							>
								{formField === 'headers'
									? inputValue
									: Object.entries(formData.headers)
											.map(([k, v]) => `${k}: ${v}`)
											.join(', ')}
								{formField === 'headers' && <Text color={theme.accent}>_</Text>}
							</Text>
							<Text color={theme.textDim}> (Header: value, ...)</Text>
						</Box>
					</>
				)}

				{/* Scope */}
				<Box marginBottom={2}>
					<Box width={15}>
						<Text color={formField === 'scope' ? theme.accent : theme.text}>
							Scope:
						</Text>
					</Box>
					<Text color={formField === 'scope' ? theme.textBright : theme.text}>
						{formField === 'scope' ? inputValue : formData.scope}
						{formField === 'scope' && <Text color={theme.accent}>_</Text>}
					</Text>
					<Text color={theme.textDim}> (local, project, user)</Text>
				</Box>

				{/* Buttons */}
				<Box>
					<Box
						paddingX={2}
						borderStyle="single"
						borderColor={formField === 'submit' ? theme.accent : theme.border}
					>
						<Text color={formField === 'submit' ? theme.accent : theme.text}>
							Submit
						</Text>
					</Box>
					<Box
						marginLeft={2}
						paddingX={2}
						borderStyle="single"
						borderColor={formField === 'cancel' ? theme.accent : theme.border}
					>
						<Text color={formField === 'cancel' ? theme.accent : theme.text}>
							Cancel
						</Text>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}
