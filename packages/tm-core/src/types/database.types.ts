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
            foreignKeyName: 'tasks_parent_task_id_fkey';
            columns: ['parent_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
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
          },
        ];
      };
    };
    Enums: {
      task_priority: 'low' | 'medium' | 'high' | 'urgent';
      task_status: 'todo' | 'in_progress' | 'done';
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];