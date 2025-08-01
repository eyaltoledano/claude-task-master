import type React from 'react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
	content,
	className = ''
}) => {
	const parseMarkdown = (text: string) => {
		const parts = [];
		const lines = text.split('\n');
		let currentBlock = [];
		let inCodeBlock = false;
		let codeLanguage = '';

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.startsWith('```')) {
				if (inCodeBlock) {
					if (currentBlock.length > 0) {
						parts.push({
							type: 'code',
							content: currentBlock.join('\n'),
							language: codeLanguage
						});
						currentBlock = [];
					}
					inCodeBlock = false;
					codeLanguage = '';
				} else {
					if (currentBlock.length > 0) {
						parts.push({
							type: 'text',
							content: currentBlock.join('\n')
						});
						currentBlock = [];
					}
					inCodeBlock = true;
					codeLanguage = line.substring(3).trim();
				}
			} else {
				currentBlock.push(line);
			}
		}

		if (currentBlock.length > 0) {
			parts.push({
				type: inCodeBlock ? 'code' : 'text',
				content: currentBlock.join('\n'),
				language: codeLanguage
			});
		}

		return parts;
	};

	const parts = parseMarkdown(content);

	return (
		<div className={className}>
			{parts.map((part, index) => {
				if (part.type === 'code') {
					return (
						<pre
							key={index}
							className="bg-vscode-editor-background rounded-md p-4 overflow-x-auto mb-4 border border-vscode-editor-lineHighlightBorder"
						>
							<code className="text-sm text-vscode-editor-foreground font-mono">
								{part.content}
							</code>
						</pre>
					);
				}
				return (
					<div key={index} className="whitespace-pre-wrap mb-4 last:mb-0">
						{part.content.split('\n').map((line, lineIndex) => {
							const bulletMatch = line.match(/^(\s*)([-*])\s(.+)$/);
							if (bulletMatch) {
								const indent = bulletMatch[1].length;
								return (
									<div
										key={lineIndex}
										className="flex gap-2 mb-1"
										style={{ paddingLeft: `${indent * 16}px` }}
									>
										<span className="text-vscode-foreground/60">•</span>
										<span className="flex-1">{bulletMatch[3]}</span>
									</div>
								);
							}

							const numberedMatch = line.match(/^(\s*)(\d+\.)\s(.+)$/);
							if (numberedMatch) {
								const indent = numberedMatch[1].length;
								return (
									<div
										key={lineIndex}
										className="flex gap-2 mb-1"
										style={{ paddingLeft: `${indent * 16}px` }}
									>
										<span className="text-vscode-foreground/60 font-mono">
											{numberedMatch[2]}
										</span>
										<span className="flex-1">{numberedMatch[3]}</span>
									</div>
								);
							}

							const headingMatch = line.match(/^(#{1,6})\s(.+)$/);
							if (headingMatch) {
								const level = headingMatch[1].length;
								const headingLevel = Math.min(level + 2, 6);
								const headingClassName =
									'font-semibold text-vscode-foreground mb-2 mt-4 first:mt-0';

								switch (headingLevel) {
									case 3:
										return (
											<h3 key={lineIndex} className={headingClassName}>
												{headingMatch[2]}
											</h3>
										);
									case 4:
										return (
											<h4 key={lineIndex} className={headingClassName}>
												{headingMatch[2]}
											</h4>
										);
									case 5:
										return (
											<h5 key={lineIndex} className={headingClassName}>
												{headingMatch[2]}
											</h5>
										);
									case 6:
										return (
											<h6 key={lineIndex} className={headingClassName}>
												{headingMatch[2]}
											</h6>
										);
									default:
										return (
											<h3 key={lineIndex} className={headingClassName}>
												{headingMatch[2]}
											</h3>
										);
								}
							}

							if (line.trim() === '') {
								return <div key={lineIndex} className="h-2" />;
							}

							return (
								<div key={lineIndex} className="mb-2 last:mb-0">
									{line}
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
	);
};

interface DetailsSectionProps {
	title: string;
	content?: string;
	error?: string | null;
	emptyMessage?: string;
	defaultExpanded?: boolean;
}

export const DetailsSection: React.FC<DetailsSectionProps> = ({
	title,
	content,
	error,
	emptyMessage = 'No details available',
	defaultExpanded = false
}) => {
	return (
		<CollapsibleSection title={title} defaultExpanded={defaultExpanded}>
			<div className={title.toLowerCase().replace(/\s+/g, '-') + '-content'}>
				{error ? (
					<div className="text-sm text-red-400 py-2">
						Error loading {title.toLowerCase()}: {error}
					</div>
				) : content !== undefined && content !== '' ? (
					<MarkdownRenderer content={content} />
				) : (
					<div className="text-sm text-vscode-foreground/50 py-2">
						{emptyMessage}
					</div>
				)}
			</div>
		</CollapsibleSection>
	);
};
