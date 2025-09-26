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

export function extractJson(text: string): string {
	let content = text.trim();

	// Strip triple‑backtick fences and ignore any language tag on the opening line
	// Matches: ```json\n..., ```js\n..., or ```\n...
	const fenceMatch = /```[^\n]*\n([\s\S]*?)\n?```/i.exec(content);
	if (fenceMatch) {
		content = fenceMatch[1];
	}

	// Strip variable declarations like `const foo =` or `let foo =`
	const varMatch = /^\s*(?:const|let|var)\s+\w+\s*=\s*([\s\S]*)/i.exec(content);
	if (varMatch) {
		content = varMatch[1];
		// Remove trailing semicolon if present
		if (content.trim().endsWith(';')) {
			content = content.trim().slice(0, -1);
		}
	}

	// Find the first opening bracket outside of quoted strings
	const findFirstStructuralBracket = (value: string): number => {
		let inDouble = false;
		let inSingle = false;
		let inBacktick = false;
		let escapeNext = false;

		for (let i = 0; i < value.length; i++) {
			const char = value[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === '\\') {
				escapeNext = true;
				continue;
			}

			if (!inBacktick && char === '"' && !inSingle) {
				inDouble = !inDouble;
				continue;
			}

			if (!inBacktick && char === "'" && !inDouble) {
				inSingle = !inSingle;
				continue;
			}

			if (!inDouble && !inSingle && char === '`') {
				inBacktick = !inBacktick;
				continue;
			}

			if (!inDouble && !inSingle && !inBacktick && (char === '{' || char === '[')) {
				return i;
			}
		}

		return -1;
	};

	const start = findFirstStructuralBracket(content);
	if (start === -1) {
		return text;
	}
	content = content.slice(start);

	// Try to parse the entire string with jsonc-parser
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

	const decodeSingleQuotedString = (value: string): string => {
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
			switch (next) {
				case "'":
					result += "'";
					break;
				case '\\':
					result += '\\';
					break;
				case 'n':
					result += '\n';
					break;
				case 'r':
					result += '\r';
					break;
				case 't':
					result += '\t';
					break;
				case 'b':
					result += '\b';
					break;
				case 'f':
					result += '\f';
					break;
				case 'v':
					result += '\v';
					break;
				case '0':
					result += '\0';
					break;
				case 'u': {
					if (value[i + 1] === '{') {
						const endBrace = value.indexOf('}', i + 2);
						if (endBrace !== -1) {
							const codePointHex = value.slice(i + 2, endBrace);
							if (
								codePointHex.length > 0 &&
								/^[0-9a-fA-F]+$/.test(codePointHex)
							) {
								const codePoint = parseInt(codePointHex, 16);
								if (codePoint <= 0x10ffff) {
									result += String.fromCodePoint(codePoint);
									i = endBrace;
									break;
								}
							}
						}
					}
					const hex = value.slice(i + 1, i + 5);
					if (/^[0-9a-fA-F]{4}$/.test(hex)) {
						result += String.fromCharCode(parseInt(hex, 16));
						i += 4;
						break;
					}
					result += 'u';
					break;
				}
				case 'x': {
					const hex = value.slice(i + 1, i + 3);
					if (/^[0-9a-fA-F]{2}$/.test(hex)) {
						result += String.fromCharCode(parseInt(hex, 16));
						i += 2;
						break;
					}
					result += 'x';
					break;
				}
				default:
					result += next;
			}
		}
		return result;
	};

	const normalizeJavaScriptObjectLiteral = (value: string): string => {
		let out = '';
		let i = 0;
		let inDouble = false;
		let inSingle = false;
		let escapeNext = false;

		const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
		const isIdentPart = (ch: string) => /[A-Za-z0-9_$]/.test(ch);

		while (i < value.length) {
			const ch = value[i];

			if (escapeNext) { out += ch; escapeNext = false; i++; continue; }
			if (ch === '\\') { out += ch; escapeNext = true; i++; continue; }

			if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; i++; continue; }

			if (!inDouble && ch === "'") {
				// consume single-quoted literal and emit JSON-compatible double-quoted string
				let j = i + 1;
				let inner = '';
				let esc = false;
				while (j < value.length) {
					const c = value[j];
					if (esc) { inner += c; esc = false; j++; continue; }
					if (c === '\\') { esc = true; j++; continue; }
					if (c === "'") break;
					inner += c;
					j++;
				}
				out += JSON.stringify(decodeSingleQuotedString(inner));
				i = j < value.length ? j + 1 : j;
				continue;
			}

			if (!inDouble && !inSingle && (ch === '{' || ch === ',')) {
				out += ch;
				i++;
				// preserve whitespace after { or ,
				while (i < value.length && /\s/.test(value[i])) { out += value[i]; i++; }
				// quote bare identifier key if followed by colon
				const keyStart = i;
				if (i < value.length && isIdentStart(value[i])) {
					i++;
					while (i < value.length && isIdentPart(value[i])) i++;
					const ident = value.slice(keyStart, i);
					const wsStart = i;
					while (i < value.length && /\s/.test(value[i])) i++;
					if (value[i] === ':') {
						out += `"${ident}"${value.slice(wsStart, i)}:`;
						i++; // skip colon
						continue;
					} else {
						out += value.slice(keyStart, i);
						continue;
					}
				}
				continue;
			}

			out += ch;
			i++;
		}

		return out;
	};

	const candidates = [content];
	const normalizedContent = normalizeJavaScriptObjectLiteral(content);
	if (normalizedContent !== content) {
		candidates.push(normalizedContent);
	}

	for (const candidate of candidates) {
		const parsed = tryParse(candidate);
		if (parsed !== undefined) {
			return parsed;
		}
	}

	content = candidates[candidates.length - 1];

	// If parsing the full string failed, use a more efficient approach
	// to find valid JSON boundaries
	const openChar = content[0];
	const closeChar = openChar === '{' ? '}' : ']';

	// Find all potential closing positions by tracking nesting depth
	const closingPositions: number[] = [];
	let depth = 0;
	let inString = false;
	let escapeNext = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (char === '\\') {
			escapeNext = true;
			continue;
		}

		if (char === '"' && !inString) {
			inString = true;
			continue;
		}

		if (char === '"' && inString) {
			inString = false;
			continue;
		}

		// Skip content inside strings
		if (inString) continue;

		if (char === openChar) {
			depth++;
		} else if (char === closeChar) {
			depth--;
			if (depth === 0) {
				closingPositions.push(i + 1);
			}
		}
	}

	// Try parsing at each valid closing position, starting from the end
	for (let i = closingPositions.length - 1; i >= 0; i--) {
		const attempt = tryParse(content.slice(0, closingPositions[i]));
		if (attempt !== undefined) {
			return attempt;
		}
	}

	// As a final fallback, try the original character-by-character approach
	// but only for the last 1000 characters to limit performance impact
	const searchStart = Math.max(0, content.length - 1000);
	for (let end = content.length - 1; end > searchStart; end--) {
		const attempt = tryParse(content.slice(0, end));
		if (attempt !== undefined) {
			return attempt;
		}
	}

	return text;
}
