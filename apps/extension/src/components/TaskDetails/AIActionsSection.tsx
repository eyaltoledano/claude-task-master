import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import {
	Wand2,
	Loader2,
	PlusCircle,
	TrendingUp,
	TrendingDown
} from 'lucide-react';
import {
	useUpdateTask,
	useUpdateSubtask,
	useScopeUpTask,
	useScopeDownTask
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
	const [scopePrompt, setScopePrompt] = useState('');
	const [scopeStrength, setScopeStrength] = useState<
		'light' | 'regular' | 'heavy'
	>('regular');
	const [lastAction, setLastAction] = useState<
		'regenerate' | 'append' | 'scope-up' | 'scope-down' | null
	>(null);
	const updateTask = useUpdateTask();
	const updateSubtask = useUpdateSubtask();
	const scopeUpTask = useScopeUpTask();
	const scopeDownTask = useScopeDownTask();

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

	const handleScopeUp = async () => {
		if (!currentTask) {
			return;
		}

		setLastAction('scope-up');

		try {
			const taskId =
				isSubtask && parentTask
					? `${parentTask.id}.${currentTask.id}`
					: currentTask.id;

			await scopeUpTask.mutateAsync({
				taskId,
				strength: scopeStrength,
				prompt: scopePrompt.trim() || undefined,
				options: { research: false }
			});

			setScopePrompt('');
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ AIActionsSection: Failed to scope up task:', error);
		} finally {
			setLastAction(null);
		}
	};

	const handleScopeDown = async () => {
		if (!currentTask) {
			return;
		}

		setLastAction('scope-down');

		try {
			const taskId =
				isSubtask && parentTask
					? `${parentTask.id}.${currentTask.id}`
					: currentTask.id;

			await scopeDownTask.mutateAsync({
				taskId,
				strength: scopeStrength,
				prompt: scopePrompt.trim() || undefined,
				options: { research: false }
			});

			setScopePrompt('');
			refreshComplexityAfterAI();
		} catch (error) {
			console.error('❌ AIActionsSection: Failed to scope down task:', error);
		} finally {
			setLastAction(null);
		}
	};

	// Track loading states based on the last action
	const isLoading =
		updateTask.isPending ||
		updateSubtask.isPending ||
		scopeUpTask.isPending ||
		scopeDownTask.isPending;
	const isRegenerating = isLoading && lastAction === 'regenerate';
	const isAppending = isLoading && lastAction === 'append';
	const isScopingUp = isLoading && lastAction === 'scope-up';
	const isScopingDown = isLoading && lastAction === 'scope-down';

	return (
		<CollapsibleSection
			title="AI Actions"
			icon={Wand2}
			defaultExpanded={true}
			buttonClassName="text-vscode-foreground/80 hover:text-vscode-foreground"
		>
			<div className="space-y-6">
				{/* Standard AI Actions Section */}
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
							disabled={isLoading}
						/>
					</div>

					<div className="flex gap-3">
						{!isSubtask && (
							<Button
								onClick={handleRegenerate}
								disabled={!prompt.trim() || isLoading}
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
							disabled={!prompt.trim() || isLoading}
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
				</div>

				{/* Scope Adjustment Section */}
				<div className="border-t border-vscode-widget-border pt-4 space-y-4">
					<div>
						<Label className="block text-sm font-medium text-vscode-foreground/80 mb-3">
							Task Complexity Adjustment
						</Label>

						{/* Strength Selection */}
						<div className="mb-3">
							<Label className="block text-xs text-vscode-foreground/60 mb-2">
								Adjustment Strength
							</Label>
							<div className="flex gap-2">
								{(['light', 'regular', 'heavy'] as const).map((strength) => (
									<Button
										key={strength}
										onClick={() => setScopeStrength(strength)}
										variant={scopeStrength === strength ? 'default' : 'outline'}
										size="sm"
										className={
											scopeStrength === strength
												? 'bg-accent text-accent-foreground border-accent'
												: 'border-widget-border text-vscode-foreground/80 hover:bg-vscode-list-hoverBackground'
										}
										disabled={isLoading}
									>
										{strength.charAt(0).toUpperCase() + strength.slice(1)}
									</Button>
								))}
							</div>
						</div>

						{/* Scope Prompt */}
						<Textarea
							placeholder="Optional: Specify how to adjust complexity (e.g., 'Focus on error handling', 'Remove unnecessary details', 'Add more implementation steps')"
							value={scopePrompt}
							onChange={(e) => setScopePrompt(e.target.value)}
							className="min-h-[80px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
							disabled={isLoading}
						/>
					</div>

					<div className="flex gap-3">
						<Button
							onClick={handleScopeUp}
							disabled={isLoading}
							variant="outline"
							className="flex-1 border-green-600/50 text-green-400 hover:bg-green-600/10 hover:border-green-500"
						>
							{isScopingUp ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Scoping Up...
								</>
							) : (
								<>
									<TrendingUp className="w-4 h-4 mr-2" />
									Scope Up
								</>
							)}
						</Button>

						<Button
							onClick={handleScopeDown}
							disabled={isLoading}
							variant="outline"
							className="flex-1 border-blue-600/50 text-blue-400 hover:bg-blue-600/10 hover:border-blue-500"
						>
							{isScopingDown ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Scoping Down...
								</>
							) : (
								<>
									<TrendingDown className="w-4 h-4 mr-2" />
									Scope Down
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Help Text */}
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
					<p>
						<strong>Scope Up:</strong> Increases task complexity with more
						details, requirements, or implementation steps
					</p>
					<p>
						<strong>Scope Down:</strong> Decreases task complexity by
						simplifying or removing unnecessary details
					</p>
				</div>
			</div>
		</CollapsibleSection>
	);
};
