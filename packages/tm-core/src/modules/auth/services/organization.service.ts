/**
 * @fileoverview Organization and Brief management service
 * Handles fetching and managing organizations and briefs from the API
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../common/types/database.types.js';
import {
	TaskMasterError,
	ERROR_CODES
} from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/index.js';

/**
 * Organization data structure
 */
export interface Organization {
	id: string;
	name: string;
	slug: string;
}

/**
 * Brief data structure
 */
export interface Brief {
	id: string;
	accountId: string;
	documentId: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	document?: {
		id: string;
		title: string;
		document_name: string;
		description?: string;
	};
}

/**
 * Task data structure from the remote database
 */
export interface RemoteTask {
	id: string;
	briefId: string;
	documentId: string;
	position: number | null;
	subtaskPosition: number | null;
	status: string;
	createdAt: string;
	updatedAt: string;
	// Document details from join
	document?: {
		id: string;
		document_name: string;
		title: string;
		description: string;
	};
}

/**
 * Service for managing organizations and briefs
 */
export class OrganizationService {
	private logger = getLogger('OrganizationService');

	constructor(private supabaseClient: SupabaseClient<Database>) {}

	/**
	 * Get all organizations for the authenticated user
	 */
	async getOrganizations(): Promise<Organization[]> {
		try {
			// The user is already authenticated via the Authorization header
			// Query the user_accounts view/table (filtered by RLS for current user)
			const { data, error } = await this.supabaseClient
				.from('user_accounts')
				.select(`
					id,
					name,
					slug
				`);

			if (error) {
				throw new TaskMasterError(
					`Failed to fetch organizations: ${error.message}`,
					ERROR_CODES.API_ERROR,
					{ operation: 'getOrganizations' },
					error
				);
			}

			if (!data || data.length === 0) {
				this.logger.debug('No organizations found for user');
				return [];
			}

			// Map to our Organization interface
			return data.map((org) => ({
				id: org.id ?? '',
				name: org.name ?? '',
				slug: org.slug ?? org.id ?? '' // Use ID as fallback if slug is null
			}));
		} catch (error) {
			if (error instanceof TaskMasterError) {
				throw error;
			}
			throw new TaskMasterError(
				'Failed to fetch organizations',
				ERROR_CODES.API_ERROR,
				{ operation: 'getOrganizations' },
				error as Error
			);
		}
	}

	/**
	 * Get a specific organization by ID
	 */
	async getOrganization(orgId: string): Promise<Organization | null> {
		try {
			const { data, error } = await this.supabaseClient
				.from('accounts')
				.select(`
					id,
					name,
					slug
				`)
				.eq('id', orgId)
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					// No rows found
					return null;
				}
				throw new TaskMasterError(
					`Failed to fetch organization: ${error.message}`,
					ERROR_CODES.API_ERROR,
					{ operation: 'getOrganization', orgId },
					error
				);
			}

			if (!data) {
				return null;
			}

			const accountData =
				data as Database['public']['Tables']['accounts']['Row'];
			return {
				id: accountData.id,
				name: accountData.name,
				slug: accountData.slug || accountData.id
			};
		} catch (error) {
			if (error instanceof TaskMasterError) {
				throw error;
			}
			throw new TaskMasterError(
				'Failed to fetch organization',
				ERROR_CODES.API_ERROR,
				{ operation: 'getOrganization', orgId },
				error as Error
			);
		}
	}

	/**
	 * Get all briefs for a specific organization
	 */
	async getBriefs(orgId: string): Promise<Brief[]> {
		try {
			const { data, error } = await this.supabaseClient
				.from('brief')
				.select(`
					id,
					account_id,
					document_id,
					status,
					created_at,
					updated_at,
					document:document_id (
						id,
						document_name,
						title
					)
				`)
				.eq('account_id', orgId);

			if (error) {
				throw new TaskMasterError(
					`Failed to fetch briefs: ${error.message}`,
					ERROR_CODES.API_ERROR,
					{ operation: 'getBriefs', orgId },
					error
				);
			}

			if (!data || data.length === 0) {
				this.logger.debug(`No briefs found for organization ${orgId}`);
				return [];
			}

			// Map to our Brief interface
			return data.map((brief: any) => ({
				id: brief.id,
				accountId: brief.account_id,
				documentId: brief.document_id,
				status: brief.status,
				createdAt: brief.created_at,
				updatedAt: brief.updated_at,
				document: brief.document
					? {
							id: brief.document.id,
							document_name: brief.document.document_name,
							title: brief.document.title
						}
					: undefined
			}));
		} catch (error) {
			if (error instanceof TaskMasterError) {
				throw error;
			}
			throw new TaskMasterError(
				'Failed to fetch briefs',
				ERROR_CODES.API_ERROR,
				{ operation: 'getBriefs', orgId },
				error as Error
			);
		}
	}

	/**
	 * Get a specific brief by ID
	 */
	async getBrief(briefId: string): Promise<Brief | null> {
		try {
			const { data, error } = await this.supabaseClient
				.from('brief')
				.select(`
					id,
					account_id,
					document_id,
					status,
					created_at,
					updated_at,
					document:document_id (
						id,
						document_name,
						title,
						description
					)
				`)
				.eq('id', briefId)
				.single();

			if (error) {
				if (error.code === 'PGRST116') {
					// No rows found
					return null;
				}
				throw new TaskMasterError(
					`Failed to fetch brief: ${error.message}`,
					ERROR_CODES.API_ERROR,
					{ operation: 'getBrief', briefId },
					error
				);
			}

			if (!data) {
				return null;
			}

			const briefData = data as any;
			return {
				id: briefData.id,
				accountId: briefData.account_id,
				documentId: briefData.document_id,
				status: briefData.status,
				createdAt: briefData.created_at,
				updatedAt: briefData.updated_at,
				document: briefData.document
					? {
							id: briefData.document.id,
							document_name: briefData.document.document_name,
							title: briefData.document.title,
							description: briefData.document.description
						}
					: undefined
			};
		} catch (error) {
			if (error instanceof TaskMasterError) {
				throw error;
			}
			throw new TaskMasterError(
				'Failed to fetch brief',
				ERROR_CODES.API_ERROR,
				{ operation: 'getBrief', briefId },
				error as Error
			);
		}
	}

	/**
	 * Validate that a user has access to an organization
	 */
	async validateOrgAccess(orgId: string): Promise<boolean> {
		try {
			const org = await this.getOrganization(orgId);
			return org !== null;
		} catch (error) {
			this.logger.error(`Failed to validate org access: ${error}`);
			return false;
		}
	}

	/**
	 * Validate that a user has access to a brief
	 */
	async validateBriefAccess(briefId: string): Promise<boolean> {
		try {
			const brief = await this.getBrief(briefId);
			return brief !== null;
		} catch (error) {
			this.logger.error(`Failed to validate brief access: ${error}`);
			return false;
		}
	}

	/**
	 * Get all tasks for a specific brief
	 */
	async getTasks(briefId: string): Promise<RemoteTask[]> {
		try {
			const { data, error } = await this.supabaseClient
				.from('tasks')
				.select(`
					*,
					document:document_id (
						id,
						document_name,
						title,
						description
					)
				`)
				.eq('brief_id', briefId)
				.order('position', { ascending: true })
				.order('subtask_position', { ascending: true })
				.order('created_at', { ascending: true });

			if (error) {
				throw new TaskMasterError(
					`Failed to fetch tasks: ${error.message}`,
					ERROR_CODES.API_ERROR,
					{ operation: 'getTasks', briefId },
					error
				);
			}

			if (!data || data.length === 0) {
				this.logger.debug(`No tasks found for brief ${briefId}`);
				return [];
			}

			// Map to our RemoteTask interface
			return data.map((task: any) => ({
				id: task.id,
				briefId: task.brief_id,
				documentId: task.document_id,
				position: task.position,
				subtaskPosition: task.subtask_position,
				status: task.status,
				createdAt: task.created_at,
				updatedAt: task.updated_at,
				document: task.document
					? {
							id: task.document.id,
							document_name: task.document.document_name,
							title: task.document.title,
							description: task.document.description
						}
					: undefined
			}));
		} catch (error) {
			if (error instanceof TaskMasterError) {
				throw error;
			}
			throw new TaskMasterError(
				'Failed to fetch tasks',
				ERROR_CODES.API_ERROR,
				{ operation: 'getTasks', briefId },
				error as Error
			);
		}
	}
}
