import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

export const useDataStore = create(
	subscribeWithSelector(
		persist(
			(set, get) => ({
				// Task Data
				tasks: [],
				currentTag: 'master',
				nextTask: null,
				hasTasksFile: false,

				// Git Data
				currentBranch: null,
				repositoryName: null,
				branchInfo: null,
				remoteInfo: null,
				worktreePromptData: null,

				// AI/Chat Data
				messages: [],
				currentModel: 'claude-3-5-sonnet-20241022',

				// App Data
				version: '',

				// Task Actions
				setTasks: (tasks) => set({ tasks }),
				setCurrentTag: (tag) => set({ currentTag: tag }),
				setNextTask: (task) => set({ nextTask: task }),
				setHasTasksFile: (hasFile) => set({ hasTasksFile: hasFile }),

				// Git Actions
				setCurrentBranch: (branch) => set({ currentBranch: branch }),
				setRepositoryName: (name) => set({ repositoryName: name }),
				setBranchInfo: (info) =>
					set({
						branchInfo: info,
						currentBranch: info?.name || null
					}),
				setRemoteInfo: (info) => set({ remoteInfo: info }),
				setWorktreePromptData: (data) => set({ worktreePromptData: data }),

				// Message Actions
				addMessage: (message) =>
					set((state) => ({
						messages: [...state.messages, message]
					})),
				setMessages: (messages) => set({ messages }),
				clearMessages: () => set({ messages: [] }),

				// Model Actions
				setCurrentModel: (model) => set({ currentModel: model }),

				// App Actions
				setVersion: (version) => set({ version }),

				// Utility Actions
				resetTaskData: () =>
					set({
						tasks: [],
						nextTask: null,
						hasTasksFile: false
					}),

				resetGitData: () =>
					set({
						currentBranch: null,
						repositoryName: null,
						branchInfo: null,
						remoteInfo: null,
						worktreePromptData: null
					}),

				// Computed getters
				getTaskById: (id) => {
					const state = get();
					return state.tasks.find((task) => task.id === id);
				},

				getTasksByStatus: (status) => {
					const state = get();
					return state.tasks.filter((task) => task.status === status);
				},

				hasGitRepository: () => {
					const state = get();
					return Boolean(state.currentBranch || state.repositoryName);
				}
			}),
			{
				name: 'taskmaster-data-store',
				partialize: (state) => ({
					currentTag: state.currentTag,
					currentModel: state.currentModel,
					version: state.version
				}),
				version: 1
			}
		)
	)
);
