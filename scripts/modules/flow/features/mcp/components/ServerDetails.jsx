import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../shared/theme/theme.js';

export function ServerDetails({
	selectedServer,
	serverTools,
	selectedIndex,
	scrollOffset,
	viewportHeight
}) {
	const visibleTools = serverTools.slice(
		scrollOffset,
		scrollOffset + viewportHeight
	);
	const showScrollIndicators = serverTools.length > viewportHeight;

	const getFullCommand = () => {
		if (selectedServer.transport !== 'stdio') return null;

		const cmd = selectedServer.scriptPath || selectedServer.command || '';
		const args = selectedServer.args || [];
		return `${cmd} ${args.join(' ')}`.trim();
	};

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
					<Text color={theme.text}>MCP Servers</Text>
					<Text color={theme.textDim}> › </Text>
					<Text color={theme.text}>{selectedServer.name}</Text>
				</Box>
				<Text color={theme.textDim}>[↵ view tool] [ESC back]</Text>
			</Box>

			{/* Server info - Enhanced Debug Information */}
			<Box
				paddingLeft={1}
				paddingRight={1}
				marginBottom={1}
				flexDirection="column"
			>
				{/* Basic Info */}
				<Box>
					<Text color={theme.textDim}>ID: </Text>
					<Text>{selectedServer.id}</Text>
				</Box>
				<Box>
					<Text color={theme.textDim}>Status: </Text>
					<Text
						color={
							selectedServer.status === 'active'
								? theme.success
								: selectedServer.status === 'error'
									? theme.error
									: theme.textDim
						}
					>
						{selectedServer.status === 'active'
							? '● '
							: selectedServer.status === 'error'
								? '● '
								: '○ '}
						{selectedServer.status}
					</Text>
				</Box>
				<Box>
					<Text color={theme.textDim}>Transport: </Text>
					<Text>{selectedServer.transport}</Text>
				</Box>
				<Box>
					<Text color={theme.textDim}>Scope: </Text>
					<Text>{selectedServer.scope}</Text>
				</Box>

				{/* Transport-specific info */}
				{selectedServer.transport === 'stdio' ? (
					<>
						<Box marginTop={1}>
							<Text color={theme.accent}>Command Details:</Text>
						</Box>
						<Box>
							<Text color={theme.textDim}>Executable: </Text>
							<Text>
								{selectedServer.scriptPath ||
									selectedServer.command ||
									'Not specified'}
							</Text>
						</Box>
						{selectedServer.args && selectedServer.args.length > 0 && (
							<Box flexDirection="column">
								<Text color={theme.textDim}>Arguments:</Text>
								<Box paddingLeft={2}>
									{selectedServer.args.map((arg, index) => (
										<Box key={`${arg}-${index}`}>
											<Text color={theme.text}>
												[{index}] {arg}
											</Text>
										</Box>
									))}
								</Box>
							</Box>
						)}
						<Box marginTop={1}>
							<Text color={theme.textDim}>Full Command:</Text>
						</Box>
						<Box paddingLeft={2}>
							<Text color={theme.textBright}>{getFullCommand()}</Text>
						</Box>
						{selectedServer.env &&
							Object.keys(selectedServer.env).length > 0 && (
								<Box flexDirection="column" marginTop={1}>
									<Text color={theme.textDim}>Environment Variables:</Text>
									<Box paddingLeft={2}>
										{Object.entries(selectedServer.env).map(([key, value]) => (
											<Box key={key}>
												<Text color={theme.warning}>{key}</Text>
												<Text>=</Text>
												<Text color={theme.text}>{value}</Text>
											</Box>
										))}
									</Box>
								</Box>
							)}
					</>
				) : (
					<>
						<Box marginTop={1}>
							<Text color={theme.accent}>Connection Details:</Text>
						</Box>
						<Box>
							<Text color={theme.textDim}>URL: </Text>
							<Text>{selectedServer.url}</Text>
						</Box>
						{selectedServer.headers &&
							Object.keys(selectedServer.headers).length > 0 && (
								<Box flexDirection="column" marginTop={1}>
									<Text color={theme.textDim}>Headers:</Text>
									<Box paddingLeft={2}>
										{Object.entries(selectedServer.headers).map(
											([key, value]) => (
												<Box key={key}>
													<Text color={theme.warning}>{key}: </Text>
													<Text color={theme.text}>{value}</Text>
												</Box>
											)
										)}
									</Box>
								</Box>
							)}
					</>
				)}

				{/* Additional Debug Info */}
				{selectedServer.createdAt && (
					<Box marginTop={1}>
						<Text color={theme.textDim}>Created: </Text>
						<Text>{new Date(selectedServer.createdAt).toLocaleString()}</Text>
					</Box>
				)}

				{selectedServer.error && (
					<Box marginTop={1} flexDirection="column">
						<Text color={theme.error}>Last Error:</Text>
						<Box paddingLeft={2}>
							<Text color={theme.error}>{selectedServer.error}</Text>
						</Box>
					</Box>
				)}
			</Box>

			{/* Tools section */}
			<Box flexGrow={1} flexDirection="column">
				<Box paddingLeft={1} marginBottom={1}>
					<Text color={theme.accent} bold>
						Available Tools ({serverTools.length})
					</Text>
				</Box>

				{/* Tool list header */}
				<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
					<Box width={3}>
						<Text> </Text>
					</Box>
					<Box width={30}>
						<Text color={theme.textDim} underline>
							Tool Name
						</Text>
					</Box>
					<Box flexGrow={1}>
						<Text color={theme.textDim} underline>
							Description
						</Text>
					</Box>
				</Box>

				{/* Scroll indicator (top) */}
				{showScrollIndicators && scrollOffset > 0 && (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>↑ {scrollOffset} more above</Text>
					</Box>
				)}

				{/* Tool rows */}
				{serverTools.length === 0 ? (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>
							{selectedServer.status === 'active'
								? 'No tools available from this server.'
								: 'Server is not connected. Connect to view tools.'}
						</Text>
					</Box>
				) : (
					visibleTools.map((tool, visibleIndex) => {
						const actualIndex = scrollOffset + visibleIndex;
						const isSelected = actualIndex === selectedIndex;

						return (
							<Box key={tool.name} paddingLeft={1} paddingRight={1}>
								<Box width={3}>
									<Text color={isSelected ? theme.accent : theme.textDim}>
										{isSelected ? '→' : ' '}
									</Text>
								</Box>
								<Box width={30}>
									<Text color={isSelected ? theme.accent : theme.text}>
										{tool.name}
									</Text>
								</Box>
								<Box flexGrow={1}>
									<Text color={theme.textDim}>
										{tool.description.length > 60
											? tool.description.substring(0, 57) + '...'
											: tool.description}
									</Text>
								</Box>
							</Box>
						);
					})
				)}

				{/* Scroll indicator (bottom) */}
				{showScrollIndicators &&
					scrollOffset + viewportHeight < serverTools.length && (
						<Box paddingLeft={1}>
							<Text color={theme.textDim}>
								↓ {serverTools.length - scrollOffset - viewportHeight} more
								below
							</Text>
						</Box>
					)}
			</Box>
		</Box>
	);
}
