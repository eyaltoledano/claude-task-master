import { Middleware } from '../types.js'

export const mwTiming: Middleware = async (ctx, next) => {
  const start = Date.now()
  await next()
  ctx.meta.durationMs = Date.now() - start
}
