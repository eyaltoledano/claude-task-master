import { Executor } from '../src/executor/executor.js'
import { Tool } from '../src/core/tool.js'
import { z } from 'zod'

describe('Executor', () => {
  let testVariable: string

  const testTool = Tool.define({
    id: 'test-tool',
    description: 'A test tool that changes a variable',
    parameters: z.object({
      value: z.string()
    }),
    execute: async (args) => {
      testVariable = args.value
      return {
        title: 'Test Tool Result',
        output: `Tool executed with value: ${args.value}`
      }
    }
  })

  beforeEach(() => {
    testVariable = ''
    Executor.reset()
  })

  describe('basic functionality', () => {
    it('should execute a tool and return result', async () => {
      Executor.init()

      const result = await Executor.execute(testTool, { value: 'test123' })

      expect(result).toBe('Tool executed with value: test123')
      expect(testVariable).toBe('test123')
    })

    it('should validate parameters', async () => {
      Executor.init()

      await expect(
        Executor.execute(testTool, { value: 123 })
      ).rejects.toThrow()
    })

    it('should throw error if not initialized', async () => {
      await expect(
        Executor.execute(testTool, { value: 'test' })
      ).rejects.toThrow('executor not initialised')
    })

    it('should throw error if initialized twice', () => {
      Executor.init()

      expect(() => Executor.init()).toThrow('already initialised')
    })

    it('should throw error if middleware added after init', () => {
      Executor.init()

      const dummyMiddleware = async (ctx: any, next: any) => next()
      expect(() => Executor.use(dummyMiddleware)).toThrow('executor frozen')
    })
  })

  describe('middleware integration', () => {
    it('should execute middleware in correct order', async () => {
      const executionOrder: string[] = []
      
      const middleware1 = async (ctx: any, next: any) => {
        executionOrder.push('mw1-before')
        await next()
        executionOrder.push('mw1-after')
      }

      const middleware2 = async (ctx: any, next: any) => {
        executionOrder.push('mw2-before')
        await next()
        executionOrder.push('mw2-after')
      }

      Executor.use(middleware1)
      Executor.use(middleware2)
      Executor.init()

      await Executor.execute(testTool, { value: 'test' })

      expect(executionOrder).toEqual([
        'mw1-before',
        'mw2-before',
        'mw2-after',
        'mw1-after'
      ])
    })

    it('should pass context through middleware', async () => {
      let capturedContext: any

      const middleware = async (ctx: any, next: any) => {
        capturedContext = ctx
        await next()
      }

      Executor.use(middleware)
      Executor.init()

      const meta = { testMeta: 'value' }
      await Executor.execute(testTool, { value: 'test' }, meta)

      expect(capturedContext.tool).toBe(testTool)
      expect(capturedContext.params).toEqual({ value: 'test' })
      expect(capturedContext.meta).toBe(meta)
    })
  })
})