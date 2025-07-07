/**
 * @fileoverview Flow System CLI Commands - Configuration & Error Handling
 * 
 * CLI commands for managing Flow configuration, error handling, and logging.
 */

import { initializeFlowSystem, getFlowSystemConfig, applyEnvironmentConfig, ENVIRONMENT_CONFIGS } from '../config/flow-system-integration.js'
import { LOG_LEVELS } from '../logging/flow-logger.js'

/**
 * Initialize Flow System command
 */
export async function initCommand(options = {}) {
  const {
    verbose = false,
    environment = 'development',
    configFile,
    validate = true
  } = options

  try {
    console.log('🚀 Initializing Flow System: Configuration & Error Handling...')
    
    const result = await initializeFlowSystem({
      environment,
      configFile,
      validate
    })

    const summary = result.getSummary()
    
    if (verbose) {
      console.log('\n📋 Initialization Summary:')
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log('✅ Flow System initialized successfully')
      console.log(`   Environment: ${environment}`)
      console.log(`   Configuration: ${summary.components.configuration.configFile || 'default'}`)
      console.log(`   Log Level: ${summary.components.configuration.level}`)
      console.log(`   Provider: ${summary.components.configuration.provider}`)
      console.log(`   Agent: ${summary.components.configuration.agent}`)
    }

    return { success: true, summary }
  } catch (error) {
    console.error('❌ Flow System initialization failed:', error.message)
    if (verbose) {
      console.error(error.stack)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Show configuration command
 */
export async function configShowCommand(options = {}) {
  const { verbose = false, format = 'simple', json = false } = options

  try {
    const { config } = await getFlowSystemConfig()
    const allConfig = config.getAll()

    if (format === 'json' || json) {
      console.log(JSON.stringify(allConfig, null, 2))
    } else {
      console.log('🔧 Flow Configuration:')
      console.log('')
      
      // Core settings
      console.log('📊 Core Settings:')
      console.log(`   Environment: ${allConfig.nodeEnv}`)
      console.log(`   Provider: ${allConfig.defaultProvider}`)
      console.log(`   Agent: ${allConfig.defaultAgent}`)
      console.log(`   Log Level: ${allConfig.logLevel}`)
      console.log('')
      
      // Execution settings
      console.log('⚡ Execution Settings:')
      console.log(`   Execution Timeout: ${allConfig.executionTimeout}ms`)
      console.log(`   Max Concurrent: ${allConfig.maxConcurrentExecutions}`)
      console.log(`   Cleanup on Exit: ${allConfig.cleanupOnExit}`)
      console.log('')
      
      // Error handling
      console.log('🛡️ Error Handling:')
      console.log(`   Retries Enabled: ${allConfig.enableRetries}`)
      console.log(`   Max Retries: ${allConfig.agentMaxRetries}`)
      console.log(`   Circuit Breaker: ${allConfig.enableCircuitBreaker}`)
      console.log(`   Circuit Threshold: ${allConfig.circuitBreakerThreshold}`)
      console.log('')
      
      if (verbose) {
        console.log('📁 Storage & Logging:')
        console.log(`   Data Directory: ${allConfig.dataDirectory}`)
        console.log(`   State Directory: ${allConfig.stateDirectory}`)
        console.log(`   Log to File: ${allConfig.logToFile}`)
        console.log(`   Log File: ${allConfig.logFilePath}`)
        console.log('')
        
        console.log('🔬 Development:')
        console.log(`   Debug Mode: ${allConfig.debugMode}`)
        console.log(`   Verbose Logging: ${allConfig.verboseLogging}`)
        console.log(`   Mock Delays: ${allConfig.mockDelays}`)
      }
    }

    return { success: true, config: allConfig }
  } catch (error) {
    console.error('❌ Failed to show configuration:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Set configuration value command
 */
export async function configSetCommand(key, value, options = {}) {
  const { verbose = false } = options

  try {
    const { config, logger } = await getFlowSystemConfig()
    
    // Parse value based on type
    let parsedValue = value
    if (value === 'true') parsedValue = true
    else if (value === 'false') parsedValue = false
    else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10)
    else if (/^\d*\.\d+$/.test(value)) parsedValue = parseFloat(value)

    config.set(key, parsedValue)
    
    await logger.info('Configuration updated', {
      category: 'configuration',
      key,
      oldValue: config.get(key),
      newValue: parsedValue
    })

    console.log(`✅ Configuration updated: ${key} = ${parsedValue}`)
    
    if (verbose) {
      console.log(`   Type: ${typeof parsedValue}`)
      console.log(`   Previous: ${config.get(key)}`)
    }

    return { success: true, key, value: parsedValue }
  } catch (error) {
    console.error('❌ Failed to set configuration:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Apply environment configuration command
 */
export async function configEnvCommand(environment, options = {}) {
  const { verbose = false } = options

  try {
    if (!ENVIRONMENT_CONFIGS[environment]) {
      throw new Error(`Unknown environment: ${environment}. Available: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`)
    }

    await applyEnvironmentConfig(environment)
    
    console.log(`✅ Applied ${environment} configuration`)
    
    if (verbose) {
      const changes = ENVIRONMENT_CONFIGS[environment]
      console.log('\n📝 Applied changes:')
      for (const [key, value] of Object.entries(changes)) {
        console.log(`   ${key}: ${value}`)
      }
    }

    return { success: true, environment, changes: ENVIRONMENT_CONFIGS[environment] }
  } catch (error) {
    console.error('❌ Failed to apply environment configuration:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Show error handling status command
 */
export async function errorStatusCommand(options = {}) {
  const { verbose = false } = options

  try {
    const { errorManager } = await getFlowSystemConfig()
    const status = errorManager.getStatus()

    console.log('🛡️ Error Handling Status:')
    console.log('')
    
    // Circuit breakers
    console.log('⚡ Circuit Breakers:')
    if (status.circuitBreakers.length === 0) {
      console.log('   No circuit breakers registered')
    } else {
      for (const breaker of status.circuitBreakers) {
        const stateIcon = breaker.state === 'CLOSED' ? '🟢' : breaker.state === 'OPEN' ? '🔴' : '🟡'
        console.log(`   ${stateIcon} ${breaker.name}: ${breaker.state}`)
        if (verbose) {
          console.log(`      Failures: ${breaker.failureCount}/${breaker.threshold}`)
          if (breaker.lastFailureTime) {
            console.log(`      Last Failure: ${new Date(breaker.lastFailureTime).toLocaleString()}`)
          }
        }
      }
    }
    console.log('')
    
    // Retry handlers
    console.log('🔄 Retry Handlers:')
    if (status.retryHandlers.length === 0) {
      console.log('   No retry handlers registered')
    } else {
      for (const handler of status.retryHandlers) {
        console.log(`   📋 ${handler}`)
      }
    }
    console.log('')
    
    // Recovery strategies
    console.log('🔧 Recovery Strategies:')
    if (status.recoveryStrategies.length === 0) {
      console.log('   No recovery strategies registered')
    } else {
      for (const strategy of status.recoveryStrategies) {
        console.log(`   🎯 ${strategy}`)
      }
    }

    return { success: true, status }
  } catch (error) {
    console.error('❌ Failed to show error handling status:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Reset circuit breaker command
 */
export async function errorResetCommand(breakerName, options = {}) {
  try {
    const { errorManager, logger } = await getFlowSystemConfig()
    const breaker = errorManager.getCircuitBreaker(breakerName)
    
    if (!breaker) {
      throw new Error(`Circuit breaker '${breakerName}' not found`)
    }

    breaker.reset()
    
    await logger.info('Circuit breaker reset', {
      category: 'circuit_breaker',
      breaker: breakerName
    })

    console.log(`✅ Reset circuit breaker: ${breakerName}`)
    return { success: true, breaker: breakerName }
  } catch (error) {
    console.error('❌ Failed to reset circuit breaker:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Show logging status command
 */
export async function loggingStatusCommand(options = {}) {
  const { verbose = false } = options

  try {
    const { logger } = await getFlowSystemConfig()

    console.log('📝 Logging Status:')
    console.log('')
    console.log(`   Level: ${logger.level}`)
    console.log(`   Enabled: ${logger.enabled}`)
    console.log(`   Transports: ${logger.transports.size}`)
    console.log('')
    
    console.log('🚀 Available Transports:')
    for (const [name, transport] of logger.transports.entries()) {
      const enabledIcon = transport.enabled ? '✅' : '❌'
      console.log(`   ${enabledIcon} ${name} (${transport.format}, level: ${transport.level})`)
      
      if (verbose && transport.filename) {
        console.log(`      File: ${transport.filename}`)
      }
    }

    // Get memory transport logs if available
    const memoryTransport = logger.getTransport('memory')
    if (memoryTransport && verbose) {
      const logs = memoryTransport.getLogs()
      console.log('')
      console.log(`📊 Memory Transport: ${logs.length} logs stored`)
      
      const logsByLevel = {}
      for (const log of logs) {
        logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1
      }
      
      for (const [level, count] of Object.entries(logsByLevel)) {
        console.log(`   ${level}: ${count}`)
      }
    }

    return { success: true, status: { level: logger.level, enabled: logger.enabled, transports: logger.transports.size } }
  } catch (error) {
    console.error('❌ Failed to show logging status:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Set log level command
 */
export async function loggingSetLevelCommand(level, options = {}) {
  try {
    if (!(level in LOG_LEVELS)) {
      throw new Error(`Invalid log level: ${level}. Available: ${Object.keys(LOG_LEVELS).join(', ')}`)
    }

    const { logger } = await getFlowSystemConfig()
    const oldLevel = logger.level
    
    logger.setLevel(level)
    
    await logger.info('Log level changed', {
      category: 'logging',
      oldLevel,
      newLevel: level
    })

    console.log(`✅ Log level changed from ${oldLevel} to ${level}`)
    return { success: true, oldLevel, newLevel: level }
  } catch (error) {
    console.error('❌ Failed to set log level:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Test error handling command
 */
export async function errorTestCommand(errorType = 'NetworkError', options = {}) {
  const { withRetry = false, withCircuitBreaker = false } = options

  try {
    const { errorManager, logger } = await getFlowSystemConfig()
    
    await logger.info('Starting error handling test', {
      category: 'test',
      errorType,
      withRetry,
      withCircuitBreaker
    })

    // Create a test function that always fails
    const testFn = async () => {
      throw new Error(`Test ${errorType} error`)
    }

    const executeOptions = {}
    if (withRetry) {
      executeOptions.retryHandler = 'default'
    }
    if (withCircuitBreaker) {
      executeOptions.circuitBreaker = 'provider'
    }

    try {
      await errorManager.executeWithRecovery(testFn, executeOptions)
    } catch (error) {
      console.log('✅ Error handling test completed')
      console.log(`   Error Type: ${errorType}`)
      console.log(`   With Retry: ${withRetry}`)
      console.log(`   With Circuit Breaker: ${withCircuitBreaker}`)
      console.log(`   Final Error: ${error.message}`)
    }

    return { success: true, errorType, withRetry, withCircuitBreaker }
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message)
    return { success: false, error: error.message }
  }
} 