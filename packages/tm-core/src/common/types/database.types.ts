export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			accounts: {
				Row: {
					created_at: string | null;
					created_by: string | null;
					email: string | null;
					id: string;
					is_personal_account: boolean;
					name: string;
					picture_url: string | null;
					primary_owner_user_id: string;
					public_data: Json;
					slug: string | null;
					updated_at: string | null;
					updated_by: string | null;
				};
				Insert: {
					created_at?: string | null;
					created_by?: string | null;
					email?: string | null;
					id?: string;
					is_personal_account?: boolean;
					name: string;
					picture_url?: string | null;
					primary_owner_user_id?: string;
					public_data?: Json;
					slug?: string | null;
					updated_at?: string | null;
					updated_by?: string | null;
				};
				Update: {
					created_at?: string | null;
					created_by?: string | null;
					email?: string | null;
					id?: string;
					is_personal_account?: boolean;
					name?: string;
					picture_url?: string | null;
					primary_owner_user_id?: string;
					public_data?: Json;
					slug?: string | null;
					updated_at?: string | null;
					updated_by?: string | null;
				};
				Relationships: [];
			};
			brief: {
				Row: {
					account_id: string;
					created_at: string;
					created_by: string;
					document_id: string;
					id: string;
					plan_generation_completed_at: string | null;
					plan_generation_error: string | null;
					plan_generation_started_at: string | null;
					plan_generation_status: Database['public']['Enums']['plan_generation_status'];
					status: Database['public']['Enums']['brief_status'];
					updated_at: string;
				};
				Insert: {
					account_id: string;
					created_at?: string;
					created_by: string;
					document_id: string;
					id?: string;
					plan_generation_completed_at?: string | null;
					plan_generation_error?: string | null;
					plan_generation_started_at?: string | null;
					plan_generation_status?: Database['public']['Enums']['plan_generation_status'];
					status?: Database['public']['Enums']['brief_status'];
					updated_at?: string;
				};
				Update: {
					account_id?: string;
					created_at?: string;
					created_by?: string;
					document_id?: string;
					id?: string;
					plan_generation_completed_at?: string | null;
					plan_generation_error?: string | null;
					plan_generation_started_at?: string | null;
					plan_generation_status?: Database['public']['Enums']['plan_generation_status'];
					status?: Database['public']['Enums']['brief_status'];
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'brief_account_id_fkey';
						columns: ['account_id'];
						isOneToOne: false;
						referencedRelation: 'accounts';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'brief_document_id_fkey';
						columns: ['document_id'];
						isOneToOne: false;
						referencedRelation: 'document';
						referencedColumns: ['id'];
					}
				];
			};
			document: {
				Row: {
					account_id: string;
					created_at: string;
					created_by: string;
					description: string | null;
					document_name: string;
					document_type: Database['public']['Enums']['document_type'];
					file_path: string | null;
					file_size: number | null;
					id: string;
					metadata: Json | null;
					mime_type: string | null;
					processed_at: string | null;
					processing_error: string | null;
					processing_status:
						| Database['public']['Enums']['document_processing_status']
						| null;
					source_id: string | null;
					source_type: string | null;
					title: string;
					updated_at: string;
				};
				Insert: {
					account_id: string;
					created_at?: string;
					created_by: string;
					description?: string | null;
					document_name: string;
					document_type?: Database['public']['Enums']['document_type'];
					file_path?: string | null;
					file_size?: number | null;
					id?: string;
					metadata?: Json | null;
					mime_type?: string | null;
					processed_at?: string | null;
					processing_error?: string | null;
					processing_status?:
						| Database['public']['Enums']['document_processing_status']
						| null;
					source_id?: string | null;
					source_type?: string | null;
					title: string;
					updated_at?: string;
				};
				Update: {
					account_id?: string;
					created_at?: string;
					created_by?: string;
					description?: string | null;
					document_name?: string;
					document_type?: Database['public']['Enums']['document_type'];
					file_path?: string | null;
					file_size?: number | null;
					id?: string;
					metadata?: Json | null;
					mime_type?: string | null;
					processed_at?: string | null;
					processing_error?: string | null;
					processing_status?:
						| Database['public']['Enums']['document_processing_status']
						| null;
					source_id?: string | null;
					source_type?: string | null;
					title?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'document_account_id_fkey';
						columns: ['account_id'];
						isOneToOne: false;
						referencedRelation: 'accounts';
						referencedColumns: ['id'];
					}
				];
			};
			tasks: {
				Row: {
					account_id: string;
					actual_hours: number;
					assignee_id: string | null;
					brief_id: string | null;
					completed_subtasks: number;
					complexity: number | null;
					created_at: string;
					created_by: string;
					description: string | null;
					display_id: string | null;
					document_id: string | null;
					due_date: string | null;
					estimated_hours: number | null;
					id: string;
					metadata: Json;
					parent_task_id: string | null;
					position: number;
					priority: Database['public']['Enums']['task_priority'];
					status: Database['public']['Enums']['task_status'];
					subtask_position: number;
					title: string;
					total_subtasks: number;
					updated_at: string;
					updated_by: string;
				};
				Insert: {
					account_id: string;
					actual_hours?: number;
					assignee_id?: string | null;
					brief_id?: string | null;
					completed_subtasks?: number;
					complexity?: number | null;
					created_at?: string;
					created_by: string;
					description?: string | null;
					display_id?: string | null;
					document_id?: string | null;
					due_date?: string | null;
					estimated_hours?: number | null;
					id?: string;
					metadata?: Json;
					parent_task_id?: string | null;
					position?: number;
					priority?: Database['public']['Enums']['task_priority'];
					status?: Database['public']['Enums']['task_status'];
					subtask_position?: number;
					title: string;
					total_subtasks?: number;
					updated_at?: string;
					updated_by: string;
				};
				Update: {
					account_id?: string;
					actual_hours?: number;
					assignee_id?: string | null;
					brief_id?: string | null;
					completed_subtasks?: number;
					complexity?: number | null;
					created_at?: string;
					created_by?: string;
					description?: string | null;
					display_id?: string | null;
					document_id?: string | null;
					due_date?: string | null;
					estimated_hours?: number | null;
					id?: string;
					metadata?: Json;
					parent_task_id?: string | null;
					position?: number;
					priority?: Database['public']['Enums']['task_priority'];
					status?: Database['public']['Enums']['task_status'];
					subtask_position?: number;
					title?: string;
					total_subtasks?: number;
					updated_at?: string;
					updated_by?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'tasks_account_id_fkey';
						columns: ['account_id'];
						isOneToOne: false;
						referencedRelation: 'accounts';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'tasks_brief_id_fkey';
						columns: ['brief_id'];
						isOneToOne: false;
						referencedRelation: 'brief';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'tasks_document_id_fkey';
						columns: ['document_id'];
						isOneToOne: false;
						referencedRelation: 'document';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'tasks_parent_task_id_fkey';
						columns: ['parent_task_id'];
						isOneToOne: false;
						referencedRelation: 'tasks';
						referencedColumns: ['id'];
					}
				];
			};
			task_dependencies: {
				Row: {
					account_id: string;
					created_at: string;
					depends_on_task_id: string;
					id: string;
					task_id: string;
				};
				Insert: {
					account_id: string;
					created_at?: string;
					depends_on_task_id: string;
					id?: string;
					task_id: string;
				};
				Update: {
					account_id?: string;
					created_at?: string;
					depends_on_task_id?: string;
					id?: string;
					task_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'task_dependencies_account_id_fkey';
						columns: ['account_id'];
						isOneToOne: false;
						referencedRelation: 'accounts';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'task_dependencies_depends_on_task_id_fkey';
						columns: ['depends_on_task_id'];
						isOneToOne: false;
						referencedRelation: 'tasks';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'task_dependencies_task_id_fkey';
						columns: ['task_id'];
						isOneToOne: false;
						referencedRelation: 'tasks';
						referencedColumns: ['id'];
					}
				];
			};
			user_accounts: {
				Row: {
					id: string | null;
					name: string | null;
					picture_url: string | null;
					role: string | null;
					slug: string | null;
				};
				Insert: {
					id?: string | null;
					name?: string | null;
					picture_url?: string | null;
					role?: string | null;
					slug?: string | null;
				};
				Update: {
					id?: string | null;
					name?: string | null;
					picture_url?: string | null;
					role?: string | null;
					slug?: string | null;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			brief_status:
				| 'draft'
				| 'refining'
				| 'aligned'
				| 'delivering'
				| 'delivered'
				| 'done'
				| 'archived';
			document_processing_status: 'pending' | 'processing' | 'ready' | 'failed';
			document_type:
				| 'brief'
				| 'blueprint'
				| 'file'
				| 'note'
				| 'transcript'
				| 'generated_plan'
				| 'generated_task'
				| 'generated_summary'
				| 'method'
				| 'task';
			plan_generation_status:
				| 'not_started'
				| 'generating'
				| 'completed'
				| 'failed';
			task_priority: 'low' | 'medium' | 'high' | 'urgent';
			task_status: 'todo' | 'in_progress' | 'done';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

export type Tables<
	PublicTableNameOrOptions extends
		| keyof (Database['public']['Tables'] & Database['public']['Views'])
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
				Database[PublicTableNameOrOptions['schema']]['Views'])
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
			Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
				Database['public']['Views'])
		? (Database['public']['Tables'] &
				Database['public']['Views'])[PublicTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	PublicTableNameOrOptions extends
		| keyof Database['public']['Tables']
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: PublicTableNameOrOptions extends keyof Database['public']['Tables']
		? Database['public']['Tables'][PublicTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	PublicTableNameOrOptions extends
		| keyof Database['public']['Tables']
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: PublicTableNameOrOptions extends keyof Database['public']['Tables']
		? Database['public']['Tables'][PublicTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	PublicEnumNameOrOptions extends
		| keyof Database['public']['Enums']
		| { schema: keyof Database },
	EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
		: never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
	? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
	: PublicEnumNameOrOptions extends keyof Database['public']['Enums']
		? Database['public']['Enums'][PublicEnumNameOrOptions]
		: never;
