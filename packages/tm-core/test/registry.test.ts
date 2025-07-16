import { Registry } from '../src/core/registry.js'
import { Tool } from '../src/core/tool.js'
import { Log } from '../src/util/log.js'
import { Executor } from '../src/executor/executor.js'
import { z } from 'zod'

namespace RegistryTest {
  const log = Log.create({ service: "registry-test" })

  export function clearRegistry() {
    Registry.clear()
    Executor.reset()
  }

  export function getRegistrySize() {
    return Registry.size()
  }

  export function createTestTool(id: string, description: string = `Test tool ${id}`) {
    return Tool.define({
      id,
      description,
      parameters: z.object({
        input: z.string().optional()
      }),
      execute: async (args) => {
        return {
          title: `${id} executed`,
          metadata: { toolId: id },
          output: `Tool ${id} processed: ${args.input || 'no input'}`
        }
      }
    })
  }

  export function createComplexTool(id: string) {
    return Tool.define({
      id,
      description: `Complex tool with multiple parameters`,
      parameters: z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean().default(true)
      }),
      execute: async (args) => {
        return {
          title: `Complex operation for ${args.name}`,
          metadata: { 
            toolId: id,
            userAge: args.age,
            isActive: args.active
          },
          output: `Processed ${args.name} (age: ${args.age}, active: ${args.active})`
        }
      }
    })
  }

  export function createStrictTool(id: string) {
    return Tool.define({
      id,
      description: `Strict tool with required parameters`,
      parameters: z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email()
      }),
      execute: async (args) => {
        return {
          title: `Strict operation for ${args.name}`,
          metadata: { 
            toolId: id,
            userAge: args.age,
            email: args.email
          },
          output: `Processed ${args.name} (age: ${args.age}, email: ${args.email})`
        }
      }
    })
  }
}

describe('Registry', () => {
  beforeEach(() => {
    RegistryTest.clearRegistry()
  })

  describe('register function', () => {
    it('should register a tool in the registry', () => {
      const tool = RegistryTest.createTestTool('test-tool-1')
      
      expect(RegistryTest.getRegistrySize()).toBe(0)
      Registry.register(tool)
      expect(RegistryTest.getRegistrySize()).toBe(1)
    })

    it('should register multiple tools', () => {
      const tool1 = RegistryTest.createTestTool('tool-1')
      const tool2 = RegistryTest.createTestTool('tool-2')
      const tool3 = RegistryTest.createTestTool('tool-3')

      Registry.register(tool1)
      Registry.register(tool2)
      Registry.register(tool3)

      expect(RegistryTest.getRegistrySize()).toBe(3)
    })

    it('should allow registering the same tool multiple times', () => {
      const tool = RegistryTest.createTestTool('duplicate-tool')
      
      Registry.register(tool)
      Registry.register(tool)
      Registry.register(tool)

      expect(RegistryTest.getRegistrySize()).toBe(3)
    })

    it('should register tools with complex parameters', () => {
      const complexTool = RegistryTest.createComplexTool('complex-tool')
      
      Registry.register(complexTool)
      
      expect(RegistryTest.getRegistrySize()).toBe(1)
      const registeredTool = Registry.findById('complex-tool')
      expect(registeredTool?.id).toBe('complex-tool')
      expect(registeredTool?.description).toBe('Complex tool with multiple parameters')
    })
  })

  describe('registry access', () => {
    it('should store tools in order they were registered', () => {
      const tool1 = RegistryTest.createTestTool('first-tool')
      const tool2 = RegistryTest.createTestTool('second-tool')
      const tool3 = RegistryTest.createTestTool('third-tool')

      Registry.register(tool1)
      Registry.register(tool2)
      Registry.register(tool3)

      const allTools = Registry.getAll()
      expect(allTools[0].id).toBe('first-tool')
      expect(allTools[1].id).toBe('second-tool')
      expect(allTools[2].id).toBe('third-tool')
    })

    it('should provide direct access to registered tools', () => {
      const tool = RegistryTest.createTestTool('accessible-tool', 'A tool for testing access')
      
      Registry.register(tool)
      
      const foundTool = Registry.findById('accessible-tool')
      expect(foundTool).toBe(tool)
      expect(foundTool?.id).toBe('accessible-tool')
      expect(foundTool?.description).toBe('A tool for testing access')
    })

    it('should allow finding tools by id', () => {
      const tool1 = RegistryTest.createTestTool('finder-tool-1')
      const tool2 = RegistryTest.createTestTool('finder-tool-2')
      const tool3 = RegistryTest.createTestTool('finder-tool-3')

      Registry.register(tool1)
      Registry.register(tool2)
      Registry.register(tool3)

      const foundTool = Registry.findById('finder-tool-2')
      expect(foundTool).toBe(tool2)
      expect(foundTool?.id).toBe('finder-tool-2')
    })

    it('should allow filtering tools by description', () => {
      const tool1 = RegistryTest.createTestTool('filter-tool-1', 'First filter tool')
      const tool2 = RegistryTest.createTestTool('filter-tool-2', 'Second filter tool')
      const tool3 = RegistryTest.createTestTool('other-tool', 'Different tool')

      Registry.register(tool1)
      Registry.register(tool2)
      Registry.register(tool3)

      const filterTools = Registry.findByDescription('filter')
      expect(filterTools).toHaveLength(2)
      expect(filterTools[0].id).toBe('filter-tool-1')
      expect(filterTools[1].id).toBe('filter-tool-2')
    })

    it('should support getting all tools', () => {
      const tools = [
        RegistryTest.createTestTool('map-tool-1'),
        RegistryTest.createTestTool('map-tool-2'),
        RegistryTest.createTestTool('map-tool-3')
      ]

      tools.forEach(Registry.register)

      const allTools = Registry.getAll()
      const toolIds = allTools.map(tool => tool.id)
      expect(toolIds).toEqual(['map-tool-1', 'map-tool-2', 'map-tool-3'])
    })

    it('should check if tools exist by id', () => {
      const tool = RegistryTest.createTestTool('exists-tool')
      
      expect(Registry.exists('exists-tool')).toBe(false)
      Registry.register(tool)
      expect(Registry.exists('exists-tool')).toBe(true)
      expect(Registry.exists('non-existent')).toBe(false)
    })
  })

  describe('registry persistence', () => {
    it('should maintain registry state between operations', () => {
      const tool1 = RegistryTest.createTestTool('persistent-tool-1')
      const tool2 = RegistryTest.createTestTool('persistent-tool-2')

      Registry.register(tool1)
      expect(RegistryTest.getRegistrySize()).toBe(1)
      
      Registry.register(tool2)
      expect(RegistryTest.getRegistrySize()).toBe(2)
      
      // Registry should still contain both tools
      const allTools = Registry.getAll()
      expect(allTools[0].id).toBe('persistent-tool-1')
      expect(allTools[1].id).toBe('persistent-tool-2')
    })

    it('should handle empty registry gracefully', () => {
      expect(RegistryTest.getRegistrySize()).toBe(0)
      expect(Registry.getAll().length).toBe(0)
      expect(Registry.findById('nonexistent')).toBeUndefined()
    })

    it('should clear registry completely', () => {
      const tools = [
        RegistryTest.createTestTool('clear-tool-1'),
        RegistryTest.createTestTool('clear-tool-2'),
        RegistryTest.createTestTool('clear-tool-3')
      ]

      tools.forEach(Registry.register)
      expect(RegistryTest.getRegistrySize()).toBe(3)

      Registry.clear()
      expect(RegistryTest.getRegistrySize()).toBe(0)
      expect(Registry.getAll()).toHaveLength(0)
    })
  })

  describe('tool execution from registry', () => {
    it('should execute tools retrieved from registry', async () => {
      const tool = RegistryTest.createTestTool('executable-tool')
      
      Registry.register(tool)
      
      const registeredTool = Registry.findById('executable-tool')!
      const result = await registeredTool.execute(
        { input: 'test data' },
        { 
          metadata: { source: 'registry-test' },
          logger: Log.create({ service: 'test-execution' })
        }
      )

      expect(result.title).toBe('executable-tool executed')
      expect(result.output).toBe('Tool executable-tool processed: test data')
      expect(result.metadata?.toolId).toBe('executable-tool')
    })

    it('should execute complex tools from registry', async () => {
      const complexTool = RegistryTest.createComplexTool('complex-executable')
      
      Registry.register(complexTool)
      
      const registeredTool = Registry.findById('complex-executable')!
      const result = await registeredTool.execute(
        { name: 'John', age: 30, active: true },
        { 
          metadata: { source: 'registry-test' },
          logger: Log.create({ service: 'test-execution' })
        }
      )

      expect(result.title).toBe('Complex operation for John')
      expect(result.output).toBe('Processed John (age: 30, active: true)')
      expect(result.metadata?.userAge).toBe(30)
      expect(result.metadata?.isActive).toBe(true)
    })
  })

  describe('tool parameter validation', () => {
    it('should validate tool parameters when executed through executor', async () => {
      const tool = RegistryTest.createStrictTool('validation-tool')
      
      Registry.register(tool)
      Executor.init()
      
      // First test: valid parameters should work
      const validResult = await Executor.execute(
        tool,
        { name: 'John', age: 30, email: 'john@example.com' }
      )
      expect(validResult).toContain('John')

      // Should throw for missing required parameters (validation happens in executor)
      await expect(
        Executor.execute(
          tool,
          { name: 'John' } // missing required 'age' and 'email' fields
        )
      ).rejects.toThrow()

      // Should throw for wrong types and invalid email
      await expect(
        Executor.execute(
          tool,
          { name: 123, age: 'thirty', email: 'invalid-email' } // wrong types and invalid email
        )
      ).rejects.toThrow()
    })

    it('should handle optional parameters correctly through executor', async () => {
      const tool = RegistryTest.createTestTool('optional-tool')
      
      Registry.register(tool)
      Executor.init()
      
      // Should work with optional parameter
      const result1 = await Executor.execute(tool, { input: 'provided' })
      expect(result1).toBe('Tool optional-tool processed: provided')

      // Should work without optional parameter
      const result2 = await Executor.execute(tool, {})
      expect(result2).toBe('Tool optional-tool processed: no input')
    })
  })
})