/**
 * @fileoverview Mock AI Agent - Phase 5 Implementation
 * 
 * Provides a comprehensive mock implementation of the AIAgent interface
 * for testing and development without external API dependencies.
 * Simulates realistic behavior with configurable delays and responses.
 */

import { 
  AIAgent, 
  AGENT_CAPABILITIES, 
  AGENT_STATUS,
  AgentError
} from '../agent.interface.js'

/**
 * Mock AI Agent implementation for testing and development
 */
export class MockAgent extends AIAgent {
  constructor(config = {}) {
    super({
      type: 'mock',
      name: 'Mock AI Agent',
      capabilities: [
        AGENT_CAPABILITIES.CODE_GENERATION,
        AGENT_CAPABILITIES.CODE_REVIEW,
        AGENT_CAPABILITIES.PLANNING,
        AGENT_CAPABILITIES.TESTING,
        AGENT_CAPABILITIES.DOCUMENTATION,
        AGENT_CAPABILITIES.DEBUGGING,
        AGENT_CAPABILITIES.ARCHITECTURE
      ],
      ...config
    })
    
    // Mock-specific configuration
    this.simulateDelay = config.simulateDelay !== false // Default to true
    this.minDelay = config.minDelay || 500
    this.maxDelay = config.maxDelay || 2000
    this.failureRate = config.failureRate || 0 // 0-1, percentage of operations that should fail
    this.responses = config.responses || this._getDefaultResponses()
  }

  async _doInitialize(config) {
    // Simulate initialization delay
    if (this.simulateDelay) {
      await this._simulateDelay(200, 800)
    }
    
    return { 
      ready: true, 
      provider: 'mock',
      version: '1.0.0',
      models: ['mock-model-v1', 'mock-model-v2'],
      features: ['streaming', 'code-generation', 'multi-language']
    }
  }

  async _doGenerateCode(task, context, options) {
    // Simulate potential failure
    if (this._shouldSimulateFailure()) {
      throw new Error('Simulated code generation failure')
    }

    // Simulate generation delay
    if (this.simulateDelay) {
      await this._simulateDelay()
    }

    const language = options.language || task.language || 'javascript'
    const taskType = task.type || 'generic'
    
    // Generate realistic mock code based on task
    const mockCode = this._generateMockCode(task, context, language)
    const mockExplanation = this._generateMockExplanation(task, mockCode, language)
    
    return {
      code: mockCode,
      language,
      explanation: mockExplanation,
      tokens: mockCode.length / 4, // Approximate token count
      cost: (mockCode.length / 4) * 0.00001 // Mock cost calculation
    }
  }

  async _doExecuteTask(task, sandbox, options) {
    // Simulate potential failure
    if (this._shouldSimulateFailure()) {
      throw new Error('Simulated task execution failure')
    }

    // Simulate execution delay
    if (this.simulateDelay) {
      await this._simulateDelay(1000, 3000)
    }

    const steps = [
      'Analyzing task requirements',
      'Planning implementation approach',
      'Generating code structure',
      'Implementing core functionality',
      'Adding error handling',
      'Writing tests',
      'Optimizing performance',
      'Finalizing implementation'
    ]

    return {
      output: {
        success: true,
        steps: steps,
        result: `Mock execution completed for task: ${task.id || 'unknown'}`,
        artifacts: {
          generatedFiles: ['main.js', 'utils.js', 'tests.js'],
          documentation: 'README.md',
          metrics: {
            linesOfCode: Math.floor(Math.random() * 500) + 100,
            complexity: Math.floor(Math.random() * 10) + 1,
            testCoverage: Math.floor(Math.random() * 30) + 70
          }
        }
      }
    }
  }

  async* _doStreamResponse(task, options) {
    const steps = [
      { type: 'progress', content: 'Initializing mock agent...', progress: 5 },
      { type: 'log', content: 'Analyzing task requirements', level: 'info' },
      { type: 'progress', content: 'Planning approach...', progress: 15 },
      { type: 'log', content: 'Generating code structure', level: 'info' },
      { type: 'progress', content: 'Implementing functionality...', progress: 40 },
      { type: 'code', content: '// Mock generated code\nfunction mockFunction() {\n  return "Hello from mock agent";\n}', language: 'javascript' },
      { type: 'progress', content: 'Adding error handling...', progress: 60 },
      { type: 'log', content: 'Optimizing implementation', level: 'info' },
      { type: 'progress', content: 'Finalizing...', progress: 85 },
      { type: 'result', content: 'Mock task execution completed successfully', progress: 100 }
    ]

    for (const step of steps) {
      // Simulate streaming delay
      if (this.simulateDelay) {
        await this._simulateDelay(200, 800)
      }
      
      yield {
        ...step,
        timestamp: new Date().toISOString(),
        agentId: this.id,
        taskId: task.id || 'unknown'
      }
    }
  }

  async _doHealthCheck() {
    // Simulate health check delay
    if (this.simulateDelay) {
      await this._simulateDelay(100, 300)
    }

    return {
      status: 'healthy',
      provider: 'mock',
      latency: Math.floor(Math.random() * 100) + 50,
      features: {
        codeGeneration: true,
        streaming: true,
        multiLanguage: true,
        contextAware: true
      },
      limits: {
        tokensPerMinute: 1000000,
        requestsPerMinute: 1000,
        concurrentRequests: 10
      }
    }
  }

  // Mock-specific helper methods

  /**
   * Simulate realistic delay
   * @private
   */
  async _simulateDelay(minMs = null, maxMs = null) {
    const min = minMs || this.minDelay
    const max = maxMs || this.maxDelay
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Determine if this operation should simulate a failure
   * @private
   */
  _shouldSimulateFailure() {
    return Math.random() < this.failureRate
  }

  /**
   * Generate mock code based on task and context
   * @private
   */
  _generateMockCode(task, context, language) {
    const templates = this.responses.codeTemplates[language] || this.responses.codeTemplates.javascript
    const template = templates[Math.floor(Math.random() * templates.length)]
    
    // Replace placeholders in template
    return template
      .replace(/\{taskId\}/g, task.id || 'unknown')
      .replace(/\{timestamp\}/g, new Date().toISOString())
      .replace(/\{random\}/g, Math.random().toString(36).substr(2, 9))
  }

  /**
   * Generate mock explanation for generated code
   * @private
   */
  _generateMockExplanation(task, code, language) {
    const explanations = this.responses.explanations
    const template = explanations[Math.floor(Math.random() * explanations.length)]
    
    return template
      .replace(/\{language\}/g, language)
      .replace(/\{lines\}/g, code.split('\n').length)
      .replace(/\{taskId\}/g, task.id || 'unknown')
  }

  /**
   * Get default mock responses
   * @private
   */
  _getDefaultResponses() {
    return {
      codeTemplates: {
        javascript: [
          `// Mock implementation for task {taskId}
function mockImplementation() {
  console.log('Generated at: {timestamp}');
  
  // Mock functionality
  const result = {
    id: '{random}',
    status: 'success',
    timestamp: new Date().toISOString()
  };
  
  return result;
}

module.exports = { mockImplementation };`,
          `// Task {taskId} - Mock solution
class MockSolution {
  constructor(options = {}) {
    this.id = '{random}';
    this.options = options;
    this.created = '{timestamp}';
  }
  
  async execute() {
    console.log('Executing mock solution...');
    return { success: true, data: this.options };
  }
}

export default MockSolution;`,
          `// Mock utility for {taskId}
const mockUtils = {
  generateId: () => '{random}',
  getCurrentTime: () => '{timestamp}',
  processData: (data) => {
    return {
      processed: true,
      originalData: data,
      processedAt: new Date().toISOString()
    };
  }
};

export { mockUtils };`
        ],
        python: [
          `# Mock implementation for task {taskId}
import datetime

class MockImplementation:
    def __init__(self):
        self.id = "{random}"
        self.created = "{timestamp}"
    
    def execute(self, data=None):
        """Mock execution method"""
        print(f"Executing mock implementation: {{self.id}}")
        return {{
            "success": True,
            "data": data,
            "executed_at": datetime.datetime.now().isoformat()
        }}

if __name__ == "__main__":
    impl = MockImplementation()
    result = impl.execute()
    print(result)`,
          `# Task {taskId} - Mock solution
def mock_solution(input_data):
    """
    Mock solution function for task {taskId}
    Generated at: {timestamp}
    """
    processed_data = {{
        "id": "{random}",
        "input": input_data,
        "processed": True,
        "timestamp": "{timestamp}"
    }}
    
    return processed_data

# Example usage
if __name__ == "__main__":
    result = mock_solution({{"test": "data"}})
    print(f"Result: {{result}}")
`
        ],
        typescript: [
          `// Mock implementation for task {taskId}
interface MockResult {
  id: string;
  status: 'success' | 'error';
  timestamp: string;
  data?: any;
}

class MockImplementation {
  private id: string;
  private created: string;
  
  constructor() {
    this.id = '{random}';
    this.created = '{timestamp}';
  }
  
  async execute(input?: any): Promise<MockResult> {
    console.log(\`Executing mock implementation: \${{this.id}}\`);
    
    return {
      id: this.id,
      status: 'success',
      timestamp: new Date().toISOString(),
      data: input
    };
  }
}

export default MockImplementation;`
        ]
      },
      explanations: [
        `This {language} code provides a mock implementation that simulates the requested functionality. The solution includes {lines} lines of code with proper structure and error handling. Generated for task {taskId}.`,
        `I've created a {language} implementation with {lines} lines that addresses the core requirements. The code includes proper class structure, async handling where appropriate, and follows best practices for {language} development.`,
        `This {language} solution provides a working implementation with {lines} lines of code. It includes proper typing (where applicable), error handling, and is structured for maintainability and testing.`
      ]
    }
  }

  /**
   * Get mock capabilities for testing
   */
  static getMockCapabilities() {
    return [
      AGENT_CAPABILITIES.CODE_GENERATION,
      AGENT_CAPABILITIES.CODE_REVIEW,
      AGENT_CAPABILITIES.PLANNING,
      AGENT_CAPABILITIES.TESTING,
      AGENT_CAPABILITIES.DOCUMENTATION,
      AGENT_CAPABILITIES.DEBUGGING,
      AGENT_CAPABILITIES.ARCHITECTURE
    ]
  }

  /**
   * Create a configured mock agent for testing
   */
  static createTestAgent(overrides = {}) {
    return new MockAgent({
      simulateDelay: false, // Fast for testing
      failureRate: 0, // No failures in tests
      ...overrides
    })
  }

  /**
   * Create a realistic mock agent with delays
   */
  static createRealisticAgent(overrides = {}) {
    return new MockAgent({
      simulateDelay: true,
      minDelay: 1000,
      maxDelay: 3000,
      failureRate: 0.05, // 5% failure rate
      ...overrides
    })
  }
} 