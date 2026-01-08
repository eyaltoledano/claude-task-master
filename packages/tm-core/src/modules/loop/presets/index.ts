/**
 * @fileoverview Preset loader utilities for loop module
 * Uses inlined preset content to avoid bundling and path resolution issues
 */

import fs from 'node:fs/promises';
import type { LoopPreset } from '../types.js';
import { LoopPresetService, PRESET_NAMES as SERVICE_PRESET_NAMES } from '../services/loop-preset.service.js';

/** Error codes for preset resolution errors */
export const PresetErrorCode = {
	PRESET_NOT_FOUND: 'PRESET_NOT_FOUND',
	CUSTOM_PROMPT_NOT_FOUND: 'CUSTOM_PROMPT_NOT_FOUND',
	EMPTY_PROMPT_CONTENT: 'EMPTY_PROMPT_CONTENT',
	INVALID_PRESET: 'INVALID_PRESET'
} as const;

export type PresetErrorCode = (typeof PresetErrorCode)[keyof typeof PresetErrorCode];

/** Error thrown when preset resolution fails */
export class PresetError extends Error {
	constructor(
		public readonly code: PresetErrorCode,
		message: string
	) {
		super(message);
		this.name = 'PresetError';
	}
}

/**
 * Array of all available preset names
 */
export const PRESET_NAMES: readonly LoopPreset[] = SERVICE_PRESET_NAMES;

// Singleton instance of LoopPresetService for internal use
const presetService = new LoopPresetService();

/**
 * Type guard to check if a string is a valid preset name
 * @param name - The name to check
 * @returns True if the name is a valid LoopPreset
 */
export function isValidPreset(name: string): name is LoopPreset {
	return presetService.isPreset(name);
}

/**
 * Get the relative file path for a preset markdown file
 * @param preset - The preset name
 * @returns The relative path to the preset markdown file
 * @deprecated Presets are now inlined; this function is for backward compatibility only
 */
export function getPresetPath(preset: LoopPreset): string {
	return `${preset}.md`;
}

/**
 * Load the content of a preset
 * Uses inlined content - no filesystem access needed for built-in presets
 * @param preset - The preset name to load
 * @returns Promise resolving to the preset content string
 * @throws PresetError if the preset is not found
 */
export async function loadPreset(preset: LoopPreset): Promise<string> {
	try {
		const content = presetService.getPresetContent(preset);
		return content;
	} catch {
		throw new PresetError(
			PresetErrorCode.PRESET_NOT_FOUND,
			`Preset '${preset}' not found. Available presets: ${PRESET_NAMES.join(', ')}`
		);
	}
}

/**
 * Check if a string looks like a file path (contains path separators or file extension)
 * @param prompt - The string to check
 * @returns True if the string appears to be a file path
 */
export function isFilePath(prompt: string): boolean {
	if (!prompt) return false;
	// Contains path separator (Unix or Windows)
	if (prompt.includes('/') || prompt.includes('\\')) {
		return true;
	}
	// Has common prompt file extension
	return /\.(md|txt|markdown)$/i.test(prompt);
}

/**
 * Load a custom prompt file from the filesystem
 * @param filePath - Path to the custom prompt file
 * @returns Promise resolving to the file content string
 * @throws PresetError if the file cannot be read or is empty
 */
export async function loadCustomPrompt(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, 'utf-8');
		if (!content.trim()) {
			throw new PresetError(
				PresetErrorCode.EMPTY_PROMPT_CONTENT,
				`Custom prompt file '${filePath}' has empty content`
			);
		}
		return content;
	} catch (error) {
		if (error instanceof PresetError) {
			throw error;
		}
		throw new PresetError(
			PresetErrorCode.CUSTOM_PROMPT_NOT_FOUND,
			`Custom prompt file not found: ${filePath}`
		);
	}
}

/**
 * Resolve a prompt string to its content, handling both preset names and file paths
 * @param prompt - Either a preset name or a file path
 * @returns Promise resolving to the prompt content string
 * @throws PresetError if the prompt cannot be resolved
 */
export async function resolvePrompt(prompt: LoopPreset | string): Promise<string> {
	// Check if it's a valid preset name first
	if (isValidPreset(prompt)) {
		return loadPreset(prompt);
	}
	// Otherwise treat it as a file path
	return loadCustomPrompt(prompt);
}
