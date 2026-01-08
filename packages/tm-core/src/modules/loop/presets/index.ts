/**
 * @fileoverview Preset loader utilities for loop module
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoopPreset } from '../types.js';

/**
 * Array of all available preset names
 */
export const PRESET_NAMES: readonly LoopPreset[] = [
	'default',
	'test-coverage',
	'linting',
	'duplication',
	'entropy'
] as const;

/**
 * Type guard to check if a string is a valid preset name
 * @param name - The name to check
 * @returns True if the name is a valid LoopPreset
 */
export function isValidPreset(name: string): name is LoopPreset {
	return PRESET_NAMES.includes(name as LoopPreset);
}

/**
 * Get the relative file path for a preset markdown file
 * @param preset - The preset name
 * @returns The relative path to the preset markdown file
 */
export function getPresetPath(preset: LoopPreset): string {
	return `${preset}.md`;
}

/**
 * Get the absolute directory path where preset files are located
 * Uses import.meta.url for ESM-compatible path resolution
 * @returns The absolute path to the presets directory
 */
function getPresetsDir(): string {
	const currentFileUrl = import.meta.url;
	const currentFilePath = fileURLToPath(currentFileUrl);
	return path.dirname(currentFilePath);
}

/**
 * Load the content of a preset markdown file
 * @param preset - The preset name to load
 * @returns Promise resolving to the preset content string
 * @throws Error if the preset file cannot be read
 */
export async function loadPreset(preset: LoopPreset): Promise<string> {
	const presetsDir = getPresetsDir();
	const presetFile = path.join(presetsDir, getPresetPath(preset));
	return fs.readFile(presetFile, 'utf-8');
}
