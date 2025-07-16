import { Log } from '../src/util/log.js'

namespace LogTest {
  const log = Log.create({ service: "log-test" })
  
  let capturedOutput: string[] = []
  let originalStderrWrite: typeof process.stderr.write

  export function setup() {
    capturedOutput = []
    originalStderrWrite = process.stderr.write
    process.stderr.write = (chunk: any) => {
      capturedOutput.push(chunk.toString())
      return true
    }
  }

  export function teardown() {
    process.stderr.write = originalStderrWrite
    capturedOutput = []
  }

  export function getCapturedOutput(): string[] {
    return [...capturedOutput]
  }

  export function getLastOutput(): string {
    return capturedOutput[capturedOutput.length - 1] || ''
  }

  export function clearOutput() {
    capturedOutput = []
  }
}

describe('Log Utility', () => {
  beforeEach(() => {
    LogTest.setup()
    Log.setLevel('DEBUG') // Ensure all logs are captured
  })

  afterEach(() => {
    LogTest.teardown()
  })

  describe('Log.create', () => {
    it('should create a logger with service tag', () => {
      const logger = Log.create({ service: 'test-service' })
      logger.info('test message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('service=test-service')
      expect(output).toContain('test message')
    })

    it('should create logger with multiple tags', () => {
      const logger = Log.create({ service: 'test-service-multi', module: 'auth' })
      logger.info('authentication started')

      const output = LogTest.getLastOutput()
      expect(output).toContain('service=test-service-multi')
      expect(output).toContain('module=auth')
      expect(output).toContain('authentication started')
    })

    it('should cache loggers by service name', () => {
      const logger1 = Log.create({ service: 'cached-service' })
      const logger2 = Log.create({ service: 'cached-service' })
      
      expect(logger1).toBe(logger2)
    })

    it('should not cache loggers without service tag', () => {
      const logger1 = Log.create({ module: 'test' })
      const logger2 = Log.create({ module: 'test' })
      
      expect(logger1).not.toBe(logger2)
    })
  })

  describe('Logger methods', () => {
    it('should log debug messages', () => {
      const logger = Log.create({ service: 'debug-test' })
      logger.debug('debug message', { extra: 'data' })

      const output = LogTest.getLastOutput()
      expect(output).toContain('DEBUG')
      expect(output).toContain('debug message')
      expect(output).toContain('extra=data')
    })

    it('should log info messages', () => {
      const logger = Log.create({ service: 'info-test' })
      logger.info('info message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('INFO')
      expect(output).toContain('info message')
    })

    it('should log warn messages', () => {
      const logger = Log.create({ service: 'warn-test' })
      logger.warn('warning message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('WARN')
      expect(output).toContain('warning message')
    })

    it('should log error messages', () => {
      const logger = Log.create({ service: 'error-test' })
      logger.error('error message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('ERROR')
      expect(output).toContain('error message')
    })
  })

  describe('Log levels', () => {
    it('should respect log level filtering', () => {
      Log.setLevel('ERROR')
      const logger = Log.create({ service: 'level-test' })
      
      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      const output = LogTest.getCapturedOutput()
      expect(output).toHaveLength(1)
      expect(output[0]).toContain('ERROR')
      expect(output[0]).toContain('error message')
    })

    it('should log INFO and above when level is INFO', () => {
      Log.setLevel('INFO')
      const logger = Log.create({ service: 'level-test' })
      
      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      const output = LogTest.getCapturedOutput()
      expect(output).toHaveLength(3)
      expect(output.join('')).toContain('INFO')
      expect(output.join('')).toContain('WARN')
      expect(output.join('')).toContain('ERROR')
      expect(output.join('')).not.toContain('DEBUG')
    })

    it('should get and set log levels', () => {
      Log.setLevel('WARN')
      expect(Log.getLevel()).toBe('WARN')
      
      Log.setLevel('DEBUG')
      expect(Log.getLevel()).toBe('DEBUG')
    })
  })

  describe('Logger tagging and cloning', () => {
    it('should add tags to existing logger', () => {
      const logger = Log.create({ service: 'tag-test' })
      logger.tag('user', 'john')
      logger.info('user action')

      const output = LogTest.getLastOutput()
      expect(output).toContain('service=tag-test')
      expect(output).toContain('user=john')
      expect(output).toContain('user action')
    })

    it('should clone logger with same tags', () => {
      const logger1 = Log.create({ service: 'clone-test', env: 'production' })
      const logger2 = logger1.clone()
      
      logger2.info('cloned message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('service=clone-test')
      expect(output).toContain('env=production')
      expect(output).toContain('cloned message')
    })

    it('should share tags between cloned loggers (current behavior)', () => {
      const logger1 = Log.create({ service: 'clone-shared' })
      const logger2 = logger1.clone()
      
      logger2.tag('request', '123')
      
      logger1.info('original')
      const output1 = LogTest.getLastOutput()
      LogTest.clearOutput()
      
      logger2.info('cloned')
      const output2 = LogTest.getLastOutput()

      // Both loggers share the same tags object, so both will have the request tag
      expect(output1).toContain('service=clone-shared')
      expect(output1).toContain('request=123')
      
      expect(output2).toContain('service=clone-shared')
      expect(output2).toContain('request=123')
    })
  })

  describe('Logger timing', () => {
    it('should log timing information', async () => {
      const logger = Log.create({ service: 'timing-test' })
      
      const timer = logger.time('test operation')
      await new Promise(resolve => setTimeout(resolve, 10))
      timer.stop()

      const output = LogTest.getCapturedOutput()
      expect(output).toHaveLength(2)
      expect(output[0]).toContain('status=started')
      expect(output[1]).toContain('status=completed')
      expect(output[1]).toContain('duration=')
    })

    it('should support Symbol.dispose for timing', async () => {
      const logger = Log.create({ service: 'timing-test' })
      
      {
        using timer = logger.time('auto-dispose operation')
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      const output = LogTest.getCapturedOutput()
      expect(output).toHaveLength(2)
      expect(output[0]).toContain('status=started')
      expect(output[1]).toContain('status=completed')
    })
  })

  describe('Default logger', () => {
    it('should provide a default logger', () => {
      Log.Default.info('default message')

      const output = LogTest.getLastOutput()
      expect(output).toContain('INFO')
      expect(output).toContain('service=default')
      expect(output).toContain('default message')
    })
  })

  describe('Output formatting', () => {
    it('should include timestamp and duration in output', () => {
      const logger = Log.create({ service: 'format-test' })
      logger.info('formatted message')

      const output = LogTest.getLastOutput()
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // ISO timestamp
      expect(output).toMatch(/\+\d+ms/) // Duration
    })

    it('should filter out undefined and null values', () => {
      const logger = Log.create({ service: 'filter-test' })
      logger.info('test message', { valid: 'value', invalid: undefined, nullValue: null })

      const output = LogTest.getLastOutput()
      expect(output).toContain('valid=value')
      expect(output).not.toContain('invalid=')
      expect(output).not.toContain('nullValue=')
    })
  })
})