/**
 * Extract JSON from Claude's response using a tolerant parser.
 *
 * The function removes common wrappers such as markdown fences or variable
 * declarations and then attempts to parse the remaining text with
 * `jsonc-parser`.  If valid JSON (or JSONC) can be parsed, it is returned as a
 * string via `JSON.stringify`.  Otherwise the original text is returned.
 *
 * @param text - Raw text which may contain JSON
 * @returns A valid JSON string if extraction succeeds, otherwise the original text
 */
import { parse, type ParseError } from 'jsonc-parser';

class StringStateTracker {
	private inDouble = false;
	private inSingle = false;
	private inBacktick = false;
	private escapeNext = false;
	private inLineComment = false;
	private inBlockComment = false;

	processChar(char: string, nextChar?: string): boolean {
		// Handle escape sequences
		if (this.escapeNext) {
			this.escapeNext = false;
			return true; // Skip this char
		}

		if (char === '\\') {
			this.escapeNext = true;
			return true;
		}

		// Handle comments (only when not in string)
		if (!this.inAnyString()) {
			if (!this.inLineComment && !this.inBlockComment && char === '/' && nextChar) {
				if (nextChar === '/') {
					this.inLineComment = true;
					return true;
				}
				if (nextChar === '*') {
					this.inBlockComment = true;
					return true;
				}
			}
			if (this.inLineComment && (char === '\n' || char === '\r')) {
				this.inLineComment = false;
				return true;
			}
			if (this.inBlockComment && char === '*' && nextChar === '/') {
				this.inBlockComment = false;
				return true;
			}
			if (this.inLineComment || this.inBlockComment) {
				return true; // Skip comment content
			}
		}

		// Handle quote characters
		if (!this.inBacktick && char === '"' && !this.inSingle) {
			this.inDouble = !this.inDouble;
			return false;
		}

		if (!this.inBacktick && char === "'" && !this.inDouble) {
			this.inSingle = !this.inSingle;
			return false;
		}

		if (!this.inDouble && !this.inSingle && char === '`') {
			this.inBacktick = !this.inBacktick;
			return false;
		}

		return false;
	}

	inAnyString(): boolean {
		return this.inDouble || this.inSingle || this.inBacktick;
	}

	inAnyComment(): boolean {
		return this.inLineComment || this.inBlockComment;
	}

	isInStructuralContext(): boolean {
		return !this.inAnyString() && !this.inAnyComment();
	}
}

interface PreprocessResult {
	content: string;
	wasModified: boolean;
}

function preprocessText(text: string): PreprocessResult {
	let content = text.trim();
	let wasModified = false;

	// Strip triple-backtick fences and ignore any language tag on the opening line
	// Matches: ```json\n..., ```js\n..., or ```\n...
	const fenceMatch = /```[^\n]*\n([\s\S]*?)\n?```/i.exec(content);
	if (fenceMatch) {
		content = fenceMatch[1];
		wasModified = true;
	}

	// Strip variable declarations like `const foo =` or `let foo =`
	const varMatch =
		/^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*([\s\S]*)/i.exec(content) ||
		/^\s*module\.exports\s*=\s*([\s\S]*)/i.exec(content);
	if (varMatch) {
		content = varMatch[1];
		wasModified = true;
		// Remove trailing semicolon if present
		if (content.trim().endsWith(';')) {
			content = content.trim().slice(0, -1);
		}
	}

	return { content, wasModified };
}

const findFirstStructuralBracket = (value: string): number => {
	const tracker = new StringStateTracker();

	for (let i = 0; i < value.length; i++) {
		const char = value[i];
		tracker.processChar(char, value[i + 1]);

		if (tracker.isInStructuralContext() && (char === '{' || char === '[')) {
			return i;
		}
	}

	return -1;
};

function extractJsonBoundaries(content: string): string | null {
	const start = findFirstStructuralBracket(content);
	if (start === -1) {
		return null;
	}
	return content.slice(start);
}

const tryParse = (value: string): string | undefined => {
	const errors: ParseError[] = [];
	try {
		parse(value, errors, { allowTrailingComma: true });
		if (errors.length === 0) {
			return value.trim();
		}
	} catch {
		// ignore
	}
	return undefined;
};

function tryParsingCandidates(candidates: string[]): string | undefined {
	for (const candidate of candidates) {
		const parsed = tryParse(candidate);
		if (parsed !== undefined) {
			return parsed;
		}
	}
	return undefined;
}

function findClosingPositions(content: string, openChar: string, closeChar: string): number[] {
	const positions: number[] = [];
	let depth = 0;
	const tracker = new StringStateTracker();

	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		const shouldSkip = tracker.processChar(char, content[i + 1]);

		if (shouldSkip) {
			continue;
		}

		if (tracker.isInStructuralContext()) {
			if (char === openChar) {
				depth++;
			} else if (char === closeChar) {
				depth--;
				if (depth === 0) {
					positions.push(i + 1);
				}
			}
		}
	}

	return positions;
}

function findValidJsonByBoundary(content: string): string | undefined {
	const openChar = content[0];
	const closeChar = openChar === '{' ? '}' : ']';

	const closingPositions = findClosingPositions(content, openChar, closeChar);

	// Try parsing at each valid closing position, starting from the end
	for (let i = closingPositions.length - 1; i >= 0; i--) {
		const attempt = tryParse(content.slice(0, closingPositions[i]));
		if (attempt !== undefined) {
			return attempt;
		}
	}

	return undefined;
}

function binarySearchValidJson(content: string): string | undefined {
	// Use binary search to find valid JSON boundary more efficiently
	const searchStart = Math.max(0, content.length - 1000);
	let left = searchStart;
	let right = content.length;
	let bestValid: string | undefined;

	while (left < right) {
		const mid = Math.floor((left + right) / 2);
		const attempt = tryParse(content.slice(0, mid));

		if (attempt !== undefined) {
			bestValid = attempt;
			left = mid + 1; // Try to find longer valid JSON
		} else {
			right = mid; // Invalid, search shorter strings
		}
	}

	return bestValid;
}

// Simple escape sequences lookup
const SIMPLE_ESCAPE_SEQUENCES: Record<string, string> = {
	"'": "'",
	'\\': '\\',
	'n': '\n',
	'r': '\r',
	't': '\t',
	'b': '\b',
	'f': '\f',
	'v': '\v',
	'0': '\0'
};

function decodeUnicodeEscape(value: string, startIndex: number): { char: string; nextIndex: number } {
	const i = startIndex;

	// Handle ES6 unicode code point escape: \u{...}
	if (value[i + 1] === '{') {
		const endBrace = value.indexOf('}', i + 2);
		if (endBrace !== -1) {
			const codePointHex = value.slice(i + 2, endBrace);
			if (codePointHex.length > 0 && /^[0-9a-fA-F]+$/.test(codePointHex)) {
				const codePoint = parseInt(codePointHex, 16);
				if (codePoint <= 0x10ffff) {
					return { char: String.fromCodePoint(codePoint), nextIndex: endBrace };
				}
			}
		}
	}

	// Handle standard \uXXXX format
	const hex = value.slice(i + 1, i + 5);
	if (/^[0-9a-fA-F]{4}$/.test(hex)) {
		return { char: String.fromCharCode(parseInt(hex, 16)), nextIndex: i + 4 };
	}

	return { char: 'u', nextIndex: i };
}

function decodeHexEscape(value: string, startIndex: number): { char: string; nextIndex: number } {
	const hex = value.slice(startIndex + 1, startIndex + 3);
	if (/^[0-9a-fA-F]{2}$/.test(hex)) {
		return { char: String.fromCharCode(parseInt(hex, 16)), nextIndex: startIndex + 2 };
	}
	return { char: 'x', nextIndex: startIndex };
}

function decodeSingleQuotedString(value: string): string {
	let result = '';

	for (let i = 0; i < value.length; i++) {
		const char = value[i];

		if (char !== '\\') {
			result += char;
			continue;
		}

		i++;
		if (i >= value.length) {
			result += '\\';
			break;
		}

		const next = value[i];

		// Try simple escape sequences first
		if (next in SIMPLE_ESCAPE_SEQUENCES) {
			result += SIMPLE_ESCAPE_SEQUENCES[next];
			continue;
		}

		// Handle unicode escapes
		if (next === 'u') {
			const decoded = decodeUnicodeEscape(value, i);
			result += decoded.char;
			i = decoded.nextIndex;
			continue;
		}

		// Handle hex escapes
		if (next === 'x') {
			const decoded = decodeHexEscape(value, i);
			result += decoded.char;
			i = decoded.nextIndex;
			continue;
		}

		// Unknown escape - preserve as-is
		result += next;
	}

	return result;
}

interface SingleQuoteResult {
	normalizedValue: string;
	nextIndex: number;
}

function normalizeSingleQuotedString(value: string, startIndex: number): SingleQuoteResult {
	let j = startIndex + 1;
	let inner = '';
	let esc = false;

	while (j < value.length) {
		const c = value[j];
		if (esc) {
			inner += c;
			esc = false;
			j++;
			continue;
		}
		if (c === '\\') {
			esc = true;
			j++;
			continue;
		}
		if (c === "'") break;
		inner += c;
		j++;
	}

	return {
		normalizedValue: JSON.stringify(decodeSingleQuotedString(inner)),
		nextIndex: j < value.length ? j + 1 : j
	};
}

interface KeyNormalizationResult {
	normalizedKey: string;
	nextIndex: number;
	isKey: boolean;
}

function normalizeIdentifierKey(
	value: string,
	startIndex: number,
	isIdentPart: (ch: string) => boolean
): KeyNormalizationResult {
	let i = startIndex + 1;
	while (i < value.length && isIdentPart(value[i])) i++;

	const ident = value.slice(startIndex, i);
	const wsStart = i;
	while (i < value.length && /\s/.test(value[i])) i++;

	if (value[i] === ':') {
		return {
			normalizedKey: `"${ident}"${value.slice(wsStart, i)}:`,
			nextIndex: i + 1,
			isKey: true
		};
	}

	return { normalizedKey: value.slice(startIndex, i), nextIndex: i, isKey: false };
}

function normalizeNumericKey(
	value: string,
	startIndex: number,
	isDigit: (ch: string) => boolean
): KeyNormalizationResult {
	let j = startIndex;
	if (value[j] === '-') j++;
	while (j < value.length && isDigit(value[j])) j++;

	// Handle decimal part
	if (j < value.length && value[j] === '.') {
		j++;
		while (j < value.length && isDigit(value[j])) j++;
	}

	// Handle exponent
	if (j < value.length && (value[j] === 'e' || value[j] === 'E')) {
		j++;
		if (j < value.length && (value[j] === '+' || value[j] === '-')) j++;
		while (j < value.length && isDigit(value[j])) j++;
	}

	const numToken = value.slice(startIndex, j);
	const wsStart = j;
	while (j < value.length && /\s/.test(value[j])) j++;

	if (value[j] === ':') {
		return {
			normalizedKey: `"${numToken}"${value.slice(wsStart, j)}:`,
			nextIndex: j + 1,
			isKey: true
		};
	}

	return { normalizedKey: value.slice(startIndex, j), nextIndex: j, isKey: false };
}

function normalizeObjectKey(
	value: string,
	startIndex: number,
	isIdentStart: (ch: string) => boolean,
	isIdentPart: (ch: string) => boolean,
	isDigit: (ch: string) => boolean
): KeyNormalizationResult {
	const i = startIndex;

	// Try identifier key
	if (i < value.length && isIdentStart(value[i])) {
		return normalizeIdentifierKey(value, i, isIdentPart);
	}

	// Try numeric key
	if (i < value.length && (value[i] === '-' || isDigit(value[i]))) {
		return normalizeNumericKey(value, i, isDigit);
	}

	return { normalizedKey: '', nextIndex: i, isKey: false };
}

export function extractJson(text: string): string {
	// Phase 1: Preprocess (remove wrappers)
	const { content } = preprocessText(text);

	// Phase 2: Extract JSON boundaries
	const bounded = extractJsonBoundaries(content);
	if (bounded === null) {
		return text;
	}


	const normalizeJavaScriptObjectLiteral = (value: string): string => {
		let out = '';
		let i = 0;
		let inDouble = false;
		let inSingle = false;
		let escapeNext = false;

		const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
		const isIdentPart = (ch: string) => /[A-Za-z0-9_$]/.test(ch);
		const isDigit = (ch: string) => /[0-9]/.test(ch);

		while (i < value.length) {
			const ch = value[i];

			if (escapeNext) { out += ch; escapeNext = false; i++; continue; }
			if (ch === '\\') { out += ch; escapeNext = true; i++; continue; }

			if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; i++; continue; }

			if (!inDouble && ch === "'") {
				const result = normalizeSingleQuotedString(value, i);
				out += result.normalizedValue;
				i = result.nextIndex;
				continue;
			}

			if (!inDouble && !inSingle && (ch === '{' || ch === ',')) {
				out += ch;
				i++;
				// preserve whitespace after { or ,
				while (i < value.length && /\s/.test(value[i])) {
					out += value[i];
					i++;
				}

				// normalize key if present
				const keyResult = normalizeObjectKey(value, i, isIdentStart, isIdentPart, isDigit);
				if (keyResult.isKey) {
					out += keyResult.normalizedKey;
					i = keyResult.nextIndex;
					continue;
				}
				if (i !== keyResult.nextIndex) {
					out += keyResult.normalizedKey;
					i = keyResult.nextIndex;
					continue;
				}
				continue;
			}

			out += ch;
			i++;
		}

		return out;
	};

	// Phase 3: Try direct parsing with normalization
	const candidates = [bounded];
	const normalized = normalizeJavaScriptObjectLiteral(bounded);
	if (normalized !== bounded) {
		candidates.push(normalized);
	}

	const directResult = tryParsingCandidates(candidates);
	if (directResult !== undefined) {
		return directResult;
	}

	const finalContent = candidates[candidates.length - 1];

	// Phase 4: Fallback - find valid boundaries
	const boundaryResult = findValidJsonByBoundary(finalContent);
	if (boundaryResult !== undefined) {
		return boundaryResult;
	}

	// Phase 5: Final fallback - character-by-character (last 1000 chars)
	const binaryResult = binarySearchValidJson(finalContent);
	if (binaryResult !== undefined) {
		return binaryResult;
	}

	return text;
}
