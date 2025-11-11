/**
 * @fileoverview Briefs module types
 */

/**
 * Brief data structure
 * Represents a project brief containing tasks and requirements
 */
export interface Brief {
	id: string;
	accountId: string;
	documentId: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	taskCount?: number;
	document?: {
		id: string;
		title: string;
		document_name: string;
		description?: string;
	};
}
