/**
 * Task Edit Modal Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { TaskMasterTask, TaskUpdates } from '../types';

interface TaskEditModalProps {
	task: TaskMasterTask;
	onSave: (taskId: string, updates: TaskUpdates) => Promise<void>;
	onCancel: () => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
	task,
	onSave,
	onCancel
}) => {
	const [updates, setUpdates] = useState<TaskUpdates>({
		title: task.title,
		description: task.description || '',
		details: task.details || '',
		testStrategy: task.testStrategy || '',
		priority: task.priority,
		dependencies: task.dependencies || []
	});
	const [isSaving, setIsSaving] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const titleInputRef = useRef<HTMLInputElement>(null);

	// Focus title input on mount
	useEffect(() => {
		titleInputRef.current?.focus();
		titleInputRef.current?.select();
	}, []);

	const handleSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		setIsSaving(true);

		try {
			await onSave(task.id, updates);
		} catch (error) {
			console.error('Failed to save task:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const hasChanges = () => {
		return (
			updates.title !== task.title ||
			updates.description !== (task.description || '') ||
			updates.details !== (task.details || '') ||
			updates.testStrategy !== (task.testStrategy || '') ||
			updates.priority !== task.priority ||
			JSON.stringify(updates.dependencies) !==
				JSON.stringify(task.dependencies || [])
		);
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-vscode-editor-background border border-vscode-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-vscode-border">
					<h2 className="text-lg font-semibold">Edit Task #{task.id}</h2>
					<button
						onClick={onCancel}
						className="text-vscode-foreground/50 hover:text-vscode-foreground transition-colors"
					>
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Form */}
				<form
					ref={formRef}
					onSubmit={handleSubmit}
					className="flex-1 overflow-y-auto p-4 space-y-4"
				>
					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="title">Title</Label>
						<input
							ref={titleInputRef}
							id="title"
							type="text"
							value={updates.title || ''}
							onChange={(e) =>
								setUpdates({ ...updates, title: e.target.value })
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded-md text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							placeholder="Task title"
						/>
					</div>

					{/* Priority */}
					<div className="space-y-2">
						<Label htmlFor="priority">Priority</Label>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" className="w-full justify-between">
									<span className="capitalize">{updates.priority}</span>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-full">
								<DropdownMenuItem
									onClick={() => setUpdates({ ...updates, priority: 'high' })}
								>
									High
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setUpdates({ ...updates, priority: 'medium' })}
								>
									Medium
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setUpdates({ ...updates, priority: 'low' })}
								>
									Low
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={updates.description || ''}
							onChange={(e) =>
								setUpdates({ ...updates, description: e.target.value })
							}
							className="min-h-[80px]"
							placeholder="Brief description of the task"
						/>
					</div>

					{/* Details */}
					<div className="space-y-2">
						<Label htmlFor="details">Implementation Details</Label>
						<Textarea
							id="details"
							value={updates.details || ''}
							onChange={(e) =>
								setUpdates({ ...updates, details: e.target.value })
							}
							className="min-h-[120px]"
							placeholder="Technical details and implementation notes"
						/>
					</div>

					{/* Test Strategy */}
					<div className="space-y-2">
						<Label htmlFor="testStrategy">Test Strategy</Label>
						<Textarea
							id="testStrategy"
							value={updates.testStrategy || ''}
							onChange={(e) =>
								setUpdates({ ...updates, testStrategy: e.target.value })
							}
							className="min-h-[80px]"
							placeholder="How to test this task"
						/>
					</div>

					{/* Dependencies */}
					<div className="space-y-2">
						<Label htmlFor="dependencies">
							Dependencies (comma-separated task IDs)
						</Label>
						<input
							id="dependencies"
							type="text"
							value={updates.dependencies?.join(', ') || ''}
							onChange={(e) =>
								setUpdates({
									...updates,
									dependencies: e.target.value
										.split(',')
										.map((d) => d.trim())
										.filter(Boolean)
								})
							}
							className="w-full px-3 py-2 bg-vscode-input border border-vscode-border rounded-md text-vscode-foreground focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
							placeholder="e.g., 1, 2.1, 3"
						/>
					</div>
				</form>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 p-4 border-t border-vscode-border">
					<Button variant="outline" onClick={onCancel} disabled={isSaving}>
						Cancel
					</Button>
					<Button
						onClick={() => handleSubmit()}
						disabled={isSaving || !hasChanges()}
					>
						{isSaving ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</div>
		</div>
	);
};
