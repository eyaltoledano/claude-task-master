import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Wand2, Loader2, PlusCircle } from 'lucide-react';
import {
	useUpdateTask,
	useUpdateSubtask
} from '../../webview/hooks/useTaskQueries';
import type { TaskMasterTask } from '../../webview/types';

interface AIActionsSectionProps {
	currentTask: TaskMasterTask;
	isSubtask: boolean;
	parentTask?: TaskMasterTask | null;
	sendMessage: (message: any) => Promise<any>;
	refreshComplexityAfterAI: () => void;
	onRegeneratingChange?: (isRegenerating: boolean) => void;
	onAppendingChange?: (isAppending: boolean) => void;
}

export const AIActionsSection: React.FC<AIActionsSectionProps> = ({
	currentTask,
	isSubtask,
	parentTask,
	sendMessage,
	refreshComplexityAfterAI,
	onRegeneratingChange,
	onAppendingChange
}) => {
	const [prompt, setPrompt] = useState('');
	const [lastAction, setLastAction] = useState<'regenerate' | 'append' | null>(
		null
	);
	const updateTask = useUpdateTask();
	const updateSubtask = useUpdateSubtask();

	const handleRegenerate = async () => {
		if (!currentTask || !prompt.trim()) {
			return;
		}

		setLastAction('regenerate');
		onRegeneratingChange?.(true);

		try {
			if (isSubtask && parentTask) {
				await updateSubtask.mutateAsync({
					taskId: `${parentTask.id}.${currentTask.id}`,
					prompt: prompt,
					options: { research: false }
				});
			} else {
				await updateTask.mutateAsync({
					taskId: currentTask.id,
					updates: { description: prompt },
					options: { append: false, research: false }
				});
			}

			setPrompt('');
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to regenerate task:', error);
		} finally {
			setLastAction(null);
			onRegeneratingChange?.(false);
		}
	};

	const handleAppend = async () => {
		if (!currentTask || !prompt.trim()) {
			return;
		}

		setLastAction('append');
		onAppendingChange?.(true);

		try {
			if (isSubtask && parentTask) {
				await updateSubtask.mutateAsync({
					taskId: `${parentTask.id}.${currentTask.id}`,
					prompt: prompt,
					options: { research: false }
				});
			} else {
				await updateTask.mutateAsync({
					taskId: currentTask.id,
					updates: { description: prompt },
					options: { append: true, research: false }
				});
			}

			setPrompt('');
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to append to task:', error);
		} finally {
			setLastAction(null);
			onAppendingChange?.(false);
		}
	};

	// Track loading states based on the last action
	const isLoading = updateTask.isPending || updateSubtask.isPending;
	const isRegenerating = isLoading && lastAction === 'regenerate';
	const isAppending = isLoading && lastAction === 'append';

	return (
		<CollapsibleSection
			title="AI Actions"
			icon={Wand2}
			defaultExpanded={true}
			buttonClassName="text-vscode-foreground/80 hover:text-vscode-foreground"
		>
			<div className="space-y-4">
				<div>
					<Label
						htmlFor="ai-prompt"
						className="block text-sm font-medium text-vscode-foreground/80 mb-2"
					>
						Enter your prompt
					</Label>
					<Textarea
						id="ai-prompt"
						placeholder={
							isSubtask
								? 'Describe implementation notes, progress updates, or findings to add to this subtask...'
								: 'Describe what you want to change or add to this task...'
						}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						className="min-h-[100px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
						disabled={isRegenerating || isAppending}
					/>
				</div>

				<div className="flex gap-3">
					{!isSubtask && (
						<Button
							onClick={handleRegenerate}
							disabled={!prompt.trim() || isRegenerating || isAppending}
							className="bg-primary text-primary-foreground hover:bg-primary/90"
						>
							{isRegenerating ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Regenerating...
								</>
							) : (
								<>
									<Wand2 className="w-4 h-4 mr-2" />
									Regenerate Task
								</>
							)}
						</Button>
					)}

					<Button
						onClick={handleAppend}
						disabled={!prompt.trim() || isRegenerating || isAppending}
						variant={isSubtask ? 'default' : 'outline'}
						className={
							isSubtask
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 border-widget-border'
						}
					>
						{isAppending ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								{isSubtask ? 'Updating...' : 'Appending...'}
							</>
						) : (
							<>
								<PlusCircle className="w-4 h-4 mr-2" />
								{isSubtask ? 'Add Notes to Subtask' : 'Append to Task'}
							</>
						)}
					</Button>
				</div>

				<div className="text-xs text-vscode-foreground/60 space-y-1">
					{isSubtask ? (
						<p>
							<strong>Add Notes:</strong> Appends timestamped implementation
							notes, progress updates, or findings to this subtask's details
						</p>
					) : (
						<>
							<p>
								<strong>Regenerate:</strong> Completely rewrites the task
								description and subtasks based on your prompt
							</p>
							<p>
								<strong>Append:</strong> Adds new content to the existing task
								implementation details based on your prompt
							</p>
						</>
					)}
				</div>
			</div>
		</CollapsibleSection>
	);
};
