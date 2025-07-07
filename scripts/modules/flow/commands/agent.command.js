/**
 * @fileoverview Agent CLI Commands - Phase 5 Implementation
 * 
 * Provides comprehensive CLI commands for AI agent management including
 * listing, testing, health checks, code generation, and orchestration.
 */

import { 
  agentRegistry, 
  initializeAgentRegistry,
  SELECTION_STRATEGIES 
} from '../agents/registry.js'
import { AGENT_CAPABILITIES } from '../agents/agent.interface.js'

/**
 * Colors for console output
 */
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

/**
 * List all available agents with their status and capabilities
 */
export async function listAgentsCommand(options = {}) {
  try {
    console.log(`${c.bright}🤖 Available AI Agents${c.reset}`)
    console.log('─'.repeat(80))
    
    await initializeAgentRegistry()
    const agents = await agentRegistry.listAgents({ includeMetrics: true })
    
    if (agents.length === 0) {
      console.log(`${c.yellow}No agents available${c.reset}`)
      return
    }
    
    for (const agent of agents) {
      const statusIcon = getStatusIcon(agent.status, agent.healthy)
      const healthStatus = agent.healthy ? `${c.green}healthy${c.reset}` : `${c.red}unhealthy${c.reset}`
      
      console.log(`\n${statusIcon} ${c.bright}${agent.name}${c.reset} (${agent.type})`)
      console.log(`   Status: ${getStatusColor(agent.status)}${agent.status}${c.reset} | Health: ${healthStatus}`)
      console.log(`   Capabilities: ${c.cyan}${agent.capabilities.join(', ')}${c.reset}`)
      
      if (options.verbose && agent.metrics) {
        console.log(`   Metrics: ${agent.metrics.totalRequests} requests, ${Math.round(agent.metrics.averageResponseTime)}ms avg`)
        if (agent.qualityScore !== null) {
          console.log(`   Quality: ${getQualityColor(agent.qualityScore)}${Math.round(agent.qualityScore * 100)}%${c.reset}`)
        }
        if (agent.loadFactor !== undefined) {
          console.log(`   Load: ${getLoadColor(agent.loadFactor)}${Math.round(agent.loadFactor * 100)}%${c.reset}`)
        }
      }
      
      if (agent.lastHealthCheck) {
        const lastCheck = new Date(agent.lastHealthCheck).toLocaleString()
        console.log(`   Last health check: ${c.gray}${lastCheck}${c.reset}`)
      }
    }
    
    if (options.json) {
      console.log(`\n${c.bright}JSON Output:${c.reset}`)
      console.log(JSON.stringify(agents, null, 2))
    }
    
  } catch (error) {
    console.error(`${c.red}❌ Failed to list agents: ${error.message}${c.reset}`)
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`)
    }
    process.exit(1)
  }
}

/**
 * Test connectivity and functionality of a specific agent
 */
export async function testAgentCommand(provider, options = {}) {
  try {
    console.log(`${c.bright}🔧 Testing Agent: ${provider}${c.reset}`)
    console.log('─'.repeat(50))
    
    await initializeAgentRegistry()
    
    // Test 1: Get agent instance
    console.log(`${c.blue}📦 Test 1: Getting agent instance...${c.reset}`)
    const agent = await agentRegistry.getAgent(provider)
    console.log(`   ✅ Agent retrieved: ${agent.name} (${agent.id})`)
    
    // Test 2: Health check
    console.log(`${c.blue}🏥 Test 2: Checking agent health...${c.reset}`)
    const health = await agent.checkHealth()
    if (health.healthy) {
      console.log(`   ✅ Agent is healthy`)
      if (health.details && options.verbose) {
        console.log(`   Details: ${JSON.stringify(health.details, null, 4)}`)
      }
    } else {
      console.log(`   ❌ Agent is unhealthy: ${health.error}`)
    }
    
    // Test 3: Code generation test
    console.log(`${c.blue}💻 Test 3: Testing code generation...${c.reset}`)
    const testTask = {
      id: 'test-generation',
      description: 'Generate a simple hello world function',
      language: 'javascript'
    }
    
    const startTime = Date.now()
    const codeResult = await agent.generateCode(testTask, {}, { language: 'javascript' })
    const duration = Date.now() - startTime
    
    if (codeResult.success) {
      console.log(`   ✅ Code generation successful (${duration}ms)`)
      console.log(`   Language: ${codeResult.language}`)
      console.log(`   Code length: ${codeResult.code.length} characters`)
      
      if (options.showCode) {
        console.log(`\n${c.bright}Generated Code:${c.reset}`)
        console.log(codeResult.code)
      }
      
      if (codeResult.explanation && options.verbose) {
        console.log(`\n${c.bright}Explanation:${c.reset}`)
        console.log(codeResult.explanation)
      }
    } else {
      console.log(`   ❌ Code generation failed`)
    }
    
    // Test 4: Streaming test
    if (options.testStreaming) {
      console.log(`${c.blue}📡 Test 4: Testing streaming...${c.reset}`)
      console.log(`   Streaming chunks:`)
      
      let chunkCount = 0
      for await (const chunk of agent.streamResponse(testTask, {})) {
        chunkCount++
        console.log(`   ${chunkCount}. ${chunk.type}: ${chunk.content || chunk.message || 'No content'}`)
        
        if (chunkCount >= 5 && !options.fullStream) {
          console.log(`   ... (truncated, use --full-stream for complete output)`)
          break
        }
      }
      console.log(`   ✅ Streaming test completed (${chunkCount} chunks)`)
    }
    
    console.log(`\n${c.green}🎉 Agent test completed successfully!${c.reset}`)
    
  } catch (error) {
    console.error(`${c.red}❌ Agent test failed: ${error.message}${c.reset}`)
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`)
    }
    process.exit(1)
  }
}

/**
 * Check health of all agents or a specific agent
 */
export async function healthCheckCommand(provider = null, options = {}) {
  try {
    console.log(`${c.bright}🏥 Agent Health Check${c.reset}`)
    console.log('─'.repeat(60))
    
    await initializeAgentRegistry()
    
    if (provider) {
      // Check specific agent
      console.log(`${c.blue}Checking health of: ${provider}${c.reset}`)
      const health = await agentRegistry.checkAgentHealth(provider)
      
      const statusIcon = health.healthy ? '✅' : '❌'
      const status = health.healthy ? `${c.green}Healthy${c.reset}` : `${c.red}Unhealthy${c.reset}`
      
      console.log(`${statusIcon} ${status}`)
      
      if (health.details && options.verbose) {
        console.log(`\n${c.bright}Health Details:${c.reset}`)
        console.log(JSON.stringify(health.details, null, 2))
      }
      
      if (!health.healthy && health.error) {
        console.log(`${c.red}Error: ${health.error}${c.reset}`)
      }
    } else {
      // Check all agents
      console.log(`${c.blue}Checking health of all agents...${c.reset}`)
      const healthResults = await agentRegistry.checkAllHealth()
      
      let healthyCount = 0
      let totalCount = 0
      
      for (const [agentType, health] of healthResults.entries()) {
        totalCount++
        const statusIcon = health.healthy ? '✅' : '❌'
        const status = health.healthy ? `${c.green}Healthy${c.reset}` : `${c.red}Unhealthy${c.reset}`
        
        console.log(`${statusIcon} ${agentType}: ${status}`)
        
        if (health.healthy) {
          healthyCount++
          if (health.details?.latency && options.verbose) {
            console.log(`   Latency: ${health.details.latency}ms`)
          }
        } else if (health.error) {
          console.log(`   ${c.red}Error: ${health.error}${c.reset}`)
        }
      }
      
      console.log(`\n${c.bright}Summary:${c.reset} ${healthyCount}/${totalCount} agents healthy`)
      
      if (options.stats) {
        const stats = agentRegistry.getStatistics()
        console.log(`\n${c.bright}Registry Statistics:${c.reset}`)
        console.log(`Total Providers: ${stats.totalProviders}`)
        console.log(`Active Agents: ${stats.activeAgents}`)
        console.log(`Healthy Agents: ${stats.healthyAgents}`)
        console.log(`Total Requests: ${stats.totalRequests}`)
        console.log(`Success Rate: ${Math.round((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100)}%`)
        console.log(`Average Quality: ${Math.round(stats.averageQuality * 100)}%`)
      }
    }
    
  } catch (error) {
    console.error(`${c.red}❌ Health check failed: ${error.message}${c.reset}`)
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`)
    }
    process.exit(1)
  }
}

/**
 * Generate code using an AI agent
 */
export async function generateCodeCommand(task, options = {}) {
  try {
    console.log(`${c.bright}💻 AI Code Generation${c.reset}`)
    console.log('─'.repeat(60))
    
    await initializeAgentRegistry()
    
    // Prepare task object
    const taskObj = {
      id: `generation-${Date.now()}`,
      description: task,
      language: options.language || 'javascript',
      capabilities: [AGENT_CAPABILITIES.CODE_GENERATION]
    }
    
    // Select agent
    let agent
    if (options.agent) {
      console.log(`${c.blue}Using specified agent: ${options.agent}${c.reset}`)
      agent = await agentRegistry.getAgent(options.agent)
    } else {
      console.log(`${c.blue}Selecting best agent for task...${c.reset}`)
      agent = await agentRegistry.selectAgent(taskObj, {
        strategy: SELECTION_STRATEGIES.BEST_QUALITY
      })
      console.log(`   Selected: ${agent.name} (${agent.type})`)
    }
    
    // Generate code
    console.log(`\n${c.blue}Generating code...${c.reset}`)
    const startTime = Date.now()
    
    if (options.stream) {
      // Streaming generation
      console.log(`${c.bright}Streaming Generation:${c.reset}`)
      for await (const chunk of agent.streamResponse(taskObj, { language: options.language })) {
        const timestamp = new Date().toISOString().substr(11, 8)
        console.log(`${c.gray}[${timestamp}]${c.reset} ${chunk.type}: ${chunk.content || chunk.message || 'Progress update'}`)
        
        if (chunk.type === 'code') {
          console.log(`\n${c.bright}Generated Code:${c.reset}`)
          console.log(chunk.content)
        }
      }
    } else {
      // Direct generation
      const result = await agent.generateCode(taskObj, {}, { language: options.language })
      const duration = Date.now() - startTime
      
      if (result.success) {
        console.log(`${c.green}✅ Code generation completed (${duration}ms)${c.reset}`)
        console.log(`\n${c.bright}Generated Code (${result.language}):${c.reset}`)
        console.log(result.code)
        
        if (result.explanation) {
          console.log(`\n${c.bright}Explanation:${c.reset}`)
          console.log(result.explanation)
        }
        
        if (result.metadata && options.verbose) {
          console.log(`\n${c.bright}Metadata:${c.reset}`)
          console.log(`Agent: ${result.metadata.agentType} (${result.metadata.agentId})`)
          console.log(`Response Time: ${result.metadata.responseTime}ms`)
          if (result.metadata.tokens) {
            console.log(`Tokens: ${result.metadata.tokens}`)
          }
          if (result.metadata.cost) {
            console.log(`Cost: $${result.metadata.cost.toFixed(6)}`)
          }
        }
        
        // Update quality metrics in registry
        agentRegistry.updateQualityMetrics(agent.type, result)
      }
    }
    
  } catch (error) {
    console.error(`${c.red}❌ Code generation failed: ${error.message}${c.reset}`)
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`)
    }
    process.exit(1)
  }
}

/**
 * Show agent registry statistics
 */
export async function agentStatsCommand(options = {}) {
  try {
    console.log(`${c.bright}📊 Agent Registry Statistics${c.reset}`)
    console.log('─'.repeat(70))
    
    await initializeAgentRegistry()
    const stats = agentRegistry.getStatistics()
    
    console.log(`${c.bright}Registry Overview:${c.reset}`)
    console.log(`Total Providers: ${c.cyan}${stats.totalProviders}${c.reset}`)
    console.log(`Active Agents: ${c.cyan}${stats.activeAgents}${c.reset}`)
    console.log(`Healthy Agents: ${getHealthColor(stats.healthyAgents, stats.activeAgents)}${stats.healthyAgents}/${stats.activeAgents}${c.reset}`)
    
    console.log(`\n${c.bright}Usage Statistics:${c.reset}`)
    console.log(`Total Requests: ${c.cyan}${stats.totalRequests}${c.reset}`)
    console.log(`Successful Requests: ${c.cyan}${stats.successfulRequests}${c.reset}`)
    if (stats.totalRequests > 0) {
      const successRate = (stats.successfulRequests / stats.totalRequests) * 100
      console.log(`Success Rate: ${getPercentageColor(successRate)}${Math.round(successRate)}%${c.reset}`)
    }
    
    console.log(`\n${c.bright}Quality Metrics:${c.reset}`)
    const qualityPercentage = Math.round(stats.averageQuality * 100)
    console.log(`Average Quality Score: ${getQualityColor(stats.averageQuality)}${qualityPercentage}%${c.reset}`)
    
    if (options.detailed) {
      console.log(`\n${c.bright}Per-Agent Details:${c.reset}`)
      const agents = await agentRegistry.listAgents({ includeMetrics: true })
      
      for (const agent of agents) {
        if (agent.metrics && agent.metrics.totalRequests > 0) {
          console.log(`\n${c.bright}${agent.name}:${c.reset}`)
          console.log(`  Requests: ${agent.metrics.totalRequests}`)
          console.log(`  Success Rate: ${Math.round((agent.metrics.successfulRequests / agent.metrics.totalRequests) * 100)}%`)
          console.log(`  Avg Response Time: ${Math.round(agent.metrics.averageResponseTime)}ms`)
          console.log(`  Total Cost: $${agent.metrics.totalCost.toFixed(6)}`)
          if (agent.qualityScore !== null) {
            console.log(`  Quality Score: ${Math.round(agent.qualityScore * 100)}%`)
          }
        }
      }
    }
    
    if (options.json) {
      console.log(`\n${c.bright}JSON Output:${c.reset}`)
      console.log(JSON.stringify(stats, null, 2))
    }
    
  } catch (error) {
    console.error(`${c.red}❌ Failed to get statistics: ${error.message}${c.reset}`)
    if (options.verbose) {
      console.error(`${c.gray}${error.stack}${c.reset}`)
    }
    process.exit(1)
  }
}

// Helper functions for colored output

function getStatusIcon(status, healthy) {
  if (status === 'ready' && healthy) return '✅'
  if (status === 'ready' && !healthy) return '⚠️'
  if (status === 'busy') return '⏳'
  if (status === 'error') return '❌'
  if (status === 'offline') return '🔴'
  return '⚪'
}

function getStatusColor(status) {
  switch (status) {
    case 'ready': return c.green
    case 'busy': return c.yellow
    case 'error': return c.red
    case 'offline': return c.red
    default: return c.gray
  }
}

function getQualityColor(score) {
  if (score >= 0.8) return c.green
  if (score >= 0.6) return c.yellow
  return c.red
}

function getLoadColor(load) {
  if (load < 0.5) return c.green
  if (load < 0.8) return c.yellow
  return c.red
}

function getHealthColor(healthy, total) {
  const ratio = healthy / Math.max(total, 1)
  if (ratio >= 0.8) return c.green
  if (ratio >= 0.5) return c.yellow
  return c.red
}

function getPercentageColor(percentage) {
  if (percentage >= 80) return c.green
  if (percentage >= 60) return c.yellow
  return c.red
} 