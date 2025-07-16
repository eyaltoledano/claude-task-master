import { Executor } from '../src/executor/executor.js'
import { echoTool } from '../src/tools/echo.js'
import { mwLogging } from '../src/executor/middleware/logging.js'
import { mwTiming } from '../src/executor/middleware/timing.js'
import { mwErrorToResponse } from '../src/executor/middleware/error-response.js'

describe('Middleware Integration', () => {
  beforeEach(() => {
    Executor.reset()
  })

  describe('timing middleware', () => {
    it('should add timing metadata', async () => {
      Executor.use(mwLogging)
      Executor.use(mwTiming)
      Executor.init()

      const meta: Record<string, unknown> = {}
      await Executor.execute(echoTool, { text: 'test' }, meta)
      
      expect(typeof meta.durationMs).toBe('number')
      expect(meta.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error propagation', () => {
    it('should propagate validation errors', async () => {
      Executor.use(mwLogging)
      Executor.init()

      await expect(
        Executor.execute(echoTool, { wrongParam: 'should fail' })
      ).rejects.toThrow()
    })

    it('should propagate validation errors with specific type', async () => {
      Executor.init()

      await expect(
        Executor.execute(echoTool, { text: 123 })
      ).rejects.toThrow()
    })
  })

  describe('parameter validation', () => {
    it('should handle valid parameters', async () => {
      Executor.init()

      const result = await Executor.execute(echoTool, { text: 'valid' })
      expect(result).toBe('You said: valid')
    })

    it('should reject invalid parameter types', async () => {
      Executor.init()

      await expect(
        Executor.execute(echoTool, { text: 123 })
      ).rejects.toThrow()
    })
  })

  describe('error response middleware', () => {
    it('should convert errors to response objects', async () => {
      Executor.use(mwErrorToResponse)
      Executor.init()

      const result = await Executor.execute(echoTool, { wrongParam: 'should fail' })
      
      expect(result).toEqual({
        ok: false,
        error: expect.any(String)
      })
    })

    it('should not interfere with successful executions', async () => {
      Executor.use(mwErrorToResponse)
      Executor.init()

      const result = await Executor.execute(echoTool, { text: 'test' })
      expect(result).toBe('You said: test')
    })
  })
})