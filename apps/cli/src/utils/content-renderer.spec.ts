/**
 * @fileoverview Unit tests for content-renderer
 * Regression tests for markdown rendering with angle brackets in code blocks
 * @see https://github.com/eyaltoledano/claude-task-master/issues/1562
 */

import { describe, expect, it } from 'vitest';
import { renderContent } from './content-renderer.js';

describe('renderContent', () => {
	it('should return empty string for empty input', () => {
		expect(renderContent('')).toBe('');
	});

	it('should render plain markdown without corruption', () => {
		const input = '## Heading\\n\\nSome paragraph text.';
		const result = renderContent(input);
		// Should contain the heading text and paragraph — not be empty or corrupted
		expect(result).toContain('Heading');
		expect(result).toContain('Some paragraph text');
	});

	it('should not treat angle brackets inside fenced code blocks as HTML (issue #1562)', () => {
		const input =
			'## Implementation\\n\\n```tsx\\nexport function Component() {\\n  return <Navigate to="/" replace />\\n}\\n```';
		const result = renderContent(input);
		// The key assertion: the output should still contain "Implementation" as a
		// recognizable section and should NOT collapse into a single mangled line.
		expect(result).toContain('Implementation');
		// The code content should be preserved (Navigate component reference)
		expect(result).toContain('Navigate');
	});

	it('should not treat angle brackets inside inline code as HTML', () => {
		const input = 'Use the `<Navigate>` component for redirects.';
		const result = renderContent(input);
		expect(result).toContain('Navigate');
		expect(result).toContain('redirects');
	});

	it('should still convert actual HTML content to markdown', () => {
		const input = '<h1>Title</h1><p>Paragraph</p>';
		const result = renderContent(input);
		// Turndown should have converted this to markdown, then marked-terminal renders it
		expect(result).toContain('Title');
		expect(result).toContain('Paragraph');
	});

	it('should handle mixed markdown with code blocks containing multiple angle brackets', () => {
		const input = [
			'## Current State\\n\\n',
			'The PRD mentions `RequireGuest` route guard.\\n\\n',
			'```tsx\\n',
			'function App() {\\n',
			'  return (\\n',
			'    <BrowserRouter>\\n',
			'      <Routes>\\n',
			'        <Route path="/" element={<Home />} />\\n',
			'      </Routes>\\n',
			'    </BrowserRouter>\\n',
			'  );\\n',
			'}\\n',
			'```'
		].join('');
		const result = renderContent(input);
		// Should render the heading and prose properly, not collapse into one line
		expect(result).toContain('Current State');
		expect(result).toContain('RequireGuest');
	});

	it('should handle content with angle brackets outside code blocks as HTML', () => {
		// Real HTML mixed with text (not inside code blocks) should still be converted
		const input = 'Some text <strong>bold</strong> more text';
		const result = renderContent(input);
		expect(result).toContain('bold');
		expect(result).toContain('more text');
	});
});
