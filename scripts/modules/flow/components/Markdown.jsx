import React from 'react';
import { Box, Text } from 'ink';
import SyntaxHighlight from 'ink-syntax-highlight';
import { getCurrentTheme } from '../theme.js';

/**
 * Simple but robust markdown renderer for Ink
 * Handles essential markdown features without external dependencies
 */

const parseInlineMarkdown = (text, theme) => {
	if (!text || typeof text !== 'string') {
		return <Text color={theme.text} />;
	}

	const parts = [];
	let remaining = text;
	let key = 0;

	while (remaining.length > 0) {
		// Find the next markdown pattern
		const patterns = [
			{ regex: /`([^`]+)`/, type: 'code' },
			{ regex: /\*\*([^*]+)\*\*/, type: 'bold' },
			{ regex: /\*([^*]+)\*/, type: 'italic' },
			{ regex: /~~([^~]+)~~/, type: 'strikethrough' },
			{ regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' }
		];

		let earliestMatch = null;
		let earliestIndex = remaining.length;

		for (const pattern of patterns) {
			const match = remaining.match(pattern.regex);
			if (match && match.index < earliestIndex) {
				earliestMatch = { ...pattern, match };
				earliestIndex = match.index;
			}
		}

		if (earliestMatch) {
			// Add text before the match
			if (earliestIndex > 0) {
				const beforeText = remaining.substring(0, earliestIndex);
				parts.push(
					<Text key={key++} color={theme.text}>
						{beforeText}
					</Text>
				);
			}

			// Add the formatted match
			const { match, type } = earliestMatch;
			switch (type) {
				case 'code':
					parts.push(
						<Text key={key++} backgroundColor="gray" color={theme.accent}>
							{match[1]}
						</Text>
					);
					break;
				case 'bold':
					parts.push(
						<Text key={key++} bold color={theme.text}>
							{match[1]}
						</Text>
					);
					break;
				case 'italic':
					parts.push(
						<Text key={key++} italic color={theme.text}>
							{match[1]}
						</Text>
					);
					break;
				case 'strikethrough':
					parts.push(
						<Text key={key++} strikethrough color={theme.textDim}>
							{match[1]}
						</Text>
					);
					break;
				case 'link':
					parts.push(
						<Text key={key++} color={theme.info} underline>
							{match[1]} ({match[2]})
						</Text>
					);
					break;
			}

			remaining = remaining.substring(earliestIndex + match[0].length);
		} else {
			// No more patterns found, add the rest as plain text
			if (remaining) {
				parts.push(
					<Text key={key++} color={theme.text}>
						{remaining}
					</Text>
				);
			}
			break;
		}
	}

	return parts.length === 0 ? <Text color={theme.text} /> : parts;
};

const renderMarkdownLine = (line, lineIndex, theme) => {
	const trimmed = line.trim();
	
	// Empty line
	if (!trimmed) {
		return <Box key={lineIndex} height={1} />;
	}

	// Headers
	const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
	if (headerMatch) {
		const level = headerMatch[1].length;
		const text = headerMatch[2];
		const colors = [theme.accent, theme.success, theme.info, theme.warning, theme.text, theme.textDim];
		const color = colors[Math.min(level - 1, colors.length - 1)];
		
		return (
			<Box key={lineIndex} marginY={1}>
				<Text bold color={color}>
					{text}
				</Text>
			</Box>
		);
	}

	// Code blocks (simple single-line detection)
	if (trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.length > 6) {
		const code = trimmed.slice(3, -3);
		return (
			<Box key={lineIndex} marginY={1} paddingX={2} borderStyle="single" borderColor={theme.textDim}>
				<SyntaxHighlight code={code} />
			</Box>
		);
	}

	// Lists
	const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
	if (listMatch) {
		const isOrdered = /^\d+\./.test(listMatch[1]);
		const bullet = isOrdered ? '1. ' : '• ';
		const content = listMatch[2];
		
		return (
			<Box key={lineIndex} marginLeft={2}>
				<Text color={theme.text}>
					{bullet}
				</Text>
				{parseInlineMarkdown(content, theme)}
			</Box>
		);
	}

	// Blockquotes
	if (trimmed.startsWith('>')) {
		const content = trimmed.substring(1).trim();
		return (
			<Box key={lineIndex} marginY={1} paddingLeft={2} borderLeft borderColor={theme.textDim}>
				<Text color={theme.textDim} italic>
					{content}
				</Text>
			</Box>
		);
	}

	// Horizontal rule
	if (trimmed.match(/^---+$/)) {
		return (
			<Box key={lineIndex} marginY={1}>
				<Text color={theme.textDim}>
					{'─'.repeat(50)}
				</Text>
			</Box>
		);
	}

	// Regular paragraph with inline formatting
	return (
		<Box key={lineIndex} marginY={1}>
			{parseInlineMarkdown(trimmed, theme)}
		</Box>
	);
};

/**
 * Markdown component for rendering markdown content in ink
 */
export const Markdown = ({ content, ...props }) => {
	const theme = getCurrentTheme();

	if (!content || typeof content !== 'string') {
		return <Text color={theme.textDim}>No content to display</Text>;
	}

	const lines = content.split('\n');
	const elements = [];
	let inCodeBlock = false;
	let codeBlockLines = [];
	let codeBlockLanguage = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Handle multi-line code blocks
		if (trimmed.startsWith('```')) {
			if (inCodeBlock) {
				// End of code block
				elements.push(
					<Box key={`code-${i}`} marginY={1} paddingX={2} borderStyle="single" borderColor={theme.textDim}>
						{codeBlockLanguage && (
							<Box marginBottom={1}>
								<Text color={theme.textDim} bold>
									{codeBlockLanguage}
								</Text>
							</Box>
						)}
						<SyntaxHighlight 
							code={codeBlockLines.join('\n')} 
							language={codeBlockLanguage || 'text'}
						/>
					</Box>
				);
				codeBlockLines = [];
				codeBlockLanguage = '';
				inCodeBlock = false;
			} else {
				// Start of code block
				codeBlockLanguage = trimmed.substring(3);
				inCodeBlock = true;
			}
			continue;
		}

		if (inCodeBlock) {
			codeBlockLines.push(line);
			continue;
		}

		elements.push(renderMarkdownLine(line, i, theme));
	}

	return (
		<Box flexDirection="column" {...props}>
			{elements}
		</Box>
	);
};

export default Markdown; 