import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../shared/theme/theme.js';

export function ServerList({ servers, selectedIndex, error, scrollOffset, viewportHeight }) {
	const visibleServers = servers.slice(
		scrollOffset,
		scrollOffset + viewportHeight
	);
	const showScrollIndicators = servers.length > viewportHeight;

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
				</Box>
				<Text color={theme.textDim}>
					[a add] [p paste] [d remove] [space connect] [↵ details] [ESC back]
				</Text>
			</Box>

			{/* Server table */}
			<Box flexGrow={1} flexDirection="column">
				{/* Table header */}
				<Box paddingLeft={1} paddingRight={1} marginBottom={1}>
					<Box width={3}>
						<Text> </Text>
					</Box>
					<Box width={3}>
						<Text color={theme.textDim} underline>
							{' '}
						</Text>
					</Box>
					<Box width={25}>
						<Text color={theme.textDim} underline>
							Name
						</Text>
					</Box>
					<Box width={12}>
						<Text color={theme.textDim} underline>
							Transport
						</Text>
					</Box>
					<Box width={12}>
						<Text color={theme.textDim} underline>
							Status
						</Text>
					</Box>
					<Box width={10}>
						<Text color={theme.textDim} underline>
							Scope
						</Text>
					</Box>
					<Box width={8}>
						<Text color={theme.textDim} underline>
							Tools
						</Text>
					</Box>
					<Box width={30}>
						<Text color={theme.textDim} underline>
							Path/URL
						</Text>
					</Box>
				</Box>

				{/* Scroll indicator (top) */}
				{showScrollIndicators && scrollOffset > 0 && (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>↑ {scrollOffset} more above</Text>
					</Box>
				)}

				{/* Server rows */}
				{servers.length === 0 ? (
					<Box paddingLeft={1}>
						<Text color={theme.textDim}>
							No MCP servers configured. Press 'a' to add one.
						</Text>
					</Box>
				) : (
					visibleServers.map((server, visibleIndex) => {
						const actualIndex = scrollOffset + visibleIndex;
						const isSelected = actualIndex === selectedIndex;

						return (
							<Box
								key={server.id || server.name}
								paddingLeft={1}
								paddingRight={1}
							>
								<Box width={3}>
									<Text color={isSelected ? theme.accent : theme.textDim}>
										{isSelected ? '→' : ' '}
									</Text>
								</Box>
								<Box width={3}>
									<Text
										color={
											server.status === 'active'
												? theme.success
												: server.status === 'error'
													? theme.error
													: theme.textDim
										}
									>
										{server.status === 'active'
											? '●'
											: server.status === 'error'
												? '●'
												: '○'}
									</Text>
								</Box>
								<Box width={25}>
									<Text color={isSelected ? theme.accent : theme.text}>
										{server.name}
										{server.default && <Text color={theme.warning}> *</Text>}
									</Text>
								</Box>
								<Box width={12}>
									<Text color={theme.text}>{server.transport}</Text>
								</Box>
								<Box width={12}>
									<Text
										color={
											server.status === 'active'
												? theme.success
												: server.status === 'authenticated'
													? theme.success
													: server.status === 'connecting'
														? theme.warning
														: server.status === 'error'
															? theme.error
															: theme.textDim
										}
									>
										{server.status}
									</Text>
								</Box>
								<Box width={10}>
									<Text color={theme.text}>{server.scope}</Text>
								</Box>
								<Box width={8}>
									<Text color={theme.textDim}>
										{server.toolCount !== null ? `[${server.toolCount}]` : '-'}
									</Text>
								</Box>
								<Box width={30}>
									<Text color={theme.textDim}>
										{server.transport === 'stdio'
											? server.scriptPath || server.command || '-'
											: server.url || '-'}
									</Text>
								</Box>
							</Box>
						);
					})
				)}

				{/* Scroll indicator (bottom) */}
				{showScrollIndicators &&
					scrollOffset + viewportHeight < servers.length && (
						<Box paddingLeft={1}>
							<Text color={theme.textDim}>
								↓ {servers.length - scrollOffset - viewportHeight} more below
							</Text>
						</Box>
					)}
			</Box>

			{/* Footer */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				borderTop={true}
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				paddingTop={1}
				paddingLeft={1}
				paddingRight={1}
			>
				{error ? (
					<Text color={theme.error}>{error}</Text>
				) : (
					<Text color={theme.textDim}>
						{servers.length} server{servers.length !== 1 ? 's' : ''} configured
						{servers.filter((s) => s.status === 'active').length > 0 && (
							<Text color={theme.success}>
								{' '}
								• {servers.filter((s) => s.status === 'active').length}{' '}
								connected
							</Text>
						)}
					</Text>
				)}
			</Box>
		</Box>
	);
} 