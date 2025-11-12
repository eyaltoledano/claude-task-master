/**
 * Type declarations for legacy tag-management.js
 * TODO: Remove when refactored to use @tm/core
 */

declare module '*/tag-management.js' {
	export function createTag(
		tasksPath: string,
		tagName: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;

	export function deleteTag(
		tasksPath: string,
		tagName: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;

	export function tags(
		tasksPath: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;

	export function useTag(
		tasksPath: string,
		tagName: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;

	export function renameTag(
		tasksPath: string,
		oldName: string,
		newName: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;

	export function copyTag(
		tasksPath: string,
		sourceName: string,
		targetName: string,
		options?: any,
		context?: any,
		outputFormat?: string
	): Promise<any>;
}
