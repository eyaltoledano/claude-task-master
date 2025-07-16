/**
 * Mock implementation of @vibe-kit/sdk
 * Prevents issues with Daytona SDK and untildify ES module conflicts during tests
 */

export class VibeKit {
	constructor(config = {}) {
		this.config = config;
		this.isActive = false;
	}

	async initialize() {
		this.isActive = true;
		return { success: true };
	}

	async generateCode(prompt, options = {}) {
		return {
			success: true,
			code: '// Mock generated code',
			files: [],
			metadata: {}
		};
	}

	async executeCommands(commands = []) {
		return {
			success: true,
			results: commands.map(cmd => ({
				command: cmd,
				exitCode: 0,
				output: 'Mock command output'
			}))
		};
	}

	async createPullRequest(options = {}) {
		return {
			success: true,
			prUrl: 'https://github.com/mock/repo/pull/123',
			prNumber: 123
		};
	}

	async cleanup() {
		this.isActive = false;
		return { success: true };
	}

	getStatus() {
		return {
			active: this.isActive,
			config: this.config
		};
	}
}

// Export as default as well in case it's imported that way
export default { VibeKit }; 