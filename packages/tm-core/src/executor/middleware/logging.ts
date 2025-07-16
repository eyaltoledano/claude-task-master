import { Middleware } from '../types.js'
import { Log } from '../../util/log.js'

export const mwLogging: Middleware = async (ctx, next) => {
  const log = Log.create({ service: "middleware", tool: ctx.tool.id })
  log.info('→ start')
  try {
    await next()
    log.info('✓ success')
  } catch (e) {
    log.error('✗ error', e instanceof Error ? { error: e.message } : { error: String(e) })
    throw e
  }
}
